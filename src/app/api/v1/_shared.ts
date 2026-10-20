import type { Course, Distributor } from "@/db/schema";
import { authenticateDistributor } from "@/lib/distributors";

const NO_STORE = { "cache-control": "no-store" };

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { ...NO_STORE, ...headers } });

export const apiError = (status: number, code: string, message: string, headers?: HeadersInit) =>
  json({ error: { code, message } }, status, headers);

export const notFound = () => apiError(404, "not_found", "No such resource.");

/** Wraps a handler so it only runs for a request carrying an active distributor's key. */
export function withDistributor<C>(handler: (distributor: Distributor, request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C) => {
    const distributor = await authenticateDistributor(request);
    if (!distributor) {
      return apiError(401, "unauthorized", "Missing, invalid or revoked API key.", { "www-authenticate": "Bearer" });
    }
    return handler(distributor, request, context);
  };
}

export const courseJson = (course: Course, lessonCount: number, totalDurationSeconds: number) => ({
  id: course.id,
  slug: course.slug,
  title: course.title,
  subtitle: course.subtitle,
  description: course.description,
  format: course.format,
  sequential: course.sequential,
  certificate_enabled: course.certificateEnabled,
  price_paise: course.pricePaise,
  lesson_count: lessonCount,
  total_duration_seconds: totalDurationSeconds,
  updated_at: course.updatedAt.toISOString(),
});
