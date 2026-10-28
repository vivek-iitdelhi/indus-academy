import Link from "next/link";
import { LiveRoom } from "@/components/live-room";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, distributors, liveAttendance, liveSessions, partnerLearners, user } from "@/db/schema";
import { formatDateTime } from "@/lib/admin/ops";
import { isUuid } from "@/lib/distributors";
import { hostConfigured, hostJoinUrl, liveStatus, ROOM_ALLOW } from "@/lib/live";
import { ensureAttendance } from "@/lib/live-attendance";
import { requireAdmin } from "@/lib/session";
import { cardClass, SectionTitle } from "../../courses/form-ui";

/** One live class in the admin area: the host studio while it runs, and who came. */
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
  const ended = liveStatus(session) === "ended";
  if (ended) await ensureAttendance(session);
  const attendance = await db
    .select({ a: liveAttendance, name: user.name, email: user.email, partner: distributors.name, externalId: partnerLearners.externalId })
    .from(liveAttendance)
    .innerJoin(user, eq(liveAttendance.userId, user.id))
    .leftJoin(distributors, eq(liveAttendance.distributorId, distributors.id))
    .leftJoin(partnerLearners, eq(liveAttendance.userId, partnerLearners.userId))
    .where(eq(liveAttendance.sessionId, session.id))
    .orderBy(asc(liveAttendance.firstOpenedAt));
  const attendedCount = attendance.filter((r) => r.a.attended).length;

  let studio: string | null = null;
  let problem = "Hosting isn't set up: add WEBINAR_GG_HOST_EMAIL and WEBINAR_GG_HOST_NAME (the webinar.gg account's) to the app's environment.";
  if (ended) {
    problem = "This class has ended.";
  } else if (hostConfigured()) {
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
        {course.title} · {formatDateTime(session.startsAt)} · {session.durationMinutes} minutes · {ended ? "Ended." : "You are the host: start the class, share your screen and end it here."}
      </p>
      {studio ? (
        <LiveRoom src={studio} title={`Host ${session.title}`} allow={ROOM_ALLOW} leaveHref="/admin/live" sessionId={session.id} />
      ) : (
        <p className="mt-6 rounded-2xl border border-line bg-white p-6 text-sm">{problem}</p>
      )}

      <section className={`${cardClass} mt-6`}>
        <SectionTitle>Attendance</SectionTitle>
        <p className="mt-1 text-sm text-muted">
          {attendance.length} opened the class{session.attendanceSyncedAt ? ` · ${attendedCount} got into the room` : ""}.{" "}
          {session.attendanceSyncedAt
            ? "Opened but not in the room means they tried and something stopped them."
            : "Who got into the room shows here once the class ends."}
        </p>
        {attendance.length > 0 && (
          <table className="mt-4 w-full text-left text-sm">
            <thead className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">
              <tr>
                <th className="py-2">Learner</th>
                <th>Via</th>
                <th>First opened</th>
                <th className="text-right">Opens</th>
                <th className="text-right">In the room</th>
              </tr>
            </thead>
            <tbody>
              {attendance.map(({ a, name, email, partner, externalId }) => (
                <tr key={a.userId} className="border-t border-line">
                  <td className="py-2">
                    <span className="font-medium">{name}</span>
                    <span className="block text-xs text-muted">{externalId ? `Partner id ${externalId}` : email}</span>
                  </td>
                  <td>{partner ?? "Our site"}</td>
                  <td>{a.firstOpenedAt ? formatDateTime(a.firstOpenedAt) : "—"}</td>
                  <td className="text-right tabular-nums">{a.opens}</td>
                  <td className="text-right">{a.attended === null ? "—" : a.attended ? "Yes" : <span className="text-red-800">No</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
