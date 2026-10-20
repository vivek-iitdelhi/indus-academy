import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { payments } from "../../db/schema.ts";
import { completionPercent, completionSql, parseExpiryDate, refundBlocker, toDateInput } from "./ops.ts";

test("completion percent floors and handles empty courses", () => {
  assert.equal(completionPercent(0, 6), 0);
  assert.equal(completionPercent(1, 6), 16);
  assert.equal(completionPercent(6, 6), 100);
  assert.equal(completionPercent(7, 6), 100);
  assert.equal(completionPercent(0, 0), 0);
});

test("refund: within 24 hours and strictly under 25% of lessons complete", () => {
  const now = new Date("2026-10-20T12:00:00Z");
  const hoursAgo = (h: number) => new Date(now.getTime() - h * 3_600_000);
  const ok = (done: number, total: number, h = 1) => refundBlocker(done, total, hoursAgo(h), now) === null;
  assert.equal(ok(0, 6), true);
  assert.equal(ok(1, 6), true); // 16.7%
  assert.equal(ok(1, 4), false); // exactly 25%
  assert.equal(ok(2, 6), false); // 33%
  assert.equal(ok(24, 100), true);
  assert.equal(ok(25, 100), false);
  assert.equal(ok(0, 0), true); // nothing to complete yet
  assert.equal(ok(0, 6, 24), true); // the 24th hour still counts
  assert.equal(ok(0, 6, 24.01), false);
  assert.equal(refundBlocker(0, 6, hoursAgo(30), now), "bought over 24 hours ago");
  assert.equal(refundBlocker(2, 6, hoursAgo(1), now), "33% complete");
});

test("expiry dates end the chosen day in India", () => {
  assert.equal(parseExpiryDate(""), null);
  assert.equal(parseExpiryDate("31-12-2026"), undefined);
  assert.equal(parseExpiryDate("2026-13-01"), undefined);
  const d = parseExpiryDate("2026-12-31")!;
  assert.equal(d.toISOString(), "2026-12-31T18:29:59.999Z");
  assert.equal(toDateInput(d), "2026-12-31");
  assert.equal(toDateInput(null), "");
});

test("completion subqueries always qualify the outer columns", () => {
  const { done, total } = completionSql(payments.userId, payments.courseId);
  const dialect = new PgDialect();
  assert.match(dialect.sqlToQuery(done).sql, /lp\.user_id = "payments"\."user_id" and l\.course_id = "payments"\."course_id"/);
  assert.match(dialect.sqlToQuery(total).sql, /l\.course_id = "payments"\."course_id"/);
});
