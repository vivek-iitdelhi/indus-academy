import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";
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

/** Admins are the comma-separated, case-insensitive ADMIN_EMAILS. */
export function isAdminEmail(email: string | null | undefined) {
  if (!email) return false;
  const admins = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim().toLowerCase());
  return admins.includes(email.trim().toLowerCase());
}

/**
 * The signed-in admin. Everyone else, signed in or not, gets a 404 so the admin
 * area does not advertise itself. Use in admin pages and layouts.
 */
export async function requireAdmin(): Promise<SessionUser> {
  const user = await getUser();
  if (!user || !isAdminEmail(user.email)) notFound();
  return user;
}

/**
 * Same check for route handlers and server actions: notFound() works there too and
 * answers 404. Call it first, outside any try/catch, because it works by throwing.
 */
export const requireAdminApi = requireAdmin;
