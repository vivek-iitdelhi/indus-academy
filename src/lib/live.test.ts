import assert from "node:assert/strict";
import { test } from "node:test";
import { indiaParts, learnerIdFromEmail, liveStatus, parseIndiaDateTime } from "./live.ts";

test("indiaParts gives webinar.gg's India wall-clock date and 12-hour time", () => {
  assert.deepEqual(indiaParts(new Date("2026-10-27T12:30:00Z")), { date: "2026-10-27", time: "06:00", meridiem: "PM" });
  assert.deepEqual(indiaParts(new Date("2026-10-26T18:45:00Z")), { date: "2026-10-27", time: "12:15", meridiem: "AM" });
  assert.deepEqual(indiaParts(new Date("2026-10-27T06:30:00Z")), { date: "2026-10-27", time: "12:00", meridiem: "PM" });
});

test("parseIndiaDateTime reads a datetime-local value as India time", () => {
  assert.equal(parseIndiaDateTime("2026-10-27T18:00")?.toISOString(), "2026-10-27T12:30:00.000Z");
  assert.equal(parseIndiaDateTime("27/10/2026 6pm"), null);
  assert.equal(parseIndiaDateTime("2026-13-40T99:99"), null);
});

test("liveStatus opens 15 minutes early and closes an hour after the planned end", () => {
  const session = { startsAt: new Date("2026-10-27T12:30:00Z"), durationMinutes: 60 };
  assert.equal(liveStatus(session, new Date("2026-10-27T12:14:00Z")), "upcoming");
  assert.equal(liveStatus(session, new Date("2026-10-27T12:15:00Z")), "open");
  assert.equal(liveStatus(session, new Date("2026-10-27T14:30:00Z")), "open");
  assert.equal(liveStatus(session, new Date("2026-10-27T14:31:00Z")), "ended");
});

test("learnerIdFromEmail reads both placeholder forms and nothing else", () => {
  assert.equal(learnerIdFromEmail("zW7BkzTG@learners.invalid"), "zW7BkzTG");
  assert.equal(learnerIdFromEmail("zW7BkzTG.0a1b2c3d@learners.invalid"), "zW7BkzTG");
  assert.equal(learnerIdFromEmail("academyindusai@gmail.com"), null);
  assert.equal(learnerIdFromEmail("a.b.c@learners.invalid"), null);
});
