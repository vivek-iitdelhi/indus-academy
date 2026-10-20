import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { courses } from "@/db/schema";
import { formatPrice } from "@/content/programs";
import { formatDuration } from "@/lib/admin/courses";
import { requireAdmin } from "@/lib/session";
import { buttonClass, StatusBadge } from "./form-ui";

export default async function AdminCoursesPage() {
  await requireAdmin();
  const rows = await db
    .select({
      id: courses.id,
      title: courses.title,
      slug: courses.slug,
      format: courses.format,
      status: courses.status,
      pricePaise: courses.pricePaise,
      // Raw names: drizzle leaves columns unqualified in single-table selects, which would
      // make "id" inside these subqueries resolve to the inner table.
      lessonCount: sql<number>`(select count(*) from lessons l where l.course_id = courses.id)::int`,
      durationSeconds: sql<number>`(select coalesce(sum(l.duration_seconds), 0) from lessons l where l.course_id = courses.id)::int`,
      enrollmentCount: sql<number>`(select count(*) from enrollments e where e.course_id = courses.id)::int`,
    })
    .from(courses)
    .orderBy(desc(courses.createdAt));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-[-0.03em]">Courses</h1>
        <Link href="/admin/courses/new" className={buttonClass}>
          New course
        </Link>
      </div>

      {rows.length === 0 ? (
        <p className="mt-8 text-muted">No courses yet.</p>
      ) : (
        <div className="mt-8 overflow-x-auto rounded-2xl border border-line bg-white">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line font-mono text-[0.68rem] uppercase tracking-[0.14em] text-muted">
              <tr>
                <th className="px-4 py-3 font-normal">Course</th>
                <th className="px-4 py-3 font-normal">Format</th>
                <th className="px-4 py-3 font-normal">Status</th>
                <th className="px-4 py-3 text-right font-normal">Price</th>
                <th className="px-4 py-3 text-right font-normal">Lessons</th>
                <th className="px-4 py-3 text-right font-normal">Duration</th>
                <th className="px-4 py-3 text-right font-normal">Enrolments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {rows.map((course) => (
                <tr key={course.id} className="hover:bg-paper/60">
                  <td className="px-4 py-3">
                    <Link href={`/admin/courses/${course.id}`} className="font-medium hover:text-pine hover:underline">
                      {course.title}
                    </Link>
                    <div className="font-mono text-xs text-muted">{course.slug}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{course.format}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={course.status} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {course.pricePaise ? formatPrice(course.pricePaise / 100) : "Free"}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{course.lessonCount}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatDuration(course.durationSeconds)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{course.enrollmentCount.toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
