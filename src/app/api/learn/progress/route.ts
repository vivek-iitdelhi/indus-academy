import { lessonGate } from "@/app/learn/data";
import { recordProgress } from "@/lib/lms/progress";
import { getUser } from "@/lib/session";

// POST {lessonId, position, watchedDelta}. Also receives navigator.sendBeacon bodies.
export async function POST(request: Request) {
  const user = await getUser();
  if (!user) return Response.json({ error: "Sign in to save progress." }, { status: 401 });
  // Certificates print the account name; nothing completes until there is one.
  if (!user.name.trim()) return Response.json({ error: "Add your name first." }, { status: 409 });

  const body = await request.json().catch(() => null);
  const position = Number(body?.position);
  const watchedDelta = Number(body?.watchedDelta);
  if (!Number.isFinite(position) || !Number.isFinite(watchedDelta)) {
    return Response.json({ error: "Bad report." }, { status: 400 });
  }

  const gate = await lessonGate(user.id, body?.lessonId);
  if (!gate || gate === "locked" || gate.lesson.kind !== "video") {
    return gate === "locked"
      ? Response.json({ error: "Finish the earlier lessons first." }, { status: 403 })
      : Response.json({ error: "Not found." }, { status: 404 });
  }
  const result = await recordProgress(user.id, gate.lesson.id, { position, watchedDelta });
  if (!result) return Response.json({ error: "Not found." }, { status: 404 });

  return Response.json({
    furthestSeconds: result.progress.furthestSeconds,
    completed: Boolean(result.progress.completedAt),
    newlyCompleted: result.newlyCompleted,
    certificate: result.certificate && { serial: result.certificate.serial },
  });
}
