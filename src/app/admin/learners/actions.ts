"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { courses, enrollments, user } from "@/db/schema";
import { isUuid, parseExpiryDate } from "@/lib/admin/ops";
import { requireAdminApi } from "@/lib/session";
import type { ActionState } from "./action-form";

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Expiry from the form: a future date, or empty for never. */
function readExpiry(formData: FormData): Date | null | string {
  const expiresAt = parseExpiryDate(field(formData, "expires"));
  if (expiresAt === undefined) return "That is not a valid date.";
  if (expiresAt && expiresAt <= new Date()) return "Pick an expiry date in the future, or leave it empty for no expiry.";
  return expiresAt;
}

export async function updateName(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminApi();
  const name = field(formData, "name").replace(/\s+/g, " ");
  if (!name || name.length > 120) return { error: "Enter a name of up to 120 characters." };
  const updated = await db.update(user).set({ name }).where(eq(user.id, field(formData, "userId"))).returning({ id: user.id });
  if (!updated.length) return { error: "Learner not found." };
  refresh();
  return { ok: "Name saved. Certificates issued from now on use it; existing ones keep their holder name." };
}

/** A manual enrolment; reactivates a revoked one for the same course. */
export async function grantEnrolment(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminApi();
  const userId = field(formData, "userId");
  const courseId = field(formData, "courseId");
  const expiresAt = readExpiry(formData);
  if (typeof expiresAt === "string") return { error: expiresAt };
  if (!isUuid(courseId)) return { error: "Choose a course." };
  const [[learner], [course]] = await Promise.all([
    db.select({ id: user.id }).from(user).where(eq(user.id, userId)),
    db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)),
  ]);
  if (!learner || !course) return { error: "Learner or course not found." };

  const [row] = await db
    .insert(enrollments)
    .values({ userId, courseId, source: "manual", expiresAt })
    .onConflictDoUpdate({
      target: [enrollments.userId, enrollments.courseId],
      set: { source: "manual", status: "active", expiresAt },
      setWhere: eq(enrollments.status, "revoked"),
    })
    .returning({ id: enrollments.id });
  if (!row) return { error: "Already actively enrolled in this course. Change its expiry instead." };
  refresh();
  return { ok: "Enrolment granted." };
}

export async function setEnrolmentStatus(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminApi();
  const id = field(formData, "enrolmentId");
  const status = field(formData, "status");
  if (!isUuid(id) || (status !== "active" && status !== "revoked")) return { error: "Invalid request." };
  const updated = await db.update(enrollments).set({ status }).where(eq(enrollments.id, id)).returning({ id: enrollments.id });
  if (!updated.length) return { error: "Enrolment not found." };
  refresh();
  return { ok: status === "active" ? "Reactivated." : "Revoked." };
}

export async function setEnrolmentExpiry(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminApi();
  const id = field(formData, "enrolmentId");
  const expiresAt = readExpiry(formData);
  if (typeof expiresAt === "string") return { error: expiresAt };
  if (!isUuid(id)) return { error: "Invalid request." };
  const updated = await db.update(enrollments).set({ expiresAt }).where(eq(enrollments.id, id)).returning({ id: enrollments.id });
  if (!updated.length) return { error: "Enrolment not found." };
  refresh();
  return { ok: expiresAt ? "Expiry saved." : "Expiry removed." };
}
