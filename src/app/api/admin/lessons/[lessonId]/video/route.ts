import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessons } from "@/db/schema";
import { isUuid } from "@/lib/admin/courses";
import { revalidateCourse } from "@/lib/catalog-cache";
import { requireAdminApi } from "@/lib/session";
import { getVideoStatus, videoConfigured } from "@/lib/video";

/**
 * Processing status of a lesson's video, polled by the lesson editor after an upload.
 * Once the provider reports it ready, copies its duration onto the lesson (progress and
 * publishing both need duration_seconds > 0).
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
  if (!row?.lesson.videoUid) return Response.json({ error: "This lesson has no video." }, { status: 404 });

  const status = await getVideoStatus(row.lesson.videoUid).catch((e) => {
    console.error("getVideoStatus failed", e);
    return null;
  });
  if (!status) return Response.json({ error: "Could not reach the video provider." }, { status: 502 });
  if (status.ready && status.durationSeconds > 0 && status.durationSeconds !== row.lesson.durationSeconds) {
    // Matching the uid too: a replacement upload may have started since we read the row.
    await db
      .update(lessons)
      .set({ durationSeconds: status.durationSeconds })
      .where(and(eq(lessons.id, row.lesson.id), eq(lessons.videoUid, row.lesson.videoUid)));
    revalidateCourse(row.courseSlug);
  }
  return Response.json({ state: status.state, ready: status.ready && status.durationSeconds > 0, durationSeconds: status.durationSeconds });
}
