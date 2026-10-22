import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { forms } from "@/db/schema";
import { isUuid } from "@/lib/admin/courses";
import { needsSignIn } from "@/lib/forms/types";
import { requireAdmin } from "@/lib/session";
import { ActionForm } from "../../../courses/client";
import { cardClass, CheckField, Field, inputClass, SectionTitle } from "../../../courses/form-ui";
import { updateSettings } from "../../actions";

function Radios({ name, value, options }: { name: string; value: string; options: [string, string][] }) {
  return (
    <div className="space-y-1.5">
      {options.map(([v, label]) => (
        <label key={v} className="flex items-center gap-2 text-sm">
          <input type="radio" name={name} value={v} defaultChecked={value === v} className="accent-pine" />
          {label}
        </label>
      ))}
    </div>
  );
}

export default async function FormSettingsPage({ params }: PageProps<"/admin/forms/[id]/settings">) {
  await requireAdmin();
  const { id } = await params;
  if (!isUuid(id)) notFound();
  const [form] = await db.select().from(forms).where(eq(forms.id, id));
  if (!form) notFound();
  const s = form.settings;

  const signInReasons = [
    s.collectEmail === "verified" && "emails are collected as Verified",
    s.limitOne && "responses are limited to 1",
    s.allowEdit && "respondents can edit their response",
    form.items.some((i) => i.type === "file") && "the form has a file upload question",
  ].filter(Boolean);

  return (
    <ActionForm action={updateSettings.bind(null, form.id)} submitLabel="Save settings" className="max-w-3xl space-y-6">
      <section className={`${cardClass} space-y-5`}>
        <SectionTitle>Link</SectionTitle>
        <Field label="Public link" hint="Changing it breaks links you have already shared.">
          <span className="flex items-center gap-1 font-mono text-sm">
            <span className="text-muted">/forms/</span>
            <input name="slug" required pattern="[a-z0-9-]+" maxLength={80} defaultValue={form.slug} className={`${inputClass} font-mono text-sm`} />
          </span>
        </Field>
      </section>

      <section className={`${cardClass} space-y-5`}>
        <SectionTitle>Responses</SectionTitle>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Collect email addresses</legend>
          <Radios
            name="collectEmail"
            value={s.collectEmail}
            options={[
              ["none", "Do not collect"],
              ["verified", "Verified: the email of the signed-in account (forces sign-in)"],
              ["input", "Responder input: respondents type their email"],
            ]}
          />
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Send responders a copy of their response</legend>
          <Radios
            name="sendCopy"
            value={s.sendCopy}
            options={[
              ["off", "Off"],
              ["request", "When requested (respondents tick a box)"],
              ["always", "Always"],
            ]}
          />
          <p className="mt-1.5 text-xs text-muted">Needs email addresses to be collected.</p>
        </fieldset>
        <CheckField name="allowEdit" label="Allow response editing" hint="Respondents can change their answers after submitting. Forces sign-in." defaultChecked={s.allowEdit} />
        <CheckField name="limitOne" label="Limit to 1 response" hint="One response per account. Forces sign-in." defaultChecked={s.limitOne} />
        <CheckField name="requireSignIn" label="Require sign-in" hint="Respondents sign in with their Indus AI Academy account." defaultChecked={s.requireSignIn} />
        <p className="rounded-xl bg-paper-2 p-3 text-sm">
          {needsSignIn(s, form.items)
            ? `Respondents must sign in${signInReasons.length ? ` because ${signInReasons.join(", ")}` : ""}.`
            : "Anyone with the link can respond without signing in."}{" "}
          <span className="text-muted">Verified emails, limit to 1 response, response editing and file upload questions all force sign-in.</span>
        </p>
      </section>

      <section className={`${cardClass} space-y-5`}>
        <SectionTitle>Presentation</SectionTitle>
        <CheckField name="showProgress" label="Show progress bar" defaultChecked={s.showProgress} />
        <CheckField name="shuffle" label="Shuffle question order" hint="Within each section." defaultChecked={s.shuffle} />
        <Field label="Confirmation message">
          <textarea name="confirmation" rows={2} maxLength={1000} defaultValue={s.confirmation} className={inputClass} />
        </Field>
        <CheckField name="showSubmitAnother" label="Show link to submit another response" defaultChecked={s.showSubmitAnother} />
        <Field label="Message while closed" hint="Shown instead of the form when it is not accepting responses.">
          <textarea name="closedMessage" rows={2} maxLength={1000} defaultValue={s.closedMessage} className={inputClass} />
        </Field>
      </section>

      <section className={`${cardClass} space-y-5`}>
        <SectionTitle>Notifications</SectionTitle>
        <Field label="Email these people on every new response" hint="Comma-separated email addresses.">
          <input name="notifyEmails" defaultValue={s.notifyEmails.join(", ")} placeholder="you@indusai.academy, team@…" className={inputClass} />
        </Field>
      </section>

      <section className={`${cardClass} space-y-5`}>
        <SectionTitle>Theme</SectionTitle>
        <Field label="Accent colour">
          <input type="color" name="color" defaultValue={s.theme.color} className="h-10 w-20 cursor-pointer rounded-lg border border-line bg-white p-1" />
        </Field>
        <Field label="Header image URL" hint="Optional. A wide image (about 1600 × 400) shown above the form.">
          <input name="headerImage" type="url" defaultValue={s.theme.headerImage ?? ""} placeholder="https://…" className={inputClass} />
        </Field>
      </section>
    </ActionForm>
  );
}
