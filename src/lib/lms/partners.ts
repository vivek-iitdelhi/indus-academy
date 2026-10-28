import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, notExists, sql, type SQL } from "drizzle-orm";
import { db } from "../../db/index.ts";
import {
  batchPaymentEvents,
  certificates,
  courses,
  distributorBatches,
  distributors,
  enrollments,
  partnerLearners,
  user,
  type Certificate,
  type CertificateReleaseMode,
  type DistributorBatch,
  type PartnerLearner,
} from "../../db/schema.ts";
import { issueOrGetCertificate } from "./certificates.ts";

// Partner learners: a licensed client's learners, their completions, and when their
// certificates are released (docs/superpowers/specs/2026-10-23-partner-learners-design.md).

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
export type LearnerInput = { name: string; email: string | null };
export type CompletionInput = { courseSlug: string; batch: string; completedAt: Date };
export type EnrolmentInput = { courseSlug: string; batch: string | null };
export type Learner = PartnerLearner & { name: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
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
  if (b.email == null) return { ok: true, value: { name, email: null } };
  const email = text(b.email).toLowerCase();
  if (!EMAIL_PATTERN.test(email) || email.length > 200) return { ok: false, message: "`email` must be a valid email address." };
  return { ok: true, value: { name, email } };
}

export function parseCompletionInput(body: unknown, now = new Date()): Parsed<CompletionInput> {
  const b = record(body);
  const courseSlug = text(b.course);
  if (!courseSlug) return { ok: false, message: "`course` is required: the course slug." };
  const batch = text(b.batch);
  if (!batch || batch.length > 100) return { ok: false, message: "`batch` is required, 1–100 characters." };
  if (b.completed_at == null) return { ok: true, value: { courseSlug, batch, completedAt: now } };
  const completedAt = typeof b.completed_at === "string" ? new Date(b.completed_at) : new Date(NaN);
  if (Number.isNaN(completedAt.getTime())) return { ok: false, message: "`completed_at` must be an ISO 8601 timestamp." };
  if (completedAt.getTime() > now.getTime() + FUTURE_SLACK_MS) return { ok: false, message: "`completed_at` cannot be in the future." };
  return { ok: true, value: { courseSlug, batch, completedAt } };
}

export function parseEnrolmentInput(body: unknown): Parsed<EnrolmentInput> {
  const b = record(body);
  const courseSlug = text(b.course);
  if (!courseSlug) return { ok: false, message: "`course` is required: the course slug." };
  if (b.batch == null) return { ok: true, value: { courseSlug, batch: null } };
  const batch = text(b.batch);
  if (!batch || batch.length > 100) return { ok: false, message: "`batch` must be 1–100 characters when given." };
  return { ok: true, value: { courseSlug, batch } };
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
      .set({ email: input.email })
      .where(and(eq(partnerLearners.distributorId, distributorId), eq(partnerLearners.externalId, externalId)))
      .returning();
    return { learner: { ...row, name: input.name }, created: false };
  }
  const userId = randomUUID();
  try {
    return await db.transaction(async (tx) => {
      await tx.insert(user).values({ id: userId, name: input.name, email: `p-${userId}@learners.invalid` });
      const [row] = await tx.insert(partnerLearners).values({ distributorId, externalId, userId, email: input.email }).returning();
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
const completedPartnerEnrollment = and(eq(enrollments.source, "distributor"), isNotNull(enrollments.completedAt));

/**
 * Issues certificates for these partner enrolments when they are completed, the course awards
 * certificates, and the client's mode allows it (`force`, the admin's Generate, skips the mode).
 * Idempotent: an existing certificate is never issued again. Returns how many were newly issued.
 */
export async function releaseCertificates(enrollmentIds: string[], { force = false } = {}): Promise<number> {
  return enrollmentIds.length ? releaseWhere(inArray(enrollments.id, enrollmentIds), force) : 0;
}

async function releaseWhere(which: SQL, force = false): Promise<number> {
  const rows = await db
    .select({
      userId: enrollments.userId,
      courseId: enrollments.courseId,
      paidAt: distributorBatches.paidAt,
      mode: distributors.certificateRelease,
      partnerName: distributors.certificateName,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(distributors, eq(distributors.id, enrollments.distributorId))
    .leftJoin(distributorBatches, eq(distributorBatches.id, enrollments.batchId))
    .leftJoin(certificates, certificateOfEnrollment)
    .where(and(which, completedPartnerEnrollment, eq(courses.certificateEnabled, true), isNull(certificates.serial)));
  let issued = 0;
  // ponytail: one enrolment at a time (about 4 queries each); fine for batches of hundreds.
  for (const r of rows) {
    if (!force && !releasable(r.mode, r.paidAt)) continue;
    const result = await issueOrGetCertificate(r.userId, r.courseId, { partnerName: r.partnerName, searchVisible: false });
    if (result.issued) issued++;
  }
  return issued;
}

export type LearnerCourse = Omit<LearnerCertificate, "completedAt"> & { enrolledAt: Date; completedAt: Date | null };

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
    certificate: r.certificate,
    status: certificateStatus(r),
  }));
}

/** The learner's completed partner courses (or one course) with batch and certificate status. */
export async function learnerCertificates(userId: string, courseId?: string): Promise<LearnerCertificate[]> {
  const rows = await partnerEnrollmentRows(
    userId,
    and(isNotNull(enrollments.completedAt), courseId ? eq(enrollments.courseId, courseId) : undefined),
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

async function batchNamed(distributorId: string, name: string): Promise<DistributorBatch> {
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
    const batch = await batchNamed(distributorId, input.batch);
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

/**
 * Enrols the client's learner in the course, optionally in a batch (created on first use). Safe
 * to repeat. A repeat with a batch moves the enrolment there until it is completed or certified;
 * after that the batch belongs to the completion. Returns whether the enrolment is new.
 */
export async function enrolLearner(distributorId: string, learner: Learner, courseId: string, batch: string | null): Promise<boolean> {
  const batchId = batch ? (await batchNamed(distributorId, batch)).id : null;
  const [created] = await db
    .insert(enrollments)
    .values({ userId: learner.userId, courseId, source: "distributor", distributorId, batchId })
    .onConflictDoNothing({ target: [enrollments.userId, enrollments.courseId] })
    .returning({ id: enrollments.id });
  if (!created && batchId) {
    await db
      .update(enrollments)
      .set({ batchId })
      .where(
        and(
          eq(enrollments.userId, learner.userId),
          eq(enrollments.courseId, courseId),
          isNull(enrollments.completedAt),
          notExists(db.select({ one: sql`1` }).from(certificates).where(certificateOfEnrollment)),
        ),
      );
  }
  return Boolean(created);
}

/** Takes back a mistaken completion. Refused once the certificate is out (revoke it instead). */
export async function undoCompletion(userId: string, courseId: string): Promise<"undone" | "not_completed" | "released"> {
  // One statement, so a release cannot slip in between the certificate check and the update.
  const undone = await db
    .update(enrollments)
    .set({ completedAt: null, batchId: null })
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
  return paid ? releaseCertificates(await batchEnrollmentIds(batchId)) : 0;
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
    .leftJoin(enrollments, eq(enrollments.batchId, distributorBatches.id))
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
