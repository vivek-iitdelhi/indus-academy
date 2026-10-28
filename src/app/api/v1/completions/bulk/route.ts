import type { Course } from "@/db/schema";
import { apiError, json, withDistributor } from "../../_shared";
import { completeOne, isV2, readJson } from "../../_learners";

const MAX_ITEMS = 500;

export const POST = withDistributor(async (distributor, request) => {
  const items = ((await readJson(request)) as { completions?: unknown } | undefined)?.completions;
  if (!Array.isArray(items) || items.length < 1 || items.length > MAX_ITEMS) {
    return apiError(400, "invalid_request", `\`completions\` must be an array of 1–${MAX_ITEMS} items.`);
  }
  const courseCache = new Map<string, Course | null>();
  const strict = isV2(request);
  const results = [];
  for (const [index, item] of items.entries()) {
    const externalId = (item as { external_id?: unknown } | null)?.external_id;
    const result = await completeOne(distributor.id, typeof externalId === "string" ? externalId : "", item, courseCache, strict);
    results.push(
      result.ok
        ? { index, ok: true, certificate: { status: result.value.status } }
        : { index, ok: false, error: { code: result.code, message: result.message } },
    );
  }
  return json({ results });
});
