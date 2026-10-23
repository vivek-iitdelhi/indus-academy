import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { partnerLearners, user, type PartnerLearner } from "../../db/schema.ts";

// Partner learners: a licensed client's learners, their completions, and when their
// certificates are released (docs/superpowers/specs/2026-10-23-partner-learners-design.md).

export type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };
export type LearnerInput = { name: string; email: string | null };
export type CompletionInput = { courseSlug: string; batch: string; completedAt: Date };
export type Learner = PartnerLearner & { name: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FUTURE_SLACK_MS = 60_000; // clients' clocks drift

const record = (body: unknown): Record<string, unknown> =>
  body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : {};
const text = (value: unknown) => (typeof value === "string" ? value.trim() : "");

/** The client's user id: 1–200 characters, no leading or trailing spaces. */
export const validExternalId = (id: string) => id.length >= 1 && id.length <= 200 && id.trim() === id;

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
