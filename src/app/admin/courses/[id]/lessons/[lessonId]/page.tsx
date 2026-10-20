import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessonProgress, lessons, quizQuestions, type QuizQuestion } from "@/db/schema";
import { formatDuration, isUuid } from "@/lib/admin/courses";
import { requireAdmin } from "@/lib/session";
import { iframeUrl, signPlaybackToken, videoConfigured } from "@/lib/video";
import {
  deleteLesson,
  deleteQuestion,
  discardPendingVideo,
  moveQuestion,
  saveQuestion,
  setManualVideo,
  updateLesson,
} from "../../../actions";
import { ActionForm, ConfirmButton } from "../../../client";
import {
  cardClass,
  CheckField,
  dangerButtonClass,
  Field,
  inputClass,
  miniButtonClass,
  secondaryButtonClass,
  SectionTitle,
} from "../../../form-ui";
import { VideoUploader } from "./video-uploader";

const OPTION_SLOTS = 6;

/** Prompt, up to six options with "correct" ticks, explanation. Blank options are dropped on save. */
function QuestionFields({ question }: { question?: QuizQuestion }) {
  return (
    <>
      <Field label="Question">
        <textarea name="prompt" required rows={2} defaultValue={question?.prompt} className={inputClass} />
      </Field>
      <fieldset>
        <legend className="text-sm font-medium">Options</legend>
        <p className="text-xs text-muted">2 to 6. Tick every correct one; more than one makes it multi-select.</p>
        <div className="mt-2 space-y-2">
          {Array.from({ length: OPTION_SLOTS }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <input
                type="checkbox"
                name="correct"
                value={i}
                defaultChecked={question?.correct.includes(i)}
                aria-label={`Option ${i + 1} is correct`}
                className="size-4 shrink-0 accent-pine"
              />
              <input
                name="option"
                defaultValue={question?.options[i] ?? ""}
                placeholder={`Option ${i + 1}${i < 2 ? "" : " (optional)"}`}
                aria-label={`Option ${i + 1}`}
                className={`${inputClass} py-2`}
              />
            </div>
          ))}
        </div>
      </fieldset>
      <Field label="Explanation (optional)" hint="Shown to the learner after they answer.">
        <textarea name="explanation" rows={2} defaultValue={question?.explanation ?? ""} className={inputClass} />
      </Field>
    </>
  );
}

