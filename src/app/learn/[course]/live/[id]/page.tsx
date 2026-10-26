import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { Container } from "@/components/ui";
import { db } from "@/db";
import { courses, liveSessions } from "@/db/schema";
import { formatDateTime } from "@/lib/admin/ops";
import { isUuid } from "@/lib/distributors";
import { joinUrl, liveStatus, ROOM_ALLOW } from "@/lib/live";
import { recordOpen } from "@/lib/live-attendance";
import { hasAccess } from "@/lib/lms/access";
import { requireUser } from "@/lib/session";

/** One live class: the webinar.gg room in an iframe, with a join token minted for this visit. */
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
  let room: string | null = null;
  let problem: string | null = null;
  if (status === "upcoming") {
    problem = `This class starts ${formatDateTime(session.startsAt)} (India time). The room opens 15 minutes before.`;
  } else if (status === "ended") {
    problem = session.recordingUrl ? null : "This class has ended. Its recording will appear on the course page shortly.";
  } else {
    await recordOpen(session.id, user.id, null);
    try {
      room = (await joinUrl(session.webinarId, { userId: user.id, name: user.name })).url;
    } catch (e) {
      console.error("[live] joinUrl failed", e);
      problem = "We couldn't open the class room just now. Reload the page to try again.";
    }
  }

  return (
    <Container className="py-6 sm:py-10">
      <title>{`${session.title} · ${course.title}`}</title>
      <Link href={`/learn/${course.slug}`} className="text-sm text-muted hover:text-ink">
        ← {course.title}
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em] sm:text-3xl">{session.title}</h1>
      <p className="mt-1 text-sm text-muted">Live class · {formatDateTime(session.startsAt)} · {session.durationMinutes} minutes</p>
      {room ? (
        <iframe
          src={room}
          title={session.title}
          allow={ROOM_ALLOW}
          allowFullScreen
          className="mt-6 h-[78vh] min-h-[480px] w-full rounded-2xl border border-line bg-white"
        />
      ) : status === "ended" && session.recordingUrl ? (
        <p className="mt-6">
          <a href={session.recordingUrl} target="_blank" rel="noreferrer" className="font-medium text-pine underline underline-offset-4">
            Watch the recording
          </a>
        </p>
      ) : (
        <p className="mt-6 rounded-2xl border border-line bg-white p-6">{problem}</p>
      )}
    </Container>
  );
}
