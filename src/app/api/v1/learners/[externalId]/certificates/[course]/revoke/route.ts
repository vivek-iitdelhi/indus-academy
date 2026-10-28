import { getCourseBySlug } from "@/lib/lms/courses";
import { findLearner, learnerCertificates, revokeCertificate } from "@/lib/lms/partners";
import { apiError, json, withDistributor } from "../../../../../_shared";
import { completionJson, learnerNotFound } from "../../../../../_learners";

/** Revokes the learner's certificate. Permanent: the verify page says "revoked" from now on. */
export const POST = withDistributor(
  async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]/certificates/[course]/revoke">) => {
    const { externalId, course: slug } = await params;
    const learner = await findLearner(distributor.id, externalId);
    if (!learner) return learnerNotFound();
    const course = await getCourseBySlug(slug, { includeDrafts: true });
    if (!course || (await revokeCertificate(learner.userId, course.id)) === "not_issued") {
      return apiError(404, "not_issued", "No certificate has been issued for this course.");
    }
    const [row] = await learnerCertificates(learner.userId, course.id);
    return row ? json({ certificate: completionJson(row) }) : new Response(null, { status: 204 });
  },
);
