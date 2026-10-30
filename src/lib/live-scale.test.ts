import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, before, describe, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { certificates, courses, liveAttendance, liveAttendanceSyncs, liveJoinLinks, liveSessions, user } from "../db/schema.ts";
import { joinUrl } from "./live.ts";
import { recordOpen, SETTLE_MS, syncAttendance } from "./live-attendance.ts";

// webinar.gg stand-in: counts requests, answers join-token and the invite list.
const calls: string[] = [];
let invitees: { email: string; isHost: boolean; attended: boolean | null }[] = [];
let failPage: number | null = null;
const realFetch = globalThis.fetch;
const reply = (data: unknown) =>
  Response.json({ success: true, data, error: "" }, { headers: { ratelimit: "limit=120, remaining=100, reset=30" } });
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = new URL(String(input));
  calls.push(url.pathname + url.search);
  if (url.pathname.endsWith("/join-token")) {
    return reply({ token: `join_${randomUUID()}`, expiresAt: new Date(Date.now() + 600_000).toISOString(), expiresInSeconds: 600 });
  }
  const page = Number(url.searchParams.get("page"));
  const limit = Math.min(20, Number(url.searchParams.get("limit")));
  if (page === failPage) {
    failPage = null;
    return Response.json({ success: false, data: null, error: "boom" }, { status: 500 });
  }
  // webinar.gg lowercases every email it stores.
  const users = invitees.slice(page * limit, (page + 1) * limit).map((u) => ({ ...u, email: u.email.toLowerCase() }));
  return reply({ users, pagination: { total: invitees.length, page, limit } });
}) as typeof fetch;

