import { programBySlug, SHOW_PRICES } from "@/content/programs";
import { activePrice, cohortIsOpen } from "@/lib/pricing";
import { createOrder, razorpayConfigured } from "@/lib/razorpay";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Creates a Razorpay order for one seat. The price is decided here, not by the browser. */
export async function POST(request: Request) {
  if (!razorpayConfigured() || !SHOW_PRICES) {
    return Response.json({ error: "Online payment is not available yet" }, { status: 503 });
  }

  let body: { slug?: string; name?: string; email?: string; phone?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const program = body.slug ? programBySlug(body.slug) : undefined;
  const name = (body.name ?? "").trim().slice(0, 120);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = (body.phone ?? "").trim().slice(0, 20);

  if (!program) return Response.json({ error: "Unknown program" }, { status: 400 });
  if (!name) return Response.json({ error: "Please enter your name" }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) return Response.json({ error: "Please enter a valid email" }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) {
    return Response.json({ error: "Please enter a valid phone number" }, { status: 400 });
  }
  if (!cohortIsOpen(program)) {
    return Response.json({ error: "Enrolment for this cohort has closed" }, { status: 409 });
  }

  const price = activePrice(program);
  if (!price) return Response.json({ error: "This program is not sold online" }, { status: 409 });

  try {
    const { order, keyId } = await createOrder({
      amountInRupees: price.amount,
      receipt: `${program.slug}-${Date.now()}`.slice(0, 40),
      notes: { program: program.name, slug: program.slug, name, email, phone, earlyBird: String(price.isEarlyBird) },
    });

    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      programName: program.name,
      isEarlyBird: price.isEarlyBird,
    });
  } catch (error) {
    console.error("[checkout] could not create order:", error);
    return Response.json({ error: "We couldn't start the payment. Please try again." }, { status: 502 });
  }
}
