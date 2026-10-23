# Partner Learners, Completions and Certificate Release: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a licensed client create learners, report course completions, and fetch our co-branded certificates over `/api/v1`. Certificates are released under a per-client mode the admin controls (after payment, on completion, or manual), with a per-batch "Payment received" toggle and "Generate now" buttons.

**Architecture:** All domain logic lives in one new module, `src/lib/lms/partners.ts`, tested against a real Postgres. Thin route handlers under `src/app/api/v1/learners/…`, `/completions/bulk` and `/batches` call it through shared helpers in `src/app/api/v1/_learners.ts`. Certificates reuse the existing `issueOrGetCertificate` (idempotent) and the on-demand PNG and verify page, both gaining a co-brand line. Admin UI is a new page, `/admin/distributors/[id]`.

**Tech Stack:** Next.js 16 App Router (read `node_modules/next/dist/docs/` before using any Next API), Drizzle ORM + postgres.js, `node --test` with native TypeScript, Tailwind v4.

**Spec:** `docs/superpowers/specs/2026-10-23-partner-learners-design.md`

## Global Constraints

- Follow `docs/lms-foundation.md`.
  - Schema changes only through a new Drizzle migration: edit `src/db/schema.ts`, run `npm run db:generate`, never hand-edit old migrations.
  - No `proxy.ts`/middleware.
- Files under `src/lib/**` and `src/db/**` import each other with **relative paths ending in `.ts`**, so `node --test` can load them. Only app code (`src/app/**`) uses the `@/` alias.
- v1 API rules from `docs/distributor-api.md`:
  - Bearer key via `withDistributor`, JSON responses with `Cache-Control: no-store`.
  - Errors are `{ "error": { "code", "message" } }`.
  - Anything not the caller's answers 404.
  - Within v1 we only add things.
- Placeholder email for partner users: `p-<uuid>@learners.invalid`.
- Release modes, verbatim: `on_payment` (default) | `on_completion` | `manual`.
- Certificate statuses, verbatim: `pending_payment` | `pending_release` | `released` | `revoked` | `not_offered`.
- Error codes, verbatim: `invalid_request` (400), `learner_not_found` (404), `not_found` (404), `not_completed` (404), `payment_pending` (402), `certificate_pending` (409), `certificate_not_offered` (409), `certificate_released` (409).
- Partner certificates: `search_visible = false` and `partner_name` = the client's `certificate_name` at issue.
- Co-brand line, verbatim: `Delivered in partnership with <partner_name>`.
- Name: 1–120 chars. Batch: 1–100 chars. External id: 1–200 chars, no leading or trailing spaces. Bulk: 1–500 items.
- Tests run with `DATABASE_URL=postgres://localhost/indus_lms npm test`, against local Postgres only, never production.

**Before Task 1:** the working tree on branch `lms` may hold uncommitted AWS hosting work (`Dockerfile`, `infra/`, `scripts/deploy-aws.sh`, `docs/aws-hosting.md`, and so on). Don't include those files in this feature's commits. Stage only the files each task lists.

---

### Task 1: Schema, migration and certificate issue options

**Files:**
- Modify: `src/db/schema.ts`. Enums near line 34, `distributors` at line 242, a new table after `distributorCourses` (~line 266), `enrollments` at line 268, `certificates` at line 315, types at the end.
- Create: `drizzle/0014_partner_learners.sql` (generated) plus `drizzle/meta/0014_snapshot.json` and a `_journal.json` update (generated)
- Modify: `src/lib/lms/certificates.ts:70-96` (`issueOrGetCertificate`)

**Interfaces:**
- Produces:
  - Tables `distributorBatches`, `batchPaymentEvents`, `partnerLearners`
  - Columns `distributors.certificateName: string | null` and `distributors.certificateRelease: CertificateReleaseMode`
  - Columns `enrollments.batchId: string | null` and `enrollments.completedAt: Date | null`
  - Column `certificates.partnerName: string | null`
  - Exports `certificateReleaseModes`, `CertificateReleaseMode`, `PartnerLearner`, `DistributorBatch`
  - `issueOrGetCertificate(userId, courseId, opts?: { partnerName?: string | null; searchVisible?: boolean })`

- [ ] **Step 1: Add the enum.** In `src/db/schema.ts`, after `export const bookingStatuses = …` add:

```ts
export const certificateReleaseModes = ["on_payment", "on_completion", "manual"] as const;
```

After `export type DistributorStatus = …` add:

```ts
export type CertificateReleaseMode = (typeof certificateReleaseModes)[number];
```

- [ ] **Step 2: Add columns to `distributors`.** Insert before `createdAt: createdAt(),` in the `distributors` table:

```ts
  // Printed on co-branded certificates ("Delivered in partnership with …"); null = plain.
  certificateName: text("certificate_name"),
  // When partner learners' certificates are issued (docs/distributor-api.md).
  certificateRelease: text("certificate_release", { enum: certificateReleaseModes }).notNull().default("on_payment"),
```

- [ ] **Step 3: Add the three new tables.** Insert right after the `distributorCourses` table definition (they must come before `enrollments`, which references `distributorBatches`):

```ts
// A client's group of learners whose certificates are paid for together. Created on first use.
export const distributorBatches = pgTable(
  "distributor_batches",
  {
    id: id(),
    distributorId: uuid("distributor_id")
      .notNull()
      .references(() => distributors.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    paidAt: ts("paid_at"), // set = paid
    paidBy: text("paid_by"), // admin email
    createdAt: createdAt(),
  },
  (t) => [unique("distributor_batches_distributor_id_name_unique").on(t.distributorId, t.name)],
);

/** Every flip of a batch's "Payment received" toggle. */
export const batchPaymentEvents = pgTable("batch_payment_events", {
  id: id(),
  batchId: uuid("batch_id")
    .notNull()
    .references(() => distributorBatches.id, { onDelete: "cascade" }),
  paid: boolean("paid").notNull(),
  by: text("by").notNull(),
  at: ts("at").notNull().defaultNow(),
});

// A client's learner: their user id on the client's platform, mapped to our own user row.
// Never merged with direct customers, even on the same email.
export const partnerLearners = pgTable(
  "partner_learners",
  {
    distributorId: uuid("distributor_id")
      .notNull()
      .references(() => distributors.id, { onDelete: "cascade" }),
    externalId: text("external_id").notNull(),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    email: text("email"), // contact only; never used to sign in or to match accounts
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [primaryKey({ columns: [t.distributorId, t.externalId] })],
);
```

- [ ] **Step 4: Add columns to `enrollments` and `certificates`.** In `enrollments`, after the `distributorId` line, add:

```ts
    batchId: uuid("batch_id").references(() => distributorBatches.id), // partner enrolments
    completedAt: ts("completed_at"), // partner enrolments: the completion the client reported
```

In `certificates`, after `searchVisible`, add:

```ts
    partnerName: text("partner_name"), // snapshot of distributors.certificate_name at issue; not hashed
```

At the end of the file, next to the other `$inferSelect` types, add:

```ts
export type PartnerLearner = typeof partnerLearners.$inferSelect;
export type DistributorBatch = typeof distributorBatches.$inferSelect;
```

- [ ] **Step 5: Generate the migration.**

Run: `npx drizzle-kit generate --name partner_learners`
Expected: creates `drizzle/0014_partner_learners.sql`. It contains `CREATE TABLE "distributor_batches"`, `"batch_payment_events"`, `"partner_learners"`, and `ALTER TABLE … ADD COLUMN` for `certificate_name`, `certificate_release`, `batch_id`, `completed_at` and `partner_name`. If drizzle-kit asks whether a column is renamed, answer "create column".

- [ ] **Step 6: Turn on RLS for the new tables.** Migration 0006 explains why every table has RLS on with no policies. Append to the end of `drizzle/0014_partner_learners.sql`:

```sql
--> statement-breakpoint
ALTER TABLE "distributor_batches" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "batch_payment_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "partner_learners" ENABLE ROW LEVEL SECURITY;
```

- [ ] **Step 7: Apply the migration locally.**

Run: `npm run db:migrate`
Expected: exits 0. `psql indus_lms -c '\d partner_learners'` shows the table.

- [ ] **Step 8: Let `issueOrGetCertificate` take partner options.** In `src/lib/lms/certificates.ts`, replace the `issueOrGetCertificate` signature and its insert:

