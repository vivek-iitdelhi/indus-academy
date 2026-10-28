import { eraseLearner, findLearner } from "@/lib/lms/partners";
import { json, withDistributor } from "../../_shared";
import { learnerJson, learnerNotFound, outcomeError, putLearner, readJson } from "../../_learners";

export const GET = withDistributor(async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]">) => {
  const learner = await findLearner(distributor.id, (await params).externalId);
  return learner ? json({ learner: learnerJson(learner) }) : learnerNotFound();
});

export const PUT = withDistributor(async (distributor, request, { params }: RouteContext<"/api/v1/learners/[externalId]">) => {
  const result = await putLearner(distributor.id, (await params).externalId, await readJson(request));
  if (!result.ok) return outcomeError(result);
  const { learner, created, unchanged } = result.value;
  return json({ learner: learnerJson(learner), certificate_names_unchanged: unchanged }, created ? 201 : 200);
});

/** Erases the learner (for a data-deletion request). Their certificates are revoked. */
export const DELETE = withDistributor(async (distributor, _request, { params }: RouteContext<"/api/v1/learners/[externalId]">) => {
  if (!(await eraseLearner(distributor.id, (await params).externalId))) return learnerNotFound();
  return new Response(null, { status: 204, headers: { "cache-control": "no-store" } });
});
