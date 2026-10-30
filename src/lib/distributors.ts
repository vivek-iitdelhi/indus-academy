import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, isNull, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import {
  courses,
  distributorCourses,
  distributorKeys,
  distributors,
  lessons,
  type Course,
  type Distributor,
  type DistributorKey,
  type Lesson,
} from "../db/schema.ts";

const LIVE_PREFIX = "iaa_live_";
const TEST_PREFIX = "iaa_test_";
const KEY_PATTERN = /^iaa_(live|test)_[A-Za-z0-9_-]{43}$/;
const LAST_USED_RESOLUTION_MS = 60_000;
/** Live keys (and, separately, test keys) a distributor can hold at once: the current one and its replacement. */
export const MAX_KEYS_PER_MODE = 2;

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** What withDistributor hands to handlers: the distributor, plus which key called and whether it is a test key. */
export type ApiDistributor = Distributor & { keyId: string; testMode: boolean };

export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new key. Show `key` to the admin once; store only `prefix` and `hash`. */
export function generateApiKey(test = false) {
  const prefix = test ? TEST_PREFIX : LIVE_PREFIX;
  const key = prefix + randomBytes(32).toString("base64url");
  return { key, prefix: key.slice(0, prefix.length + 4), hash: hashApiKey(key) };
}

/** The key from `Authorization: Bearer <key>` (live or test), or null when absent or malformed. */
export function parseBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer +(\S+) *$/i);
  return match && KEY_PATTERN.test(match[1]) ? match[1] : null;
}

/**
 * The active distributor behind the request's key, or null. Looked up by hash, so no
 * secret is ever compared byte by byte; a revoked key fails on the very next request.
 */
export async function authenticateDistributor(request: Request): Promise<ApiDistributor | null> {
  const key = parseBearer(request.headers.get("authorization"));
  if (!key) return null;
  const [row] = await db
    .select({ distributor: distributors, key: distributorKeys })
    .from(distributorKeys)
    .innerJoin(distributors, eq(distributors.id, distributorKeys.distributorId))
    .where(and(eq(distributorKeys.hash, hashApiKey(key)), isNull(distributorKeys.revokedAt), eq(distributors.status, "active")))
    .limit(1);
  if (!row) return null;

  // Minute resolution is plenty for "last used", and saves a write on every request.
  const now = new Date();
  const stale = (at: Date | null) => !at || now.getTime() - at.getTime() >= LAST_USED_RESOLUTION_MS;
  if (stale(row.key.lastUsedAt)) await db.update(distributorKeys).set({ lastUsedAt: now }).where(eq(distributorKeys.id, row.key.id));
  if (stale(row.distributor.lastUsedAt)) await db.update(distributors).set({ lastUsedAt: now }).where(eq(distributors.id, row.distributor.id));
  // A test key acts in the partner's sandbox twin, so test data never mixes with live data.
  const acting = row.key.test ? await sandboxFor(row.distributor) : row.distributor;
  return { ...acting, keyId: row.key.id, testMode: row.key.test };
}

/** The partner's sandbox twin (see distributors.sandbox_of), created on first use. */
export async function sandboxFor(partner: Distributor): Promise<Distributor> {
  await db
    .insert(distributors)
    .values({
      name: `${partner.name} (test)`,
      keyPrefix: "sandbox",
      keyHash: `sandbox:${partner.id}`, // not a key: sandbox twins are reached through iaa_test_ keys
      certificateName: "TEST",
      certificateRelease: "on_completion",
      rateLimitPerMinute: partner.rateLimitPerMinute,
      sandboxOf: partner.id,
    })
    .onConflictDoNothing({ target: distributors.sandboxOf });
  const [twin] = await db.select().from(distributors).where(eq(distributors.sandboxOf, partner.id));
  return twin;
}

/** Every key the distributor has had, newest first (revoked ones included, for the record). */
export function distributorKeyList(distributorId: string): Promise<DistributorKey[]> {
  return db.select().from(distributorKeys).where(eq(distributorKeys.distributorId, distributorId)).orderBy(desc(distributorKeys.createdAt));
}

/**
 * Adds a key next to the existing ones, for rotation without downtime: the partner switches to
 * it, then the admin revokes the old one. Null when the distributor already holds
 * MAX_KEYS_PER_MODE unrevoked keys of that kind. Show `key` once.
 */
export async function createDistributorKey(distributorId: string, { test = false, label = null as string | null } = {}, tx: Tx | typeof db = db) {
  const live = await tx
    .select({ n: count() })
    .from(distributorKeys)
    .where(and(eq(distributorKeys.distributorId, distributorId), eq(distributorKeys.test, test), isNull(distributorKeys.revokedAt)));
  if (live[0].n >= MAX_KEYS_PER_MODE) return null;
  const { key, prefix, hash } = generateApiKey(test);
  const [row] = await tx.insert(distributorKeys).values({ distributorId, prefix, hash, label, test }).returning();
  return { key, row };
}

