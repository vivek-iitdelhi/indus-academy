import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { formResponses } from "@/db/schema";
import { isUuid } from "@/lib/admin/ops";
import { requireAdminApi } from "@/lib/session";
import { formFileDownloadUrl, isFormFileKey, videoConfigured } from "@/lib/video";

/** Redirects to a short-lived download link for a file attached to one of the form's responses. */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/forms/[id]/file">) {
  await requireAdminApi();
  const { id } = await ctx.params;
  const key = new URL(request.url).searchParams.get("key");
  if (!isUuid(id) || !isFormFileKey(id, key)) return Response.json({ error: "No such file." }, { status: 404 });
  if (!videoConfigured()) return Response.json({ error: "File storage is not configured on this server." }, { status: 503 });

  // The file must belong to a response that still exists (a deleted response's files are gone).
  const match = sql`'$.*[*] ? (@.key == $k)', jsonb_build_object('k', ${key}::text)`;
  const [row] = await db
    .select({ name: sql<string | null>`jsonb_path_query_first(${formResponses.answers}, ${match}) ->> 'name'` })
    .from(formResponses)
    .where(and(eq(formResponses.formId, id), sql`jsonb_path_exists(${formResponses.answers}, ${match})`))
    .limit(1);
  if (!row) return Response.json({ error: "No such file." }, { status: 404 });
  return Response.redirect(formFileDownloadUrl(key, row.name || key.split("/").pop()!), 302);
}
