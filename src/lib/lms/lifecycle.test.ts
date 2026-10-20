import assert from "node:assert/strict";
import { test } from "node:test";
import { pickNudges, type NudgeCandidate } from "./lifecycle.ts";

const now = new Date("2026-10-20T04:00:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const row = (enrollmentId: string, userId: string, idleDays: number, nudgedDaysAgo: number | null = null): NudgeCandidate => ({
  enrollmentId,
  userId,
  lastActivity: daysAgo(idleDays),
  nudgedAt: nudgedDaysAgo === null ? null : daysAgo(nudgedDaysAgo),
});

const picked = (rows: NudgeCandidate[], limit?: number) =>
  pickNudges(rows, now, limit).map((p) => [p.primary.enrollmentId, p.enrollmentIds]);

test("only enrolments idle for more than 7 days are due", () => {
  assert.deepEqual(picked([row("a", "u1", 3), row("b", "u2", 7), row("c", "u3", 7.01)]), [["c", ["c"]]]);
});

test("one nudge per idle spell: not again until there is newer activity", () => {
  assert.deepEqual(picked([row("a", "u1", 10, 2)]), []); // nudged after going idle
  assert.deepEqual(picked([row("a", "u1", 10, 30)]), [["a", ["a"]]]); // nudged in an earlier spell
});

test("one email per learner, about their most recently active due course", () => {
  const rows = [row("old", "u1", 40), row("recent", "u1", 9), row("active", "u1", 1), row("x", "u2", 20)];
  assert.deepEqual(picked(rows), [
    ["recent", ["recent", "old"]],
    ["x", ["x"]],
  ]);
});

test("the batch is capped, most recently active first", () => {
  const rows = [row("a", "u1", 30), row("b", "u2", 8), row("c", "u3", 15)];
  assert.deepEqual(picked(rows, 2), [
    ["b", ["b"]],
    ["c", ["c"]],
  ]);
});