/**
 * Revokes one key; it stops working on the next request. distributors.key_hash (the pre-rotation
 * single key, no longer read) is scrubbed if it was this key, so deploying an older build can't
 * bring a revoked key back.
 */
export async function revokeDistributorKey(distributorId: string, keyId: string, tx: Tx | typeof db = db): Promise<boolean> {
  if (!isUuid(keyId)) return false;
  const [row] = await tx
    .update(distributorKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(distributorKeys.id, keyId), eq(distributorKeys.distributorId, distributorId), isNull(distributorKeys.revokedAt)))
    .returning();
  if (!row) return false;
  await tx
    .update(distributors)
    .set({ keyHash: hashApiKey(randomBytes(32).toString("hex")) })
    .where(and(eq(distributors.id, distributorId), eq(distributors.keyHash, row.hash)));
  return true;
}

/**
 * "Rotate key": revokes every live key and issues one new one, at once. Keeps
 * distributors.key_prefix/key_hash pointing at it, as before keys moved to their own table.
 */
export function replaceLiveKeys(distributorId: string) {
  return db.transaction(async (tx) => {
    const old = await tx
      .select({ id: distributorKeys.id })
      .from(distributorKeys)
      .where(and(eq(distributorKeys.distributorId, distributorId), eq(distributorKeys.test, false), isNull(distributorKeys.revokedAt)));
    for (const k of old) await revokeDistributorKey(distributorId, k.id, tx);
    const created = await createDistributorKey(distributorId, { label: "Rotated key" }, tx);
    if (!created) throw new Error("unreachable: every live key was just revoked");
    await tx.update(distributors).set({ keyPrefix: created.row.prefix, keyHash: created.row.hash }).where(eq(distributors.id, distributorId));
    return created.key;
  });
}

/** A new distributor with one live key. Show `key` once. */
export function createDistributorWithKey(values: { name: string; contactEmail: string | null }) {
  return db.transaction(async (tx) => {
    const { key, prefix, hash } = generateApiKey();
    // key_prefix/key_hash are NOT NULL UNIQUE from before distributor_keys; they mirror the first key.
    const [distributor] = await tx.insert(distributors).values({ ...values, keyPrefix: prefix, keyHash: hash }).returning();
    await tx.insert(distributorKeys).values({ distributorId: distributor.id, prefix, hash, label: "First key" });
    return { distributor, key };
  });
}

/** Condition on `courses`: published, and licensed to the distributor (all courses, or picked ones). */
// A sandbox twin is licensed exactly like its partner, so licences are read from coalesce(sandbox_of, id).
const licensedPublished = (distributorId: string) =>
  and(
    eq(courses.status, "published"),
    or(
      sql`exists (select 1 from ${distributors} d join ${distributors} l on l.id = coalesce(d.sandbox_of, d.id) where d.id = ${distributorId} and l.all_courses)`,
      sql`exists (select 1 from ${distributors} d join ${distributorCourses} dc on dc.distributor_id = coalesce(d.sandbox_of, d.id) where d.id = ${distributorId} and dc.course_id = ${courses.id})`,
    ),
  );

/** Published courses licensed to the distributor, with lesson count and total duration. */
export function licensedCourses(distributorId: string) {
  return db
    .select({
      course: courses,
      lessonCount: count(lessons.id),
      totalDurationSeconds: sql<number>`coalesce(sum(${lessons.durationSeconds}), 0)::int`,
    })
    .from(courses)
    .leftJoin(lessons, eq(lessons.courseId, courses.id))
    .where(licensedPublished(distributorId))
    .groupBy(courses.id)
    .orderBy(asc(courses.title));
}

/** The course if it is published and licensed to the distributor, else null. */
export async function licensedCourse(distributorId: string, slugOrId: string): Promise<Course | null> {
  const [row] = await db
    .select({ course: courses })
    .from(courses)
    .where(and(isUuid(slugOrId) ? eq(courses.id, slugOrId) : eq(courses.slug, slugOrId), licensedPublished(distributorId)))
    .limit(1);
  return row?.course ?? null;
}

// Postgres throws on a malformed uuid, so check ids from requests first.
export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** The lesson if its course is published and licensed to the distributor, else null. */
export async function licensedLesson(distributorId: string, lessonId: string): Promise<Lesson | null> {
  if (!isUuid(lessonId)) return null;
  const [row] = await db
    .select({ lesson: lessons })
    .from(lessons)
    .innerJoin(courses, eq(lessons.courseId, courses.id))
    .where(and(eq(lessons.id, lessonId), licensedPublished(distributorId)))
    .limit(1);
  return row?.lesson ?? null;
}
