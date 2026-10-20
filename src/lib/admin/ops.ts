import { getTableName, sql, type Column } from "drizzle-orm";

/** Whole percent of a course's lessons completed, floored (24.9% reads 24%). Empty course: 0. */
export const completionPercent = (done: number, total: number) =>
  total > 0 ? Math.floor((Math.min(done, total) * 100) / total) : 0;

/** Refund policy (self-paced): a full refund while the learner has completed under 25% of the course. */
export const REFUND_LIMIT_PERCENT = 25;
export const refundEligible = (done: number, total: number) => done * 100 < total * REFUND_LIMIT_PERCENT || total === 0;

/**
 * An `<input type="date">` value as an expiry: the end of that day in India. "" means
 * never expires (null); anything malformed is undefined.
 */
export function parseExpiryDate(value: string): Date | null | undefined {
  if (value === "") return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const date = new Date(`${value}T23:59:59.999+05:30`);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export const isUuid = (value: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

/** The yyyy-mm-dd (India) value for a date input. */
export const toDateInput = (date: Date | null) =>
  date ? date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }) : "";

export const formatRupees = (paise: number) =>
  `₹${(paise / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export const formatDate = (date: Date | null) =>
  date ? date.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }) : "—";

export const formatDateTime = (date: Date | null) =>
  date
    ? date.toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" })
    : "—";

// Always table-qualified: drizzle leaves columns bare in single-table queries, and a bare
// "user_id" inside the subquery would bind to lesson_progress instead of the outer row.
const outer = (column: Column) => sql`${sql.identifier(getTableName(column.table))}.${sql.identifier(column.name)}`;

/** Correlated subqueries: lessons completed / total lessons, for a (user, course) pair of columns in the outer query. */
export const completionSql = (userColumn: Column, courseColumn: Column) => {
  const [userId, courseId] = [outer(userColumn), outer(courseColumn)];
  return {
  done: sql<number>`(select count(*)::int from lesson_progress lp join lessons l on l.id = lp.lesson_id
    where lp.user_id = ${userId} and l.course_id = ${courseId} and lp.completed_at is not null)`,
    total: sql<number>`(select count(*)::int from lessons l where l.course_id = ${courseId})`,
  };
};
