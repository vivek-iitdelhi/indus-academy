import { site } from "@/content/site";
import type { Course } from "@/db/schema";
import { licensedCourse } from "@/lib/distributors";
import {
  completionBatch,
  enrolLearner,
  findLearner,
  parseCompletionInput,
  parseEnrolmentInput,
  parseLearnerInput,
  recordCompletion,
  renameLearner,
  certificatesNamedOtherwise,
  upsertLearner,
  validExternalId,
  type Learner,
  type LearnerCertificate,
  type LearnerCourse,
  type PartnerRefusal,
  MAX_PAGE,
} from "@/lib/lms/partners";
import { apiError } from "./_shared";

// Shared by the single and bulk partner-learner endpoints, so both behave identically.

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; code: string; message: string };
const fail = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });

export const outcomeError = (o: { status: number; code: string; message: string }) => apiError(o.status, o.code, o.message);
export const learnerNotFound = () => apiError(404, "learner_not_found", "No learner with that id.");
export const notCompleted = () => apiError(404, "not_completed", "The learner has not completed this course.");

/**
 * The API version a request came in on. v2 is v1 with the stricter rules a v1 client can't be
 * held to (docs/distributor-api.md, "Versions"); the v2 routes re-export the v1 handlers.
 */
export const isV2 = (request: Request) => new URL(request.url).pathname.startsWith("/api/v2/");

const REFUSALS: Record<PartnerRefusal, [number, string]> = {
  not_enrolled: [409, "The learner is not enrolled in this course. Enrol them first: POST /learners/{external_id}/enrolments."],
  batch_closed: [409, "That batch is paid and closed: nobody can join or leave it. Use a new batch."],
  batch_mismatch: [409, "The learner is enrolled in this course in another batch."],
  batch_required: [400, "Send `batch`: the learner's enrolment has none."],
};
const refused = (code: PartnerRefusal) => fail(REFUSALS[code][0], code, REFUSALS[code][1]);

/** The parsed JSON body, or undefined when it is missing or malformed. */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
}

export const learnerJson = (l: Learner) => ({
  external_id: l.externalId,
  name: l.name,
  email: l.email,
  phone: l.phone,
  created_at: l.createdAt.toISOString(),
});

const certificateJson = (row: Pick<LearnerCertificate, "certificate" | "status">) => {
  const cert = row.certificate;
  return {
    status: row.status,
    ...(cert && {
      serial: cert.serial,
      issued_at: cert.issuedAt.toISOString(),
      image_url: `${site.url}/api/certificates/${cert.serial}/image`,
      verify_url: `${site.url}/verify/${cert.serial}`,
    }),
  };
};

export const completionJson = (row: LearnerCertificate) => ({
  course: row.courseSlug,
  batch: row.batch,
  completed_at: row.completedAt.toISOString(),
  certificate: certificateJson(row),
});

export const learnerCourseJson = (row: LearnerCourse) => ({
  course: row.courseSlug,
  title: row.courseTitle,
  status: row.cancelled ? ("cancelled" as const) : row.completedAt ? ("completed" as const) : ("enrolled" as const),
  batch: row.batch,
  sold_by: row.soldBy,
  centre: row.centre,
  enrolled_at: row.enrolledAt.toISOString(),
  expires_at: row.expiresAt?.toISOString() ?? null,
  completed_at: row.completedAt?.toISOString() ?? null,
  // Certificate status only means something once the course is completed (or a certificate exists).
  certificate: row.completedAt || row.certificate ? certificateJson(row) : null,
});

const invalidId = () => fail(400, "invalid_request", "The learner id must be 1–200 characters, without leading or trailing spaces.");

/**
 * Creates or updates the learner. Certificates already out keep the name they were issued with
 * unless the body says `"update_certificates": true`; `unchanged` lists the serials that differ.
 */
export async function putLearner(
  distributorId: string,
  externalId: string,
  body: unknown,
): Promise<Outcome<{ learner: Learner; created: boolean; unchanged: string[] }>> {
  if (!validExternalId(externalId)) return invalidId();
  const parsed = parseLearnerInput(body);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const { learner, created } = await upsertLearner(distributorId, externalId, parsed.value);
  if (created) return { ok: true, value: { learner, created, unchanged: [] } };
  if ((body as { update_certificates?: unknown }).update_certificates === true) await renameLearner(learner.userId, learner.name);
  return { ok: true, value: { learner, created, unchanged: await certificatesNamedOtherwise(learner.userId, learner.name) } };
}

/** `courseCache` lets a bulk request look each course up once. */
export async function completeOne(
  distributorId: string,
  externalId: string,
  body: unknown,
  courseCache = new Map<string, Course | null>(),
  strict = false,
): Promise<Outcome<LearnerCertificate>> {
  if (!validExternalId(externalId)) return invalidId();
  const parsed = parseCompletionInput(body, new Date(), strict);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const learner = await findLearner(distributorId, externalId);
  if (!learner) return fail(404, "learner_not_found", "No learner with that id.");
  const slug = parsed.value.courseSlug;
  if (!courseCache.has(slug)) courseCache.set(slug, await licensedCourse(distributorId, slug));
  const course = courseCache.get(slug);
  if (!course) return fail(404, "not_found", "No such resource.");
  let batch = parsed.value.batch;
  if (strict) {
    const checked = await completionBatch(distributorId, learner, course.id, batch);
    if ("refused" in checked) return refused(checked.refused);
    batch = checked.batch;
  }
  return { ok: true, value: await recordCompletion(distributorId, learner, course.id, { ...parsed.value, batch }) };
}

/** Enrols the learner; `created` is false when they were already enrolled. */
export async function enrolOne(
  distributorId: string,
  externalId: string,
  body: unknown,
  courseCache = new Map<string, Course | null>(),
  strict = false,
): Promise<Outcome<{ learner: Learner; course: Course; created: boolean }>> {
  if (!validExternalId(externalId)) return invalidId();
  const parsed = parseEnrolmentInput(body);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const learner = await findLearner(distributorId, externalId);
  if (!learner) return fail(404, "learner_not_found", "No learner with that id.");
  const slug = parsed.value.courseSlug;
  if (!courseCache.has(slug)) courseCache.set(slug, await licensedCourse(distributorId, slug));
  const course = courseCache.get(slug);
  if (!course) return fail(404, "not_found", "No such resource.");
  const result = await enrolLearner(distributorId, learner, course.id, parsed.value, { strict });
  if ("refused" in result) return refused(result.refused);
  return { ok: true, value: { learner, course, created: result.created } };
}

/** `?limit=` (1–500, default 100) and `?cursor=` for a listing; null when `limit` is invalid. */
export function pageParams(request: Request): { limit: number; cursor?: string } | null {
  const params = new URL(request.url).searchParams;
  const raw = params.get("limit");
  const limit = raw === null ? 100 : Number(raw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE) return null;
  return { limit, cursor: params.get("cursor") || undefined };
}

export const badPage = () => apiError(400, "invalid_request", `\`limit\` must be a whole number from 1 to ${MAX_PAGE}.`);

/** The page's items and the cursor for the next page (null on the last page). */
export const page = <T>(items: T[], limit: number, cursorOf: (item: T) => string) => ({
  items,
  next_cursor: items.length === limit ? cursorOf(items[items.length - 1]) : null,
});
