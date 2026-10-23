import { findLearner, learnerCertificates } from "@/lib/lms/partners";
import { json, withDistributor } from "../../../_shared";
import { completionJson, learnerNotFound } from "../../../_learners";

export const GET = withDistributor(
  async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]/certificates">) => {
    const learner = await findLearner(distributor.id, (await params).externalId);
    if (!learner) return learnerNotFound();
    return json({ certificates: (await learnerCertificates(learner.userId)).map(completionJson) });
  },
);