// Against your own database: DATABASE_URL=postgres://localhost/indus_lms_live node --test src/lib/live-scale.test.ts
describe("live classes", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const run = randomUUID().slice(0, 8);
  const userIds = Array.from({ length: 45 }, (_, i) => `LiveTest${run}U${i}`);
  let session: typeof liveSessions.$inferSelect;
  let courseId = "";

  before(async () => {
    await db.insert(user).values(userIds.map((id) => ({ id, name: "Live Test", email: `${id}@example.invalid` })));
    const [course] = await db.insert(courses).values({ slug: `live-test-${run}`, title: "Live test", format: "standard" }).returning();
    courseId = course.id;
    [session] = await db
      .insert(liveSessions)
      .values({ courseId, title: "Live test", startsAt: new Date(Date.now() - 4 * 3600_000), durationMinutes: 60, webinarId: `wgg-${run}` })
      .returning();
  });
  after(async () => {
    globalThis.fetch = realFetch;
    await db.delete(liveJoinLinks).where(eq(liveJoinLinks.webinarId, `wgg-${run}`));
    await db.delete(certificates).where(eq(certificates.courseId, courseId)); // attending issues them
    await db.delete(courses).where(eq(courses.id, courseId));
    await db.delete(user).where(inArray(user.id, userIds));
    await db.$client.end();
  });

  test("joinUrl hands the same link out again, up to 4 times, then mints a new one", async () => {
    calls.length = 0;
    const person = { userId: userIds[0], name: "Asha Rao" };
    const first = await joinUrl(session.webinarId, person);
    for (let i = 0; i < 3; i++) assert.equal((await joinUrl(session.webinarId, person)).url, first.url);
    assert.equal(calls.length, 1, "one request for four joins");
    assert.notEqual((await joinUrl(session.webinarId, person)).url, first.url, "fifth join gets a fresh token");
    assert.notEqual((await joinUrl(session.webinarId, { ...person, name: "Asha R" })).url, first.url, "a renamed learner is a new identity");
    assert.notEqual((await joinUrl(session.webinarId, { userId: userIds[1], name: "Asha Rao" })).url, first.url, "never someone else's");
    // Close to expiry: not worth handing out.
    await db.update(liveJoinLinks).set({ expiresAt: new Date(Date.now() + 60_000), issued: 1 }).where(eq(liveJoinLinks.webinarId, session.webinarId));
    calls.length = 0;
    await joinUrl(session.webinarId, person);
    assert.equal(calls.length, 1);
  });

  test("syncAttendance reads the list a page at a time and resumes after a failure", async () => {
    // 45 invitees over three pages: even ones attended; one host; one not ours.
    invitees = userIds.map((id, i) => ({ email: `${id}.0a1b2c3d@learners.invalid`, isHost: false, attended: i % 2 === 0 }));
    invitees[3] = { email: "owner@example.com", isHost: true, attended: true };
    invitees[44] = { email: "ghost.0a1b2c3d@learners.invalid", isHost: false, attended: true };
    await recordOpen(session.id, userIds[1], null); // opened, never got in
    await recordOpen(session.id, userIds[2], null); // opened and attended

    failPage = 1;
    calls.length = 0;
    await assert.rejects(syncAttendance(session));
    const [stopped] = await db.select().from(liveAttendanceSyncs).where(eq(liveAttendanceSyncs.sessionId, session.id));
    assert.equal(stopped.nextPage, 1, "page 0 is kept");
    assert.equal(stopped.leaseUntil, null, "lease released");

    calls.length = 0;
    assert.equal(await syncAttendance(session), true);
    assert.deepEqual(
      calls.map((c) => new URL(c, "https://x").searchParams.get("page")),
      ["1", "2"],
      "resumed at page 1",
    );
    const rows = await db.select().from(liveAttendance).where(eq(liveAttendance.sessionId, session.id));
    const attended = new Set(rows.filter((r) => r.attended).map((r) => r.userId));
    assert.equal(attended.size, 22, "even ids 0..42");
    assert.ok(attended.has(userIds[2]) && !attended.has(userIds[44]));
    assert.equal(rows.find((r) => r.userId === userIds[1])?.attended, false);
    const [done] = await db.select().from(liveSessions).where(eq(liveSessions.id, session.id));
    assert.ok(done.attendanceSyncedAt);
    assert.equal((await db.select().from(liveAttendanceSyncs).where(eq(liveAttendanceSyncs.sessionId, session.id))).length, 0);
  });

  test("a class the host just ended is not final until webinar.gg's list has settled", async () => {
    const endedAt = new Date(Date.now() - 60_000);
    const [fresh] = await db
      .insert(liveSessions)
      .values({ courseId, title: "Live test 3", startsAt: new Date(Date.now() - 3600_000), durationMinutes: 60, webinarId: `wgg3-${run}`, endedAt })
      .returning();
    invitees = userIds.slice(0, 5).map((id) => ({ email: `${id}.0a1b2c3d@learners.invalid`, isHost: false, attended: false }));
    await recordOpen(fresh.id, userIds[0], null);
    assert.equal(await syncAttendance(fresh), false, "not final a minute after the end");
    const [row] = await db.select().from(liveAttendance).where(and(eq(liveAttendance.sessionId, fresh.id), eq(liveAttendance.userId, userIds[0])));
    assert.equal(row.attended, null, "not marked absent yet");
    const [sync] = await db.select().from(liveAttendanceSyncs).where(eq(liveAttendanceSyncs.sessionId, fresh.id));
    assert.equal(sync.nextPage, 0, "reads the whole list again next time");

    invitees[0].attended = true; // webinar.gg catches up
    const later = { ...fresh, endedAt: new Date(Date.now() - SETTLE_MS - 1000) };
    assert.equal(await syncAttendance(later), true);
    const [after] = await db.select().from(liveAttendance).where(and(eq(liveAttendance.sessionId, fresh.id), eq(liveAttendance.userId, userIds[0])));
    assert.equal(after.attended, true);
  });

  test("a second worker backs off while the first holds the lease", async () => {
    const [other] = await db
      .insert(liveSessions)
      .values({ courseId, title: "Live test 2", startsAt: new Date(Date.now() - 4 * 3600_000), durationMinutes: 60, webinarId: `wgg2-${run}` })
      .returning();
    await db.insert(liveAttendanceSyncs).values({ sessionId: other.id, leaseUntil: new Date(Date.now() + 60_000) });
    calls.length = 0;
    assert.equal(await syncAttendance(other), false);
    assert.equal(calls.length, 0);
    const [row] = await db.select().from(liveAttendanceSyncs).where(and(eq(liveAttendanceSyncs.sessionId, other.id)));
    assert.ok(row.leaseUntil, "left the other worker's lease alone");
  });
});
