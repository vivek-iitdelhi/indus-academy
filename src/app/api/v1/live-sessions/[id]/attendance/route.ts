import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, liveAttendance, liveSessions, partnerLearners } from "@/db/schema";
import { isUuid, licensedCourse } from "@/lib/distributors";
import { ensureAttendance } from "@/lib/live-attendance";
import { json, notFound, withDistributor } from "../../../_shared";

/** Which of the client's learners opened the class, and (once it has ended) who got into the room. */
export const GET = withDistributor(async (distributor, _request, { params }: RouteContext<"/api/v1/live-sessions/[id]/attendance">) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const [row] = await db
    .select({ session: liveSessions, slug: courses.slug })
    .from(liveSessions)
    .innerJoin(courses, eq(liveSessions.courseId, courses.id))
    .where(eq(liveSessions.id, id));
  if (!row || !(await licensedCourse(distributor.id, row.slug))) return notFound();

  await ensureAttendance(row.session);
  const [session] = await db.select().from(liveSessions).where(eq(liveSessions.id, id));
  const rows = await db
    .select({ a: liveAttendance, externalId: partnerLearners.externalId })
    .from(liveAttendance)
    .innerJoin(partnerLearners, and(eq(partnerLearners.userId, liveAttendance.userId), eq(partnerLearners.distributorId, distributor.id)))
    .where(eq(liveAttendance.sessionId, id))
    .orderBy(asc(liveAttendance.firstOpenedAt));
  return json({
    final: Boolean(session.attendanceSyncedAt),
    attendance: rows.map(({ a, externalId }) => ({
      external_id: externalId,
      opens: a.opens,
      first_opened_at: a.firstOpenedAt?.toISOString() ?? null,
      last_opened_at: a.lastOpenedAt?.toISOString() ?? null,
      attended: a.attended,
    })),
  });
});
