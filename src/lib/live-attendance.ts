// Live class attendance: every room link we issue is counted here (our learner page and the
// partner API), and once the class is over webinar.gg's list says who actually got in. Opened
// but never attended means they tried and something stopped them.
// The list is read in the background only (webinar.ended webhook, the /api/cron/live sweep), a
// page per request at the budget's lowest priority, and resumes where it stopped.
// ponytail: attended is yes/no; webinar.gg gives no per-person minutes, so a 75% rule needs
// our own room (LiveKit) or its webhooks.
import { setTimeout as sleep } from "node:timers/promises";
import { and, asc, eq, exists, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { liveAttendance, liveAttendanceSyncs, liveSessions, user, type LiveSession } from "../db/schema.ts";
import { attendedOnPage, LiveBusy, liveStatus, LATE_GRACE_MS } from "./live.ts";
import { onLessonCompleted } from "./lms/completion.ts";

/** Count one room link for this learner; distributorId null = our own site. */
export async function recordOpen(sessionId: string, userId: string, distributorId: string | null) {
  const now = new Date();
  await db
    .insert(liveAttendance)
    .values({ sessionId, userId, distributorId, opens: 1, firstOpenedAt: now, lastOpenedAt: now })
    .onConflictDoUpdate({
      target: [liveAttendance.sessionId, liveAttendance.userId],
      set: {
        opens: sql`${liveAttendance.opens} + 1`,
        firstOpenedAt: sql`coalesce(${liveAttendance.firstOpenedAt}, excluded.first_opened_at)`,
        lastOpenedAt: now,
      },
    });
}

/** Marks these users (ours only: a deleted account can't be referenced) as in the room. */
async function markAttended(sessionId: string, seen: string[]) {
  const known = seen.length ? (await db.select({ id: user.id }).from(user).where(inArray(user.id, seen))).map((u) => u.id) : [];
  if (!known.length) return;
  await db
    .insert(liveAttendance)
    .values(known.map((userId) => ({ sessionId, userId, attended: true })))
    .onConflictDoUpdate({ target: [liveAttendance.sessionId, liveAttendance.userId], set: { attended: true } });
}

const LEASE = sql`now() + interval '1 minute'`;

/**
 * How long after a class ends webinar.gg's attendee list is trusted as final. Read at the moment
 * the host ended a class (2026-10-29), it still had nobody as attended, and all 63 were marked absent.
 */
export const SETTLE_MS = 15 * 60_000;

/** The class ended (host or schedule) at least SETTLE_MS ago. */
export function settled(session: Pick<LiveSession, "startsAt" | "durationMinutes" | "endedAt">, now = Date.now()) {
  const over = session.endedAt?.getTime() ?? session.startsAt.getTime() + session.durationMinutes * 60_000 + LATE_GRACE_MS;
  return now - over >= SETTLE_MS;
}

/**
 * Reads who was in the room from webinar.gg, from the page the last run stopped at, until done
 * or `until` (ms epoch); then marks everyone else who opened it as absent. One worker per class
 * at a time (a lease on live_attendance_syncs). True once the class is final.
 */
export async function syncAttendance(session: LiveSession, until = Date.now() + 4 * 60_000): Promise<boolean> {
  if (session.attendanceSyncedAt) return true;
  await db.insert(liveAttendanceSyncs).values({ sessionId: session.id }).onConflictDoNothing();
  const [claim] = await db
    .update(liveAttendanceSyncs)
    .set({ leaseUntil: LEASE })
    .where(
      and(
        eq(liveAttendanceSyncs.sessionId, session.id),
        or(isNull(liveAttendanceSyncs.leaseUntil), lt(liveAttendanceSyncs.leaseUntil, sql`now()`)),
      ),
    )
    .returning();
  if (!claim) return false; // another worker has it
  let page = claim.nextPage;
  try {
    while (Date.now() < until) {
      let result: { ids: string[]; last: boolean };
      try {
        result = await attendedOnPage(session.webinarId, page);
      } catch (e) {
        if (e instanceof LiveBusy) {
          await sleep(Math.min(e.retryAfter * 1000, Math.max(0, until - Date.now())));
          continue;
        }
        // A webinar webinar.gg doesn't know (deleted) has no list to read: final as it is.
        if ((e as { status?: number }).status !== 404) throw e;
        result = { ids: [], last: true };
      }
      await markAttended(session.id, result.ids);
      page++;
      if (result.last && !settled(session)) {
        // webinar.gg fills in who attended only minutes after the room closes: certify who it
        // shows so far, and read the whole list again on the next run (the cron, every minute).
        await certifyAttendees(session);
        page = 0;
        return false;
      }
      if (result.last) {
        await db.transaction(async (tx) => {
          await tx
            .update(liveAttendance)
            .set({ attended: false })
            .where(and(eq(liveAttendance.sessionId, session.id), isNull(liveAttendance.attended)));
          await tx.update(liveSessions).set({ attendanceSyncedAt: new Date() }).where(eq(liveSessions.id, session.id));
          await tx.delete(liveAttendanceSyncs).where(eq(liveAttendanceSyncs.sessionId, session.id));
        });
        await certifyAttendees(session);
        return true;
      }
      await db.update(liveAttendanceSyncs).set({ nextPage: page, leaseUntil: LEASE }).where(eq(liveAttendanceSyncs.sessionId, session.id));
    }
    return false;
  } finally {
    // No-op once finished (the row is gone); otherwise the next run may start right away.
    await db.update(liveAttendanceSyncs).set({ nextPage: page, leaseUntil: null }).where(eq(liveAttendanceSyncs.sessionId, session.id));
  }
}

/**
 * Attending may have finished the course: certificates for this class's attendees who came
 * through our site. Partner learners' certificates go through the partner's completion
 * (partners.ts), co-branded, so they are left to that.
 */
async function certifyAttendees(session: LiveSession) {
  const attendees = await db
    .select({ userId: liveAttendance.userId })
    .from(liveAttendance)
    .where(and(eq(liveAttendance.sessionId, session.id), eq(liveAttendance.attended, true), isNull(liveAttendance.distributorId)));
  for (const { userId } of attendees) {
    await onLessonCompleted(userId, session.courseId).catch((e) => console.error("[live] certificate check failed", userId, e));
  }
}

/**
 * Cron: every class that is over (or whose sync the webhook started) and isn't final yet,
 * oldest first, until `until`. Returns how many it finished and how many are still waiting.
 */
export async function syncPendingAttendance(until = Date.now() + 4 * 60_000) {
  const due = await db
    .select()
    .from(liveSessions)
    .where(
      and(
        isNull(liveSessions.attendanceSyncedAt),
        or(
          lt(sql`${liveSessions.startsAt} + make_interval(mins => ${liveSessions.durationMinutes}) + make_interval(secs => ${LATE_GRACE_MS / 1000})`, sql`now()`),
          exists(db.select().from(liveAttendanceSyncs).where(eq(liveAttendanceSyncs.sessionId, liveSessions.id))),
        ),
      ),
    )
    .orderBy(asc(liveSessions.startsAt));
  let synced = 0;
  for (const session of due) {
    if (Date.now() >= until) break;
    try {
      if (await syncAttendance(session, until)) synced++;
    } catch (e) {
      console.error("[live] attendance sync failed", session.id, e);
    }
  }
  return { synced, pending: due.length - synced };
}

/**
 * For admin pages: start reading a finished class's attendance in the background if nothing
 * has yet. Never waits for it; the page shows what is there (the cron finishes it otherwise).
 */
export async function ensureAttendance(session: LiveSession) {
  if (session.attendanceSyncedAt || liveStatus(session) !== "ended") return;
  void syncAttendance(session, Date.now() + 60_000).catch((e) => console.error("[live] attendance sync failed", e));
}
