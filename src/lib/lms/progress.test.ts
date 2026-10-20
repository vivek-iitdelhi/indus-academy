import assert from "node:assert/strict";
import { test } from "node:test";
import { applyProgressReport, type ProgressState } from "./progress.ts";

const now = new Date("2026-10-20T10:00:00Z");
const start: ProgressState = { secondsWatched: 0, furthestSeconds: 0, completedAt: null };

// Plays a lesson 15 s at a time from `from` to `to`.
function watch(state: ProgressState, from: number, to: number, duration: number) {
  for (let pos = from + 15; pos <= to; pos += 15) {
    state = applyProgressReport(state, { position: pos, watchedDelta: 15 }, duration, now);
  }
  return state;
}

test("watching advances furthest and seconds watched", () => {
  const s = watch(start, 0, 60, 300);
  assert.equal(s.furthestSeconds, 60);
  assert.equal(s.secondsWatched, 60);
  assert.equal(s.completedAt, null);
});

test("scrubbing to the end does not move the high-water mark or complete", () => {
  const s = applyProgressReport(start, { position: 300, watchedDelta: 2 }, 300, now);
  assert.equal(s.furthestSeconds, 7); // 0 + 2 watched + 5 tolerance
  assert.equal(s.completedAt, null);
});

test("jumping ahead then watching only advances by what was played", () => {
  let s = watch(start, 0, 60, 600);
  s = applyProgressReport(s, { position: 515, watchedDelta: 15 }, 600, now);
  assert.equal(s.furthestSeconds, 80);
});

test("completes once furthest reaches 90% of duration", () => {
  const s = watch(start, 0, 270, 300);
  assert.equal(s.furthestSeconds, 270);
  assert.equal(s.completedAt, now);
});

test("completion is never cleared or moved by later reports", () => {
  const done = watch(start, 0, 270, 300);
  const later = new Date("2026-10-21T00:00:00Z");
  const s = applyProgressReport(done, { position: 10, watchedDelta: 10 }, 300, later);
  assert.equal(s.completedAt, now);
  assert.equal(s.furthestSeconds, 270);
});

test("watchedDelta is clamped to 0..30 and position to the duration", () => {
  let s = applyProgressReport(start, { position: 50, watchedDelta: 500 }, 300, now);
  assert.equal(s.secondsWatched, 30);
  s = applyProgressReport(s, { position: 40, watchedDelta: -20 }, 300, now);
  assert.equal(s.secondsWatched, 30);
  s = watch({ ...start, furthestSeconds: 290 }, 290, 320, 300);
  assert.equal(s.furthestSeconds, 300);
});

test("a lesson with unknown duration never completes", () => {
  const s = applyProgressReport(start, { position: 0, watchedDelta: 15 }, 0, now);
  assert.equal(s.completedAt, null);
});

test("garbage input is treated as zero", () => {
  const s = applyProgressReport(undefined, { position: NaN, watchedDelta: Infinity }, 300, now);
  assert.deepEqual(s, start);
});
