import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessons } from "@/db/schema";
import { isUuid } from "@/lib/admin/courses";
import { syncLessonVideo } from "@/lib/admin/video-sync";
import { requireAdminApi } from "@/lib/session";
import { ENCODER_OFFLINE_MS, encoderLastSeen, videoConfigured } from "@/lib/video";

/** Processing status of a lesson's video, polled by the lesson editor after an upload. */
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
  if (!row) return Response.json({ error: "No such lesson." }, { status: 404 });

  const status = await syncLessonVideo(row.lesson, row.courseSlug).catch((e) => {
    console.error("syncLessonVideo failed", e);
    return undefined;
  });
  if (status === undefined) return Response.json({ error: "Could not reach video storage." }, { status: 502 });
  if (!status) return Response.json({ error: "This lesson has no video." }, { status: 404 });

  let encoderOffline = false;
  if (status.state === "processing") {
    const seen = await encoderLastSeen().catch(() => null);
    encoderOffline = !seen || Date.now() - seen.getTime() > ENCODER_OFFLINE_MS;
  }
  return Response.json({ state: status.state, ready: status.ready, durationSeconds: status.durationSeconds, encoderOffline });
}
