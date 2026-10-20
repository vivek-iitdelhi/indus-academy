import { sendNudges } from "@/lib/lms/lifecycle";

export const maxDuration = 120;

/**
 * Called daily by Vercel Cron (see vercel.json: 03:30 UTC = 9:00 AM IST). Emails
 * learners idle for over a week a link to their next lesson; see sendNudges.
 * Unlike the newsletter cron this fails closed: no CRON_SECRET, no run.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    return Response.json(await sendNudges());
  } catch (error) {
    console.error("[nudge] failed:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
