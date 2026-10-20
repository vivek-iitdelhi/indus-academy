import { db } from "@/db";
import { enrollments } from "@/db/schema";
import { hasAccess } from "@/lib/lms/access";
import { getCourseBySlug } from "@/lib/lms/courses";
import { getUser } from "@/lib/session";

/** Enrols the signed-in user in a free, published course. Safe to call twice. */
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Please sign in first" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { courseSlug?: unknown } | null;
  const course = typeof body?.courseSlug === "string" ? await getCourseBySlug(body.courseSlug) : null;
  if (!course || course.status !== "published") return Response.json({ error: "Unknown course" }, { status: 404 });
  if (course.pricePaise > 0) return Response.json({ error: "This course is not free" }, { status: 409 });

  // An existing row is left alone: a revoked enrolment stays revoked (an admin decided that).
  await db
    .insert(enrollments)
    .values({ userId: user.id, courseId: course.id, source: "free", status: "active" })
    .onConflictDoNothing();
  if (!(await hasAccess(user.id, course.id))) {
    return Response.json(
      { error: "Your access to this course was removed. Please contact us if you think that's a mistake." },
      { status: 403 },
    );
  }
  return Response.json({ redirect: `/learn/${course.slug}` });
}
