import { createHash } from "node:crypto";
import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiIdempotencyKeys } from "../db/schema.ts";

// Idempotency-Key for partner POST/PUT (withDistributor): the first response is stored and
// replayed for 24 h. The row goes in before the handler runs, so a second request with the
// same key, arriving while the first is still running, finds it and is turned away.

const TTL_MS = 24 * 3_600_000;
// A row still running after this long belongs to a container that died mid-request; a retry may take it over.
const STALE_MS = 5 * 60_000;
export const MAX_KEY_LENGTH = 255;

export type Claim =
  | { kind: "run" } // ours: run the handler, then finishIdempotencyKey (or releaseIdempotencyKey)
  | { kind: "replay"; status: number; body: string }
  | { kind: "conflict" } // the same key was used for a different request
  | { kind: "in_progress" };

/** What makes two requests "the same": method, path and query, live or test key, and the exact body. */
export const requestHash = (method: string, path: string, testMode: boolean, body: string) =>
  createHash("sha256").update(`${method} ${path} ${testMode ? "test" : "live"}\n${body}`).digest("hex");

export async function claimIdempotencyKey(
  r: { distributorId: string; key: string; method: string; path: string; requestHash: string },
  now = new Date(),
): Promise<Claim> {
  const t = apiIdempotencyKeys;
  const expired = new Date(now.getTime() - TTL_MS).toISOString();
  const stale = new Date(now.getTime() - STALE_MS).toISOString();
  // One statement: insert, or take over a row that has expired (or was left running by a dead container).
  const [claimed] = await db
    .insert(t)
    .values({ ...r, createdAt: now })
    .onConflictDoUpdate({
      target: [t.distributorId, t.key],
      set: { method: r.method, path: r.path, requestHash: r.requestHash, status: null, responseBody: null, createdAt: now },
      setWhere: sql`${t.createdAt} < ${expired}::timestamptz or (${t.status} is null and ${t.createdAt} < ${stale}::timestamptz and ${t.requestHash} = excluded.request_hash)`,
    })
    .returning({ key: t.key });
  if (claimed) return { kind: "run" };

  const [row] = await db.select().from(t).where(and(eq(t.distributorId, r.distributorId), eq(t.key, r.key)));
  if (!row) return { kind: "in_progress" }; // released between the two statements; a retry will run
  if (row.requestHash !== r.requestHash) return { kind: "conflict" };
  if (row.status === null) return { kind: "in_progress" };
  return { kind: "replay", status: row.status, body: row.responseBody ?? "" };
}

export async function finishIdempotencyKey(distributorId: string, key: string, status: number, body: string) {
  await db
    .update(apiIdempotencyKeys)
    .set({ status, responseBody: body })
    .where(and(eq(apiIdempotencyKeys.distributorId, distributorId), eq(apiIdempotencyKeys.key, key)));
}

/** Forgets the key, so a retry runs again. For responses not worth replaying (5xx). */
export async function releaseIdempotencyKey(distributorId: string, key: string) {
  await db.delete(apiIdempotencyKeys).where(and(eq(apiIdempotencyKeys.distributorId, distributorId), eq(apiIdempotencyKeys.key, key)));
}

/** Drops keys older than 24 h. Run from the every-minute cron. */
export async function pruneIdempotencyKeys(now = new Date()) {
  await db.delete(apiIdempotencyKeys).where(lt(apiIdempotencyKeys.createdAt, new Date(now.getTime() - TTL_MS)));
}
