import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { distributorCourses, distributors } from "@/db/schema";
import { daysInWindow, usageByDay, usageByDistributor, usageByEndpoint } from "@/lib/api-usage";
import { partnerStats } from "@/lib/lms/partners";
import { requireAdmin } from "@/lib/session";

export const metadata: Metadata = { title: "Partner analytics", robots: { index: false } };

const RANGES = [7, 30, 90];
const n = (value: number) => value.toLocaleString("en-IN");
const pct = (part: number, whole: number) => (whole ? `${((part / whole) * 100).toFixed(part / whole < 0.1 ? 1 : 0)}%` : "–");
const when = (date: Date | null) =>
  date ? date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "Never";
const shortDay = (day: string) =>
  new Date(`${day}T12:00:00+05:30`).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const label = "font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted";

function Tile({ title, value, note }: { title: string; value: string; note?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4">
      <dt className={label}>{title}</dt>
      <dd className="mt-2 text-2xl font-semibold tabular-nums">{value}</dd>
      {note && <dd className="mt-0.5 text-sm text-muted">{note}</dd>}
    </div>
  );
}

/** Requests per day, all clients: one series, so one colour and no legend; hover or focus a day for its numbers. */
function RequestsChart({ days }: { days: { day: string; requests: number; errors: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.requests));
  return (
    <figure className="rounded-2xl border border-line bg-white p-5">
      <figcaption className="font-semibold">Requests per day, all clients</figcaption>
      <div className="mt-6 flex gap-3">
        <div className="flex h-48 flex-col justify-between text-right text-xs tabular-nums text-muted" aria-hidden="true">
          <span>{n(max)}</span>
          <span>0</span>
        </div>
        <div className="flex-1">
          <div
            role="img"
            aria-label={`Daily requests over ${days.length} days, from ${n(Math.min(...days.map((d) => d.requests)))} to ${n(max)} a day. The table below has every day.`}
            className="flex h-48 items-end gap-[2px] border-b border-line"
          >
            {days.map((d) => (
              <div key={d.day} tabIndex={0} className="group relative flex h-full flex-1 items-end outline-none hover:bg-ink/[0.03] focus-visible:bg-ink/[0.06]">
                {d.requests > 0 && (
                  <div className="w-full rounded-t-[4px] bg-pine" style={{ height: `${Math.max((d.requests / max) * 100, 1.5)}%` }} />
                )}
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-ink px-3 py-2 text-xs text-paper shadow-lg group-hover:block group-focus-visible:block">
                  <div className="font-medium">{shortDay(d.day)}</div>
                  <div className="tabular-nums">
                    {n(d.requests)} requests · {n(d.errors)} errors
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-xs text-muted" aria-hidden="true">
            <span>{shortDay(days[0].day)}</span>
            <span>{shortDay(days[Math.floor(days.length / 2)].day)}</span>
            <span>{shortDay(days[days.length - 1].day)}</span>
          </div>
        </div>
      </div>
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-pine">Show as a table</summary>
        <table className="mt-3 w-full max-w-md text-left">
          <thead className={label}>
            <tr>
              <th className="py-2">Day</th>
              <th className="text-right">Requests</th>
              <th className="text-right">Errors</th>
            </tr>
          </thead>
          <tbody>
            {[...days].reverse().map((d) => (
              <tr key={d.day} className="border-t border-line">
                <td className="py-1.5">{shortDay(d.day)}</td>
                <td className="text-right tabular-nums">{n(d.requests)}</td>
                <td className="text-right tabular-nums">{n(d.errors)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}

export default async function PartnerAnalyticsPage({ searchParams }: PageProps<"/admin/analytics">) {
  await requireAdmin();
  const requested = Number((await searchParams).days);
  const range = RANGES.includes(requested) ? requested : 30;

  const [clients, licences, usage, stats, byDay, byEndpoint] = await Promise.all([
    db.select().from(distributors).orderBy(asc(distributors.name)),
    db.select({ distributorId: distributorCourses.distributorId }).from(distributorCourses),
    usageByDistributor(range),
    partnerStats(),
    usageByDay(null, range),
    usageByEndpoint(null, range),
  ]);

  const perDay = new Map(byDay.map((d) => [d.day, d]));
  const days = daysInWindow(range).map((day) => ({ day, requests: perDay.get(day)?.requests ?? 0, errors: perDay.get(day)?.errors ?? 0 }));
  const empty = { learners: 0, completions: 0, released: 0, waiting: 0, unpaidBatches: 0 };
  const rows = clients
    .map((c) => ({
      client: c,
      courses: c.allCourses ? "All" : String(licences.filter((l) => l.distributorId === c.id).length),
      usage: usage.get(c.id) ?? { requests: 0, errors: 0 },
      stats: stats.get(c.id) ?? empty,
    }))
    .sort((a, b) => b.usage.requests - a.usage.requests || a.client.name.localeCompare(b.client.name));
  const sum = (pick: (r: (typeof rows)[number]) => number) => rows.reduce((t, r) => t + pick(r), 0);
  const requests = sum((r) => r.usage.requests);
  const errors = sum((r) => r.usage.errors);

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-[-0.03em]">Partner analytics</h1>
          <p className="mt-2 max-w-2xl text-muted">
            Every distributor side by side: API usage, learners, completions and certificates. Usage counts requests
            made with a client&apos;s key (India time); manage a client on{" "}
            <Link href="/admin/distributors" className="text-pine underline underline-offset-4">
              Distributors
            </Link>
            .
          </p>
        </div>
        <nav aria-label="Time range" className="flex gap-1 rounded-full border border-line bg-white p-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`?days=${r}`}
              aria-current={r === range ? "page" : undefined}
              className={`rounded-full px-4 py-1.5 text-sm font-medium ${r === range ? "bg-ink text-paper" : "text-muted hover:text-ink"}`}
            >
              {r} days
            </Link>
          ))}
        </nav>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile title="Active clients" value={n(clients.filter((c) => c.status === "active").length)} note={`${n(clients.length)} in total`} />
        <Tile title={`Requests, ${range} days`} value={n(requests)} note={`${pct(errors, requests)} errors`} />
        <Tile title="Learners" value={n(sum((r) => r.stats.learners))} note={`${n(sum((r) => r.stats.completions))} completions`} />
        <Tile
          title="Certificates released"
          value={n(sum((r) => r.stats.released))}
          note={`${n(sum((r) => r.stats.waiting))} waiting · ${n(sum((r) => r.stats.unpaidBatches))} unpaid batches`}
        />
      </dl>

      <div className="mt-6">
        <RequestsChart days={days} />
      </div>

      <section className="mt-6 overflow-x-auto rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Clients</h2>
        {rows.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No distributors yet.</p>
        ) : (
          <table className="mt-4 w-full min-w-[56rem] text-left text-sm">
            <thead className={label}>
              <tr>
                <th className="py-2">Client</th>
                <th>Courses</th>
                <th className="text-right">Requests</th>
                <th className="text-right">Errors</th>
                <th>Last used</th>
                <th className="text-right">Learners</th>
                <th className="text-right">Completions</th>
                <th className="text-right">Released</th>
                <th className="text-right">Waiting</th>
                <th className="text-right">Unpaid batches</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ client, courses, usage: u, stats: s }) => (
                <tr key={client.id} className="border-t border-line align-top">
                  <td className="py-2.5">
                    <Link href={`/admin/distributors/${client.id}`} className="font-medium underline underline-offset-4">
                      {client.name}
                    </Link>
                    {client.status !== "active" && <span className="ml-2 text-xs text-muted">({client.status})</span>}
                  </td>
                  <td>{courses}</td>
                  <td className="text-right tabular-nums">{n(u.requests)}</td>
                  <td className="text-right tabular-nums">
                    {n(u.errors)} <span className="text-muted">({pct(u.errors, u.requests)})</span>
                  </td>
                  <td className="whitespace-nowrap">{when(client.lastUsedAt)}</td>
                  <td className="text-right tabular-nums">{n(s.learners)}</td>
                  <td className="text-right tabular-nums">{n(s.completions)}</td>
                  <td className="text-right tabular-nums">{n(s.released)}</td>
                  <td className="text-right tabular-nums">{n(s.waiting)}</td>
                  <td className="text-right tabular-nums">{n(s.unpaidBatches)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-muted">
          Requests and errors cover the last {range} days; learners, completions and certificates are all-time. Waiting =
          completed but not yet issued (unpaid, or set to manual release).
        </p>
      </section>

      <section className="mt-6 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Endpoints, all clients, last {range} days</h2>
        {byEndpoint.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No API requests in this period.</p>
        ) : (
          <table className="mt-4 w-full max-w-2xl text-left text-sm">
            <thead className={label}>
              <tr>
                <th className="py-2">Endpoint</th>
                <th className="text-right">Requests</th>
                <th className="text-right">Errors</th>
              </tr>
            </thead>
            <tbody>
              {byEndpoint.map((e) => (
                <tr key={e.endpoint} className="border-t border-line">
                  <td className="py-2 font-mono text-xs">{e.endpoint}</td>
                  <td className="text-right tabular-nums">{n(e.requests)}</td>
                  <td className="text-right tabular-nums">
                    {n(e.errors)} <span className="text-muted">({pct(e.errors, e.requests)})</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
