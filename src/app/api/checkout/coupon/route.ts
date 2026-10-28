import { discountedPaise, findCoupon, INVALID_COUPON } from "@/lib/lms/coupons";
import { getCourseBySlug } from "@/lib/lms/courses";
import { onSale } from "@/lib/lms/live-courses";

/** Checks a coupon code for a course (`{ courseSlug, code }`) and answers with the price it gives. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { courseSlug?: unknown; code?: unknown } | null;
  const course = typeof body?.courseSlug === "string" ? await getCourseBySlug(body.courseSlug) : null;
  if (!course || course.pricePaise <= 0 || !(await onSale(course))) {
    return Response.json({ error: "Unknown course" }, { status: 404 });
  }
  const coupon = await findCoupon(course.id, body?.code);
  if (!coupon) return Response.json({ error: INVALID_COUPON }, { status: 400 });
  return Response.json({
    code: coupon.code,
    percentOff: coupon.percentOff,
    pricePaise: discountedPaise(course.pricePaise, coupon.percentOff),
  });
}
