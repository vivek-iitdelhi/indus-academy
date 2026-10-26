import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { loadCourseState } from "@/app/learn/data";
import { CourseOutlineList, formatLabel, ProgressBar } from "@/components/learn/outline";
import { formatDuration, percentComplete } from "@/components/learn/playback";
import { Accent, ButtonLink, Container, Eyebrow } from "@/components/ui";
import { db } from "@/db";
import { liveSessions, type LiveSession } from "@/db/schema";
import { formatDateTime } from "@/lib/admin/ops";
import { liveStatus } from "@/lib/live";
import { getCourseBySlug, totalDurationSeconds } from "@/lib/lms/courses";
import { requireUser } from "@/lib/session";

export default async function CoursePage({ params }: PageProps<"/learn/[course]">) {
  const { course: slug } = await params;
  const user = await requireUser(`/learn/${slug}`);
  const course = await getCourseBySlug(slug);
  if (!course) notFound();
  const state = await loadCourseState(user.id, course);
  const sessions = state.enrolled
    ? await db.select().from(liveSessions).where(eq(liveSessions.courseId, course.id)).orderBy(asc(liveSessions.startsAt))
    : [];
  // Without access the outline is shown only to try the free previews.
  if (!state.enrolled && !state.hasPreviews) notFound();

  const percent = percentComplete(state.done, state.total);
  const firstPreview = state.chapters.flatMap((c) => c.lessons).find((l) => l.isPreview);
  const resume = state.next ?? (state.enrolled ? state.chapters[0]?.lessons[0] : firstPreview);
  const hours = formatDuration(totalDurationSeconds(state.outline));

  return (
    <Container className="max-w-4xl! py-10 sm:py-16">
      <title>{course.title}</title>
      <Eyebrow>{formatLabel[course.format]}</Eyebrow>
      <h1 className="mt-5 text-3xl font-semibold leading-tight tracking-[-0.03em] text-balance sm:text-5xl">
        {course.title}
      </h1>
      {course.subtitle && <p className="mt-3 text-lg text-muted">{course.subtitle}</p>}
      <p className="mt-3 text-sm text-muted">
        {state.total} lessons{hours && ` · ${hours}`}
        {course.sequential && " · Lessons unlock in order"}
      </p>

      {state.enrolled ? (
        <div className="mt-8 rounded-3xl border border-line bg-white p-5 sm:p-6">
          <div className="flex items-baseline justify-between gap-4">
            <p className="font-medium">
              {state.done} of {state.total} lessons complete
            </p>
            <p className="text-2xl font-semibold tracking-[-0.02em]">{percent}%</p>
          </div>
          <ProgressBar percent={percent} className="mt-3" />
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            {resume && (
              <ButtonLink href={`/learn/${course.slug}/${resume.slug}`} variant="dark" className="h-11">
                {state.next ? (state.done ? "Resume" : "Start course") : "Review from the start"}
              </ButtonLink>
            )}
            <CertificateStatus enabled={course.certificateEnabled} certificate={state.certificate} />
          </div>
        </div>
      ) : (
        <div className="mt-8 flex flex-col gap-4 rounded-3xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p>
            Watch the free preview, then <Accent>buy the course</Accent> to unlock every lesson.
          </p>
          <ButtonLink href={`/courses/${course.slug}`} className="h-11 shrink-0">
            Buy course
          </ButtonLink>
        </div>
      )}

      {sessions.length > 0 && <LiveClasses courseSlug={course.slug} sessions={sessions} />}

      <h2 className="mt-12 text-xl font-semibold tracking-[-0.01em]">Course outline</h2>
      <div className="mt-5">
        <CourseOutlineList chapters={state.chapters} courseSlug={course.slug} />
      </div>
    </Container>
  );
}

function CertificateStatus({
  enabled,
  certificate,
}: {
  enabled: boolean;
  certificate: { serial: string; revokedAt: Date | null } | null;
}) {
  if (certificate && !certificate.revokedAt) {
    return (
      <Link href="/learn/certificates" className="text-sm font-medium text-pine underline underline-offset-4">
        Certificate earned · view it
      </Link>
    );
  }
  if (certificate) return <p className="text-sm text-muted">Certificate revoked</p>;
  if (!enabled) return null;
  return <p className="text-sm text-muted">Finish every lesson to earn your certificate.</p>;
}

function LiveClasses({ courseSlug, sessions }: { courseSlug: string; sessions: LiveSession[] }) {
  return (
    <>
      <h2 className="mt-12 text-xl font-semibold tracking-[-0.01em]">Live classes</h2>
      <ul className="mt-5 divide-y divide-line rounded-3xl border border-line bg-white">
        {sessions.map((s) => {
          const status = liveStatus(s);
          return (
            <li key={s.id} className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-medium">{s.title}</p>
                <p className="text-sm text-muted">
                  {formatDateTime(s.startsAt)} · {s.durationMinutes} minutes
                </p>
              </div>
              {status === "open" ? (
                <ButtonLink href={`/learn/${courseSlug}/live/${s.id}`} variant="dark" className="h-10 shrink-0">
                  Join live
                </ButtonLink>
              ) : status === "upcoming" ? (
                <p className="text-sm text-muted">Opens 15 minutes before the start</p>
              ) : s.recordingUrl ? (
                <a href={s.recordingUrl} target="_blank" rel="noreferrer" className="text-sm font-medium text-pine underline underline-offset-4">
                  Watch recording
                </a>
              ) : (
                <p className="text-sm text-muted">Recording on its way</p>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
