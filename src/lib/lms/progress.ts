import { and, eq, sql } from "drizzle-orm";
import { db } from "../../db/index.ts";
import { lessonProgress, lessons, type Certificate, type LessonProgress } from "../../db/schema.ts";
import { hasAccess } from "./access.ts";
import { onLessonCompleted } from "./completion.ts";

/**
 * What the player sends, at most every 15 s while playing plus on pause/exit.
 * `position`: current playhead in seconds. `watchedDelta`: media seconds actually
 * played since the last report (not wall time, not seek distance).
 */
export type ProgressReport = { position: number; watchedDelta: number };
export type ProgressState = Pick<LessonProgress, "secondsWatched" | "furthestSeconds" | "completedAt"> & {
  /** When the previous report was saved; bounds progress by real time elapsed. */
  updatedAt?: Date;
};

export const MAX_WATCHED_DELTA = 30; // one 15 s report at up to 2x speed
export const SEEK_TOLERANCE_SECONDS = 5; // report jitter and rounding
export const COMPLETION_RATIO = 0.9;
/** 2x playback plus slack for request timing: the most media time per second of real time. */
export const MAX_ADVANCE_PER_SECOND = 2.2;

const EMPTY: ProgressState = { secondsWatched: 0, furthestSeconds: 0, completedAt: null };
const clamp = (n: number, min: number, max: number) => Math.min(Math.max(Number.isFinite(n) ? n : 0, min), max);

/**
 * Pure. Anti-scrub rule: the high-water mark can only advance by what was actually
 * played (watchedDelta, capped at 30) plus a 5 s tolerance beyond its previous value.
 * Dragging the scrubber to the end therefore moves nothing; only watching does. The advance
 * is also capped by the real time since the previous report (2.2x), so a script firing
 * reports cannot finish a video faster than watching it at double speed.
 * Completion is set once when furthest >= 90% of duration and is never cleared.
 */
export function applyProgressReport(
  prev: ProgressState | null | undefined,
  report: ProgressReport,
  durationSeconds: number,
  now: Date,
): ProgressState {
  const state = prev ?? EMPTY;
  const delta = Math.floor(clamp(report.watchedDelta, 0, MAX_WATCHED_DELTA));
  const position = Math.floor(clamp(report.position, 0, Math.max(durationSeconds, 0)));
  const elapsed = state.updatedAt ? Math.max(now.getTime() - state.updatedAt.getTime(), 0) / 1000 : Infinity;
  const reachable = state.furthestSeconds + Math.floor(Math.min(delta + SEEK_TOLERANCE_SECONDS, MAX_ADVANCE_PER_SECOND * elapsed));
  const furthestSeconds = Math.max(state.furthestSeconds, Math.min(position, reachable));
  const reachedEnd = durationSeconds > 0 && furthestSeconds >= COMPLETION_RATIO * durationSeconds;
  return {
    secondsWatched: state.secondsWatched + delta,
    furthestSeconds,
    completedAt: state.completedAt ?? (reachedEnd ? now : null),
  };
}

/**
 * Records a progress report for a video lesson. Returns null when the learner has no
 * access (preview viewers are not tracked) or the lesson does not exist. When this
 * report completes the lesson, runs onLessonCompleted, which may issue a certificate.
 */
export async function recordProgress(
  userId: string,
  lessonId: string,
  report: ProgressReport,
): Promise<{ progress: ProgressState; newlyCompleted: boolean; certificate: Certificate | null } | null> {
  const [lesson] = await db
    .select({ courseId: lessons.courseId, durationSeconds: lessons.durationSeconds })
    .from(lessons)
    .where(eq(lessons.id, lessonId));
  if (!lesson || !(await hasAccess(userId, lesson.courseId))) return null;

  const [prev] = await db
    .select()
    .from(lessonProgress)
    .where(and(eq(lessonProgress.userId, userId), eq(lessonProgress.lessonId, lessonId)));
  const next = applyProgressReport(prev, report, lesson.durationSeconds, new Date());

  // Concurrent tabs: GREATEST/COALESCE keep the merge monotonic whatever order writes land in.
  await db
    .insert(lessonProgress)
    .values({ userId, lessonId, ...next })
    .onConflictDoUpdate({
      target: [lessonProgress.userId, lessonProgress.lessonId],
      set: {
        secondsWatched: sql`${lessonProgress.secondsWatched} + ${next.secondsWatched - (prev?.secondsWatched ?? 0)}`,
        furthestSeconds: sql`greatest(${lessonProgress.furthestSeconds}, excluded.furthest_seconds)`,
        completedAt: sql`coalesce(${lessonProgress.completedAt}, excluded.completed_at)`,
        updatedAt: new Date(),
      },
    });

  const newlyCompleted = !prev?.completedAt && Boolean(next.completedAt);
  const certificate = newlyCompleted ? await onLessonCompleted(userId, lesson.courseId) : null;
  return { progress: next, newlyCompleted, certificate };
}

/** The learner's progress rows for one course (feeds nextIncompleteLesson etc.). */
export async function getCourseProgress(userId: string, courseId: string): Promise<LessonProgress[]> {
  const rows = await db
    .select({ progress: lessonProgress })
    .from(lessonProgress)
    .innerJoin(lessons, eq(lessonProgress.lessonId, lessons.id))
    .where(and(eq(lessonProgress.userId, userId), eq(lessons.courseId, courseId)));
  return rows.map((r) => r.progress);
}
