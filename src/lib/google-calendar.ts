// The Google Calendar an admin connects at /admin: discovery calls are created on it with a
// Google Meet link (Google emails the buyer the invite), and its busy times are not offered
// as slots. Uses the same Google OAuth client as sign-in (AUTH_GOOGLE_ID/SECRET).
import { eq } from "drizzle-orm";
import { site } from "@/content/site";
import { db } from "@/db";
import { calendarConnections } from "@/db/schema";

const ID = "google";
const CALENDAR = "https://www.googleapis.com/calendar/v3";
const SCOPES = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

/** Holds the OAuth state between /api/admin/google/connect and its callback. */
export const STATE_COOKIE = "gcal_state";

export const googleCalendarRedirectUri = () => `${site.url}/api/admin/google/callback`;
const clientId = () => process.env.AUTH_GOOGLE_ID ?? "";
const clientSecret = () => process.env.AUTH_GOOGLE_SECRET ?? "";
export const googleClientConfigured = () => Boolean(clientId() && clientSecret());

/** Google's consent page. `prompt=consent` makes Google return a refresh token every time. */
export const googleConnectUrl = (state: string) =>
  `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: clientId(),
    redirect_uri: googleCalendarRedirectUri(),
    response_type: "code",
    scope: SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  })}`;

async function token(params: Record<string, string>) {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({ client_id: clientId(), client_secret: clientSecret(), ...params }),
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google token endpoint responded ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data as { access_token: string; refresh_token?: string; id_token?: string; scope?: string };
}

/** Finishes the connect flow: stores the account's refresh token, replacing any earlier one. */
export async function connectGoogleCalendar(code: string, adminEmail: string) {
  const granted = await token({ code, redirect_uri: googleCalendarRedirectUri(), grant_type: "authorization_code" });
  const scopes = granted.scope?.split(" ") ?? [];
  if (!SCOPES.slice(2).every((s) => scopes.includes(s))) {
    throw new Error("Calendar access was not granted. Connect again and tick both calendar boxes on Google's screen.");
  }
  if (!granted.refresh_token || !granted.id_token) throw new Error("Google did not return a refresh token. Please try again.");
  // The id token came straight from Google over TLS, so its payload can be read as is.
  const { email } = JSON.parse(Buffer.from(granted.id_token.split(".")[1], "base64url").toString()) as { email: string };
  const row = { email, refreshToken: granted.refresh_token, connectedBy: adminEmail, connectedAt: new Date() };
  await db.insert(calendarConnections).values({ id: ID, ...row }).onConflictDoUpdate({ target: calendarConnections.id, set: row });
  return email;
}

export const googleConnection = async () =>
  (await db.select().from(calendarConnections).where(eq(calendarConnections.id, ID)).limit(1))[0];

/** An access token for the connected account, or null when none is connected. */
async function accessToken() {
  if (!googleClientConfigured()) return null;
  const connection = await googleConnection();
  if (!connection) return null;
  return (await token({ refresh_token: connection.refreshToken, grant_type: "refresh_token" })).access_token;
}

async function call<T>(accessTokenValue: string, method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${CALENDAR}${path}`, {
    method,
    headers: { authorization: `Bearer ${accessTokenValue}`, ...(body ? { "content-type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(10_000),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Google Calendar ${method} ${path} responded ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data as T;
}

/** Busy periods on the connected calendar between two times; empty when none is connected. */
export async function googleBusy(from: Date, to: Date): Promise<{ start: Date; end: Date }[]> {
  const access = await accessToken();
  if (!access) return [];
  const data = await call<{ calendars: { primary?: { busy?: { start: string; end: string }[] } } }>(access, "POST", "/freeBusy", {
    timeMin: from.toISOString(),
    timeMax: to.toISOString(),
    items: [{ id: "primary" }],
  });
  return (data.calendars.primary?.busy ?? []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

type GoogleEvent = { id: string; hangoutLink?: string };

/**
 * Puts the call on the connected calendar with a fresh Meet link and has Google email the
 * buyer the invite. Returns null when no calendar is connected. `requestId` (the booking
 * id) makes Meet creation idempotent at Google.
 */
export async function createGoogleEvent(input: {
  requestId: string;
  title: string;
  description: string;
  start: Date;
  end: Date;
  attendee: { email: string; name: string };
}) {
  const access = await accessToken();
  if (!access) return null;
  const event = await call<GoogleEvent>(access, "POST", "/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all", {
    summary: input.title,
    description: input.description,
    start: { dateTime: input.start.toISOString(), timeZone: "Asia/Kolkata" },
    end: { dateTime: input.end.toISOString(), timeZone: "Asia/Kolkata" },
    attendees: [{ email: input.attendee.email, displayName: input.attendee.name }],
    conferenceData: { createRequest: { requestId: input.requestId, conferenceSolutionKey: { type: "hangoutsMeet" } } },
    reminders: { useDefault: true },
  });
  if (event.hangoutLink) return { eventId: event.id, meetUrl: event.hangoutLink };
  // Meet creation can be briefly pending; look once more before giving up on it.
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const again = await call<GoogleEvent>(access, "GET", `/calendars/primary/events/${encodeURIComponent(event.id)}`);
  return { eventId: event.id, meetUrl: again.hangoutLink ?? null };
}
