"use client";

import { useActionState } from "react";
import { CheckIcon } from "@/components/ui";
import { saveAccount, type AccountState } from "./actions";

const inputClass =
  "h-12 w-full rounded-full border border-line bg-white px-5 text-[0.95rem] text-ink transition-colors placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

export function AccountForm({
  firstName,
  lastName,
  phone,
  next,
}: {
  firstName: string;
  lastName: string;
  phone: string;
  next: string | null;
}) {
  const [state, action, pending] = useActionState<AccountState, FormData>(saveAccount, {});
  return (
    <form action={action} className="space-y-5">
      {next && <input type="hidden" name="next" value={next} />}
      <div>
        <p id="account-name-help" className="text-sm leading-relaxed text-muted">
          Your name is printed on your certificates exactly as you type it here. Check the spelling before you finish a course.
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="account-first-name" className="text-sm font-medium">
              First name
            </label>
            <input
              id="account-first-name"
              name="firstName"
              required
              maxLength={50}
              autoComplete="given-name"
              defaultValue={firstName}
              aria-describedby="account-name-help"
              className={`${inputClass} mt-3`}
            />
          </div>
          <div>
            <label htmlFor="account-last-name" className="text-sm font-medium">
              Last name
            </label>
            <input
              id="account-last-name"
              name="lastName"
              required
              maxLength={50}
              autoComplete="family-name"
              defaultValue={lastName}
              aria-describedby="account-name-help"
              className={`${inputClass} mt-3`}
            />
          </div>
        </div>
      </div>
      <div>
        <label htmlFor="account-phone" className="text-sm font-medium">
          Phone <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id="account-phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          maxLength={20}
          placeholder="+91 98765 43210"
          defaultValue={phone}
          className={`${inputClass} mt-3`}
        />
      </div>
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="h-12 rounded-full bg-ink px-7 text-sm font-medium text-paper transition-colors hover:bg-pine disabled:opacity-60"
        >
          {pending ? "Saving…" : next ? "Save and continue" : "Save"}
        </button>
        {state.error && (
          <p role="alert" className="text-sm text-red-700">
            {state.error}
          </p>
        )}
        {state.saved && !pending && (
          <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-pine">
            <CheckIcon className="size-4" /> Saved
          </p>
        )}
      </div>
    </form>
  );
}
