import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { quizQuestions } from "@/db/schema";
import { licensedLesson } from "@/lib/distributors";
import { gradeQuiz } from "@/lib/lms/quiz";
import { apiError, json, notFound, withDistributor } from "../../../_shared";
import { readJson } from "../../../_learners";

/**
 * Grades a quiz attempt without the answers ever leaving our servers. `answers[i]` is the list
 * of selected option indices for question i (questions in position order). Nothing is stored.
 */
export const POST = withDistributor(async (distributor, request, { params }: RouteContext<"/api/v1/lessons/[lessonId]/grade">) => {
  const lesson = await licensedLesson(distributor.id, (await params).lessonId);
  if (!lesson) return notFound();
  if (lesson.kind !== "quiz") return apiError(409, "not_a_quiz", "This lesson is not a quiz.");
  const answers = ((await readJson(request)) as { answers?: unknown } | undefined)?.answers;
  if (!Array.isArray(answers)) return apiError(400, "invalid_request", "`answers` must be an array: one array of option indices per question.");
  const questions = await db
    .select({ id: quizQuestions.id, correct: quizQuestions.correct })
    .from(quizQuestions)
    .where(eq(quizQuestions.lessonId, lesson.id))
    .orderBy(asc(quizQuestions.position));
  const grade = gradeQuiz(questions, answers, lesson.passPercent);
  return json({
    score_percent: grade.scorePercent,
    passed: grade.passed,
    pass_percent: lesson.passPercent,
    questions: questions.map((q, i) => ({ id: q.id, correct: grade.perQuestion[i] })),
  });
});
