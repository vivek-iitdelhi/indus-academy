"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { envAdmins, requireAdminApi } from "@/lib/session";
import type { ActionState } from "../learners/action-form";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PATH = "/admin/admins";
const emailOf = (form: FormData) => String(form.get("email") ?? "").trim().toLowerCase().slice(0, 200);

/** The person needs no account yet: admin rights apply once they sign in with this email. */
export async function addAdmin(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireAdminApi();
  const email = emailOf(form);
  if (!EMAIL_PATTERN.test(email)) return { error: "Enter a valid email." };
  const added = await db.insert(admins).values({ email, addedBy: me.email }).onConflictDoNothing().returning({ email: admins.email });
  if (!added.length) return { error: `${email} is already an admin.` };
  revalidatePath(PATH);
  return { ok: `${email} is now an admin.` };
}

/** You cannot remove yourself, so there is always at least one admin who can sign in. */
export async function removeAdmin(_prev: ActionState, form: FormData): Promise<ActionState> {
  const me = await requireAdminApi();
  const email = emailOf(form);
  if (email === me.email.toLowerCase()) return { error: "You can't remove yourself. Ask another admin." };
  const removed = await db.delete(admins).where(eq(admins.email, email)).returning({ email: admins.email });
  if (!removed.length) {
    return envAdmins().includes(email)
      ? { error: `${email} is set in the server settings (ADMIN_EMAILS); remove it there.` }
      : { error: "Not found." };
  }
  revalidatePath(PATH);
  return { ok: `${email} is no longer an admin.` };
}
