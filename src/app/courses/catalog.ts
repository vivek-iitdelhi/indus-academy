import { asc, count, eq, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/db";
import { courses, lessons, type Course, type CourseFormat } from "@/db/schema";
import { getCourseBySlug, getCourseOutline } from "@/lib/lms/courses";

// The catalogue is prerendered from the database at build time. A build without
// DATABASE_URL (CI, a fresh preview) renders no courses and fills in on demand / on revalidate.
const dbAvailable = () => Boolean(process.env.DATABASE_URL);

export type CatalogCourse = Course & { lessonCount: number; totalSeconds: number };

export async function listPublishedCourses(): Promise<CatalogCourse[]> {
  if (!dbAvailable()) return [];
  const rows = await db
    .select({
      course: courses,
      lessonCount: count(lessons.id),
      totalSeconds: sql<number>`coalesce(sum(${lessons.durationSeconds}), 0)::int`,
    })
    .from(courses)
    .leftJoin(lessons, eq(lessons.courseId, courses.id))
    .where(eq(courses.status, "published"))
    .groupBy(courses.id)
    .orderBy(asc(courses.createdAt));
  return rows.map(({ course, lessonCount, totalSeconds }) => ({ ...course, lessonCount, totalSeconds }));
}

/** A published course and its outline, or null. Only published courses are on sale. */
export const getCatalogCourse = cache(async (slug: string) => {
  if (!dbAvailable()) return null;
  const course = await getCourseBySlug(slug);
  if (!course || course.status !== "published") return null;
  return { course, outline: await getCourseOutline(course.id) };
});

export const formatLabels: Record<CourseFormat, string> = {
  interactive: "Interactive: short videos with quizzes",
  standard: "Standard: full-length course",
};

export const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/** "₹1,499 (incl. 18% GST)" or "Free". Prices are stored GST-inclusive. */
export const priceLabel = (paise: number) => (paise > 0 ? `${formatRupees(paise)} (incl. 18% GST)` : "Free");

/** 3 h, 1 h 20 min, 24 min. */
export function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours && minutes) return `${hours} h ${minutes} min`;
  if (hours) return `${hours} h`;
  return `${Math.max(minutes, 1)} min`;
}
