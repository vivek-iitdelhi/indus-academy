import assert from "node:assert/strict";
import { test } from "node:test";
import { formatDuration, percentComplete, playedBetween, resumePosition, takeReportDelta } from "./playback.ts";

test("normal playback counts, at 1x and 2x", () => {
  assert.equal(playedBetween(10, 10.25), 0.25);
  assert.equal(playedBetween(10, 10.5), 0.5);
  assert.equal(playedBetween(10, 11), 1); // throttled background tab
});

test("seeks, rewinds and garbage count for nothing", () => {
  assert.equal(playedBetween(10, 200), 0);
  assert.equal(playedBetween(10, 13.5), 0);
  assert.equal(playedBetween(100, 10), 0);
  assert.equal(playedBetween(10, 10), 0);
  assert.equal(playedBetween(NaN, 10), 0);
});

test("a whole lesson of timeupdates adds up to what was played, scrubs excluded", () => {
  let total = 0;
  let t = 0;
  for (; t < 60; t += 0.25) total += playedBetween(t, t + 0.25);
  total += playedBetween(60, 250); // scrub ahead
  assert.equal(total, 60);
});

test("report deltas are capped and the rest carried over", () => {
  assert.deepEqual(takeReportDelta(12), { send: 12, keep: 0 });
  assert.deepEqual(takeReportDelta(75), { send: 30, keep: 45 });
  assert.deepEqual(takeReportDelta(-1), { send: 0, keep: 0 });
});

test("resume prefers this device's position, minus a few seconds", () => {
  assert.equal(resumePosition({ local: 120, furthestSeconds: 200, completed: false, durationSeconds: 300 }), 117);
  assert.equal(resumePosition({ local: 40, furthestSeconds: 300, completed: true, durationSeconds: 300 }), 37);
});

test("without a local position: furthest point, or the start once complete", () => {
  assert.equal(resumePosition({ local: null, furthestSeconds: 200, completed: false, durationSeconds: 300 }), 197);
  assert.equal(resumePosition({ local: null, furthestSeconds: 280, completed: true, durationSeconds: 300 }), 0);
  assert.equal(resumePosition({ local: null, furthestSeconds: 1, completed: false, durationSeconds: 300 }), 0);
});

test("near the end starts over; unknown duration does not", () => {
  assert.equal(resumePosition({ local: 295, furthestSeconds: 0, completed: false, durationSeconds: 300 }), 0);
  assert.equal(resumePosition({ local: 500, furthestSeconds: 0, completed: false, durationSeconds: 0 }), 497);
});

test("percent complete", () => {
  assert.equal(percentComplete(0, 0), 0);
  assert.equal(percentComplete(1, 3), 33);
  assert.equal(percentComplete(6, 6), 100);
});

test("durations", () => {
  assert.equal(formatDuration(0), "");
  assert.equal(formatDuration(20), "1 min");
  assert.equal(formatDuration(272), "5 min");
  assert.equal(formatDuration(3 * 3600), "3 h");
  assert.equal(formatDuration(3900), "1 h 5 min");
});
