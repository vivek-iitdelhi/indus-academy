import type { ReactNode } from "react";

// Shared by server and client components in the course builder, so no "use client".

export const inputBaseClass =
  "block rounded-xl border border-line bg-paper px-3.5 py-2.5 text-ink placeholder:text-muted/60 transition-colors focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";
export const inputClass = `${inputBaseClass} w-full`;

export const buttonClass =
  "inline-flex h-10 items-center justify-center rounded-full bg-ink px-5 text-sm font-medium text-paper transition-colors hover:bg-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:opacity-50";

export const secondaryButtonClass =
  "inline-flex h-10 items-center justify-center rounded-full border border-ink/15 px-5 text-sm font-medium text-ink transition-colors hover:border-ink/40 hover:bg-ink/[0.03] disabled:opacity-50";

/** Small square icon-ish buttons for up / down / delete in lists. */
export const miniButtonClass =
  "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-line bg-white px-2 text-sm text-ink transition-colors hover:border-ink/30 disabled:opacity-40";

export const dangerButtonClass =
  "inline-flex h-10 items-center justify-center rounded-full border border-red-700/30 px-5 text-sm font-medium text-red-800 transition-colors hover:bg-red-50 disabled:opacity-50";

export const cardClass = "rounded-2xl border border-line bg-white p-5 sm:p-6";

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-relaxed text-muted">{hint}</span>}
    </label>
  );
}

export function CheckField({ name, label, hint, defaultChecked }: { name: string; label: string; hint?: string; defaultChecked: boolean }) {
  return (
    <label className="flex gap-3">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-1 size-4 accent-pine" />
      <span>
        <span className="text-sm font-medium">{label}</span>
        {hint && <span className="block text-xs leading-relaxed text-muted">{hint}</span>}
      </span>
    </label>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="text-lg font-semibold tracking-tight">{children}</h2>;
}

export const formatLabels = {
  interactive: "Short 4–5 minute videos with quizzes in between, grouped into chapters.",
  standard: "The full-length course video(s) as recorded, then a certificate.",
} as const;

const statusTones = {
  draft: "bg-paper-2 text-muted",
  published: "bg-mint text-pine",
  archived: "bg-ink/10 text-ink",
} as const;

export function StatusBadge({ status }: { status: keyof typeof statusTones }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-0.5 font-mono text-[0.68rem] uppercase tracking-[0.12em] ${statusTones[status]}`}>
      {status}
    </span>
  );
}
