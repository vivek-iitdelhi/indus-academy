import { unstable_rethrow } from "next/navigation";
import { after } from "next/server";
import type { Course } from "@/db/schema";
import { endpointOf, recordApiRequest } from "@/lib/api-usage";
import { authenticateDistributor, type ApiDistributor } from "@/lib/distributors";
import { claimIdempotencyKey, finishIdempotencyKey, MAX_KEY_LENGTH, releaseIdempotencyKey, requestHash } from "@/lib/idempotency";
import { hitRateLimit, rateLimitHeaders, type RateLimit } from "@/lib/rate-limit";

const NO_STORE = { "cache-control": "no-store" };

export const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
  Response.json(body, { status, headers: { ...NO_STORE, ...headers } });

export const apiError = (status: number, code: string, message: string, headers?: HeadersInit) =>
  json({ error: { code, message } }, status, headers);

export const notFound = () => apiError(404, "not_found", "No such resource.");

/**
 * Wraps a /api/v1 or /api/v2 handler: it runs only for a request carrying an active distributor's
 * key, within the key's rate limit, at most once per Idempotency-Key, and a crash answers
 * `500 internal_error` in the usual error shape. `distributor.testMode` is true for iaa_test_ keys.
 */
export function withDistributor<C>(handler: (distributor: ApiDistributor, request: Request, context: C) => Promise<Response>) {
  return async (request: Request, context: C) => {
    const started = Date.now();
    let distributor: ApiDistributor | null = null;
    let limit: RateLimit | null = null;
    let response: Response;
    try {
      const d = (distributor = await authenticateDistributor(request));
      if (!d) {
        const unknownKey = request.headers.get("authorization")?.match(/^Bearer (iaa_[a-z]+_.{4})/)?.[1];
        if (unknownKey) logRequest(request, started, { key: unknownKey, status: 401, error: "unauthorized" });
        return apiError(401, "unauthorized", "Missing, invalid or revoked API key.", { "www-authenticate": "Bearer" });
      }
      // The limiter fails open: a hiccup in it should not take the API down with it.
      limit = await hitRateLimit(d.keyId, d.rateLimitPerMinute).catch((e) => (console.error("[rate limit]", e), null));
      response = limit && !limit.allowed ? rateLimited(limit) : await idempotent(d, request, () => handler(d, request, context));
    } catch (error) {
      unstable_rethrow(error);
      console.error("[api]", request.method, request.url, error);
      response = apiError(500, "internal_error", "Something went wrong on our side. Retry later; tell us if it keeps happening.");
    }
    if (distributor) {
      // Usage is counted after the response is sent, so it never slows the API down.
      const { id, name, testMode: test } = distributor;
      const status = response.status;
      after(() => recordApiRequest(id, endpointOf(request.method, request.url), status).catch((e) => console.error("[api usage]", e)));
      const failed = status >= 400 ? response.clone() : null;
      after(async () => {
        const body = (await failed?.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
        logRequest(request, started, { partner: name, test, status, error: body?.error?.code, message: body?.error?.message });
      });
    }
    if (!limit) return response;
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(rateLimitHeaders(limit))) headers.set(name, value);
    return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
  };
}

/**
 * One log line per partner request, for scripts/partner-watch.sh. The route pattern, not the path,
 * and never the key or the body: paths and bodies carry customers' details. Error messages are
 * our own fixed text.
 */
function logRequest(request: Request, started: number, fields: Record<string, unknown>) {
  console.info(`[partner-api] ${JSON.stringify({ endpoint: endpointOf(request.method, request.url), ms: Date.now() - started, ...fields })}`);
}

const rateLimited = (limit: RateLimit) =>
  json(
    {
      error: {
        code: "rate_limited",
        message: `Over the limit of ${limit.limit} requests a minute. Retry in ${limit.reset} s.`,
        retry_after: limit.reset,
      },
    },
    429,
    { "retry-after": String(limit.reset) },
  );

/**
 * Idempotency-Key on POST and PUT: the first response (below 500) is stored and replayed for 24 h
 * to a repeat of the same request; the same key with a different request is a conflict.
 */
async function idempotent(distributor: ApiDistributor, request: Request, run: () => Promise<Response>): Promise<Response> {
  const key = request.headers.get("idempotency-key");
  if (key === null || (request.method !== "POST" && request.method !== "PUT")) return run();
  if (!key || key.length > MAX_KEY_LENGTH) {
    return apiError(400, "invalid_request", `\`Idempotency-Key\` must be 1–${MAX_KEY_LENGTH} characters.`);
  }
  const url = new URL(request.url);
  const path = url.pathname + url.search;
  const hash = requestHash(request.method, path, distributor.testMode, await request.clone().text());
  const claim = await claimIdempotencyKey({ distributorId: distributor.id, key, method: request.method, path, requestHash: hash });
  if (claim.kind === "conflict") {
    return apiError(409, "idempotency_conflict", "This Idempotency-Key was already used for a different request.");
  }
  if (claim.kind === "in_progress") {
    return apiError(409, "request_in_progress", "A request with this Idempotency-Key is still running. Retry in a few seconds.");
  }
  if (claim.kind === "replay") {
    return new Response(claim.body, {
      status: claim.status,
      headers: { ...NO_STORE, "content-type": "application/json", "idempotent-replayed": "true" },
    });
  }
  let response: Response;
  try {
    response = await run();
  } catch (error) {
    await releaseIdempotencyKey(distributor.id, key).catch(() => {});
    throw error;
  }
  // A 5xx is not stored: the retry runs again.
  if (response.status >= 500) await releaseIdempotencyKey(distributor.id, key);
  else await finishIdempotencyKey(distributor.id, key, response.status, await response.clone().text());
  return response;
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
  language: course.language,
  cover_image_url: course.coverImageUrl,
  price_paise: course.pricePaise,
  lesson_count: lessonCount,
  total_duration_seconds: totalDurationSeconds,
  updated_at: course.updatedAt.toISOString(),
});
