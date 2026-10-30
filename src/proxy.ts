import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

/**
 * A signed-in learner's home is My courses, not the sales page. Only the cookie is checked, so
 * the public home stays static; an expired session just lands on sign-in from /learn.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.redirect(new URL("/learn", request.url));
}

export const config = { matcher: "/" };
