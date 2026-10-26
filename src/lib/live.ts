// Live classes run on webinar.gg: each session is a webinar on the account behind
// WEBINAR_GG_TOKEN, and whoever opens it gets a fresh one-time join token, so the room sits in
// an iframe on our learner page or on a partner's site. Learners go in under a placeholder
// email made from their user id, so webinar.gg never gets (or emails) their address. The host
// signs in at webinar.gg with that account and starts the class there.
// ponytail: one webinar.gg account and its 120 requests/min for everyone; move to our own
// LiveKit (scripts/livekit-server.sh) when that or its branding limits us. Callers only see
// joinUrl, so the switch stays inside this file.
import { createHash } from "node:crypto";

const API = "https://webinar-api.webinar.gg/api/v1";
const token = () => process.env.WEBINAR_GG_TOKEN ?? "";
export const liveConfigured = () => Boolean(token());

/** Join opens this long before the start, and stays open this long after the planned end. */
export const OPENS_EARLY_MS = 15 * 60_000;
export const LATE_GRACE_MS = 60 * 60_000;

export type LiveStatus = "upcoming" | "open" | "ended";

export function liveStatus(session: { startsAt: Date; durationMinutes: number }, now = new Date()): LiveStatus {
  const start = session.startsAt.getTime();
  if (now.getTime() < start - OPENS_EARLY_MS) return "upcoming";
  if (now.getTime() <= start + session.durationMinutes * 60_000 + LATE_GRACE_MS) return "open";
  return "ended";
}

/** webinar.gg takes a wall-clock date and 12-hour time; we schedule in India time (no DST). */
export function indiaParts(at: Date) {
  const ist = new Date(at.getTime() + 330 * 60_000);
  const h = ist.getUTCHours();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: ist.toISOString().slice(0, 10),
    time: `${pad(h % 12 || 12)}:${pad(ist.getUTCMinutes())}`,
    meridiem: h < 12 ? "AM" : "PM",
  };
}

/** An admin's `<input type="datetime-local">` value, read as India time. */
export function parseIndiaDateTime(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const at = new Date(`${value}:00+05:30`);
  return Number.isNaN(at.getTime()) ? null : at;
}

/** The secret part of the webhook URL, derived from the API token so there is nothing else to store. */
export const webhookKey = () => createHash("sha256").update(`live-webhook:${token()}`).digest("hex").slice(0, 32);

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
  if (!res.ok || !data.success) throw new Error(`webinar.gg ${method} ${path} responded ${res.status}: ${data.error ?? ""}`);
  return data.data as T;
}

/** Creates the webinar (recorded, no passcode: passcodes don't reach an embedded room). */
export async function createWebinar(input: { title: string; startsAt: Date; durationMinutes: number }) {
  const { id } = await call<{ id: string }>("POST", "/webinar/", {
    title: input.title,
    ...indiaParts(input.startsAt),
    timezone: "Asia/Kolkata",
    durationMinutes: input.durationMinutes,
    recordingEnabled: true,
  });
  return id;
}

export const deleteWebinar = (webinarId: string) => call("DELETE", `/webinar/${encodeURIComponent(webinarId)}`);

/** The host studio; it needs the browser to be signed in to the webinar.gg account. */
export const hostUrl = (webinarId: string) => `https://webinar.gg/webinar-page/${encodeURIComponent(webinarId)}`;

/** A room URL for one person, valid for 10 minutes: fetch it when they open the page, never cache it. */
export async function joinUrl(webinarId: string, person: { userId: string; name: string }) {
  const [first, ...rest] = person.name.trim().split(/\s+/);
  const joined = await call<{ token: string; expiresAt: string }>("POST", "/webinar/join-token", {
    webinarId,
    firstName: first || "Learner",
    lastName: rest.join(" ") || "-",
    email: `${person.userId}@learners.invalid`,
    phone: "",
    passcode: "",
  });
  return { url: `${hostUrl(webinarId)}?token=${encodeURIComponent(joined.token)}`, expiresAt: new Date(joined.expiresAt) };
}

/** iframe `allow` list for the room. */
export const ROOM_ALLOW = "camera; microphone; autoplay; display-capture; fullscreen";
