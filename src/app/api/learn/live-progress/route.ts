import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { isUuid } from "@/lib/distributors";
import { recordRecordingProgress } from "@/lib/lms/progress";
import { getUser } from "@/lib/session";
import { getVideoStatus } from "@/lib/video";

// A recording's length never changes: read it from storage once per uid per server.
const lengths = new Map<string, number>();

// POST {lessonId: the live class's id, position, watchedDelta}: the player's reports for a class
// recording (/api/learn/progress is lessons'). Also receives navigator.sendBeacon bodies.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to save progress." }, { status: 401 });
  if (!user.name.trim()) return Response.json({ error: "Add your name first." }, { status: 409 });

  const body = await request.json().catch(() => null);
  const position = Number(body?.position);
  const watchedDelta = Number(body?.watchedDelta);
  if (!Number.isFinite(position) || !Number.isFinite(watchedDelta) || !isUuid(body?.lessonId)) {
    return Response.json({ error: "Bad report." }, { status: 400 });
  }
  const [session] = await db.select({ uid: liveSessions.recordingVideoUid }).from(liveSessions).where(eq(liveSessions.id, body.lessonId));
  if (!session?.uid) return Response.json({ error: "Not found." }, { status: 404 });
  let length = lengths.get(session.uid);
  if (length === undefined) {
    const status = await getVideoStatus(session.uid).catch(() => null);
    if (!status?.ready) return Response.json({ error: "Not found." }, { status: 404 });
    lengths.set(session.uid, (length = status.durationSeconds));
  }

  const result = await recordRecordingProgress(user.id, body.lessonId, { position, watchedDelta }, length);
  if (!result) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({
    furthestSeconds: result.progress.furthestSeconds,
    completed: Boolean(result.progress.completedAt),
    newlyCompleted: result.newlyCompleted,
    certificate: result.certificate && { serial: result.certificate.serial },
  });
}