export default async function LessonEditorPage({ params }: PageProps<"/admin/courses/[id]/lessons/[lessonId]">) {
  await requireAdmin();
  const { id, lessonId } = await params;
  if (!isUuid(id) || !isUuid(lessonId)) notFound();
  const [row] = await db
    .select({ lesson: lessons, course: courses })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(and(eq(lessons.id, lessonId), eq(lessons.courseId, id)));
  if (!row) notFound();
  const { lesson, course } = row;

  const [questions, [{ n: learners }]] = await Promise.all([
    lesson.kind === "quiz"
      ? db.select().from(quizQuestions).where(eq(quizQuestions.lessonId, lesson.id)).orderBy(asc(quizQuestions.position))
      : [],
    db.select({ n: count() }).from(lessonProgress).where(eq(lessonProgress.lessonId, lesson.id)),
  ]);
  const configured = videoConfigured();
  const ready = Boolean(lesson.videoUid) && lesson.durationSeconds > 0;

  return (
    <div className="space-y-8">
      <div>
        <Link href={`/admin/courses/${course.id}`} className="text-sm text-muted hover:text-ink">
          ← {course.title}
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">{lesson.title}</h1>
          <span className="rounded-md bg-paper-2 px-2 py-0.5 font-mono text-xs uppercase tracking-wider text-muted">{lesson.kind}</span>
        </div>
        <p className="mt-2 text-sm">
          <a href={`/learn/${course.slug}/${lesson.slug}`} target="_blank" className="text-pine hover:underline">
            Open the learner view ↗
          </a>
        </p>
      </div>

      <section className={cardClass}>
        <SectionTitle>Details</SectionTitle>
        <ActionForm action={updateLesson.bind(null, lesson.id)} submitLabel="Save lesson" className="mt-4 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Title">
              <input name="title" required defaultValue={lesson.title} className={inputClass} />
            </Field>
            <Field label="Slug" hint={`/learn/${course.slug}/${lesson.slug}. Unique within this course.`}>
              <input name="slug" required pattern="[a-z0-9-]+" defaultValue={lesson.slug} className={`${inputClass} font-mono text-sm`} />
            </Field>
          </div>
          <Field label="Summary">
            <textarea name="summary" rows={3} defaultValue={lesson.summary ?? ""} className={inputClass} />
          </Field>
          {lesson.kind === "quiz" && (
            <Field label="Pass mark (%)" hint="Learners need at least this score to complete the quiz.">
              <input name="passPercent" type="number" min="1" max="100" required defaultValue={lesson.passPercent} className={`${inputClass} max-w-32 tabular-nums`} />
            </Field>
          )}
          <CheckField
            name="isPreview"
            label="Free preview"
            hint="Anyone can open this lesson without enrolling."
            defaultChecked={lesson.isPreview}
          />
        </ActionForm>
      </section>

      {lesson.kind === "video" && (
        <section className={cardClass}>
          <SectionTitle>Video</SectionTitle>
          <p className="mt-1 text-sm text-muted">
            Live video:{" "}
            {!lesson.videoUid
              ? "none yet."
              : ready
                ? `ready · ${formatDuration(lesson.durationSeconds)}`
                : "uploading or processing."}
          </p>
          {configured ? (
            <div className="mt-4 space-y-5">
              {lesson.pendingVideoUid && (
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-saffron/15 p-4 text-sm">
                  <p>
                    <span className="font-medium">Replacement processing…</span>{" "}
                    {lesson.videoUid
                      ? "Learners keep the live video until it is ready, then it replaces it."
                      : "It becomes the live video once it is ready."}
                  </p>
                  <ActionForm
                    action={discardPendingVideo.bind(null, lesson.id)}
                    submitLabel="Discard replacement"
                    submitClass={secondaryButtonClass}
                  />
                </div>
              )}
              {ready && lesson.videoUid && (
                <div className="aspect-video overflow-hidden rounded-xl bg-ink">
                  <iframe
                    src={iframeUrl(signPlaybackToken(lesson.videoUid, 3600))}
                    title={`Preview: ${lesson.title}`}
                    allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    className="size-full border-0"
                  />
                </div>
              )}
              <VideoUploader
                lessonId={lesson.id}
                hasVideo={Boolean(lesson.videoUid)}
                pending={Boolean(lesson.pendingVideoUid)}
                ready={ready}
              />
            </div>
          ) : (
            <div className="mt-4 space-y-4">
              <p className="rounded-xl bg-saffron/15 p-4 text-sm">
                Video uploads aren&apos;t configured on this server (the video provider&apos;s environment variables are
                missing), so you can attach a video by hand for testing.
              </p>
              <ActionForm action={setManualVideo.bind(null, lesson.id)} submitLabel="Save video">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Field label="Video UID">
                    <input name="videoUid" required defaultValue={lesson.videoUid ?? ""} className={`${inputClass} font-mono text-sm`} />
                  </Field>
                  <Field label="Duration (seconds)" hint="0 means not ready yet.">
                    <input name="durationSeconds" type="number" min="0" step="1" required defaultValue={lesson.durationSeconds} className={`${inputClass} tabular-nums`} />
                  </Field>
                </div>
              </ActionForm>
            </div>
          )}
        </section>
      )}

      {lesson.kind === "quiz" && (
        <section className="space-y-4">
          <SectionTitle>Questions</SectionTitle>
          {questions.length === 0 && <p className="text-sm text-muted">No questions yet. A quiz needs at least one to publish.</p>}
          {questions.map((question, qi) => (
            <div key={question.id} className={cardClass}>
              <div className="mb-4 flex items-center justify-between gap-3">
                <span className="font-mono text-xs text-muted">
                  Question {qi + 1}
                  {question.correct.length > 1 && " · multi-select"}
                </span>
                <div className="flex gap-1">
                  <form action={moveQuestion.bind(null, lesson.id, question.id, -1)}>
                    <button disabled={qi === 0} className={miniButtonClass} aria-label="Move question up">
                      ↑
                    </button>
                  </form>
                  <form action={moveQuestion.bind(null, lesson.id, question.id, 1)}>
                    <button disabled={qi === questions.length - 1} className={miniButtonClass} aria-label="Move question down">
                      ↓
                    </button>
                  </form>
                  <form action={deleteQuestion.bind(null, lesson.id, question.id)}>
                    <ConfirmButton message="Delete this question?" className={`${miniButtonClass} text-red-800`}>
                      Delete
                    </ConfirmButton>
                  </form>
                </div>
              </div>
              <ActionForm action={saveQuestion.bind(null, lesson.id, question.id)} submitLabel="Save question" submitClass={secondaryButtonClass}>
                <QuestionFields question={question} />
              </ActionForm>
            </div>
          ))}
          <div className={`${cardClass} border-dashed`}>
            <p className="mb-4 font-medium">Add a question</p>
            <ActionForm action={saveQuestion.bind(null, lesson.id, null)} submitLabel="Add question" resetOnSuccess>
              <QuestionFields />
            </ActionForm>
          </div>
        </section>
      )}

      <section className="border-t border-line pt-6">
        <form action={deleteLesson.bind(null, lesson.id)}>
          <ConfirmButton
            message={
              `Delete lesson “${lesson.title}”${lesson.kind === "video" && configured ? " and its video" : ""}?` +
              (learners ? ` ${learners} learner${learners === 1 ? " has" : "s have"} progress on it, which will be lost.` : "")
            }
            className={dangerButtonClass}
          >
            Delete lesson
          </ConfirmButton>
        </form>
      </section>
    </div>
  );
}
