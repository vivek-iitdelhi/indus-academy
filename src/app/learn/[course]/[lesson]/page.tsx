import { asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { loadCourseState, type LessonItem } from "@/app/learn/data";
import { Quiz, type QuizQuestionView } from "@/components/learn/quiz";
import { CourseOutlineList, LockIcon, ProgressBar } from "@/components/learn/outline";
import { percentComplete } from "@/components/learn/playback";
import { ButtonLink, CheckIcon, Container } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { db } from "@/db";
import { quizQuestions } from "@/db/schema";
import { canViewLesson } from "@/lib/lms/access";
import { getLesson, isLessonUnlocked } from "@/lib/lms/courses";
import { requireUser } from "@/lib/session";
import { hlsManifestUrl, signPlaybackToken, videoConfigured } from "@/lib/video";

// Public test stream so the player and progress can be exercised without a video provider.
const DEV_SAMPLE_HLS = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8";

function playbackSource(videoUid: string | null) {
  if (videoConfigured()) return videoUid ? { src: hlsManifestUrl(signPlaybackToken(videoUid)), devSample: false } : null;
  return process.env.NODE_ENV !== "production" ? { src: DEV_SAMPLE_HLS, devSample: true } : null;
}

export default async function LessonPage({ params }: PageProps<"/learn/[course]/[lesson]">) {
  const { course: courseSlug, lesson: lessonSlug } = await params;
  const path = `/learn/${courseSlug}/${lessonSlug}`;
  const user = await requireUser(path);
  const found = await getLesson(courseSlug, lessonSlug);
  // 404, not 403: a learner without access learns nothing about the lesson.
  if (!found || !(await canViewLesson(user, found.lesson))) notFound();
  if (!user.name.trim()) redirect(`/learn/account?next=${encodeURIComponent(path)}`);

  const { course, lesson } = found;
  const state = await loadCourseState(user.id, course);
  const unlocked = isLessonUnlocked(state.outline, state.progress, lesson.id, course.sequential);
  const items = state.chapters.flatMap((c) => c.lessons);
  const index = items.findIndex((l) => l.id === lesson.id);
  const [prev, next] = [items[index - 1], items[index + 1]];
  const href = (l: LessonItem) => `/learn/${course.slug}/${l.slug}`;
  const nextHref = next ? href(next) : null;
  const progress = state.progress.find((p) => p.lessonId === lesson.id);
  const completed = Boolean(progress?.completedAt);
  const chapter = state.chapters.find((c) => c.lessons.some((l) => l.id === lesson.id));
  const percent = percentComplete(state.done, state.total);

  // Tokens and questions are fetched only past the access and unlock checks above.
  let content: React.ReactNode;
  if (!unlocked) {
    const resume = state.next && state.next.id !== lesson.id ? `/learn/${course.slug}/${state.next.slug}` : null;
    content = (
      <div className="grid aspect-video place-items-center rounded-2xl border border-line bg-paper-2 p-6 text-center">
        <div>
          <LockIcon className="mx-auto size-6 text-muted" />
          <p className="mt-3 font-medium">This lesson unlocks when you finish the ones before it.</p>
          {resume && (
            <ButtonLink href={resume} variant="dark" className="mt-5 h-11">
              Continue where you left off
            </ButtonLink>
          )}
        </div>
      </div>
    );
  } else if (lesson.kind === "video") {
    const source = playbackSource(lesson.videoUid);
    content = source ? (
      <div className="-mx-5 sm:mx-0">
        <VideoPlayer
          key={lesson.id}
          src={source.src}
          lessonId={lesson.id}
          title={lesson.title}
          durationSeconds={lesson.durationSeconds}
          furthestSeconds={progress?.furthestSeconds ?? 0}
          completed={completed}
          track={state.enrolled}
          nextHref={nextHref}
        />
        {source.devSample && (
          <p className="mt-2 px-5 font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted sm:px-0">
            Dev sample video
          </p>
        )}
      </div>
    ) : (
      <div className="grid aspect-video place-items-center rounded-2xl bg-ink p-6 text-center text-paper/80">
        <p>This video isn&apos;t available right now. Please check back soon.</p>
      </div>
    );
  } else {
    const rows = await db
      .select({ prompt: quizQuestions.prompt, options: quizQuestions.options, correct: quizQuestions.correct })
      .from(quizQuestions)
      .where(eq(quizQuestions.lessonId, lesson.id))
      .orderBy(asc(quizQuestions.position));
    const questions: QuizQuestionView[] = rows.map((q) => ({
      prompt: q.prompt,
      options: q.options,
      multi: q.correct.length > 1,
    }));
    content = (
      <Quiz
        key={lesson.id}
        lessonId={lesson.id}
        questions={questions}
        passPercent={lesson.passPercent}
        completed={completed}
        nextHref={nextHref}
      />
    );
  }

  const header = (
    <div className={lesson.kind === "video" ? "mt-6" : ""}>
      <p className="font-mono text-[0.7rem] uppercase tracking-[0.16em] text-muted">
        {chapter?.title} · Lesson {index + 1} of {items.length}
      </p>
      <h1 className="mt-2 text-2xl font-semibold leading-tight tracking-[-0.02em] text-balance sm:text-3xl">
        {lesson.title}
      </h1>
      {completed && (
        <p className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-pine">
          <CheckIcon className="size-4" /> Completed
        </p>
      )}
      {lesson.summary && <p className="mt-3 max-w-2xl leading-relaxed text-muted">{lesson.summary}</p>}
    </div>
  );

  const outline = <CourseOutlineList chapters={state.chapters} courseSlug={course.slug} currentLessonId={lesson.id} />;
  const progressLine = state.enrolled && (
    <div className="mb-5">
      <p className="text-sm text-muted">
        {state.done} of {state.total} lessons complete · {percent}%
      </p>
      <ProgressBar percent={percent} className="mt-2" />
    </div>
  );

  return (
    <Container className="py-6 sm:py-10">
      <title>{`${lesson.title} · ${course.title}`}</title>
      <Link href={`/learn/${course.slug}`} className="text-sm font-medium text-muted transition-colors hover:text-ink">
        ← {course.title}
      </Link>

      <div className="mt-4 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start lg:gap-10">
        <div className="min-w-0">
          {lesson.kind === "video" ? (
            <>
              {content}
              {header}
            </>
          ) : (
            <>
              {header}
              <div className="mt-6">{content}</div>
            </>
          )}

          {!state.enrolled && (
            <div className="mt-8 flex flex-col gap-4 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-[0.95rem]">This is a free preview. Buy the course to unlock every lesson.</p>
              <ButtonLink href={`/courses/${course.slug}`} className="h-11 shrink-0">
                Buy course
              </ButtonLink>
            </div>
          )}

          <nav aria-label="Lessons" className="mt-8 grid grid-cols-2 gap-3 border-t border-line pt-6">
            {prev ? (
              <Link href={href(prev)} className="rounded-2xl border border-line p-4 transition-colors hover:border-ink/30">
                <span className="text-xs text-muted">← Previous</span>
                <span className="mt-1 line-clamp-2 block text-sm font-medium">{prev.title}</span>
              </Link>
            ) : (
              <span />
            )}
            {next &&
              (next.unlocked ? (
                <Link
                  href={href(next)}
                  className="rounded-2xl border border-line p-4 text-right transition-colors hover:border-ink/30"
                >
                  <span className="text-xs text-muted">Next →</span>
                  <span className="mt-1 line-clamp-2 block text-sm font-medium">{next.title}</span>
                </Link>
              ) : (
                <span className="rounded-2xl border border-dashed border-line p-4 text-right text-ink/50">
                  <span className="inline-flex items-center gap-1 text-xs">
                    <LockIcon className="size-3" /> Next
                  </span>
                  <span className="mt-1 line-clamp-2 block text-sm font-medium">{next.title}</span>
                </span>
              ))}
          </nav>

          <details className="group mt-6 rounded-2xl border border-line bg-paper-2/60 lg:hidden">
            <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-4 font-medium">
              Course outline
              <span className="text-sm font-normal text-muted">
                {state.enrolled ? `${percent}% complete` : ""}
                <span className="ml-2 inline-block transition-transform group-open:rotate-180" aria-hidden="true">
                  ▾
                </span>
              </span>
            </summary>
            <div className="px-4 pb-5">
              {progressLine}
              {outline}
            </div>
          </details>
        </div>

        <aside aria-label="Course outline" className="sticky top-20 hidden max-h-[calc(100dvh-6rem)] overflow-y-auto pb-6 lg:block">
          {progressLine}
          {outline}
        </aside>
      </div>
    </Container>
  );
}
