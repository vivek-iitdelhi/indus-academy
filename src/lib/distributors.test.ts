import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { inArray } from "drizzle-orm";
import { db } from "../db/index.ts";
import { courses, distributorCourses, distributors } from "../db/schema.ts";
import { generateApiKey, hashApiKey, licensedCourse, licensedCourses, parseBearer } from "./distributors.ts";

test("generates a random iaa_live_ key with a display prefix and its SHA-256", () => {
  const a = generateApiKey();
  const b = generateApiKey();
  assert.match(a.key, /^iaa_live_[A-Za-z0-9_-]{43}$/);
  assert.notEqual(a.key, b.key);
  assert.equal(a.prefix, a.key.slice(0, 13));
  assert.equal(a.hash, createHash("sha256").update(a.key).digest("hex"));
  assert.equal(hashApiKey(a.key), a.hash);
  assert.ok(!a.hash.includes(a.key));
});

test("parses only a well-formed Bearer key", () => {
  const { key } = generateApiKey();
  assert.equal(parseBearer(`Bearer ${key}`), key);
  assert.equal(parseBearer(`bearer ${key}`), key);
  assert.equal(parseBearer(null), null);
  assert.equal(parseBearer(""), null);
  assert.equal(parseBearer(key), null);
  assert.equal(parseBearer(`Basic ${key}`), null);
  assert.equal(parseBearer(`Bearer ${key}x`), null);
  assert.equal(parseBearer(`Bearer ${key} extra`), null);
  assert.equal(parseBearer("Bearer iaa_live_short"), null);
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms npm test
describe("licensing", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const tag = randomUUID().slice(0, 8);
  const distributorIds: string[] = [];
  const courseIds: string[] = [];

  after(async () => {
    if (distributorIds.length) await db.delete(distributors).where(inArray(distributors.id, distributorIds));
    if (courseIds.length) await db.delete(courses).where(inArray(courses.id, courseIds));
    await db.$client.end();
  });

  async function course(status: "published" | "draft") {
    const [c] = await db
      .insert(courses)
      .values({ slug: `lic-${tag}-${courseIds.length}`, title: "Licensing test", format: "standard", status })
      .returning();
    courseIds.push(c.id);
    return c;
  }
  async function distributor(allCourses: boolean) {
    const [d] = await db
      .insert(distributors)
      .values({ name: `Lic ${tag}`, keyPrefix: "iaa_live_test", keyHash: randomUUID(), allCourses })
      .returning();
    distributorIds.push(d.id);
    return d;
  }
  const slugs = async (id: string) => (await licensedCourses(id)).map((r) => r.course.slug);

  test("all-courses clients see every published course, including ones added later", async () => {
    const all = await distributor(true);
    const picked = await distributor(false);
    const a = await course("published");
    const draft = await course("draft");
    await db.insert(distributorCourses).values({ distributorId: picked.id, courseId: a.id });
    const later = await course("published");

    assert.ok((await slugs(all.id)).includes(a.slug));
    assert.ok((await slugs(all.id)).includes(later.slug));
    assert.ok(!(await slugs(all.id)).includes(draft.slug));
    assert.equal((await licensedCourse(all.id, later.slug))?.id, later.id);

    assert.ok((await slugs(picked.id)).includes(a.slug));
    assert.ok(!(await slugs(picked.id)).includes(later.slug));
    assert.equal(await licensedCourse(picked.id, later.slug), null);
  });
});