```ts
/**
 * issueCertificate, also saying whether this call minted it (`issued`) or it already existed.
 * `partnerName` and `searchVisible` apply only when this call mints it (partner certificates
 * are co-branded and kept out of the sitemap).
 */
export async function issueOrGetCertificate(
  userId: string,
  courseId: string,
  opts: { partnerName?: string | null; searchVisible?: boolean } = {},
): Promise<{ certificate: Certificate; issued: boolean }> {
```

and in the same function change the insert's `.values(...)` to:

```ts
    .values({
      ...fields,
      holderName: holder.name,
      hash: certificateHash(fields),
      partnerName: opts.partnerName ?? null,
      searchVisible: opts.searchVisible ?? true,
    })
```

- [ ] **Step 9: Typecheck and run the existing tests.**

Run: `npx tsc --noEmit && DATABASE_URL=postgres://localhost/indus_lms npm test`
Expected: no type errors. All existing tests pass (101 at the time of writing).

- [ ] **Step 10: Commit**

```bash
git add src/db/schema.ts drizzle/0014_partner_learners.sql drizzle/meta src/lib/lms/certificates.ts
git commit -m "Partner learners: schema for learners, batches, release mode and co-branded certificates"
```

---

### Task 2: Partner learners (input parsing and upsert)

**Files:**
- Create: `src/lib/lms/partners.ts`
- Test: `src/lib/lms/partners.test.ts`

**Interfaces:**
- Consumes: the Task 1 tables.
- Produces:
  - `type Parsed<T> = { ok: true; value: T } | { ok: false; message: string }`
  - `type LearnerInput = { name: string; email: string | null }`
  - `type CompletionInput = { courseSlug: string; batch: string; completedAt: Date }`
  - `validExternalId(id: string): boolean`
  - `parseLearnerInput(body: unknown): Parsed<LearnerInput>`
  - `parseCompletionInput(body: unknown, now?: Date): Parsed<CompletionInput>`
  - `type Learner = PartnerLearner & { name: string }`
  - `findLearner(distributorId: string, externalId: string): Promise<Learner | null>`
  - `upsertLearner(distributorId: string, externalId: string, input: LearnerInput): Promise<{ learner: Learner; created: boolean }>`

- [ ] **Step 1: Write the failing tests.** Create `src/lib/lms/partners.test.ts`:

```ts
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { distributors, user } from "../../db/schema.ts";
import { findLearner, parseCompletionInput, parseLearnerInput, upsertLearner, validExternalId } from "./partners.ts";

test("validExternalId: 1–200 chars, no surrounding spaces", () => {
  assert.equal(validExternalId("u_123"), true);
  assert.equal(validExternalId(""), false);
  assert.equal(validExternalId(" u"), false);
  assert.equal(validExternalId("x".repeat(200)), true);
  assert.equal(validExternalId("x".repeat(201)), false);
});

test("parseLearnerInput: name required, email optional and checked", () => {
  assert.deepEqual(parseLearnerInput({ name: "  Asha Rao ", email: "Asha@TCS.com" }), {
    ok: true,
    value: { name: "Asha Rao", email: "asha@tcs.com" },
  });
  assert.deepEqual(parseLearnerInput({ name: "Asha" }), { ok: true, value: { name: "Asha", email: null } });
  assert.equal(parseLearnerInput({}).ok, false);
  assert.equal(parseLearnerInput({ name: "x".repeat(121) }).ok, false);
  assert.equal(parseLearnerInput({ name: "Asha", email: "nope" }).ok, false);
  assert.equal(parseLearnerInput(null).ok, false);
});

test("parseCompletionInput: course and batch required, completed_at optional, not in the future", () => {
  const now = new Date("2026-10-23T10:00:00Z");
  assert.deepEqual(parseCompletionInput({ course: "c", batch: " Jan " }, now), {
    ok: true,
    value: { courseSlug: "c", batch: "Jan", completedAt: now },
  });
  const at = parseCompletionInput({ course: "c", batch: "b", completed_at: "2026-10-01T00:00:00Z" }, now);
  assert.equal(at.ok && at.value.completedAt.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(parseCompletionInput({ batch: "b" }, now).ok, false);
  assert.equal(parseCompletionInput({ course: "c" }, now).ok, false);
  assert.equal(parseCompletionInput({ course: "c", batch: "x".repeat(101) }, now).ok, false);
  assert.equal(parseCompletionInput({ course: "c", batch: "b", completed_at: "soon" }, now).ok, false);
  assert.equal(parseCompletionInput({ course: "c", batch: "b", completed_at: "2026-10-24T00:00:00Z" }, now).ok, false);
});

// Against a real database: DATABASE_URL=postgres://localhost/indus_lms npm test
describe("partner learners", { skip: !process.env.DATABASE_URL && "DATABASE_URL not set" }, () => {
  const tag = randomUUID().slice(0, 8);
  const distributorIds: string[] = [];

  async function newDistributor() {
    const [d] = await db
      .insert(distributors)
      .values({ name: `Test ${tag}`, keyPrefix: "iaa_live_test", keyHash: randomUUID() })
      .returning();
    distributorIds.push(d.id);
    return d;
  }

  after(async () => {
    if (distributorIds.length) {
      const users = await db.query.partnerLearners.findMany({ where: (p) => inArray(p.distributorId, distributorIds) });
      await db.delete(distributors).where(inArray(distributors.id, distributorIds));
      if (users.length) await db.delete(user).where(inArray(user.id, users.map((u) => u.userId)));
    }
    await db.$client.end();
  });

  test("PUT twice: one user, created then updated", async () => {
    const d = await newDistributor();
    const first = await upsertLearner(d.id, "u_1", { name: "Asha", email: "asha@tcs.com" });
    assert.equal(first.created, true);
    assert.equal(first.learner.name, "Asha");
    const second = await upsertLearner(d.id, "u_1", { name: "Asha Rao", email: null });
    assert.equal(second.created, false);
    assert.equal(second.learner.userId, first.learner.userId);
    assert.equal(second.learner.email, null);
    const found = await findLearner(d.id, "u_1");
    assert.equal(found?.name, "Asha Rao");
    const [row] = await db.select().from(user).where(eq(user.id, first.learner.userId));
    assert.match(row.email, /^p-[0-9a-f-]{36}@learners\.invalid$/);
  });

  test("the same external id at two clients is two learners", async () => {
    const a = await newDistributor();
    const b = await newDistributor();
    const la = await upsertLearner(a.id, "same", { name: "A", email: null });
    const lb = await upsertLearner(b.id, "same", { name: "B", email: null });
    assert.notEqual(la.learner.userId, lb.learner.userId);
    assert.equal(await findLearner(a.id, "nope"), null);
  });

  test("concurrent PUTs for one new learner make one user", async () => {
    const d = await newDistributor();
    const results = await Promise.all([1, 2, 3].map(() => upsertLearner(d.id, "race", { name: "R", email: null })));
    assert.equal(new Set(results.map((r) => r.learner.userId)).size, 1);
  });
});
```

`db.query.partnerLearners` works because `src/db/index.ts` passes `{ schema }` to drizzle.

- [ ] **Step 2: Run the tests to confirm they fail.**

Run: `DATABASE_URL=postgres://localhost/indus_lms node --test src/lib/lms/partners.test.ts`
Expected: FAIL with `Cannot find module …/partners.ts`.

