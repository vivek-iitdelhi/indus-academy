import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { distributors, user } from "../../db/schema.ts";
import { findLearner, parseCompletionInput, parseLearnerInput, upsertLearner, validExternalId } from "./partners.ts";

test("validExternalId: 1–200 chars, no surrounding spaces", () => {
  assert.equal(validExternalId("u_123"), true);
  assert.equal(validExternalId(""), false);
  assert.equal(validExternalId(" u"), false);
  assert.equal(validExternalId("x".repeat(200)), true);
  assert.equal(validExternalId("x".repeat(201)), false);
});

test("parseLearnerInput: name required, email optional and checked", () => {
  assert.deepEqual(parseLearnerInput({ name: "  Asha Rao ", email: "Asha@TCS.com" }), {
    ok: true,
    value: { name: "Asha Rao", email: "asha@tcs.com" },
  });
  assert.deepEqual(parseLearnerInput({ name: "Asha" }), { ok: true, value: { name: "Asha", email: null } });
  assert.equal(parseLearnerInput({}).ok, false);
  assert.equal(parseLearnerInput({ name: "x".repeat(121) }).ok, false);
  assert.equal(parseLearnerInput({ name: "Asha", email: "nope" }).ok, false);
  assert.equal(parseLearnerInput(null).ok, false);
});

test("parseCompletionInput: course and batch required, completed_at optional, not in the future", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  assert.deepEqual(parseCompletionInput({ course: "c", batch: " Jan " }, now), {
    ok: true,
    value: { courseSlug: "c", batch: "Jan", completedAt: now },
  });
  const at = parseCompletionInput({ course: "c", batch: "b", completed_at: "2026-10-01T00:00:00Z" }, now);
  assert.equal(at.ok && at.value.completedAt.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(parseCompletionInput({ batch: "b" }, now).ok, false);
  assert.equal(parseCompletionInput({ course: "c" }, now).ok, false);
  assert.equal(parseCompletionInput({ course: "c", batch: "x".repeat(101) }, now).ok, false);
  assert.equal(parseCompletionInput({ course: "c", batch: "b", completed_at: "soon" }, now).ok, false);
  assert.equal(parseCompletionInput({ course: "c", batch: "b", completed_at: "2026-10-24T00:00:00Z" }, now).ok, false);
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms npm test
describe("partner learners", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const tag = randomUUID().slice(0, 8);
  const distributorIds: string[] = [];

  async function newDistributor() {
    const [d] = await db
      .insert(distributors)
      .values({ name: `Test ${tag}`, keyPrefix: "iaa_live_test", keyHash: randomUUID() })
      .returning();
    distributorIds.push(d.id);
    return d;
  }

  after(async () => {
    if (distributorIds.length) {
      const users = await db.query.partnerLearners.findMany({ where: (p) => inArray(p.distributorId, distributorIds) });
      await db.delete(distributors).where(inArray(distributors.id, distributorIds));
      if (users.length) await db.delete(user).where(inArray(user.id, users.map((u) => u.userId)));
    }
    await db.$client.end();
  });

  test("PUT twice: one user, created then updated", async () => {
    const d = await newDistributor();
    const first = await upsertLearner(d.id, "u_1", { name: "Asha", email: "asha@tcs.com" });
    assert.equal(first.created, true);
    assert.equal(first.learner.name, "Asha");
    const second = await upsertLearner(d.id, "u_1", { name: "Asha Rao", email: null });
    assert.equal(second.created, false);
    assert.equal(second.learner.userId, first.learner.userId);
    assert.equal(second.learner.email, null);
    const found = await findLearner(d.id, "u_1");
    assert.equal(found?.name, "Asha Rao");
    const [row] = await db.select().from(user).where(eq(user.id, first.learner.userId));
    assert.match(row.email, /^p-[0-9a-f-]{36}@learners\.invalid$/);
  });

  test("the same external id at two clients is two learners", async () => {
    const a = await newDistributor();
    const b = await newDistributor();
    const la = await upsertLearner(a.id, "same", { name: "A", email: null });
    const lb = await upsertLearner(b.id, "same", { name: "B", email: null });
    assert.notEqual(la.learner.userId, lb.learner.userId);
    assert.equal(await findLearner(a.id, "nope"), null);
  });

  test("concurrent PUTs for one new learner make one user", async () => {
    const d = await newDistributor();
    const results = await Promise.all([1, 2, 3].map(() => upsertLearner(d.id, "race", { name: "R", email: null })));
    assert.equal(new Set(results.map((r) => r.learner.userId)).size, 1);
  });
});
