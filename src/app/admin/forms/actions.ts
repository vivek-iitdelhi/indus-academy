"use server";

import { eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { db } from "@/db";
import { formResponses, forms } from "@/db/schema";
import { isUuid, uniqueSlug } from "@/lib/admin/courses";
import { copyTitle, formFileKeys, normalizeItems, parseSettings } from "@/lib/admin/forms";
import { formTemplates } from "@/lib/forms/templates";
import { requireAdminApi } from "@/lib/session";
import { deleteFormFile, videoConfigured } from "@/lib/video";
import type { ActionResult } from "../courses/actions";
import { SLUG_PATTERN, slugify } from "../courses/slug";

export type { ActionResult };

// Public form pages are dynamic, so there is no catalogue cache to revalidate: refresh()
// re-renders the admin page the action was called from.

const isUniqueViolation = (e: unknown) => {
  const err = e as { code?: string; cause?: { code?: string } };
  return err?.code === "23505" || err?.cause?.code === "23505";
};

async function findForm(formId: string) {
  if (!isUuid(formId)) notFound();
  const [form] = await db.select().from(forms).where(eq(forms.id, formId));
  if (!form) notFound();
  return form;
}

/** A free slug for `title`. Racing another admin can still collide: the insert then fails loudly. */
async function freeSlug(title: string) {
  const taken = await db.select({ slug: forms.slug }).from(forms);
  return uniqueSlug(slugify(title) || "form", taken.map((t) => t.slug));
}

export async function createForm(template: string) {
  const admin = await requireAdminApi();
  if (!Object.hasOwn(formTemplates, template)) notFound();
  const { title, description, items, settings } = formTemplates[template as keyof typeof formTemplates].build();
  const [{ id }] = await db
    .insert(forms)
    .values({ title, description, items, settings, slug: await freeSlug(title), createdBy: admin.email })
    .returning({ id: forms.id });
  redirect(`/admin/forms/${id}`);
}

/** Questions and settings only: the copy starts closed, with no responses. */
export async function duplicateForm(formId: string) {
  const admin = await requireAdminApi();
  const form = await findForm(formId);
  const title = copyTitle(form.title);
  await db.insert(forms).values({
    title,
    description: form.description,
    items: form.items,
    settings: form.settings,
    slug: await freeSlug(title),
    createdBy: admin.email,
  });
  refresh();
}

export async function deleteForm(formId: string) {
  await requireAdminApi();
  const form = await findForm(formId);
  const rows = await db.select({ answers: formResponses.answers }).from(formResponses).where(eq(formResponses.formId, form.id));
  await db.delete(forms).where(eq(forms.id, form.id)); // responses cascade
  // Best effort: a failed delete leaves an orphan in the bucket, not a broken form list.
  if (videoConfigured()) {
    for (const key of rows.flatMap((r) => formFileKeys(r.answers))) {
      await deleteFormFile(key).catch((e) => console.error(`deleteFormFile ${key} failed`, e));
    }
  }
  refresh();
}

export async function setAccepting(formId: string, accepting: boolean): Promise<ActionResult> {
  await requireAdminApi();
  if (!isUuid(formId) || typeof accepting !== "boolean") notFound();
  const updated = await db.update(forms).set({ accepting }).where(eq(forms.id, formId)).returning({ id: forms.id });
  if (!updated.length) notFound();
  refresh();
  return { ok: accepting ? "Accepting responses." : "Not accepting responses." };
}

/** The Questions tab's autosave: header and every item, replaced as a whole. */
export async function saveItems(formId: string, items: unknown, title: unknown, description: unknown): Promise<ActionResult> {
  await requireAdminApi();
  if (!isUuid(formId)) notFound();
  const normalized = normalizeItems(items);
  if (!Array.isArray(normalized)) return { error: normalized.error };
  const updated = await db
    .update(forms)
    .set({
      items: normalized,
      title: (typeof title === "string" && title.trim().slice(0, 300)) || "Untitled form",
      description: typeof description === "string" ? description.trim().slice(0, 5000) : "",
    })
    .where(eq(forms.id, formId))
    .returning({ id: forms.id });
  if (!updated.length) return { error: "This form has been deleted." };
  refresh(); // the header shows the title
  return { ok: "All changes saved" };
}

export async function updateSettings(formId: string, form: FormData): Promise<ActionResult> {
  await requireAdminApi();
  const existing = await findForm(formId);
  const slug = String(form.get("slug") ?? "").trim();
  if (!SLUG_PATTERN.test(slug) || slug.length > 80) return { error: "Link: lowercase letters, numbers and hyphens only (up to 80)." };
  const parsed = parseSettings(form);
  if ("error" in parsed) return parsed;
  try {
    await db.update(forms).set({ slug, settings: parsed.settings }).where(eq(forms.id, existing.id));
  } catch (e) {
    if (isUniqueViolation(e)) return { error: `Another form already uses the link /forms/${slug}.` };
    throw e;
  }
  refresh();
  return { ok: "Saved." };
}
