"use server";

import { and, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { certificates, courses, user } from "@/db/schema";
import { isUuid } from "@/lib/admin/ops";
import { issueCertificate } from "@/lib/lms/certificates";
import { requireAdminApi } from "@/lib/session";
import type { ActionState } from "../learners/action-form";

const field = (formData: FormData, key: string) => String(formData.get(key) ?? "").trim();

/** Revoke (set revoked_at) or reinstate (clear it). Certificates are never deleted. */
export async function setCertificateRevoked(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminApi();
  const serial = field(formData, "serial");
  const revoke = field(formData, "revoke") === "1";
  const updated = await db
    .update(certificates)
    .set({ revokedAt: revoke ? new Date() : null })
    .where(and(eq(certificates.serial, serial), revoke ? isNull(certificates.revokedAt) : isNotNull(certificates.revokedAt)))
    .returning({ serial: certificates.serial });
  if (!updated.length) return { error: "Certificate not found, or already in that state." };
  refresh();
  return { ok: revoke ? "Revoked." : "Reinstated." };
}

/** Corrects the printed name only. The hash covers serial|user|course|issued_at, so it stays valid. */
export async function renameHolder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminApi();
  const name = field(formData, "holderName").replace(/\s+/g, " ");
  if (!name || name.length > 120) return { error: "Enter a name of up to 120 characters." };
  const updated = await db
    .update(certificates)
    .set({ holderName: name })
    .where(eq(certificates.serial, field(formData, "serial")))
    .returning({ serial: certificates.serial });
  if (!updated.length) return { error: "Certificate not found." };
  refresh();
  return { ok: "Holder name corrected." };
}

export async function issueManually(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdminApi();
  const email = field(formData, "email").toLowerCase();
  const courseId = field(formData, "courseId");
  if (!isUuid(courseId)) return { error: "Choose a course." };
  const [[learner], [course]] = await Promise.all([
    db.select({ id: user.id, name: user.name }).from(user).where(eq(sql`lower(${user.email})`, email)),
    db.select({ id: courses.id }).from(courses).where(eq(courses.id, courseId)),
  ]);
  if (!learner) return { error: `No learner with the email ${email}.` };
  if (!course) return { error: "Course not found." };
  const [existing] = await db
    .select({ serial: certificates.serial })
    .from(certificates)
    .where(and(eq(certificates.userId, learner.id), eq(certificates.courseId, course.id)));
  if (existing) return { error: `This learner already has certificate ${existing.serial} for that course.` };
  if (!learner.name.trim()) return { error: "This learner has no name yet. Set it on their learner page first: it is printed on the certificate." };
  const cert = await issueCertificate(learner.id, course.id);
  refresh();
  return { ok: `Certificate ${cert.serial} issued.` };
}