- [ ] **Step 3: Implement.** Create `src/lib/lms/partners.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests to confirm they pass.**

Run: `DATABASE_URL=postgres://localhost/indus_lms node --test src/lib/lms/partners.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/lms/partners.ts src/lib/lms/partners.test.ts
git commit -m "Partner learners: input parsing and idempotent learner upsert"
```

---

### Task 3: Completions, release rule, batches and statuses

**Files:**
- Modify: `src/lib/lms/partners.ts`
- Modify: `src/lib/lms/partners.test.ts`
- Modify: `src/lib/lms/lifecycle.ts`, the `sendNudges` where-clause (~line 126)

**Interfaces:**
- Consumes: `Learner`, `CompletionInput` (Task 2), `issueOrGetCertificate(userId, courseId, opts)` (Task 1).
- Produces:
  - `type CertificateStatus = "pending_payment" | "pending_release" | "released" | "revoked" | "not_offered"`
  - `releasable(mode: CertificateReleaseMode, paidAt: Date | null): boolean`
  - `certificateStatus(r: { certificate: { revokedAt: Date | null } | null; certificateEnabled: boolean; mode: CertificateReleaseMode; paidAt: Date | null }): CertificateStatus`
  - `type LearnerCertificate = { courseSlug: string; courseTitle: string; batch: string | null; completedAt: Date; certificate: Certificate | null; status: CertificateStatus }`
  - `releaseCertificates(enrollmentIds: string[], opts?: { force?: boolean }): Promise<number>`, which returns the number newly issued
  - `recordCompletion(distributorId: string, learner: Learner, courseId: string, input: Pick<CompletionInput, "batch" | "completedAt">): Promise<LearnerCertificate>`
  - `undoCompletion(userId: string, courseId: string): Promise<"undone" | "not_completed" | "released">`
  - `learnerCertificates(userId: string, courseId?: string): Promise<LearnerCertificate[]>`
  - `batchEnrollmentIds(batchId: string): Promise<string[]>`
  - `setBatchPaid(batchId: string, paid: boolean, by: string): Promise<number>`
  - `setReleaseMode(distributorId: string, mode: CertificateReleaseMode): Promise<number>`
  - `listBatches(distributorId: string): Promise<{ batch: DistributorBatch; learners: number; completed: number; released: number }[]>`
  - `waitingCertificates(distributorId: string): Promise<number>`
  - `batchLearners(batchId: string): Promise<{ enrollmentId: string; userId: string; externalId: string; name: string; courseTitle: string; completedAt: Date | null; certificate: Certificate | null }[]>`
  - `renameLearner(userId: string, name: string): Promise<boolean>`

- [ ] **Step 1: Write the failing pure tests.** Append to `src/lib/lms/partners.test.ts` above the `describe` block, and extend the import from `./partners.ts` to also include `certificateStatus, releasable`:

```ts
test("releasable: on_completion always, on_payment when paid, manual never", () => {
  const paid = new Date();
  assert.equal(releasable("on_completion", null), true);
  assert.equal(releasable("on_payment", paid), true);
  assert.equal(releasable("on_payment", null), false);
  assert.equal(releasable("manual", paid), false);
});

test("certificateStatus", () => {
  const base = { certificate: null, certificateEnabled: true, mode: "on_payment" as const, paidAt: null };
  assert.equal(certificateStatus(base), "pending_payment");
  assert.equal(certificateStatus({ ...base, mode: "manual" }), "pending_release");
  assert.equal(certificateStatus({ ...base, paidAt: new Date() }), "pending_release");
  assert.equal(certificateStatus({ ...base, certificateEnabled: false }), "not_offered");
  assert.equal(certificateStatus({ ...base, certificate: { revokedAt: null } }), "released");
  assert.equal(certificateStatus({ ...base, certificate: { revokedAt: new Date() } }), "revoked");
});
```

- [ ] **Step 2: Write the failing DB tests.** Inside the `describe("partner learners", …)` block:
- Add a helper and widen the cleanup so it removes certificates, enrolments and courses.
- Add the tests.
- Extend the file's imports: from `drizzle-orm` add `and`; from `../../db/schema.ts` add `certificates, courses, distributorCourses, enrollments`; from `./partners.ts` add `batchEnrollmentIds, learnerCertificates, listBatches, recordCompletion, releaseCertificates, renameLearner, setBatchPaid, setReleaseMode, undoCompletion, waitingCertificates`.

Replace the block's `after(...)` with:

```ts
  const courseIds: string[] = [];

  after(async () => {
    const learners = distributorIds.length
      ? await db.query.partnerLearners.findMany({ where: (p) => inArray(p.distributorId, distributorIds) })
      : [];
    const userIds = learners.map((l) => l.userId);
    if (userIds.length) {
      await db.delete(certificates).where(inArray(certificates.userId, userIds));
      await db.delete(enrollments).where(inArray(enrollments.userId, userIds));
    }
    if (distributorIds.length) await db.delete(distributors).where(inArray(distributors.id, distributorIds));
    if (userIds.length) await db.delete(user).where(inArray(user.id, userIds));
    if (courseIds.length) await db.delete(courses).where(inArray(courses.id, courseIds));
    await db.$client.end();
  });

  /** A client with one licensed course and one learner. */
  async function setup(opts: { mode?: "on_payment" | "on_completion" | "manual"; certificateEnabled?: boolean } = {}) {
    const d = await newDistributor();
    await db
      .update(distributors)
      .set({ certificateRelease: opts.mode ?? "on_payment", certificateName: "TCS" })
      .where(eq(distributors.id, d.id));
    const [course] = await db
      .insert(courses)
      .values({
        slug: `test-${tag}-${courseIds.length}`,
        title: "Test course",
        format: "standard",
        status: "published",
        certificateEnabled: opts.certificateEnabled ?? true,
      })
      .returning();
    courseIds.push(course.id);
    await db.insert(distributorCourses).values({ distributorId: d.id, courseId: course.id });
    const { learner } = await upsertLearner(d.id, "u_1", { name: "Asha Rao", email: null });
    return { d, course, learner };
  }
  const certRows = (userId: string) => db.select().from(certificates).where(eq(certificates.userId, userId));
```

Add these tests:

```ts
  test("on_payment: completed then paid issues once, co-branded and unlisted", async () => {
    const { d, course, learner } = await setup();
    const done = await recordCompletion(d.id, learner, course.id, { batch: "Jan", completedAt: new Date() });
    assert.equal(done.status, "pending_payment");
    assert.equal(done.batch, "Jan");
    assert.equal((await certRows(learner.userId)).length, 0);

    const [{ batch }] = await listBatches(d.id);
    assert.equal(await setBatchPaid(batch.id, true, "admin@x.com"), 1);
    const [cert] = await certRows(learner.userId);
    assert.equal(cert.partnerName, "TCS");
    assert.equal(cert.searchVisible, false);
    assert.equal(cert.holderName, "Asha Rao");
    assert.equal((await learnerCertificates(learner.userId, course.id))[0].status, "released");

    // Toggling off and on again issues nothing new.
    assert.equal(await setBatchPaid(batch.id, false, "admin@x.com"), 0);
    assert.equal(await setBatchPaid(batch.id, true, "admin@x.com"), 0);
    assert.equal((await certRows(learner.userId)).length, 1);
    const events = await db.query.batchPaymentEvents.findMany({ where: (e) => eq(e.batchId, batch.id) });
    assert.deepEqual(events.map((e) => e.paid).sort(), [false, true, true]);
  });

  test("on_payment: paid then completed issues at completion", async () => {
    const { d, course, learner } = await setup();
    await recordCompletion(d.id, learner, course.id, { batch: "Feb", completedAt: new Date() });
    await undoCompletion(learner.userId, course.id); // leaves the batch, unpaid and empty
    const [{ batch }] = await listBatches(d.id);
    await setBatchPaid(batch.id, true, "admin@x.com");
    const done = await recordCompletion(d.id, learner, course.id, { batch: "Feb", completedAt: new Date() });
    assert.equal(done.status, "released");
    assert.match(done.certificate?.serial ?? "", /^IAA-\d{4}-\d{4,}$/);
  });

  test("on_completion issues even when the batch is unpaid", async () => {
    const { d, course, learner } = await setup({ mode: "on_completion" });
    const done = await recordCompletion(d.id, learner, course.id, { batch: "Mar", completedAt: new Date() });
    assert.equal(done.status, "released");
  });

  test("manual issues only with force", async () => {
    const { d, course, learner } = await setup({ mode: "manual" });
    const done = await recordCompletion(d.id, learner, course.id, { batch: "Apr", completedAt: new Date() });
    assert.equal(done.status, "pending_release");
    const [{ batch }] = await listBatches(d.id);
    await setBatchPaid(batch.id, true, "admin@x.com");
    assert.equal((await certRows(learner.userId)).length, 0);
    assert.equal(await releaseCertificates(await batchEnrollmentIds(batch.id), { force: true }), 1);
    assert.equal((await learnerCertificates(learner.userId))[0].status, "released");
  });

  test("force issues on an unpaid on_payment batch", async () => {
    const { d, course, learner } = await setup();
    await recordCompletion(d.id, learner, course.id, { batch: "May", completedAt: new Date() });
    const [{ batch }] = await listBatches(d.id);
    assert.equal(await releaseCertificates(await batchEnrollmentIds(batch.id), { force: true }), 1);
  });

  test("certificates switched off: nothing issued, even with force", async () => {
    const { d, course, learner } = await setup({ mode: "on_completion", certificateEnabled: false });
    const done = await recordCompletion(d.id, learner, course.id, { batch: "Jun", completedAt: new Date() });
    assert.equal(done.status, "not_offered");
    const [{ batch }] = await listBatches(d.id);
    assert.equal(await releaseCertificates(await batchEnrollmentIds(batch.id), { force: true }), 0);
  });

  test("switching to on_completion releases waiting certificates", async () => {
    const { d, course, learner } = await setup({ mode: "manual" });
    await recordCompletion(d.id, learner, course.id, { batch: "Jul", completedAt: new Date() });
    assert.equal(await waitingCertificates(d.id), 1);
    assert.equal(await setReleaseMode(d.id, "on_completion"), 1);
    assert.equal(await waitingCertificates(d.id), 0);
  });

  test("undo: allowed before release, refused after", async () => {
    const { d, course, learner } = await setup();
    await recordCompletion(d.id, learner, course.id, { batch: "Aug", completedAt: new Date() });
    assert.equal(await undoCompletion(learner.userId, course.id), "undone");
    assert.equal(await undoCompletion(learner.userId, course.id), "not_completed");
    assert.deepEqual(await learnerCertificates(learner.userId), []);
    await setReleaseMode(d.id, "on_completion");
    await recordCompletion(d.id, learner, course.id, { batch: "Aug", completedAt: new Date() });
    assert.equal(await undoCompletion(learner.userId, course.id), "released");
  });

  test("a released completion is not changed by a repeat", async () => {
    const { d, course, learner } = await setup({ mode: "on_completion" });
    const first = await recordCompletion(d.id, learner, course.id, { batch: "Sep", completedAt: new Date() });
    const again = await recordCompletion(d.id, learner, course.id, { batch: "Other", completedAt: new Date() });
    assert.equal(again.batch, "Sep");
    assert.equal(again.certificate?.serial, first.certificate?.serial);
  });

  test("listBatches counts, and renameLearner fixes released certificates", async () => {
    const { d, course, learner } = await setup({ mode: "on_completion" });
    await recordCompletion(d.id, learner, course.id, { batch: "Oct", completedAt: new Date() });
    const [row] = await listBatches(d.id);
    assert.deepEqual([row.batch.name, row.learners, row.completed, row.released], ["Oct", 1, 1, 1]);
    assert.equal(await renameLearner(learner.userId, "Asha R. Rao"), true);
    assert.equal((await certRows(learner.userId))[0].holderName, "Asha R. Rao");
    assert.equal(await renameLearner("not-a-partner-user", "X"), false);
  });
