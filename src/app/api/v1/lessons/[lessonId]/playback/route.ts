import { and, eq } from "drizzle-orm";
import { site } from "@/content/site";
import { db } from "@/db";
import { enrollments, lessons } from "@/db/schema";
import { isUuid, licensedLesson } from "@/lib/distributors";
import { findLearner, notePlay } from "@/lib/lms/partners";
import { signPlaybackToken, thumbnailUrl, videoConfigured } from "@/lib/video";
import { apiError, json, notFound, withDistributor } from "../../../_shared";
import { isV2, learnerNotFound } from "../../../_learners";

const MIN_TTL = 5 * 60;
const MAX_TTL = 24 * 60 * 60;
const DEFAULT_TTL = 6 * 60 * 60;

/**
 * A lesson of a course that is no longer published or licensed, for a learner still enrolled in
 * it: they keep what they paid for.
 */
async function enrolledLesson(distributorId: string, userId: string, lessonId: string) {
  if (!isUuid(lessonId)) return null;
  const [row] = await db
    .select({ lesson: lessons })
    .from(lessons)
    .innerJoin(enrollments, and(eq(enrollments.courseId, lessons.courseId), eq(enrollments.userId, userId)))
    .where(and(eq(lessons.id, lessonId), eq(enrollments.distributorId, distributorId), eq(enrollments.status, "active")));
  return row?.lesson ?? null;
}

// v1: `learner` is optional and never blocks playback. v2: it is required, and the learner must
// have an active, unexpired enrolment in the lesson's course.
export const GET = withDistributor(
  async (distributor, request, { params }: RouteContext<"/api/v1/lessons/[lessonId]/playback">) => {
    const search = new URL(request.url).searchParams;
    const raw = search.get("ttl");
    const ttl = raw === null ? DEFAULT_TTL : Number(raw);
    if (!Number.isInteger(ttl) || ttl < MIN_TTL || ttl > MAX_TTL) {
      return apiError(400, "invalid_ttl", `ttl must be a whole number of seconds from ${MIN_TTL} to ${MAX_TTL}.`);
    }
    const strict = isV2(request);
    const externalId = search.get("learner");
    if (strict && !externalId) return apiError(400, "invalid_request", "`learner` is required: the learner's external_id.");
    const learner = externalId ? await findLearner(distributor.id, externalId) : null;
    if (externalId && !learner) return learnerNotFound();

    const { lessonId } = await params;
    const lesson = (await licensedLesson(distributor.id, lessonId)) ?? (learner && (await enrolledLesson(distributor.id, learner.userId, lessonId)));
    if (!lesson) return notFound();
    if (lesson.kind !== "video" || !lesson.videoUid || lesson.durationSeconds <= 0) {
      return apiError(409, "video_not_ready", "This lesson has no playable video yet.");
    }
    if (learner && !(await notePlay(learner.userId, lesson.courseId)) && strict) {
      return apiError(403, "not_enrolled", "The learner has no active enrolment in this course (not enrolled, cancelled or expired).");
    }
    if (!videoConfigured()) return apiError(503, "video_unavailable", "Video playback is temporarily unavailable.");

    const expiresAt = new Date((Math.floor(Date.now() / 1000) + ttl) * 1000);
    const token = signPlaybackToken(lesson.videoUid, ttl);
    // A player page to embed, not a playlist: the segments are encrypted and only our player
    // (on our origin) can fetch the key, so nothing a partner receives is downloadable.
    return json({
      embed_url: `${site.url}/embed/${lesson.videoUid}?t=${encodeURIComponent(token)}`,
      thumbnail: thumbnailUrl(lesson.videoUid, ttl),
      expires_at: expiresAt.toISOString(),
    });
  },
);
