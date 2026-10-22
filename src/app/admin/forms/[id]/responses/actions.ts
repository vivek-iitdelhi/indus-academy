"use server";

import { and, eq } from "drizzle-orm";
import { refresh } from "next/cache";
import { db } from "@/db";
import { formResponses } from "@/db/schema";
import { isUuid } from "@/lib/admin/ops";
import { requireAdminApi } from "@/lib/session";
import { deleteResponseFiles } from "./data";

/** Deletes one response and (best effort, afterwards) its attached files. */
export async function deleteResponse(formId: string, responseId: string) {
  const admin = await requireAdminApi();
  if (!isUuid(formId) || !isUuid(responseId)) return;
  const deleted = await db
    .delete(formResponses)
    .where(and(eq(formResponses.id, responseId), eq(formResponses.formId, formId)))
    .returning({ answers: formResponses.answers });
  console.info("[admin] form response deleted", { formId, responseId, by: admin.email });
  await deleteResponseFiles(formId, deleted.map((r) => r.answers));
  refresh();
}

/** Deletes every response of a form and (best effort, afterwards) their attached files. */
export async function deleteAllResponses(formId: string) {
  const admin = await requireAdminApi();
  if (!isUuid(formId)) return;
  const deleted = await db.delete(formResponses).where(eq(formResponses.formId, formId)).returning({ answers: formResponses.answers });
  console.info("[admin] all form responses deleted", { formId, count: deleted.length, by: admin.email });
  await deleteResponseFiles(formId, deleted.map((r) => r.answers));
  refresh();
}
