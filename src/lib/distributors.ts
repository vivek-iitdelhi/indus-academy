import { createHash, randomBytes } from "node:crypto";
import { and, asc, count, eq, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { courses, distributorCourses, distributors, lessons, type Course, type Distributor, type Lesson } from "../db/schema.ts";

const KEY_PREFIX = "iaa_live_";
const KEY_PATTERN = /^iaa_live_[A-Za-z0-9_-]{43}$/;
const LAST_USED_RESOLUTION_MS = 60_000;

export const hashApiKey = (key: string) => createHash("sha256").update(key).digest("hex");

/** A new key. Show `key` to the admin once; store only `prefix` and `hash`. */
export function generateApiKey() {
  const key = KEY_PREFIX + randomBytes(32).toString("base64url");
  return { key, prefix: key.slice(0, KEY_PREFIX.length + 4), hash: hashApiKey(key) };
}

/** The key from `Authorization: Bearer <key>`, or null when absent or malformed. */
export function parseBearer(header: string | null): string | null {
  const match = header?.match(/^Bearer +(\S+) *$/i);
  return match && KEY_PATTERN.test(match[1]) ? match[1] : null;
}

/**
 * The active distributor behind the request's key, or null. Looked up by hash, so no
 * secret is ever compared byte by byte; a revoked key fails on the very next request.
 */
export async function authenticateDistributor(request: Request): Promise<Distributor | null> {
  const key = parseBearer(request.headers.get("authorization"));
  if (!key) return null;
  const [distributor] = await db
    .select()
    .from(distributors)
    .where(and(eq(distributors.keyHash, hashApiKey(key)), eq(distributors.status, "active")))
    .limit(1);
  if (!distributor) return null;

  // Minute resolution is plenty for "last used", and saves a write on every request.
  const now = new Date();
  if (!distributor.lastUsedAt || now.getTime() - distributor.lastUsedAt.getTime() >= LAST_USED_RESOLUTION_MS) {
    await db.update(distributors).set({ lastUsedAt: now }).where(eq(distributors.id, distributor.id));
  }
  return distributor;
}

/** Condition on `courses`: published, and licensed to the distributor (all courses, or picked ones). */
const licensedPublished = (distributorId: string) =>
  and(
    eq(courses.status, "published"),
    or(
      sql`exists (select 1 from ${distributors} where ${distributors.id} = ${distributorId} and ${distributors.allCourses})`,
      sql`exists (select 1 from ${distributorCourses} where ${distributorCourses.distributorId} = ${distributorId} and ${distributorCourses.courseId} = ${courses.id})`,
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
export async function licensedCourse(distributorId: string, slug: string): Promise<Course | null> {
  const [row] = await db
    .select({ course: courses })
    .from(courses)
    .where(and(eq(courses.slug, slug), licensedPublished(distributorId)))
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
