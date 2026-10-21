import { createHmac, timingSafeEqual } from "node:crypto";

// Cashfree Payment Gateway, API version 2023-08-01. Amounts at Cashfree are rupees
// (2 decimals); everything here takes and returns paise, like the rest of the app.
const API_VERSION = "2023-08-01";

export const cashfreeConfigured = () => Boolean(process.env.CASHFREE_APP_ID && process.env.CASHFREE_SECRET_KEY);

/** Sandbox app ids start with "TEST"; anything else is live. The browser SDK needs the same mode. */
export const cashfreeMode = (): "sandbox" | "production" =>
  process.env.CASHFREE_APP_ID?.startsWith("TEST") ? "sandbox" : "production";

const toPaise = (rupees: number) => Math.round(rupees * 100);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const id = process.env.CASHFREE_APP_ID;
  const secret = process.env.CASHFREE_SECRET_KEY;
  if (!id || !secret) throw new Error("Cashfree keys are not set");
  const base = cashfreeMode() === "sandbox" ? "https://sandbox.cashfree.com/pg" : "https://api.cashfree.com/pg";
  const res = await fetch(`${base}${path}`, {
    method,
    headers: {
      "x-client-id": id,
      "x-client-secret": secret,
      "x-api-version": API_VERSION,
      ...(body ? { "content-type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Cashfree ${method} ${path} responded ${res.status}: ${(await res.text()).slice(0, 500)}`);
  return (await res.json()) as T;
}

/** Cashfree wants exactly 10 digits for Indian numbers, or "+<country code><number>". */
export function cashfreePhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  return `+${digits}`;
}

/** Customer ids are alphanumeric, 3 to 50 characters. */
export const cashfreeCustomerId = (value: string) => `c${value.replace(/[^a-zA-Z0-9]/g, "")}`.slice(0, 50).padEnd(3, "0");

/**
 * Creates an order; the browser opens checkout with the returned payment session id.
 * `orderId` is ours (alphanumeric, _ and -, 3 to 45 characters).
 */
export async function createOrder(input: {
  orderId: string;
  amountPaise: number;
  customer: { id: string; phone: string; email?: string; name?: string };
  /** Back here after a redirect checkout (in-app browsers that cannot show the popup). */
  returnUrl: string;
  tags?: Record<string, string>;
}) {
  // Payment webhooks for this order. Live Cashfree accepts only https URLs, so a local
  // build (http://localhost) sends neither and relies on the popup closing.
  const https = input.returnUrl.startsWith("https://");
  const order = await call<{ order_id: string; payment_session_id: string }>("POST", "/orders", {
    order_id: input.orderId,
    order_amount: input.amountPaise / 100,
    order_currency: "INR",
    customer_details: {
      customer_id: cashfreeCustomerId(input.customer.id),
      customer_phone: cashfreePhone(input.customer.phone),
      customer_email: input.customer.email || undefined,
      customer_name: input.customer.name && input.customer.name.length >= 3 ? input.customer.name.slice(0, 100) : undefined,
    },
    order_meta: https ? { return_url: input.returnUrl, notify_url: new URL("/api/cashfree/webhook", input.returnUrl).toString() } : undefined,
    order_tags: input.tags,
  });
  return { orderId: order.order_id, paymentSessionId: order.payment_session_id };
}

/** The order as Cashfree has it: amount in paise, and the tags we set when creating it. */
export async function fetchOrder(orderId: string) {
  const order = await call<{ order_amount: number; order_status: string; order_tags: Record<string, string> | null }>(
    "GET",
    `/orders/${encodeURIComponent(orderId)}`,
  );
  return { amountPaise: toPaise(order.order_amount), status: order.order_status, tags: order.order_tags ?? {} };
}

/** One payment attempt. `status` is Cashfree's: SUCCESS, PENDING, FAILED, USER_DROPPED, … */
export type CashfreePayment = { id: string; status: string; amount: number; order_id: string };

export async function fetchPayments(orderId: string): Promise<CashfreePayment[]> {
  const list = await call<{ cf_payment_id: string | number; payment_status: string; payment_amount: number; order_id: string }[]>(
    "GET",
    `/orders/${encodeURIComponent(orderId)}/payments`,
  );
  return list.map((p) => ({ id: String(p.cf_payment_id), status: p.payment_status, amount: toPaise(p.payment_amount), order_id: p.order_id }));
}

/** The attempt that settles the order: a successful one, else a pending one, else the latest. */
export function decisivePayment(list: CashfreePayment[]) {
  return list.find((p) => p.status === "SUCCESS") ?? list.find((p) => p.status === "PENDING") ?? list[0];
}

/** Looks one payment up by id; throws if the order has no such payment. */
export async function fetchPayment(orderId: string, paymentId: string): Promise<CashfreePayment> {
  const payment = (await fetchPayments(orderId)).find((p) => p.id === paymentId);
  if (!payment) throw new Error(`no payment ${paymentId} on order ${orderId}`);
  return payment;
}

export type CashfreeRefund = { refund_id: string; refund_status: string; refund_amount: number };

/**
 * Refunds `amountPaise` of an order. `refundId` is ours and unique per order, so retrying
 * with the same id cannot refund twice. Refunds settle later (refund webhook); a fresh
 * one is usually PENDING.
 */
export const createRefund = (orderId: string, amountPaise: number, refundId: string) =>
  call<CashfreeRefund>("POST", `/orders/${encodeURIComponent(orderId)}/refunds`, {
    refund_amount: amountPaise / 100,
    refund_id: refundId,
  });

export const fetchRefunds = (orderId: string) => call<CashfreeRefund[]>("GET", `/orders/${encodeURIComponent(orderId)}/refunds`);

/** Paise refunded or on the way back (failed and cancelled refunds don't count). */
export const refundedPaise = (refunds: CashfreeRefund[]) =>
  refunds
    .filter((r) => ["SUCCESS", "PENDING", "ONHOLD", "PENDING_APPROVAL"].includes(r.refund_status))
    .reduce((sum, r) => sum + toPaise(r.refund_amount), 0);

/**
 * Webhooks are signed with the secret key: x-webhook-signature is the base64
 * HMAC-SHA256 of x-webhook-timestamp followed by the raw body.
 */
export function verifyWebhookSignature(
  rawBody: string,
  timestamp: string | null,
  signature: string | null,
  secret = process.env.CASHFREE_SECRET_KEY,
) {
  if (!secret || !timestamp || !signature) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(timestamp + rawBody).digest("base64"));
  const given = Buffer.from(signature);
  return given.length === expected.length && timingSafeEqual(given, expected);
}
