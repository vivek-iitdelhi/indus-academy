import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";

/**
 * A one-time sign-in link for `email` that lands on `next` (a same-site path): the path and query
 * of Better Auth's magic-link verify endpoint, which consumes the token on first use.
 * ponytail: mints the token in Better Auth's own format ("magic-link:<token>", see
 * better-auth/dist/plugins/magic-link); recheck after a Better Auth upgrade.
 */
export async function signInLink(email: string, name: string, next: string, ttlMs: number) {
  const token = randomBytes(24).toString("base64url");
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `magic-link:${token}`,
    value: JSON.stringify({ type: "magic-link", email, name }),
    expiresAt: new Date(Date.now() + ttlMs),
  });
  return `/api/auth/magic-link/verify?${new URLSearchParams({ token, callbackURL: next })}`;
}
