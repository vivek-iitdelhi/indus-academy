import { and, asc, count, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { courses, lessons, type Course, type CourseFormat } from "@/db/schema";
import { getCourseBySlug, getCourseOutline } from "@/lib/lms/courses";
import { liveClasses, listedNow, stillRunning, type LiveClass } from "@/lib/lms/live-courses";
import { formatRupees } from "@/lib/rupees";

// The catalogue is prerendered from the database at build time. A build without
// DATABASE_URL (CI, a fresh preview) renders no courses and fills in on demand / on revalidate.
const dbAvailable = () => Boolean(process.env.DATABASE_URL);

/**
 * At build time only, a database the build can't reach (the deploy machine's network can leave by
 * an IP the database firewall doesn't know) counts as no database, instead of failing the deploy:
 * pages render empty and refill on the first request (they revalidate every minute). At run time
 * errors still throw.
 */
async function orEmptyAtBuild<T>(query: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (process.env.NEXT_PHASE !== "phase-production-build") throw error;
    console.warn("[catalog] database unreachable during the build; this page renders on demand:", (error as Error).message);
    return empty;
  }
}

// liveClasses: a live course's classes (empty for other courses), for "Upcoming" and "Live now".
export type CatalogCourse = Course & { lessonCount: number; totalSeconds: number; liveClasses: LiveClass[] };

export async function listPublishedCourses(): Promise<CatalogCourse[]> {
  if (!dbAvailable()) return [];
  return orEmptyAtBuild(queryPublishedCourses, []);
}

async function queryPublishedCourses(): Promise<CatalogCourse[]> {
  const rows = await db
    .select({
      course: courses,
      lessonCount: count(lessons.id),
      totalSeconds: sql<number>`coalesce(sum(${lessons.durationSeconds}), 0)::int`,
    })
    .from(courses)
    .leftJoin(lessons, eq(lessons.courseId, courses.id))
    // A live course drops off the catalogue once its last class ends (enrolled learners keep it in /learn).
    .where(and(eq(courses.status, "published"), listedNow))
    .groupBy(courses.id)
    .orderBy(asc(courses.createdAt));
  return Promise.all(
    rows.map(async ({ course, lessonCount, totalSeconds }) => ({
      ...course,
      lessonCount,
      totalSeconds,
      liveClasses: course.format === "live" ? await liveClasses(course.id) : [],
    })),
  );
}

/**
 * A published course with its outline and live classes, or null. Only published courses are on
 * sale, and a live course only until its last class ends: after that its page is gone for everyone
 * (enrolled learners reach it through /learn).
 */
export const getCatalogCourse = cache(async (slug: string) => {
  if (!dbAvailable()) return null;
  return orEmptyAtBuild(async () => {
    const course = await getCourseBySlug(slug);
    if (!course || course.status !== "published" || course.partnerOnly) return null;
    const classes = course.format === "live" ? await liveClasses(course.id) : [];
    if (!stillRunning(course, classes)) return null;
    return { course, outline: await getCourseOutline(course.id), liveClasses: classes };
  }, null);
});

export const formatLabels: Record<CourseFormat, string> = {
  interactive: "Interactive: short videos with quizzes",
  standard: "Standard: full-length course",
  live: "Live: taught in scheduled live classes",
};

export { formatRupees } from "@/lib/rupees";

/** "₹1,499 (incl. 18% GST)" or "Free". Prices are stored GST-inclusive. */
export const priceLabel = (paise: number) => (paise > 0 ? `${formatRupees(paise)} (incl. 18% GST)` : "Free");

/** Percent off the list price, or 0 when there is no discount. */
export const percentOff = ({ pricePaise, listPricePaise }: Pick<Course, "pricePaise" | "listPricePaise">) =>
  listPricePaise && listPricePaise > pricePaise ? Math.round((1 - pricePaise / listPricePaise) * 100) : 0;

/** 3 h, 1 h 20 min, 24 min. */
export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours && minutes) return `${hours} h ${minutes} min`;
  if (hours) return `${hours} h`;
  return `${Math.max(minutes, 1)} min`;
}

/** Live classes as plain strings, for the client components that tick over to "Live now". */
export const classTimes = (classes: LiveClass[]) =>
  classes.map((c) => ({ id: c.id, title: c.title, startsAt: c.startsAt.toISOString(), endsAt: c.endsAt.toISOString() }));
