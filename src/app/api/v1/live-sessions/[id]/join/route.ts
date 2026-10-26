import { eq } from "drizzle-orm";
import { db } from "@/db";
import { courses, liveSessions } from "@/db/schema";
import { isUuid, licensedCourse } from "@/lib/distributors";
import { joinUrl, liveConfigured, liveStatus } from "@/lib/live";
import { recordOpen } from "@/lib/live-attendance";
import { findLearner, validExternalId } from "@/lib/lms/partners";
import { apiError, json, notFound, withDistributor } from "../../../_shared";
import { learnerNotFound, readJson } from "../../../_learners";

/** A room link for one of the client's learners, to put in an iframe on their page. */
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

  const status = liveStatus(row.session);
  if (status === "upcoming") return apiError(409, "not_open_yet", "The room opens 15 minutes before starts_at.");
  if (status === "ended") return apiError(409, "ended", "This class has ended; use recording_url from the live sessions list.");
  if (!liveConfigured()) return apiError(503, "live_unavailable", "Live classes are temporarily unavailable.");

  await recordOpen(row.session.id, learner.userId, distributor.id);
  try {
    const { url, expiresAt } = await joinUrl(row.session.webinarId, { userId: learner.userId, name: learner.name });
    return json({ embed_url: url, expires_at: expiresAt.toISOString() });
  } catch (e) {
    console.error("[live] joinUrl failed", e);
    return apiError(503, "live_unavailable", "The class room could not be opened just now. Try again.");
  }
});
