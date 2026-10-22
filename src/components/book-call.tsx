"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { openCheckout, takeReturnedOrder } from "./enroll-button";
import { GstFields, gstDetails } from "./gst-fields";
import { CheckIcon } from "./ui";
import { withGstPaise } from "@/lib/gst";
import { formatRupees } from "@/lib/rupees";

const inputClass =
  "mt-2 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";
const buttonClass =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-medium text-paper transition-colors hover:bg-pine disabled:opacity-60";

const india = { timeZone: "Asia/Kolkata" } as const;
const dayKey = (iso: string) => new Date(iso).toLocaleDateString("en-CA", india);
const dayLabel = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { ...india, weekday: "short", day: "numeric", month: "short" });
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { ...india, hour: "numeric", minute: "2-digit" });
const whenLabel = (iso: string) => `${new Date(iso).toLocaleDateString("en-IN", { ...india, weekday: "long", day: "numeric", month: "long" })}, ${timeLabel(iso)} IST`;

type Booked = { startsAt: string; calendarUrl: string; invoiceUrl: string | null };

/** Pick a slot, give details, pay; the server holds the slot while the buyer pays. */
export function BookCall({ price, holdMinutes }: { price: number; holdMinutes: number }) {
  const fieldId = useId();
  const [slots, setSlots] = useState<string[] | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [slot, setSlot] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [booked, setBooked] = useState<Booked | null>(null);
  const total = withGstPaise(price);

  const days = useMemo(() => {
    const byDay = new Map<string, string[]>();
    for (const s of slots ?? []) byDay.set(dayKey(s), [...(byDay.get(dayKey(s)) ?? []), s]);
    return [...byDay.entries()];
  }, [slots]);
  const times = days.find(([key]) => key === day)?.[1] ?? [];

  async function loadSlots() {
    try {
      const res = await fetch("/api/consulting/slots", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setSlots(data.slots);
      setDay((current) => current ?? (data.slots[0] ? dayKey(data.slots[0]) : null));
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Could not load the calendar. Please refresh.");
    }
  }

  /** `closed`: the buyer shut the payment window, so "no payment" is expected, not an error. */
  async function confirm(orderId: string, closed: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const data = await res.json();
      if (res.ok && data.ok) return setBooked(data);
      if (!(res.status === 409 && closed)) setError(data.error ?? "Payment could not be verified");
    } catch {
      setError("We couldn't confirm your payment just now. If money left your account, we'll email you within a working day.");
    }
    setBusy(false);
  }

  useEffect(() => {
    const orderId = takeReturnedOrder();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (orderId) void confirm(orderId, false);
    void loadSlots();
  }, []);

  async function pay(form: HTMLFormElement) {
    if (!slot) return;
    const data = new FormData(form);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/consulting/book", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          startsAt: slot,
          name: data.get("name"),
          email: data.get("email"),
          phone: data.get("phone"),
          company: data.get("company"),
          notes: data.get("notes"),
          ...gstDetails(data),
        }),
      });
      const order = await res.json();
      if (!res.ok) {
        if (res.status === 409) {
          setSlot(null);
          void loadSlots();
        }
        throw new Error(order.error ?? "Could not start the payment");
      }
      const result = await openCheckout(order);
      if (result.redirect) return;
      await confirm(order.orderId, Boolean(result.error));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (booked) {
    return (
      <div role="status" className="rounded-2xl bg-mint/50 p-6 text-pine">
        <span className="flex items-center gap-2 text-lg font-semibold">
          <CheckIcon className="size-5" /> You&apos;re booked
        </span>
        <p className="mt-2 text-ink">{whenLabel(booked.startsAt)}</p>
        <p className="mt-2 text-sm leading-relaxed">
          A calendar invite, the meeting link and your GST invoice are on their way to your inbox.
        </p>
        <div className="mt-5 flex flex-wrap gap-3">
          <a href={booked.calendarUrl} target="_blank" rel="noreferrer" className={`${buttonClass} w-auto`}>
            Add to Google Calendar
          </a>
          {booked.invoiceUrl && (
            <a
              href={booked.invoiceUrl}
              className="inline-flex h-12 items-center justify-center rounded-full border border-pine/30 px-6 font-medium text-pine hover:bg-white/50"
            >
              View invoice
            </a>
          )}
        </div>
      </div>
    );
  }

  const errorNote = error && (
    <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
      {error}
    </p>
  );

  return (
    <div className="space-y-8">
      <fieldset>
        <legend className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">1. Pick a day</legend>
        {slots === null && !error && <p className="mt-3 text-sm text-muted">Loading the calendar…</p>}
        {slots?.length === 0 && (
          <p className="mt-3 text-sm text-muted">No free times in the next two weeks. Please check back soon.</p>
        )}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
          {days.map(([key, daySlots]) => (
            <button
              key={key}
              type="button"
              aria-pressed={key === day}
              onClick={() => {
                setDay(key);
                setSlot(null);
              }}
              className={`shrink-0 rounded-xl border px-4 py-3 text-left text-sm transition-colors ${
                key === day ? "border-ink bg-ink text-paper" : "border-line bg-white/60 hover:border-ink/30"
              }`}
            >
              <span className="block font-medium">{dayLabel(daySlots[0])}</span>
              <span className={key === day ? "text-paper/70" : "text-muted"}>{daySlots.length} free</span>
            </button>
          ))}
        </div>
      </fieldset>

      {times.length > 0 && (
        <fieldset>
          <legend className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">
            2. Pick a time (India time)
          </legend>
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {times.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={t === slot}
                onClick={() => setSlot(t)}
                className={`rounded-xl border px-3 py-2.5 text-sm transition-colors ${
                  t === slot ? "border-pine bg-pine text-paper" : "border-line bg-white/60 hover:border-ink/30"
                }`}
              >
                {timeLabel(t)}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {slot ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void pay(e.currentTarget);
          }}
          className="space-y-4 border-t border-line pt-8"
        >
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.16em] text-muted">3. Your details</p>
          <p className="rounded-xl bg-mint/40 px-4 py-3 text-sm text-pine">{whenLabel(slot)}</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor={`${fieldId}-name`} className="text-sm font-medium">
                Full name
              </label>
              <input id={`${fieldId}-name`} name="name" required autoComplete="name" className={inputClass} />
            </div>
            <div>
              <label htmlFor={`${fieldId}-email`} className="text-sm font-medium">
                Work email
              </label>
              <input
                id={`${fieldId}-email`}
                name="email"
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                autoCapitalize="off"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-phone`} className="text-sm font-medium">
                Phone
              </label>
              <input
                id={`${fieldId}-phone`}
                name="phone"
                type="tel"
                required
                autoComplete="tel"
                inputMode="tel"
                placeholder="+91"
                className={inputClass}
              />
            </div>
            <div>
              <label htmlFor={`${fieldId}-company`} className="text-sm font-medium">
                Company <span className="font-normal text-muted">(optional)</span>
              </label>
              <input id={`${fieldId}-company`} name="company" autoComplete="organization" className={inputClass} />
            </div>
          </div>
          <div>
            <label htmlFor={`${fieldId}-notes`} className="text-sm font-medium">
              What would you like to discuss? <span className="font-normal text-muted">(optional)</span>
            </label>
            <textarea id={`${fieldId}-notes`} name="notes" rows={3} maxLength={1000} className={inputClass} />
          </div>

          <GstFields />
          {errorNote}

          <button type="submit" disabled={busy} className={buttonClass}>
            {busy ? "Opening payment…" : `Pay ${formatRupees(total)} and book`}
          </button>
          <p className="text-center text-xs text-muted">
            {formatRupees(price * 100)} + {formatRupees(total - price * 100)} GST. Your time is held for {holdMinutes}{" "}
            minutes while you pay.
          </p>
        </form>
      ) : (
        errorNote
      )}
    </div>
  );
}
