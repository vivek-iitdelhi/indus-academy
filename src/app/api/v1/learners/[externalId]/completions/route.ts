import { json, withDistributor } from "../../../_shared";
import { completeOne, completionJson, isV2, outcomeError, readJson } from "../../../_learners";

export const POST = withDistributor(
  async (distributor, request, { params }: RouteContext<"/api/v1/learners/[externalId]/completions">) => {
    const result = await completeOne(distributor.id, (await params).externalId, await readJson(request), undefined, isV2(request));
    if (!result.ok) return outcomeError(result);
    return json({ completion: completionJson(result.value) });
  },
);
