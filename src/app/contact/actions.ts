"use server";

import { enquiryInterests, site } from "@/content/site";

export type EnquiryField = "name" | "email" | "company" | "role" | "interest" | "teamSize" | "message";

export type EnquiryState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Partial<Record<EnquiryField, string>>;
  values?: Partial<Record<EnquiryField, string>>;
};

type Enquiry = Record<EnquiryField, string>;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const FIELD_LABELS: [EnquiryField, string][] = [
  ["name", "Name"],
  ["email", "Email"],
  ["company", "Company"],
  ["role", "Role"],
  ["interest", "Interested in"],
  ["teamSize", "Team size"],
  ["message", "Message"],
];

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmail(enquiry: Enquiry) {
  const interest = enquiryInterests.find((i) => i.value === enquiry.interest)?.label ?? enquiry.interest;
  const rows = FIELD_LABELS.map(([key, label]) => [label, key === "interest" ? interest : enquiry[key]] as const).filter(
    ([, value]) => value,
  );

  const subject = `New enquiry: ${enquiry.name}${enquiry.company ? ` (${enquiry.company})` : ""} · ${interest}`.slice(0, 200);
  const text = rows.map(([label, value]) => `${label}: ${value}`).join("\n");
  const html = `
    <div style="font-family:system-ui,sans-serif;color:#0b1916;max-width:600px">
      <h2 style="margin:0 0 16px;font-size:18px">New enquiry from the ${escapeHtml(site.name)} website</h2>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding:8px 12px 8px 0;color:#56655f;vertical-align:top;white-space:nowrap">${label}</td>
            <td style="padding:8px 0;white-space:pre-wrap">${escapeHtml(value)}</td>
          </tr>`,
          )
          .join("")}
      </table>
      <p style="margin-top:24px;font-size:12px;color:#56655f">Reply to this email to respond to ${escapeHtml(enquiry.name)} directly.</p>
    </div>`;

  return { subject, text, html };
}

async function sendWithResend(apiKey: string, enquiry: Enquiry) {
  const { subject, text, html } = buildEmail(enquiry);
  const to = (process.env.ENQUIRY_TO_EMAIL ?? site.email).split(",").map((address) => address.trim());

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`,
      to,
      reply_to: enquiry.email,
      subject,
      text,
      html,
      tags: [{ name: "interest", value: enquiry.interest }],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) {
    throw new Error(`Resend responded with ${res.status}: ${await res.text()}`);
  }
}

export async function submitEnquiry(_prev: EnquiryState, formData: FormData): Promise<EnquiryState> {
  // Honeypot: hidden from people, but naive bots fill it in.
  if (formData.get("website")) {
    return { status: "success" };
  }

  const read = (key: EnquiryField) => String(formData.get(key) ?? "").trim().slice(0, 4000);
  const values: Enquiry = {
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[enquiry] RESEND_API_KEY is not set, so this enquiry was only logged:", values);
      return { status: "success" };
    }
    console.error("[enquiry] RESEND_API_KEY is not set; enquiry was not delivered.");
    return { status: "error", message: `We couldn't send your enquiry. Please email us at ${site.email}.`, values };
  }

  try {
    await sendWithResend(apiKey, values);
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
