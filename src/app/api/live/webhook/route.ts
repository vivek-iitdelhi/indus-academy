import { timingSafeEqual } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { liveConfigured, webhookKey } from "@/lib/live";

// webinar.gg posts its events here (URL with ?key= shown on the admin course page). Only the
// recording matters: its link goes on the session so learners and partners can watch it.
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
  // Every other event, and repeats, are fine to ignore.
  return new Response(null, { status: 204 });
}
