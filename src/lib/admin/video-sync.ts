import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons, type Lesson } from "@/db/schema";
import { revalidateCourse } from "@/lib/catalog-cache";
import { deleteVideo, getVideoStatus, type VideoStatus } from "@/lib/video";

/**
 * Brings one lesson's video up to date with storage. Checks the pending replacement when
 * there is one, else the live video. A pending video that is ready replaces the live one
 * (the old one is queued for deletion); a ready live video gets its duration copied
 * (progress and publishing both need duration_seconds > 0). Null if there is no video.
 */
export async function syncLessonVideo(lesson: Lesson, courseSlug: string): Promise<VideoStatus | null> {
  const uid = lesson.pendingVideoUid ?? lesson.videoUid;
  if (!uid) return null;
  const status = await getVideoStatus(uid);
  const ready = status.ready && status.durationSeconds > 0;

  if (ready && uid === lesson.pendingVideoUid) {
    // Conditional on the pending uid: a newer upload may have replaced it since we read the row.
    const promoted = await db
      .update(lessons)
      .set({ videoUid: uid, durationSeconds: status.durationSeconds, pendingVideoUid: null })
      .where(and(eq(lessons.id, lesson.id), eq(lessons.pendingVideoUid, uid)))
      .returning({ id: lessons.id });
    if (promoted.length) {
      const old = lesson.videoUid;
      if (old && old !== uid) await deleteVideo(old).catch((e) => console.error(`deleteVideo ${old} failed`, e));
      revalidateCourse(courseSlug);
    }
  } else if (ready && status.durationSeconds !== lesson.durationSeconds) {
    await db
      .update(lessons)
      .set({ durationSeconds: status.durationSeconds })
      .where(and(eq(lessons.id, lesson.id), eq(lessons.videoUid, uid)));
    revalidateCourse(courseSlug);
  }
  return { ...status, ready };
}