```

- [ ] **Step 3: Run the tests to confirm they fail.**

Run: `DATABASE_URL=postgres://localhost/indus_lms node --test src/lib/lms/partners.test.ts`
Expected: FAIL, because `releasable`, `certificateStatus`, `recordCompletion` and the rest aren't exported.

- [ ] **Step 4: Implement.** In `src/lib/lms/partners.ts`, replace the import lines with:

```ts
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, inArray, isNotNull, isNull, sql } from "drizzle-orm";
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
```

Then append to the file:

```ts
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
  if (!enrollmentIds.length) return 0;
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
    .where(and(inArray(enrollments.id, enrollmentIds), completedPartnerEnrollment, eq(courses.certificateEnabled, true)));
  let issued = 0;
  // ponytail: one enrolment at a time (about 4 queries each); fine for batches of hundreds.
  for (const r of rows) {
    if (!force && !releasable(r.mode, r.paidAt)) continue;
    const result = await issueOrGetCertificate(r.userId, r.courseId, { partnerName: r.partnerName, searchVisible: false });
    if (result.issued) issued++;
  }
  return issued;
}

/** The learner's completed partner courses (or one course) with batch and certificate status. */
export async function learnerCertificates(userId: string, courseId?: string): Promise<LearnerCertificate[]> {
  const rows = await db
    .select({
      courseSlug: courses.slug,
      courseTitle: courses.title,
      certificateEnabled: courses.certificateEnabled,
      batch: distributorBatches.name,
      paidAt: distributorBatches.paidAt,
      completedAt: enrollments.completedAt,
      mode: distributors.certificateRelease,
      certificate: certificates,
    })
    .from(enrollments)
    .innerJoin(courses, eq(courses.id, enrollments.courseId))
    .innerJoin(distributors, eq(distributors.id, enrollments.distributorId))
    .leftJoin(distributorBatches, eq(distributorBatches.id, enrollments.batchId))
    .leftJoin(certificates, certificateOfEnrollment)
    .where(and(eq(enrollments.userId, userId), completedPartnerEnrollment, courseId ? eq(enrollments.courseId, courseId) : undefined))
    .orderBy(asc(enrollments.completedAt));
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
  if (!(await hasCertificate(learner.userId, courseId))) {
    const batch = await batchNamed(distributorId, input.batch);
    const values = { distributorId, batchId: batch.id, completedAt: input.completedAt, source: "distributor" as const };
    const [enrollment] = await db
      .insert(enrollments)
      .values({ userId: learner.userId, courseId, ...values })
      .onConflictDoUpdate({ target: [enrollments.userId, enrollments.courseId], set: values })
      .returning({ id: enrollments.id });
    await releaseCertificates([enrollment.id]);
  }
  return (await learnerCertificates(learner.userId, courseId))[0];
}

/** Takes back a mistaken completion. Refused once the certificate is out (revoke it instead). */
export async function undoCompletion(userId: string, courseId: string): Promise<"undone" | "not_completed" | "released"> {
  if (await hasCertificate(userId, courseId)) return "released";
  const undone = await db
    .update(enrollments)
    .set({ completedAt: null, batchId: null })
    .where(and(eq(enrollments.userId, userId), eq(enrollments.courseId, courseId), completedPartnerEnrollment))
    .returning({ id: enrollments.id });
  return undone.length ? "undone" : "not_completed";
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
  const rows = await db
    .select({ id: enrollments.id })
    .from(enrollments)
    .where(and(eq(enrollments.distributorId, distributorId), completedPartnerEnrollment));
  return releaseCertificates(rows.map((r) => r.id));
}

export function listBatches(distributorId: string) {
  return db
    .select({
      batch: distributorBatches,
      learners: sql<number>`count(distinct ${enrollments.userId})::int`,
      completed: sql<number>`count(${enrollments.completedAt})::int`,
      released: sql<number>`count(${certificates.serial}) filter (where ${certificates.revokedAt} is null)::int`,
    })
    .from(distributorBatches)
    .leftJoin(enrollments, eq(enrollments.batchId, distributorBatches.id))
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
```

- [ ] **Step 5: Keep the nudge cron away from partner learners.** In `src/lib/lms/lifecycle.ts`, inside `sendNudges`'s `.where(and(…))`, add this right after `eq(enrollments.status, "active"),`:

```ts
        // Partner learners learn on the client's platform and have unreachable .invalid emails.
        ne(enrollments.source, "distributor"),
```

Add `ne` to that file's `drizzle-orm` import.

- [ ] **Step 6: Run all tests and typecheck.**

Run: `npx tsc --noEmit && DATABASE_URL=postgres://localhost/indus_lms npm test`
Expected: everything passes, including the 18 tests in `partners.test.ts`.

- [ ] **Step 7: Commit**

```bash
git add src/lib/lms/partners.ts src/lib/lms/partners.test.ts src/lib/lms/lifecycle.ts
git commit -m "Partner learners: completions, release modes, batch payment and certificate status"
```

---

### Task 4: API endpoints (learners, completions, certificates, batches)

**Files:**
- Create: `src/app/api/v1/_learners.ts`
- Create: `src/app/api/v1/learners/[externalId]/route.ts` (PUT)
- Create: `src/app/api/v1/learners/[externalId]/completions/route.ts` (POST)
- Create: `src/app/api/v1/learners/[externalId]/completions/[course]/route.ts` (DELETE)
- Create: `src/app/api/v1/learners/[externalId]/certificates/route.ts` (GET)
- Create: `src/app/api/v1/learners/[externalId]/certificates/[course]/route.ts` (GET)
- Create: `src/app/api/v1/batches/route.ts` (GET)

