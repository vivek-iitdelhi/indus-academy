import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, gt, inArray, isNotNull, isNull, ne, notExists, or, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.ts";
import {
  batchPaymentEvents,
  certificates,
  courses,
  distributorBatches,
  distributorCourses,
  distributors,
  enrollments,
  partnerLearners,
  user,
  type Certificate,
  type CertificateReleaseMode,
  type DistributorBatch,
  type PartnerLearner,
} from "../../db/schema.ts";
import { queueWebhookEvent, type WebhookType } from "../partner-webhooks.ts";
import { issueOrGetCertificate } from "./certificates.ts";

// Partner learners: a licensed client's learners, their completions, and when their
// certificates are released (docs/superpowers/specs/2026-10-23-partner-learners-design.md).

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
export type LearnerInput = { name: string; email: string | null; phone?: string | null };
export type CompletionInput = { courseSlug: string; batch: string | null; completedAt: Date }; // batch: null only in v2
export type EnrolmentInput = {
  courseSlug: string;
  batch: string | null;
  soldBy: string | null;
  centre: string | null;
  enrolledAt: Date | null;
  expiresAt: Date | null;
};
export type Learner = PartnerLearner & { name: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
// A timestamp with an explicit zone (Z or ±hh:mm), so it can't be read in our server's local time.
const ZONED_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/i;
const FUTURE_SLACK_MS = 60_000; // clients' clocks drift

const record = (body: unknown): Record<string, unknown> =>
  body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The client's user id: 1–200 characters, no leading or trailing spaces. */
export const validExternalId = (id: string) => id.length >= 1 && id.length <= 200 && id.trim() === id && id !== "bulk"; // "bulk" is the /learners/bulk endpoint

export function parseLearnerInput(body: unknown): Parsed<LearnerInput> {
  const b = record(body);
  const name = text(b.name);
  if (!name || name.length > 120) return { ok: false, message: "`name` is required, 1–120 characters." };
  let email: string | null = null;
  if (b.email != null) {
    email = text(b.email).toLowerCase();
    if (!EMAIL_PATTERN.test(email) || email.length > 200) return { ok: false, message: "`email` must be a valid email address." };
  }
  let phone: string | null = null;
  if (b.phone != null) {
    phone = text(b.phone).replace(/[\s()-]/g, "");
    if (!PHONE_PATTERN.test(phone)) return { ok: false, message: "`phone` must be 7–15 digits, optionally starting with +." };
  }
  return { ok: true, value: { name, email, phone } };
}

/** An optional timestamp field: null when absent; it must carry a zone (Z or ±hh:mm). */
function zonedTime(value: unknown, field: string): Parsed<Date | null> {
  if (value == null) return { ok: true, value: null };
  const at = typeof value === "string" && ZONED_TIMESTAMP.test(value) ? new Date(value) : new Date(NaN);
  if (Number.isNaN(at.getTime())) return { ok: false, message: `\`${field}\` must be an ISO 8601 timestamp with a zone, like 2026-10-23T06:00:00Z.` };
  return { ok: true, value: at };
}

/** An optional short label (the client's agent or centre id): null when absent. */
function label(value: unknown, field: string): Parsed<string | null> {
  if (value == null) return { ok: true, value: null };
  const v = text(value);
  if (!v || v.length > 100) return { ok: false, message: `\`${field}\` must be 1–100 characters when given.` };
  return { ok: true, value: v };
}

/**
 * v1: `batch` is required and `completed_at` is anything Date parses. v2 (`strict`): `batch` may be
 * left out (the enrolment's batch is used) and `completed_at` needs a zone.
 */
export function parseCompletionInput(body: unknown, now = new Date(), strict = false): Parsed<CompletionInput> {
  const b = record(body);
  const courseSlug = text(b.course);
  if (!courseSlug) return { ok: false, message: "`course` is required: the course slug." };
  const batch = text(b.batch);
  if (batch.length > 100 || (!batch && (!strict || b.batch != null))) {
    return { ok: false, message: strict ? "`batch` must be 1–100 characters when given." : "`batch` is required, 1–100 characters." };
  }
  if (b.completed_at == null) return { ok: true, value: { courseSlug, batch: batch || null, completedAt: now } };
  if (strict && !(typeof b.completed_at === "string" && ZONED_TIMESTAMP.test(b.completed_at))) {
    return { ok: false, message: "`completed_at` must be an ISO 8601 timestamp with a zone, like 2026-10-23T06:00:00Z." };
  }
  const completedAt = typeof b.completed_at === "string" ? new Date(b.completed_at) : new Date(NaN);
  if (Number.isNaN(completedAt.getTime())) return { ok: false, message: "`completed_at` must be an ISO 8601 timestamp." };
  if (completedAt.getTime() > now.getTime() + FUTURE_SLACK_MS) return { ok: false, message: "`completed_at` cannot be in the future." };
  return { ok: true, value: { courseSlug, batch: batch || null, completedAt } };
}

export function parseEnrolmentInput(body: unknown, now = new Date()): Parsed<EnrolmentInput> {
  const b = record(body);
  const courseSlug = text(b.course);
  if (!courseSlug) return { ok: false, message: "`course` is required: the course slug." };
  const batch = label(b.batch, "batch");
  const soldBy = label(b.sold_by, "sold_by");
  const centre = label(b.centre, "centre");
  const enrolledAt = zonedTime(b.enrolled_at, "enrolled_at");
  const expiresAt = zonedTime(b.expires_at, "expires_at");
  for (const r of [batch, soldBy, centre, enrolledAt, expiresAt]) if (!r.ok) return r;
  if (enrolledAt.ok && enrolledAt.value && enrolledAt.value.getTime() > now.getTime() + FUTURE_SLACK_MS) {
    return { ok: false, message: "`enrolled_at` cannot be in the future." };
  }
  return {
    ok: true,
    value: {
      courseSlug,
      batch: batch.ok ? batch.value : null,
      soldBy: soldBy.ok ? soldBy.value : null,
      centre: centre.ok ? centre.value : null,
      enrolledAt: enrolledAt.ok ? enrolledAt.value : null,
      expiresAt: expiresAt.ok ? expiresAt.value : null,
    },
  };
}

export async function findLearner(distributorId: string, externalId: string): Promise<Learner | null> {
  const [row] = await db
    .select({ learner: partnerLearners, name: user.name })
    .from(partnerLearners)
    .innerJoin(user, eq(user.id, partnerLearners.userId))
    .where(and(eq(partnerLearners.distributorId, distributorId), eq(partnerLearners.externalId, externalId)));
  return row ? { ...row.learner, name: row.name } : null;
}

/**
 * Creates or updates the client's learner (PUT semantics: `email` is replaced, null clears it).
 * New learners get their own user row with an unreachable `.invalid` email, so they can never
 * sign in here or collide with a real account.
 */
export async function upsertLearner(
  distributorId: string,
  externalId: string,
  input: LearnerInput,
): Promise<{ learner: Learner; created: boolean }> {
  const existing = await findLearner(distributorId, externalId);
  if (existing) {
    await db.update(user).set({ name: input.name }).where(eq(user.id, existing.userId));
    const [row] = await db
      .update(partnerLearners)
      .set({ email: input.email, phone: input.phone ?? null })
      .where(and(eq(partnerLearners.distributorId, distributorId), eq(partnerLearners.externalId, externalId)))
      .returning();
    return { learner: { ...row, name: input.name }, created: false };
  }
  const userId = randomUUID();
  try {
    return await db.transaction(async (tx) => {
      await tx.insert(user).values({ id: userId, name: input.name, email: `p-${userId}@learners.invalid` });
      const [row] = await tx
        .insert(partnerLearners)
        .values({ distributorId, externalId, userId, email: input.email, phone: input.phone ?? null })
        .returning();
      return { learner: { ...row, name: input.name }, created: true };
    });
  } catch (error) {
    // A concurrent PUT for the same learner won the insert: apply ours as an update.
    if (await findLearner(distributorId, externalId)) return upsertLearner(distributorId, externalId, input);
    throw error;
  }
}

export type CertificateStatus = "pending_payment" | "pending_release" | "released" | "revoked" | "not_offered";

export type LearnerCertificate = {
  courseSlug: string;
  courseTitle: string;
  batch: string | null;
  completedAt: Date;
  certificate: Certificate | null;
  status: CertificateStatus;
};

/** Whether the client's mode lets a completed enrolment's certificate out (admins can force it). */
export const releasable = (mode: CertificateReleaseMode, paidAt: Date | null) =>
  mode === "on_completion" || (mode === "on_payment" && paidAt !== null);

export function certificateStatus(r: {
  certificate: { revokedAt: Date | null } | null;
  certificateEnabled: boolean;
  mode: CertificateReleaseMode;
  paidAt: Date | null;
}): CertificateStatus {
  if (r.certificate) return r.certificate.revokedAt ? "revoked" : "released";
  if (!r.certificateEnabled) return "not_offered";
  return r.mode === "on_payment" && !r.paidAt ? "pending_payment" : "pending_release";
}

const certificateOfEnrollment = and(
  eq(certificates.userId, enrollments.userId),
  eq(certificates.courseId, enrollments.courseId),
);
// A cancelled (refunded) enrolment's completion no longer counts and gets no certificate.
const completedPartnerEnrollment = and(
  eq(enrollments.source, "distributor"),
  eq(enrollments.status, "active"),
  isNotNull(enrollments.completedAt),
);

/**
 * Issues certificates for these partner enrolments when they are completed, the course awards
 * certificates, and the client's mode allows it (`force`, the admin's Generate, skips the mode).
 * Idempotent: an existing certificate is never issued again. Returns how many were newly issued.
 */
export async function releaseCertificates(enrollmentIds: string[], { force = false } = {}): Promise<number> {
  return enrollmentIds.length ? releaseWhere(inArray(enrollments.id, enrollmentIds), force) : 0;
}

/**
 * Queues a webhook for the partner (nothing happens without a webhook URL). A sandbox twin's
 * events go to its partner, marked `test: true`. Never throws: the change it reports is done.
 */
export async function notifyPartner(distributorId: string, type: WebhookType, data: Record<string, unknown>) {
  try {
    const [d] = await db.select({ sandboxOf: distributors.sandboxOf }).from(distributors).where(eq(distributors.id, distributorId));
    await queueWebhookEvent(d?.sandboxOf ?? distributorId, type, { ...data, test: Boolean(d?.sandboxOf) });
  } catch (e) {
    console.error(`[webhooks] ${type} for ${distributorId}`, e);
  }
}

// Same as site.url (src/content/site.ts, which node --test can't import: extensionless imports).
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://indusai.academy";

async function releaseWhere(which: SQL, force = false): Promise<number> {
  const rows = await db
    .select({
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      distributorId: enrollments.distributorId,
      paidAt: distributorBatches.paidAt,
      batch: distributorBatches.name,
      mode: distributors.certificateRelease,
      partnerName: distributors.certificateName,
      sandbox: isNotNull(distributors.sandboxOf),
      externalId: partnerLearners.externalId,
      courseSlug: courses.slug,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(distributors, eq(distributors.id, enrollments.distributorId))
    .innerJoin(partnerLearners, eq(partnerLearners.userId, enrollments.userId))
    .leftJoin(distributorBatches, eq(distributorBatches.id, enrollments.batchId))
    .leftJoin(certificates, certificateOfEnrollment)
    .where(and(which, completedPartnerEnrollment, eq(courses.certificateEnabled, true), isNull(certificates.serial)));
  let issued = 0;
  // ponytail: one enrolment at a time (about 4 queries each); fine for batches of hundreds.
  for (const r of rows) {
    if (!force && !releasable(r.mode, r.paidAt)) continue;
    const result = await issueOrGetCertificate(r.userId, r.courseId, { partnerName: r.partnerName, searchVisible: false });
    if (!result.issued) continue;
    issued++;
    const cert = result.certificate;
    // Sandbox (test-key) certificates exist so integrations can be tested, but are never valid.
    if (r.sandbox) await db.update(certificates).set({ revokedAt: new Date() }).where(eq(certificates.serial, cert.serial));
    await notifyPartner(r.distributorId!, "certificate.released", {
      external_id: r.externalId,
      course: r.courseSlug,
      batch: r.batch,
      serial: cert.serial,
      issued_at: cert.issuedAt.toISOString(),
      image_url: `${SITE_URL}/api/certificates/${cert.serial}/image`,
      verify_url: `${SITE_URL}/verify/${cert.serial}`,
    });
  }
  return issued;
}

export type LearnerCourse = Omit<LearnerCertificate, "completedAt"> & {
  enrolledAt: Date;
  completedAt: Date | null;
  cancelled: boolean;
  soldBy: string | null;
  centre: string | null;
  expiresAt: Date | null;
};

const partnerEnrollmentRows = (userId: string, where: SQL | undefined, orderBy: SQL) =>
  db
    .select({
      courseSlug: courses.slug,
      courseTitle: courses.title,
      certificateEnabled: courses.certificateEnabled,
      batch: distributorBatches.name,
      paidAt: distributorBatches.paidAt,
      enrolledAt: enrollments.startedAt,
      completedAt: enrollments.completedAt,
      enrolmentStatus: enrollments.status,
      soldBy: enrollments.soldBy,
      centre: enrollments.centre,
      expiresAt: enrollments.expiresAt,
      mode: distributors.certificateRelease,
      certificate: certificates,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(distributors, eq(distributors.id, enrollments.distributorId))
    .leftJoin(distributorBatches, eq(distributorBatches.id, enrollments.batchId))
    .leftJoin(certificates, certificateOfEnrollment)
    .where(and(eq(enrollments.userId, userId), eq(enrollments.source, "distributor"), where))
    .orderBy(orderBy);

/** Every course the learner is enrolled in, completed or not, oldest enrolment first. */
export async function learnerCourses(userId: string): Promise<LearnerCourse[]> {
  const rows = await partnerEnrollmentRows(userId, undefined, asc(enrollments.startedAt));
  return rows.map((r) => ({
    courseSlug: r.courseSlug,
    courseTitle: r.courseTitle,
    batch: r.batch,
    enrolledAt: r.enrolledAt,
    completedAt: r.completedAt,
    cancelled: r.enrolmentStatus !== "active",
    soldBy: r.soldBy,
    centre: r.centre,
    expiresAt: r.expiresAt,
    certificate: r.certificate,
    status: certificateStatus(r),
  }));
}

/** The learner's completed partner courses (or one course) with batch and certificate status. */
export async function learnerCertificates(userId: string, courseId?: string): Promise<LearnerCertificate[]> {
  const rows = await partnerEnrollmentRows(
    userId,
    and(eq(enrollments.status, "active"), isNotNull(enrollments.completedAt), courseId ? eq(enrollments.courseId, courseId) : undefined),
    asc(enrollments.completedAt),
  );
  return rows.map((r) => ({
    courseSlug: r.courseSlug,
    courseTitle: r.courseTitle,
    batch: r.batch,
    completedAt: r.completedAt!,
    certificate: r.certificate,
    status: certificateStatus(r),
  }));
}

/** The client's batch with this name, created on first use. v2 (`anyCase`) matches names case-insensitively. */
async function batchNamed(distributorId: string, name: string, anyCase = false): Promise<DistributorBatch> {
  if (anyCase) {
    const [same] = await db
      .select()
      .from(distributorBatches)
      .where(and(eq(distributorBatches.distributorId, distributorId), sql`lower(${distributorBatches.name}) = lower(${name})`))
      .orderBy(asc(distributorBatches.createdAt))
      .limit(1);
    if (same) return same;
  }
  await db.insert(distributorBatches).values({ distributorId, name }).onConflictDoNothing();
  const [batch] = await db
    .select()
    .from(distributorBatches)
    .where(and(eq(distributorBatches.distributorId, distributorId), eq(distributorBatches.name, name)));
  return batch;
}

const hasCertificate = async (userId: string, courseId: string) =>
  (await db.select({ serial: certificates.serial }).from(certificates).where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)))).length > 0;

/**
 * Records that the client's learner completed the course, in the named batch (created on first
 * use), and releases the certificate if the client's mode allows it. Safe to repeat; once the
 * certificate is released, a repeat changes nothing.
 */
export async function recordCompletion(
  distributorId: string,
  learner: Learner,
  courseId: string,
  input: Pick<CompletionInput, "batch" | "completedAt">,
): Promise<LearnerCertificate> {
  const certified = await hasCertificate(learner.userId, courseId);
  const [done] = certified
    ? await db
        .select({ id: enrollments.id })
        .from(enrollments)
        .where(and(eq(enrollments.userId, learner.userId), eq(enrollments.courseId, courseId), completedPartnerEnrollment))
    : [];
  if (!done) {
    const batch = await batchNamed(distributorId, input.batch!); // v2 callers resolve a missing batch first
    const values = { distributorId, batchId: batch.id, completedAt: input.completedAt, source: "distributor" as const };
    // A certificate already out (an undo lost the race with a release): record the completion
    // but never move the enrolment to another batch.
    const set = certified
      ? {
          ...values,
          completedAt: sql`coalesce(${enrollments.completedAt}, ${input.completedAt.toISOString()}::timestamptz)`,
          batchId: sql`coalesce(${enrollments.batchId}, ${batch.id})`,
        }
      : values;
    const [enrollment] = await db
      .insert(enrollments)
      .values({ userId: learner.userId, courseId, ...values })
      .onConflictDoUpdate({ target: [enrollments.userId, enrollments.courseId], set })
      .returning({ id: enrollments.id });
    if (!certified) await releaseCertificates([enrollment.id]);
  }
  return (await learnerCertificates(learner.userId, courseId))[0];
}

export type EnrolmentFields = Omit<EnrolmentInput, "courseSlug">;
export type PartnerRefusal = "not_enrolled" | "batch_closed" | "batch_mismatch" | "batch_required";

const enrolmentOf = (userId: string, courseId: string) =>
  db
    .select({ id: enrollments.id, status: enrollments.status, completedAt: enrollments.completedAt, batch: distributorBatches })
    .from(enrollments)
    .leftJoin(distributorBatches, eq(distributorBatches.id, enrollments.batchId))
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId), eq(enrollments.source, "distributor")))
    .then((rows) => rows[0]);

