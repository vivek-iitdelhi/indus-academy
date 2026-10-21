import { hasAccess } from "@/lib/lms/access";
import { getCourseBySlug } from "@/lib/lms/courses";
import { cashfreeConfigured } from "@/lib/cashfree";
import { getUser } from "@/lib/session";

/**
 * The per-visitor half of the (static) course page: is the visitor signed in, do they own
 * the course, and can they pay online. Read here, at request time, so neither the session
 * nor the payment keys are baked into the prerendered page.
 */
export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get("course");
  const user = await getUser();
  const course = user && slug ? await getCourseBySlug(slug) : null;
  const body = {
    signedIn: Boolean(user),
    owned: Boolean(user && course && (await hasAccess(user.id, course.id))),
    needsPhone: Boolean(user && !user.phone),
    paymentsEnabled: cashfreeConfigured(),
  };
  return Response.json(body, { headers: { "cache-control": "private, no-store" } });
}
