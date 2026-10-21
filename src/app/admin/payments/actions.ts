"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { completionSql, isUuid, refundBlocker } from "@/lib/admin/ops";
import { recordRefund } from "@/lib/lms/purchase";
import { cashfreeConfigured, createRefund, fetchRefunds, refundedPaise } from "@/lib/cashfree";
import { requireAdminApi } from "@/lib/session";
import type { ActionState } from "../learners/action-form";

/**
 * Full refund through Cashfree, then (only once Cashfree has accepted it) mark the
 * payment refunded and revoke the learner's enrolment, in one transaction. The refund id
 * is derived from the payment, so pressing Refund twice cannot refund twice.
 */
export async function refund(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const admin = await requireAdminApi();
  const id = String(formData.get("paymentId") ?? "");
  if (!isUuid(id)) return { error: "Invalid request." };

  const [payment] = await db
    .select({
      status: payments.status,
      orderId: payments.orderId,
      paymentId: payments.paymentId,
      amountPaise: payments.amountPaise,
      userId: payments.userId,
      courseId: payments.courseId,
      createdAt: payments.createdAt,
      ...completionSql(payments.userId, payments.courseId),
    })
    .from(payments)
    .where(eq(payments.id, id));
  if (!payment) return { error: "Payment not found." };
  if (payment.status !== "paid" || !payment.paymentId) return { error: `Only paid payments can be refunded (this one is ${payment.status}).` };
  const blocker = refundBlocker(payment.done, payment.total, payment.createdAt);
  if (blocker && formData.get("override") !== "1") {
    return { error: `Not eligible: ${blocker}. Confirm the override to refund anyway.` };
  }
  if (!cashfreeConfigured()) return { error: "Cashfree keys are not configured (CASHFREE_APP_ID / CASHFREE_SECRET_KEY), so refunds are unavailable. Nothing was changed." };

  let refundId = `refund_${id.replaceAll("-", "")}`;
  try {
    await createRefund(payment.orderId, payment.amountPaise, refundId);
  } catch (error) {
    // Already refunded at Cashfree (an earlier attempt that failed to save, or the dashboard)?
    const refunds = await fetchRefunds(payment.orderId).catch(() => []);
    if (!refunds.length || refundedPaise(refunds) < payment.amountPaise) {
      console.error("[admin] refund failed", id, error);
      return { error: `Cashfree did not accept the refund, so nothing was changed. ${error instanceof Error ? error.message : ""}`.trim() };
    }
    refundId = refunds.find((r) => r.refund_id === refundId)?.refund_id ?? refunds[0].refund_id;
  }

  try {
    if (!(await recordRefund({ id }, refundId))) return { ok: `Already recorded as refunded (${refundId}).` };
  } catch (error) {
    // The money has gone back; only our bookkeeping failed. Pressing Refund again records it.
    console.error("[admin] refund accepted by Cashfree but not saved", { id, refundId, error });
    return { error: `Cashfree accepted the refund (${refundId}) but saving failed. Press Refund again to record it.` };
  }
  console.info("[admin] refunded", { id, refundId, by: admin.email });
  refresh();
  return { ok: `Refunded (${refundId}). Access removed unless another paid order covers the course.` };
}