/**
 * Enrols the client's learner in the course (re-activating a cancelled enrolment). Safe to repeat:
 * a repeat updates the given fields, and a `batch` moves the learner there until the course is
 * completed or certified. v2 (`strict`) matches batch names case-insensitively and refuses
 * (batch_closed) to put anyone into, or move anyone out of, a paid batch.
 */
export async function enrolLearner(
  distributorId: string,
  learner: Learner,
  courseId: string,
  input: EnrolmentFields,
  { strict = false } = {},
): Promise<{ created: boolean } | { refused: PartnerRefusal }> {
  const batch = input.batch ? await batchNamed(distributorId, input.batch, strict) : null;
  if (strict && batch?.paidAt) return { refused: "batch_closed" };
  const fields = {
    ...(input.soldBy && { soldBy: input.soldBy }),
    ...(input.centre && { centre: input.centre }),
    ...(input.expiresAt && { expiresAt: input.expiresAt }),
  };
  const [created] = await db
    .insert(enrollments)
    .values({
      userId: learner.userId,
      courseId,
      source: "distributor",
      distributorId,
      batchId: batch?.id ?? null,
      ...fields,
      ...(input.enrolledAt && { startedAt: input.enrolledAt }),
    })
    .onConflictDoNothing({ target: [enrollments.userId, enrollments.courseId] })
    .returning({ id: enrollments.id });
  if (created) return { created: true };

  const existing = await enrolmentOf(learner.userId, courseId);
  const set: Partial<typeof enrollments.$inferInsert> = { ...fields };
  if (existing.status !== "active") Object.assign(set, { status: "active", cancelledAt: null, cancelReason: null });
  if (batch && batch.id !== existing.batch?.id) {
    const settled = existing.completedAt !== null || (await hasCertificate(learner.userId, courseId));
    if (strict && (settled || existing.batch?.paidAt)) return { refused: "batch_closed" };
    if (!settled) set.batchId = batch.id;
  }
  if (Object.keys(set).length) await db.update(enrollments).set(set).where(eq(enrollments.id, existing.id));
  return { created: false };
}