**Interfaces:**
- Consumes:
  - Everything exported from `@/lib/lms/partners` (Tasks 2–3)
  - `licensedCourse(distributorId, slug)` from `@/lib/distributors`
  - `getCourseBySlug(slug, { includeDrafts: true })` from `@/lib/lms/courses`
  - `json`, `apiError`, `notFound`, `withDistributor` from `./_shared`
- Produces:
  - `type Outcome<T> = { ok: true; value: T } | { ok: false; status: number; code: string; message: string }`
  - `putLearner(distributorId, externalId, body): Promise<Outcome<{ learner: Learner; created: boolean }>>`
  - `completeOne(distributorId, externalId, body, courseCache?): Promise<Outcome<LearnerCertificate>>`
  - `outcomeError(o)`
  - `learnerJson(l)`
  - `completionJson(row)`
  - `readJson(request)`

  Task 5 uses these.

- [ ] **Step 1: Shared helpers.** Create `src/app/api/v1/_learners.ts`:

```ts
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
```

- [ ] **Step 2: PUT learner.** Create `src/app/api/v1/learners/[externalId]/route.ts`:

```ts
import { json, withDistributor } from "../../_shared";
import { learnerJson, outcomeError, putLearner, readJson } from "../../_learners";

export const PUT = withDistributor(async (distributor, request, { params }: RouteContext<"/api/v1/learners/[externalId]">) => {
  const result = await putLearner(distributor.id, (await params).externalId, await readJson(request));
  if (!result.ok) return outcomeError(result);
  return json({ learner: learnerJson(result.value.learner) }, result.value.created ? 201 : 200);
});
```

- [ ] **Step 3: POST completion.** Create `src/app/api/v1/learners/[externalId]/completions/route.ts`:

```ts
import { json, withDistributor } from "../../../_shared";
import { completeOne, completionJson, outcomeError, readJson } from "../../../_learners";

export const POST = withDistributor(
  async (distributor, request, { params }: RouteContext<"/api/v1/learners/[externalId]/completions">) => {
    const result = await completeOne(distributor.id, (await params).externalId, await readJson(request));
    if (!result.ok) return outcomeError(result);
    return json({ completion: completionJson(result.value) });
  },
);
```

- [ ] **Step 4: DELETE completion.** Create `src/app/api/v1/learners/[externalId]/completions/[course]/route.ts`:

```ts
import { findLearner, undoCompletion } from "@/lib/lms/partners";
import { getCourseBySlug } from "@/lib/lms/courses";
import { apiError, withDistributor } from "../../../../_shared";
import { learnerNotFound, notCompleted } from "../../../../_learners";

export const DELETE = withDistributor(
  async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]/completions/[course]">) => {
    const { externalId, course: slug } = await params;
    const learner = await findLearner(distributor.id, externalId);
    if (!learner) return learnerNotFound();
    // Any status: the learner's own enrolment is what limits this, and a course may be archived since.
    const course = await getCourseBySlug(slug, { includeDrafts: true });
    const outcome = course ? await undoCompletion(learner.userId, course.id) : "not_completed";
    if (outcome === "not_completed") return notCompleted();
    if (outcome === "released") {
      return apiError(409, "certificate_released", "The certificate is already released. Ask us to revoke it instead.");
    }
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  },
);
```

`getCourseBySlug(slug, { includeDrafts: true })` matches the slug at any status (`src/lib/lms/courses.ts:23-33`).

- [ ] **Step 5: GET certificates (list and one).** Create `src/app/api/v1/learners/[externalId]/certificates/route.ts`:

```ts
import { findLearner, learnerCertificates } from "@/lib/lms/partners";
import { json, withDistributor } from "../../../_shared";
import { completionJson, learnerNotFound } from "../../../_learners";

export const GET = withDistributor(
  async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]/certificates">) => {
    const learner = await findLearner(distributor.id, (await params).externalId);
    if (!learner) return learnerNotFound();
    return json({ certificates: (await learnerCertificates(learner.userId)).map(completionJson) });
  },
);
```

Create `src/app/api/v1/learners/[externalId]/certificates/[course]/route.ts`:

```ts
import { findLearner, learnerCertificates } from "@/lib/lms/partners";
import { getCourseBySlug } from "@/lib/lms/courses";
import { apiError, json, withDistributor } from "../../../../_shared";
import { completionJson, learnerNotFound, notCompleted } from "../../../../_learners";

export const GET = withDistributor(
  async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]/certificates/[course]">) => {
    const { externalId, course: slug } = await params;
    const learner = await findLearner(distributor.id, externalId);
    if (!learner) return learnerNotFound();
    const course = await getCourseBySlug(slug, { includeDrafts: true });
    const [row] = course ? await learnerCertificates(learner.userId, course.id) : [];
    if (!row) return notCompleted();
    if (row.status === "pending_payment") {
      return apiError(402, "payment_pending", `Payment for batch ${row.batch} is not completed.`);
    }
    if (row.status === "pending_release") return apiError(409, "certificate_pending", "The certificate has not been released yet.");
    if (row.status === "not_offered") return apiError(409, "certificate_not_offered", "This course does not award certificates.");
    return json(completionJson(row)); // released or revoked
  },
);
```

- [ ] **Step 6: GET batches.** Create `src/app/api/v1/batches/route.ts`:

```ts
import { listBatches } from "@/lib/lms/partners";
import { json, withDistributor } from "../_shared";

export const GET = withDistributor(async (distributor) => {
  const rows = await listBatches(distributor.id);
  return json({
    batches: rows.map(({ batch, learners, completed, released }) => ({
      name: batch.name,
      paid: batch.paidAt !== null,
      paid_at: batch.paidAt?.toISOString() ?? null,
      learners,
      completed,
      released,
    })),
  });
});
```

- [ ] **Step 7: Typecheck and lint.**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. Running `next dev` once regenerates the `RouteContext` types; if `tsc` complains about unknown route keys, start `npm run dev` for a few seconds and re-run.

- [ ] **Step 8: Smoke-test against the dev server.** Create a test client and key in the local DB:

```bash
node --env-file=.env.local --input-type=module -e '
import { db } from "./src/db/index.ts";
import { courses, distributorCourses, distributors } from "./src/db/schema.ts";
import { generateApiKey } from "./src/lib/distributors.ts";
import { eq } from "drizzle-orm";
const { key, prefix, hash } = generateApiKey();
const [d] = await db.insert(distributors).values({ name: "Smoke", certificateName: "Smoke Co", keyPrefix: prefix, keyHash: hash }).returning();
const [c] = await db.select().from(courses).where(eq(courses.status, "published")).limit(1);
await db.insert(distributorCourses).values({ distributorId: d.id, courseId: c.id });
console.log(`KEY=${key} COURSE=${c.slug}`);
await db.$client.end();'
```

Then, with `npm run dev` running and `KEY`/`COURSE` exported:

```bash
B=http://localhost:3000/api/v1; H="Authorization: Bearer $KEY"
curl -s -X PUT -H "$H" -d '{"name":"Asha Rao","email":"asha@x.com"}' "$B/learners/u%20123" -w ' %{http_code}\n'
# expect 201 and "external_id":"u 123". If it shows "u%20123", wrap params.externalId in decodeURIComponent in each route.
curl -s -X POST -H "$H" -d "{\"course\":\"$COURSE\",\"batch\":\"Smoke-1\"}" "$B/learners/u%20123/completions" -w ' %{http_code}\n'
# expect 200, "status":"pending_payment"
curl -s -H "$H" "$B/learners/u%20123/certificates/$COURSE" -w ' %{http_code}\n'   # expect 402 payment_pending
curl -s -H "$H" "$B/batches"                                                     # expect Smoke-1, paid:false
curl -s -X DELETE -H "$H" "$B/learners/u%20123/completions/$COURSE" -w '%{http_code}\n'  # expect 204
curl -s -H "$H" "$B/learners/nobody/certificates" -w ' %{http_code}\n'           # expect 404 learner_not_found
curl -s -X PUT -H "$H" -d '{}' "$B/learners/u1" -w ' %{http_code}\n'             # expect 400 invalid_request
```

- [ ] **Step 9: Commit**

```bash
git add src/app/api/v1/_learners.ts src/app/api/v1/learners src/app/api/v1/batches
git commit -m "Partner API: learners, completions, certificates and batches endpoints"
```

---

### Task 5: Bulk endpoints

