"use server";

import { site } from "@/content/site";
import { newsletterConfigured, sendConfirmationEmail } from "@/lib/newsletter";

export type SubscribeState = { status: "idle" | "success" | "error"; message?: string };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function subscribe(_prev: SubscribeState, formData: FormData): Promise<SubscribeState> {
  // Honeypot: hidden from people, but naive bots fill it in.
  if (formData.get("company")) return { status: "success", message: "Check your inbox to confirm." };

  const email = String(formData.get("email") ?? "").trim().toLowerCase().slice(0, 200);
  if (!EMAIL_PATTERN.test(email)) {
    return { status: "error", message: "Please enter a valid email address." };
  }

  if (!newsletterConfigured()) {
    if (process.env.NODE_ENV !== "production") {
      console.info("[newsletter] not configured; would send confirmation to:", email);
      return { status: "success", message: "Check your inbox to confirm. (dev: logged to console)" };
    }
    console.error("[newsletter] RESEND_API_KEY or RESEND_SEGMENT_ID is missing.");
    return { status: "error", message: `Subscriptions aren't available right now. Email us at ${site.email}.` };
  }

  try {
    await sendConfirmationEmail(email);
  } catch (error) {
    console.error("[newsletter] confirmation email failed:", error);
    return { status: "error", message: "We couldn't send the confirmation email. Please try again." };
  }

  return { status: "success", message: "Almost there: click the link in your inbox to confirm." };
}
