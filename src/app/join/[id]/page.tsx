import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ButtonLink, Container } from "@/components/ui";
import { db } from "@/db";
import { courses, enrollments, liveSessions } from "@/db/schema";
import { isUuid } from "@/lib/distributors";
import { hasAccess } from "@/lib/lms/access";
import { onSale } from "@/lib/lms/live-courses";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Join the live class", robots: { index: false, follow: false } };

/**
 * A live class's join link, to share (Admin → course → Live classes → Copy join link). Signs the
 * visitor in (new people give their name), enrols them in the course if it is free, and sends them
 * into the class. A paid course goes to its page to buy first.
 */
export default async function JoinPage({ params }: PageProps<"/join/[id]">) {
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [row] = await db
    .select({ session: liveSessions, course: courses })
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .where(eq(liveSessions.id, id));
  if (!row) notFound();
  const { course } = row;

  const here = `/join/${id}`;
  const user = await requireUser(here);
  if (!user.name.trim()) redirect(`/learn/account?next=${encodeURIComponent(here)}`);
  const room = `/learn/${course.slug}/live/${id}`;
  if (await hasAccess(user.id, course.id)) redirect(room);

  if (await onSale(course)) {
    if (course.pricePaise > 0) redirect(`/courses/${course.slug}?buy=1`);
    // Like /api/learn/enroll-free: an existing (revoked) enrolment is left alone.
    await db.insert(enrollments).values({ userId: user.id, courseId: course.id, source: "free", status: "active" }).onConflictDoNothing();
    if (await hasAccess(user.id, course.id)) redirect(room);
  }

  return (
    <Container className="max-w-xl! py-16">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">{course.title}</h1>
      <p className="mt-3 text-muted">
        {course.status === "published"
          ? "This class is over, and the course isn't taking new learners."
          : "This course isn't available."}{" "}
        If you think you should have access, write to us.
      </p>
      <ButtonLink href="/courses" variant="dark" className="mt-6 h-11">
        Browse courses
      </ButtonLink>
    </Container>
  );
}
