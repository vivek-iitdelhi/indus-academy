import { asc, eq } from "drizzle-orm";
import { lessonGate } from "@/app/learn/data";
import { db } from "@/db";
import { quizQuestions } from "@/db/schema";
import { submitQuiz } from "@/lib/lms/quiz";
import { getUser } from "@/lib/session";

// POST {lessonId, answers: number[][]}. Correct answers never leave the server;
// explanations are sent only with a pass.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to submit." }, { status: 401 });
  if (!user.name.trim()) return Response.json({ error: "Add your name first." }, { status: 409 });

  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.answers)) return Response.json({ error: "Bad answers." }, { status: 400 });

  const gate = await lessonGate(user.id, body.lessonId);
  if (!gate || gate === "locked") {
    return gate === "locked"
      ? Response.json({ error: "Finish the earlier lessons first." }, { status: 403 })
      : Response.json({ error: "Not found." }, { status: 404 });
  }
  const grade = await submitQuiz(user.id, gate.lesson.id, body.answers);
  if (!grade) return Response.json({ error: "Not found." }, { status: 404 });

  const explanations = grade.passed
    ? (
        await db
          .select({ explanation: quizQuestions.explanation })
          .from(quizQuestions)
          .where(eq(quizQuestions.lessonId, gate.lesson.id))
          .orderBy(asc(quizQuestions.position))
      ).map((q) => q.explanation)
    : null;

  return Response.json({
    scorePercent: grade.scorePercent,
    passed: grade.passed,
    passPercent: gate.lesson.passPercent,
    perQuestion: grade.perQuestion,
    explanations,
    newlyCompleted: grade.passed && !gate.completed,
    certificate: grade.certificate && { serial: grade.certificate.serial },
  });
}
