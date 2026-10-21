import { eq } from "drizzle-orm";
import { fulfilAndNotify } from "@/app/api/checkout/course-fulfilment";
import { db } from "@/db";
import { payments } from "@/db/schema";
import { fetchRefunds, refundedPaise, verifyWebhookSignature } from "@/lib/cashfree";
import { recordRefund } from "@/lib/lms/purchase";

type Event = {
  type?: string;
  data?: {
    order?: { order_id?: string };
    payment?: { cf_payment_id?: string | number; payment_status?: string };
    refund?: { order_id?: string; refund_id?: string; refund_status?: string };
  };
};

/**
 * Cashfree webhooks, signed with the secret key. Payment webhooks come per order (the
 * notify_url set at checkout); refund webhooks need the dashboard: Developers → Webhooks,
 * this URL, version 2023-08-01. Covers the learner who pays and closes the tab before
 * /api/checkout/verify runs, and refunds made outside our admin. Both paths look the
 * facts up at Cashfree and are idempotent, so replays and duplicates are harmless.
 * Anything else is acknowledged with 200 and ignored; a 5xx makes Cashfree retry.
 */
export async function POST(request: Request) {
  const raw = await request.text();
  const signed = verifyWebhookSignature(raw, request.headers.get("x-webhook-timestamp"), request.headers.get("x-webhook-signature"));
  if (!signed) {
    console.error("[cashfree webhook] bad signature");
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: Event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  if (event.type === "REFUND_STATUS_WEBHOOK") return refunded(event);

  const orderId = event.data?.order?.order_id;
  const paymentId = event.data?.payment?.cf_payment_id;
  if (event.type !== "PAYMENT_SUCCESS_WEBHOOK" || !orderId || paymentId === undefined) return Response.json({ ignored: true });
  try {
    const result = await fulfilAndNotify(orderId, String(paymentId), "webhook");
    if (result.outcome === "problem" && result.retry) return Response.json({ retry: true }, { status: 500 });
    return Response.json({ outcome: result.outcome });
  } catch {
    return Response.json({ retry: true }, { status: 500 });
  }
}

/** Once the whole order is refunded, access goes (partial refunds are goodwill and keep it). */
async function refunded(event: Event) {
  const refund = event.data?.refund;
  if (refund?.refund_status !== "SUCCESS" || !refund.order_id || !refund.refund_id) return Response.json({ ignored: true });
  try {
    const [row] = await db.select({ amountPaise: payments.amountPaise }).from(payments).where(eq(payments.orderId, refund.order_id));
    if (!row) return Response.json({ ignored: "not a course order" });
    if (refundedPaise(await fetchRefunds(refund.order_id)) < row.amountPaise) return Response.json({ ignored: "partial refund" });
    const recorded = await recordRefund({ orderId: refund.order_id }, refund.refund_id);
    return Response.json({ outcome: recorded ? "refunded" : "nothing to do" });
  } catch {
    return Response.json({ retry: true }, { status: 500 });
  }
}
