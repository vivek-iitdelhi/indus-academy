// Live classes run on webinar.gg: each session is a webinar on the account behind
// WEBINAR_GG_TOKEN, and whoever opens it gets a fresh one-time join token, so the room sits in
// an iframe on our learner page or on a partner's site. Learners go in under a placeholder
// email made from their user id, so webinar.gg never gets (or emails) their address. Admins
// host from /admin/live/[id]: a token minted with the account owner's email and name
// (WEBINAR_GG_HOST_EMAIL / _NAME) opens the host studio there, so nobody visits webinar.gg.
// Every call spends from one budget shared by all containers (live-budget.ts): host and admin
// calls first, then joins, then the attendance sync.
// ponytail: one webinar.gg account, ~60 requests/min in practice (live-budget.ts), so ~55 new
// learners a minute get in (repeat joins reuse their link); move to our own LiveKit
// (scripts/livekit-server.sh) or a higher webinar.gg limit when that or its branding limits us.
// Callers only see joinUrl, so the switch stays inside this file.
import { createHash } from "node:crypto";
import { and, eq, gt, lt, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { liveJoinLinks } from "../db/schema.ts";
import { acquire, LiveBusy, observe, retryAfterSeconds, type Priority } from "./live-budget.ts";

export { LiveBusy };

const API = "https://webinar-api.webinar.gg/api/v1";
const token = () => process.env.WEBINAR_GG_TOKEN ?? "";
export const liveConfigured = () => Boolean(token());

export { LATE_GRACE_MS, liveStatus, OPENS_EARLY_MS, type LiveStatus } from "./live-times.ts";

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

async function call<T>(priority: Priority, method: string, path: string, body?: unknown): Promise<T> {
  await acquire(priority);
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token()}`, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const wait = await observe(res.status, res.headers);
  if (res.status === 429) throw new LiveBusy(retryAfterSeconds(wait));
  const data = (await res.json().catch(() => ({}))) as { success?: boolean; data?: T; error?: string };
  if (!res.ok || !data.success) {
    throw Object.assign(new Error(`webinar.gg ${method} ${path} responded ${res.status}: ${data.error ?? ""}`), { status: res.status });
  }
  return data.data as T;
}

/** Creates the webinar (recorded, no passcode: passcodes don't reach an embedded room). */
export async function createWebinar(input: { title: string; startsAt: Date; durationMinutes: number }) {
  const { id } = await call<{ id: string }>("host", "POST", "/webinar/", {
    title: input.title,
    ...indiaParts(input.startsAt),
    timezone: "Asia/Kolkata",
    durationMinutes: input.durationMinutes,
    recordingEnabled: true,
  });
  return id;
}

export const deleteWebinar = (webinarId: string) => call("host", "DELETE", `/webinar/${encodeURIComponent(webinarId)}`);

/** A room URL for one person, valid for 10 minutes and 10 page loads (webinar.gg's terms). */
async function tokenUrl(priority: Priority, webinarId: string, name: string, email: string) {
  const [first, ...rest] = name.trim().split(/\s+/);
  const joined = await call<{ token: string; expiresAt: string }>(priority, "POST", "/webinar/join-token", {
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

// A learner's link is handed out again while it has REUSE_MIN_LEFT_MS to run and has gone out
// fewer than REUSE_MAX times (each page load spends one of the token's 10 uses), so reloads and
// repeat join calls cost no request. Only to the same webinar.gg identity, so never to anyone else.
const REUSE_MIN_LEFT_MS = 4 * 60_000;
const REUSE_MAX = 4;

// webinar.gg keys its users by email and keeps the first name it saw, so the placeholder email
// carries a hash of the name: a renamed learner joins as a new webinar.gg user with the new name.
export async function joinUrl(webinarId: string, person: { userId: string; name: string }) {
  const email = `${person.userId}.${createHash("sha256").update(person.name.trim()).digest("hex").slice(0, 8)}@learners.invalid`;
  const key = and(eq(liveJoinLinks.webinarId, webinarId), eq(liveJoinLinks.email, email));
  const [reused] = await db
    .update(liveJoinLinks)
    .set({ issued: sql`${liveJoinLinks.issued} + 1` })
    .where(and(key, gt(liveJoinLinks.expiresAt, new Date(Date.now() + REUSE_MIN_LEFT_MS)), lt(liveJoinLinks.issued, REUSE_MAX)))
    .returning({ url: liveJoinLinks.url, expiresAt: liveJoinLinks.expiresAt });
  if (reused) return reused;
  const minted = await tokenUrl("join", webinarId, person.name, email);
  await db
    .insert(liveJoinLinks)
    .values({ webinarId, email, ...minted })
    .onConflictDoUpdate({ target: [liveJoinLinks.webinarId, liveJoinLinks.email], set: { ...minted, issued: 1 } });
  return minted;
}

/** Cron: links past their expiry are no use to anyone. */
export const pruneJoinLinks = () => db.delete(liveJoinLinks).where(lt(liveJoinLinks.expiresAt, new Date()));

const host = () => ({ email: process.env.WEBINAR_GG_HOST_EMAIL ?? "", name: process.env.WEBINAR_GG_HOST_NAME ?? "" });
export const hostConfigured = () => Boolean(host().email && host().name);

/**
 * The host studio, signed in as the account owner. Admin pages only: the iframe holds a
 * session for the whole webinar.gg account.
 */
export const hostJoinUrl = (webinarId: string) => tokenUrl("host", webinarId, host().name, host().email);

/** iframe `allow` list for the room. */
export const ROOM_ALLOW = "camera; microphone; autoplay; display-capture; fullscreen";

/** The user id inside a learner's placeholder email ("<id>@…" or "<id>.<name hash>@…"), else null. */
export function learnerIdFromEmail(email: string): string | null {
  const match = email.match(/^([A-Za-z0-9_-]+)(\.[0-9a-f]{8})?@learners\.invalid$/);
  return match ? match[1] : null;
}

/** webinar.gg's page size cap for the invite list: it answers limit=100 with 20. */
const INVITE_PAGE_SIZE = 20;

/**
 * One page of webinar.gg's invite list (everyone who got a join token): our user ids it saw in
 * the room, and whether this was the last page. Low priority: runs on what joins leave over.
 */
export async function attendedOnPage(webinarId: string, page: number) {
  const { users, pagination } = await call<{
    users: { email: string; isHost: boolean; attended: boolean | null }[];
    pagination: { total: number };
  }>("sync", "GET", `/webinar/${encodeURIComponent(webinarId)}/invite?page=${page}&limit=${INVITE_PAGE_SIZE}`);
  const ids = users.flatMap((u) => (!u.isHost && u.attended ? (learnerIdFromEmail(u.email) ?? []) : []));
  return { ids, last: users.length === 0 || (page + 1) * INVITE_PAGE_SIZE >= pagination.total };
}
