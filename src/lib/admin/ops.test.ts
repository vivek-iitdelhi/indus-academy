import assert from "node:assert/strict";
import { test } from "node:test";
import { PgDialect } from "drizzle-orm/pg-core";
import { payments } from "../../db/schema.ts";
import { completionPercent, completionSql, parseExpiryDate, refundEligible, toDateInput } from "./ops.ts";

test("completion percent floors and handles empty courses", () => {
  assert.equal(completionPercent(0, 6), 0);
  assert.equal(completionPercent(1, 6), 16);
  assert.equal(completionPercent(6, 6), 100);
  assert.equal(completionPercent(7, 6), 100);
  assert.equal(completionPercent(0, 0), 0);
});

test("refund: eligible strictly under 25% of lessons complete", () => {
  assert.equal(refundEligible(0, 6), true);
  assert.equal(refundEligible(1, 6), true); // 16.7%
  assert.equal(refundEligible(1, 4), false); // exactly 25%
  assert.equal(refundEligible(2, 6), false); // 33%
  assert.equal(refundEligible(24, 100), true);
  assert.equal(refundEligible(25, 100), false);
  assert.equal(refundEligible(0, 1), true);
  assert.equal(refundEligible(1, 1), false);
  assert.equal(refundEligible(0, 0), true); // nothing to complete yet
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
