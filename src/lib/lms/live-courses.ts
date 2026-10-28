import { asc, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { courses, liveSessions, type Course } from "../../db/schema.ts";

// Live courses (format "live") are taught in their scheduled live classes. The public site lists
// one, and sells it, only until its last class ends; enrolled learners keep it in /learn, with
// the recordings, after that.

export type LiveClass = { id: string; title: string; startsAt: Date; endsAt: Date };

/** SQL: the course is not a live course, or one of its classes has not ended yet. */
export const listedNow = sql`(${courses.format} <> 'live' or exists (select 1 from ${liveSessions} s where s.course_id = ${courses.id} and s.starts_at + s.duration_minutes * interval '1 minute' > now()))`;

/** The course's live classes in time order, with their end times. */
export async function liveClasses(courseId: string): Promise<LiveClass[]> {
  const rows = await db
    .select({ id: liveSessions.id, title: liveSessions.title, startsAt: liveSessions.startsAt, durationMinutes: liveSessions.durationMinutes })
    .from(liveSessions)
    .where(eq(liveSessions.courseId, courseId))
    .orderBy(asc(liveSessions.startsAt));
  return rows.map(({ durationMinutes, ...r }) => ({ ...r, endsAt: new Date(r.startsAt.getTime() + durationMinutes * 60_000) }));
}

/** Whether a live course still has a class to come (or running). Other courses: always. */
export const stillRunning = (course: Pick<Course, "format">, classes: LiveClass[], now = new Date()) =>
  course.format !== "live" || classes.some((c) => c.endsAt > now);

/** Published, and (for a live course) not over: what can be bought or enrolled in. */
export async function onSale(course: Course, now = new Date()): Promise<boolean> {
  if (course.status !== "published") return false;
  return course.format !== "live" || stillRunning(course, await liveClasses(course.id), now);
}
