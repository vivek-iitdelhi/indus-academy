"use server";

import { and, count, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/learners/action-form";
import { db } from "@/db";
import { distributorKeys, distributors } from "@/db/schema";
import { createDistributorKey, isUuid, MAX_KEYS_PER_MODE, revokeDistributorKey } from "@/lib/distributors";
import { generateWebhookSecret, retryWebhookEvents } from "@/lib/partner-webhooks";
import { requireAdminApi } from "@/lib/session";
import type { KeyResult } from "../actions";

// The partner page's API platform settings: keys, rate limit, webhooks.

/** The app-level limit stays under the WAF ceiling (6,000 a minute per key, infra/aws.yml). */
const MAX_RATE_LIMIT = 5000;

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const refresh = (id: string) => revalidatePath(`/admin/distributors/${id}`);
const distributorOf = (form: FormData) => {
  const id = field(form, "distributorId");
  return isUuid(id) ? id : null;
};

export async function createKey(_prev: KeyResult, form: FormData): Promise<KeyResult> {
  await requireAdminApi();
  const id = distributorOf(form);
  if (!id) return { error: "Distributor not found." };
  const test = field(form, "mode") === "test";
  const created = await createDistributorKey(id, { test, label: field(form, "label").slice(0, 80) || null });
  if (!created) return { error: `They already have ${MAX_KEYS_PER_MODE} ${test ? "test" : "live"} keys. Revoke one first.` };
  refresh(id);
  return { key: created.key };
}

export async function revokeKey(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdminApi();
  const id = distributorOf(form);
  const keyId = field(form, "keyId");
  if (!id || !isUuid(keyId)) return { error: "Key not found." };
  const [key] = await db.select().from(distributorKeys).where(and(eq(distributorKeys.id, keyId), eq(distributorKeys.distributorId, id)));
  if (!key) return { error: "Key not found." };
  if (!key.test) {
    // The last live key: revoking it cuts the partner off, which is what "Revoke access" is for.
    const [live] = await db
      .select({ n: count() })
      .from(distributorKeys)
      .where(and(eq(distributorKeys.distributorId, id), eq(distributorKeys.test, false), isNull(distributorKeys.revokedAt)));
    if (live.n <= 1) return { error: "This is their only live key. Create the new key first, or use Revoke access to cut them off." };
  }
  if (!(await revokeDistributorKey(id, keyId))) return { error: "Key not found or already revoked." };
  refresh(id);
  return { ok: "Key revoked. It stopped working at once." };
}

export async function saveRateLimit(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdminApi();
  const id = distributorOf(form);
  const limit = Number(field(form, "rateLimitPerMinute"));
  if (!id) return { error: "Distributor not found." };
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_RATE_LIMIT) return { error: `Enter a whole number from 1 to ${MAX_RATE_LIMIT}.` };
  await db.update(distributors).set({ rateLimitPerMinute: limit }).where(eq(distributors.id, id));
  refresh(id);
  return { ok: `Saved: ${limit} requests a minute per key.` };
}

/** Saves (or, empty, removes) the webhook URL. The first time, also makes the signing secret and returns it, once. */
export async function saveWebhookUrl(_prev: KeyResult, form: FormData): Promise<KeyResult> {
  await requireAdminApi();
  const id = distributorOf(form);
  if (!id) return { error: "Distributor not found." };
  const url = field(form, "webhookUrl");
  if (url && (!URL.canParse(url) || new URL(url).protocol !== "https:")) return { error: "Enter an https:// URL." };
  const [d] = await db.select({ secret: distributors.webhookSecret }).from(distributors).where(eq(distributors.id, id));
  if (!d) return { error: "Distributor not found." };
  const secret = url && !d.secret ? generateWebhookSecret() : null;
  await db
    .update(distributors)
    .set({ webhookUrl: url || null, ...(secret && { webhookSecret: secret }) })
    .where(eq(distributors.id, id));
  refresh(id);
  return secret ? { key: secret } : {};
}

/** A new signing secret; the old one stops verifying at once. Returned once. */
export async function rotateWebhookSecret(_prev: KeyResult, form: FormData): Promise<KeyResult> {
  await requireAdminApi();
  const id = distributorOf(form);
  if (!id) return { error: "Distributor not found." };
  const secret = generateWebhookSecret();
  await db.update(distributors).set({ webhookSecret: secret }).where(eq(distributors.id, id));
  refresh(id);
  return { key: secret };
}

/** Retry one failed event (eventId), or all of the distributor's. */
export async function retryWebhooks(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdminApi();
  const id = distributorOf(form);
  const eventId = field(form, "eventId");
  if (!id || (eventId && !isUuid(eventId))) return { error: "Event not found." };
  const n = await retryWebhookEvents(id, eventId || undefined);
  refresh(id);
  return { ok: n ? `Queued ${n} event${n === 1 ? "" : "s"}; sent within a minute.` : "Nothing to retry." };
}
