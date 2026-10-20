"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { enrollments, payments } from "@/db/schema";
import { completionSql, isUuid, refundBlocker } from "@/lib/admin/ops";
import { razorpayConfigured, refundPayment } from "@/lib/razorpay";
import { requireAdminApi } from "@/lib/session";
import type { ActionState } from "../learners/action-form";

/**
 * Full refund through Razorpay, then (only once Razorpay has accepted it) mark the
 * payment refunded and revoke the learner's enrolment, in one transaction.
 */
export async function refund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdminApi();
  const id = String(formData.get("paymentId") ?? "");
  if (!isUuid(id)) return { error: "Invalid request." };

  const [payment] = await db
    .select({
      status: payments.status,
      razorpayPaymentId: payments.razorpayPaymentId,
      userId: payments.userId,
      courseId: payments.courseId,
      createdAt: payments.createdAt,
      ...completionSql(payments.userId, payments.courseId),
    })
    .from(payments)
    .where(eq(payments.id, id));
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "paid" || !payment.razorpayPaymentId) return { error: `Only paid payments can be refunded (this one is ${payment.status}).` };
  const blocker = refundBlocker(payment.done, payment.total, payment.createdAt);
  if (blocker && formData.get("override") !== "1") {
    return { error: `Not eligible: ${blocker}. Confirm the override to refund anyway.` };
  }
  if (!razorpayConfigured()) return { error: "Razorpay keys are not configured (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET), so refunds are unavailable. Nothing was changed." };

  let refundId: string;
  try {
    refundId = (await refundPayment(payment.razorpayPaymentId)).id;
  } catch (error) {
    console.error("[admin] refund failed", id, error);
    return { error: `Razorpay did not accept the refund, so nothing was changed. ${error instanceof Error ? error.message : ""}`.trim() };
  }

  try {
    await db.transaction(async (tx) => {
      await tx.update(payments).set({ status: "refunded", razorpayRefundId: refundId }).where(eq(payments.id, id));
      if (payment.userId) {
        await tx
          .update(enrollments)
          .set({ status: "revoked" })
          .where(and(eq(enrollments.userId, payment.userId), eq(enrollments.courseId, payment.courseId)));
      }
    });
  } catch (error) {
    // The money has gone back; only our bookkeeping failed. Say exactly what to fix.
    console.error("[admin] refund recorded by Razorpay but not saved", { id, refundId, error });
    return { error: `Razorpay refunded it (${refundId}) but saving failed. Set this payment to refunded and revoke the enrolment by hand.` };
  }
  console.info("[admin] refunded", { id, refundId, by: admin.email });
  refresh();
  return { ok: `Refunded (${refundId}). Enrolment revoked.` };
}
