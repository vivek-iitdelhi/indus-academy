import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { distributors } from "../db/schema.ts";
import {
  authenticateDistributor,
  createDistributorKey,
  createDistributorWithKey,
  distributorKeyList,
  generateApiKey,
  hashApiKey,
  parseBearer,
  replaceLiveKeys,
  revokeDistributorKey,
} from "./distributors.ts";

test("test keys: iaa_test_ prefix, accepted by parseBearer like live ones", () => {
  const { key, prefix } = generateApiKey(true);
  assert.match(key, /^iaa_test_[A-Za-z0-9_-]{43}$/);
  assert.equal(prefix, key.slice(0, 13));
  assert.equal(parseBearer(`Bearer ${key}`), key);
  assert.equal(parseBearer(`Bearer iaa_prod_${key.slice(9)}`), null);
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms_platform npm test
describe("keys and auth", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const ids: string[] = [];
  after(async () => {
    if (ids.length) await db.delete(distributors).where(inArray(distributors.id, ids));
    await db.$client.end();
  });
  const auth = (key: string) => authenticateDistributor(new Request("https://x/api/v1/courses", { headers: { authorization: `Bearer ${key}` } }));
  async function partner() {
    const created = await createDistributorWithKey({ name: `Keys ${randomUUID().slice(0, 6)}`, contactEmail: null });
    ids.push(created.distributor.id);
    return created;
  }

  test("a key from before distributor_keys keeps working once the migration copies it", async () => {
    const { key, prefix, hash } = generateApiKey();
    const [d] = await db.insert(distributors).values({ name: "Old-style", keyPrefix: prefix, keyHash: hash }).returning();
    ids.push(d.id);
    assert.equal(await auth(key), null); // not copied yet: auth reads only distributor_keys
    // The backfill in drizzle/0021_partner_scale.sql, run twice to show it is safe to repeat. Limited
    // to this test's partner, since other test files create and delete partners at the same time.
    const backfill = sql`INSERT INTO "distributor_keys" ("distributor_id", "prefix", "hash", "label", "test", "created_at", "last_used_at")
      SELECT "id", "key_prefix", "key_hash", 'Original key', false, "created_at", "last_used_at" FROM "distributors"
      WHERE "sandbox_of" IS NULL AND "id" = ${d.id}
      ON CONFLICT ("hash") DO NOTHING`;
    await db.execute(backfill);
    await db.execute(backfill);
    const authed = await auth(key);
    assert.equal(authed?.id, d.id);
    assert.equal(authed?.testMode, false);
    assert.equal((await distributorKeyList(d.id)).length, 1);
  });

  test("two live keys at once, then the old one revoked; test keys authenticate in test mode", async () => {
    const { distributor, key: first } = await partner();
    const second = await createDistributorKey(distributor.id, { label: "New" });
    assert.ok(second);
    assert.equal(await createDistributorKey(distributor.id), null); // two live keys is the most
    assert.equal((await auth(first))?.id, distributor.id);
    assert.equal((await auth(second.key))?.keyId, second.row.id);

    const [oldKey] = (await distributorKeyList(distributor.id)).filter((k) => k.id !== second.row.id);
    assert.equal(await revokeDistributorKey(distributor.id, oldKey.id), true);
    assert.equal(await revokeDistributorKey(distributor.id, oldKey.id), false); // already revoked
    assert.equal(await auth(first), null);
    assert.equal((await auth(second.key))?.id, distributor.id);
    // the legacy column no longer holds the revoked key's hash
    const [row] = await db.select().from(distributors).where(eq(distributors.id, distributor.id));
    assert.notEqual(row.keyHash, hashApiKey(first));

    const test = (await createDistributorKey(distributor.id, { test: true }))!;
    assert.ok(test.key.startsWith("iaa_test_"));
    const authed = await auth(test.key);
    // A test key acts in the partner's sandbox twin, the same one every time.
    assert.equal(authed?.sandboxOf, distributor.id);
    assert.equal(authed?.testMode, true);
    assert.equal((await auth(test.key))?.id, authed?.id);
  });

  test("a revoked distributor's keys fail; last used is recorded on key and distributor", async () => {
    const { distributor, key } = await partner();
    await auth(key);
    const [k] = await distributorKeyList(distributor.id);
    assert.ok(k.lastUsedAt);
    await db.update(distributors).set({ status: "revoked" }).where(eq(distributors.id, distributor.id));
    assert.equal(await auth(key), null);
  });

  test("Rotate key replaces every live key at once and leaves test keys alone", async () => {
    const { distributor, key: first } = await partner();
    const second = await createDistributorKey(distributor.id);
    const test = await createDistributorKey(distributor.id, { test: true });
    const rotated = await replaceLiveKeys(distributor.id);
    assert.equal(await auth(first), null);
    assert.equal(await auth(second!.key), null);
    assert.equal((await auth(rotated))?.id, distributor.id);
    assert.equal((await auth(test!.key))?.testMode, true);
    const [row] = await db.select().from(distributors).where(eq(distributors.id, distributor.id));
    assert.equal(row.keyHash, hashApiKey(rotated));
  });
});
