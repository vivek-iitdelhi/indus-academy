import { programBySlug } from "@/content/programs";
import { company, site } from "@/content/site";
import { formatDate } from "@/lib/pricing";
import { fetchPayment, razorpayConfigured, verifySignature } from "@/lib/razorpay";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

async function sendEmail(payload: Record<string, unknown>) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[checkout] RESEND_API_KEY not set; email skipped:", payload.subject);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) console.error("[checkout] email failed:", res.status, await res.text());
}

/** Confirms a completed payment, then emails the learner and the team. */
export async function POST(request: Request) {
  if (!razorpayConfigured()) {
    return Response.json({ error: "Online payment is not available" }, { status: 503 });
  }

  let body: {
    orderId?: string;
    paymentId?: string;
    signature?: string;
    slug?: string;
    name?: string;
    email?: string;
    phone?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { orderId, paymentId, signature, slug } = body;
  if (!orderId || !paymentId || !signature || !slug) {
    return Response.json({ error: "Missing payment details" }, { status: 400 });
  }
  if (!verifySignature({ orderId, paymentId, signature })) {
    console.error("[checkout] signature mismatch for order", orderId);
    return Response.json({ error: "Payment could not be verified" }, { status: 400 });
  }

  const program = programBySlug(slug);
  if (!program) return Response.json({ error: "Unknown program" }, { status: 400 });

  // Ask Razorpay what really happened, rather than trusting the browser.
  let paid: Awaited<ReturnType<typeof fetchPayment>>;
  try {
    paid = await fetchPayment(paymentId);
  } catch (error) {
    console.error("[checkout] payment lookup failed:", error);
    return Response.json({ error: "We could not confirm the payment. Our team will check." }, { status: 502 });
  }
  if (paid.status !== "captured" && paid.status !== "authorized") {
    return Response.json({ error: `Payment status is ${paid.status}` }, { status: 409 });
  }

  const name = (body.name ?? "").trim() || "there";
  const email = (body.email ?? "").trim().toLowerCase();
  const phone = (body.phone ?? "").trim();
  const rupees = (paid.amount / 100).toLocaleString("en-IN");
  const starts = program.cohort ? formatDate(program.cohort.startDate) : "the next cohort";

  if (email) {
    await sendEmail({
      from: process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`,
      to: [email],
      reply_to: site.email,
      subject: `Your seat is confirmed: ${program.name}`,
      text: `Hi ${name},\n\nYour seat in ${program.name} is confirmed.\n\nStarts: ${starts}\nSchedule: ${program.cohort?.schedule ?? "to be confirmed"}\nPaid: ₹${rupees}\nPayment ID: ${paymentId}\n\nWe will email joining details and the welcome pack a week before the first session. Reply to this email with any questions.\n\n${company.legalName}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0b1916">
        <h1 style="font-size:22px;margin:0 0 16px">Your seat is confirmed</h1>
        <p style="line-height:1.7;color:#56655f">Hi ${escapeHtml(name)}, you're enrolled in <strong style="color:#0b1916">${escapeHtml(program.name)}</strong>.</p>
        <table style="border-collapse:collapse;font-size:14px;margin:20px 0">
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Starts</td><td>${escapeHtml(starts)}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Schedule</td><td>${escapeHtml(program.cohort?.schedule ?? "To be confirmed")}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Paid</td><td>₹${rupees}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Payment ID</td><td>${escapeHtml(paymentId)}</td></tr>
        </table>
        <p style="line-height:1.7;color:#56655f">We'll send joining details and the welcome pack a week before the first session. Just reply to this email with any questions.</p>
        <p style="font-size:12px;color:#56655f;margin-top:24px">${escapeHtml(company.legalName)}, ${escapeHtml(company.location)}</p>
      </div>`,
    });
  }

  await sendEmail({
    from: process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`,
    to: (process.env.ENQUIRY_TO_EMAIL ?? site.email).split(",").map((address) => address.trim()),
    reply_to: email || site.email,
    subject: `New enrolment: ${program.name} — ${name}`,
    text: `Program: ${program.name}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nAmount: ₹${rupees}\nPayment ID: ${paymentId}\nOrder ID: ${orderId}\nStatus: ${paid.status}`,
  });

  return Response.json({ ok: true, program: program.name, paymentId });
}
