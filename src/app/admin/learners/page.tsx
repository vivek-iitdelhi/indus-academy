import { requireAdmin } from "@/lib/session";

// Placeholder: the feature agent for this section replaces this file.
export default async function AdminLearnersPage() {
  await requireAdmin();
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">Learners</h1>
      <p className="mt-4 text-muted">Coming soon.</p>
    </div>
  );
}
