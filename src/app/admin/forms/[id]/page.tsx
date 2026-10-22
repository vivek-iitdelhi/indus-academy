import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { isUuid } from "@/lib/admin/courses";
import { requireAdmin } from "@/lib/session";
import { FormEditor } from "./editor";

export default async function FormQuestionsPage({ params }: PageProps<"/admin/forms/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [form] = await db.select().from(forms).where(eq(forms.id, id));
  if (!form) notFound();
  return (
    <FormEditor
      formId={form.id}
      color={form.settings.theme.color}
      initial={{ title: form.title, description: form.description, items: form.items }}
    />
  );
}
