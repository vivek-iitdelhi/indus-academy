import { createHmac, randomBytes } from "node:crypto";
import { and, desc, eq, isNotNull, isNull, sql, type SQL } from "drizzle-orm";
import { db } from "../db/index.ts";
import { partnerWebhookEvents, type PartnerWebhookEvent } from "../db/schema.ts";

// Outgoing partner webhooks: an outbox table, drained every minute by /api/cron/partner-webhooks
// (EventBridge, infra/aws.yml). Signed like Stripe's: x-iaa-signature: t=<unix>,v1=<hex hmac>.
// Retried with exponential backoff for 24 h, then marked failed; the admin can retry from the
// partner's page. Delivery is at least once, so partners dedupe on the event id.
// ponytail: nothing is sent straight away; an event waits for the next cron run (≤ 1 minute).

export const WEBHOOK_TYPES = ["certificate.released", "batch.paid", "enrolment.cancelled", "course.updated"] as const;
export type WebhookType = (typeof WEBHOOK_TYPES)[number];

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

const RETRY_FOR_MS = 24 * 3_600_000;
const MAX_DELAY_MS = 4 * 3_600_000;
const TIMEOUT_MS = 10_000;
// A claimed event is not picked again for this long, so a slow run is never double-sent.
const LEASE_MS = 5 * 60_000;
const BATCH = 100;

export const generateWebhookSecret = () => "whsec_" + randomBytes(32).toString("base64url");

/** The x-iaa-signature value: HMAC-SHA256 of "<t>.<body>" with the partner's secret. */
export function signWebhook(secret: string, body: string, t = Math.floor(Date.now() / 1000)) {
  return `t=${t},v1=${createHmac("sha256", secret).update(`${t}.${body}`).digest("hex")}`;
}

/**
 * Queues an event for the distributor. A no-op (null) when they have no webhook URL or their
 * access is revoked, so call it unconditionally. Pass `tx` to queue it in the same transaction
 * as the change it reports. Returns the event id.
 */
export async function queueWebhookEvent(
  distributorId: string,
  type: WebhookType,
  data: Record<string, unknown>,
  tx: Tx | typeof db = db,
): Promise<string | null> {
  const rows = await tx.execute<{ id: string }>(sql`
    insert into partner_webhook_events (distributor_id, type, payload)
    select id, ${type}, ${JSON.stringify(data)}::jsonb from distributors
    where id = ${distributorId} and webhook_url is not null and status = 'active'
    returning id`);
  return rows[0]?.id ?? null;
}

/** When to try again after `attempts` failed tries: 1, 2, 4 … minutes, at most 4 h apart; null = give up (24 h passed). */
export function nextAttemptAt(createdAt: Date, attempts: number, now: Date): Date | null {
  const next = new Date(now.getTime() + Math.min(60_000 * 2 ** (attempts - 1), MAX_DELAY_MS));
  return next.getTime() > createdAt.getTime() + RETRY_FOR_MS ? null : next;
}

/** The JSON body partners receive (and what GET /webhook-events could list). */
export const webhookBody = (e: Pick<PartnerWebhookEvent, "id" | "type" | "createdAt" | "payload">) =>
  JSON.stringify({ id: e.id, type: e.type, created_at: e.createdAt.toISOString(), data: e.payload });

type Claimed = { id: string; type: string; payload: Record<string, unknown>; createdAt: Date; attempts: number; url: string | null; secret: string | null };

/**
 * Claims up to BATCH due events and leases them (database clock: events are queued with its now()). FOR UPDATE SKIP LOCKED: two workers running at
 * once (two containers, or a run that overlaps the next) never claim the same event.
 */