/**
 * v2 completions: the learner must be enrolled, and the completion goes in the enrolment's batch.
 * Returns the batch name to record the completion in, or why it is refused.
 */
export async function completionBatch(
  distributorId: string,
  learner: Learner,
  courseId: string,
  given: string | null,
): Promise<{ batch: string } | { refused: PartnerRefusal }> {
  const enrolment = await enrolmentOf(learner.userId, courseId);
  if (!enrolment || enrolment.status !== "active") return { refused: "not_enrolled" };
  if (enrolment.batch) {
    if (given && given.toLowerCase() !== enrolment.batch.name.toLowerCase()) return { refused: "batch_mismatch" };
    return { batch: enrolment.batch.name };
  }
  if (!given) return { refused: "batch_required" };
  const batch = await batchNamed(distributorId, given, true);
  return batch.paidAt ? { refused: "batch_closed" } : { batch: batch.name };
}

/** Cancels (for a refund, say) an enrolment. Refused once its certificate is out: revoke that first. */
export async function cancelEnrolment(
  userId: string,
  courseId: string,
  reason: string | null,
): Promise<"cancelled" | "not_enrolled" | "certificate_released"> {
  const [cert] = await db
    .select({ revokedAt: certificates.revokedAt })
    .from(certificates)
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)));
  if (cert && !cert.revokedAt) return "certificate_released";
  const done = await db
    .update(enrollments)
    .set({ status: "revoked", cancelledAt: new Date(), cancelReason: reason })
    .where(
      and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId), eq(enrollments.source, "distributor"), eq(enrollments.status, "active")),
    )
    .returning({ distributorId: enrollments.distributorId, cancelledAt: enrollments.cancelledAt });
  if (!done.length) return "not_enrolled";
  const [who] = await db
    .select({ externalId: partnerLearners.externalId, courseSlug: courses.slug })
    .from(partnerLearners)
    .innerJoin(courses, eq(courses.id, courseId))
    .where(eq(partnerLearners.userId, userId));
  await notifyPartner(done[0].distributorId!, "enrolment.cancelled", {
    external_id: who?.externalId,
    course: who?.courseSlug,
    reason,
    cancelled_at: done[0].cancelledAt?.toISOString(),
  });
  return "cancelled";
}

