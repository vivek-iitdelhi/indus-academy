import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { lessonProgress, lessons, quizAttempts, quizQuestions, type Certificate, type QuizQuestion } from "../../db/schema.ts";
import { hasAccess } from "./access.ts";
import { onLessonCompleted } from "./completion.ts";

export type QuizGrade = { scorePercent: number; passed: boolean; perQuestion: boolean[] };

/** Selected option indices, de-duplicated and sorted; anything else is dropped. */
const normalise = (answer: unknown): number[] =>
  Array.isArray(answer)
    ? [...new Set(answer.filter((n): n is number => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b)
    : [];

/**
 * Pure. `answers[i]` answers `questions[i]` (questions in position order). A question
 * is right only when the selected set equals the correct set exactly, so
 * multi-select needs every right option and no wrong one. An empty quiz passes.
 */
export function gradeQuiz(
  questions: Pick<QuizQuestion, "correct">[],
  answers: unknown,
  passPercent = 70,
): QuizGrade {
  const given = Array.isArray(answers) ? answers : [];
  const perQuestion = questions.map((q, i) => {
    const want = normalise(q.correct);
    const got = normalise(given[i]);
    return want.length === got.length && want.every((n, j) => n === got[j]);
  });
  const scorePercent = questions.length
    ? Math.round((100 * perQuestion.filter(Boolean).length) / questions.length)
    : 100;
  return { scorePercent, passed: scorePercent >= passPercent, perQuestion };
}

/**
 * Grades and stores an attempt. Returns null without access or if the lesson is not a
 * quiz. A pass marks the lesson complete (never un-completes) and may issue a certificate.
 */
export async function submitQuiz(
  userId: string,
  lessonId: string,
  answers: unknown,
): Promise<(QuizGrade & { attemptId: string; certificate: Certificate | null }) | null> {
  const [lesson] = await db
    .select({ courseId: lessons.courseId, kind: lessons.kind, passPercent: lessons.passPercent })
    .from(lessons)
    .where(eq(lessons.id, lessonId));
  if (!lesson || lesson.kind !== "quiz" || !(await hasAccess(userId, lesson.courseId))) return null;

  const questions = await db
    .select({ correct: quizQuestions.correct })
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, lessonId))
    .orderBy(asc(quizQuestions.position));
  const grade = gradeQuiz(questions, answers, lesson.passPercent);
  const stored = questions.map((_, i) => normalise(Array.isArray(answers) ? answers[i] : undefined));

  const [attempt] = await db
    .insert(quizAttempts)
    .values({ userId, lessonId, answers: stored, scorePercent: grade.scorePercent, passed: grade.passed })
    .returning({ id: quizAttempts.id });

  let certificate: Certificate | null = null;
  if (grade.passed) {
    const now = new Date();
    // completed_at equals `now` only if this write is the one that completed the lesson.
    const [row] = await db
      .insert(lessonProgress)
      .values({ userId, lessonId, completedAt: now })
      .onConflictDoUpdate({
        target: [lessonProgress.userId, lessonProgress.lessonId],
        set: { completedAt: sql`coalesce(${lessonProgress.completedAt}, excluded.completed_at)`, updatedAt: now },
      })
      .returning({ completedAt: lessonProgress.completedAt });
    if (row.completedAt?.getTime() === now.getTime()) {
      certificate = await onLessonCompleted(userId, lesson.courseId);
    }
  }
  return { ...grade, attemptId: attempt.id, certificate };
}
