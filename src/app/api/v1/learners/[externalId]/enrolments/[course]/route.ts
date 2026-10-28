import { getCourseBySlug } from "@/lib/lms/courses";
import { cancelEnrolment, findLearner } from "@/lib/lms/partners";
import { apiError, withDistributor } from "../../../../_shared";
import { learnerNotFound } from "../../../../_learners";

/** Cancels an enrolment (a refund, say): it stops counting in its batch and its videos stop playing. */
export const DELETE = withDistributor(
  async (distributor, request, { params }: RouteContext<"/api/v1/learners/[externalId]/enrolments/[course]">) => {
    const { externalId, course: slug } = await params;
    const learner = await findLearner(distributor.id, externalId);
    if (!learner) return learnerNotFound();
    const reason = new URL(request.url).searchParams.get("reason")?.trim().slice(0, 100) || null;
    // Any status, like DELETE /completions: the course may have been archived since.
    const course = await getCourseBySlug(slug, { includeDrafts: true });
    const outcome = course ? await cancelEnrolment(learner.userId, course.id, reason) : "not_enrolled";
    if (outcome === "not_enrolled") return apiError(404, "not_enrolled", "The learner is not enrolled in this course.");
    if (outcome === "certificate_released") {
      return apiError(409, "certificate_released", "The certificate is already out. Revoke it first: POST …/certificates/{course}/revoke.");
    }
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  },
);
