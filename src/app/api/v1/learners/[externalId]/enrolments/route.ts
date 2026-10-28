import { learnerCourses } from "@/lib/lms/partners";
import { json, withDistributor } from "../../../_shared";
import { enrolOne, learnerCourseJson, outcomeError, readJson } from "../../../_learners";

export const POST = withDistributor(
  async (distributor, request, { params }: RouteContext<"/api/v1/learners/[externalId]/enrolments">) => {
    const result = await enrolOne(distributor.id, (await params).externalId, await readJson(request));
    if (!result.ok) return outcomeError(result);
    const { learner, course, created } = result.value;
    const row = (await learnerCourses(learner.userId)).find((c) => c.courseSlug === course.slug)!;
    return json({ enrolment: learnerCourseJson(row) }, created ? 201 : 200);
  },
);
