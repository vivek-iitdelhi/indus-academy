import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { courses, liveAttendance, liveRecordingProgress, liveSessions, user } from "../../db/schema.ts";
import { isCourseComplete } from "./completion.ts";
import { liveClasses, listedNow, onSale, stillRunning } from "./live-courses.ts";
import { liveStatus } from "../live-times.ts";

const at = (iso: string) => new Date(iso);
const klass = (startsAt: string, endsAt: string) => ({ id: "x", title: "x", startsAt: at(startsAt), endsAt: at(endsAt) });

test("stillRunning: other courses always; a live course until its last class ends", () => {
  const classes = [klass("2026-11-01T13:30:00Z", "2026-11-01T14:30:00Z"), klass("2026-11-02T13:30:00Z", "2026-11-02T14:30:00Z")];
  assert.equal(stillRunning({ format: "standard" }, [], at("2030-01-01T00:00:00Z")), true);
  assert.equal(stillRunning({ format: "live" }, classes, at("2026-11-01T14:00:00Z")), true); // live now
  assert.equal(stillRunning({ format: "live" }, classes, at("2026-11-02T14:29:59Z")), true); // last class running
  assert.equal(stillRunning({ format: "live" }, classes, at("2026-11-02T14:30:00Z")), false); // over: gone
  assert.equal(stillRunning({ format: "live" }, [], at("2026-11-01T00:00:00Z")), false); // nothing scheduled
});

test("liveStatus: joinable from 15 min before the start until an hour after the end", () => {
  const s = { startsAt: at("2026-11-01T13:30:00Z"), durationMinutes: 60 };
  assert.equal(liveStatus(s, at("2026-11-01T13:14:00Z")), "upcoming");
  assert.equal(liveStatus(s, at("2026-11-01T13:15:00Z")), "open");
  assert.equal(liveStatus(s, at("2026-11-01T15:30:00Z")), "open");
  assert.equal(liveStatus(s, at("2026-11-01T15:30:01Z")), "ended");
  assert.equal(liveStatus({ ...s, endedAt: at("2026-11-01T14:05:00Z") }, at("2026-11-01T14:05:00Z")), "ended"); // host ended it early
});

describe("live courses in the database", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const tag = randomUUID().slice(0, 8);
  const ids: string[] = [];
  const learner = `live-test-${tag}`;
  after(async () => {
    if (ids.length) await db.delete(courses).where(inArray(courses.id, ids)); // live sessions cascade
    await db.delete(user).where(eq(user.id, learner));
    await db.$client.end();
  });

  async function course(format: "live" | "standard", classes: { startsAt: Date; minutes: number }[] = []) {
    const [c] = await db
      .insert(courses)
      .values({ slug: `live-test-${tag}-${ids.length}`, title: "T", format, status: "published" })
      .returning();
    ids.push(c.id);
    for (const [i, k] of classes.entries()) {
      await db.insert(liveSessions).values({ courseId: c.id, title: `Class ${i + 1}`, startsAt: k.startsAt, durationMinutes: k.minutes, webinarId: `w-${tag}-${c.id}-${i}` });
    }
    return c;
  }
  const listed = async (id: string) => (await db.select({ id: courses.id }).from(courses).where(and(eq(courses.id, id), listedNow))).length === 1;

  test("listed (and on sale) until the last class ends; other courses always", async () => {
    const hour = 3_600_000;
    const now = Date.now();
    const upcoming = await course("live", [{ startsAt: new Date(now + 2 * hour), minutes: 60 }]);
    const running = await course("live", [{ startsAt: new Date(now - 30 * 60_000), minutes: 60 }]);
    const over = await course("live", [
      { startsAt: new Date(now - 3 * hour), minutes: 60 },
      { startsAt: new Date(now - 2 * hour), minutes: 60 },
    ]);
    const empty = await course("live");
    const standard = await course("standard");
    assert.deepEqual(
      await Promise.all([upcoming, running, over, empty, standard].map((c) => listed(c.id))),
      [true, true, false, false, true],
    );
    assert.deepEqual(
      await Promise.all([upcoming, running, over, empty, standard].map((c) => onSale(c))),
      [true, true, false, false, true],
    );
    const classes = await liveClasses(over.id);
    assert.deepEqual(classes.map((c) => c.title), ["Class 1", "Class 2"]);
    assert.equal(classes[0].endsAt.getTime() - classes[0].startsAt.getTime(), hour);
  });

  test("complete only once every class is over and attended or its recording watched", async () => {
    const hour = 3_600_000;
    const now = Date.now();
    await db.insert(user).values({ id: learner, name: "Live Learner", email: `${learner}@example.test` });
    const c = await course("live", [
      { startsAt: new Date(now - 5 * hour), minutes: 60 },
      { startsAt: new Date(now - 4 * hour), minutes: 60 },
      { startsAt: new Date(now + 2 * hour), minutes: 60 },
    ]);
    const [first, second, third] = await liveClasses(c.id);
    const done = () => isCourseComplete(learner, c.id);

    await db.insert(liveAttendance).values({ sessionId: first.id, userId: learner, attended: true });
    await db.insert(liveAttendance).values({ sessionId: second.id, userId: learner, attended: false });
    assert.equal(await done(), false); // missed the second, and the third is to come

    await db.insert(liveRecordingProgress).values({ sessionId: second.id, userId: learner, furthestSeconds: 3000 }); // part-watched
    assert.equal(await done(), false);
    await db.update(liveRecordingProgress).set({ completedAt: new Date() }).where(eq(liveRecordingProgress.sessionId, second.id));
    assert.equal(await done(), false); // the third hasn't happened: no certificate beforehand

    await db.insert(liveAttendance).values({ sessionId: third.id, userId: learner, attended: true });
    assert.equal(await done(), false); // attended, but not over yet
    await db.update(liveSessions).set({ endedAt: new Date(now - 1000) }).where(eq(liveSessions.id, third.id)); // host ended it
    assert.equal(await done(), true);

    assert.equal(await isCourseComplete(learner, (await course("live")).id), false); // nothing to complete
  });
});
