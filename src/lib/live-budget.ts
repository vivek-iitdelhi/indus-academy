import { setTimeout as sleep } from "node:timers/promises";
import { sql } from "drizzle-orm";
import { db } from "../db/index.ts";
import { liveBudget } from "../db/schema.ts";
import { backoffMs } from "./backoff.ts";

// One request budget for the webinar.gg account (120 a minute for everyone: partners, our site,
// admins), shared by every container through Postgres. It is a GCRA bucket in one row: `tat` is
// when the bucket would be full again; a request moves it on by one interval, and is refused
// while that would push it past the caller's floor. Floors make priorities: joins leave
// RESERVE.join requests for admins and the host studio, and the attendance sync only spends
// what is above RESERVE.sync, so it runs on what joins leave over. webinar.gg's RateLimit
// header and its 429s pull the bucket down to what it says is left.
// ponytail: no FIFO among waiters, whoever polls first after a slot frees gets it; give out
// tickets if waits turn out unfair.

export type Priority = "host" | "join" | "sync";
/** `cost`: how many of the provider's limit units one request uses up. */
export type Budget = { name: string; perMinute: number; burst: number; cost: number };

/**
 * webinar.gg says 120 a minute, but counts every request twice (2026-10-28: RateLimit remaining
 * fell 120 → 118 → 116 over two calls in a fresh window), so 60 requests; we stay a little under.
 */
export const WEBINAR_GG: Budget = { name: "webinar.gg", perMinute: 55, burst: 30, cost: 2 };
const RESERVE: Record<Priority, number> = { host: 0, join: 8, sync: 20 };
/** How long a caller waits in line for a slot before giving up with LiveBusy. */
const WAIT_MS: Record<Priority, number> = { host: 10_000, join: 8_000, sync: 5_000 };

/** No slot in time: the caller should come back in `retryAfter` seconds. */
export class LiveBusy extends Error {
  readonly retryAfter: number;
  constructor(retryAfter: number) {
    super(`webinar.gg budget spent; retry in ${retryAfter}s`);
    this.retryAfter = retryAfter;
  }
}

/** Seconds to tell a client to wait: past the next free slot, spread so retries don't land together. */
export const retryAfterSeconds = (waitSeconds: number, rand = Math.random) => Math.ceil(waitSeconds) + 1 + Math.floor(rand() * 5);

const secs = (n: number) => sql`make_interval(secs => ${n}::float8)`;

/** Takes one request from the budget: 0 if granted, else the seconds until one would be. */
export async function take(priority: Priority, b: Budget = WEBINAR_GG): Promise<number> {
  const interval = 60 / b.perMinute;
  const ahead = (b.burst - RESERVE[priority]) * interval; // how far past now tat may run
  // One statement, so concurrent takers serialise on the row and its condition is re-checked.
  const granted = await db.execute(sql`
    update live_budget set tat = greatest(tat, now()) + ${secs(interval)}
    where name = ${b.name} and greatest(tat, now()) + ${secs(interval)} <= now() + ${secs(ahead)}
    returning 1`);
  if (granted.length) return 0;
  const [row] = await db.execute<{ wait: number }>(sql`
    select extract(epoch from greatest(tat, now()) - now())::float8 + ${interval - ahead}::float8 as wait
    from live_budget where name = ${b.name}`);
  if (row) return Math.max(row.wait, 0.01);
  await db.insert(liveBudget).values({ name: b.name }).onConflictDoNothing(); // first use: a full bucket
  return take(priority, b);
}

/** Waits up to the priority's limit for a request slot; throws LiveBusy if none comes. */
export async function acquire(priority: Priority, b: Budget = WEBINAR_GG, waitMs = WAIT_MS[priority]) {
  const deadline = Date.now() + waitMs;
  for (let attempt = 0; ; attempt++) {
    const wait = await take(priority, b);
    if (!wait) return;
    const left = deadline - Date.now();
    if (wait * 1000 > left) throw new LiveBusy(retryAfterSeconds(wait));
    await sleep(Math.min(left, wait * 1000 + backoffMs(attempt, { base: 100, cap: 2_000 })));
  }
}

/**
 * Folds a webinar.gg response into the budget: its `RateLimit: limit=…, remaining=…, reset=…`
 * caps what we think is left, and a 429 (or remaining=0) empties the bucket until it may retry.
 * Returns that wait in seconds, 0 if none.
 */
export async function observe(status: number, headers: Headers, b: Budget = WEBINAR_GG): Promise<number> {
  const limit = headers.get("ratelimit") ?? "";
  const field = (key: string) => Number(limit.match(new RegExp(`\\b${key}=(\\d+)`))?.[1] ?? NaN);
  const remaining = Math.floor(field("remaining") / b.cost); // requests left, NaN without the header
  const wait = status === 429 ? Number(headers.get("retry-after")) || field("reset") || 60 : remaining === 0 ? field("reset") || 60 : 0;
  const interval = 60 / b.perMinute;
  // tat no earlier than: empty when the wait is over, else just `remaining` requests left.
  const ahead = wait ? wait + b.burst * interval : Number.isNaN(remaining) ? 0 : (b.burst - remaining) * interval;
  if (ahead > 0) await db.execute(sql`update live_budget set tat = greatest(tat, now() + ${secs(ahead)}) where name = ${b.name}`);
  return wait;
}
