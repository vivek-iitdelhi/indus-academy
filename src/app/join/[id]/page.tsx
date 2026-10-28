import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { ButtonLink, Container } from "@/components/ui";
import { db } from "@/db";
import { courses, enrollments, liveSessions } from "@/db/schema";
import { isUuid } from "@/lib/distributors";
import { hasAccess } from "@/lib/lms/access";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Join the live class", robots: { index: false, follow: false } };

/**
 * A live class's join link, to share (Admin → course → Live classes → Copy join link; a class
 * page's own address lands here too). Whoever has it gets in: signs in (new people give their
 * name), is enrolled in the course, paid or not, and goes into the class.
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

  // "manual" for a paid course, so it doesn't read as a sale. An existing enrolment (revoked, or
  // expired) is left alone: an admin ended it.
  await db
    .insert(enrollments)
    .values({ userId: user.id, courseId: course.id, source: course.pricePaise > 0 ? "manual" : "free", status: "active" })
    .onConflictDoNothing();
  if (await hasAccess(user.id, course.id)) redirect(room);

  return (
    <Container className="max-w-xl! py-16">
      <h1 className="text-2xl font-semibold tracking-[-0.02em]">{course.title}</h1>
      <p className="mt-3 text-muted">Your access to this course has ended. If you think you should have it, write to us.</p>
      <ButtonLink href="/learn" variant="dark" className="mt-6 h-11">
        My courses
      </ButtonLink>
    </Container>
  );
}
