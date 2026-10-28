import { and, count, eq, exists, isNotNull, lte, or, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { courses, lessonProgress, lessons, liveAttendance, liveRecordingProgress, liveSessions, user, type Certificate } from "../../db/schema.ts";
import { LATE_GRACE_MS } from "../live-times.ts";
import { lessonReady } from "./courses.ts";
import { issueOrGetCertificate } from "./certificates.ts";
import { emailCertificateIssued } from "./lifecycle.ts";

/** SQL: the live class is over: the host ended it, or its time (plus the grace hour) is up. */
const classOver = or(
  lte(liveSessions.endedAt, sql`now()`),
  sql`${liveSessions.startsAt} + make_interval(mins => ${liveSessions.durationMinutes}) + make_interval(secs => ${LATE_GRACE_MS / 1000}) < now()`,
);

/**
 * Every ready lesson in the course is complete for this learner, and every live class of it is
 * over and was attended (webinar.gg saw them in the room) or its recording watched to 90%. So
 * no certificate before the last class. A course with neither lessons nor classes never is.
 * ponytail: a class missed whose recording never arrived (or was deleted) blocks it; an admin
 * issues that certificate by hand (Admin → Certificates).
 */
export async function isCourseComplete(userId: string, courseId: string): Promise<boolean> {
  const [[total], [done], [classes], [covered]] = await Promise.all([
    db.select({ n: count() }).from(lessons).where(and(eq(lessons.courseId, courseId), lessonReady)),
    db
      .select({ n: count() })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .where(
        and(eq(lessonProgress.userId, userId), eq(lessons.courseId, courseId), isNotNull(lessonProgress.completedAt), lessonReady),
      ),
    db.select({ n: count() }).from(liveSessions).where(eq(liveSessions.courseId, courseId)),
    db
      .select({ n: count() })
      .from(liveSessions)
      .where(
        and(
          eq(liveSessions.courseId, courseId),
          classOver,
          or(
            exists(
              db
                .select()
                .from(liveAttendance)
                .where(and(eq(liveAttendance.sessionId, liveSessions.id), eq(liveAttendance.userId, userId), eq(liveAttendance.attended, true))),
            ),
            exists(
              db
                .select()
                .from(liveRecordingProgress)
                .where(
                  and(
                    eq(liveRecordingProgress.sessionId, liveSessions.id),
                    eq(liveRecordingProgress.userId, userId),
                    isNotNull(liveRecordingProgress.completedAt),
                  ),
                ),
            ),
          ),
        ),
      ),
  ]);
  return total.n + classes.n > 0 && done.n >= total.n && covered.n >= classes.n;
}

/**
 * Called whenever a lesson or a class recording newly completes (progress.ts, quiz.ts), when a
 * class's attendance is read (live-attendance.ts), and when a learner who has finished every
 * lesson opens the course without a certificate (an admin removed their last open lesson,
 * turned certificates on later, or a class has since ended). Issues the
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
  const [holder] = await db.select({ name: user.name }).from(user).where(eq(user.id, userId));
  if (!holder?.name.trim()) return null; // the certificate prints the name; the name gate asks first
  const { certificate, issued } = await issueOrGetCertificate(userId, courseId);
  if (issued) await emailCertificateIssued(certificate);
  return certificate;
}
