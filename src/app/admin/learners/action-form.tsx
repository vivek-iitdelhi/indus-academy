"use client";

import { useActionState, type ReactNode } from "react";

export type ActionState = { error?: string; ok?: string } | null;

/**
 * A form bound to an admin server action, with inline error/success feedback.
 * `confirm` is asked before submitting; `override` is a second, explicit question whose
 * "OK" submits `override=1` (the server decides whether it needs one).
 */
export function ActionForm({
  action,
  confirm,
  override,
  className = "",
  children,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  confirm?: string;
  override?: string;
  className?: string;
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, null);
  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirm && !window.confirm(confirm)) return event.preventDefault();
        if (override) {
          if (!window.confirm(override)) return event.preventDefault();
          (event.currentTarget.elements.namedItem("override") as HTMLInputElement).value = "1";
        }
      }}
      className={className}
    >
      {override && <input type="hidden" name="override" defaultValue="" />}
      <fieldset disabled={pending} className="contents">
        {children}
      </fieldset>
      {state?.error && (
        <p role="alert" className="basis-full text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state?.ok && (
        <p role="status" className="basis-full text-sm text-pine">
          {state.ok}
        </p>
      )}
    </form>
  );
}
