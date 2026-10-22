import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/session";
import { ConfirmButton } from "../../../courses/client";
import { btn, pageParam, param } from "../../../learners/admin-ui";
import { deleteAllResponses } from "./actions";
import { countResponses, findForm } from "./data";
import { IndividualView, QuestionView, SummaryView, WaitingForResponses } from "./views";

const views = [
  ["summary", "Summary"],
  ["question", "Question"],
  ["individual", "Individual"],
] as const;

// The Responses tab (the layout above renders the form header and tabs).
export default async function FormResponsesPage({ params, searchParams }: PageProps<"/admin/forms/[id]/responses">) {
  await requireAdmin();
  const { id } = await params;
  const sp = await searchParams;
  const form = await findForm(id);
  if (!form) notFound();
  const total = await countResponses(form.id);
  const view = views.find(([v]) => v === param(sp.view))?.[0] ?? "summary";

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-2xl font-semibold tracking-tight">
          {total} response{total === 1 ? "" : "s"}
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          {total > 0 && (
            <>
              <a href={`/api/admin/forms/${form.id}/export`} className={btn}>
                Download responses (.csv)
              </a>
              <form action={deleteAllResponses.bind(null, form.id)}>
                <ConfirmButton message={`Delete all ${total} responses and their uploaded files? This can't be undone.`} className={`${btn} text-red-800`}>
                  Delete all responses
                </ConfirmButton>
              </form>
            </>
          )}
        </div>
      </div>

      <nav aria-label="Responses view" className="mt-6 flex gap-2">
        {views.map(([v, label]) => (
          <Link
            key={v}
            href={`/admin/forms/${form.id}/responses?view=${v}`}
            aria-current={v === view ? "page" : undefined}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${v === view ? "bg-ink text-paper" : "border border-ink/15 hover:border-ink/40"}`}
          >
            {label}
          </Link>
        ))}
      </nav>

      {total === 0 ? (
        <WaitingForResponses slug={form.slug} />
      ) : view === "question" ? (
        <QuestionView form={form} qid={param(sp.q)} page={pageParam(sp.page)} />
      ) : view === "individual" ? (
        <IndividualView form={form} n={pageParam(sp.n)} total={total} />
      ) : (
        <SummaryView form={form} />
      )}
    </div>
  );
}
