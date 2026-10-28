"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/db";
import { user as users } from "@/db/schema";
import { safeNextPath } from "@/lib/safe-next";
import { getUser } from "@/lib/session";

export type AccountState = { error?: string; saved?: boolean };

const PHONE = /^\+?[0-9][0-9 -]{6,18}[0-9]$/;

export async function saveAccount(_prev: AccountState, form: FormData): Promise<AccountState> {
  const user = await getUser();
  if (!user) redirect("/signin?next=/learn/account");

  // Collapse whitespace (including newlines and tabs) so the certificate prints one clean line.
  const clean = (field: string) => String(form.get(field) ?? "").replace(/\s+/g, " ").trim();
  const firstName = clean("firstName");
  const lastName = clean("lastName");
  if (!firstName || firstName.length > 50) return { error: "Enter your first name (up to 50 characters)." };
  if (!lastName || lastName.length > 50) return { error: "Enter your last name (up to 50 characters)." };
  const phone = String(form.get("phone") ?? "").trim();
  if (phone && !PHONE.test(phone)) return { error: "Enter a valid phone number, or leave it blank." };

  // name, printed on certificates, is always "first last".
  const name = `${firstName} ${lastName}`;
  await db.update(users).set({ name, firstName, lastName, phone: phone || null }).where(eq(users.id, user.id));

  const next = form.get("next");
  if (typeof next === "string" && next) redirect(safeNextPath(next));
  refresh();
  return { saved: true };
}
