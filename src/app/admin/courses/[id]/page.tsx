import Link from "next/link";
import { notFound } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db } from "@/db";
import { courseFormats, courses, lessonProgress, lessons, quizQuestions, type CourseStatus } from "@/db/schema";
import { coursePublishProblems, formatDuration, isUuid, learnerRecordCounts } from "@/lib/admin/courses";
import { getCourseOutline, totalDurationSeconds } from "@/lib/lms/courses";
import { requireAdmin } from "@/lib/session";
import {
  addChapter,
  addLesson,
  deleteChapter,
  deleteCourse,
  deleteLesson,
  moveChapter,
  moveLesson,
  moveLessonToChapter,
  renameChapter,
  setCourseStatus,
  updateCourse,
} from "../actions";
import { ActionForm, ConfirmButton } from "../client";
import {
  buttonClass,
  cardClass,
  CheckField,
  dangerButtonClass,
  Field,
  formatLabels,
  inputBaseClass,
  inputClass,
  miniButtonClass,
  secondaryButtonClass,
  SectionTitle,
  StatusBadge,
} from "../form-ui";

const statusActions: Record<CourseStatus, { to: CourseStatus; label: string }[]> = {
  draft: [{ to: "published", label: "Publish" }],
  published: [
    { to: "archived", label: "Archive" },
    { to: "draft", label: "Back to draft" },
  ],
  archived: [
    { to: "published", label: "Publish again" },
    { to: "draft", label: "Back to draft" },
  ],
};

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

