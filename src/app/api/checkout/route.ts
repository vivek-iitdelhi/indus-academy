import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { programBySlug, SHOW_PRICES } from "@/content/programs";
import { db } from "@/db";
import { enrollments, payments, user as userTable } from "@/db/schema";
import { hasAccess } from "@/lib/lms/access";
import { discountedPaise, findCoupon, INVALID_COUPON } from "@/lib/lms/coupons";
import { getCourseBySlug } from "@/lib/lms/courses";
import { cashfreeConfigured, cashfreeMode, createOrder } from "@/lib/cashfree";
import { site } from "@/content/site";
import { isGstin, withGstPaise } from "@/lib/gst";
import { activePrice, cohortIsOpen } from "@/lib/pricing";
import { getUser } from "@/lib/session";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Our order id at Cashfree (alphanumeric, _ and -, at most 45 characters). */
const newOrderId = (prefix: string) => `${prefix}_${randomUUID().replaceAll("-", "")}`;

/**
 * Creates a Cashfree order for one course (`{ courseSlug }`) or one program seat (`{ slug, ... }`).
 * The price is decided here, not by the browser. Answers with the payment session the
 * browser opens checkout with; `?order=<id>` on the return URL brings redirect checkouts back.
 */
export async function POST(request: Request) {
  const peek = (await request
    .clone()
    .json()
    .catch(() => null)) as { courseSlug?: unknown; phone?: unknown; coupon?: unknown } | null;
  if (peek?.courseSlug !== undefined) return courseCheckout(peek);

  if (!cashfreeConfigured() || !SHOW_PRICES) {
    return Response.json({ error: "Online payment is not available yet" }, { status: 503 });
  }

  let body: { slug?: string; name?: string; email?: string; phone?: string; gstin?: string; company?: string; address?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const program = body.slug ? programBySlug(body.slug) : undefined;
  const name = (body.name ?? "").trim().slice(0, 120);
  const email = (body.email ?? "").trim().toLowerCase().slice(0, 200);
  const phone = (body.phone ?? "").trim().slice(0, 20);
  // Optional: a business buyer's GST details, printed on their invoice.
  const gstin = (body.gstin ?? "").trim().toUpperCase();
  const company = (body.company ?? "").trim().slice(0, 150);
  const address = (body.address ?? "").trim().slice(0, 250);

  if (!program) return Response.json({ error: "Unknown program" }, { status: 400 });
  if (!name) return Response.json({ error: "Please enter your name" }, { status: 400 });
  if (!EMAIL_PATTERN.test(email)) return Response.json({ error: "Please enter a valid email" }, { status: 400 });
  if (phone.replace(/\D/g, "").length < 10) {
    return Response.json({ error: "Please enter a valid phone number" }, { status: 400 });
  }
  if (gstin && !isGstin(gstin)) return Response.json({ error: "Please enter a valid 15-character GSTIN" }, { status: 400 });
  if (gstin && (!company || !address)) {
    return Response.json({ error: "Please enter your company name and billing address for the GST invoice" }, { status: 400 });
  }
  if (!cohortIsOpen(program)) {
    return Response.json({ error: "Enrolment for this cohort has closed" }, { status: 409 });
  }

  const price = activePrice(program);
  if (!price) return Response.json({ error: "This program is not sold online" }, { status: 409 });

  try {
    const orderId = newOrderId("seat");
    // The buyer's details ride on the order, so verify reads them from Cashfree, not the browser.
    const order = await createOrder({
      orderId,
      // Seat prices are quoted "+ GST".
      amountPaise: withGstPaise(price.amount),
      customer: { id: email, phone, email, name },
      returnUrl: `${site.url}/programs/${program.slug}?order=${orderId}`,
      tags: {
        kind: "program",
        slug: program.slug,
        name,
        email,
        phone,
        earlyBird: String(price.isEarlyBird),
        ...(gstin && { gstin, company, address }),
      },
    });
    return Response.json({ ...order, mode: cashfreeMode(), programName: program.name, isEarlyBird: price.isEarlyBird });
  } catch (error) {
    console.error("[checkout] could not create order:", error);
    return Response.json({ error: "We couldn't start the payment. Please try again." }, { status: 502 });
  }
}

/**
 * A self-paced course, for the signed-in user, optionally with a coupon code. The payments
 * row is written before the order goes to the browser, so an abandoned payment leaves a
 * trace; it blocks nothing, since every attempt gets its own order. A coupon that brings the
 * price to nothing enrols straight away, without the gateway.
 */
async function courseCheckout(body: { courseSlug?: unknown; phone?: unknown; coupon?: unknown }) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in to buy this course" }, { status: 401 });

  const course = typeof body.courseSlug === "string" ? await getCourseBySlug(body.courseSlug) : null;
  if (!course || course.status !== "published") return Response.json({ error: "Unknown course" }, { status: 404 });
  if (course.pricePaise <= 0) return Response.json({ error: "This course is free" }, { status: 409 });
  if (await hasAccess(user.id, course.id)) {
    return Response.json({ error: "You already own this course" }, { status: 409 });
  }

  const wantsCoupon = typeof body.coupon === "string" && body.coupon.trim() !== "";
  const coupon = wantsCoupon ? await findCoupon(course.id, body.coupon) : null;
  if (wantsCoupon && !coupon) return Response.json({ error: INVALID_COUPON }, { status: 400 });
  const amountPaise = coupon ? discountedPaise(course.pricePaise, coupon.percentOff) : course.pricePaise;

  if (amountPaise === 0) {
    // As with free courses, an existing (revoked) enrolment is left alone.
    await db.insert(enrollments).values({ userId: user.id, courseId: course.id, source: "free", status: "active" }).onConflictDoNothing();
    if (!(await hasAccess(user.id, course.id))) {
      return Response.json({ error: "Your access to this course was removed. Please contact us." }, { status: 403 });
    }
    return Response.json({ redirect: `/learn/${course.slug}` });
  }

  if (!cashfreeConfigured()) {
    return Response.json({ error: "Online payment is not available yet" }, { status: 503 });
  }

  // Cashfree requires a phone number; ask once and keep it on the account.
  const given = (typeof body.phone === "string" ? body.phone : "").trim().slice(0, 20);
  const phone = given || user.phone || "";
  if (phone.replace(/\D/g, "").length < 10) {
    return Response.json({ error: "Please enter a valid phone number", needsPhone: true }, { status: 400 });
  }

  try {
    if (given && given !== user.phone) await db.update(userTable).set({ phone: given }).where(eq(userTable.id, user.id));
    const orderId = newOrderId("course");
    const order = await createOrder({
      orderId,
      amountPaise,
      customer: { id: user.id, phone, email: user.email, name: user.name },
      returnUrl: `${site.url}/courses/${course.slug}?order=${orderId}`,
      tags: { kind: "course", course: course.slug, ...(coupon && { coupon: coupon.code }) },
    });
    await db.insert(payments).values({
      orderId: order.orderId,
      userId: user.id,
      courseId: course.id,
      amountPaise,
      couponCode: coupon?.code ?? null,
      status: "created",
    });
    return Response.json({ ...order, mode: cashfreeMode() });
  } catch (error) {
    console.error("[checkout] could not create course order:", error);
    return Response.json({ error: "We couldn't start the payment. Please try again." }, { status: 502 });
  }
}
