import { randomInt } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { cache, type ReactNode } from "react";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { formResponses, forms } from "@/db/schema";
import { answersFromQuery } from "@/lib/forms/logic";
import { needsSignIn, type FormSettings } from "@/lib/forms/types";
import { getUser, isAdminEmail } from "@/lib/session";
import { FormColumn, FormView, TitleCard, type Mode } from "./form-view";

const load = cache(async (slug: string) => {
  await connection();
  const [form] = await db.select().from(forms).where(eq(forms.slug, slug)).limit(1);
  return form ?? null;
});

export async function generateMetadata({ params }: PageProps<"/forms/[slug]">): Promise<Metadata> {
  const form = await load((await params).slug);
  return { title: form?.title || "Form", robots: { index: false, follow: false } };
}

// The site header and footer come from the root layout; an embedded form hides them.
const embeddedCss = "body>header,body>footer,body>a[href='#main']{display:none!important}";

function Notice({ settings, title, children }: { settings: FormSettings; title: string; children: ReactNode }) {
  return (
    <FormColumn settings={settings}>
      <TitleCard title={title}>
        <div className="mt-4 space-y-4 leading-relaxed">{children}</div>
      </TitleCard>
    </FormColumn>
  );
}

const link = "font-medium text-[var(--accent)] underline underline-offset-4";

export default async function FormPage({ params, searchParams }: PageProps<"/forms/[slug]">) {
  const { slug } = await params;
  const query = await searchParams;
  const form = await load(slug);
  if (!form) notFound();
  const { items } = form;
  // Only what respondents need reaches the browser (never the notification list).
  const settings: FormSettings = { ...form.settings, notifyEmails: [] };

  const user = await getUser();
  const admin = user ? await isAdminEmail(user.email) : false;
  const flag = (name: string) => query[name] === "1";
  const prefill = flag("prefill") && admin;
  const preview = (flag("preview") || prefill) && admin;
  const embedded = flag("embedded");

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) for (const v of [value ?? []].flat()) search.append(key, v);
  const here = `/forms/${slug}${search.size ? `?${search}` : ""}`;

  const banner = (preview || prefill) && (
    <p role="status" className="rounded-xl border border-saffron/50 bg-saffron/10 px-4 py-3 text-sm leading-relaxed">
      {prefill ? (
        <>
          <strong>Pre-fill.</strong> Answer the questions you want pre-filled, then select Get link.
        </>
      ) : (
        <>
          <strong>Preview.</strong> {form.accepting ? "" : "This form is not accepting responses. "}Responses you submit here are not saved.
        </>
      )}
    </p>
  );

  const body = await (async () => {
    if (!form.accepting && !preview) {
      return (
        <Notice settings={settings} title={form.title}>
          <p className="whitespace-pre-wrap">{settings.closedMessage || "This form is no longer accepting responses."}</p>
        </Notice>
      );
    }
    if (needsSignIn(settings, items) && !user) {
      return (
        <Notice settings={settings} title={form.title}>
          <p className="text-muted">Sign in to continue. This form needs to know who is responding.</p>
          <Link
            href={`/signin?next=${encodeURIComponent(here)}`}
            target={embedded ? "_top" : undefined}
            className="inline-flex h-10 items-center rounded-lg bg-[var(--accent)] px-6 text-sm font-medium text-white hover:brightness-110"
          >
            Sign in
          </Link>
        </Notice>
      );
    }

    const previous =
      user && !preview && (settings.limitOne || settings.allowEdit)
        ? (
            await db
              .select({ answers: formResponses.answers, email: formResponses.email })
              .from(formResponses)
              .where(and(eq(formResponses.formId, form.id), eq(formResponses.userId, user.id)))
              .orderBy(desc(formResponses.createdAt))
              .limit(1)
          )[0]
        : undefined;
    const editing = flag("edit") && settings.allowEdit && Boolean(previous);

    if (settings.limitOne && previous && !editing) {
      return (
        <Notice settings={settings} title={form.title}>
          <p className="font-medium">You&apos;ve already responded</p>
          <p className="text-muted">You can fill out this form only once.</p>
          {settings.allowEdit && (
            <a href={`/forms/${slug}?edit=1${embedded ? "&embedded=1" : ""}`} className={link}>
              Edit your response
            </a>
          )}
        </Notice>
      );
    }

    const mode: Mode = prefill ? "prefill" : preview ? "preview" : "live";
    return (
      <FormColumn settings={settings}>
        {banner}
        <FormView
          slug={slug}
          title={form.title}
          description={form.description}
          items={items}
          settings={settings}
          mode={mode}
          userEmail={user?.email ?? null}
          initialAnswers={editing && previous ? previous.answers : answersFromQuery(items, query)}
          initialEmail={(editing && previous?.email) || (settings.collectEmail === "input" && user?.email) || ""}
          editing={editing}
          seed={randomInt(2 ** 31 - 1)}
        />
      </FormColumn>
    );
  })();

  return (
    <div className={embedded ? "" : "bg-paper-2/40"}>
      {embedded && <style>{embeddedCss}</style>}
      {body}
    </div>
  );
}
