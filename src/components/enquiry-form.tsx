"use client";

import { useActionState } from "react";
import { submitEnquiry, type EnquiryField, type EnquiryState } from "@/app/contact/actions";
import { enquiryInterests, teamSizes } from "@/content/site";
import { CheckIcon } from "./ui";

const initialState: EnquiryState = { status: "idle" };

const inputClass =
  "mt-2 block w-full rounded-xl border border-line bg-paper px-4 py-3 text-ink placeholder:text-muted/60 transition-colors focus:border-pine focus:outline-none focus:ring-2 focus:ring-pine/20 aria-[invalid=true]:border-red-700";

function Field({
  name,
  label,
  error,
  optional,
  children,
}: {
  name: EnquiryField;
  label: string;
  error?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label htmlFor={name} className="text-sm font-medium">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {error && (
        <p id={`${name}-error`} className="mt-1.5 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function EnquiryForm({ defaultInterest }: { defaultInterest?: string }) {
  const [state, formAction, pending] = useActionState(submitEnquiry, initialState);

  if (state.status === "success") {
    return (
      <div role="status" className="flex flex-col items-start py-6">
        <span className="grid size-12 place-items-center rounded-full bg-mint text-pine">
          <CheckIcon className="size-6" />
        </span>
        <h2 className="mt-6 text-2xl font-semibold tracking-tight">Thank you. We&apos;ve got your message.</h2>
        <p className="mt-3 leading-relaxed text-muted">
          Someone from our team will reply to you by email shortly with next steps.
        </p>
      </div>
    );
  }

  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const invalid = (field: EnquiryField) =>
    errors[field] ? { "aria-invalid": true, "aria-describedby": `${field}-error` } : {};

  return (
    <form action={formAction} className="space-y-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field name="name" label="Full name" error={errors.name}>
          <input id="name" name="name" autoComplete="name" required defaultValue={values.name} className={inputClass} {...invalid("name")} />
        </Field>
        <Field name="email" label="Work email" error={errors.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={values.email}
            className={inputClass}
            {...invalid("email")}
          />
        </Field>
        <Field name="company" label="Company" optional>
          <input id="company" name="company" autoComplete="organization" defaultValue={values.company} className={inputClass} />
        </Field>
        <Field name="role" label="Your role" optional>
          <input id="role" name="role" autoComplete="organization-title" defaultValue={values.role} className={inputClass} />
        </Field>
      </div>

      <Field name="interest" label="I'm interested in" error={errors.interest}>
        <select
          id="interest"
          name="interest"
          required
          defaultValue={values.interest ?? defaultInterest ?? ""}
          className={inputClass}
          {...invalid("interest")}
        >
          <option value="" disabled>
            Choose one
          </option>
          {enquiryInterests.map((i) => (
            <option key={i.value} value={i.value}>
              {i.label}
            </option>
          ))}
        </select>
      </Field>

      <Field name="teamSize" label="How many people would take part?" optional>
        <select id="teamSize" name="teamSize" defaultValue={values.teamSize ?? ""} className={inputClass}>
          <option value="">Not sure yet</option>
          {teamSizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </Field>

      <Field name="message" label="What would you like to achieve?" optional>
        <textarea
          id="message"
          name="message"
          rows={5}
          defaultValue={values.message}
          placeholder="Goals, teams involved, timelines, tools you use…"
          className={inputClass}
        />
      </Field>

      <div aria-hidden="true" className="hidden">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.status === "error" && state.message && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="inline-flex h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-medium text-paper transition-colors hover:bg-pine focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Sending…" : "Send enquiry"}
      </button>
    </form>
  );
}
