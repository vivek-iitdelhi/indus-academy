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