const activeEnrolment = (userId: string, courseId: string, now: Date) =>
  and(
    eq(enrollments.userId, userId),
    eq(enrollments.courseId, courseId),
    eq(enrollments.status, "active"),
    or(isNull(enrollments.expiresAt), sql`${enrollments.expiresAt} > ${now.toISOString()}::timestamptz`),
  );

/** Whether the learner may watch the course now (active, unexpired enrolment); notes the play if so. */
export async function notePlay(userId: string, courseId: string, now = new Date()): Promise<boolean> {
  const played = await db
    .update(enrollments)
    .set({ lastPlayedAt: now })
    .where(activeEnrolment(userId, courseId, now))
    .returning({ id: enrollments.id });
  return played.length > 0;
}

/** Whether the learner has an active, unexpired enrolment in the course (v2 live classes). */
export async function isEnrolled(userId: string, courseId: string, now = new Date()): Promise<boolean> {
  const rows = await db.select({ id: enrollments.id }).from(enrollments).where(activeEnrolment(userId, courseId, now)).limit(1);
  return rows.length > 0;
}

/** Revokes the learner's certificate for the course. The verify page then says it was revoked. */
export async function revokeCertificate(userId: string, courseId: string): Promise<"revoked" | "not_issued"> {
  const [cert] = await db
    .update(certificates)
    .set({ revokedAt: sql`coalesce(${certificates.revokedAt}, now())` })
    .where(and(eq(certificates.userId, userId), eq(certificates.courseId, courseId)))
    .returning({ serial: certificates.serial });
  return cert ? "revoked" : "not_issued";
}

