"use client";

import { useActionState } from "react";
import { subscribe, type SubscribeState } from "@/app/newsletter/actions";
import { CheckIcon } from "./ui";

const initialState: SubscribeState = { status: "idle" };

export function NewsletterForm({ tone = "light", className = "" }: { tone?: "light" | "dark"; className?: string }) {
  const [state, formAction, pending] = useActionState(subscribe, initialState);
  const dark = tone === "dark";

  if (state.status === "success") {
    return (
      <p className={`flex items-center gap-2.5 text-sm ${dark ? "text-mint" : "text-pine"} ${className}`} role="status">
        <CheckIcon className="size-4 shrink-0" />
        {state.message}
      </p>
    );
  }

  return (
    <form action={formAction} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`newsletter-email-${tone}`} className="sr-only">
          Email address
        </label>
        <input
          id={`newsletter-email-${tone}`}
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="you@company.com"
          className={`h-12 w-full rounded-full border px-5 text-sm transition-colors focus:outline-none focus:ring-2 ${
            dark
              ? "border-white/15 bg-white/[0.06] text-paper placeholder:text-paper/40 focus:border-mint/60 focus:ring-mint/20"
              : "border-line bg-white text-ink placeholder:text-muted/60 focus:border-pine focus:ring-pine/20"
          }`}
        />
        <div aria-hidden="true" className="hidden">
          <label>
            Company
            <input name="company" tabIndex={-1} autoComplete="off" />
          </label>
        </div>
        <button
          type="submit"
          disabled={pending}
          className={`h-12 shrink-0 rounded-full px-6 text-sm font-medium transition-colors disabled:opacity-60 ${
            dark ? "bg-saffron text-ink hover:bg-saffron-2" : "bg-ink text-paper hover:bg-pine"
          }`}
        >
          {pending ? "Sending…" : "Subscribe"}
        </button>
      </div>
      {state.status === "error" && state.message && (
        <p role="alert" className={`mt-2 text-sm ${dark ? "text-saffron" : "text-red-700"}`}>
          {state.message}
        </p>
      )}
      <p className={`mt-3 text-xs leading-relaxed ${dark ? "text-paper/50" : "text-muted"}`}>
        New articles only, and a confirmation email first. Unsubscribe any time.
      </p>
    </form>
  );
}
