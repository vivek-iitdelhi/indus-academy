import { findLearner, learnerCertificates } from "@/lib/lms/partners";
import { getCourseBySlug } from "@/lib/lms/courses";
import { apiError, json, withDistributor } from "../../../../_shared";
import { completionJson, learnerNotFound, notCompleted } from "../../../../_learners";

export const GET = withDistributor(
  async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]/certificates/[course]">) => {
    const { externalId, course: slug } = await params;
    const learner = await findLearner(distributor.id, externalId);
    if (!learner) return learnerNotFound();
    const course = await getCourseBySlug(slug, { includeDrafts: true });
    const [row] = course ? await learnerCertificates(learner.userId, course.id) : [];
    if (!row) return notCompleted();
    if (row.status === "pending_payment") {
      return apiError(402, "payment_pending", `Payment for batch ${row.batch} is not completed.`);
    }
    if (row.status === "pending_release") return apiError(409, "certificate_pending", "The certificate has not been released yet.");
    if (row.status === "not_offered") return apiError(409, "certificate_not_offered", "This course does not award certificates.");
    return json(completionJson(row)); // released or revoked
  },
);
