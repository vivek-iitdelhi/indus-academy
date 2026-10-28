import { auth } from "@/lib/auth";
import { safeNextPath } from "@/lib/safe-next";
import { signInLink } from "@/lib/sign-in-link";
import { TEST_EMAIL } from "@/lib/test-login";

// The test learner signs in without an emailed code: the sign-in form sends that address here
// instead of asking for a link. It is an ordinary user (no enrolments, no admin), so this opens
// nothing anyone couldn't get by signing up.
export async function GET(request: Request) {
  const next = safeNextPath(new URL(request.url).searchParams.get("next"));
  const link = await signInLink(TEST_EMAIL, "Test Learner", next, 60_000);
  return Response.redirect(new URL(link, (await auth.$context).baseURL), 302);
}
