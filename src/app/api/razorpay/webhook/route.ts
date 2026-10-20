import { fulfilAndNotify } from "@/app/api/checkout/course-fulfilment";
import { recordRefund } from "@/lib/lms/purchase";
import { verifyWebhookSignature } from "@/lib/razorpay";

const HANDLED = new Set(["payment.captured", "order.paid"]);

type Event = {
  event?: string;
  payload?: {
    payment?: { entity?: { id?: string; order_id?: string; amount?: number; amount_refunded?: number } };
    refund?: { entity?: { id?: string; payment_id?: string } };
  };
};

/**
 * Razorpay webhook (dashboard → Webhooks: this URL, events payment.captured, order.paid and
 * refund.processed; secret = RAZORPAY_WEBHOOK_SECRET). Covers the learner who pays and
 * closes the tab before /api/checkout/verify runs, and refunds made outside our admin
 * (dashboard, disputes, uncaptured payments). Both paths are idempotent.
 * Anything not a course order is acknowledged with 200 and ignored; a 5xx makes Razorpay retry.
 */
export async function POST(request: Request) {
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }
  const raw = await request.text();
  if (!verifyWebhookSignature(raw, request.headers.get("x-razorpay-signature"))) {
    console.error("[razorpay webhook] bad signature");
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: Event;
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
  if (event.event === "refund.processed") return refunded(event);
  if (!event.event || !HANDLED.has(event.event) || !payment?.id || !payment.order_id) {
    return Response.json({ ignored: true });
  }

  try {
    const result = await fulfilAndNotify(payment.order_id, payment.id, "webhook");
    if (result.outcome === "problem" && result.retry) return Response.json({ retry: true }, { status: 500 });
    return Response.json({ outcome: result.outcome });
  } catch {
    return Response.json({ retry: true }, { status: 500 });
  }
}

/** A full refund revokes access (partial refunds are goodwill and keep it). */
async function refunded(event: Event) {
  const refund = event.payload?.refund?.entity;
  const payment = event.payload?.payment?.entity;
  if (!refund?.id || !refund.payment_id || !payment?.amount) return Response.json({ ignored: true });
  if ((payment.amount_refunded ?? 0) < payment.amount) return Response.json({ ignored: "partial refund" });
  try {
    const recorded = await recordRefund({ razorpayPaymentId: refund.payment_id }, refund.id);
    return Response.json({ outcome: recorded ? "refunded" : "nothing to do" });
  } catch {
    return Response.json({ retry: true }, { status: 500 });
  }
}