export default async function CourseEditorPage({ params }: PageProps<"/admin/courses/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [course] = await db.select().from(courses).where(eq(courses.id, id));
  if (!course) notFound();

  const [outline, problems, records, progressRows, questionRows] = await Promise.all([
    getCourseOutline(course.id),
    coursePublishProblems(course.id),
    learnerRecordCounts(course.id),
    db
      .select({ lessonId: lessonProgress.lessonId, n: count() })
      .from(lessonProgress)
      .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
      .where(eq(lessons.courseId, course.id))
      .groupBy(lessonProgress.lessonId),
    db
      .select({ lessonId: quizQuestions.lessonId, n: count() })
      .from(quizQuestions)
      .innerJoin(lessons, eq(quizQuestions.lessonId, lessons.id))
      .where(eq(lessons.courseId, course.id))
      .groupBy(quizQuestions.lessonId),
  ]);
  const learnersOn = new Map(progressRows.map((r) => [r.lessonId, r.n]));
  const questionsOn = new Map(questionRows.map((r) => [r.lessonId, r.n]));
  const hasRecords = records.enrollments + records.payments + records.certificates > 0;
  const lessonCount = outline.reduce((n, c) => n + c.lessons.length, 0);

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/courses" className="text-sm text-muted hover:text-ink">
          ← Courses
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">{course.title}</h1>
          <StatusBadge status={course.status} />
        </div>
        <p className="mt-2 text-sm text-muted">
          {plural(lessonCount, "lesson")} · {formatDuration(totalDurationSeconds(outline))} ·{" "}
          {plural(records.enrollments, "enrolment")}
          {course.status === "published" && (
            <>
              {" · "}
              <Link href={`/courses/${course.slug}`} className="text-pine hover:underline" target="_blank">
                View on site
              </Link>
            </>
          )}
        </p>
      </div>

      <section className={cardClass}>
        <SectionTitle>Status</SectionTitle>
        {course.status !== "published" &&
          (problems.length ? (
            <div className="mt-3 rounded-xl bg-saffron/15 p-4 text-sm">
              <p className="font-medium">Before this course can be published:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {problems.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-2 text-sm text-pine">Ready to publish.</p>
          ))}
        <div className="mt-4 flex flex-wrap gap-3">
          {statusActions[course.status].map(({ to, label }) => (
            <ActionForm
              key={to}
              action={setCourseStatus.bind(null, course.id, to)}
              submitLabel={label}
              submitClass={to === "published" ? buttonClass : secondaryButtonClass}
            />
          ))}
        </div>
        <div className="mt-6 border-t border-line pt-4">
          {hasRecords ? (
            <p className="text-sm text-muted">
              This course has {plural(records.enrollments, "enrolment")}, {plural(records.payments, "payment")} and{" "}
              {plural(records.certificates, "certificate")}, so it can&apos;t be deleted. Archive it to stop selling it;
              enrolled learners keep access.
            </p>
          ) : (
            <form action={deleteCourse.bind(null, course.id)}>
              <ConfirmButton
                message={`Delete “${course.title}” with all its chapters, lessons, quizzes and videos? This can't be undone.`}
                className={dangerButtonClass}
              >
                Delete course
              </ConfirmButton>
            </form>
          )}
        </div>
      </section>

      <section className={cardClass}>
        <SectionTitle>Details</SectionTitle>
        <ActionForm action={updateCourse.bind(null, course.id)} submitLabel="Save details" className="mt-4 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Title">
              <input name="title" required defaultValue={course.title} className={inputClass} />
            </Field>
            <Field
              label="Slug"
              hint={
                course.status === "draft"
                  ? `URL: /courses/${course.slug}`
                  : `Live at /courses/${course.slug}. Changing it breaks links people have already shared.`
              }
            >
              <input name="slug" required pattern="[a-z0-9-]+" defaultValue={course.slug} className={`${inputClass} font-mono text-sm`} />
            </Field>
          </div>
          <Field label="Subtitle">
            <input name="subtitle" defaultValue={course.subtitle ?? ""} className={inputClass} />
          </Field>
          <Field label="Description" hint="Markdown: blank line between paragraphs, - for bullets, **bold**.">
            <textarea name="description" rows={8} defaultValue={course.description ?? ""} className={`${inputClass} font-mono text-sm`} />
          </Field>
          <fieldset>
            <legend className="text-sm font-medium">Format</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {courseFormats.map((format) => (
                <label key={format} className="flex gap-3 rounded-xl border border-line p-3 has-checked:border-pine has-checked:bg-mint/30">
                  <input type="radio" name="format" value={format} defaultChecked={course.format === format} className="mt-1 accent-pine" />
                  <span>
                    <span className="text-sm font-medium capitalize">{format}</span>
                    <span className="block text-sm text-muted">{formatLabels[format]}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Price (₹)" hint="GST-inclusive: what the learner pays. 0 makes the course free.">
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                required
                defaultValue={course.pricePaise / 100}
                className={`${inputClass} tabular-nums`}
              />
            </Field>
            <Field label="Cover image URL">
              <input name="coverImageUrl" type="url" defaultValue={course.coverImageUrl ?? ""} placeholder="https://…" className={inputClass} />
            </Field>
          </div>
          <div className="space-y-3">
            <CheckField
              name="sequential"
              label="Sequential"
              hint="Each lesson unlocks only after the previous one is complete. Recommended for interactive courses."
              defaultChecked={course.sequential}
            />
            <CheckField
              name="certificateEnabled"
              label="Certificate"
              hint="Issue a certificate when a learner completes every lesson."
              defaultChecked={course.certificateEnabled}
            />
          </div>
        </ActionForm>
      </section>

      <section className="space-y-4">
        <SectionTitle>Outline</SectionTitle>
        {outline.length === 0 && <p className="text-sm text-muted">No chapters yet. Add one to start building the course.</p>}
        {outline.map((chapter, ci) => (
          <div key={chapter.id} className={cardClass}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted">Chapter {ci + 1}</span>
              <ActionForm
                action={renameChapter.bind(null, chapter.id)}
                submitLabel="Rename"
                submitClass={miniButtonClass}
                className="flex min-w-60 flex-1 flex-wrap items-center gap-2"
              >
                <input
                  name="title"
                  required
                  aria-label="Chapter title"
                  defaultValue={chapter.title}
                  className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 font-semibold hover:border-line focus:border-pine focus:outline-none"
                />
              </ActionForm>
              <div className="flex gap-1">
                <form action={moveChapter.bind(null, chapter.id, -1)}>
                  <button disabled={ci === 0} className={miniButtonClass} aria-label="Move chapter up">
                    ↑
                  </button>
                </form>
                <form action={moveChapter.bind(null, chapter.id, 1)}>
                  <button disabled={ci === outline.length - 1} className={miniButtonClass} aria-label="Move chapter down">
                    ↓
                  </button>
                </form>
                <form action={deleteChapter.bind(null, chapter.id)}>
                  <ConfirmButton
                    message={`Delete chapter “${chapter.title}” and its ${plural(chapter.lessons.length, "lesson")} (with their videos, quizzes and learner progress)?`}
                    className={`${miniButtonClass} text-red-800`}
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </div>

            <ol className="mt-4 divide-y divide-line border-y border-line">
              {chapter.lessons.map((lesson, li) => {
                const learners = learnersOn.get(lesson.id) ?? 0;
                const meta =
                  lesson.kind === "quiz"
                    ? plural(questionsOn.get(lesson.id) ?? 0, "question")
                    : !lesson.videoUid
                      ? "no video"
                      : lesson.durationSeconds > 0
                        ? formatDuration(lesson.durationSeconds)
                        : "processing";
                return (
                  <li key={lesson.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
                    <span className="w-6 text-right font-mono text-xs text-muted">{lesson.position}</span>
                    <span className="rounded-md bg-paper-2 px-1.5 py-0.5 font-mono text-[0.65rem] uppercase tracking-wider text-muted">
                      {lesson.kind}
                    </span>
                    <span className="min-w-0 flex-1">
                      <Link href={`/admin/courses/${course.id}/lessons/${lesson.id}`} className="font-medium hover:text-pine hover:underline">
                        {lesson.title}
                      </Link>
                      <span className="ml-2 text-xs text-muted">
                        {meta}
                        {lesson.pendingVideoUid && " · replacement processing"}
                        {lesson.isPreview && " · free preview"}
                      </span>
                    </span>
                    <div className="flex flex-wrap items-center gap-1">
                      <form action={moveLesson.bind(null, lesson.id, -1)}>
                        <button disabled={li === 0} className={miniButtonClass} aria-label="Move lesson up">
                          ↑
                        </button>
                      </form>
                      <form action={moveLesson.bind(null, lesson.id, 1)}>
                        <button disabled={li === chapter.lessons.length - 1} className={miniButtonClass} aria-label="Move lesson down">
                          ↓
                        </button>
                      </form>
                      {outline.length > 1 && (
                        <form action={moveLessonToChapter.bind(null, lesson.id)} className="flex gap-1">
                          <select name="chapterId" aria-label="Move to chapter" defaultValue="" required className="h-8 max-w-36 rounded-lg border border-line bg-white px-1 text-sm">
                            <option value="" disabled>
                              Move to…
                            </option>
                            {outline
                              .filter((c) => c.id !== chapter.id)
                              .map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.title}
                                </option>
                              ))}
                          </select>
                          <button className={miniButtonClass}>Move</button>
                        </form>
                      )}
                      <a href={`/learn/${course.slug}/${lesson.slug}`} target="_blank" className={miniButtonClass}>
                        Learner view
                      </a>
                      <form action={deleteLesson.bind(null, lesson.id)}>
                        <ConfirmButton
                          message={
                            `Delete lesson “${lesson.title}”?` +
                            (learners ? ` ${plural(learners, "learner")} ha${learners === 1 ? "s" : "ve"} progress on it, which will be lost.` : "")
                          }
                          className={`${miniButtonClass} text-red-800`}
                        >
                          Delete
                        </ConfirmButton>
                      </form>
                    </div>
                  </li>
                );
              })}
            </ol>

            <form action={addLesson.bind(null, chapter.id)} className="mt-4 flex flex-wrap gap-2">
              <input name="title" required placeholder="New lesson title" aria-label="New lesson title" className={`${inputClass} min-w-48 flex-1`} />
              <select name="kind" aria-label="Lesson kind" defaultValue="video" className={inputBaseClass}>
                <option value="video">Video</option>
                <option value="quiz">Quiz</option>
              </select>
              <button className={secondaryButtonClass}>Add lesson</button>
            </form>
          </div>
        ))}

        <form action={addChapter.bind(null, course.id)} className="flex flex-wrap gap-2">
          <input name="title" required placeholder="New chapter title" aria-label="New chapter title" className={`${inputClass} min-w-48 flex-1`} />
          <button className={buttonClass}>Add chapter</button>
        </form>
      </section>
    </div>
  );
}
