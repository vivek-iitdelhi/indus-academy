import { and, eq, gt, isNull, or } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { enrollments, type Lesson } from "../../db/schema.ts";

/**
 * THE access rule: an active enrolment that has not expired. Every route that serves a
 * lesson, a playback token, progress or a quiz goes through this; never re-derive it.
 */
export async function hasAccess(userId: string, courseId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId),
        eq(enrollments.status, "active"),
        or(isNull(enrollments.expiresAt), gt(enrollments.expiresAt, new Date())),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/** Preview lessons are open to everyone, signed in or not; the rest need access. */
export async function canViewLesson(
  user: { id: string } | null,
  lesson: Pick<Lesson, "courseId" | "isPreview">,
): Promise<boolean> {
  if (lesson.isPreview) return true;
  return user ? hasAccess(user.id, lesson.courseId) : false;
}
