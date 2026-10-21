import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { admins } from "@/db/schema";
import { auth, type SessionUser } from "@/lib/auth";

/** The signed-in user, or null. Memoised per request. */
export const getUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  return session?.user ?? null;
});

/** The signed-in user, or a redirect to /signin that returns to `nextPath`. */
export async function requireUser(nextPath: string): Promise<SessionUser> {
  const user = await getUser();
  if (!user) redirect(`/signin?next=${encodeURIComponent(nextPath)}`);
  return user;
}

/** ADMIN_EMAILS: optional, and always admins; the way back in if every admin was removed. */
export const envAdmins = () =>
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

/** Admins are the emails in the admins table (managed at /admin/admins) plus ADMIN_EMAILS. */
export async function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const normal = email.trim().toLowerCase();
  if (envAdmins().includes(normal)) return true;
  const [row] = await db.select({ email: admins.email }).from(admins).where(eq(admins.email, normal)).limit(1);
  return Boolean(row);
}

/**
 * The signed-in admin. Everyone else, signed in or not, gets a 404 so the admin
 * area does not advertise itself. Use in admin pages and layouts.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getUser();
  if (!user || !(await isAdminEmail(user.email))) notFound();
  return user;
}

/**
 * Same check for route handlers and server actions: notFound() works there too and
 * answers 404. Call it first, outside any try/catch, because it works by throwing.
 */
export const requireAdminApi = requireAdmin;
