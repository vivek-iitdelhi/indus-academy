import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { liveSessions, type LiveSession } from "@/db/schema";
import { licensedCourse } from "@/lib/distributors";
import { liveStatus } from "@/lib/live";
import { json, notFound, withDistributor } from "../../../_shared";

const liveSessionJson = (s: LiveSession) => ({
  id: s.id,
  title: s.title,
  starts_at: s.startsAt.toISOString(),
  duration_minutes: s.durationMinutes,
  status: liveStatus(s),
  recording_url: s.recordingUrl,
});

/** The course's live classes, oldest first. */
export const GET = withDistributor(async (distributor, _request, { params }: RouteContext<"/api/v1/courses/[slug]/live-sessions">) => {
  const course = await licensedCourse(distributor.id, (await params).slug);
  if (!course) return notFound();
  const rows = await db.select().from(liveSessions).where(eq(liveSessions.courseId, course.id)).orderBy(asc(liveSessions.startsAt));
  return json({ live_sessions: rows.map(liveSessionJson) });
});
