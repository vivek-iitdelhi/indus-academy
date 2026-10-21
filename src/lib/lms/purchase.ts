import { and, eq, ne } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { courses, enrollments, payments, user } from "../../db/schema.ts";
import { fetchPayment, type CashfreePayment } from "../cashfree.ts";


/** Why this payment cannot pay for this order, or null when it can. Pure. */
export function paymentMismatch(
  order: { orderId: string; amountPaise: number },
  payment: Pick<CashfreePayment, "order_id" | "amount">,
): string | null {
  if (payment.order_id !== order.orderId) return `payment belongs to order ${payment.order_id}, not ${order.orderId}`;
  if (payment.amount !== order.amountPaise) return `paid ${payment.amount} paise, order is for ${order.amountPaise}`;
  return null;
}

export type Purchase = {
  orderId: string;
  paymentId: string;
  courseSlug: string;
  courseTitle: string;
  amountPaise: number;
  buyerEmail: string | null;
  buyerName: string | null;
};

export type FulfilResult =
  /** No payments row: not a course order (program seats have none). */
  | { outcome: "unknown-order"; orderId: string; paymentId: string }
  /** This call enrolled the learner: send the emails. `paidTwice`: an earlier paid order for the same course. */
  | (Purchase & { outcome: "fulfilled"; paidTwice?: string })
  /** Verify and the webhook both run; whichever comes second lands here. Send nothing. */
  | (Purchase & { outcome: "already-fulfilled" })
  /** The gateway says the money did not move (failed, or still pending). No enrolment, nothing to alert. */
  | (Purchase & { outcome: "not-paid"; status: string })
  /** Money may have moved but we did not enrol: alert the team. `retry` = worth trying again. */
  | (Purchase & { outcome: "problem"; problem: string; retry: boolean });

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

/**
 * Turns a gateway payment for a course order into an enrolment. Used by both
 * /api/checkout/verify and the webhook, so it is idempotent and race-safe: the payment
 * row flips created → paid in the same transaction as the enrolment upsert, and only the
 * caller that flips it gets "fulfilled". The payment is looked up at the gateway here,
 * so callers need not trust where the ids came from.
 */
export async function fulfilCoursePayment(
  orderId: string,
  paymentId: string,
  lookup: (orderId: string, paymentId: string) => Promise<CashfreePayment> = fetchPayment,
): Promise<FulfilResult> {
  const [row] = await db
    .select({ payment: payments, courseSlug: courses.slug, courseTitle: courses.title, email: user.email, name: user.name })
    .from(payments)
    .innerJoin(courses, eq(payments.courseId, courses.id))
    .leftJoin(user, eq(payments.userId, user.id))
    .where(eq(payments.orderId, orderId))
    .limit(1);
  if (!row) return { outcome: "unknown-order", orderId, paymentId };

  const { payment } = row;
  const purchase: Purchase = {
    orderId,
    paymentId,
    courseSlug: row.courseSlug,
    courseTitle: row.courseTitle,
    amountPaise: payment.amountPaise,
    buyerEmail: row.email,
    buyerName: row.name,
  };
  const problem = (problem: string, retry = false): FulfilResult => ({ ...purchase, outcome: "problem", problem, retry });

  if (payment.status === "paid" && payment.paymentId === paymentId) {
    return { ...purchase, outcome: "already-fulfilled" };
  }
  if (payment.status !== "created") {
    return problem(`order is already ${payment.status}${payment.paymentId ? ` by payment ${payment.paymentId}` : ""}`);
  }
  const userId = payment.userId;
  if (!userId) return problem("the buyer's account no longer exists");

  // Ask the gateway what really happened rather than trusting the caller.
  let paid: CashfreePayment;
  try {
    paid = await lookup(orderId, paymentId);
  } catch (error) {
    return problem(`could not look the payment up at Cashfree: ${message(error)}`, true);
  }
  if (paid.status !== "SUCCESS") return { ...purchase, outcome: "not-paid", status: paid.status };
  const mismatch = paymentMismatch({ orderId, amountPaise: payment.amountPaise }, paid);
  if (mismatch) return problem(mismatch);

  let won: boolean;
  try {
    won = await db.transaction(async (tx) => {
      const flipped = await tx
        .update(payments)
        .set({ status: "paid", paymentId })
        .where(and(eq(payments.id, payment.id), eq(payments.status, "created")))
        .returning({ id: payments.id });
      if (!flipped.length) return false;
      // A purchase is permanent: reactivate a revoked or expired row rather than adding one.
      await tx
        .insert(enrollments)
        .values({ userId, courseId: payment.courseId, source: "purchase", status: "active" })
        .onConflictDoUpdate({
          target: [enrollments.userId, enrollments.courseId],
          set: { source: "purchase", status: "active", expiresAt: null },
        });
      return true;
    });
  } catch (error) {
    return problem(`database error while enrolling: ${message(error)}`, true);
  }
  // Lost the race to the other caller: re-read, which now lands on a non-"created" branch.
  if (!won) return fulfilCoursePayment(orderId, paymentId, lookup);
  // Two tabs, two payments (or a re-purchase after access was revoked without a refund):
  // the learner is enrolled either way, but the team must look and probably refund one.
  const [earlier] = await db
    .select({ orderId: payments.orderId })
    .from(payments)
    .where(
      and(eq(payments.userId, userId), eq(payments.courseId, payment.courseId), eq(payments.status, "paid"), ne(payments.id, payment.id)),
    )
    .limit(1);
  return { ...purchase, outcome: "fulfilled", paidTwice: earlier?.orderId };
}

/**
 * Records a full refund: the payment becomes refunded and the enrolment is revoked, unless
 * another paid payment still covers the course. Used by the admin refund and the
 * refund webhook. False if the payment was not "paid" (already recorded).
 */
export async function recordRefund(
  match: { id: string } | { orderId: string },
  refundId: string,
): Promise<boolean> {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .update(payments)
      .set({ status: "refunded", refundId })
      .where(
        and(
          "id" in match ? eq(payments.id, match.id) : eq(payments.orderId, match.orderId),
          eq(payments.status, "paid"),
        ),
      )
      .returning({ userId: payments.userId, courseId: payments.courseId });
    if (!row) return false;
    if (row.userId) {
      const [stillPaid] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(and(eq(payments.userId, row.userId), eq(payments.courseId, row.courseId), eq(payments.status, "paid")))
        .limit(1);
      if (!stillPaid) {
        await tx
          .update(enrollments)
          .set({ status: "revoked" })
          .where(and(eq(enrollments.userId, row.userId), eq(enrollments.courseId, row.courseId)));
      }
    }
    return true;
  });
}
