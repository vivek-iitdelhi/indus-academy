"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { TEST_EMAIL } from "@/lib/test-login";
import { CheckIcon } from "./ui";

const inputClass =
  "h-12 w-full rounded-full border border-line bg-white px-5 text-base text-ink transition-colors placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

export function SignInForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [email, setEmail] = useState("");
  // Failed links land back here with ?error=, keeping the destination.
  const errorCallbackURL = `/signin?error=link&next=${encodeURIComponent(next)}`;
  // A new account goes to its details first (first and last name, optional phone), then on to `next`.
  const newUserCallbackURL = `/learn/account?welcome=1&next=${encodeURIComponent(next)}`;

  async function sendLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim().toLowerCase() === TEST_EMAIL) {
      window.location.assign(`/test-login?next=${encodeURIComponent(next)}`);
      return;
    }
    setStatus("sending");
    const { error } = await authClient.signIn.magicLink({ email, callbackURL: next, newUserCallbackURL, errorCallbackURL });
    setStatus(error ? "error" : "sent");
  }

  if (status === "sent") {
    return (
      <div role="status" className="rounded-2xl border border-line bg-white p-6">
        <p className="flex items-center gap-2.5 font-medium text-pine">
          <CheckIcon className="size-4 shrink-0" />
          Check your email
        </p>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          We sent a sign-in link to <strong className="text-ink">{email}</strong>. Open it on this phone or computer. It
          works once and expires in 15 minutes.
        </p>
        <button type="button" onClick={() => setStatus("idle")} className="mt-4 text-sm font-medium text-pine underline underline-offset-4">
          Use a different email
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <form onSubmit={sendLink} className="space-y-3">
        <label htmlFor="signin-email" className="sr-only">
          Email address
        </label>
        <input
          id="signin-email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="you@company.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="h-12 w-full rounded-full bg-ink px-6 text-sm font-medium text-paper transition-colors hover:bg-pine disabled:opacity-60"
        >
          {status === "sending" ? "Sending…" : "Email me a sign-in link"}
        </button>
        {status === "error" && (
          <p role="alert" className="text-sm text-red-700">
            We couldn&apos;t send the link. Please check the address and try again.
          </p>
        )}
      </form>

      {googleEnabled && (
        <>
          <p className="flex items-center gap-3 font-mono text-[0.7rem] uppercase tracking-[0.18em] text-muted before:h-px before:flex-1 before:bg-line after:h-px after:flex-1 after:bg-line">
            or
          </p>
          <button
            type="button"
            onClick={() => authClient.signIn.social({ provider: "google", callbackURL: next, newUserCallbackURL, errorCallbackURL })}
            className="h-12 w-full rounded-full border border-ink/15 px-6 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-ink/[0.03]"
          >
            Continue with Google
          </button>
        </>
      )}
    </div>
  );
}
