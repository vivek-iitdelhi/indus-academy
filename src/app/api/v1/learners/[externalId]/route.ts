import { json, withDistributor } from "../../_shared";
import { learnerJson, outcomeError, putLearner, readJson } from "../../_learners";

export const PUT = withDistributor(async (distributor, request, { params }: RouteContext<"/api/v1/learners/[externalId]">) => {
  const result = await putLearner(distributor.id, (await params).externalId, await readJson(request));
  if (!result.ok) return outcomeError(result);
  return json({ learner: learnerJson(result.value.learner) }, result.value.created ? 201 : 200);
});
