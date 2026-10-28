"use client";

import { useState, useTransition, type ReactNode } from "react";
import type { ActionResult } from "./actions";
import { buttonClass, Field, inputClass } from "./form-ui";
import { slugify } from "./slug";

/**
 * A form for a server action that returns { error | ok }. Submits without React's
 * automatic form reset, so a rejected save keeps what the admin typed.
 */
export function ActionForm({
  action,
  submitLabel,
  submitClass = buttonClass,
  resetOnSuccess = false,
  className = "space-y-4",
  children,
}: {
  action: (form: FormData) => Promise<ActionResult | void>;
  submitLabel: string;
  submitClass?: string;
  resetOnSuccess?: boolean;
  className?: string;
  children?: ReactNode;
}) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | void>();
  return (
    <form
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        startTransition(async () => {
          const next = await action(data);
          setResult(next);
          if (resetOnSuccess && !next?.error) form.reset();
        });
      }}
    >
      {children}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={submitClass}>
          {pending ? "Saving…" : submitLabel}
        </button>
        {result?.error && (
          <p role="alert" className="text-sm text-red-800">
            {result.error}
          </p>
        )}
        {result?.ok && !pending && (
          <p role="status" className="text-sm text-pine">
            {result.ok}
          </p>
        )}
      </div>
    </form>
  );
}

/** A submit button that asks first. Use inside a plain <form action={serverAction}>. */
export function ConfirmButton({ message, className, children }: { message: string; className: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}

/** Title and slug for a new course; the slug follows the title until edited by hand. */
export function NewCourseFields() {
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState<string | null>(null);
  return (
    <>
      <Field label="Title">
        <input name="title" required value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </Field>
      <Field label="Slug" hint={<>The course URL: /courses/{slug ?? (slugify(title) || "…")}. Lowercase letters, numbers and hyphens.</>}>
        <input
          name="slug"
          required
          pattern="[a-z0-9-]+"
          value={slug ?? slugify(title)}
          onChange={(e) => setSlug(e.target.value)}
          className={`${inputClass} font-mono text-sm`}
        />
      </Field>
    </>
  );
}

/**
 * The new-course format choice. Picking Live also asks for the first class, so the course can be
 * published without visiting the Live classes page.
 */
export function FormatChoice({ formats, labels, liveFields }: { formats: readonly string[]; labels: Record<string, string>; liveFields: ReactNode }) {
  const [format, setFormat] = useState(formats[0]);
  return (
    <>
      <fieldset>
        <legend className="text-sm font-medium">Format</legend>
        <div className="mt-2 space-y-2">
          {formats.map((f) => (
            <label key={f} className="flex gap-3 rounded-xl border border-line p-3 has-checked:border-pine has-checked:bg-mint/30">
              <input type="radio" name="format" value={f} checked={format === f} onChange={() => setFormat(f)} className="mt-1 accent-pine" />
              <span>
                <span className="text-sm font-medium capitalize">{f}</span>
                <span className="block text-sm text-muted">{labels[f]}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      {format === "live" && (
        <fieldset className="space-y-3 rounded-xl border border-line p-4">
          <legend className="px-1 text-sm font-medium">First live class</legend>
          {liveFields}
        </fieldset>
      )}
    </>
  );
}
