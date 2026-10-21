import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { courses, enrollments, payments, user } from "../../db/schema.ts";
import { cashfreeCustomerId, cashfreePhone, decisivePayment, refundedPaise, verifyWebhookSignature, type CashfreePayment } from "../cashfree.ts";
import { fulfilCoursePayment, paymentMismatch } from "./purchase.ts";

test("paymentMismatch: accepts the right order and amount", () => {
  assert.equal(paymentMismatch({ orderId: "order_1", amountPaise: 149900 }, { order_id: "order_1", amount: 149900 }), null);
});

test("paymentMismatch: rejects another order's payment", () => {
  assert.match(
    paymentMismatch({ orderId: "order_1", amountPaise: 149900 }, { order_id: "order_2", amount: 149900 }) ?? "",
    /order_2/,
  );
});

test("paymentMismatch: rejects a different amount", () => {
  assert.match(paymentMismatch({ orderId: "order_1", amountPaise: 149900 }, { order_id: "order_1", amount: 100 }) ?? "", /100 paise/);
});

test("verifyWebhookSignature: base64 HMAC-SHA256 of timestamp + raw body with the secret key", () => {
  const body = '{"type":"PAYMENT_SUCCESS_WEBHOOK"}';
  const ts = "1729500000000";
  const good = createHmac("sha256", "cfsk").update(ts + body).digest("base64");
  assert.equal(verifyWebhookSignature(body, ts, good, "cfsk"), true);
  assert.equal(verifyWebhookSignature(body + " ", ts, good, "cfsk"), false);
  assert.equal(verifyWebhookSignature(body, "1729500000001", good, "cfsk"), false);
  assert.equal(verifyWebhookSignature(body, ts, good, "other"), false);
  assert.equal(verifyWebhookSignature(body, ts, null, "cfsk"), false);
  assert.equal(verifyWebhookSignature(body, null, good, "cfsk"), false);
  assert.equal(verifyWebhookSignature(body, ts, good, undefined), false);
  assert.equal(verifyWebhookSignature(body, ts, "short", "cfsk"), false);
});

test("Cashfree field formats: phone, customer id", () => {
  assert.equal(cashfreePhone("+91 98765 43210"), "9876543210");
  assert.equal(cashfreePhone("98765-43210"), "9876543210");
  assert.equal(cashfreePhone("+1 415 555 0100"), "+14155550100");
  assert.equal(cashfreeCustomerId("a@b.co"), "cabco");
  assert.equal(cashfreeCustomerId(""), "c00");
  assert.equal(cashfreeCustomerId("x".repeat(80)).length, 50);
});

