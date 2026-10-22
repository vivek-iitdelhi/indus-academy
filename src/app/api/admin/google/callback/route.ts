import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { site } from "@/content/site";
import { connectGoogleCalendar, STATE_COOKIE } from "@/lib/google-calendar";
import { requireAdminApi } from "@/lib/session";

const back = (params: Record<string, string>) => {
  const response = NextResponse.redirect(`${site.url}/admin?${new URLSearchParams(params)}#calendar`);
  response.cookies.delete({ name: STATE_COOKIE, path: "/api/admin/google" });
  return response;
};

/** Google sends the admin back here with a code, which becomes the stored refresh token. */
export async function GET(request: NextRequest) {
  const admin = await requireAdminApi();
  const params = request.nextUrl.searchParams;
  const state = Buffer.from(params.get("state") ?? "");
  const expected = Buffer.from(request.cookies.get(STATE_COOKIE)?.value ?? "");
  if (!expected.length || state.length !== expected.length || !timingSafeEqual(state, expected)) {
    return back({ calendar_error: "The connection link expired. Please click Connect again." });
  }
  const code = params.get("code");
  if (!code) return back({ calendar_error: params.get("error") === "access_denied" ? "Access was not allowed." : "Google sent no code." });

  try {
    return back({ calendar: await connectGoogleCalendar(code, admin.email) });
  } catch (error) {
    console.error("[google calendar] connect failed:", error);
    return back({ calendar_error: error instanceof Error ? error.message : "Could not connect Google Calendar." });
  }
}
