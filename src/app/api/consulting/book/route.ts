import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { discoveryCall } from "@/content/consulting";
import { site } from "@/content/site";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { holdSlot, PAY_MINUTES } from "@/lib/bookings";
import { cashfreeConfigured, cashfreeMode, createOrder } from "@/lib/cashfree";
import { isGstin, withGstPaise } from "@/lib/gst";
import { openSlots } from "@/lib/slots";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Holds the chosen slot and creates the Cashfree order for it. The price and the slot's
 * validity are decided here; the browser only names a start time.
 */
export async function POST(request: Request) {
  if (!cashfreeConfigured()) return Response.json({ error: "Online booking is not available yet" }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const read = (key: string, max: number) => (typeof body?.[key] === "string" ? (body[key] as string).trim().slice(0, max) : "");
  const name = read("name", 120);
  const email = read("email", 200).toLowerCase();
  const phone = read("phone", 20);
  const companyName = read("company", 150);
  const notes = read("notes", 1000);
  const gstin = read("gstin", 15).toUpperCase();
  const address = read("address", 250);
  const startsAt = new Date(read("startsAt", 40));

  if (!name) return Response.json({ error: "Please enter your name" }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) return Response.json({ error: "Please enter a valid email" }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) return Response.json({ error: "Please enter a valid phone number" }, { status: 400 });
  if (gstin && !isGstin(gstin)) return Response.json({ error: "Please enter a valid 15-character GSTIN" }, { status: 400 });
  if (gstin && (!companyName || !address)) {
    return Response.json({ error: "Please enter your company name and billing address for the GST invoice" }, { status: 400 });
  }

  const now = new Date();
  const offered = openSlots(now).some((s) => s.getTime() === startsAt.getTime());
  if (!offered) return Response.json({ error: "That time is not available. Please pick another." }, { status: 409 });

  const orderId = `call_${randomUUID().replaceAll("-", "")}`;
  const amountPaise = withGstPaise(discoveryCall.price);
  try {
    const held = await holdSlot({
      orderId,
      startsAt,
      name,
      email,
      phone,
      company: companyName || null,
      notes,
      gstin: gstin || null,
      billingAddress: gstin ? address : null,
      amountPaise,
    });
    if (!held) {
      return Response.json({ error: "Someone just took that time. Please pick another.", taken: true }, { status: 409 });
    }
    try {
      const order = await createOrder({
        orderId,
        amountPaise,
        customer: { id: email, phone, email, name },
        returnUrl: `${site.url}/consulting/book?order=${orderId}`,
        tags: { kind: "call", booking: held.id },
        expiresAt: new Date(now.getTime() + PAY_MINUTES * 60_000),
      });
      return Response.json({ ...order, mode: cashfreeMode() });
    } catch (error) {
      // No order, so release the slot at once rather than waiting out the hold.
      await db.delete(bookings).where(eq(bookings.orderId, orderId));
      throw error;
    }
  } catch (error) {
    console.error("[booking] could not start booking:", error);
    return Response.json({ error: "We couldn't start the payment. Please try again." }, { status: 502 });
  }
}