/** Takes back a mistaken completion. Refused once the certificate is out (revoke it instead). */
export async function undoCompletion(userId: string, courseId: string): Promise<"undone" | "not_completed" | "released"> {
  // One statement, so a release cannot slip in between the certificate check and the update.
  const undone = await db
    .update(enrollments)
    .set({ completedAt: null }) // the batch stays: the learner is still enrolled in it
    .where(
      and(
        eq(enrollments.userId, userId),
        eq(enrollments.courseId, courseId),
        completedPartnerEnrollment,
        notExists(db.select({ one: sql`1` }).from(certificates).where(certificateOfEnrollment)),
      ),
    )
    .returning({ id: enrollments.id });
  if (undone.length) return "undone";
  return (await hasCertificate(userId, courseId)) ? "released" : "not_completed";
}

export async function batchEnrollmentIds(batchId: string): Promise<string[]> {
  const rows = await db.select({ id: enrollments.id }).from(enrollments).where(eq(enrollments.batchId, batchId));
  return rows.map((r) => r.id);
}

/** The admin's "Payment received" toggle. Logs the flip; turning it on releases what it can. */
export async function setBatchPaid(batchId: string, paid: boolean, by: string): Promise<number> {
  await db.transaction(async (tx) => {
    await tx
      .update(distributorBatches)
      .set(paid ? { paidAt: new Date(), paidBy: by } : { paidAt: null, paidBy: null })
      .where(eq(distributorBatches.id, batchId));
    await tx.insert(batchPaymentEvents).values({ batchId, paid, by });
  });
  if (!paid) return 0;
  const released = await releaseCertificates(await batchEnrollmentIds(batchId));
  const [batch] = await db.select().from(distributorBatches).where(eq(distributorBatches.id, batchId));
  await notifyPartner(batch.distributorId, "batch.paid", { batch: batch.name, paid_at: batch.paidAt?.toISOString(), released });
  return released;
}

