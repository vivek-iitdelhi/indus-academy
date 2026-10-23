import { findLearner, undoCompletion } from "@/lib/lms/partners";
import { getCourseBySlug } from "@/lib/lms/courses";
import { apiError, withDistributor } from "../../../../_shared";
import { learnerNotFound, notCompleted } from "../../../../_learners";

export const DELETE = withDistributor(
  async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]/completions/[course]">) => {
    const { externalId, course: slug } = await params;
    const learner = await findLearner(distributor.id, externalId);
    if (!learner) return learnerNotFound();
    // Any status: the learner's own enrolment is what limits this, and a course may be archived since.
    const course = await getCourseBySlug(slug, { includeDrafts: true });
    const outcome = course ? await undoCompletion(learner.userId, course.id) : "not_completed";
    if (outcome === "not_completed") return notCompleted();
    if (outcome === "released") {
      return apiError(409, "certificate_released", "The certificate is already released. Ask us to revoke it instead.");
    }
    return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
  },
);
