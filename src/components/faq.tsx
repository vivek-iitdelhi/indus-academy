export function Faq({ items }: { items: { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <details key={item.q} className="group py-6">
          <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-lg font-medium [&::-webkit-details-marker]:hidden">
            {item.q}
            <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border border-line transition-transform group-open:rotate-45">
              <svg viewBox="0 0 12 12" fill="none" aria-hidden="true" className="size-3">
                <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
          </summary>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
