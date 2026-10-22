import { company, companyAddress, site } from "@/content/site";
import { sendEmail } from "@/lib/email";
import { fulfilCoursePayment, type FulfilResult } from "@/lib/lms/purchase";
import { escapeHtml } from "@/lib/newsletter";
import { invoiceUrl, issueInvoice } from "@/lib/invoices";
import { formatRupees as rupees } from "@/lib/rupees";

const from = () => process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`;
const team = () => (process.env.ENQUIRY_TO_EMAIL ?? site.email).split(",").map((address) => address.trim());

/** What the learner sees when the money moved but we could not enrol them. */
export const paymentProblemMessage = (paymentId: string) =>
  `Your payment went through, but we couldn't finish setting up your course. Our team has been alerted and will sort it out within a working day; there's no need to pay again. Your payment ID is ${paymentId}.`;

/**
 * Fulfils a course order (see fulfilCoursePayment) and sends the emails that go with the
 * outcome: confirmation + team notice when this call enrolled the learner, a team alert
 * when money moved but enrolment did not happen. sendEmail never throws.
 */
export async function fulfilAndNotify(orderId: string, paymentId: string, via: "verify" | "webhook"): Promise<FulfilResult> {
  let result: FulfilResult;
  try {
    result = await fulfilCoursePayment(orderId, paymentId);
  } catch (error) {
    // The order lookup itself failed (database down). Treat it as a problem with this order.
    console.error("[checkout] course fulfilment threw:", error);
    await alertTeam({ orderId, paymentId, problem: `could not read the order: ${String(error)}`, via });
    throw error;
  }

  if (result.outcome === "problem") {
    console.error(`[checkout] course payment problem (${via}):`, result.problem, orderId, paymentId);
    await alertTeam({ ...result, via });
  }
  // The webhook sees program orders too and ignores them; verify was told this is a course.
  if (result.outcome === "unknown-order" && via === "verify") {
    await alertTeam({ orderId, paymentId, problem: "no course order with this id in the database", via });
  }
  if (result.outcome !== "fulfilled") return result;
  if (result.paidTwice) {
    await alertTeam({
      ...result,
      via,
      problem: `paid twice: this learner already has a paid order for this course (${result.paidTwice}). They are enrolled; refund one of the two payments unless the earlier one was meant to stay.`,
    });
  }

  const name = result.buyerName?.trim() || "there";
  const learnUrl = `${site.url}/learn/${result.courseSlug}`;
  const invoice = await issueInvoice({
    orderId,
    paymentId,
    description: `Online course: ${result.courseTitle}`,
    totalPaise: result.amountPaise,
    buyer: { name: result.buyerName?.trim() || result.buyerEmail || "", email: result.buyerEmail ?? "" },
  });
  const billUrl = invoice ? invoiceUrl(invoice) : null;
  if (result.buyerEmail) {
    await sendEmail({
      from: from(),
      to: [result.buyerEmail],
      reply_to: site.email,
      subject: `You're enrolled: ${result.courseTitle}`,
      text: `Hi ${name},\n\nYou now have access to ${result.courseTitle}.\n\nPaid: ${rupees(result.amountPaise)} (incl. GST)\nPayment ID: ${paymentId}\n${billUrl ? `GST invoice: ${billUrl}\n` : ""}\nStart learning: ${learnUrl}\n\nReply to this email with any questions.\n\n${company.legalName}`,
      html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0b1916">
        <h1 style="font-size:22px;margin:0 0 16px">You're enrolled</h1>
        <p style="line-height:1.7;color:#56655f">Hi ${escapeHtml(name)}, you now have access to <strong style="color:#0b1916">${escapeHtml(result.courseTitle)}</strong>.</p>
        <table style="border-collapse:collapse;font-size:14px;margin:20px 0">
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Course</td><td>${escapeHtml(result.courseTitle)}</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Paid</td><td>${rupees(result.amountPaise)} (incl. GST)</td></tr>
          <tr><td style="padding:6px 16px 6px 0;color:#56655f">Payment ID</td><td>${escapeHtml(paymentId)}</td></tr>
          ${billUrl ? `<tr><td style="padding:6px 16px 6px 0;color:#56655f">GST invoice</td><td><a href="${escapeHtml(billUrl)}" style="color:#0b1916">${escapeHtml(invoice!.number)}</a></td></tr>` : ""}
        </table>
        <a href="${escapeHtml(learnUrl)}" style="display:inline-block;background:#0b1916;color:#f5f3ec;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px">Start learning</a>
        <p style="line-height:1.7;color:#56655f;margin-top:24px">Just reply to this email with any questions.</p>
        <p style="font-size:12px;color:#56655f;margin-top:24px">${escapeHtml(company.legalName)}, ${escapeHtml(companyAddress)}</p>
      </div>`,
    });
  }

  await sendEmail({
    from: from(),
    to: team(),
    reply_to: result.buyerEmail || site.email,
    subject: `New course purchase: ${result.courseTitle} — ${result.buyerEmail ?? "unknown"}`,
    text: `Course: ${result.courseTitle}\nName: ${result.buyerName || "(not set)"}\nEmail: ${result.buyerEmail ?? ""}\nAmount: ${rupees(result.amountPaise)}\nPayment ID: ${paymentId}\nOrder ID: ${orderId}\nConfirmed by: ${via}\nInvoice: ${billUrl ?? "NOT ISSUED, check COMPANY_GSTIN and logs"}`,
  });
  return result;
}

async function alertTeam(details: {
  orderId: string;
  paymentId: string;
  problem: string;
  via: string;
  courseTitle?: string;
  buyerEmail?: string | null;
  amountPaise?: number;
}) {
  await sendEmail({
    from: from(),
    to: team(),
    reply_to: details.buyerEmail || site.email,
    subject: `PAYMENT NEEDS ATTENTION: ${details.courseTitle ?? "course order"} — ${details.paymentId}`,
    text: `A Cashfree payment for a course could not be turned into an enrolment. Someone may have paid without getting access: check the order in the Cashfree dashboard, then enrol them by hand or refund.\n\nProblem: ${details.problem}\nCourse: ${details.courseTitle ?? "unknown"}\nBuyer: ${details.buyerEmail ?? "unknown"}\nExpected amount: ${details.amountPaise === undefined ? "unknown" : rupees(details.amountPaise)}\nPayment ID: ${details.paymentId}\nOrder ID: ${details.orderId}\nSeen by: ${details.via}`,
  });
}
