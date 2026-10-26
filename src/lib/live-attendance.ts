// Live class attendance: every room link we issue is counted here (our learner page and the
// partner API), and once the class is over webinar.gg's list says who actually got in. Opened
// but never attended means they tried and something stopped them.
// ponytail: attended is yes/no; webinar.gg gives no per-person minutes, so a 75% rule needs
// our own room (LiveKit) or its webhooks.
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { liveAttendance, liveSessions, user, type LiveSession } from "@/db/schema";
import { attendedUserIds, liveStatus } from "@/lib/live";

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

/** Read who was in the room from webinar.gg and mark everyone else who opened it as absent. */
export async function syncAttendance(session: LiveSession) {
  const seen = [...(await attendedUserIds(session.webinarId))];
  // Only our users: a deleted account can't be referenced.
  const known = seen.length ? (await db.select({ id: user.id }).from(user).where(inArray(user.id, seen))).map((u) => u.id) : [];
  await db.transaction(async (tx) => {
    if (known.length) {
      await tx
        .insert(liveAttendance)
        .values(known.map((userId) => ({ sessionId: session.id, userId, attended: true })))
        .onConflictDoUpdate({ target: [liveAttendance.sessionId, liveAttendance.userId], set: { attended: true } });
    }
    await tx
      .update(liveAttendance)
      .set({ attended: false })
      .where(and(eq(liveAttendance.sessionId, session.id), known.length ? notInArray(liveAttendance.userId, known) : undefined));
    await tx.update(liveSessions).set({ attendanceSyncedAt: new Date() }).where(eq(liveSessions.id, session.id));
  });
}

/** For pages and the API: sync a finished class once, if the webhook hasn't already. */
export async function ensureAttendance(session: LiveSession) {
  if (session.attendanceSyncedAt || liveStatus(session) !== "ended") return;
  await syncAttendance(session).catch((e) => console.error("[live] attendance sync failed", e));
}
