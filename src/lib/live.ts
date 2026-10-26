// Live classes run on webinar.gg: each session is a webinar on the account behind
// WEBINAR_GG_TOKEN, and whoever opens it gets a fresh one-time join token, so the room sits in
// an iframe on our learner page or on a partner's site. Learners go in under a placeholder
// email made from their user id, so webinar.gg never gets (or emails) their address. Admins
// host from /admin/live/[id]: a token minted with the account owner's email and name
// (WEBINAR_GG_HOST_EMAIL / _NAME) opens the host studio there, so nobody visits webinar.gg.
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

/** A room URL for one person, valid for 10 minutes: fetch it when they open the page, never cache it. */
async function tokenUrl(webinarId: string, name: string, email: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const joined = await call<{ token: string; expiresAt: string }>("POST", "/webinar/join-token", {
    webinarId,
    firstName: first || "Learner",
    lastName: rest.join(" "),
    email,
    phone: "",
    passcode: "",
  });
  const room = `https://webinar.gg/webinar-page/${encodeURIComponent(webinarId)}`;
  return { url: `${room}?token=${encodeURIComponent(joined.token)}`, expiresAt: new Date(joined.expiresAt) };
}

// webinar.gg keys its users by email and keeps the first name it saw, so the placeholder email
// carries a hash of the name: a renamed learner joins as a new webinar.gg user with the new name.
export const joinUrl = (webinarId: string, person: { userId: string; name: string }) =>
  tokenUrl(webinarId, person.name, `${person.userId}.${createHash("sha256").update(person.name.trim()).digest("hex").slice(0, 8)}@learners.invalid`);

const host = () => ({ email: process.env.WEBINAR_GG_HOST_EMAIL ?? "", name: process.env.WEBINAR_GG_HOST_NAME ?? "" });
export const hostConfigured = () => Boolean(host().email && host().name);

/**
 * The host studio, signed in as the account owner. Admin pages only: the iframe holds a
 * session for the whole webinar.gg account.
 */
export const hostJoinUrl = (webinarId: string) => tokenUrl(webinarId, host().name, host().email);

/** iframe `allow` list for the room. */
export const ROOM_ALLOW = "camera; microphone; autoplay; display-capture; fullscreen";

/** The user id inside a learner's placeholder email ("<id>@…" or "<id>.<name hash>@…"), else null. */
export function learnerIdFromEmail(email: string): string | null {
  const match = email.match(/^([A-Za-z0-9_-]+)(\.[0-9a-f]{8})?@learners\.invalid$/);
  return match ? match[1] : null;
}

/** Our user ids that webinar.gg saw in the room (it lists everyone who got a join token). */
export async function attendedUserIds(webinarId: string): Promise<Set<string>> {
  const ids = new Set<string>();
  for (let page = 0; ; page++) {
    const { users, pagination } = await call<{
      users: { email: string; isHost: boolean; attended: boolean | null }[];
      pagination: { total: number };
    }>("GET", `/webinar/${encodeURIComponent(webinarId)}/invite?page=${page}&limit=20`);
    for (const u of users) {
      const id = !u.isHost && u.attended ? learnerIdFromEmail(u.email) : null;
      if (id) ids.add(id);
    }
    if (users.length === 0 || (page + 1) * 20 >= pagination.total) return ids;
  }
}
