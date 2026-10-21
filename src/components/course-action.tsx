"use client";

import { useEffect, useId, useState } from "react";
import { openCheckout, takeReturnedOrder } from "./enroll-button";
import { formatRupees } from "@/lib/rupees";
import { ButtonLink } from "./ui";

type Ownership = { signedIn: boolean; owned: boolean; needsPhone: boolean; paymentsEnabled: boolean };

const buttonClass =
  "inline-flex h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-medium text-paper transition-colors hover:bg-pine disabled:opacity-60";
const inputClass =
  "mt-2 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { res, data: await res.json().catch(() => ({})) };
}

/**
 * The buy / start / continue button on a course page. The page is static, so who the
 * visitor is comes from /api/learn/ownership after load. Until then (and without JS) it
 * is the signed-out link, which comes back here with ?buy=1 and carries on.
 */
export function CourseAction({ slug, pricePaise }: { slug: string; pricePaise: number }) {
  const phoneId = useId();
  const free = pricePaise <= 0;
  const [me, setMe] = useState<Ownership | null>(null);
  const [askPhone, setAskPhone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rupees = formatRupees(pricePaise);
  const label = free ? "Start free" : `Buy ${rupees}`;

  async function enrolFree() {
    setBusy(true);
    setError(null);
    const { res, data } = await postJson("/api/learn/enroll-free", { courseSlug: slug }).catch(() => ({
      res: null,
      data: {} as Record<string, string>,
    }));
    if (res?.ok) return window.location.assign(data.redirect);
    setError(data.error ?? "Something went wrong. Please try again.");
    setBusy(false);
  }

  /** Asks the server how the order went. `closed`: the buyer shut the popup, so "no payment" is no error. */
  async function confirm(orderId: string, closed: boolean) {
    setBusy(true);
    const { res, data } = await postJson("/api/checkout/verify", { courseSlug: slug, orderId }).catch(() => ({
      res: null,
      data: {} as Record<string, string>,
    }));
    if (res?.status === 200 && data.redirect) return window.location.assign(data.redirect);
    if (!(res?.status === 409 && closed)) {
      setError(
        data.error ??
          `We couldn't confirm your payment just now. If money left your account, our team will sort it out within a working day. Order: ${orderId}`,
      );
    }
    setBusy(false);
  }

  async function pay(phone?: string) {
    setBusy(true);
    setError(null);
    try {
      const { res, data: order } = await postJson("/api/checkout", { courseSlug: slug, phone });
      if (!res.ok) {
        if (order.needsPhone) setAskPhone(true);
        throw new Error(order.error ?? "Could not start the payment");
      }
      setAskPhone(false);

      const result = await openCheckout(order);
      if (result.redirect) return;
      await confirm(order.orderId, Boolean(result.error));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  function start(state: Ownership) {
    if (free) return void enrolFree();
    if (!state.paymentsEnabled) return;
    if (state.needsPhone) return setAskPhone(true);
    void pay();
  }

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/learn/ownership?course=${encodeURIComponent(slug)}`)
      .then((res) => (res.ok ? (res.json() as Promise<Ownership>) : null))
      .then((state) => {
        if (cancelled || !state) return;
        setMe(state);
        // Back from a redirect checkout (?order=…): confirm it.
        const orderId = takeReturnedOrder();
        if (orderId && state.signedIn && !state.owned) return void confirm(orderId, false);
        // Back from sign-in with ?buy=1: carry on. Drop the flag so a refresh doesn't repeat it.
        if (new URLSearchParams(window.location.search).get("buy") !== "1") return;
        window.history.replaceState(null, "", window.location.pathname + window.location.hash);
        if (state.signedIn && !state.owned) start(state);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Runs once per course page; start() only reads props and the fetched state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const errorNote = error && (
    <p role="alert" className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm leading-relaxed text-red-800">
      {error}
    </p>
  );

  if (me?.owned) {
    return (
      <ButtonLink href={`/learn/${slug}`} variant="dark" className="w-full">
        Continue learning
      </ButtonLink>
    );
  }

  if (!me?.signedIn) {
    return (
      <ButtonLink href={`/signin?next=${encodeURIComponent(`/courses/${slug}?buy=1`)}`} variant="dark" className="w-full">
        {label}
      </ButtonLink>
    );
  }

  if (!free && !me.paymentsEnabled) {
    return (
      <>
        <p className="text-sm leading-relaxed text-muted">Online payment opens shortly. Tell us you&apos;re interested and we&apos;ll let you know.</p>
        <ButtonLink href="/contact?interest=programs" variant="dark" className="mt-4 w-full">
          Enquire now
        </ButtonLink>
      </>
    );
  }

  if (askPhone) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void pay(String(new FormData(e.currentTarget).get("phone") ?? ""));
        }}
      >
        <label htmlFor={phoneId} className="text-sm font-medium">
          Phone
        </label>
        <input
          id={phoneId}
          name="phone"
          type="tel"
          required
          autoComplete="tel"
          inputMode="tel"
          placeholder="+91"
          className={inputClass}
        />
        <p className="mt-2 text-xs text-muted">Needed for the payment. We save it to your account.</p>
        <button type="submit" disabled={busy} className={`${buttonClass} mt-4`}>
          {busy ? "Opening payment…" : "Continue to payment"}
        </button>
        {errorNote}
      </form>
    );
  }

  return (
    <>
      <button type="button" disabled={busy} onClick={() => start(me)} className={buttonClass}>
        {busy ? (free ? "Enrolling…" : "Opening payment…") : label}
      </button>
      {!free && <p className="mt-3 text-center text-xs text-muted">Secure payment. Price includes 18% GST.</p>}
      {errorNote}
    </>
  );
}
