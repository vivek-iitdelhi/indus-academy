"use client";

import { useActionState, useState } from "react";
import { createDistributor, rotateDistributorKey, type KeyResult } from "./actions";

const input =
  "h-11 w-full rounded-full border border-line bg-white px-5 text-sm text-ink placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";
const button =
  "h-11 shrink-0 rounded-full bg-ink px-6 text-sm font-medium text-paper transition-colors hover:bg-pine disabled:opacity-60";

export function KeyReveal({ apiKey, what = "API key" }: { apiKey: string; what?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div role="status" className="mt-4 rounded-2xl border border-saffron bg-saffron/10 p-4 text-sm">
      <p className="font-medium">Copy this {what} now. It will not be shown again.</p>
      <p className="mt-1 text-muted">Send it to the partner over a secure channel. It is for server-to-server use only.</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <code className="min-w-0 break-all rounded-lg bg-white px-3 py-2 font-mono text-xs">{apiKey}</code>
        <button
          type="button"
          className="rounded-full border border-ink/15 px-4 py-1.5 text-xs font-medium hover:border-ink/40"
          onClick={async () => {
            await navigator.clipboard.writeText(apiKey);
            setCopied(true);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}

const initial: KeyResult = {};

export function CreateDistributorForm() {
  const [state, action, pending] = useActionState(createDistributor, initial);
  return (
    <div>
      <form action={action} className="flex flex-col gap-3 sm:flex-row">
        <input name="name" required maxLength={120} placeholder="Partner name" aria-label="Partner name" className={input} />
        <input
          name="contactEmail"
          type="email"
          maxLength={200}
          placeholder="Contact email"
          aria-label="Contact email"
          className={input}
        />
        <button disabled={pending} className={button}>
          {pending ? "Creating…" : "Create"}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-3 text-sm text-red-700">{state.error}</p>}
      {state.key && <KeyReveal apiKey={state.key} />}
    </div>
  );
}

export function RotateKeyForm({ id, name }: { id: string; name: string }) {
  const [state, action, pending] = useActionState(rotateDistributorKey, initial);
  return (
    <div>
      <form
        action={action}
        onSubmit={(event) => {
          if (!confirm(`Rotate the key for ${name}? Every live key they have stops working immediately. To rotate without downtime, add a second key on their page instead.`)) event.preventDefault();
        }}
      >
        <input type="hidden" name="id" value={id} />
        <button disabled={pending} className="text-sm font-medium text-pine underline underline-offset-4 disabled:opacity-60">
          {pending ? "Rotating…" : "Rotate key"}
        </button>
      </form>
      {state.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
      {state.key && <KeyReveal apiKey={state.key} />}
    </div>
  );
}
