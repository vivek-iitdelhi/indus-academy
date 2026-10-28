import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, liveSessions } from "@/db/schema";
import { isUuid, licensedCourse } from "@/lib/distributors";
import { joinUrl, LiveBusy, liveConfigured, liveStatus } from "@/lib/live";
import { recordOpen } from "@/lib/live-attendance";
import { findLearner, isEnrolled, validExternalId } from "@/lib/lms/partners";
import { apiError, json, notFound, withDistributor } from "../../../_shared";
import { isV2, learnerNotFound, readJson } from "../../../_learners";

/** A room link for one of the client's learners, to put in an iframe on their page. v2: enrolled learners only. */
export const POST = withDistributor(async (distributor, request, { params }: RouteContext<"/api/v1/live-sessions/[id]/join">) => {
  const { id } = await params;
  if (!isUuid(id)) return notFound();
  const [row] = await db
    .select({ session: liveSessions, slug: courses.slug })
    .from(liveSessions)
    .innerJoin(courses, eq(liveSessions.courseId, courses.id))
    .where(eq(liveSessions.id, id));
  if (!row || !(await licensedCourse(distributor.id, row.slug))) return notFound();

  const body = (await readJson(request)) as { external_id?: unknown } | undefined;
  const externalId = typeof body?.external_id === "string" ? body.external_id : "";
  if (!validExternalId(externalId)) return apiError(400, "invalid_request", "Send the learner's external_id (PUT /learners/{external_id} first).");
  const learner = await findLearner(distributor.id, externalId);
  if (!learner) return learnerNotFound();
  if (isV2(request) && !(await isEnrolled(learner.userId, row.session.courseId))) {
    return apiError(409, "not_enrolled", "The learner has no active enrolment in this class's course.");
  }

  const status = liveStatus(row.session);
  if (status === "upcoming") return apiError(409, "not_open_yet", "The room opens 15 minutes before starts_at.");
  if (status === "ended") return apiError(409, "ended", "This class has ended; use recording_url from the live sessions list.");
  if (!liveConfigured()) return apiError(503, "live_unavailable", "Live classes are temporarily unavailable.");

  try {
    // Waits up to ~8 s in line when many learners join at once.
    const { url, expiresAt } = await joinUrl(row.session.webinarId, { userId: learner.userId, name: learner.name });
    await recordOpen(row.session.id, learner.userId, distributor.id);
    return json({ embed_url: url, expires_at: expiresAt.toISOString() });
  } catch (e) {
    if (e instanceof LiveBusy) {
      const message = "Many learners are joining right now. Retry after retry_after seconds.";
      return json({ error: { code: "live_busy", message, retry_after: e.retryAfter } }, 503, { "retry-after": String(e.retryAfter) });
    }
    console.error("[live] joinUrl failed", e);
    return apiError(503, "live_unavailable", "The class room could not be opened just now. Try again.");
  }
});
