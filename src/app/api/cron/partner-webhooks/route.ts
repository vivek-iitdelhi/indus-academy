import { pruneIdempotencyKeys } from "@/lib/idempotency";
import { deliverDueWebhooks } from "@/lib/partner-webhooks";
import { pruneRateLimits } from "@/lib/rate-limit";

export const maxDuration = 120;

/**
 * Called every minute by EventBridge (infra/aws.yml, PartnerWebhooksSchedule). Sends due partner
 * webhooks (src/lib/partner-webhooks.ts), then prunes old rate-limit windows and idempotency keys.
 * Two runs at once are safe: events are claimed with FOR UPDATE SKIP LOCKED. Fails closed like nudge.
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const webhooks = await deliverDueWebhooks();
    await Promise.all([pruneRateLimits(), pruneIdempotencyKeys()]);
    return Response.json({ webhooks });
  } catch (error) {
    console.error("[partner-webhooks] failed:", error);
    return Response.json({ error: String(error) }, { status: 500 });
  }
}