/** Changes when the client's certificates are issued, then releases whatever the new mode allows. */
export async function setReleaseMode(distributorId: string, mode: CertificateReleaseMode): Promise<number> {
  await db.update(distributors).set({ certificateRelease: mode }).where(eq(distributors.id, distributorId));
  return releaseWhere(eq(enrollments.distributorId, distributorId));
}

export function listBatches(distributorId: string) {
  return db
    .select({
      batch: distributorBatches,
      learners: sql<number>`count(distinct ${enrollments.userId})::int`,
      completed: sql<number>`count(${enrollments.completedAt})::int`,
      released: sql<number>`count(${certificates.serial}) filter (where ${certificates.revokedAt} is null)::int`,
      // Completed, certificate course, no certificate yet: what "Generate" would issue.
      waiting: sql<number>`count(*) filter (where ${enrollments.completedAt} is not null and ${courses.certificateEnabled} and ${certificates.serial} is null)::int`,
    })
    .from(distributorBatches)
    // Cancelled (refunded) enrolments are not billed, so they don't count.
    .leftJoin(enrollments, and(eq(enrollments.batchId, distributorBatches.id), eq(enrollments.status, "active")))
    .leftJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(certificates, certificateOfEnrollment)
    .where(eq(distributorBatches.distributorId, distributorId))
    .groupBy(distributorBatches.id)
    .orderBy(desc(distributorBatches.createdAt));
}

