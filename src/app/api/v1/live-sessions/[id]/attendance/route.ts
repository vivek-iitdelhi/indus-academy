import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, liveAttendance, liveSessions, partnerLearners } from "@/db/schema";
import { isUuid, licensedCourse } from "@/lib/distributors";
import { json, notFound, withDistributor } from "../../../_shared";

/**
 * Which of the client's learners opened the class, and (once it has ended) who got into the room.
 * Only reads what we have: webinar.gg's list is read in the background (live-attendance.ts).
 */
export const GET = withDistributor(async (distributor, _request, { params }: RouteContext<"/api/v1/live-sessions/[id]/attendance">) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const [row] = await db
    .select({ session: liveSessions, slug: courses.slug })
    .from(liveSessions)
    .innerJoin(courses, eq(liveSessions.courseId, courses.id))
    .where(eq(liveSessions.id, id));
  if (!row || !(await licensedCourse(distributor.id, row.slug))) return notFound();

  const rows = await db
    .select({ a: liveAttendance, externalId: partnerLearners.externalId })
    .from(liveAttendance)
    .innerJoin(partnerLearners, and(eq(partnerLearners.userId, liveAttendance.userId), eq(partnerLearners.distributorId, distributor.id)))
    .where(eq(liveAttendance.sessionId, id))
    .orderBy(asc(liveAttendance.firstOpenedAt));
  const syncedAt = row.session.attendanceSyncedAt;
  return json({
    status: syncedAt ? "final" : "pending",
    synced_at: syncedAt?.toISOString() ?? null,
    final: Boolean(syncedAt),
    attendance: rows.map(({ a, externalId }) => ({
      external_id: externalId,
      opens: a.opens,
      first_opened_at: a.firstOpenedAt?.toISOString() ?? null,
      last_opened_at: a.lastOpenedAt?.toISOString() ?? null,
      attended: a.attended,
    })),
  });
});
