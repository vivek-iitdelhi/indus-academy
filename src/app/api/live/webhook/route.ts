import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { liveConfigured, webhookKey } from "@/lib/live";
import { syncAttendance } from "@/lib/live-attendance";

// webinar.gg posts its events here (URL with ?key=, set once through the owner session). Two
// matter: the recording, whose link goes on the session, and the end, when we read attendance.
// ponytail: links to webinar.gg's copy; import it into R2 + the encoder if it must be ours.

const sameKey = (given: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(webhookKey());
  return a.length === b.length && timingSafeEqual(a, b);
};

export async function POST(request: Request) {
  if (!liveConfigured() || !sameKey(new URL(request.url).searchParams.get("key") ?? "")) {
    return new Response("Forbidden", { status: 403 });
  }
  const body = (await request.json().catch(() => null)) as {
    event?: string;
    data?: { webinarId?: string; mp4Url?: string; m3u8Url?: string; mainUrl?: string };
  } | null;
  const data = body?.data;
  if (body?.event === "webinar.recording.created" && data?.webinarId) {
    const url = data.mp4Url || data.m3u8Url || data.mainUrl;
    if (url?.startsWith("https://")) {
      await db.update(liveSessions).set({ recordingUrl: url }).where(eq(liveSessions.webinarId, data.webinarId));
    }
  }
  if (body?.event === "webinar.ended" && data?.webinarId) {
    const [session] = await db.select().from(liveSessions).where(eq(liveSessions.webinarId, data.webinarId));
    // In the background at low priority; the /api/cron/live sweep finishes it if this stops.
    if (session && !session.attendanceSyncedAt) after(() => syncAttendance(session).catch((e) => console.error("[live] attendance sync failed", e)));
  }
  // Every other event, and repeats, are fine to ignore.
  return new Response(null, { status: 204 });
}
