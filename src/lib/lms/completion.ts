import { and, count, eq, isNotNull } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { courses, lessonProgress, lessons, type Certificate } from "../../db/schema.ts";
import { issueOrGetCertificate } from "./certificates.ts";
import { emailCertificateIssued } from "./lifecycle.ts";

/** Every lesson in the course is complete for this learner. Empty courses never are. */
export async function isCourseComplete(userId: string, courseId: string): Promise<boolean> {
  const [[total], [done]] = await Promise.all([
    db.select({ n: count() }).from(lessons).where(eq(lessons.courseId, courseId)),
    db
      .select({ n: count() })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .where(
        and(eq(lessonProgress.userId, userId), eq(lessons.courseId, courseId), isNotNull(lessonProgress.completedAt)),
      ),
  ]);
  return total.n > 0 && done.n >= total.n;
}

/**
 * Called whenever a lesson newly completes (progress.ts, quiz.ts). Issues the
 * certificate when that finished the course, and emails the learner (after the
 * response) only when this call issued it. Returns the certificate if there is one.
 */
export async function onLessonCompleted(userId: string, courseId: string): Promise<Certificate | null> {
  const [course] = await db
    .select({ certificateEnabled: courses.certificateEnabled })
    .from(courses)
    .where(eq(courses.id, courseId));
  if (!course?.certificateEnabled) return null;
  if (!(await isCourseComplete(userId, courseId))) return null;
  const { certificate, issued } = await issueOrGetCertificate(userId, courseId);
  if (issued) await emailCertificateIssued(certificate);
  return certificate;
}