test("decisivePayment and refundedPaise", () => {
  const p = (status: string, id = status): CashfreePayment => ({ id, status, amount: 100, order_id: "o" });
  assert.equal(decisivePayment([p("FAILED"), p("SUCCESS"), p("PENDING")])?.status, "SUCCESS");
  assert.equal(decisivePayment([p("USER_DROPPED"), p("PENDING")])?.status, "PENDING");
  assert.equal(decisivePayment([p("FAILED")])?.status, "FAILED");
  assert.equal(decisivePayment([]), undefined);
  const r = (refund_status: string, refund_amount: number) => ({ refund_id: "r", refund_status, refund_amount });
  assert.equal(refundedPaise([r("SUCCESS", 499.5), r("PENDING", 500), r("CANCELLED", 999)]), 99950);
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms npm test
describe("fulfilCoursePayment", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const tag = randomUUID().slice(0, 8);
  const userId = `test-${tag}`;
  let courseId = "";
  let n = 0;

  const captured = (orderId: string, amount = 99900) => async (): Promise<CashfreePayment> => ({
    id: "p",
    status: "SUCCESS",
    order_id: orderId,
    amount,
  });
  async function newOrder() {
    if (!courseId) {
      await db.insert(user).values({ id: userId, name: "Test Buyer", email: `${tag}@example.test` });
      [{ id: courseId }] = await db
        .insert(courses)
        .values({ slug: `test-${tag}`, title: "Test course", format: "standard", status: "published", pricePaise: 99900 })
        .returning({ id: courses.id });
    }
    const orderId = `order_${tag}_${++n}`;
    await db.insert(payments).values({ orderId, userId, courseId, amountPaise: 99900 });
    return orderId;
  }
  const enrolmentRows = () => db.select().from(enrollments).where(eq(enrollments.userId, userId));
  const paymentRow = async (orderId: string) =>
    (await db.select().from(payments).where(eq(payments.orderId, orderId)))[0];

  after(async () => {
    if (courseId) {
      await db.delete(enrollments).where(eq(enrollments.courseId, courseId));
      await db.delete(payments).where(eq(payments.courseId, courseId));
      await db.delete(courses).where(eq(courses.id, courseId));
    }
    await db.delete(user).where(eq(user.id, userId));
    await db.$client.end();
  });

  test("unknown order (e.g. a program seat) is reported, not touched", async () => {
    const result = await fulfilCoursePayment(`order_nope_${tag}`, "pay_x", captured("x"));
    assert.equal(result.outcome, "unknown-order");
  });

  test("a payment that did not go through enrols no one", async () => {
    const orderId = await newOrder();
    const result = await fulfilCoursePayment(orderId, `pay_${tag}_failed`, async () => ({
      id: "p",
      status: "FAILED",
      order_id: orderId,
      amount: 99900,
    }));
    assert.equal(result.outcome, "not-paid");
    assert.equal((await paymentRow(orderId)).status, "created");
    assert.equal((await enrolmentRows()).length, 0);
  });

  test("wrong amount is a problem: no enrolment, row untouched", async () => {
    const orderId = await newOrder();
    const result = await fulfilCoursePayment(orderId, `pay_${tag}_short`, captured(orderId, 100));
    assert.equal(result.outcome, "problem");
    assert.equal((await paymentRow(orderId)).status, "created");
    assert.equal((await enrolmentRows()).length, 0);
  });

  test("a gateway lookup failure is a retryable problem", async () => {
    const orderId = await newOrder();
    const result = await fulfilCoursePayment(orderId, `pay_${tag}_down`, async () => {
      throw new Error("timeout");
    });
    assert.equal(result.outcome, "problem");
    assert.equal(result.outcome === "problem" && result.retry, true);
  });

  test("verify and webhook racing: one fulfils, both succeed, one enrolment, one paid row", async () => {
    const orderId = await newOrder();
    const paymentId = `pay_${tag}_ok`;
    const results = await Promise.all([
      fulfilCoursePayment(orderId, paymentId, captured(orderId)),
      fulfilCoursePayment(orderId, paymentId, captured(orderId)),
    ]);
    assert.deepEqual(results.map((r) => r.outcome).sort(), ["already-fulfilled", "fulfilled"]);
    const again = await fulfilCoursePayment(orderId, paymentId, captured(orderId));
    assert.equal(again.outcome, "already-fulfilled");

    const row = await paymentRow(orderId);
    assert.equal(row.status, "paid");
    assert.equal(row.paymentId, paymentId);
    const rows = await enrolmentRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].source, "purchase");
    assert.equal(rows[0].status, "active");
  });

  test("a second payment against a paid order is a problem", async () => {
    const [paid] = await db.select().from(payments).where(and(eq(payments.courseId, courseId), eq(payments.status, "paid")));
    const result = await fulfilCoursePayment(paid.orderId, `pay_${tag}_dupe`, captured(paid.orderId));
    assert.equal(result.outcome, "problem");
  });

  test("buying again after a revocation reactivates the same enrolment", async () => {
    await db.update(enrollments).set({ status: "revoked" }).where(eq(enrollments.userId, userId));
    const orderId = await newOrder();
    const result = await fulfilCoursePayment(orderId, `pay_${tag}_again`, captured(orderId));
    assert.equal(result.outcome, "fulfilled");
    // The earlier payment was never refunded, so the team is told to look.
    assert.ok(result.outcome === "fulfilled" && result.paidTwice);
    const rows = await enrolmentRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "active");
  });
});
