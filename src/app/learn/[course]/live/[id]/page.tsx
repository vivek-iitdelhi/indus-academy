import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { LiveRoom } from "@/components/live-room";
import { Container } from "@/components/ui";
import { VideoPlayer } from "@/components/video-player";
import { db } from "@/db";
import { courses, liveSessions, type LiveSession } from "@/db/schema";
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
    <LiveRoom src={room} title={session.title} allow={ROOM_ALLOW} className="h-[78vh] min-h-[480px] w-full rounded-2xl border border-line bg-white" />
  );
}

/** Our protected copy of the recording, once the encoder has it ready. */
async function Recording({ session }: { session: LiveSession }) {
  const uid = session.recordingVideoUid!;
  const status = videoConfigured() ? await getVideoStatus(uid).catch(() => null) : null;
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
        furthestSeconds={0}
        completed={false}
        track={false}
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
      ) : status === "ended" && session.recordingVideoUid ? (
        <Suspense fallback={<p className={NOTE}>Loading the recording…</p>}>
          <Recording session={session} />
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
        <p className={NOTE}>{problem}</p>
      )}
    </Container>
  );
}
