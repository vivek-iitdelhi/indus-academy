import { createHmac, timingSafeEqual } from "node:crypto";

const RAZORPAY_API = "https://api.razorpay.com/v1";

export const razorpayConfigured = () =>
  Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);

function auth() {
  const id = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!id || !secret) throw new Error("Razorpay keys are not set");
  return { id, secret, header: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}` };
}

export type RazorpayOrder = { id: string; amount: number; currency: string };

export async function createOrder({
  amountInRupees,
  receipt,
  notes,
}: {
  amountInRupees: number;
  receipt: string;
  notes: Record<string, string>;
}): Promise<{ order: RazorpayOrder; keyId: string }> {
  const { header, id } = auth();
  const res = await fetch(`${RAZORPAY_API}/orders`, {
    method: "POST",
    headers: { authorization: header, "content-type": "application/json" },
    // Razorpay works in paise.
    body: JSON.stringify({ amount: Math.round(amountInRupees * 100), currency: "INR", receipt, notes }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Razorpay order failed: ${res.status} ${await res.text()}`);
  return { order: (await res.json()) as RazorpayOrder, keyId: id };
}

/** Confirms the payment really came from Razorpay and was not forged. */
export function verifySignature({
  orderId,
  paymentId,
  signature,
}: {
  orderId: string;
  paymentId: string;
  signature: string;
}) {
  const { secret } = auth();
  const expected = createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  return given.length === want.length && timingSafeEqual(given, want);
}

export async function fetchPayment(paymentId: string) {
  const { header } = auth();
  const res = await fetch(`${RAZORPAY_API}/payments/${paymentId}`, {
    headers: { authorization: header },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Razorpay payment lookup failed: ${res.status}`);
  return (await res.json()) as { status: string; amount: number; order_id: string; email?: string; contact?: string };
}
