import { and, eq, isNotNull, isNull, lt } from "drizzle-orm";
import { db } from "../db/index.ts";
import { courses, liveSessions } from "../db/schema.ts";
import { deleteVideo, importVideo, videoConfigured } from "./video.ts";

// Live class recordings: webinar.gg's copy (live_sessions.recording_url) is imported into our
// storage and encoded like any lesson video, so learners watch it in the protected player. Our
// copy is deleted course.recording_days after it arrives (the /api/cron/live sweep).

const DAY_MS = 86_400_000;

/**
 * Starts our copy of a session's recording, once (a repeat webhook does nothing). It stays
 * available for the course's recording_days from now.
 */
export async function importRecording(sessionId: string, url: string, now = new Date()): Promise<void> {
  if (!videoConfigured() || !url.startsWith("https://")) return;
  const [row] = await db
    .select({ uid: liveSessions.recordingVideoUid, until: liveSessions.recordingUntil, days: courses.recordingDays })
    .from(liveSessions)
    .innerJoin(courses, eq(courses.id, liveSessions.courseId))
    .where(eq(liveSessions.id, sessionId));
  if (!row || row.uid || row.until) return; // imported already (or imported and since deleted)
  const uid = await importVideo(url);
  const claimed = await db
    .update(liveSessions)
    .set({ recordingVideoUid: uid, recordingUntil: new Date(now.getTime() + row.days * DAY_MS) })
    .where(and(eq(liveSessions.id, sessionId), isNull(liveSessions.recordingVideoUid), isNull(liveSessions.recordingUntil)))
    .returning({ id: liveSessions.id });
  // A concurrent delivery got there first: drop our duplicate.
  if (!claimed.length) await deleteVideo(uid);
}

/** Deletes the recording now (admin), or when its time is up (sweep). Keeps recording_until as the record. */
export async function deleteRecording(sessionId: string, now = new Date()): Promise<boolean> {
  const [row] = await db
    .select({ uid: liveSessions.recordingVideoUid })
    .from(liveSessions)
    .where(and(eq(liveSessions.id, sessionId), isNotNull(liveSessions.recordingVideoUid)));
  if (!row) return false;
  await deleteVideo(row.uid!);
  await db.update(liveSessions).set({ recordingVideoUid: null, recordingUntil: now }).where(eq(liveSessions.id, sessionId));
  return true;
}

/** Deletes every recording past its recording_until. Returns how many. */
export async function deleteExpiredRecordings(now = new Date()): Promise<number> {
  const due = await db
    .select({ id: liveSessions.id, uid: liveSessions.recordingVideoUid })
    .from(liveSessions)
    .where(and(isNotNull(liveSessions.recordingVideoUid), lt(liveSessions.recordingUntil, now)));
  for (const { id, uid } of due) {
    await deleteVideo(uid!);
    await db.update(liveSessions).set({ recordingVideoUid: null }).where(eq(liveSessions.id, id));
  }
  return due.length;
}
