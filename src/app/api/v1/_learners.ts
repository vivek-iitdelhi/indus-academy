import { site } from "@/content/site";
import type { Course } from "@/db/schema";
import { licensedCourse } from "@/lib/distributors";
import {
  findLearner,
  parseCompletionInput,
  parseLearnerInput,
  recordCompletion,
  upsertLearner,
  validExternalId,
  type Learner,
  type LearnerCertificate,
} from "@/lib/lms/partners";
import { apiError } from "./_shared";

// Shared by the single and bulk partner-learner endpoints, so both behave identically.

export type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; code: string; message: string };
const fail = (status: number, code: string, message: string) => ({ ok: false as const, status, code, message });

export const outcomeError = (o: { status: number; code: string; message: string }) => apiError(o.status, o.code, o.message);
export const learnerNotFound = () => apiError(404, "learner_not_found", "No learner with that id.");
export const notCompleted = () => apiError(404, "not_completed", "The learner has not completed this course.");

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
  created_at: l.createdAt.toISOString(),
});

export function completionJson(row: LearnerCertificate) {
  const cert = row.certificate;
  return {
    course: row.courseSlug,
    batch: row.batch,
    completed_at: row.completedAt.toISOString(),
    certificate: {
      status: row.status,
      ...(cert && {
        serial: cert.serial,
        issued_at: cert.issuedAt.toISOString(),
        image_url: `${site.url}/api/certificates/${cert.serial}/image`,
        verify_url: `${site.url}/verify/${cert.serial}`,
      }),
    },
  };
}

const invalidId = () => fail(400, "invalid_request", "The learner id must be 1–200 characters, without leading or trailing spaces.");

export async function putLearner(distributorId: string, externalId: string, body: unknown): Promise<Outcome<{ learner: Learner; created: boolean }>> {
  if (!validExternalId(externalId)) return invalidId();
  const parsed = parseLearnerInput(body);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  return { ok: true, value: await upsertLearner(distributorId, externalId, parsed.value) };
}

/** `courseCache` lets a bulk request look each course up once. */
export async function completeOne(
  distributorId: string,
  externalId: string,
  body: unknown,
  courseCache = new Map<string, Course | null>(),
): Promise<Outcome<LearnerCertificate>> {
  if (!validExternalId(externalId)) return invalidId();
  const parsed = parseCompletionInput(body);
  if (!parsed.ok) return fail(400, "invalid_request", parsed.message);
  const learner = await findLearner(distributorId, externalId);
  if (!learner) return fail(404, "learner_not_found", "No learner with that id.");
  const slug = parsed.value.courseSlug;
  if (!courseCache.has(slug)) courseCache.set(slug, await licensedCourse(distributorId, slug));
  const course = courseCache.get(slug);
  if (!course) return fail(404, "not_found", "No such resource.");
  return { ok: true, value: await recordCompletion(distributorId, learner, course.id, parsed.value) };
}
