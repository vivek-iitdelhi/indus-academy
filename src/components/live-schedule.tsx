"use client";

import { useSyncExternalStore } from "react";

// A live course's classes on the (static, minute-revalidated) catalogue: "Upcoming" with the
// time, then "Live now" while a class runs. The clock is the browser's, so the label turns over
// on time even when the page was rendered a minute ago; the server renders no status at all.

export type ClassTime = { id: string; title: string; startsAt: string; endsAt: string };

const day = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" });
const time = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
const when = (c: ClassTime) => `${day.format(new Date(c.startsAt))} · ${time.format(new Date(c.startsAt))}–${time.format(new Date(c.endsAt))}`;

// One 30-second clock shared by every component on the page.
let clock = 0;
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
function subscribe(listener: () => void) {
  listeners.add(listener);
  clock = Date.now();
  timer ??= setInterval(() => {
    clock = Date.now();
    listeners.forEach((l) => l());
  }, 30_000);
  return () => {
    listeners.delete(listener);
    if (!listeners.size) timer = void clearInterval(timer);
  };
}

/** The browser's clock (ms), ticking every 30 s; null on the server and while hydrating. */
export const useNow = (): number | null => useSyncExternalStore(subscribe, () => clock || null, () => null);

const isLive = (c: ClassTime, now: number) => Date.parse(c.startsAt) <= now && now < Date.parse(c.endsAt);

/** One line: the class running now, or the next one. Nothing once they are all over. */
export function NextClass({ classes, className = "" }: { classes: ClassTime[]; className?: string }) {
  const now = useNow();
  if (now === null) return null;
  const next = classes.find((c) => Date.parse(c.endsAt) > now);
  if (!next) return null;
  const live = isLive(next, now);
  return (
    <p className={className}>
      <span className={`mr-2 rounded-full px-2.5 py-0.5 text-xs font-medium ${live ? "bg-red-600 text-white" : "bg-saffron/25 text-ink"}`}>
        {live ? "Live now" : "Upcoming"}
      </span>
      {live ? `until ${time.format(new Date(next.endsAt))} (India time)` : `${when(next)} (India time)`}
    </p>
  );
}

/** Every class, in order, marking the one live now and the ones that are over. */
export function ClassList({ classes }: { classes: ClassTime[] }) {
  const now = useNow();
  return (
    <ol className="divide-y divide-line rounded-2xl border border-line bg-white">
      {classes.map((c) => {
        const live = now !== null && isLive(c, now);
        const over = now !== null && Date.parse(c.endsAt) <= now;
        return (
          <li key={c.id} className={`flex flex-wrap items-baseline justify-between gap-2 p-5 ${over ? "text-muted" : ""}`}>
            <span className="font-medium">{c.title}</span>
            <span className="text-sm">
              {live && <span className="mr-2 rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-medium text-white">Live now</span>}
              {when(c)}
              {over && " · over"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
