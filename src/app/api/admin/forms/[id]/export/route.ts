import { allResponses, findForm } from "@/app/admin/forms/[id]/responses/data";
import { responsesCsv } from "@/lib/forms/export";
import { requireAdminApi } from "@/lib/session";

/** All responses of a form as a CSV sheet, with a BOM so Excel reads it as UTF-8. */
export async function GET(_request: Request, ctx: RouteContext<"/api/admin/forms/[id]/export">) {
  await requireAdminApi();
  const form = await findForm((await ctx.params).id);
  if (!form) return Response.json({ error: "No such form." }, { status: 404 });
  const csv = responsesCsv(form, await allResponses(form.id));
  return new Response(`﻿${csv}`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${form.slug}-responses.csv"`,
      "cache-control": "no-store",
    },
  });
}
