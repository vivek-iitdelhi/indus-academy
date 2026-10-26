import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, liveSessions } from "@/db/schema";
import { formatDateTime } from "@/lib/admin/ops";
import { isUuid } from "@/lib/distributors";
import { hostConfigured, hostJoinUrl, ROOM_ALLOW } from "@/lib/live";
import { requireAdmin } from "@/lib/session";

/** The host studio for one live class, inside the admin area: start, present and end it here. */
export default async function HostLivePage({ params }: PageProps<"/admin/live/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [row] = await db
    .select({ session: liveSessions, course: courses })
    .from(liveSessions)
    .innerJoin(courses, eq(liveSessions.courseId, courses.id))
    .where(eq(liveSessions.id, id));
  if (!row) notFound();
  const { session, course } = row;

  let studio: string | null = null;
  let problem = "Hosting isn't set up: add WEBINAR_GG_HOST_EMAIL and WEBINAR_GG_HOST_NAME (the webinar.gg account's) to the app's environment.";
  if (hostConfigured()) {
    try {
      studio = (await hostJoinUrl(session.webinarId)).url;
    } catch (e) {
      console.error("[live] hostJoinUrl failed", e);
      problem = "The studio couldn't be opened just now. Reload the page to try again.";
    }
  }

  return (
    <div>
      <title>{`Host: ${session.title}`}</title>
      <Link href="/admin/live" className="text-sm text-muted hover:text-ink">
        ← Live classes
      </Link>
      <h1 className="mt-3 text-2xl font-semibold tracking-[-0.02em]">{session.title}</h1>
      <p className="mt-1 text-sm text-muted">
        {course.title} · {formatDateTime(session.startsAt)} · {session.durationMinutes} minutes · You are the host: start the class, share your screen and end it here.
      </p>
      {studio ? (
        <iframe src={studio} title={`Host ${session.title}`} allow={ROOM_ALLOW} allowFullScreen className="mt-6 h-[82vh] min-h-[560px] w-full rounded-2xl border border-line bg-white" />
      ) : (
        <p className="mt-6 rounded-2xl border border-line bg-white p-6 text-sm">{problem}</p>
      )}
    </div>
  );
}
