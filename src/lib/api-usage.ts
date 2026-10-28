import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { apiUsageDaily } from "../db/schema.ts";

// Per-client partner API usage: counters per day and endpoint (api_usage_daily).

const ROUTES: [RegExp, string][] = [
  [/^\/courses$/, "/courses"],
  [/^\/courses\/[^/]+$/, "/courses/{slug}"],
  [/^\/lessons\/[^/]+\/playback$/, "/lessons/{id}/playback"],
  [/^\/learners\/bulk$/, "/learners/bulk"], // before /learners/{id}
  [/^\/learners\/[^/]+$/, "/learners/{id}"],
  [/^\/learners\/[^/]+\/enrolments$/, "/learners/{id}/enrolments"],
  [/^\/learners\/[^/]+\/courses$/, "/learners/{id}/courses"],
  [/^\/learners\/[^/]+\/completions$/, "/learners/{id}/completions"],
  [/^\/learners\/[^/]+\/completions\/[^/]+$/, "/learners/{id}/completions/{course}"],
  [/^\/learners\/[^/]+\/certificates$/, "/learners/{id}/certificates"],
  [/^\/learners\/[^/]+\/certificates\/[^/]+$/, "/learners/{id}/certificates/{course}"],
  [/^\/completions\/bulk$/, "/completions/bulk"],
  [/^\/batches$/, "/batches"],
];

/** "GET /courses/{slug}": the method and route pattern with ids replaced, so usage groups by endpoint. */
export function endpointOf(method: string, url: string): string {
  const path = new URL(url).pathname.replace(/^\/api\/v1/, "").replace(/\/$/, "");
  return `${method} ${ROUTES.find(([pattern]) => pattern.test(path))?.[1] ?? "other"}`;
}

/** "2026-10-23": the calendar date in India. */
const dayInIndia = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
/** The first day ("2026-10-17") of a window of `days` days ending today, India time. */
export const firstDay = (days: number, now: Date) => dayInIndia(new Date(now.getTime() - (days - 1) * 86_400_000));

export async function recordApiRequest(distributorId: string, endpoint: string, status: number, now = new Date()) {
  const error = status >= 400 ? 1 : 0;
  await db
    .insert(apiUsageDaily)
    .values({ distributorId, day: dayInIndia(now), endpoint, requests: 1, errors: error })
    .onConflictDoUpdate({
      target: [apiUsageDaily.distributorId, apiUsageDaily.day, apiUsageDaily.endpoint],
      set: { requests: sql`${apiUsageDaily.requests} + 1`, errors: sql`${apiUsageDaily.errors} + ${error}` },
    });
}

/** Every day ("2026-10-23") of the last `days` days, oldest first, India time. */
export const daysInWindow = (days: number, now = new Date()) =>
  Array.from({ length: days }, (_, i) => firstDay(days - i, now));

const totals = { requests: sql<number>`sum(${apiUsageDaily.requests})::int`, errors: sql<number>`sum(${apiUsageDaily.errors})::int` };
/** The last `days` days, for one client or (null) every client. */
const inWindow = (distributorId: string | null, days: number, now: Date) =>
  and(gte(apiUsageDaily.day, firstDay(days, now)), distributorId ? eq(apiUsageDaily.distributorId, distributorId) : undefined);

/** Requests per endpoint over the last `days` days, busiest first; null = every client. */
export function usageByEndpoint(distributorId: string | null, days = 30, now = new Date()) {
  return db
    .select({ endpoint: apiUsageDaily.endpoint, ...totals })
    .from(apiUsageDaily)
    .where(inWindow(distributorId, days, now))
    .groupBy(apiUsageDaily.endpoint)
    .orderBy(desc(totals.requests));
}

/** Requests per day over the last `days` days (days with none are absent), oldest first; null = every client. */
export function usageByDay(distributorId: string | null, days = 30, now = new Date()) {
  return db
    .select({ day: apiUsageDaily.day, ...totals })
    .from(apiUsageDaily)
    .where(inWindow(distributorId, days, now))
    .groupBy(apiUsageDaily.day)
    .orderBy(apiUsageDaily.day);
}

/** Requests and errors per client over the last `days` days. */
export async function usageByDistributor(days = 7, now = new Date()): Promise<Map<string, { requests: number; errors: number }>> {
  const rows = await db
    .select({ distributorId: apiUsageDaily.distributorId, ...totals })
    .from(apiUsageDaily)
    .where(inWindow(null, days, now))
    .groupBy(apiUsageDaily.distributorId);
  return new Map(rows.map((r) => [r.distributorId, { requests: r.requests, errors: r.errors }]));
}
