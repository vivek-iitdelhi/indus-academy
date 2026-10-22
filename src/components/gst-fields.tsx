"use client";

import { useId, useState } from "react";

const inputClass =
  "mt-2 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink placeholder:text-muted/60 focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20";

/** The GST details from a form holding <GstFields />, or nothing when the box was left unticked. */
export const gstDetails = (data: FormData) =>
  data.has("gstin")
    ? { gstin: String(data.get("gstin")), company: String(data.get("company") ?? ""), address: String(data.get("address") ?? "") }
    : {};

/** "I need a GST invoice" and, once ticked, GSTIN, registered name and billing address. */
export function GstFields() {
  const fieldId = useId();
  const [wantsGst, setWantsGst] = useState(false);
  return (
    <>
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={wantsGst}
          onChange={(e) => setWantsGst(e.target.checked)}
          className="size-4 accent-pine"
        />
        I need a GST invoice for my company
      </label>
      {wantsGst && (
        <div className="space-y-4 rounded-xl border border-line p-4">
          <div>
            <label htmlFor={`${fieldId}-gstin`} className="text-sm font-medium">
              GSTIN
            </label>
            <input
              id={`${fieldId}-gstin`}
              name="gstin"
              required
              maxLength={15}
              pattern="[0-9]{2}[A-Za-z]{5}[0-9]{4}[A-Za-z][1-9A-Za-z][Zz][0-9A-Za-z]"
              title="15 characters, e.g. 09AAACI1234A1Z5"
              autoCapitalize="characters"
              placeholder="09AAACI1234A1Z5"
              className={`${inputClass} uppercase`}
            />
          </div>
          <div>
            <label htmlFor={`${fieldId}-company`} className="text-sm font-medium">
              Company name (as registered for GST)
            </label>
            <input id={`${fieldId}-company`} name="company" required autoComplete="organization" className={inputClass} />
          </div>
          <div>
            <label htmlFor={`${fieldId}-address`} className="text-sm font-medium">
              Billing address
            </label>
            <textarea
              id={`${fieldId}-address`}
              name="address"
              required
              rows={2}
              maxLength={250}
              autoComplete="street-address"
              className={inputClass}
            />
          </div>
        </div>
      )}
    </>
  );
}