**Files:**
- Create: `src/app/api/v1/learners/bulk/route.ts`
- Create: `src/app/api/v1/completions/bulk/route.ts`

**Interfaces:**
- Consumes: `putLearner`, `completeOne`, `readJson` from `../../_learners` (Task 4); `json`, `apiError`, `withDistributor` from `../../_shared`.
- Produces: `POST /api/v1/learners/bulk` and `POST /api/v1/completions/bulk`, both answering `{ results: [{ index, ok, error? }] }`.

`learners/bulk` is a static segment, so Next routes it ahead of `learners/[externalId]`. That makes `bulk` unusable as a learner id; the docs in Task 7 say so.

- [ ] **Step 1: Learners bulk.** Create `src/app/api/v1/learners/bulk/route.ts`:

```ts
import { apiError, json, withDistributor } from "../../_shared";
import { putLearner, readJson } from "../../_learners";

const MAX_ITEMS = 500;

// ponytail: items run one after another (a few queries each); 500 takes a few seconds.
export const POST = withDistributor(async (distributor, request) => {
  const items = ((await readJson(request)) as { learners?: unknown } | undefined)?.learners;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
    return apiError(400, "invalid_request", `\`learners\` must be an array of 1–${MAX_ITEMS} items.`);
  }
  const results = [];
  for (const [index, item] of items.entries()) {
    const externalId = (item as { external_id?: unknown } | null)?.external_id;
    const result = await putLearner(distributor.id, typeof externalId === "string" ? externalId : "", item);
    results.push(result.ok ? { index, ok: true } : { index, ok: false, error: { code: result.code, message: result.message } });
  }
  return json({ results });
});
```

- [ ] **Step 2: Completions bulk.** Create `src/app/api/v1/completions/bulk/route.ts`:

```ts
import type { Course } from "@/db/schema";
import { apiError, json, withDistributor } from "../../_shared";
import { completeOne, readJson } from "../../_learners";

const MAX_ITEMS = 500;

export const POST = withDistributor(async (distributor, request) => {
  const items = ((await readJson(request)) as { completions?: unknown } | undefined)?.completions;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
    return apiError(400, "invalid_request", `\`completions\` must be an array of 1–${MAX_ITEMS} items.`);
  }
  const courseCache = new Map<string, Course | null>();
  const results = [];
  for (const [index, item] of items.entries()) {
    const externalId = (item as { external_id?: unknown } | null)?.external_id;
    const result = await completeOne(distributor.id, typeof externalId === "string" ? externalId : "", item, courseCache);
    results.push(
      result.ok
        ? { index, ok: true, certificate: { status: result.value.status } }
        : { index, ok: false, error: { code: result.code, message: result.message } },
    );
  }
  return json({ results });
});
```

- [ ] **Step 3: Typecheck, then smoke-test.**

Run: `npx tsc --noEmit && npm run lint`, then with the dev server and the Task 4 key:

```bash
curl -s -H "$H" -d '{"learners":[{"external_id":"b1","name":"One"},{"external_id":"b2"},{"external_id":"b3","name":"Three"}]}' "$B/learners/bulk"
# expect results: index 0 ok, index 1 ok:false invalid_request, index 2 ok
curl -s -H "$H" -d "{\"completions\":[{\"external_id\":\"b1\",\"course\":\"$COURSE\",\"batch\":\"Bulk-1\"},{\"external_id\":\"zz\",\"course\":\"$COURSE\",\"batch\":\"Bulk-1\"}]}" "$B/completions/bulk"
# expect index 0 ok with status pending_payment, index 1 learner_not_found
curl -s -H "$H" -d '{"learners":[]}' "$B/learners/bulk" -w ' %{http_code}\n'   # expect 400
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/v1/learners/bulk src/app/api/v1/completions
git commit -m "Partner API: bulk learner and completion endpoints"
```

---

### Task 6: Admin page (release mode, payment toggle, generate, rename) and co-branded certificates

**Files:**
- Create: `src/app/admin/distributors/[id]/page.tsx`
- Create: `src/app/admin/distributors/[id]/actions.ts`
- Modify: `src/app/admin/distributors/page.tsx` (add a link per client)
- Modify: `src/app/api/certificates/[serial]/image/route.tsx` (co-brand line and ETag)
- Modify: `src/app/verify/[serial]/page.tsx:113-120` (facts list)

**Interfaces:**
- Consumes:
  - `listBatches`, `waitingCertificates`, `batchLearners`, `setBatchPaid`, `setReleaseMode`, `releaseCertificates`, `batchEnrollmentIds`, `renameLearner` (Task 3)
  - `ActionForm` and `ActionState` from `@/app/admin/learners/action-form`
  - `requireAdmin` and `requireAdminApi` from `@/lib/session`
  - `isUuid` from `@/lib/distributors`
- Produces: the `/admin/distributors/[id]` page and four server actions.

- [ ] **Step 1: Server actions.** Create `src/app/admin/distributors/[id]/actions.ts`:

```ts
"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionState } from "@/app/admin/learners/action-form";
import { db } from "@/db";
import { certificateReleaseModes, distributorBatches, distributors, type CertificateReleaseMode } from "@/db/schema";
import { isUuid } from "@/lib/distributors";
import { batchEnrollmentIds, releaseCertificates, renameLearner, setBatchPaid, setReleaseMode } from "@/lib/lms/partners";
import { requireAdminApi } from "@/lib/session";

const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const certs = (n: number) => `${n} certificate${n === 1 ? "" : "s"}`;
const refresh = (distributorId: string) => revalidatePath(`/admin/distributors/${distributorId}`);

export async function saveCertificateSettings(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdminApi();
  const id = field(form, "distributorId");
  const mode = field(form, "mode") as CertificateReleaseMode;
  if (!isUuid(id) || !certificateReleaseModes.includes(mode)) return { error: "Distributor not found." };
  const certificateName = field(form, "certificateName").slice(0, 120) || null;
  await db.update(distributors).set({ certificateName }).where(eq(distributors.id, id));
  const issued = await setReleaseMode(id, mode);
  refresh(id);
  return { ok: issued ? `Saved. Issued ${certs(issued)}.` : "Saved." };
}

export async function setBatchPayment(_prev: ActionState, form: FormData): Promise<ActionState> {
  const admin = await requireAdminApi();
  const batchId = field(form, "batchId");
  if (!isUuid(batchId)) return { error: "Batch not found." };
  const [batch] = await db
    .select({ distributorId: distributorBatches.distributorId })
    .from(distributorBatches)
    .where(eq(distributorBatches.id, batchId));
  if (!batch) return { error: "Batch not found." };
  const paid = field(form, "paid") === "1";
  const issued = await setBatchPaid(batchId, paid, admin.email);
  refresh(batch.distributorId);
  return { ok: paid ? `Marked paid. Issued ${certs(issued)}.` : "Marked unpaid. Certificates already released stay valid." };
}

/** "Generate now": issues regardless of payment or mode, for one enrolment or a whole batch. */
export async function generateCertificates(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdminApi();
  const enrollmentId = field(form, "enrollmentId");
  const batchId = field(form, "batchId");
  const ids = isUuid(enrollmentId) ? [enrollmentId] : isUuid(batchId) ? await batchEnrollmentIds(batchId) : [];
  if (!ids.length) return { error: "Nothing to generate." };
  const issued = await releaseCertificates(ids, { force: true });
  refresh(field(form, "distributorId"));
  return { ok: issued ? `Issued ${certs(issued)}.` : "Nothing new to issue." };
}

export async function renameLearnerAction(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdminApi();
  const name = field(form, "name");
  if (!name || name.length > 120) return { error: "Enter a name of 1–120 characters." };
  if (!(await renameLearner(field(form, "userId"), name))) return { error: "Learner not found." };
  refresh(field(form, "distributorId"));
  return { ok: "Name updated, including released certificates." };
}
```

`requireAdminApi()` returns the session user, so `admin.email` is the admin's email (`src/lib/session.ts:42`).

- [ ] **Step 2: The page.** Create `src/app/admin/distributors/[id]/page.tsx`:

```tsx
import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/app/admin/learners/action-form";
import { db } from "@/db";
import { distributors, type CertificateReleaseMode } from "@/db/schema";
import { isUuid } from "@/lib/distributors";
import { batchLearners, listBatches, waitingCertificates } from "@/lib/lms/partners";
import { requireAdmin } from "@/lib/session";
import { generateCertificates, renameLearnerAction, saveCertificateSettings, setBatchPayment } from "./actions";

