import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { and, eq, gt } from "drizzle-orm";
import { AutoRefresh } from "@/components/auto-refresh";
import { LiveRoom } from "@/components/live-room";
import { Container } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { db } from "@/db";
import { courses, liveRecordingProgress, liveSessions, type LiveSession } from "@/db/schema";
import { formatDate, formatDateTime } from "@/lib/admin/ops";
import { isUuid } from "@/lib/distributors";
import { joinUrl, LiveBusy, liveStatus, ROOM_ALLOW } from "@/lib/live";
import { recordOpen } from "@/lib/live-attendance";
import { hasAccess } from "@/lib/lms/access";
import { requireUser } from "@/lib/session";
import { getVideoStatus, hlsManifestUrl, keyProof, signPlaybackToken, videoConfigured } from "@/lib/video";
import { JoinRetry } from "./join-retry";

const NOTE = "mt-6 rounded-2xl border border-line bg-white p-6";
const JOINING = "Getting you into the class…";

/**
 * The room, with a join link for this learner. Streams in behind JOINING: when many learners
 * join at once the link waits up to ~8 s in line, and past that JoinRetry keeps trying.
 */
async function Room({ session, user, leaveHref }: { session: LiveSession; user: { id: string; name: string }; leaveHref: string }) {
  let room: string;
  try {
    room = (await joinUrl(session.webinarId, { userId: user.id, name: user.name })).url;
  } catch (e) {
    if (e instanceof LiveBusy) return <JoinRetry className={NOTE}>{JOINING}</JoinRetry>;
    console.error("[live] joinUrl failed", e);
    return <p className={NOTE}>We couldn&apos;t open the class room just now. Reload the page to try again.</p>;
  }
  await recordOpen(session.id, user.id, null);
  return <LiveRoom src={room} title={session.title} allow={ROOM_ALLOW} leaveHref={leaveHref} sessionId={session.id} />;
}

/** Our protected copy of the recording, once the encoder has it ready. Watching it to 90% counts like attending. */
async function Recording({ session, userId }: { session: LiveSession; userId: string }) {
  const uid = session.recordingVideoUid!;
  const [status, [progress]] = await Promise.all([
    videoConfigured() ? getVideoStatus(uid).catch(() => null) : null,
    db
      .select()
      .from(liveRecordingProgress)
      .where(and(eq(liveRecordingProgress.sessionId, session.id), eq(liveRecordingProgress.userId, userId))),
  ]);
  if (!status?.ready) {
    return <p className={NOTE}>The recording is being prepared. It usually takes about an hour after the class; check back soon.</p>;
  }
  const token = signPlaybackToken(uid);
  return (
    <div className="mt-6 -mx-5 sm:mx-0">
      <VideoPlayer
        src={hlsManifestUrl(uid, token)}
        keyProof={keyProof(token)}
        lessonId={session.id}
        title={session.title}
        durationSeconds={status.durationSeconds}
        furthestSeconds={progress?.furthestSeconds ?? 0}
        completed={Boolean(progress?.completedAt)}
        track
        progressUrl="/api/learn/live-progress"
        nextHref={null}
      />
      {session.recordingUntil && (
        <p className="mt-3 px-5 text-sm text-muted sm:px-0">Available until {formatDate(session.recordingUntil)}.</p>
      )}
    </div>
  );
}

/** One live class: the webinar.gg room in an iframe, with this learner's join link; afterwards, its recording. */
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
  if (!row) notFound();
  // Not enrolled (a class link passed on, or another account): the join link enrols them in a
  // free course, or sends them to buy a paid one, then brings them back here.
  if (!(await hasAccess(user.id, row.course.id))) redirect(`/join/${id}`);
  if (!user.name.trim()) redirect(`/learn/account?next=${encodeURIComponent(path)}`);

  const { session, course } = row;
  const status = liveStatus(session);
  // Out of the room (left, or the class is over): back to the course, or after its last class
  // to My courses, where the course's certificate shows.
  const [later] = await db
    .select({ id: liveSessions.id })
    .from(liveSessions)
    .where(and(eq(liveSessions.courseId, course.id), gt(liveSessions.startsAt, session.startsAt)))
    .limit(1);
  const leaveHref = later ? `/learn/${course.slug}` : "/learn";
  // Over, with no recording to show (yet): nothing to do here.
  if (status === "ended" && !session.recordingVideoUid && !session.recordingUntil && !session.recordingUrl) redirect(leaveHref);

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
          <Room session={session} user={{ id: user.id, name: user.name }} leaveHref={leaveHref} />
        </Suspense>
      ) : status === "ended" && session.recordingVideoUid ? (
        <Suspense fallback={<p className={NOTE}>Loading the recording…</p>}>
          <Recording session={session} userId={user.id} />
        </Suspense>
      ) : status === "ended" && session.recordingUntil ? (
        <p className={NOTE}>This class&apos;s recording was available until {formatDate(session.recordingUntil)} and has been removed.</p>
      ) : status === "ended" && session.recordingUrl ? (
        <p className="mt-6">
          <a href={session.recordingUrl} target="_blank" rel="noreferrer" className="font-medium text-pine underline underline-offset-4">
            Watch the recording
          </a>
        </p>
      ) : (
        <>
          <p className={NOTE}>
            This class starts {formatDateTime(session.startsAt)} (India time). Keep this page open: it lets you in when the room opens, 15
            minutes before.
          </p>
          {/* Waiting for the room to open: check again every 30 s, so they're let in on time. */}
          <AutoRefresh />
        </>
      )}
    </Container>
  );
}
