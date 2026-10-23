"use server";

import { eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { courses, distributorCourses, distributors, distributorStatuses, type DistributorStatus } from "@/db/schema";
import type { ActionState } from "@/app/admin/learners/action-form";
import { generateApiKey, isUuid } from "@/lib/distributors";
import { requireAdminApi } from "@/lib/session";

/** `key` is the only time the full API key leaves the server. */
export type KeyResult = { key?: string; error?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATH = "/admin/distributors";
const field = (form: FormData, name: string) => String(form.get(name) ?? "").trim();
const idOf = (form: FormData) => {
  const id = field(form, "id");
  return isUuid(id) ? id : null;
};

export async function createDistributor(_prev: KeyResult, form: FormData): Promise<KeyResult> {
  await requireAdminApi();
  const name = field(form, "name").slice(0, 120);
  const contactEmail = field(form, "contactEmail").toLowerCase().slice(0, 200);
  if (!name) return { error: "Enter a name." };
  if (contactEmail && !EMAIL_PATTERN.test(contactEmail)) return { error: "Enter a valid email." };

  const { key, prefix, hash } = generateApiKey();
  await db.insert(distributors).values({ name, contactEmail: contactEmail || null, keyPrefix: prefix, keyHash: hash });
  revalidatePath(PATH);
  return { key };
}

/** Replaces the key; the old one stops working at once. */
export async function rotateDistributorKey(_prev: KeyResult, form: FormData): Promise<KeyResult> {
  await requireAdminApi();
  const id = idOf(form);
  if (!id) return { error: "Distributor not found." };
  const { key, prefix, hash } = generateApiKey();
  const updated = await db
    .update(distributors)
    .set({ keyPrefix: prefix, keyHash: hash })
    .where(eq(distributors.id, id))
    .returning({ id: distributors.id });
  if (!updated.length) return { error: "Distributor not found." };
  revalidatePath(PATH);
  return { key };
}

export async function setDistributorStatus(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdminApi();
  const id = idOf(form);
  const status = field(form, "status") as DistributorStatus;
  if (!id || !distributorStatuses.includes(status)) return { error: "Distributor not found." };
  await db.update(distributors).set({ status }).where(eq(distributors.id, id));
  revalidatePath(PATH);
  return { ok: status === "revoked" ? "Access revoked. Their key stopped working." : "Access restored." };
}

export async function setLicensedCourses(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdminApi();
  const id = idOf(form);
  if (!id) return { error: "Distributor not found." };
  const wanted = form.getAll("courseId").map(String).filter(isUuid);
  const allCourses = field(form, "scope") === "all";
  const picked = await db.transaction(async (tx) => {
    await tx.update(distributors).set({ allCourses }).where(eq(distributors.id, id));
    // The picked list is saved either way, so switching back from "all" restores it.
    // Keep only real courses, so a stale or tampered form cannot fail the insert.
    const valid = wanted.length
      ? await tx.select({ id: courses.id }).from(courses).where(inArray(courses.id, wanted))
      : [];
    await tx.delete(distributorCourses).where(eq(distributorCourses.distributorId, id));
    if (valid.length) {
      await tx.insert(distributorCourses).values(valid.map((course) => ({ distributorId: id, courseId: course.id })));
    }
    return valid.length;
  });
  revalidatePath(PATH);
  if (allCourses) return { ok: "Saved: all courses, including ones published later." };
  return { ok: picked ? `Saved: ${picked} course${picked === 1 ? "" : "s"}.` : "Saved: no courses. They see nothing over the API." };
}
