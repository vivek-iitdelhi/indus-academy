import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiIdempotencyKeys, distributors } from "../db/schema.ts";
import { createDistributorWithKey } from "./distributors.ts";
import { claimIdempotencyKey, finishIdempotencyKey, pruneIdempotencyKeys, releaseIdempotencyKey, requestHash } from "./idempotency.ts";

test("requestHash differs by method, path, mode and body", () => {
  const base = requestHash("POST", "/api/v1/learners/bulk", false, "{}");
  assert.equal(base, requestHash("POST", "/api/v1/learners/bulk", false, "{}"));
  assert.notEqual(base, requestHash("PUT", "/api/v1/learners/bulk", false, "{}"));
  assert.notEqual(base, requestHash("POST", "/api/v2/learners/bulk", false, "{}"));
  assert.notEqual(base, requestHash("POST", "/api/v1/learners/bulk", true, "{}"));
  assert.notEqual(base, requestHash("POST", "/api/v1/learners/bulk", false, "{ }"));
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms_platform npm test
describe("idempotency keys", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  let distributorId = "";
  after(async () => {
    if (distributorId) await db.delete(distributors).where(inArray(distributors.id, [distributorId]));
    await db.$client.end();
  });
  const req = (key: string, body = "{}") => ({
    distributorId,
    key,
    method: "POST",
    path: "/api/v1/learners/bulk",
    requestHash: requestHash("POST", "/api/v1/learners/bulk", false, body),
  });

  test("first runs, a repeat while running is turned away, a repeat after is replayed, another body conflicts", async () => {
    distributorId = (await createDistributorWithKey({ name: "Idempotency test", contactEmail: null })).distributor.id;
    assert.deepEqual(await claimIdempotencyKey(req("a")), { kind: "run" });
    assert.deepEqual(await claimIdempotencyKey(req("a")), { kind: "in_progress" });
    await finishIdempotencyKey(distributorId, "a", 201, '{"ok":true}');
    assert.deepEqual(await claimIdempotencyKey(req("a")), { kind: "replay", status: 201, body: '{"ok":true}' });
    assert.deepEqual(await claimIdempotencyKey(req("a", '{"other":1}')), { kind: "conflict" });
  });

  test("of simultaneous requests with one key, exactly one runs", async () => {
    const claims = await Promise.all(Array.from({ length: 10 }, () => claimIdempotencyKey(req("race"))));
    assert.equal(claims.filter((c) => c.kind === "run").length, 1);
    assert.equal(claims.filter((c) => c.kind === "in_progress").length, 9);
  });

  test("a released key runs again; an expired or abandoned one is taken over", async () => {
    await claimIdempotencyKey(req("b"));
    await releaseIdempotencyKey(distributorId, "b");
    assert.deepEqual(await claimIdempotencyKey(req("b")), { kind: "run" });

    const now = Date.now();
    // abandoned mid-request 10 minutes ago: same request takes it over, a different one conflicts
    await claimIdempotencyKey(req("c"), new Date(now - 10 * 60_000));
    assert.deepEqual(await claimIdempotencyKey(req("c", "{1}")), { kind: "conflict" });
    assert.deepEqual(await claimIdempotencyKey(req("c")), { kind: "run" });

    // finished 25 hours ago: expired, anything may reuse the key
    await claimIdempotencyKey(req("d"), new Date(now - 25 * 3_600_000));
    await finishIdempotencyKey(distributorId, "d", 200, "{}");
    assert.deepEqual(await claimIdempotencyKey(req("d", '{"new":1}')), { kind: "run" });

    await claimIdempotencyKey(req("e"), new Date(now - 25 * 3_600_000));
    await pruneIdempotencyKeys(new Date(now));
    const left = await db
      .select()
      .from(apiIdempotencyKeys)
      .where(and(eq(apiIdempotencyKeys.distributorId, distributorId), eq(apiIdempotencyKeys.key, "e")));
    assert.equal(left.length, 0);
  });
});
