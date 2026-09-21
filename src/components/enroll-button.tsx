"use client";

import { useId, useState } from "react";
import { CheckIcon } from "./ui";

type RazorpayResponse = {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
};

type RazorpayOptions = {
  key: string;
  order_id: string;
  amount: number;
  currency: string;
  name: string;
  description: string;
  prefill: { name: string; email: string; contact: string };
  theme: { color: string };
  handler: (response: RazorpayResponse) => void;
  modal: { ondismiss: () => void };
};

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayOptions) => { open: () => void };
  }
}

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadCheckout() {
  return new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${CHECKOUT_SRC}"]`);
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("load failed")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = CHECKOUT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("load failed"));
    document.head.appendChild(script);
  });
}

const inputClass =
  "mt-2 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

export function EnrollButton({ slug, programName }: { slug: string; programName: string }) {
  const fieldId = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

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

      await loadCheckout();
      if (!window.Razorpay) throw new Error("Payment window could not load");

      const checkout = new window.Razorpay({
        key: order.keyId,
        order_id: order.orderId,
        amount: order.amount,
        currency: order.currency,
        name: "Indus AI Academy",
        description: programName,
        prefill: { name: details.name, email: details.email, contact: details.phone },
        theme: { color: "#0b1916" },
        modal: { ondismiss: () => setBusy(false) },
        handler: async (response) => {
          try {
            const verifyRes = await fetch("/api/checkout/verify", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                ...details,
                orderId: response.razorpay_order_id,
                paymentId: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });
            const verified = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verified.error ?? "Payment could not be verified");
            setDone(true);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Payment could not be verified");
          } finally {
            setBusy(false);
          }
        },
      });
      checkout.open();
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
      <p className="text-center text-xs text-muted">Payments handled by Razorpay. GST invoice sent by email.</p>
    </form>
  );
}
