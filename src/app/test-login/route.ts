import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { auth } from "@/lib/auth";

// A shared test learner for trying the site (live classes, lessons) from any browser without
// an emailed code. Opening /test-login?key=<testLoginKey()> signs in as TEST_EMAIL; the key is
// derived from BETTER_AUTH_SECRET, so rotating that secret also changes this link.
// ponytail: mints a one-off magic-link token in Better Auth's own format ("magic-link:<token>",
// see better-auth/dist/plugins/magic-link) and lets its verify endpoint do the sign-in; recheck
// after a Better Auth upgrade.

const TEST_EMAIL = "test@indusai.academy";

const testLoginKey = () =>
  createHash("sha256").update(`test-login:${process.env.BETTER_AUTH_SECRET ?? ""}`).digest("hex").slice(0, 32);

const sameKey = (given: string) => {
  const a = Buffer.from(given);
  const b = Buffer.from(testLoginKey());
  return Boolean(process.env.BETTER_AUTH_SECRET) && a.length === b.length && timingSafeEqual(a, b);
};

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (!sameKey(url.searchParams.get("key") ?? "")) return new Response("Not found", { status: 404 });

  const token = randomBytes(24).toString("base64url");
  const ctx = await auth.$context;
  await ctx.internalAdapter.createVerificationValue({
    identifier: `magic-link:${token}`,
    value: JSON.stringify({ type: "magic-link", email: TEST_EMAIL, name: "Test Learner" }),
    expiresAt: new Date(Date.now() + 60_000),
  });
  const verify = new URL("/api/auth/magic-link/verify", ctx.baseURL);
  verify.searchParams.set("token", token);
  verify.searchParams.set("callbackURL", "/learn");
  return Response.redirect(verify, 302);
}
