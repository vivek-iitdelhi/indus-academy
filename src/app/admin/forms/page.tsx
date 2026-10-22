import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { formTemplates } from "@/lib/forms/templates";
import { requireAdmin } from "@/lib/session";
import { ConfirmButton } from "../courses/client";
import { cardClass, miniButtonClass } from "../courses/form-ui";
import { Badge, PageTitle, Table } from "../learners/admin-ui";
import { createForm, deleteForm, duplicateForm } from "./actions";

const plural = (n: number, word: string) => `${n.toLocaleString("en-IN")} ${word}${n === 1 ? "" : "s"}`;

export default async function AdminFormsPage() {
  await requireAdmin();
  const rows = await db
    .select({
      id: forms.id,
      title: forms.title,
      slug: forms.slug,
      accepting: forms.accepting,
      updatedAt: forms.updatedAt,
      // Raw names: see the courses list for why the subquery can't use drizzle columns.
      responseCount: sql<number>`(select count(*) from form_responses r where r.form_id = forms.id)::int`,
    })
    .from(forms)
    .orderBy(desc(forms.updatedAt));

  return (
    <div>
      <PageTitle intro="Google Forms-style forms: enrolments, applications, feedback. Each one has a public link.">Forms</PageTitle>

      <section className="mt-8">
        <h2 className="text-sm font-medium text-muted">Start a new form</h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {Object.entries(formTemplates).map(([id, { label }]) => (
            <form key={id} action={createForm.bind(null, id)}>
              <button className={`${cardClass} w-56 text-left transition-colors hover:border-pine`}>
                <span className="block text-2xl text-pine" aria-hidden>
                  {id === "blank" ? "+" : "≡"}
                </span>
                <span className="mt-2 block font-medium">{label}</span>
                <span className="block text-xs text-muted">{id === "blank" ? "One question to start" : "Template, ready to edit"}</span>
              </button>
            </form>
          ))}
        </div>
      </section>

      <Table head={["Form", "Responses", "Status", "Updated", ""]} empty="No forms yet.">
        {rows.map((form) => (
          <tr key={form.id}>
            <td>
              <Link href={`/admin/forms/${form.id}`} className="font-medium hover:text-pine hover:underline">
                {form.title}
              </Link>
              <a href={`/forms/${form.slug}`} target="_blank" className="block font-mono text-xs text-muted hover:text-pine">
                /forms/{form.slug}
              </a>
            </td>
            <td className="tabular-nums">
              <Link href={`/admin/forms/${form.id}/responses`} className="hover:text-pine hover:underline">
                {plural(form.responseCount, "response")}
              </Link>
            </td>
            <td>{form.accepting ? <Badge tone="good">Accepting</Badge> : <Badge>Closed</Badge>}</td>
            <td className="whitespace-nowrap text-muted">
              {form.updatedAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
            </td>
            <td>
              <div className="flex justify-end gap-1">
                <Link href={`/admin/forms/${form.id}`} className={miniButtonClass}>
                  Edit
                </Link>
                <form action={duplicateForm.bind(null, form.id)}>
                  <button className={miniButtonClass}>Duplicate</button>
                </form>
                <form action={deleteForm.bind(null, form.id)}>
                  <ConfirmButton
                    message={`Delete “${form.title}”${form.responseCount ? ` and its ${plural(form.responseCount, "response")} (with uploaded files)` : ""}? This can't be undone.`}
                    className={`${miniButtonClass} text-red-800`}
                  >
                    Delete
                  </ConfirmButton>
                </form>
              </div>
            </td>
          </tr>
        ))}
      </Table>
    </div>
  );
}
