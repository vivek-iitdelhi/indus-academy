import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import {
  chapters,
  courses,
  lessons,
  quizQuestions,
  type Chapter,
  type Course,
  type Lesson,
  type LessonProgress,
} from "../../db/schema.ts";

export type OutlineChapter = Chapter & { lessons: Lesson[] };
/** Chapters in order, each with its lessons in order. */
export type CourseOutline = OutlineChapter[];
export type ProgressRow = Pick<LessonProgress, "lessonId" | "completedAt">;

/**
 * Drafts are hidden unless asked for. Archived courses are still returned so enrolled
 * learners keep reaching them; catalogue/buy pages must check status === "published".
 */
export async function getCourseBySlug(
  slug: string,
  { includeDrafts = false }: { includeDrafts?: boolean } = {},
): Promise<Course | null> {
  const [course] = await db
    .select()
    .from(courses)
    .where(includeDrafts ? eq(courses.slug, slug) : and(eq(courses.slug, slug), ne(courses.status, "draft")))
    .limit(1);
  return course ?? null;
}

/**
 * SQL condition on `lessons`: the lesson is ready for learners (a video with a duration, a
 * quiz with questions). Lessons added to a live course stay hidden, and do not block
 * sequential courses or completion, until they are.
 */
export const lessonReady = sql`((${lessons.kind} = 'video' and ${lessons.durationSeconds} > 0) or (${lessons.kind} = 'quiz' and exists (select 1 from ${quizQuestions} where ${quizQuestions.lessonId} = ${lessons.id})))`;

/** Chapters with their ready lessons; the course builder passes includeUnready. */
export async function getCourseOutline(
  courseId: string,
  { includeUnready = false }: { includeUnready?: boolean } = {},
): Promise<CourseOutline> {
  const [chapterRows, lessonRows] = await Promise.all([
    db.select().from(chapters).where(eq(chapters.courseId, courseId)).orderBy(asc(chapters.position)),
    db
      .select()
      .from(lessons)
      .where(includeUnready ? eq(lessons.courseId, courseId) : and(eq(lessons.courseId, courseId), lessonReady))
      .orderBy(asc(lessons.position)),
  ]);
  return chapterRows.map((chapter) => ({
    ...chapter,
    lessons: lessonRows.filter((lesson) => lesson.chapterId === chapter.id),
  }));
}

/** A lesson with its course, both by slug. Drafts excluded. Does NOT check access. */
export async function getLesson(
  courseSlug: string,
  lessonSlug: string,
): Promise<{ course: Course; lesson: Lesson } | null> {
  const [row] = await db
    .select({ course: courses, lesson: lessons })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(and(eq(courses.slug, courseSlug), ne(courses.status, "draft"), eq(lessons.slug, lessonSlug)))
    .limit(1);
  return row ?? null;
}

/** Every lesson in course order. */
export const flattenOutline = (outline: CourseOutline): Lesson[] => outline.flatMap((c) => c.lessons);

export const totalDurationSeconds = (outline: CourseOutline) =>
  flattenOutline(outline).reduce((sum, lesson) => sum + lesson.durationSeconds, 0);

const completedIds = (progress: ProgressRow[]) =>
  new Set(progress.filter((p) => p.completedAt).map((p) => p.lessonId));

/** The first lesson not yet complete ("continue" target), or null when all are done. */
export function nextIncompleteLesson(outline: CourseOutline, progress: ProgressRow[]): Lesson | null {
  const done = completedIds(progress);
  return flattenOutline(outline).find((lesson) => !done.has(lesson.id)) ?? null;
}

/**
 * In a sequential course a lesson unlocks once every earlier lesson is complete.
 * Preview lessons are always open. Unknown lesson ids are locked.
 */
export function isLessonUnlocked(
  outline: CourseOutline,
  progress: ProgressRow[],
  lessonId: string,
  sequential: boolean,
): boolean {
  const all = flattenOutline(outline);
  const index = all.findIndex((lesson) => lesson.id === lessonId);
  if (index === -1) return false;
  if (!sequential || all[index].isPreview) return true;
  const done = completedIds(progress);
  return all.slice(0, index).every((lesson) => done.has(lesson.id));
}
