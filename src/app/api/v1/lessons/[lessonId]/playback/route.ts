import { site } from "@/content/site";
import { licensedLesson } from "@/lib/distributors";
import { hlsManifestUrl, signPlaybackToken, thumbnailUrl, videoConfigured } from "@/lib/video";
import { apiError, json, notFound, withDistributor } from "../../../_shared";

const MIN_TTL = 5 * 60;
const MAX_TTL = 24 * 60 * 60;
const DEFAULT_TTL = 6 * 60 * 60;

export const GET = withDistributor(
  async (distributor, request, { params }: RouteContext<"/api/v1/lessons/[lessonId]/playback">) => {
    const raw = new URL(request.url).searchParams.get("ttl");
    const ttl = raw === null ? DEFAULT_TTL : Number(raw);
    if (!Number.isInteger(ttl) || ttl < MIN_TTL || ttl > MAX_TTL) {
      return apiError(400, "invalid_ttl", `ttl must be a whole number of seconds from ${MIN_TTL} to ${MAX_TTL}.`);
    }

    const lesson = await licensedLesson(distributor.id, (await params).lessonId);
    if (!lesson) return notFound();
    if (lesson.kind !== "video" || !lesson.videoUid || lesson.durationSeconds <= 0) {
      return apiError(409, "video_not_ready", "This lesson has no playable video yet.");
    }
    if (!videoConfigured()) return apiError(503, "video_unavailable", "Video playback is temporarily unavailable.");

    const expiresAt = new Date((Math.floor(Date.now() / 1000) + ttl) * 1000);
    const token = signPlaybackToken(lesson.videoUid, ttl);
    return json({
      // The public origin, not request.url: behind the AWS load balancer that is the container's
      // internal address, which partners' players cannot reach.
      hls: new URL(hlsManifestUrl(lesson.videoUid, token), site.url).href,
      thumbnail: thumbnailUrl(lesson.videoUid, ttl),
      expires_at: expiresAt.toISOString(),
    });
  },
);
