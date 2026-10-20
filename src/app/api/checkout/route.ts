import { eq } from "drizzle-orm";
import { programBySlug, SHOW_PRICES } from "@/content/programs";
import { db } from "@/db";
import { payments, user as userTable } from "@/db/schema";
import { hasAccess } from "@/lib/lms/access";
import { getCourseBySlug } from "@/lib/lms/courses";
import { activePrice, cohortIsOpen } from "@/lib/pricing";
import { createOrder, razorpayConfigured } from "@/lib/razorpay";
import { getUser } from "@/lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Creates a Razorpay order for one course (`{ courseSlug }`) or one program seat (`{ slug, ... }`).
 * The price is decided here, not by the browser.
 */
export async function POST(request: Request) {
  const peek = (await request
    .clone()
    .json()
    .catch(() => null)) as { courseSlug?: unknown; phone?: unknown } | null;
  if (peek?.courseSlug !== undefined) return courseCheckout(peek);

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

/**
 * A self-paced course, for the signed-in user. The payments row is written before the
 * order goes to the browser, so an abandoned payment leaves a trace; it blocks nothing,
 * since every attempt gets its own order.
 */
async function courseCheckout(body: { courseSlug?: unknown; phone?: unknown }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in to buy this course" }, { status: 401 });

  const course = typeof body.courseSlug === "string" ? await getCourseBySlug(body.courseSlug) : null;
  if (!course || course.status !== "published") return Response.json({ error: "Unknown course" }, { status: 404 });
  if (course.pricePaise <= 0) return Response.json({ error: "This course is free" }, { status: 409 });
  if (await hasAccess(user.id, course.id)) {
    return Response.json({ error: "You already own this course" }, { status: 409 });
  }
  if (!razorpayConfigured()) {
    return Response.json({ error: "Online payment is not available yet" }, { status: 503 });
  }

  // Razorpay's checkout wants a phone number; ask once and keep it on the account.
  const given = (typeof body.phone === "string" ? body.phone : "").trim().slice(0, 20);
  const phone = given || user.phone || "";
  if (phone.replace(/\D/g, "").length < 10) {
    return Response.json({ error: "Please enter a valid phone number", needsPhone: true }, { status: 400 });
  }

  try {
    if (given && given !== user.phone) await db.update(userTable).set({ phone: given }).where(eq(userTable.id, user.id));
    const { order, keyId } = await createOrder({
      amountInRupees: course.pricePaise / 100,
      receipt: `${course.slug.slice(0, 26)}-${Date.now()}`,
      notes: { kind: "course", course: course.slug, userId: user.id, email: user.email },
    });
    await db.insert(payments).values({
      razorpayOrderId: order.id,
      userId: user.id,
      courseId: course.id,
      amountPaise: order.amount,
      status: "created",
    });
    return Response.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId,
      courseTitle: course.title,
      prefill: { name: user.name, email: user.email, contact: phone },
    });
  } catch (error) {
    console.error("[checkout] could not create course order:", error);
    return Response.json({ error: "We couldn't start the payment. Please try again." }, { status: 502 });
  }
}
