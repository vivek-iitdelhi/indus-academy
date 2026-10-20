import type { NextRequest } from "next/server";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { isUuid } from "@/lib/admin/courses";
import { requireAdminApi } from "@/lib/session";
import { completeUpload, createUpload, deleteVideo, videoConfigured } from "@/lib/video";

const fail = (status: number, error: string) => Response.json({ error }, { status });

async function videoLesson(lessonId: unknown) {
  if (!isUuid(lessonId)) return null;
  const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId));
  return lesson?.kind === "video" ? lesson : null;
}

/**
 * Starts a lesson video upload. Body `{lessonId, size}`; answers with presigned part URLs
 * the browser PUTs the file to (straight to storage, never through this server), then
 * it calls PUT below to finish.
 */
export async function POST(request: NextRequest) {
  await requireAdminApi();
  if (!videoConfigured()) return fail(503, "Video uploads are not configured on this server.");
  const { lessonId, size } = (await request.json().catch(() => ({}))) as { lessonId?: unknown; size?: unknown };
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) return fail(400, "Missing or invalid size.");
  const lesson = await videoLesson(lessonId);
  if (!lesson) return fail(404, "No such video lesson.");

  let ticket;
  try {
    ticket = await createUpload(size);
  } catch (e) {
    console.error("createUpload failed", e);
    return fail(502, "Video storage refused the upload. Try again; if it keeps failing, check the server logs.");
  }
  // Saved before any bytes move, so a half-finished upload is never orphaned. Learners keep
  // the live video_uid until the status check promotes this one once it is ready.
  // Conditional: if the earlier replacement was promoted meanwhile, it is live now and
  // must not be discarded below.
  const abandoned = lesson.pendingVideoUid;
  const saved = await db
    .update(lessons)
    .set({ pendingVideoUid: ticket.uid })
    .where(and(eq(lessons.id, lesson.id), abandoned ? eq(lessons.pendingVideoUid, abandoned) : isNull(lessons.pendingVideoUid)))
    .returning({ id: lessons.id });
  if (!saved.length) {
    await deleteVideo(ticket.uid).catch((e) => console.error(`deleteVideo ${ticket.uid} failed`, e));
    return fail(409, "The lesson's video just changed. Reload the page and upload again.");
  }

  // An earlier replacement that never got promoted is abandoned now.
  if (abandoned) await deleteVideo(abandoned).catch((e) => console.error(`deleteVideo ${abandoned} failed`, e));

  return Response.json(ticket);
}

/** Finishes an upload. Body `{lessonId, uid, uploadId, etags}` (one ETag per part, in order). */
export async function PUT(request: NextRequest) {
  await requireAdminApi();
  if (!videoConfigured()) return fail(503, "Video uploads are not configured on this server.");
  const body = (await request.json().catch(() => ({}))) as { lessonId?: unknown; uid?: unknown; uploadId?: unknown; etags?: unknown };
  const { uid, uploadId, etags } = body;
  if (typeof uid !== "string" || typeof uploadId !== "string" || !Array.isArray(etags) || !etags.every((e) => typeof e === "string")) {
    return fail(400, "Missing uid, uploadId or etags.");
  }
  const lesson = await videoLesson(body.lessonId);
  if (!lesson) return fail(404, "No such video lesson.");
  if (lesson.pendingVideoUid !== uid) return fail(409, "A newer upload replaced this one.");

  try {
    await completeUpload(uid, uploadId, etags);
  } catch (e) {
    console.error("completeUpload failed", e);
    return fail(502, "Video storage could not finish the upload. Upload the file again.");
  }
  return new Response(null, { status: 204 });
}
