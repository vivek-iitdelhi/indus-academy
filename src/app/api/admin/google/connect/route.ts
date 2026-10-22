import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { googleClientConfigured, googleConnectUrl, STATE_COOKIE } from "@/lib/google-calendar";
import { requireAdminApi } from "@/lib/session";

/** Sends an admin to Google to connect the calendar discovery calls are booked on. */
export async function GET() {
  await requireAdminApi();
  if (!googleClientConfigured()) {
    return Response.json({ error: "AUTH_GOOGLE_ID and AUTH_GOOGLE_SECRET are not set" }, { status: 503 });
  }
  const state = randomBytes(24).toString("base64url");
  const response = NextResponse.redirect(googleConnectUrl(state));
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/api/admin/google",
    maxAge: 600,
  });
  return response;
}
