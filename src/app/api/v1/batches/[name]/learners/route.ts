import { batchMembers } from "@/lib/lms/partners";
import { json, notFound, withDistributor } from "../../../_shared";
import { badPage, page, pageParams } from "../../../_learners";

/** A batch's enrolments, for reconciling what we bill against what your agents collected. */
export const GET = withDistributor(async (distributor, request, { params }: RouteContext<"/api/v1/batches/[name]/learners">) => {
  const paging = pageParams(request);
  if (!paging) return badPage();
  const soldBy = new URL(request.url).searchParams.get("sold_by") || undefined;
  const found = await batchMembers(distributor.id, (await params).name, { ...paging, soldBy });
  if (!found) return notFound();
  const { items, next_cursor } = page(found.rows, paging.limit, (r) => r.id);
  return json({
    batch: found.batch.name,
    learners: items.map((r) => ({
      external_id: r.externalId,
      course: r.courseSlug,
      status: r.status === "active" ? (r.completedAt ? "completed" : "enrolled") : "cancelled",
      sold_by: r.soldBy,
      centre: r.centre,
      enrolled_at: r.enrolledAt.toISOString(),
      completed_at: r.completedAt?.toISOString() ?? null,
      cancelled_at: r.cancelledAt?.toISOString() ?? null,
      certificate: r.completedAt || r.certificate ? { status: r.certificateStatus, serial: r.certificate?.serial ?? null } : null,
    })),
    next_cursor,
  });
});