/** Completed enrolments in certificate courses that have no certificate yet. */
export async function waitingCertificates(distributorId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(certificates, certificateOfEnrollment)
    .where(
      and(eq(enrollments.distributorId, distributorId), completedPartnerEnrollment, eq(courses.certificateEnabled, true), isNull(certificates.serial)),
    );
  return row.n;
}

/** One batch's learners for the admin drill-down. */
export function batchLearners(batchId: string) {
  return db
    .select({
      enrollmentId: enrollments.id,
      userId: enrollments.userId,
      externalId: partnerLearners.externalId,
      name: user.name,
      courseTitle: courses.title,
      completedAt: enrollments.completedAt,
      certificate: certificates,
    })
    .from(enrollments)
    .innerJoin(partnerLearners, eq(partnerLearners.userId, enrollments.userId))
    .innerJoin(user, eq(user.id, enrollments.userId))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .leftJoin(certificates, certificateOfEnrollment)
    .where(eq(enrollments.batchId, batchId))
    .orderBy(asc(user.name));
}

/**
 * Admin name correction for a partner learner: the account name and the printed name on their
 * valid certificates (the name is not part of the hash, so they still verify).
 */
export async function renameLearner(userId: string, name: string): Promise<boolean> {
  const [learner] = await db.select({ userId: partnerLearners.userId }).from(partnerLearners).where(eq(partnerLearners.userId, userId));
  if (!learner) return false;
  await db.update(user).set({ name }).where(eq(user.id, userId));
  await db.update(certificates).set({ holderName: name }).where(and(eq(certificates.userId, userId), isNull(certificates.revokedAt)));
  return true;
}

export type PartnerStats = { learners: number; completions: number; released: number; waiting: number; unpaidBatches: number };

/**
 * Per client: learners created over the API, completions reported, certificates released (not
 * revoked), completions still waiting for a certificate, and unpaid batches that have completions.
 */
export async function partnerStats(): Promise<Map<string, PartnerStats>> {
  const rows = await db.execute<{ id: string } & PartnerStats>(sql`
    select d.id,
      (select count(*) from ${partnerLearners} pl where pl.distributor_id = d.id)::int as learners,
      (select count(*) from ${enrollments} e
        where e.distributor_id = d.id and e.source = 'distributor' and e.completed_at is not null)::int as completions,
      (select count(*) from ${enrollments} e
        join ${certificates} c on c.user_id = e.user_id and c.course_id = e.course_id and c.revoked_at is null
        where e.distributor_id = d.id and e.source = 'distributor')::int as released,
      (select count(*) from ${enrollments} e
        join ${courses} co on co.id = e.course_id and co.certificate_enabled
        where e.distributor_id = d.id and e.source = 'distributor' and e.completed_at is not null
          and not exists (select 1 from ${certificates} c where c.user_id = e.user_id and c.course_id = e.course_id))::int as waiting,
      (select count(*) from ${distributorBatches} b
        where b.distributor_id = d.id and b.paid_at is null
          and exists (select 1 from ${enrollments} e where e.batch_id = b.id and e.completed_at is not null))::int as "unpaidBatches"
    from ${distributors} d`);
  return new Map(
    [...rows].map(({ id, learners, completions, released, waiting, unpaidBatches }) => [
      id,
      { learners, completions, released, waiting, unpaidBatches },
    ]),
  );
}

// --- Listings for the client ----------------------------------------------------
// Keyset pagination: `cursor` is the last item's sort key from the previous page.

export const MAX_PAGE = 500;

