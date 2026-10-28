import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { like } from "drizzle-orm";
import { db } from "../db/index.ts";
import { liveBudget } from "../db/schema.ts";
import { backoffMs } from "./backoff.ts";
import { acquire, LiveBusy, observe, retryAfterSeconds, take, type Budget } from "./live-budget.ts";

test("backoffMs: equal jitter, doubling, capped", () => {
  const opts = { base: 2_000, cap: 30_000 };
  assert.equal(backoffMs(0, opts, () => 0), 1_000);
  assert.equal(backoffMs(0, opts, () => 1), 2_000);
  assert.equal(backoffMs(3, opts, () => 0), 8_000);
  assert.equal(backoffMs(3, opts, () => 1), 16_000);
  assert.equal(backoffMs(10, opts, () => 0), 15_000);
  assert.equal(backoffMs(10, opts, () => 1), 30_000);
  for (let i = 0; i < 100; i++) {
    const ms = backoffMs(2, opts);
    assert.ok(ms >= 4_000 && ms <= 8_000);
  }
});

test("retryAfterSeconds: past the next slot, spread over 5 s", () => {
  assert.equal(retryAfterSeconds(0.2, () => 0), 2);
  assert.equal(retryAfterSeconds(0.2, () => 0.999), 6);
  assert.equal(retryAfterSeconds(37, () => 0), 38);
});

// Against your own database: DATABASE_URL=postgres://localhost/indus_lms_live node --test src/lib/live-budget.test.ts
describe("live budget", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const prefix = `test-${randomUUID()}`;
  // perMinute 1: a refill every 60 s, so nothing refills during a test.
  const bucket = (perMinute = 1, cost = 1): Budget => ({ name: `${prefix}-${randomUUID()}`, perMinute, burst: 40, cost });
  const granted = async (n: number, run: () => Promise<number>) =>
    (await Promise.all(Array.from({ length: n }, run))).filter((wait) => wait === 0).length;
  after(async () => {
    await db.delete(liveBudget).where(like(liveBudget.name, `${prefix}%`));
    await db.$client.end();
  });

  test("parallel takers never overdraw, and each priority keeps its floor", async () => {
    const b = bucket();
    assert.equal(await granted(60, () => take("join", b)), 32, "joins leave 8 for hosts");
    assert.equal(await granted(20, () => take("sync", b)), 0, "sync gets nothing below its floor");
    assert.equal(await granted(20, () => take("host", b)), 8, "hosts get the reserve");
    const wait = await take("host", b);
    assert.ok(wait > 59 && wait <= 60, `next host slot in a refill interval, got ${wait}`);
  });

  test("sync only spends what is above its floor", async () => {
    const b = bucket();
    assert.equal(await granted(30, () => take("sync", b)), 20);
    assert.equal(await granted(40, () => take("join", b)), 12);
  });

  test("acquire waits in line for the next slot, then gives up with LiveBusy", async () => {
    const b = bucket(600); // a slot every 0.1 s
    // 32 is the burst; a slot or two may refill while 40 takes run on a busy machine.
    const burst = await granted(40, () => take("join", b));
    assert.ok(burst >= 32 && burst <= 34, `burst of about 32, got ${burst}`);
    const started = Date.now();
    await acquire("join", b, 2_000);
    assert.ok(Date.now() - started >= 50, "waited for the refill");
    // Ten waiting at once, a second between them: about ten slots refill, each one goes to one waiter.
    const results = await Promise.allSettled(Array.from({ length: 10 }, () => acquire("join", b, 1_000)));
    const got = results.filter((r) => r.status === "fulfilled").length;
    // Loose bounds: timing depends on load (npm test runs every file at once against one database).
    assert.ok(got >= 1 && got <= 11, `about ten slots, got ${got}`);
    const slow = bucket();
    await granted(32, () => take("join", slow));
    await assert.rejects(acquire("join", slow, 1_000), (e) => e instanceof LiveBusy && e.retryAfter >= 60);
  });

  test("webinar.gg's headers cap the bucket; a 429 empties it", async () => {
    const b = bucket();
    await take("host", b); // creates the row
    assert.equal(await observe(200, new Headers({ ratelimit: "limit=120, remaining=3, reset=40" }), b), 0);
    assert.equal(await granted(10, () => take("host", b)), 3);
    const c = bucket();
    await take("host", c);
    assert.equal(await observe(200, new Headers({ ratelimit: "limit=120, remaining=90, reset=40" }), c), 0);
    assert.equal(await granted(10, () => take("host", c)), 10, "plenty left: no change");
    assert.equal(await observe(429, new Headers({ "retry-after": "37" }), c), 37);
    const wait = await take("host", c);
    assert.ok(wait > 37, `blocked past Retry-After, got ${wait}`);
    const e = bucket(1, 2); // webinar.gg's double count: 7 units left = 3 requests
    await take("host", e);
    await observe(200, new Headers({ ratelimit: "limit=120, remaining=7, reset=40" }), e);
    assert.equal(await granted(10, () => take("host", e)), 3);
    const d = bucket();
    await take("host", d);
    assert.equal(await observe(200, new Headers({ ratelimit: "limit=120, remaining=0, reset=12" }), d), 12);
    assert.ok((await take("host", d)) > 12);
  });
});
