// When a live class can be joined. No imports, so pages' client components can use it too.

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
