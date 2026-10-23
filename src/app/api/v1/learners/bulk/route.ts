import { apiError, json, withDistributor } from "../../_shared";
import { putLearner, readJson } from "../../_learners";

const MAX_ITEMS = 500;

// ponytail: items run one after another (a few queries each); 500 takes a few seconds.
export const POST = withDistributor(async (distributor, request) => {
  const items = ((await readJson(request)) as { learners?: unknown } | undefined)?.learners;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
    return apiError(400, "invalid_request", `\`learners\` must be an array of 1–${MAX_ITEMS} items.`);
  }
  const results = [];
  for (const [index, item] of items.entries()) {
    const externalId = (item as { external_id?: unknown } | null)?.external_id;
    const result = await putLearner(distributor.id, typeof externalId === "string" ? externalId : "", item);
    results.push(result.ok ? { index, ok: true } : { index, ok: false, error: { code: result.code, message: result.message } });
  }
  return json({ results });
});
