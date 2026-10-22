import type { NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { fileAccepted } from "@/lib/forms/logic";
import { getUser, isAdminEmail } from "@/lib/session";
import { formFileKey, formFileUploadUrl, videoConfigured } from "@/lib/video";

const fail = (status: number, error: string) => Response.json({ error }, { status });

/**
 * Starts a file upload for a file question. Body `{itemId, name, size, type, preview?}`; answers
 * `{key, url}`: the browser PUTs the file to `url` (straight to storage), then keeps
 * `{key, name, size, type}` as the answer. The submit action re-checks every key and size.
 */
export async function POST(request: NextRequest, ctx: RouteContext<"/api/forms/[slug]/upload">) {
  const user = await getUser();
  if (!user) return fail(401, "Sign in to upload files.");
  if (!videoConfigured()) return fail(503, "File uploads are not configured on this server.");

  const { slug } = await ctx.params;
  const body = (await request.json().catch(() => ({}))) as { itemId?: unknown; name?: unknown; size?: unknown; preview?: unknown };
  const [form] = await db.select().from(forms).where(eq(forms.slug, slug)).limit(1);
  if (!form) return fail(404, "No such form.");
  if (!form.accepting && !(body.preview === true && (await isAdminEmail(user.email)))) return fail(403, form.settings.closedMessage);

  const item = form.items.find((i) => i.id === body.itemId);
  if (item?.type !== "file") return fail(404, "No such file question.");
  const { name, size } = body;
  if (typeof name !== "string" || !name.trim() || name.length > 255) return fail(400, "Missing or invalid file name.");
  if (typeof size !== "number" || !Number.isSafeInteger(size) || size <= 0) return fail(400, "Missing or invalid file size.");
  if (size > item.maxSizeMb * 1024 * 1024) return fail(413, `${name} is larger than ${item.maxSizeMb} MB.`);
  if (item.accept?.length && !fileAccepted(item.accept, name)) return fail(415, `${name} is not an allowed file type.`);

  const key = formFileKey(form.id, name);
  return Response.json({ key, url: formFileUploadUrl(key) });
}
