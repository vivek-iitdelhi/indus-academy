"use server";

import { enquiryInterests, site } from "@/content/site";

export type EnquiryField = "name" | "email" | "company" | "role" | "interest" | "teamSize" | "message";

export type EnquiryState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<EnquiryField, string>>;
  values?: Partial<Record<EnquiryField, string>>;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  // Honeypot: hidden from people, but naive bots fill it in.
  if (formData.get("website")) {
    return { status: "success" };
  }

  const read = (key: EnquiryField) => String(formData.get(key) ?? "").trim().slice(0, 4000);
  const values = {
    name: read("name"),
    email: read("email"),
    company: read("company"),
    role: read("role"),
    interest: read("interest"),
    teamSize: read("teamSize"),
    message: read("message"),
  };

  const fieldErrors: EnquiryState["fieldErrors"] = {};
  if (!values.name) fieldErrors.name = "Please tell us your name.";
  if (!EMAIL_PATTERN.test(values.email)) fieldErrors.email = "Please enter a valid email address.";
  if (!enquiryInterests.some((i) => i.value === values.interest)) {
    fieldErrors.interest = "Please choose what you're interested in.";
  }
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please check the highlighted fields.", fieldErrors, values };
  }

  const webhook = process.env.ENQUIRY_WEBHOOK_URL;
  if (!webhook) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[enquiry] ENQUIRY_WEBHOOK_URL is not set, so this enquiry was only logged:", values);
      return { status: "success" };
    }
    console.error("[enquiry] ENQUIRY_WEBHOOK_URL is not set; enquiry was not delivered.");
    return { status: "error", message: `We couldn't send your enquiry. Please email us at ${site.email}.`, values };
  }

  try {
    const res = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...values, source: "indus-academy-website", submittedAt: new Date().toISOString() }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) throw new Error(`Webhook responded with ${res.status}`);
  } catch (error) {
    console.error("[enquiry] delivery failed:", error);
    return {
      status: "error",
      message: `We couldn't send your enquiry just now. Please try again or email us at ${site.email}.`,
      values,
    };
  }

  return { status: "success" };
}
