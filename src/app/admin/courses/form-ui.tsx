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
  live: "Taught in live classes you schedule under Live classes. Listed as upcoming, then live, and gone from the site for non-learners once the last class ends.",
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

const LENGTHS = [30, 45, 60, 90, 120];

/** Every 15 minutes of the day: value "17:30" (what the action reads), label "5:30 pm". */
const TIMES = Array.from({ length: 96 }, (_, i) => {
  const h = Math.floor(i / 4);
  const m = String((i % 4) * 15).padStart(2, "0");
  return { value: `${String(h).padStart(2, "0")}:${m}`, label: `${h % 12 || 12}:${m} ${h < 12 ? "am" : "pm"}` };
});
/** The menu's sections, by hour [from, to). */
const TIME_GROUPS: [string, number, number][] = [
  ["Morning", 6, 12],
  ["Afternoon", 12, 17],
  ["Evening", 17, 24],
  ["Night", 0, 6],
];

/**
 * A live class's title, date, start time and length (India time). `required` is off where the
 * fields only apply to one choice (the new-course form shows them for Live only); the action
 * validates them.
 */
export function LiveClassFields({ required = true, defaultTitle = "" }: { required?: boolean; defaultTitle?: string }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        <Field label="Class title (optional)">
          <input name="classTitle" defaultValue={defaultTitle} placeholder="Live class" className={inputClass} />
        </Field>
        <Field label="Date">
          <input name="date" type="date" required={required} className={inputClass} />
        </Field>
        <Field label="Starts (India time)">
          <div className="relative">
            <select name="time" required={required} defaultValue="" className={`${inputClass} appearance-none pr-9 tabular-nums`}>
              <option value="" disabled>
                Pick a time
              </option>
              {TIME_GROUPS.map(([label, from, to]) => (
                <optgroup key={label} label={label}>
                  {TIMES.slice(from * 4, to * 4).map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <svg viewBox="0 0 20 20" aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted">
              <path d="m5 8 5 5 5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </Field>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Length</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LENGTHS.map((m) => (
            <label
              key={m}
              className="cursor-pointer rounded-full border border-line px-4 py-1.5 text-sm tabular-nums transition-colors hover:border-ink/30 has-checked:border-ink has-checked:bg-ink has-checked:text-paper"
            >
              <input type="radio" name="durationMinutes" value={m} defaultChecked={m === 60} className="sr-only" />
              {m < 60 ? `${m} min` : `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ""}`}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
