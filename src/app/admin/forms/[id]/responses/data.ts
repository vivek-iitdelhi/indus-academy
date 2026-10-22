import { asc, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { formResponses, forms } from "@/db/schema";
import { isUuid } from "@/lib/admin/ops";
import { responseFiles } from "@/lib/forms/export";
import type { Answers } from "@/lib/forms/types";
import { deleteFormFile, isFormFileKey, videoConfigured } from "@/lib/video";

// Shared by the responses page, its actions and the export / file route handlers.

// ponytail: summary and CSV read at most this many responses into memory; past that, stream
// the CSV in batches and aggregate the summary in SQL.
export const MAX_RESPONSES = 10_000;

export async function findForm(id: string) {
  if (!isUuid(id)) return undefined;
  const [form] = await db.select().from(forms).where(eq(forms.id, id));
  return form;
}

export async function countResponses(formId: string) {
  const [row] = await db.select({ n: count() }).from(formResponses).where(eq(formResponses.formId, formId));
  return row.n;
}

/** Oldest first, like the Google Forms sheet. */
export const allResponses = (formId: string) =>
  db
    .select({ id: formResponses.id, createdAt: formResponses.createdAt, email: formResponses.email, answers: formResponses.answers })
    .from(formResponses)
    .where(eq(formResponses.formId, formId))
    .orderBy(asc(formResponses.createdAt), asc(formResponses.id))
    .limit(MAX_RESPONSES);

/** Best effort: deletes the attachments of deleted responses; failures are logged, not thrown. */
export async function deleteResponseFiles(formId: string, answers: Answers[]) {
  const keys = answers.flatMap(responseFiles).map((f) => f.key).filter((key) => isFormFileKey(formId, key));
  if (!keys.length) return;
  if (!videoConfigured()) return console.error("[admin] form files not deleted: storage is not configured", { formId, keys: keys.length });
  for (let i = 0; i < keys.length; i += 20) {
    const batch = keys.slice(i, i + 20);
    const results = await Promise.allSettled(batch.map(deleteFormFile));
    results.forEach((r, j) => r.status === "rejected" && console.error("[admin] form file delete failed", batch[j], r.reason));
  }
}
