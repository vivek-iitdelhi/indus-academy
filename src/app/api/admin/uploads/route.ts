import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, lessons } from "@/db/schema";
import { isUuid } from "@/lib/admin/courses";
import { requireAdminApi } from "@/lib/session";
import { createTusUpload, deleteVideo, videoConfigured } from "@/lib/video";

// The provider's ceiling for a single video; it reserves this much quota until processed.
const MAX_DURATION_SECONDS = 6 * 60 * 60;

const fail = (status: number, error: string) => Response.json({ error }, { status });

/**
 * tus-js-client's `endpoint` for lesson videos (`?lessonId=`). Answers the creation POST
 * by opening a resumable upload with the video provider and pointing the client at it;
 * the file bytes then go straight to the provider, never through this server.
 */
export async function POST(request: NextRequest) {
  const admin = await requireAdminApi();
  if (!videoConfigured()) return fail(503, "Video uploads are not configured on this server.");

  const lessonId = request.nextUrl.searchParams.get("lessonId");
  const uploadLength = Number(request.headers.get("upload-length"));
  if (!isUuid(lessonId)) return fail(400, "Missing or invalid lessonId.");
  if (!Number.isSafeInteger(uploadLength) || uploadLength <= 0) return fail(400, "Missing or invalid Upload-Length.");

  const [row] = await db
    .select({ lesson: lessons, courseSlug: courses.slug })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(eq(lessons.id, lessonId));
  if (!row || row.lesson.kind !== "video") return fail(404, "No such video lesson.");

  let ticket;
  try {
    ticket = await createTusUpload({
      uploadLength,
      maxDurationSeconds: MAX_DURATION_SECONDS,
      name: `${row.courseSlug}/${row.lesson.slug}`,
      creator: admin.id,
    });
  } catch (e) {
    console.error("createTusUpload failed", e);
    return fail(502, "The video provider refused the upload. Try again; if it keeps failing, check the server logs.");
  }
  const { uploadUrl, uid } = ticket;
  // Saved before any bytes move, so a half-finished upload is never orphaned. Learners keep
  // the live video_uid until the status check promotes this one once it is ready.
  await db.update(lessons).set({ pendingVideoUid: uid }).where(eq(lessons.id, row.lesson.id));

  // An earlier replacement that never got promoted is abandoned now.
  const abandoned = row.lesson.pendingVideoUid;
  if (abandoned && abandoned !== uid) {
    await deleteVideo(abandoned).catch((e) => console.error(`deleteVideo ${abandoned} failed`, e));
  }

  return new Response(null, {
    status: 201,
    headers: { Location: uploadUrl, "Access-Control-Expose-Headers": "Location", "Tus-Resumable": "1.0.0" },
  });
}
