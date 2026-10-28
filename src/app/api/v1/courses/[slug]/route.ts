import { createHash } from "node:crypto";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import { quizQuestions } from "@/db/schema";
import { licensedCourse } from "@/lib/distributors";
import { flattenOutline, getCourseOutline, totalDurationSeconds } from "@/lib/lms/courses";
import { courseJson, json, notFound, withDistributor } from "../../_shared";
import { isV2 } from "../../_learners";

/** A stable id per option, from its text: it survives reordering, and changes when the option does. */
const optionId = (text: string) => createHash("sha256").update(text).digest("hex").slice(0, 10);

// Distributors are licensed partners who run the quizzes themselves, so they get the answers:
// always in v1; in v2 only with ?include=answers (otherwise grade with POST /lessons/{id}/grade).
export const GET = withDistributor(async (distributor, request, { params }: RouteContext<"/api/v1/courses/[slug]">) => {
  const withAnswers = !isV2(request) || new URL(request.url).searchParams.getAll("include").includes("answers");
  const course = await licensedCourse(distributor.id, (await params).slug);
  if (!course) return notFound();

  const outline = await getCourseOutline(course.id);
  const all = flattenOutline(outline);
  const quizIds = all.filter((lesson) => lesson.kind === "quiz").map((lesson) => lesson.id);
  const questions = quizIds.length
    ? await db.select().from(quizQuestions).where(inArray(quizQuestions.lessonId, quizIds)).orderBy(asc(quizQuestions.position))
    : [];
  const questionsFor = (lessonId: string) =>
    questions.filter((q) => q.lessonId === lessonId).map((q) => ({
      id: q.id,
      position: q.position,
      prompt: q.prompt,
      options: q.options,
      option_ids: q.options.map(optionId),
      multi: q.correct.length > 1,
      ...(withAnswers && { correct: q.correct, explanation: q.explanation }),
    }));

  return json({
    course: {
      ...courseJson(course, all.length, totalDurationSeconds(outline)),
      chapters: outline.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        position: chapter.position,
        lessons: chapter.lessons.map((lesson) => ({
          id: lesson.id,
          slug: lesson.slug,
          title: lesson.title,
          kind: lesson.kind,
          position: lesson.position,
          summary: lesson.summary,
          duration_seconds: lesson.durationSeconds,
          is_preview: lesson.isPreview,
          has_video: Boolean(lesson.videoUid),
          updated_at: lesson.updatedAt.toISOString(),
          ...(lesson.kind === "quiz" && {
            quiz: { pass_percent: lesson.passPercent, questions: questionsFor(lesson.id) },
          }),
        })),
      })),
    },
  });
});
