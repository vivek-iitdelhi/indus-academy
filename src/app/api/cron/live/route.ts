import { after } from "next/server";
import { pruneJoinLinks } from "@/lib/live";
import { syncPendingAttendance } from "@/lib/live-attendance";
import { deleteExpiredRecordings } from "@/lib/live-recordings";

export const maxDuration = 300;

/**
 * Called every 5 minutes by EventBridge (infra/aws.yml, LiveSchedule). Reads attendance for
 * classes that are over and not final yet (missed or interrupted webinar.ended webhooks), at
 * the webinar.gg budget's lowest priority, drops expired join links, and deletes recordings
 * past their course's recording_days. Answers at once and
 * works for up to 4 minutes after: EventBridge hangs up after 5 s. Fails closed without CRON_SECRET.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  after(async () => {
    try {
      await pruneJoinLinks();
      const deleted = await deleteExpiredRecordings();
      if (deleted) console.log("[live] recordings deleted", deleted);
      console.log("[live] attendance sweep", await syncPendingAttendance(Date.now() + 4 * 60_000));
    } catch (error) {
      console.error("[live] attendance sweep failed:", error);
    }
  });
  return new Response(null, { status: 202 });
}
