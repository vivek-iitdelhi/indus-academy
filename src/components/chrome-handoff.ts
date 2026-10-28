"use server";

import { safeNextPath } from "@/lib/safe-next";
import { getUser } from "@/lib/session";
import { signInLink } from "@/lib/sign-in-link";

const HANDOFF_TTL_MS = 15 * 60_000;

/**
 * For the "Open in Chrome" button on iPhone: a one-time link that signs the viewer into Chrome as
 * the account they're using here and lands on `next`, so Chrome doesn't ask them to sign in again.
 */
export async function chromeHandoffLink(next: string): Promise<string | null> {
  const user = await getUser();
  if (!user) return null;
  return signInLink(user.email, user.name, safeNextPath(next), HANDOFF_TTL_MS);
}
