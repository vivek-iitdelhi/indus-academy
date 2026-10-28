"use client";

import { useActionState } from "react";
import type { KeyResult } from "../actions";
import { KeyReveal } from "../key-forms";
import { createKey, rotateWebhookSecret, saveWebhookUrl } from "./platform-actions";

const input = "h-10 rounded-xl border border-line px-3 text-sm";
const button = "h-10 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-pine disabled:opacity-60";
const link = "text-sm font-medium text-pine underline underline-offset-4 disabled:opacity-60";
const initial: KeyResult = {};

const Feedback = ({ state, what }: { state: KeyResult; what?: string }) => (
  <>
    {state.error && <p role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
    {state.key && <KeyReveal apiKey={state.key} what={what} />}
  </>
);

export function CreateKeyForm({ distributorId }: { distributorId: string }) {
  const [state, action, pending] = useActionState(createKey, initial);
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="distributorId" value={distributorId} />
        <input name="label" maxLength={80} placeholder="Label, e.g. Production 2026" aria-label="Key label" className={input} />
        <select name="mode" aria-label="Key kind" className={input} defaultValue="live">
          <option value="live">Live key (iaa_live_)</option>
          <option value="test">Test key (iaa_test_)</option>
        </select>
        <button disabled={pending} className={button}>
          {pending ? "Creating…" : "Create key"}
        </button>
      </form>
      <Feedback state={state} />
    </div>
  );
}

export function WebhookUrlForm({ distributorId, url }: { distributorId: string; url: string | null }) {
  const [state, action, pending] = useActionState(saveWebhookUrl, initial);
  return (
    <div>
      <form action={action} className="flex flex-wrap items-center gap-3">
        <input type="hidden" name="distributorId" value={distributorId} />
        <input
          name="webhookUrl"
          type="url"
          defaultValue={url ?? ""}
          placeholder="https://partner.example/webhooks/indus"
          aria-label="Webhook URL"
          className={`${input} w-full max-w-md`}
        />
        <button disabled={pending} className={button}>
          {pending ? "Saving…" : "Save URL"}
        </button>
      </form>
      <Feedback state={state} what="webhook signing secret" />
    </div>
  );
}

export function RotateSecretForm({ distributorId }: { distributorId: string }) {
  const [state, action, pending] = useActionState(rotateWebhookSecret, initial);
  return (
    <div>
      <form
        action={action}
        onSubmit={(event) => {
          if (!confirm("Make a new signing secret? Webhooks signed with the old one stop verifying on their side at once.")) event.preventDefault();
        }}
      >
        <input type="hidden" name="distributorId" value={distributorId} />
        <button disabled={pending} className={link}>
          {pending ? "Rotating…" : "Rotate signing secret"}
        </button>
      </form>
      <Feedback state={state} what="webhook signing secret" />
    </div>
  );
}
