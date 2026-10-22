import Link from "next/link";
import { notFound } from "next/navigation";
import { eq, sql } from "drizzle-orm";
import { site } from "@/content/site";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { isUuid } from "@/lib/admin/courses";
import { requireAdmin } from "@/lib/session";
import { secondaryButtonClass } from "../../courses/form-ui";
import { AcceptingToggle, FormTabs, SendButton } from "../client";

// Header shared by the Questions, Responses and Settings tabs of one form.
export default async function FormLayout({ children, params }: LayoutProps<"/admin/forms/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [form] = await db
    .select({
      id: forms.id,
      slug: forms.slug,
      title: forms.title,
      accepting: forms.accepting,
      responseCount: sql<number>`(select count(*) from form_responses r where r.form_id = forms.id)::int`,
    })
    .from(forms)
    .where(eq(forms.id, id));
  if (!form) notFound();
  const publicUrl = `${site.url}/forms/${form.slug}`;

  return (
    <div>
      <Link href="/admin/forms" className="text-sm text-muted hover:text-ink">
        ← Forms
      </Link>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <h1 className="min-w-0 truncate text-3xl font-semibold tracking-[-0.03em]">{form.title}</h1>
        <div className="flex flex-wrap items-center gap-2">
          <AcceptingToggle formId={form.id} accepting={form.accepting} />
          <a href={`/forms/${form.slug}?preview=1`} target="_blank" className={secondaryButtonClass} title="Preview">
            Preview
          </a>
          <a href={`/forms/${form.slug}?prefill=1`} target="_blank" className={secondaryButtonClass}>
            Get pre-filled link
          </a>
          <SendButton url={publicUrl} />
        </div>
      </div>
      <FormTabs formId={form.id} responseCount={form.responseCount} />
      <div className="mt-8">{children}</div>
    </div>
  );
}
