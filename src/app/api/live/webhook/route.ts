import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { liveConfigured, webhookKey } from "@/lib/live";
import { syncAttendance } from "@/lib/live-attendance";
import { importRecording } from "@/lib/live-recordings";

// webinar.gg posts its events here (URL with ?key=, set once through the owner session). Two
// matter: the recording, whose link goes on the session and which we import into our storage
// for the protected player (src/lib/live-recordings.ts), and the end, when we read attendance.

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
      const [session] = await db
        .update(liveSessions)
        .set({ recordingUrl: url })
        .where(eq(liveSessions.webinarId, data.webinarId))
        .returning({ id: liveSessions.id });
      // The encoder downloads one file, so only the MP4 can be imported (a playlist can't).
      if (session && data.mp4Url?.startsWith("https://")) {
        await importRecording(session.id, data.mp4Url).catch((e) => console.error("[live] recording import failed", e));
      }
    }
  }
  if (body?.event === "webinar.ended" && data?.webinarId) {
    // The host may end it early: from now on it is over, and open rooms send people on (live-room.tsx).
    const [session] = await db
      .update(liveSessions)
      .set({ endedAt: sql`coalesce(${liveSessions.endedAt}, now())` })
      .where(eq(liveSessions.webinarId, data.webinarId))
      .returning();
    // In the background at low priority; the /api/cron/live sweep finishes it if this stops.
    if (session && !session.attendanceSyncedAt) after(() => syncAttendance(session).catch((e) => console.error("[live] attendance sync failed", e)));
  }
  // Every other event, and repeats, are fine to ignore.
  return new Response(null, { status: 204 });
}
