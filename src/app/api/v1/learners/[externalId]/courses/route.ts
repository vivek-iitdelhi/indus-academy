import { findLearner, learnerCourses } from "@/lib/lms/partners";
import { json, withDistributor } from "../../../_shared";
import { learnerCourseJson, learnerNotFound } from "../../../_learners";

export const GET = withDistributor(
  async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]/courses">) => {
    const learner = await findLearner(distributor.id, (await params).externalId);
    if (!learner) return learnerNotFound();
    return json({ courses: (await learnerCourses(learner.userId)).map(learnerCourseJson) });
  },
);
