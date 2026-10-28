import { eq } from "drizzle-orm";
import { db } from "@/db";
import { liveSessions } from "@/db/schema";
import { isUuid } from "@/lib/distributors";
import { liveStatus } from "@/lib/live";

// GET → {ended}: whether a live class is over (the host ended it, or its time is up). Open rooms
// ask every 20 s (live-room.tsx), since webinar.gg's room just says "Webinar has ended" and
// doesn't tell our page. Says nothing else, so it needs no sign-in.
// ponytail: one primary-key read per open room per 20 s; cache it per class if rooms number in the tens of thousands.
export async function GET(_request: Request, { params }: RouteContext<"/api/live/[id]/status">) {
  const { id } = await params;
  if (!isUuid(id)) return Response.json({ error: "Not found." }, { status: 404 });
  const [session] = await db
    .select({ startsAt: liveSessions.startsAt, durationMinutes: liveSessions.durationMinutes, endedAt: liveSessions.endedAt })
    .from(liveSessions)
    .where(eq(liveSessions.id, id));
  if (!session) return Response.json({ error: "Not found." }, { status: 404 });
  return Response.json({ ended: liveStatus(session) === "ended" }, { headers: { "cache-control": "no-store" } });
}
