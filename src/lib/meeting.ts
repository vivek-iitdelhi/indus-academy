// A video link of its own for every discovery call. Zoho Meeting (India data centre) when
// ZOHO_* keys are set; otherwise, or if Zoho fails after the buyer has paid, a private
// Jitsi room, so a booking never goes out without a link.
import { randomBytes } from "node:crypto";

const ZOHO = "zoho.in";

/** Zoho Meeting's start time format, in India time: "Jun 19, 2026 07:00 PM". */
export const zohoStartTime = (start: Date) =>
  start
    .toLocaleString("en-US", {
      timeZone: "Asia/Kolkata",
      month: "short",
      day: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
    .replace(/, (\d{2}:)/, " $1");

export const jitsiRoom = () => `https://meet.jit.si/IndusAI-${randomBytes(9).toString("base64url")}`;

export const zohoConfigured = () =>
  Boolean(process.env.ZOHO_CLIENT_ID && process.env.ZOHO_CLIENT_SECRET && process.env.ZOHO_REFRESH_TOKEN);

async function zohoJson(url: string, init: RequestInit) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(10_000) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Zoho ${url} responded ${res.status}: ${JSON.stringify(data).slice(0, 300)}`);
  return data;
}

async function zohoMeeting(input: { topic: string; agenda: string; start: Date; minutes: number }) {
  const token = await zohoJson(`https://accounts.${ZOHO}/oauth/v2/token`, {
    method: "POST",
    body: new URLSearchParams({
      refresh_token: process.env.ZOHO_REFRESH_TOKEN ?? "",
      client_id: process.env.ZOHO_CLIENT_ID ?? "",
      client_secret: process.env.ZOHO_CLIENT_SECRET ?? "",
      grant_type: "refresh_token",
    }),
  });
  if (!token.access_token) throw new Error(`Zoho token refresh failed: ${JSON.stringify(token).slice(0, 300)}`);
  const auth = { authorization: `Zoho-oauthtoken ${token.access_token}` };

  // The organisation (zsoid) and host (zuid) of the account the refresh token belongs to.
  const { userDetails } = await zohoJson(`https://meeting.${ZOHO}/api/v2/user.json`, { headers: auth });
  const created = await zohoJson(`https://meeting.${ZOHO}/api/v2/${userDetails.zsoid}/sessions.json`, {
    method: "POST",
    headers: { ...auth, "content-type": "application/json;charset=UTF-8" },
    body: JSON.stringify({
      session: {
        topic: input.topic,
        agenda: input.agenda.slice(0, 1000),
        presenter: Number(userDetails.zuid),
        startTime: zohoStartTime(input.start),
        duration: input.minutes * 60_000,
        timezone: "Asia/Calcutta",
      },
    }),
  });
  const link = created.session?.joinLink;
  if (typeof link !== "string" || !link.startsWith("https://")) throw new Error(`Zoho returned no join link: ${JSON.stringify(created).slice(0, 300)}`);
  return link;
}

/** A fresh meeting link for one call. Never throws. */
export async function createMeetingLink(input: { topic: string; agenda: string; start: Date; minutes: number }) {
  if (zohoConfigured()) {
    try {
      return await zohoMeeting(input);
    } catch (error) {
      console.error("[meeting] Zoho Meeting failed; using a Jitsi room instead:", error);
    }
  }
  return jitsiRoom();
}
