import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessons } from "@/db/schema";
import { isUuid } from "@/lib/admin/courses";
import { revalidateCourse } from "@/lib/catalog-cache";
import { requireAdminApi } from "@/lib/session";
import { deleteVideo, getVideoStatus, videoConfigured } from "@/lib/video";

/**
 * Processing status of a lesson's video, polled by the lesson editor after an upload.
 * Polls the pending replacement when there is one, else the live video. A pending video
 * that is ready replaces the live one; a ready live video gets its duration copied
 * (progress and publishing both need duration_seconds > 0).
 */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/lessons/[lessonId]/video">) {
  await requireAdminApi();
  const { lessonId } = await ctx.params;
  if (!videoConfigured()) return Response.json({ error: "Video is not configured on this server." }, { status: 503 });
  if (!isUuid(lessonId)) return Response.json({ error: "No such lesson." }, { status: 404 });

  const [row] = await db
    .select({ lesson: lessons, courseSlug: courses.slug })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(eq(lessons.id, lessonId));
  const uid = row?.lesson.pendingVideoUid ?? row?.lesson.videoUid;
  if (!row || !uid) return Response.json({ error: "This lesson has no video." }, { status: 404 });
  const { lesson } = row;

  const status = await getVideoStatus(uid).catch((e) => {
    console.error("getVideoStatus failed", e);
    return null;
  });
  if (!status) return Response.json({ error: "Could not reach the video provider." }, { status: 502 });
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
      revalidateCourse(row.courseSlug);
    }
  } else if (ready && status.durationSeconds !== lesson.durationSeconds) {
    await db
      .update(lessons)
      .set({ durationSeconds: status.durationSeconds })
      .where(and(eq(lessons.id, lesson.id), eq(lessons.videoUid, uid)));
    revalidateCourse(row.courseSlug);
  }
  return Response.json({ state: status.state, ready, durationSeconds: status.durationSeconds });
}
