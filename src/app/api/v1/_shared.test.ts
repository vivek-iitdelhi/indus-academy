import assert from "node:assert/strict";
import * as nodeModule from "node:module";
import { after, describe, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../../db/index.ts";
import { apiUsageDaily, distributors } from "../../../db/schema.ts";
import { createDistributorKey, createDistributorWithKey } from "../../../lib/distributors.ts";

// withDistributor end to end against a real database. Outside Next, so `after` runs the callback
// at once (collected, to await before the pool closes) and `@/` resolves to src/.
const pending: Promise<unknown>[] = [];
(globalThis as { __after?: typeof pending }).__after = pending;
// registerHooks is Node 22.15+; @types/node here is 20, so it is typed by hand.
type Resolved = { url: string; shortCircuit?: boolean };
const { registerHooks } = nodeModule as unknown as {
  registerHooks: (hooks: { resolve: (specifier: string, context: unknown, next: (s: string, c: unknown) => Resolved) => Resolved }) => void;
};
registerHooks({
  resolve(specifier, context, next) {
    if (specifier === "next/server") return { url: "data:text/javascript,export const after = (fn) => globalThis.__after.push(fn());", shortCircuit: true };
    if (specifier === "next/navigation") return { url: "data:text/javascript,export const unstable_rethrow = () => {};", shortCircuit: true };
    if (specifier.startsWith("@/")) return next(new URL(`../../../${specifier.slice(2)}.ts`, import.meta.url).href, context);
    return next(specifier, context);
  },
});
const { json, withDistributor } = await import("./_shared.ts");

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms_platform npm test
describe("withDistributor", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const ids: string[] = [];
  after(async () => {
    await Promise.all(pending);
    if (ids.length) await db.delete(distributors).where(inArray(distributors.id, ids));
    await db.$client.end();
  });
  async function partner(rateLimitPerMinute = 120) {
    const { distributor, key } = await createDistributorWithKey({ name: "Wrapper test", contactEmail: null });
    ids.push(distributor.id);
    await db.update(distributors).set({ rateLimitPerMinute }).where(eq(distributors.id, distributor.id));
    return { id: distributor.id, key };
  }
  const call = (key: string | null, init: RequestInit & { path?: string; headers?: Record<string, string> } = {}) =>
    new Request(`https://indusai.academy/api/v1${init.path ?? "/learners/bulk"}`, {
      ...init,
      headers: { ...init.headers, ...(key && { authorization: `Bearer ${key}` }) },
    });

  test("401 without a key, and no rate-limit headers", async () => {
    const res = await withDistributor(async () => json({}))(call(null), {});
    assert.equal(res.status, 401);
    assert.equal((await res.json()).error.code, "unauthorized");
    assert.equal(res.headers.get("ratelimit"), null);
  });

  test("rate-limit headers on every response; over the limit, 429 rate_limited with Retry-After", async () => {
    const { key } = await partner(2);
    const route = withDistributor(async (d) => json({ test: d.testMode }));
    const first = await route(call(key, { path: "/courses" }), {});
    assert.equal(first.status, 200);
    assert.deepEqual(await first.json(), { test: false });
    assert.equal(first.headers.get("ratelimit-policy"), "2;w=60");
    assert.match(first.headers.get("ratelimit")!, /^limit=2, remaining=1, reset=\d+$/);
    assert.equal(first.headers.get("cache-control"), "no-store");
    await route(call(key, { path: "/courses" }), {});
    const over = await route(call(key, { path: "/courses" }), {});
    assert.equal(over.status, 429);
    const body = await over.json();
    assert.equal(body.error.code, "rate_limited");
    assert.ok(body.error.retry_after >= 1 && body.error.retry_after <= 60);
    assert.equal(over.headers.get("retry-after"), String(body.error.retry_after));
    assert.match(over.headers.get("ratelimit")!, /^limit=2, remaining=0, reset=\d+$/);
  });

  test("a crash answers 500 internal_error in the usual shape, and is counted", async () => {
    const { id, key } = await partner();
    const res = await withDistributor(async () => {
      throw new Error("boom");
    })(call(key, { path: "/batches" }), {});
    assert.equal(res.status, 500);
    assert.equal((await res.json()).error.code, "internal_error");
    assert.ok(res.headers.get("ratelimit"));
    await Promise.all(pending);
    const [usage] = await db
      .select()
      .from(apiUsageDaily)
      .where(and(eq(apiUsageDaily.distributorId, id), eq(apiUsageDaily.endpoint, "GET /batches")));
    assert.deepEqual([usage.requests, usage.errors], [1, 1]);
  });

  test("test keys reach the handler as testMode, acting as the partner's sandbox twin", async () => {
    const { id } = await partner();
    const test = (await createDistributorKey(id, { test: true }))!;
    const res = await withDistributor(async (d) => json({ test: d.testMode, sandboxOf: d.sandboxOf, same: d.id === id }))(call(test.key, { path: "/courses" }), {});
    assert.deepEqual(await res.json(), { test: true, sandboxOf: id, same: false });
  });

  test("Idempotency-Key: replayed, conflicting, in progress, and 5xx not stored", async () => {
    const { key } = await partner();
    let runs = 0;
    const route = withDistributor(async (_d, request) => {
      runs++;
      const body = (await request.json()) as { wait?: number; fail?: boolean };
      if (body.wait) await new Promise((r) => setTimeout(r, body.wait));
      if (body.fail) return json({ error: { code: "x", message: "x" } }, 503);
      return json({ run: runs }, 201);
    });
    const post = (idem: string, body: unknown, method = "POST") =>
      route(call(key, { method, body: JSON.stringify(body), headers: { "idempotency-key": idem } }), {});

    const first = await post("k1", { a: 1 });
    assert.equal(first.status, 201);
    assert.deepEqual(await first.json(), { run: 1 });
    const again = await post("k1", { a: 1 });
    assert.equal(again.status, 201);
    assert.deepEqual(await again.json(), { run: 1 });
    assert.equal(again.headers.get("idempotent-replayed"), "true");
    assert.ok(again.headers.get("ratelimit"));
    assert.equal(runs, 1);

    const conflict = await post("k1", { a: 2 });
    assert.equal(conflict.status, 409);
    assert.equal((await conflict.json()).error.code, "idempotency_conflict");

    const [slow, second] = await Promise.all([post("k2", { wait: 100 }), new Promise((r) => setTimeout(r, 30)).then(() => post("k2", { wait: 100 }))]);
    assert.equal(slow.status, 201);
    assert.equal(second.status, 409);
    assert.equal((await second.json()).error.code, "request_in_progress");

    const before = runs;
    assert.equal((await post("k3", { fail: true })).status, 503);
    assert.equal((await post("k3", { fail: true })).status, 503);
    assert.equal(runs, before + 2); // not replayed

    // without the header, or on GET, nothing changes
    await route(call(key, { method: "POST", body: "{}" }), {});
    await route(call(key, { method: "POST", body: "{}" }), {});
    assert.equal(runs, before + 4);
    const tooLong = await post("x".repeat(256), {});
    assert.equal(tooLong.status, 400);
  });
});
