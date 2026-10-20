// Pure helpers for the learner app; kept free of React and the database so node --test can load them.

/**
 * Largest playhead step between two `timeupdate` events that still counts as watching.
 * timeupdate fires every ~250 ms (0.5 s of media at 2x); browsers throttle it to ~1 s in
 * background tabs. Anything bigger is a seek and counts for nothing.
 */
export const MAX_PLAY_STEP_SECONDS = 3;

/** Media seconds played between two timeupdate readings; 0 for seeks and rewinds. */
export function playedBetween(previous: number, current: number): number {
  const step = current - previous;
  return Number.isFinite(step) && step > 0 && step <= MAX_PLAY_STEP_SECONDS ? step : 0;
}

/** The server accepts at most this much watchedDelta per report; the rest waits for the next one. */
export const MAX_REPORT_DELTA = 30;

/** Splits accumulated watch time into what to send now and what to carry over. */
export function takeReportDelta(pending: number): { send: number; keep: number } {
  const send = Math.min(Math.max(pending, 0), MAX_REPORT_DELTA);
  return { send, keep: Math.max(pending - send, 0) };
}

const REWIND_SECONDS = 3;

/**
 * Where to start playback. The last position this device saw wins (it also covers
 * rewatching a finished lesson); otherwise a few seconds before the furthest point,
 * or the start for a finished lesson. Within a few seconds of the end, start over.
 */
export function resumePosition({
  local,
  furthestSeconds,
  completed,
  durationSeconds,
}: {
  local: number | null;
  furthestSeconds: number;
  completed: boolean;
  durationSeconds: number;
}): number {
  const raw = local != null && Number.isFinite(local) ? local : completed ? 0 : furthestSeconds;
  const at = Math.max(0, Math.floor(raw) - REWIND_SECONDS);
  return durationSeconds > 0 && at >= durationSeconds - 10 ? 0 : at;
}

/** Whole-number percentage of lessons complete. */
export function percentComplete(completed: number, total: number): number {
  return total > 0 ? Math.min(100, Math.round((100 * completed) / total)) : 0;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "";
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  if (h) return m ? `${h} h ${m} min` : `${h} h`;
  return `${Math.max(m, 1)} min`;
}
