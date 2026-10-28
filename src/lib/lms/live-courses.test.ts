import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { courses, liveSessions } from "../../db/schema.ts";
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
});

describe("live courses in the database", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const tag = randomUUID().slice(0, 8);
  const ids: string[] = [];
  after(async () => {
    if (ids.length) await db.delete(courses).where(inArray(courses.id, ids)); // live sessions cascade
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
});
