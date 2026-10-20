import { and, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { certificates, courses, enrollments, lessons, type Course, type LessonProgress } from "@/db/schema";
import { hasAccess } from "@/lib/lms/access";
import { onLessonCompleted } from "@/lib/lms/completion";
import {
  flattenOutline,
  getCourseOutline,
  isLessonUnlocked,
  nextIncompleteLesson,
  type CourseOutline,
} from "@/lib/lms/courses";
import { getCourseProgress } from "@/lib/lms/progress";

export type LessonItem = {
  id: string;
  slug: string;
  title: string;
  kind: "video" | "quiz";
  durationSeconds: number;
  isPreview: boolean;
  done: boolean;
  unlocked: boolean;
};
export type ChapterItems = { id: string; title: string; lessons: LessonItem[] };

/** One learner's view of one course: access, outline with done/unlocked flags, certificate. */
export async function loadCourseState(userId: string, course: Course) {
  const enrolled = await hasAccess(userId, course.id);
  const [outline, progress, [certificate]] = await Promise.all([
    getCourseOutline(course.id),
    enrolled ? getCourseProgress(userId, course.id) : Promise.resolve<LessonProgress[]>([]),
    db
      .select({ serial: certificates.serial, revokedAt: certificates.revokedAt })
      .from(certificates)
      .where(and(eq(certificates.userId, userId), eq(certificates.courseId, course.id))),
  ]);
  const doneIds = new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));
  const chapters: ChapterItems[] = outline.map((chapter) => ({
    id: chapter.id,
    title: chapter.title,
    lessons: chapter.lessons.map((lesson) => ({
      id: lesson.id,
      slug: lesson.slug,
      title: lesson.title,
      kind: lesson.kind,
      durationSeconds: lesson.durationSeconds,
      isPreview: lesson.isPreview,
      done: doneIds.has(lesson.id),
      // `enrolled || isPreview` is canViewLesson with hasAccess already known. Display only:
      // the lesson page and APIs enforce access themselves.
      unlocked: (enrolled || lesson.isPreview) && isLessonUnlocked(outline, progress, lesson.id, course.sequential),
    })),
  }));
  const all = flattenOutline(outline);
  const done = all.filter((l) => doneIds.has(l.id)).length;
  // Finished, but no certificate: the course changed after they finished (see onLessonCompleted).
  let held: { serial: string; revokedAt: Date | null } | null = certificate ?? null;
  if (!held && enrolled && course.certificateEnabled && all.length > 0 && done === all.length) {
    const issued = await onLessonCompleted(userId, course.id);
    if (issued) held = { serial: issued.serial, revokedAt: issued.revokedAt };
  }
  return {
    enrolled,
    outline,
    progress,
    chapters,
    total: all.length,
    done,
    next: enrolled ? nextIncompleteLesson(outline, progress) : null,
    hasPreviews: all.some((l) => l.isPreview),
    certificate: held,
  };
}

/** Courses the learner can currently open (hasAccess decides), newest enrolment first. */
export async function activeCourses(userId: string): Promise<Course[]> {
  const rows = await db
    .select({ course: courses })
    .from(enrollments)
    .innerJoin(courses, eq(enrollments.courseId, courses.id))
    .where(and(eq(enrollments.userId, userId), ne(courses.status, "draft")))
    .orderBy(enrollments.startedAt);
  const open = await Promise.all(rows.map((r) => hasAccess(userId, r.course.id)));
  return rows.filter((_, i) => open[i]).map((r) => r.course).reverse();
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * For the progress and quiz APIs: null when the lesson is unknown or the learner has no
 * access, "locked" when a sequential course has not unlocked it yet.
 */
export async function lessonGate(userId: string, lessonId: unknown) {
  if (typeof lessonId !== "string" || !UUID.test(lessonId)) return null;
  const [row] = await db
    .select({ lesson: lessons, sequential: courses.sequential })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(and(eq(lessons.id, lessonId), ne(courses.status, "draft")));
  if (!row || !(await hasAccess(userId, row.lesson.courseId))) return null;
  const [outline, progress]: [CourseOutline, LessonProgress[]] = await Promise.all([
    getCourseOutline(row.lesson.courseId),
    getCourseProgress(userId, row.lesson.courseId),
  ]);
  if (!isLessonUnlocked(outline, progress, lessonId, row.sequential)) return "locked" as const;
  const completed = progress.some((p) => p.lessonId === lessonId && p.completedAt);
  return { lesson: row.lesson, completed };
}