const MODES: [CertificateReleaseMode, string][] = [
  ["on_payment", "After payment (when the batch is marked paid)"],
  ["on_completion", "As soon as the learner completes"],
  ["manual", "Only when I click Generate"],
];
const when = (date: Date | null) =>
  date ? date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "–";
const button = "h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-pine";
const link = "text-sm font-medium text-pine underline underline-offset-4";

export default async function DistributorPage({ params, searchParams }: PageProps<"/admin/distributors/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [distributor] = await db.select().from(distributors).where(eq(distributors.id, id));
  if (!distributor) notFound();

  const { batch: openBatchId } = await searchParams;
  const [batches, waiting] = await Promise.all([listBatches(id), waitingCertificates(id)]);
  const openBatch = batches.find((b) => b.batch.id === openBatchId);
  const learners = openBatch ? await batchLearners(openBatch.batch.id) : [];

  return (
    <div>
      <Link href="/admin/distributors" className={link}>
        ← Distributors
      </Link>
      <h1 className="mt-4 text-3xl font-semibold tracking-[-0.03em]">{distributor.name}</h1>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Certificates</h2>
        <ActionForm
          action={saveCertificateSettings}
          confirm={
            waiting
              ? `${waiting} completed learner${waiting === 1 ? " is" : "s are"} waiting for a certificate. If the new setting allows it, they are issued now.`
              : undefined
          }
          className="mt-4 grid max-w-xl gap-4"
        >
          <input type="hidden" name="distributorId" value={id} />
          <label className="grid gap-1 text-sm">
            <span className="font-medium">Certificate name</span>
            <input
              name="certificateName"
              defaultValue={distributor.certificateName ?? ""}
              maxLength={120}
              placeholder="e.g. TCS (leave empty for our plain certificate)"
              className="h-10 rounded-xl border border-line px-3"
            />
            <span className="text-muted">Printed as “Delivered in partnership with …”.</span>
          </label>
          <fieldset className="grid gap-2 text-sm">
            <legend className="font-medium">Generate certificates</legend>
            {MODES.map(([value, label]) => (
              <label key={value} className="flex items-center gap-3">
                <input type="radio" name="mode" value={value} defaultChecked={distributor.certificateRelease === value} />
                {label}
              </label>
            ))}
          </fieldset>
          <div>
            <button className={button}>Save</button>
          </div>
        </ActionForm>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Batches</h2>
        {batches.length === 0 && <p className="mt-3 text-sm text-muted">No batches yet. They appear when the client reports completions.</p>}
        <ul className="mt-4 grid gap-3">
          {batches.map(({ batch, learners: count, completed, released }) => {
            const paid = batch.paidAt !== null;
            const waitingHere = completed - released;
            return (
              <li key={batch.id} className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-line pt-3 text-sm">
                <Link href={`?batch=${batch.id}`} className="font-semibold underline underline-offset-4">
                  {batch.name}
                </Link>
                <span>{count} learners</span>
                <span>{completed} completed</span>
                <span>{released} released</span>
                <span className="text-muted">{paid ? `Paid ${when(batch.paidAt)} by ${batch.paidBy}` : "Not paid"}</span>
                <ActionForm
                  action={setBatchPayment}
                  confirm={
                    paid
                      ? `Mark ${batch.name} as not paid? Certificates already released stay valid.`
                      : `Mark ${batch.name} as paid${distributor.certificateRelease === "on_payment" && waitingHere ? ` and release ${waitingHere} certificates` : ""}?`
                  }
                  className="flex flex-wrap items-center gap-2"
                >
                  <input type="hidden" name="batchId" value={batch.id} />
                  <input type="hidden" name="paid" value={paid ? "0" : "1"} />
                  <button className={paid ? link : button}>{paid ? "Mark not paid" : "Payment received"}</button>
                </ActionForm>
                {waitingHere > 0 && (
                  <ActionForm
                    action={generateCertificates}
                    confirm={`Generate ${waitingHere} certificates for ${batch.name} now, whether or not it is paid?`}
                    className="flex flex-wrap items-center gap-2"
                  >
                    <input type="hidden" name="distributorId" value={id} />
                    <input type="hidden" name="batchId" value={batch.id} />
                    <button className={link}>Generate {waitingHere} now</button>
                  </ActionForm>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {openBatch && (
        <section className="mt-8 rounded-2xl border border-line bg-white p-5">
          <h2 className="font-semibold">{openBatch.batch.name}: learners</h2>
          <table className="mt-4 w-full text-left text-sm">
            <thead className="font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted">
              <tr>
                <th className="py-2">Name</th>
                <th>Their id</th>
                <th>Course</th>
                <th>Completed</th>
                <th>Certificate</th>
              </tr>
            </thead>
            <tbody>
              {learners.map((l) => (
                <tr key={l.enrollmentId} className="border-t border-line align-top">
                  <td className="py-2">
                    <ActionForm action={renameLearnerAction} className="flex flex-wrap items-center gap-2">
                      <input type="hidden" name="distributorId" value={id} />
                      <input type="hidden" name="userId" value={l.userId} />
                      <input name="name" defaultValue={l.name} maxLength={120} className="h-8 rounded-lg border border-line px-2" />
                      <button className={link}>Save</button>
                    </ActionForm>
                  </td>
                  <td className="font-mono text-xs">{l.externalId}</td>
                  <td>{l.courseTitle}</td>
                  <td>{when(l.completedAt)}</td>
                  <td>
                    {l.certificate ? (
                      <a href={`/verify/${l.certificate.serial}`} className={link}>
                        {l.certificate.serial}
                        {l.certificate.revokedAt ? " (revoked)" : ""}
                      </a>
                    ) : l.completedAt ? (
                      <ActionForm action={generateCertificates} confirm={`Generate ${l.name}'s certificate now?`}>
                        <input type="hidden" name="distributorId" value={id} />
                        <input type="hidden" name="enrollmentId" value={l.enrollmentId} />
                        <button className={link}>Generate now</button>
                      </ActionForm>
                    ) : (
                      "Not completed"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Link from the list.** In `src/app/admin/distributors/page.tsx`, add `import Link from "next/link";` and put this as the first child of the `<div className="mt-4 flex flex-wrap items-start gap-6">` that holds `RotateKeyForm`:

```tsx
                <Link href={`/admin/distributors/${d.id}`} className="text-sm font-medium text-pine underline underline-offset-4">
                  Learners &amp; certificates
                </Link>
```

- [ ] **Step 4: Co-brand line on the certificate image.** In `src/app/api/certificates/[serial]/image/route.tsx`:
1. Add `cert.partnerName` to the ETag array, right after `courseTitle`, so the array starts `[cert.holderName, courseTitle, cert.partnerName, cert.issuedAt, …`.
2. Right after the `<div>` that renders `{courseTitle}` (the one with `maxWidth: 1200`), insert:

```tsx
          {cert.partnerName && (
            <div style={{ marginTop: 22, fontSize: 26, color: muted }}>{`Delivered in partnership with ${cert.partnerName}`}</div>
          )}
```

Use a single template string, as above. Satori (`ImageResponse`) rejects a `<div>` with more than one child unless it has `display: flex`.

- [ ] **Step 5: Co-brand on the verify page.** In `src/app/verify/[serial]/page.tsx`, change the facts array so `Course` is followed by the partner when there is one:

```tsx
        {[
          ["Awarded to", c.holderName || "Name not yet confirmed"],
          ["Course", r.courseTitle],
          ...(c.partnerName ? [["In partnership with", c.partnerName]] : []),
          ["Issued on", formatIssueDate(c.issuedAt)],
          ["Certificate no.", c.serial],
          ["Issued by", `${company.legalName} (CIN ${company.cin})`],
          ["Status", statusLine(r)],
        ].map(([label, value]) => (
```

- [ ] **Step 6: Typecheck, lint, then check in the browser.** Run `npx tsc --noEmit && npm run lint`.

Then with `npm run dev`, signed in as an admin (`ADMIN_EMAILS` in `.env.local`):
1. `/admin/distributors` → "Learners & certificates" on the Smoke client from Task 4 → the page shows batches `Smoke-1` and `Bulk-1`.
2. Set the certificate name to "Smoke Co", keep "After payment", and Save.
3. On `Bulk-1`, click "Payment received" and confirm → "Marked paid. Issued 1 certificate."
4. Open `?batch=…` for `Bulk-1` → learner `b1` shows a serial. Open it → `/verify/<serial>` shows "In partnership with: Smoke Co".
5. Open `/api/certificates/<serial>/image` → the PNG shows "Delivered in partnership with Smoke Co" under the course title, and the bottom row still fits.
6. Rename `b1` → the image and the verify page show the new name.
7. Switch the mode to "Only when I click Generate", report a new completion with curl, then click "Generate now" on that learner → it's issued.

- [ ] **Step 7: Commit**

```bash
git add "src/app/admin/distributors" "src/app/api/certificates/[serial]/image/route.tsx" "src/app/verify/[serial]/page.tsx"
git commit -m "Admin: per-client certificate release, batch payment toggle, generate now; co-branded certificates"
```

---

### Task 7: Partner API documentation

**Files:**
- Modify: `docs/distributor-api.md`. Update the intro (lines 1-5), add sections before `## Errors`, and extend the errors table.

**Interfaces:** documentation only. It must match the code from Tasks 4–5 exactly.

- [ ] **Step 1: Update the intro.** Replace the first paragraph with:

```markdown
For partner platforms licensed to deliver our courses. You get each licensed course's
structure, its quizzes (with answers) and short-lived signed video URLs, and you run
enrolment, progress and grading on your own platform. You tell us about your learners and
their completions, and we issue our certificate for them, co-branded with your name, when
it is released under the terms agreed with you (for example, once the batch is paid).
```

- [ ] **Step 2: Add the learner, completion, certificate and batch sections** right before `## Errors`:

````markdown
## Learners and certificates

The lifecycle:

1. A learner signs up or signs in on your platform → `PUT /learners/{your_user_id}`.
2. They finish a course → `POST /learners/{your_user_id}/completions` with the course and the batch.
3. You show their certificate → `GET /learners/{your_user_id}/certificates/{course}`. Until it is
   released (for example, until the batch is paid) this answers `402 payment_pending`.

`{your_user_id}` is your own id for the learner, URL-encoded: 1–200 characters, no leading
or trailing spaces. The id `bulk` is reserved. Learners are private to you: another partner's
key gets 404 for them.

### `PUT /learners/{external_id}`

Creates the learner or updates it. Safe to repeat. Answers 201 on create and 200 on update.

```sh
curl -X PUT -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"name":"Asha Rao","email":"asha@example.com"}' \
  https://indusai.academy/api/v1/learners/u_123
```

```json
{ "learner": { "external_id": "u_123", "name": "Asha Rao", "email": "asha@example.com", "created_at": "2026-10-23T06:20:20.865Z" } }
```

- `name` (required, 1–120 characters) is printed on the certificate. Send the learner's real name.
- `email` is optional. It is kept for contact only and never used to sign in.
- A later `PUT` replaces both fields. Certificates already released keep the name they were issued
  with; ask us to correct one.

### `POST /learners/{external_id}/completions`

```sh
curl -X POST -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"course":"ai-at-work-essentials","batch":"TCS-Jan-2027","completed_at":"2026-10-23T06:00:00Z"}' \
  https://indusai.academy/api/v1/learners/u_123/completions
```

```json
{
  "completion": {
    "course": "ai-at-work-essentials",
    "batch": "TCS-Jan-2027",
    "completed_at": "2026-10-23T06:00:00.000Z",
    "certificate": { "status": "pending_payment" }
  }
}
```

- `course`: the slug of a course licensed to you.
- `batch` (1–100 characters): your name for the group this learner is billed with. New names
  create a batch.
- `completed_at`: optional, defaults to now. It can't be in the future.
- Safe to repeat. Until the certificate is released, a repeat can move the learner to another
  batch. After release it changes nothing.
- If the certificate can be released straight away, the response already shows it as `released`.

### `DELETE /learners/{external_id}/completions/{course}`

Takes back a completion sent by mistake. Answers 204. Once the certificate is released this
answers `409 certificate_released`; ask us to revoke it instead.

### `GET /learners/{external_id}/certificates`

Every course the learner has completed:

```json
{
  "certificates": [
    {
      "course": "ai-at-work-essentials",
      "batch": "TCS-Jan-2027",
      "completed_at": "2026-10-23T06:00:00.000Z",
      "certificate": {
        "status": "released",
        "serial": "IAA-2026-0042",
        "issued_at": "2026-10-25T09:12:00.000Z",
        "image_url": "https://indusai.academy/api/certificates/IAA-2026-0042/image",
        "verify_url": "https://indusai.academy/verify/IAA-2026-0042"
      }
    }
  ]
}
```

`certificate.status`:

| Status            | Meaning                                                                 |
| ----------------- | ----------------------------------------------------------------------- |
| `pending_payment` | Waiting for payment of the learner's batch                              |
| `pending_release` | Waiting for us to release it                                            |
| `released`        | Issued. `serial`, `issued_at`, `image_url` and `verify_url` are present |
| `revoked`         | Issued, then withdrawn. The verify page says so                         |
| `not_offered`     | This course does not award certificates                                 |

- `image_url` is a PNG (1600×1131). Add `?download=1` to get it as a file download.
- `verify_url` is a public page anyone, such as an employer, can use to check the certificate.
- Both are stable. Store them, or the serial.

### `GET /learners/{external_id}/certificates/{course}`

One course, in the same shape as an item above (released or revoked). Otherwise it answers
with an error: `402 payment_pending` (the message names the batch), `409 certificate_pending`,
`409 certificate_not_offered`, or `404 not_completed`.

### `GET /batches`

```json
{ "batches": [ { "name": "TCS-Jan-2027", "paid": false, "paid_at": null, "learners": 42, "completed": 40, "released": 0 } ] }
```

### Bulk: `POST /learners/bulk` and `POST /completions/bulk`

Up to 500 items per request. Each item behaves exactly like the single call, and one bad item
doesn't stop the rest.

```sh
curl -X POST -H "Authorization: Bearer $IAA_KEY" -H "Content-Type: application/json" \
  -d '{"learners":[{"external_id":"u_1","name":"Asha Rao"},{"external_id":"u_2","name":"Ravi K"}]}' \
  https://indusai.academy/api/v1/learners/bulk
# body for /completions/bulk: {"completions":[{"external_id":"u_1","course":"…","batch":"…"}]}
```

```json
{ "results": [ { "index": 0, "ok": true }, { "index": 1, "ok": false, "error": { "code": "invalid_request", "message": "`name` is required, 1–120 characters." } } ] }
```

Completion results also carry `certificate.status` for the items that succeeded.
````

- [ ] **Step 3: Extend the errors table.** Add these rows to the table under `## Errors`:

```markdown
| 400    | `invalid_request`         | The body or learner id is invalid; `message` says what to fix          |
| 402    | `payment_pending`         | The learner's batch is not paid yet; `message` names the batch         |
| 404    | `learner_not_found`       | No learner with that id (for your key)                                 |
| 404    | `not_completed`           | The learner has not completed that course                              |
| 409    | `certificate_pending`     | The certificate has not been released yet                              |
| 409    | `certificate_not_offered` | The course does not award certificates                                 |
| 409    | `certificate_released`    | The completion can't be taken back: its certificate is released        |
```

- [ ] **Step 4: Check the docs against the code.** For each curl example, run it against the dev server with the Task 4 key and compare the real response's field names and codes with the doc. Fix the doc wherever they differ.

- [ ] **Step 5: Commit**

```bash
git add docs/distributor-api.md
git commit -m "Distributor API docs: learners, completions, certificates, batches, bulk"
```

---

## After all tasks

- Run `npx tsc --noEmit && npm run lint && DATABASE_URL=postgres://localhost/indus_lms npm test`. Everything should pass.
- Clean up the local smoke-test data:
  ```sql
  delete from certificates where user_id in (select user_id from partner_learners where distributor_id in (select id from distributors where name='Smoke'));
  delete from enrollments where distributor_id in (select id from distributors where name='Smoke');
  delete from "user" where id in (select user_id from partner_learners where distributor_id in (select id from distributors where name='Smoke'));
  delete from distributors where name='Smoke';
  ```
- Production: the user runs `DATABASE_URL=<supabase url> npm run db:migrate` before deploying (memory: production migrations need the Supabase URL), then `scripts/deploy-aws.sh`.
