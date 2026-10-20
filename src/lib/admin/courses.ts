import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import {
  certificates,
  chapters,
  courses,
  enrollments,
  lessons,
  payments,
  quizQuestions,
  type LessonKind,
} from "../../db/schema.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Postgres rejects malformed uuids with an error; check route params first so they 404. */
export const isUuid = (value: unknown): value is string => typeof value === "string" && UUID_PATTERN.test(value);

/** `base`, else `base-2`, `base-3`… whichever is not taken. */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  const root = base || "lesson";
  if (!used.has(root)) return root;
  let n = 2;
  while (used.has(`${root}-${n}`)) n++;
  return `${root}-${n}`;
}

/** A copy of `items` with the item at `index` moved by `delta` places (clamped to the ends). */
export function move<T>(items: T[], index: number, delta: number): T[] {
  const next = [...items];
  const to = Math.min(Math.max(index + delta, 0), next.length - 1);
  if (index < 0 || index >= next.length || to === index) return next;
  const [item] = next.splice(index, 1);
  next.splice(to, 0, item);
  return next;
}

export type OrderOutline = { id: string; lessons: { id: string }[] }[];

/**
 * 1-based chapter positions, and course-wide lesson positions in (chapter order,
 * in-chapter order), which is what `lessons.position` means.
 */
export function outlinePositions(outline: OrderOutline) {
  let n = 0;
  return {
    chapters: outline.map((chapter, i) => ({ id: chapter.id, position: i + 1 })),
    lessons: outline.flatMap((chapter) =>
      chapter.lessons.map((lesson) => ({ id: lesson.id, chapterId: chapter.id, position: ++n })),
    ),
  };
}

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Inside a transaction: loads the course outline in its current order, lets `change`
 * rearrange it (move chapters, move lessons between chapters), then renumbers every
 * chapter and lesson position. Call it after any insert or delete too, with no change.
 */
export async function renumberOutline(tx: Tx, courseId: string, change?: (outline: OrderOutline) => OrderOutline) {
  // Serialises concurrent outline edits on the same course.
  await tx.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)).for("update");
  const chapterRows = await tx
      .select({ id: chapters.id, position: chapters.position })
      .from(chapters)
      .where(eq(chapters.courseId, courseId))
      .orderBy(asc(chapters.position), asc(chapters.id));
  const lessonRows = await tx
      .select({ id: lessons.id, chapterId: lessons.chapterId, position: lessons.position })
      .from(lessons)
      .where(eq(lessons.courseId, courseId))
      .orderBy(asc(lessons.position), asc(lessons.id));
  const current = chapterRows.map((c) => ({ id: c.id, lessons: lessonRows.filter((l) => l.chapterId === c.id) }));
  const next = outlinePositions(change ? change(current) : current);

  // ponytail: one UPDATE per changed row; fine for course-sized outlines (tens of rows).
  for (const c of next.chapters) {
    if (chapterRows.find((row) => row.id === c.id)?.position !== c.position) {
      await tx.update(chapters).set({ position: c.position }).where(eq(chapters.id, c.id));
    }
  }
  for (const l of next.lessons) {
    const row = lessonRows.find((r) => r.id === l.id);
    if (row?.position !== l.position || row.chapterId !== l.chapterId) {
      await tx.update(lessons).set({ position: l.position, chapterId: l.chapterId }).where(eq(lessons.id, l.id));
    }
  }
}

export type QuestionInput = { prompt: string; options: string[]; correct: number[]; explanation: string };
export type ParsedQuestion = { prompt: string; options: string[]; correct: number[]; explanation: string | null };

/**
 * Validates a question from the editor. `options` are the raw option slots (blank ones
 * are dropped) and `correct` holds slot indices, re-mapped to the kept options.
 */
export function parseQuestion(input: QuestionInput): { question: ParsedQuestion } | { error: string } {
  const prompt = input.prompt.trim();
  if (!prompt) return { error: "Write the question." };
  const kept = input.options.map((text, slot) => ({ text: text.trim(), slot })).filter((o) => o.text);
  if (kept.length < 2 || kept.length > 6) return { error: "Give between 2 and 6 options." };
  const correct = kept.flatMap((o, i) => (input.correct.includes(o.slot) ? [i] : []));
  if (!correct.length) return { error: "Mark at least one option as correct." };
  return {
    question: { prompt, options: kept.map((o) => o.text), correct, explanation: input.explanation.trim() || null },
  };
}

type CheckLesson = { id: string; title: string; kind: LessonKind; videoUid: string | null; durationSeconds: number };
type CheckQuestion = { lessonId: string; options: string[]; correct: number[] };

const validQuestion = (q: CheckQuestion) =>
  q.options.length >= 2 && q.correct.length >= 1 && q.correct.every((i) => Number.isInteger(i) && i >= 0 && i < q.options.length);

/** Why a course cannot be published yet; empty when it can. */
export function publishProblems(courseLessons: CheckLesson[], questions: CheckQuestion[]): string[] {
  if (!courseLessons.length) return ["Add at least one lesson."];
  return courseLessons.flatMap((lesson) => {
    if (lesson.kind === "video") {
      if (!lesson.videoUid) return [`“${lesson.title}” has no video yet.`];
      // duration_seconds is written only once the video is ready, so > 0 means ready.
      if (lesson.durationSeconds <= 0) return [`“${lesson.title}”: the video is not ready yet (still uploading or processing).`];
      return [];
    }
    const own = questions.filter((q) => q.lessonId === lesson.id);
    if (!own.length) return [`“${lesson.title}” has no questions.`];
    if (!own.every(validQuestion)) {
      return [`“${lesson.title}”: every question needs at least 2 options and 1 correct answer.`];
    }
    return [];
  });
}

export const formatDuration = (seconds: number) => {
  const minutes = Math.round(seconds / 60);
  const h = Math.floor(minutes / 60);
  return h ? `${h} h ${minutes % 60} min` : `${minutes} min`;
};

/** Rows that mean real learners or money touched the course: archive it, don't delete it. */
export async function learnerRecordCounts(courseId: string) {
  const [row] = await db
    .select({
      enrollments: sql<number>`(select count(*) from ${enrollments} where ${enrollments.courseId} = ${courseId})::int`,
      payments: sql<number>`(select count(*) from ${payments} where ${payments.courseId} = ${courseId})::int`,
      certificates: sql<number>`(select count(*) from ${certificates} where ${certificates.courseId} = ${courseId})::int`,
    })
    .from(courses)
    .where(eq(courses.id, courseId));
  return row ?? { enrollments: 0, payments: 0, certificates: 0 };
}

export async function coursePublishProblems(courseId: string): Promise<string[]> {
  const courseLessons = await db.select().from(lessons).where(eq(lessons.courseId, courseId)).orderBy(asc(lessons.position));
  const questions = courseLessons.some((l) => l.kind === "quiz")
    ? await db
        .select({ lessonId: quizQuestions.lessonId, options: quizQuestions.options, correct: quizQuestions.correct })
        .from(quizQuestions)
        .innerJoin(lessons, eq(quizQuestions.lessonId, lessons.id))
        .where(eq(lessons.courseId, courseId))
    : [];
  return publishProblems(courseLessons, questions);
}
