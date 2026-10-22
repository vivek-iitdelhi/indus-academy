// The response card: a small admit-card-style summary that fills in as the form is answered
// (beside the form on wide screens) and gets a "Received" stamp once the response is saved.
// Shared by the form and its confirmation screen, so no "use client" of its own.

export type CardLine = { id: string; label: string; value: string };

/** Progress ring: `done` of `total`, drawn with the accent colour. */
export function Ring({ done, total, size = 40 }: { done: number; total: number; size?: number }) {
  const share = total ? Math.min(done / total, 1) * 100 : 0;
  return (
    <svg viewBox="0 0 36 36" width={size} height={size} className="-rotate-90" aria-hidden="true">
      <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-line)" strokeWidth="3" />
      {share > 0 && (
        <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" pathLength={100} strokeDasharray={`${share} 100`} />
      )}
    </svg>
  );
}

/** A value written onto the card; a new value remounts, so it is inked again. */
function Ink({ value, placeholder }: { value: string; placeholder: string }) {
  if (!value) return <span className="text-muted/70">{placeholder}</span>;
  return (
    <span key={value} className="fm-ink inline-block max-w-full truncate align-bottom">
      {value}
    </span>
  );
}

export function ResponseCard({
  formTitle,
  hero,
  lines,
  done,
  total,
  stamp,
  date,
}: {
  formTitle: string;
  hero?: CardLine;
  lines: CardLine[];
  done: number;
  total: number;
  /** Set once the response is saved: the reference printed under the stamp. */
  stamp?: string;
  date: string;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-line bg-white" aria-label="Your response so far" role="group">
      <div className="bg-[var(--accent)] px-5 py-3 text-white">
        <p className="font-mono text-[0.65rem] uppercase tracking-[0.2em] text-white/80">Indus AI Academy</p>
        <p className="mt-0.5 truncate text-sm font-medium">{formTitle}</p>
      </div>

      <div className="space-y-4 px-5 pt-5 pb-4">
        {hero && (
          <div>
            <p className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-muted">{hero.label}</p>
            <p className="mt-1 min-h-9 overflow-visible pb-[0.18em] font-serif text-[1.85rem] italic leading-tight text-ink">
              <Ink value={hero.value} placeholder="—" />
            </p>
          </div>
        )}
        {lines.length > 0 && (
          <dl className="space-y-3 border-t border-dashed border-line pt-4">
            {lines.map((line) => (
              <div key={line.id} className="text-sm">
                <dt className="truncate font-mono text-[0.62rem] uppercase tracking-[0.14em] text-muted" title={line.label}>
                  {line.label}
                </dt>
                <dd className="mt-1 min-w-0 border-b border-line/70 pb-1 font-medium text-ink">
                  <Ink value={line.value} placeholder="" />
                  {!line.value && <span className="inline-block h-[1.25em]" aria-hidden="true" />}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      <div className="flex min-h-14 items-center gap-3 border-t border-line bg-paper/60 px-5 py-3">
        {stamp ? (
          // Once saved the count no longer matters; the stamp takes the row.
          <p className="font-mono text-[0.65rem] uppercase tracking-[0.14em] text-muted">Submitted</p>
        ) : (
          <>
            <Ring done={done} total={total} size={32} />
            <p className="text-xs text-muted">
              <span className="font-medium text-ink">
                {done} of {total}
              </span>{" "}
              answered
            </p>
            <p className="ml-auto font-mono text-[0.65rem] tracking-[0.08em] text-muted">{date}</p>
          </>
        )}
      </div>

      {stamp && (
        <div className="pointer-events-none absolute right-4 bottom-3" aria-hidden="true">
          <div className="fm-stamp rounded-md border-[3px] border-saffron px-3 py-1.5 text-center text-saffron mix-blend-multiply">
            <p className="font-mono text-lg font-bold uppercase leading-none tracking-[0.2em]">Received</p>
            <p className="mt-1 font-mono text-[0.6rem] leading-none tracking-[0.12em]">
              {stamp} · {date}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
