import { listLearners } from "@/lib/lms/partners";
import { apiError, json, withDistributor } from "../_shared";
import { badPage, learnerJson, page, pageParams } from "../_learners";

/** The client's learners by external id, a page at a time; `updated_since` for a sync. */
export const GET = withDistributor(async (distributor, request) => {
  const paging = pageParams(request);
  if (!paging) return badPage();
  const raw = new URL(request.url).searchParams.get("updated_since");
  const updatedSince = raw === null ? undefined : new Date(raw);
  if (updatedSince && Number.isNaN(updatedSince.getTime())) {
    return apiError(400, "invalid_request", "`updated_since` must be an ISO 8601 timestamp.");
  }
  const rows = await listLearners(distributor.id, { ...paging, updatedSince });
  const { items, next_cursor } = page(rows, paging.limit, (r) => r.learner.externalId);
  return json({ learners: items.map((r) => learnerJson({ ...r.learner, name: r.name })), next_cursor });
});
