"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { buttonClass, inputClass, secondaryButtonClass } from "../courses/form-ui";
import { setAccepting } from "./actions";

// Client pieces of the form header (see [id]/layout.tsx).

export function FormTabs({ formId, responseCount }: { formId: string; responseCount: number }) {
  const pathname = usePathname();
  const base = `/admin/forms/${formId}`;
  const tabs = [
    { href: base, label: "Questions" },
    { href: `${base}/responses`, label: `Responses (${responseCount.toLocaleString("en-IN")})` },
    { href: `${base}/settings`, label: "Settings" },
  ];
  return (
    <nav aria-label="Form" className="mt-6 flex gap-1 border-b border-line">
      {tabs.map(({ href, label }) => {
        const active = href === base ? pathname === base : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active ? "border-pine text-pine" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

/** A labelled on/off switch. */
export function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (on: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="inline-flex items-center gap-2 text-sm disabled:opacity-50"
    >
      <span className={`relative h-5 w-9 rounded-full transition-colors ${checked ? "bg-pine" : "bg-ink/20"}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-white shadow transition-[left] ${checked ? "left-[1.1rem]" : "left-0.5"}`} />
      </span>
      {label}
    </button>
  );
}

export function AcceptingToggle({ formId, accepting }: { formId: string; accepting: boolean }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return (
    <span className="mr-2 inline-flex items-center gap-2">
      <Switch
        checked={accepting}
        disabled={pending}
        label={accepting ? "Accepting responses" : "Not accepting responses"}
        onChange={(on) =>
          startTransition(async () => {
            const result = await setAccepting(formId, on);
            setError(result.error ?? "");
          })
        }
      />
      {error && (
        <span role="alert" className="text-sm text-red-800">
          {error}
        </span>
      )}
    </span>
  );
}

/** "Send": the public link and an embed snippet, each with a copy button. */
export function SendButton({ url }: { url: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const embed = `<iframe src="${url}?embedded=1" width="640" height="1200" frameborder="0" marginheight="0" marginwidth="0">Loading…</iframe>`;
  return (
    <>
      <button type="button" className={buttonClass} onClick={() => dialog.current?.showModal()}>
        Send
      </button>
      <dialog
        ref={dialog}
        className="m-auto w-full max-w-lg rounded-2xl border border-line bg-white p-6 text-ink backdrop:bg-ink/40"
        onClick={(e) => e.target === dialog.current && dialog.current.close()}
      >
        <h2 className="text-xl font-semibold tracking-tight">Send form</h2>
        <CopyField label="Link" value={url} />
        <CopyField label="Embed HTML" value={embed} multiline />
        <div className="mt-6 flex justify-end">
          <button type="button" className={secondaryButtonClass} onClick={() => dialog.current?.close()}>
            Close
          </button>
        </div>
      </dialog>
    </>
  );
}

function CopyField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  const [copied, setCopied] = useState(false);
  const Input = multiline ? "textarea" : "input";
  return (
    <div className="mt-5">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      <div className="flex items-start gap-2">
        <Input readOnly value={value} rows={4} onFocus={(e) => e.currentTarget.select()} className={`${inputClass} font-mono text-xs`} aria-label={label} />
        <button
          type="button"
          className={secondaryButtonClass}
          onClick={() =>
            navigator.clipboard.writeText(value).then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            })
          }
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
}
