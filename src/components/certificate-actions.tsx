"use client";

import { useActionState, useState } from "react";
import { setCertificateName, type NameState } from "@/app/learn/certificates/actions";
import { CheckIcon } from "./ui";

const base =
  "inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron";
const actionClass = `${base} border border-ink/15 text-ink hover:border-ink/40 hover:bg-ink/[0.03]`;

/** Download, copy the verification link, add to LinkedIn. */
export function CertificateActions({ imageUrl, verifyUrl, linkedInUrl }: { imageUrl: string; verifyUrl: string; linkedInUrl: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <a href={`${imageUrl}?download=1`} download className={actionClass}>
        Download PNG
      </a>
      <button
        type="button"
        className={actionClass}
        onClick={async () => {
          await navigator.clipboard.writeText(verifyUrl);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
      >
        {copied && <CheckIcon className="size-4 text-pine" />}
        <span aria-live="polite">{copied ? "Link copied" : "Copy verification link"}</span>
      </button>
      <a
        href={linkedInUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`${base} bg-[#0a66c2] text-white hover:bg-[#004182]`}
      >
        Add to LinkedIn
      </a>
    </div>
  );
}

export function HolderNameForm({ serial }: { serial: string }) {
  const [state, formAction, pending] = useActionState<NameState, FormData>(setCertificateName, { error: null });
  const id = `name-${serial}`;
  return (
    <form action={formAction} className="rounded-2xl border border-saffron/50 bg-saffron/10 p-4">
      <label htmlFor={id} className="text-sm font-medium text-ink">
        Add your name to this certificate
      </label>
      <p className="mt-1 text-sm text-muted">Exactly as it should be printed. You can set it once.</p>
      <input type="hidden" name="serial" value={serial} />
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input
          id={id}
          name="name"
          required
          minLength={2}
          maxLength={100}
          autoComplete="name"
          placeholder="Your full name"
          className="h-10 w-full rounded-full border border-line bg-white px-4 text-sm text-ink placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-10 shrink-0 rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-pine disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save name"}
        </button>
      </div>
      {state.error && (
        <p role="alert" className="mt-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
    </form>
  );
}
