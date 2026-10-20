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
  const name = String(form.get("name") ?? "").replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 100) return { error: "Enter your full name (2 to 100 characters)." };
  const phone = String(form.get("phone") ?? "").trim();
  if (phone && !PHONE.test(phone)) return { error: "Enter a valid phone number, or leave it blank." };

  await db.update(users).set({ name, phone: phone || null }).where(eq(users.id, user.id));

  const next = form.get("next");
  if (typeof next === "string" && next) redirect(safeNextPath(next));
  refresh();
  return { saved: true };
}
