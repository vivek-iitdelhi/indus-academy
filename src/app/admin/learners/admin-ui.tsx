import Link from "next/link";
import type { ReactNode } from "react";

// Shared by the learners, payments and certificates admin pages.

export const PAGE_SIZE = 25;

export const btn =
  "inline-flex h-9 items-center justify-center rounded-full border border-ink/15 px-4 text-sm font-medium transition-colors hover:border-ink/40 hover:bg-ink/[0.03] disabled:opacity-50";
export const btnDark =
  "inline-flex h-9 items-center justify-center rounded-full bg-ink px-4 text-sm font-medium text-paper transition-colors hover:bg-pine disabled:opacity-50";
export const input =
  "h-9 rounded-xl border border-line bg-paper px-3 text-sm text-ink focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

export function PageTitle({ children, intro }: { children: ReactNode; intro?: ReactNode }) {
  return (
    <div>
      <h1 className="text-3xl font-semibold tracking-[-0.03em]">{children}</h1>
      {intro && <p className="mt-2 text-muted">{intro}</p>}
    </div>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return <h2 className="mt-10 text-xl font-semibold tracking-tight">{children}</h2>;
}

const tones = {
  good: "bg-mint text-pine",
  warn: "bg-saffron/25 text-ink",
  bad: "bg-red-100 text-red-800",
  muted: "bg-ink/[0.06] text-muted",
};

export function Badge({ tone = "muted", children }: { tone?: keyof typeof tones; children: ReactNode }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${tones[tone]}`}>
      {children}
    </span>
  );
}

export function Table({ head, children, empty }: { head: string[]; children: ReactNode[]; empty: string }) {
  return (
    <div className="mt-4 overflow-x-auto rounded-2xl border border-line bg-white">
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h} className="whitespace-nowrap px-4 py-3 font-mono text-[0.7rem] font-normal uppercase tracking-[0.18em] text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr]:border-t [&>tr]:border-line [&_td]:px-4 [&_td]:py-3 [&_td]:align-top">
          {children.length ? children : (
            <tr>
              <td colSpan={head.length} className="text-muted">
                {empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

/** Previous/next links that keep the other search params. */
export function Pager({ path, params, page, hasMore }: { path: string; params: Record<string, string>; page: number; hasMore: boolean }) {
  if (page === 1 && !hasMore) return null;
  const href = (p: number) => `${path}?${new URLSearchParams({ ...params, page: String(p) })}`;
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center gap-3 text-sm">
      {page > 1 && <Link href={href(page - 1)} className={btn}>Previous</Link>}
      <span className="text-muted">Page {page}</span>
      {hasMore && <Link href={href(page + 1)} className={btn}>Next</Link>}
    </nav>
  );
}

/** First value of a search param, or "". */
export const param = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? "";

export const pageParam = (value: string | string[] | undefined) => Math.max(1, Math.floor(Number(param(value))) || 1);
