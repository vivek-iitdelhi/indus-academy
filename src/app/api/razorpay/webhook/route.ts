import { fulfilAndNotify } from "@/app/api/checkout/course-fulfilment";
import { verifyWebhookSignature } from "@/lib/razorpay";

const HANDLED = new Set(["payment.captured", "order.paid"]);

/**
 * Razorpay webhook (dashboard → Webhooks: this URL, events payment.captured and order.paid,
 * secret = RAZORPAY_WEBHOOK_SECRET). Covers the learner who pays and closes the tab before
 * /api/checkout/verify runs. Fulfilment is idempotent, so racing verify is harmless.
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

  let event: { event?: string; payload?: { payment?: { entity?: { id?: string; order_id?: string } } } };
  try {
    event = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  const payment = event.payload?.payment?.entity;
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
