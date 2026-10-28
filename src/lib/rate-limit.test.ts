import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiRateLimits, distributors } from "../db/schema.ts";
import { createDistributorWithKey, distributorKeyList } from "./distributors.ts";
import { hitRateLimit, pruneRateLimits, rateLimitHeaders } from "./rate-limit.ts";

test("headers in webinar.gg's format", () => {
  assert.deepEqual(rateLimitHeaders({ limit: 120, remaining: 7, reset: 13, allowed: true }), {
    "ratelimit-policy": "120;w=60",
    ratelimit: "limit=120, remaining=7, reset=13",
  });
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms_platform npm test
describe("rate limit", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const ids: string[] = [];
  after(async () => {
    if (ids.length) await db.delete(distributors).where(inArray(distributors.id, ids));
    await db.$client.end();
  });
  async function keyId() {
    const { distributor } = await createDistributorWithKey({ name: "Rate limit test", contactEmail: null });
    ids.push(distributor.id);
    return (await distributorKeyList(distributor.id))[0].id;
  }

  test("counts per key per minute, and resets with the next minute", async () => {
    const key = await keyId();
    const now = new Date("2026-10-28T10:00:45Z");
    assert.deepEqual(await hitRateLimit(key, 2, now), { limit: 2, remaining: 1, reset: 15, allowed: true });
    assert.deepEqual(await hitRateLimit(key, 2, now), { limit: 2, remaining: 0, reset: 15, allowed: true });
    assert.deepEqual(await hitRateLimit(key, 2, now), { limit: 2, remaining: 0, reset: 15, allowed: false });
    const next = await hitRateLimit(key, 2, new Date("2026-10-28T10:01:00Z"));
    assert.deepEqual(next, { limit: 2, remaining: 1, reset: 60, allowed: true });
    // another key has its own count
    assert.equal((await hitRateLimit(await keyId(), 2, now)).remaining, 1);
  });

  test("concurrent requests are each counted once: exactly `limit` get through", async () => {
    const key = await keyId();
    const now = new Date("2026-10-28T11:00:10Z");
    const results = await Promise.all(Array.from({ length: 40 }, () => hitRateLimit(key, 25, now)));
    assert.equal(results.filter((r) => r.allowed).length, 25);
    const [row] = await db.select().from(apiRateLimits).where(eq(apiRateLimits.keyId, key));
    assert.equal(row.count, 40);
  });

  test("prunes windows older than five minutes", async () => {
    const key = await keyId();
    await hitRateLimit(key, 10, new Date("2026-10-28T12:00:00Z"));
    await hitRateLimit(key, 10, new Date("2026-10-28T12:09:00Z"));
    await pruneRateLimits(new Date("2026-10-28T12:10:00Z"));
    const rows = await db.select().from(apiRateLimits).where(eq(apiRateLimits.keyId, key));
    assert.deepEqual(rows.map((r) => r.windowStart.toISOString()), ["2026-10-28T12:09:00.000Z"]);
  });
});
