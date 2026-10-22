import { programBySlug } from "@/content/programs";
import { company, companyAddress, site } from "@/content/site";
import { formatDate } from "@/lib/pricing";
import { invoiceUrl, issueInvoice } from "@/lib/invoices";
import { confirmBooking } from "@/lib/bookings";
import { sendEmail } from "@/lib/email";
import { cashfreeConfigured, decisivePayment, fetchOrder, fetchPayments, type CashfreePayment } from "@/lib/cashfree";
import { fulfilAndNotify, paymentProblemMessage } from "@/app/api/checkout/course-fulfilment";

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** What the browser gets when the order has no successful payment yet. */
function unsettled(payment: CashfreePayment | undefined) {
  if (payment?.status === "PENDING") {
    return Response.json(
      { pending: true, error: "Your payment is still processing. We'll email you as soon as it's confirmed; there's no need to pay again." },
      { status: 202 },
    );
  }
  return Response.json({ error: payment ? `Payment ${payment.status.toLowerCase().replace("_", " ")}` : "No payment was made" }, { status: 409 });
}

/**
 * Called by the browser when checkout closes (or on the return URL): asks Cashfree whether
 * the order was paid and, if so, confirms it. Nothing from the browser but the order id
 * is trusted.
 */
export async function POST(request: Request) {
  if (!cashfreeConfigured()) {
    return Response.json({ error: "Online payment is not available" }, { status: 503 });
  }
  const body = (await request.json().catch(() => null)) as { courseSlug?: unknown; orderId?: unknown } | null;
  if (typeof body?.orderId !== "string" || !body.orderId) {
    return Response.json({ error: "Missing payment details" }, { status: 400 });
  }
  if (body.courseSlug !== undefined) return verifyCourse(body.orderId);
  const orderId = body.orderId;

  // Ask Cashfree what really happened, rather than trusting the browser.
  let order: Awaited<ReturnType<typeof fetchOrder>>;
  let paid: CashfreePayment | undefined;
  try {
    [order, paid] = await Promise.all([fetchOrder(orderId), fetchPayments(orderId).then(decisivePayment)]);
  } catch (error) {
    console.error("[checkout] payment lookup failed:", error);
    return Response.json({ error: "We could not confirm the payment. Our team will check." }, { status: 502 });
  }
  if (order.tags.kind === "call") return paid?.status === "SUCCESS" ? verifyCall(orderId, paid.id) : unsettled(paid);
  const program = order.tags.kind === "program" ? programBySlug(order.tags.slug ?? "") : undefined;
  if (!program) return Response.json({ error: "Unknown program" }, { status: 400 });
  if (paid?.status !== "SUCCESS") return unsettled(paid);
  const paymentId = paid.id;

  const name = order.tags.name || "there";
  const email = order.tags.email ?? "";
  const phone = order.tags.phone ?? "";
  const rupees = (paid.amount / 100).toLocaleString("en-IN");
  const starts = program.cohort ? formatDate(program.cohort.startDate) : "the next cohort";
  const invoice = await issueInvoice({
    orderId,
    paymentId,
    description: `${program.name}: one seat${program.cohort ? `, ${program.cohort.name}` : ""}`,
    totalPaise: paid.amount,
    buyer: { name: order.tags.name || email, email, phone, gstin: order.tags.gstin, company: order.tags.company, address: order.tags.address },
  });
  const billUrl = invoice ? invoiceUrl(invoice) : null;

  if (email) {
    await sendEmail({
      from: process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`,
      to: [email],
      reply_to: site.email,
      subject: `Your seat is confirmed: ${program.name}`,
      text: `Hi ${name},\n\nYour seat in ${program.name} is confirmed.\n\nStarts: ${starts}\nSchedule: ${program.cohort?.schedule ?? "to be confirmed"}\nPaid: ₹${rupees} (incl. GST)\nPayment ID: ${paymentId}\n${billUrl ? `GST invoice: ${billUrl}\n` : ""}\nWe will email joining details and the welcome pack a week before the first session. Reply to this email with any questions.\n\n${company.legalName}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0b1916">
        <h1 style="font-size:22px;margin:0 0 16px">Your seat is confirmed</h1>
        <p style="line-height:1.7;color:#56655f">Hi ${escapeHtml(name)}, you're enrolled in <strong style="color:#0b1916">${escapeHtml(program.name)}</strong>.</p>
        <table style="border-collapse:collapse;font-size:14px;margin:20px 0">
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Starts</td><td>${escapeHtml(starts)}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Schedule</td><td>${escapeHtml(program.cohort?.schedule ?? "To be confirmed")}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Paid</td><td>₹${rupees} (incl. GST)</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Payment ID</td><td>${escapeHtml(paymentId)}</td></tr>
          ${billUrl ? `<tr><td style="padding:6px 16px 6px 0;color:#56655f">GST invoice</td><td><a href="${escapeHtml(billUrl)}" style="color:#0b1916">${escapeHtml(invoice!.number)}</a></td></tr>` : ""}
        </table>
        <p style="line-height:1.7;color:#56655f">We'll send joining details and the welcome pack a week before the first session. Just reply to this email with any questions.</p>
        <p style="font-size:12px;color:#56655f;margin-top:24px">${escapeHtml(company.legalName)}, ${escapeHtml(companyAddress)}</p>
      </div>`,
    });
  }

  await sendEmail({
    from: process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`,
    to: (process.env.ENQUIRY_TO_EMAIL ?? site.email).split(",").map((address) => address.trim()),
    reply_to: email || site.email,
    subject: `New enrolment: ${program.name} — ${name}`,
    text: `Program: ${program.name}\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nAmount: ₹${rupees}\nPayment ID: ${paymentId}\nOrder ID: ${orderId}\nGSTIN: ${order.tags.gstin ?? "(none)"}\nInvoice: ${billUrl ?? "NOT ISSUED, check COMPANY_GSTIN and logs"}`,
  });

  return Response.json({ ok: true, program: program.name, paymentId, invoiceUrl: billUrl });
}

/** A course payment: enrol (via the same fulfilment as the webhook) and send the learner into it. */
async function verifyCourse(orderId: string) {
  let paid: CashfreePayment | undefined;
  try {
    paid = decisivePayment(await fetchPayments(orderId));
  } catch (error) {
    console.error("[checkout] payment lookup failed:", error);
    return Response.json({ error: "We couldn't confirm your payment just now. If money left your account, our team will sort it out within a working day." }, { status: 502 });
  }
  if (paid?.status !== "SUCCESS") return unsettled(paid);

  let result: Awaited<ReturnType<typeof fulfilAndNotify>>;
  try {
    result = await fulfilAndNotify(orderId, paid.id, "verify");
  } catch {
    return Response.json({ error: paymentProblemMessage(paid.id), paymentId: paid.id }, { status: 502 });
  }
  switch (result.outcome) {
    case "fulfilled":
    case "already-fulfilled":
      return Response.json({ redirect: `/learn/${result.courseSlug}` });
    case "not-paid":
      return Response.json({ error: `Payment status is ${result.status}` }, { status: 409 });
    default:
      return Response.json({ error: paymentProblemMessage(paid.id), paymentId: paid.id }, { status: 502 });
  }
}

/** A discovery call: confirm the held slot and hand back the calendar and invoice links. */
async function verifyCall(orderId: string, paymentId: string) {
  try {
    const result = await confirmBooking(orderId, paymentId);
    switch (result.outcome) {
      case "confirmed":
      case "already-confirmed":
        return Response.json({
          ok: true,
          startsAt: result.booking.startsAt.toISOString(),
          calendarUrl: result.calendarUrl,
          invoiceUrl: result.invoiceUrl,
        });
      case "clash":
        return Response.json(
          {
            error: `Your payment went through, but someone else booked that time while you were paying. We'll contact you within a working day to pick a new time or refund you. Payment ID: ${paymentId}`,
          },
          { status: 422 },
        );
      default:
        return Response.json({ error: "Unknown booking" }, { status: 400 });
    }
  } catch (error) {
    console.error("[booking] confirmation failed:", orderId, error);
    return Response.json(
      {
        error: `Your payment went through, but we couldn't finish confirming your booking just now. It will complete automatically and you'll get an email; if you don't within an hour, write to ${site.email}. Payment ID: ${paymentId}`,
      },
      { status: 502 },
    );
  }
}