async function claimDue(): Promise<Claimed[]> {
  const rows = await db.execute<{
    id: string;
    type: string;
    payload: Record<string, unknown>;
    created_at: string | Date;
    attempts: number;
    webhook_url: string | null;
    webhook_secret: string | null;
  }>(sql`
    update partner_webhook_events e
    set attempts = e.attempts + 1, next_attempt_at = now() + ${LEASE_MS} * interval '1 millisecond'
    from distributors d
    where d.id = e.distributor_id and e.id in (
      select id from partner_webhook_events
      where next_attempt_at <= now()
      order by next_attempt_at
      limit ${BATCH}
      for update skip locked
    )
    returning e.id, e.type, e.payload, e.created_at, e.attempts, d.webhook_url, d.webhook_secret`);
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    payload: r.payload,
    createdAt: new Date(r.created_at),
    attempts: r.attempts,
    url: r.webhook_url,
    secret: r.webhook_secret,
  }));
}

async function deliver(e: Claimed): Promise<boolean> {
  let error: string;
  if (!e.url || !e.secret) {
    error = "No webhook URL set.";
  } else {
    const body = webhookBody(e);
    try {
      const res = await fetch(e.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "user-agent": "IndusAI-Webhooks/1",
          "x-iaa-signature": signWebhook(e.secret, body),
          "x-iaa-event-id": e.id,
          "x-iaa-event-type": e.type,
        },
        body,
        redirect: "manual",
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      await res.body?.cancel();
      if (res.ok) {
        await db
          .update(partnerWebhookEvents)
          .set({ deliveredAt: new Date(), nextAttemptAt: null, lastError: null })
          .where(eq(partnerWebhookEvents.id, e.id));
        return true;
      }
      error = `HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
    }
  }
  await db
    .update(partnerWebhookEvents)
    .set({ lastError: error.slice(0, 500), nextAttemptAt: e.url ? nextAttemptAt(e.createdAt, e.attempts, new Date()) : null })
    .where(eq(partnerWebhookEvents.id, e.id));
  return false;
}

/** Delivers due events, batch after batch, until none are due or `budgetMs` has passed. */
export async function deliverDueWebhooks(budgetMs = 45_000) {
  const deadline = Date.now() + budgetMs;
  let delivered = 0;
  let failed = 0;
  while (Date.now() < deadline) {
    const batch = await claimDue();
    // ponytail: a batch goes out all at once, up to 100 parallel POSTs; cap per partner if one complains.
    const results = await Promise.all(batch.map(deliver));
    delivered += results.filter(Boolean).length;
    failed += results.length - results.filter(Boolean).length;
    if (batch.length < BATCH) break;
  }
  return { delivered, failed };
}

export type WebhookStatus = "pending" | "delivered" | "failed";
const STATUS: Record<WebhookStatus, SQL | undefined> = {
  pending: isNotNull(partnerWebhookEvents.nextAttemptAt),
  delivered: isNotNull(partnerWebhookEvents.deliveredAt),
  failed: and(isNull(partnerWebhookEvents.nextAttemptAt), isNull(partnerWebhookEvents.deliveredAt)),
};
export const webhookStatus = (e: PartnerWebhookEvent): WebhookStatus =>
  e.deliveredAt ? "delivered" : e.nextAttemptAt ? "pending" : "failed";

/** The distributor's events, newest first; optionally only one status. */
export function listWebhookEvents(distributorId: string, status?: WebhookStatus, limit = 50) {
  return db
    .select()
    .from(partnerWebhookEvents)
    .where(and(eq(partnerWebhookEvents.distributorId, distributorId), status ? STATUS[status] : undefined))
    .orderBy(desc(partnerWebhookEvents.createdAt))
    .limit(limit);
}

/** Puts failed events (one, or all of the distributor's) back in the queue for one more try each. Returns how many. */
export async function retryWebhookEvents(distributorId: string, eventId?: string) {
  const rows = await db
    .update(partnerWebhookEvents)
    .set({ nextAttemptAt: new Date() })
    .where(and(eq(partnerWebhookEvents.distributorId, distributorId), STATUS.failed, eventId ? eq(partnerWebhookEvents.id, eventId) : undefined))
    .returning({ id: partnerWebhookEvents.id });
  return rows.length;
}
