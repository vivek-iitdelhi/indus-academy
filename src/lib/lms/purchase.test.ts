import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { courses, enrollments, payments, user } from "../../db/schema.ts";
import type { RazorpayPayment } from "../razorpay.ts";
import { verifyWebhookSignature } from "../razorpay.ts";
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

test("verifyWebhookSignature: HMAC-SHA256 of the raw body with the webhook secret", () => {
  const body = '{"event":"payment.captured"}';
  const good = createHmac("sha256", "whsec").update(body).digest("hex");
  assert.equal(verifyWebhookSignature(body, good, "whsec"), true);
  assert.equal(verifyWebhookSignature(body + " ", good, "whsec"), false);
  assert.equal(verifyWebhookSignature(body, good, "other"), false);
  assert.equal(verifyWebhookSignature(body, null, "whsec"), false);
  assert.equal(verifyWebhookSignature(body, good, undefined), false);
  assert.equal(verifyWebhookSignature(body, "short", "whsec"), false);
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms npm test
describe("fulfilCoursePayment", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const tag = randomUUID().slice(0, 8);
  const userId = `test-${tag}`;
  let courseId = "";
  let n = 0;

  const captured = (orderId: string, amount = 99900) => async (): Promise<RazorpayPayment> => ({
    status: "captured",
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
    await db.insert(payments).values({ razorpayOrderId: orderId, userId, courseId, amountPaise: 99900 });
    return orderId;
  }
  const enrolmentRows = () => db.select().from(enrollments).where(eq(enrollments.userId, userId));
  const paymentRow = async (orderId: string) =>
    (await db.select().from(payments).where(eq(payments.razorpayOrderId, orderId)))[0];

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
      status: "failed",
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

  test("a Razorpay lookup failure is a retryable problem", async () => {
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
    assert.equal(row.razorpayPaymentId, paymentId);
    const rows = await enrolmentRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].source, "purchase");
    assert.equal(rows[0].status, "active");
  });

  test("a second payment against a paid order is a problem", async () => {
    const [paid] = await db.select().from(payments).where(and(eq(payments.courseId, courseId), eq(payments.status, "paid")));
    const result = await fulfilCoursePayment(paid.razorpayOrderId, `pay_${tag}_dupe`, captured(paid.razorpayOrderId));
    assert.equal(result.outcome, "problem");
  });

  test("buying again after a revocation reactivates the same enrolment", async () => {
    await db.update(enrollments).set({ status: "revoked" }).where(eq(enrollments.userId, userId));
    const orderId = await newOrder();
    const result = await fulfilCoursePayment(orderId, `pay_${tag}_again`, captured(orderId));
    assert.equal(result.outcome, "fulfilled");
    const rows = await enrolmentRows();
    assert.equal(rows.length, 1);
    assert.equal(rows[0].status, "active");
  });
});