/** The client's learners by external id, optionally only those changed since a time. */
export function listLearners(distributorId: string, { cursor, limit, updatedSince }: { cursor?: string; limit: number; updatedSince?: Date }) {
  return db
    .select({ learner: partnerLearners, name: user.name })
    .from(partnerLearners)
    .innerJoin(user, eq(user.id, partnerLearners.userId))
    .where(
      and(
        eq(partnerLearners.distributorId, distributorId),
        isNull(partnerLearners.deletedAt),
        cursor ? gt(partnerLearners.externalId, cursor) : undefined,
        updatedSince ? gt(partnerLearners.updatedAt, updatedSince) : undefined,
      ),
    )
    .orderBy(asc(partnerLearners.externalId))
    .limit(limit);
}

/** One of the client's batches with its enrolments (cancelled ones included, flagged), by enrolment id. */
export async function batchMembers(
  distributorId: string,
  name: string,
  { cursor, limit, soldBy }: { cursor?: string; limit: number; soldBy?: string },
) {
  const [batch] = await db
    .select()
    .from(distributorBatches)
    .where(and(eq(distributorBatches.distributorId, distributorId), eq(distributorBatches.name, name)));
  if (!batch) return null;
  const rows = await db
    .select({
      id: enrollments.id,
      externalId: partnerLearners.externalId,
      courseSlug: courses.slug,
      status: enrollments.status,
      soldBy: enrollments.soldBy,
      centre: enrollments.centre,
      enrolledAt: enrollments.startedAt,
      completedAt: enrollments.completedAt,
      cancelledAt: enrollments.cancelledAt,
      certificate: certificates,
      certificateEnabled: courses.certificateEnabled,
      mode: sql<CertificateReleaseMode>`${distributors.certificateRelease}`,
    })
    .from(enrollments)
    .innerJoin(partnerLearners, eq(partnerLearners.userId, enrollments.userId))
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(distributors, eq(distributors.id, enrollments.distributorId))
    .leftJoin(certificates, certificateOfEnrollment)
    .where(
      and(
        eq(enrollments.batchId, batch.id),
        cursor ? gt(enrollments.id, cursor) : undefined,
        soldBy ? eq(enrollments.soldBy, soldBy) : undefined,
      ),
    )
    .orderBy(asc(enrollments.id))
    .limit(limit);
  return { batch, rows: rows.map((r) => ({ ...r, certificateStatus: certificateStatus({ ...r, paidAt: batch.paidAt }) })) };
}

/** Serials of the learner's valid certificates printed with a different name than `name`. */
export async function certificatesNamedOtherwise(userId: string, name: string): Promise<string[]> {
  const rows = await db
    .select({ serial: certificates.serial })
    .from(certificates)
    .where(and(eq(certificates.userId, userId), isNull(certificates.revokedAt), ne(certificates.holderName, name)));
  return rows.map((r) => r.serial);
}

/**
 * Erases a learner at the client's request: name, email and phone go, their certificates are
 * revoked (the verify page keeps answering "revoked", without the name), and the external id is
 * freed. Enrolments stay, anonymous, for billing.
 */
export async function eraseLearner(distributorId: string, externalId: string): Promise<boolean> {
  const learner = await findLearner(distributorId, externalId);
  if (!learner) return false;
  await db.transaction(async (tx) => {
    await tx.update(user).set({ name: "Erased learner" }).where(eq(user.id, learner.userId));
    await tx
      .update(certificates)
      .set({ holderName: "", revokedAt: sql`coalesce(${certificates.revokedAt}, now())` })
      .where(eq(certificates.userId, learner.userId));
    await tx
      .update(partnerLearners)
      .set({ externalId: `erased:${learner.userId}`, email: null, phone: null, deletedAt: new Date() })
      .where(and(eq(partnerLearners.distributorId, distributorId), eq(partnerLearners.externalId, externalId)));
  });
  return true;
}

/** Tells every partner licensed to the course (all courses, or picked) that it changed. */
export async function notifyCourseUpdated(courseId: string) {
  const [course] = await db.select({ slug: courses.slug, status: courses.status, updatedAt: courses.updatedAt }).from(courses).where(eq(courses.id, courseId));
  if (!course || course.status !== "published") return;
  const licensed = await db
    .selectDistinct({ id: distributors.id })
    .from(distributors)
    .leftJoin(distributorCourses, and(eq(distributorCourses.distributorId, distributors.id), eq(distributorCourses.courseId, courseId)))
    .where(and(isNull(distributors.sandboxOf), eq(distributors.status, "active"), or(eq(distributors.allCourses, true), isNotNull(distributorCourses.courseId))));
  for (const d of licensed) await notifyPartner(d.id, "course.updated", { course: course.slug, updated_at: course.updatedAt.toISOString() });
}
