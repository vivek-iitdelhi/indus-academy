"use server";

import { and, desc, eq } from "drizzle-orm";
import { after } from "next/server";
import { db } from "@/db";
import { formResponses, forms, type Form } from "@/db/schema";
import { site } from "@/content/site";
import { sendEmail } from "@/lib/email";
import { checkResponse, EMAIL_FIELD, formatAnswer, isEmail, REQUIRED } from "@/lib/forms/logic";
import { isQuestion, needsSignIn, type Answers, type FormFile } from "@/lib/forms/types";
import { escapeHtml, shell } from "@/lib/newsletter";
import { getUser, isAdminEmail } from "@/lib/session";
import { formFileSize, isFormFileKey } from "@/lib/video";

export type SubmitInput = { answers: Answers; email?: string; sendCopy?: boolean; edit?: boolean; preview?: boolean };
export type SubmitResult = { ok: true; preview?: boolean; /** Short reference shown on the confirmation stamp. */ ref: string } | { ok: false; error: string; fieldErrors?: Record<string, string> };

const from = () => process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`;

export async function submitForm(slug: string, input: SubmitInput): Promise<SubmitResult> {
  const [form] = await db.select().from(forms).where(eq(forms.slug, String(slug))).limit(1);
  if (!form) return { ok: false, error: "This form no longer exists." };
  const { settings, items } = form;
  const user = await getUser();
  const preview = Boolean(input?.preview) && Boolean(user) && (await isAdminEmail(user!.email));

  if (!form.accepting && !preview) return { ok: false, error: settings.closedMessage };
  if (needsSignIn(settings, items) && !user) return { ok: false, error: "Sign in to submit this form." };

  // Who is responding, and their earlier response if editing or limited to one.
  const previous =
    user && !preview && (settings.limitOne || settings.allowEdit)
      ? (
          await db
            .select({ id: formResponses.id })
            .from(formResponses)
            .where(and(eq(formResponses.formId, form.id), eq(formResponses.userId, user.id)))
            .orderBy(desc(formResponses.createdAt))
            .limit(1)
        )[0]
      : undefined;
  const editing = Boolean(input?.edit) && settings.allowEdit && previous;
  // ponytail: limitOne is checked, not constrained; two simultaneous first submits can both land.
  if (settings.limitOne && previous && !editing) return { ok: false, error: "You've already responded to this form." };

  const fieldErrors: Record<string, string> = {};
  let email: string | null = null;
  if (settings.collectEmail === "verified") email = user!.email;
  if (settings.collectEmail === "input") {
    email = typeof input?.email === "string" ? input.email.trim().slice(0, 320) : "";
    if (!email) fieldErrors[EMAIL_FIELD] = REQUIRED;
    else if (!isEmail(email)) fieldErrors[EMAIL_FIELD] = "Must be a valid email";
  }

  const checked = checkResponse(items, input?.answers);
  Object.assign(fieldErrors, checked.errors);
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Some answers need attention.", fieldErrors };
  const answers = checked.answers;

  // Files come back from the browser: each must be this form's upload, really stored, and small enough.
  for (const item of items) {
    if (item.type !== "file" || !answers[item.id]) continue;
    const files = answers[item.id] as FormFile[];
    try {
      for (const file of files) {
        const size = isFormFileKey(form.id, file.key) ? await formFileSize(file.key) : null;
        if (size === null) fieldErrors[item.id] = `${file.name} did not finish uploading. Remove it and add it again.`;
        else if (size > item.maxSizeMb * 1024 * 1024) fieldErrors[item.id] = `${file.name} is larger than ${item.maxSizeMb} MB`;
        else file.size = size;
      }
    } catch (e) {
      console.error("[forms] file check failed", e);
      return { ok: false, error: "We couldn't check your uploaded files just now. Please try again." };
    }
  }
  if (Object.keys(fieldErrors).length) return { ok: false, error: "Some answers need attention.", fieldErrors };

  if (preview) return { ok: true, preview: true, ref: "PREVIEW" };

  let responseId: string;
  if (editing) {
    await db.update(formResponses).set({ answers, email }).where(eq(formResponses.id, previous.id));
    responseId = previous.id;
  } else {
    const [row] = await db
      .insert(formResponses)
      .values({ formId: form.id, userId: user?.id ?? null, email, answers })
      .returning({ id: formResponses.id });
    responseId = row.id;
  }

  const copyTo = email ?? user?.email ?? null;
  const wantsCopy = settings.sendCopy === "always" || (settings.sendCopy === "request" && Boolean(input?.sendCopy));
  after(() => notify(form, answers, email, wantsCopy ? copyTo : null, Boolean(editing)));
  return { ok: true, ref: responseId.slice(0, 8).toUpperCase() };
}

/** Best effort: sendEmail never throws, and this runs after the response is sent. */
async function notify(form: Form, answers: Answers, email: string | null, copyTo: string | null, edited: boolean) {
  const rows = form.items.filter(isQuestion).map((item) => [item.title || "Untitled question", formatAnswer(item, answers[item.id])] as const);
  const table = `<table style="border-collapse:collapse;width:100%;font-size:14px;line-height:1.6">${rows
    .map(
      ([q, a]) => `<tr><td style="padding:10px 0;border-top:1px solid #dcd8cc">
        <div style="color:#56655f;font-size:13px">${escapeHtml(q)}</div>
        <div style="color:#0b1916;white-space:pre-wrap">${a ? escapeHtml(a) : '<span style="color:#9aa39f">No answer</span>'}</div></td></tr>`,
    )
    .join("")}</table>`;
  const text = rows.map(([q, a]) => `${q}\n${a || "(no answer)"}`).join("\n\n");
  const title = escapeHtml(form.title);
  const sends: Promise<void>[] = [];

  const admins = form.settings.notifyEmails.filter(isEmail);
  if (admins.length) {
    const link = `${site.url}/admin/forms/${form.id}/responses`;
    sends.push(
      sendEmail({
        from: from(),
        to: admins,
        ...(email && { reply_to: email }),
        subject: `${edited ? "Edited response" : "New response"} to ${form.title}`.slice(0, 200),
        html: shell(
          `<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0b1916">${edited ? "Edited response" : "New response"} to ${title}</h1>
           ${email ? `<p style="margin:0 0 20px;font-size:14px;color:#56655f">From ${escapeHtml(email)}</p>` : ""}
           ${table}
           <a href="${link}" style="display:inline-block;margin-top:24px;background:#0b1916;color:#f5f3ec;text-decoration:none;font-weight:600;font-size:15px;padding:12px 24px;border-radius:999px">See all responses</a>`,
          `<p style="margin:0">You get this because your address is on this form's notification list.</p>`,
        ),
        text: `${edited ? "Edited response" : "New response"} to ${form.title}${email ? ` from ${email}` : ""}\n\n${text}\n\nAll responses: ${link}`,
      }),
    );
  }

  if (copyTo) {
    sends.push(
      sendEmail({
        from: from(),
        to: [copyTo],
        reply_to: site.email,
        subject: `Your response to ${form.title}`.slice(0, 200),
        html: shell(
          `<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0b1916">Thanks for filling in ${title}</h1>
           <p style="margin:0 0 20px;font-size:14px;color:#56655f">Here is what was received.</p>
           ${table}`,
          `<p style="margin:0">You get this because you asked for a copy of your response on ${escapeHtml(site.url.replace(/^https?:\/\//, ""))}.</p>`,
        ),
        text: `Your response to ${form.title}\n\n${text}`,
      }),
    );
  }
  await Promise.all(sends);
}
