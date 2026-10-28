import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { Container } from "@/components/ui";
import { db } from "@/db";
import { courses, liveSessions, type LiveSession } from "@/db/schema";
import { formatDateTime } from "@/lib/admin/ops";
import { isUuid } from "@/lib/distributors";
import { joinUrl, LiveBusy, liveStatus, ROOM_ALLOW } from "@/lib/live";
import { recordOpen } from "@/lib/live-attendance";
import { hasAccess } from "@/lib/lms/access";
import { requireUser } from "@/lib/session";
import { JoinRetry } from "./join-retry";

const NOTE = "mt-6 rounded-2xl border border-line bg-white p-6";
const JOINING = "Getting you into the class…";

/**
 * The room, with a join link for this learner. Streams in behind JOINING: when many learners
 * join at once the link waits up to ~8 s in line, and past that JoinRetry keeps trying.
 */
async function Room({ session, user }: { session: LiveSession; user: { id: string; name: string } }) {
  let room: string;
  try {
    room = (await joinUrl(session.webinarId, { userId: user.id, name: user.name })).url;
  } catch (e) {
    if (e instanceof LiveBusy) return <JoinRetry className={NOTE}>{JOINING}</JoinRetry>;
    console.error("[live] joinUrl failed", e);
    return <p className={NOTE}>We couldn&apos;t open the class room just now. Reload the page to try again.</p>;
  }
  await recordOpen(session.id, user.id, null);
  return (
    <iframe
      src={room}
      title={session.title}
      allow={ROOM_ALLOW}
      allowFullScreen
      className="mt-6 h-[78vh] min-h-[480px] w-full rounded-2xl border border-line bg-white"
    />
  );
}

/** One live class: the webinar.gg room in an iframe, with this learner's join link. */
export default async function LiveClassPage({ params }: PageProps<"/learn/[course]/live/[id]">) {
  const { course: slug, id } = await params;
  const path = `/learn/${slug}/live/${id}`;
  const user = await requireUser(path);
  if (!isUuid(id)) notFound();
  const [row] = await db
    .select({ session: liveSessions, course: courses })
    .from(liveSessions)
    .innerJoin(courses, eq(liveSessions.courseId, courses.id))
    .where(and(eq(liveSessions.id, id), eq(courses.slug, slug)));
  // 404, not 403, like lessons: no access means nothing to see.
  if (!row || !(await hasAccess(user.id, row.course.id))) notFound();
  if (!user.name.trim()) redirect(`/learn/account?next=${encodeURIComponent(path)}`);

  const { session, course } = row;
  const status = liveStatus(session);
  const problem =
    status === "upcoming"
      ? `This class starts ${formatDateTime(session.startsAt)} (India time). The room opens 15 minutes before.`
      : "This class has ended. Its recording will appear on the course page shortly.";

  return (
    <Container className="py-6 sm:py-10">
      <title>{`${session.title} · ${course.title}`}</title>
      <Link href={`/learn/${course.slug}`} className="text-sm text-muted hover:text-ink">
        ← {course.title}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{session.title}</h1>
      <p className="mt-1 text-sm text-muted">Live class · {formatDateTime(session.startsAt)} · {session.durationMinutes} minutes</p>
      {status === "open" ? (
        <Suspense fallback={<p role="status" className={NOTE}>{JOINING}</p>}>
          <Room session={session} user={{ id: user.id, name: user.name }} />
        </Suspense>
      ) : status === "ended" && session.recordingUrl ? (
        <p className="mt-6">
          <a href={session.recordingUrl} target="_blank" rel="noreferrer" className="font-medium text-pine underline underline-offset-4">
            Watch the recording
          </a>
        </p>
      ) : (
        <p className={NOTE}>{problem}</p>
      )}
    </Container>
  );
}
