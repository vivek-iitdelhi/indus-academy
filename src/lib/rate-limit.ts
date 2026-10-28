import { lt, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiRateLimits } from "../db/schema.ts";

// Partner API rate limit: requests per key per minute, counted in Postgres so every container
// shares one count. Fixed one-minute windows, the same headers as webinar.gg. Floods are stopped
// before they get here, by the AWS WAF rules in infra/aws.yml.
// ponytail: a fixed window lets a key send up to 2× the limit across a minute boundary; use a
// sliding window if that ever matters.

const WINDOW_MS = 60_000;

export type RateLimit = { limit: number; remaining: number; reset: number; allowed: boolean };

/** Counts one request for the key and says whether it is within `limit` for this minute. One upsert. */
export async function hitRateLimit(keyId: string, limit: number, now = new Date()): Promise<RateLimit> {
  const windowStart = new Date(Math.floor(now.getTime() / WINDOW_MS) * WINDOW_MS);
  const [row] = await db
    .insert(apiRateLimits)
    .values({ keyId, windowStart, count: 1 })
    .onConflictDoUpdate({ target: [apiRateLimits.keyId, apiRateLimits.windowStart], set: { count: sql`${apiRateLimits.count} + 1` } })
    .returning({ count: apiRateLimits.count });
  return {
    limit,
    remaining: Math.max(0, limit - row.count),
    reset: Math.ceil((windowStart.getTime() + WINDOW_MS - now.getTime()) / 1000),
    allowed: row.count <= limit,
  };
}

/** `ratelimit-policy` and `ratelimit` (IETF draft, as webinar.gg sends them). */
export const rateLimitHeaders = (r: RateLimit) => ({
  "ratelimit-policy": `${r.limit};w=${WINDOW_MS / 1000}`,
  ratelimit: `limit=${r.limit}, remaining=${r.remaining}, reset=${r.reset}`,
});

/** Drops windows older than a few minutes. Run from the every-minute cron. */
export async function pruneRateLimits(now = new Date()) {
  await db.delete(apiRateLimits).where(lt(apiRateLimits.windowStart, new Date(now.getTime() - 5 * WINDOW_MS)));
}
