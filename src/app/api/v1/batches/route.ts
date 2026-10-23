import { listBatches } from "@/lib/lms/partners";
import { json, withDistributor } from "../_shared";

export const GET = withDistributor(async (distributor) => {
  const rows = await listBatches(distributor.id);
  return json({
    batches: rows.map(({ batch, learners, completed, released }) => ({
      name: batch.name,
      paid: batch.paidAt !== null,
      paid_at: batch.paidAt?.toISOString() ?? null,
      learners,
      completed,
      released,
    })),
  });
});
