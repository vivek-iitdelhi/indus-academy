import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, describe, test } from "node:test";
import { eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { certificates, courses, distributorCourses, distributors, enrollments, user } from "../../db/schema.ts";
import {
  batchEnrollmentIds,
  certificateStatus,
  enrolLearner,
  findLearner,
  learnerCertificates,
  learnerCourses,
  listBatches,
  parseCompletionInput,
  parseEnrolmentInput,
  parseLearnerInput,
  recordCompletion,
  releasable,
  releaseCertificates,
  renameLearner,
  setBatchPaid,
  partnerStats,
  setReleaseMode,
  undoCompletion,
  upsertLearner,
  validExternalId,
  waitingCertificates,
} from "./partners.ts";
import { issueOrGetCertificate } from "./certificates.ts";

// Certificates are HMAC-signed; the tests issue real ones (certificates.ts reads this at call time).
process.env.CERTIFICATE_SECRET ??= "test-only-secret";

test("validExternalId: 1–200 chars, no surrounding spaces", () => {
  assert.equal(validExternalId("u_123"), true);
  assert.equal(validExternalId(""), false);
  assert.equal(validExternalId(" u"), false);
  assert.equal(validExternalId("x".repeat(200)), true);
  assert.equal(validExternalId("x".repeat(201)), false);
  assert.equal(validExternalId("bulk"), false); // reserved: /learners/bulk is the bulk endpoint
  assert.equal(validExternalId("bulky"), true);
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

test("parseEnrolmentInput: course required, batch optional", () => {
  assert.deepEqual(parseEnrolmentInput({ course: " c " }), { ok: true, value: { courseSlug: "c", batch: null } });
  assert.deepEqual(parseEnrolmentInput({ course: "c", batch: " Jan " }), { ok: true, value: { courseSlug: "c", batch: "Jan" } });
  assert.equal(parseEnrolmentInput({}).ok, false);
  assert.equal(parseEnrolmentInput({ course: "c", batch: "" }).ok, false);
  assert.equal(parseEnrolmentInput({ course: "c", batch: "x".repeat(101) }).ok, false);
});

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
    assert.equal((await listBatches(d.id))[0].waiting, 0);
    const [{ batch }] = await listBatches(d.id);
    assert.equal(await releaseCertificates(await batchEnrollmentIds(batch.id), { force: true }), 0);
  });

  test("switching to on_completion releases waiting certificates", async () => {
    const { d, course, learner } = await setup({ mode: "manual" });
    await recordCompletion(d.id, learner, course.id, { batch: "Jul", completedAt: new Date() });
    assert.equal(await waitingCertificates(d.id), 1);
    assert.equal((await listBatches(d.id))[0].waiting, 1);
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

  test("undo racing a release: a certificate that exists wins, and a repeat completion records it", async () => {
    const { d, course, learner } = await setup();
    await recordCompletion(d.id, learner, course.id, { batch: "Race", completedAt: new Date() });
    assert.equal(await undoCompletion(learner.userId, course.id), "undone");
    // The release landed between undo's check and its update: a certificate with an uncompleted enrolment.
    await issueOrGetCertificate(learner.userId, course.id, { partnerName: "TCS", searchVisible: false });
    assert.equal(await undoCompletion(learner.userId, course.id), "released");
    const done = await recordCompletion(d.id, learner, course.id, { batch: "Race", completedAt: new Date() });
    assert.equal(done.status, "released");
    assert.equal(done.batch, "Race");
    // Completed and certified: undo is refused and the batch is untouched.
    assert.equal(await undoCompletion(learner.userId, course.id), "released");
    const again = await recordCompletion(d.id, learner, course.id, { batch: "Other", completedAt: new Date() });
    assert.equal(again.batch, "Race");
  });

  test("a released completion is not changed by a repeat", async () => {
    const { d, course, learner } = await setup({ mode: "on_completion" });
    const first = await recordCompletion(d.id, learner, course.id, { batch: "Sep", completedAt: new Date() });
    const again = await recordCompletion(d.id, learner, course.id, { batch: "Other", completedAt: new Date() });
    assert.equal(again.batch, "Sep");
    assert.equal(again.certificate?.serial, first.certificate?.serial);
  });

  test("partnerStats: learners, completions, released, waiting and unpaid batches per client", async () => {
    const { d, course, learner } = await setup();
    await recordCompletion(d.id, learner, course.id, { batch: "Stats", completedAt: new Date() });
    assert.deepEqual((await partnerStats()).get(d.id), { learners: 1, completions: 1, released: 0, waiting: 1, unpaidBatches: 1 });
    const [{ batch }] = await listBatches(d.id);
    await setBatchPaid(batch.id, true, "admin@x.com");
    assert.deepEqual((await partnerStats()).get(d.id), { learners: 1, completions: 1, released: 1, waiting: 0, unpaidBatches: 0 });
  });

  test("enrol: listed as enrolled, repeat is a no-op, completion turns it completed", async () => {
    const { d, course, learner } = await setup();
    assert.deepEqual(await learnerCourses(learner.userId), []);
    assert.equal(await enrolLearner(d.id, learner, course.id, null), true);
    assert.equal(await enrolLearner(d.id, learner, course.id, null), false);
    const [enrolled] = await learnerCourses(learner.userId);
    assert.deepEqual([enrolled.courseSlug, enrolled.batch, enrolled.completedAt], [course.slug, null, null]);
    assert.deepEqual(await learnerCertificates(learner.userId), []); // not completed: no certificate entry
    await recordCompletion(d.id, learner, course.id, { batch: "Nov", completedAt: new Date() });
    const [done] = await learnerCourses(learner.userId);
    assert.equal(done.batch, "Nov");
    assert.ok(done.completedAt);
    assert.equal(done.enrolledAt.getTime(), enrolled.enrolledAt.getTime());
  });

  test("enrol with a batch counts in the batch; a repeat moves it until completed", async () => {
    const { d, course, learner } = await setup();
    await enrolLearner(d.id, learner, course.id, "Agent-7");
    const [row] = await listBatches(d.id);
    assert.deepEqual([row.batch.name, row.learners, row.completed], ["Agent-7", 1, 0]);
    await enrolLearner(d.id, learner, course.id, "Agent-9");
    assert.equal((await learnerCourses(learner.userId))[0].batch, "Agent-9");
    await recordCompletion(d.id, learner, course.id, { batch: "Agent-9", completedAt: new Date() });
    await enrolLearner(d.id, learner, course.id, "Other");
    assert.equal((await learnerCourses(learner.userId))[0].batch, "Agent-9");
  });

  test("listBatches counts, and renameLearner fixes released certificates", async () => {
    const { d, course, learner } = await setup({ mode: "on_completion" });
    await recordCompletion(d.id, learner, course.id, { batch: "Oct", completedAt: new Date() });
    const [row] = await listBatches(d.id);
    assert.deepEqual([row.batch.name, row.learners, row.completed, row.released, row.waiting], ["Oct", 1, 1, 1, 0]);
    assert.equal(await renameLearner(learner.userId, "Asha R. Rao"), true);
    assert.equal((await certRows(learner.userId))[0].holderName, "Asha R. Rao");
    assert.equal(await renameLearner("not-a-partner-user", "X"), false);
  });
});
