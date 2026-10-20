"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { completionSql, isUuid, refundBlocker } from "@/lib/admin/ops";
import { recordRefund } from "@/lib/lms/purchase";
import { fetchRefunds, razorpayConfigured, refundPayment } from "@/lib/razorpay";
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
    // Already refunded at Razorpay (an earlier attempt that failed to save, or the dashboard)?
    const existing = await fetchRefunds(payment.razorpayPaymentId)
      .then((refunds) => refunds.find((r) => r.status !== "failed"))
      .catch(() => undefined);
    if (!existing) {
      console.error("[admin] refund failed", id, error);
      return { error: `Razorpay did not accept the refund, so nothing was changed. ${error instanceof Error ? error.message : ""}`.trim() };
    }
    refundId = existing.id;
  }

  try {
    if (!(await recordRefund({ id }, refundId))) return { ok: `Already recorded as refunded (${refundId}).` };
  } catch (error) {
    // The money has gone back; only our bookkeeping failed. Pressing Refund again records it.
    console.error("[admin] refund recorded by Razorpay but not saved", { id, refundId, error });
    return { error: `Razorpay refunded it (${refundId}) but saving failed. Press Refund again to record it.` };
  }
  console.info("[admin] refunded", { id, refundId, by: admin.email });
  refresh();
  return { ok: `Refunded (${refundId}). Access removed unless another paid order covers the course.` };
}
