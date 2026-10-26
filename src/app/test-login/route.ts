import { randomBytes } from "node:crypto";
import { auth } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { TEST_EMAIL } from "@/lib/test-login";

// The test learner signs in without an emailed code: the sign-in form sends that address here
// instead of asking for a link. It is an ordinary user (no enrolments, no admin), so this opens
// nothing anyone couldn't get by signing up.
// ponytail: mints a one-off magic-link token in Better Auth's own format ("magic-link:<token>",
// see better-auth/dist/plugins/magic-link) and lets its verify endpoint do the sign-in; recheck
// after a Better Auth upgrade.
export async function GET(request: Request) {
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const token = randomBytes(24).toString("base64url");
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `magic-link:${token}`,
    value: JSON.stringify({ type: "magic-link", email: TEST_EMAIL, name: "Test Learner" }),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const verify = new URL("/api/auth/magic-link/verify", ctx.baseURL);
  verify.searchParams.set("token", token);
  verify.searchParams.set("callbackURL", next);
  return Response.redirect(verify, 302);
}
