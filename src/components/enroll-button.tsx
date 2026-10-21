"use client";

import { useEffect, useId, useState } from "react";
import { CheckIcon } from "./ui";

type CheckoutResult = { error?: { message?: string }; redirect?: boolean; paymentDetails?: unknown };

declare global {
  interface Window {
    Cashfree?: (options: { mode: "sandbox" | "production" }) => {
      checkout: (options: { paymentSessionId: string; redirectTarget: "_modal" }) => Promise<CheckoutResult>;
    };
  }
}

const SDK_SRC = "https://sdk.cashfree.com/js/v3/cashfree.js";

function loadSdk() {
  return new Promise<void>((resolve, reject) => {
    if (window.Cashfree) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SDK_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = SDK_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(script);
  });
}

/**
 * Opens Cashfree's checkout over the page and resolves when it closes, whatever happened:
 * the caller asks the server how it went. `redirect` means the browser could not show the
 * popup (some in-app browsers) and is going to Cashfree's page; it comes back with ?order=.
 */
export async function openCheckout(order: { paymentSessionId: string; mode: "sandbox" | "production" }) {
  await loadSdk().catch(() => {});
  if (!window.Cashfree) throw new Error("Payment window could not load. Check your connection and try again.");
  return window.Cashfree({ mode: order.mode }).checkout({ paymentSessionId: order.paymentSessionId, redirectTarget: "_modal" });
}

/** The order id a redirect checkout came back with, removed from the address bar so a refresh doesn't repeat it. */
export function takeReturnedOrder() {
  const orderId = new URLSearchParams(window.location.search).get("order");
  if (orderId) window.history.replaceState(null, "", window.location.pathname + window.location.hash);
  return orderId;
}

const inputClass =
  "mt-2 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

export function EnrollButton({ slug }: { slug: string }) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  /** `closed`: the buyer shut the popup, so "no payment" is expected and not worth an error. */
  async function confirm(orderId: string, closed: boolean) {
    setBusy(true);
    try {
      const res = await fetch("/api/checkout/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const verified = await res.json();
      if (res.status === 200) return setDone(true);
      if (!(res.status === 409 && closed)) setError(verified.error ?? "Payment could not be verified");
    } catch {
      setError("We couldn't confirm your payment just now. If money left your account, our team will sort it out within a working day.");
    }
    setBusy(false);
  }

  useEffect(() => {
    const orderId = takeReturnedOrder();
    // Back from a redirect checkout; verify reads everything else from the order.
    if (!orderId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(true);
    void confirm(orderId, false);
  }, []);

  async function pay(form: HTMLFormElement) {
    const data = new FormData(form);
    const details = {
      slug,
      name: String(data.get("name") ?? ""),
      email: String(data.get("email") ?? ""),
      phone: String(data.get("phone") ?? ""),
    };

    setBusy(true);
    setError(null);
    try {
      const orderRes = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(details),
      });
      const order = await orderRes.json();
      if (!orderRes.ok) throw new Error(order.error ?? "Could not start the payment");

      const result = await openCheckout(order);
      if (result.redirect) return;
      await confirm(order.orderId, Boolean(result.error));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div role="status" className="rounded-xl bg-mint/50 p-5 text-pine">
        <span className="flex items-center gap-2 font-semibold">
          <CheckIcon className="size-4" /> Seat confirmed
        </span>
        <p className="mt-2 text-sm leading-relaxed">
          Your payment went through and a confirmation email is on its way. We&apos;ll send joining details a week
          before the first session.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-medium text-paper transition-colors hover:bg-pine"
      >
        Reserve your seat
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void pay(e.currentTarget);
      }}
      className="space-y-4"
    >
      <div>
        <label htmlFor={`${fieldId}-name`} className="text-sm font-medium">
          Full name
        </label>
        <input id={`${fieldId}-name`} name="name" required autoComplete="name" className={inputClass} />
      </div>
      <div>
        <label htmlFor={`${fieldId}-email`} className="text-sm font-medium">
          Email
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

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-medium text-paper transition-colors hover:bg-pine disabled:opacity-60"
      >
        {busy ? "Opening payment…" : "Continue to payment"}
      </button>
      <p className="text-center text-xs text-muted">Secure payment. GST invoice sent by email.</p>
    </form>
  );
}
