import { and, eq, gt, gte, ne, or, sql } from "drizzle-orm";
import { discoveryCall } from "@/content/consulting";
import { company, companyAddress, site } from "@/content/site";
import { db } from "@/db";
import { bookings, type Booking } from "@/db/schema";
import { sendEmail } from "@/lib/email";
import { invoiceUrl, issueInvoice } from "@/lib/invoices";
import { createMeetingLink } from "@/lib/meeting";
import { escapeHtml } from "@/lib/newsletter";
import { formatRupees } from "@/lib/rupees";
import { calendarInvite, formatSlot, googleCalendarUrl } from "@/lib/slots";

/** How long a slot stays held while the buyer pays. Cashfree stops taking payment 5 minutes earlier. */
export const HOLD_MINUTES = 25;
export const PAY_MINUTES = 20;

const from = () => process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`;
const team = () => (process.env.ENQUIRY_TO_EMAIL ?? site.email).split(",").map((address) => address.trim());

/** A slot is taken while it is booked, or held by someone still paying. */
const blocking = (now: Date) => or(eq(bookings.status, "confirmed"), gt(bookings.heldUntil, now));

export async function takenSlots(now = new Date()) {
  const rows = await db
    .select({ startsAt: bookings.startsAt })
    .from(bookings)
    .where(and(gte(bookings.startsAt, now), blocking(now)));
  return new Set(rows.map((r) => r.startsAt.getTime()));
}

/**
 * Holds `startsAt` for HOLD_MINUTES, or returns null when someone else holds or booked it.
 * A transaction-scoped advisory lock per slot makes the check-then-insert safe.
 */
export async function holdSlot(
  input: Omit<typeof bookings.$inferInsert, "id" | "status" | "heldUntil" | "createdAt" | "paymentId"> & { startsAt: Date },
) {
  const now = new Date();
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`booking:${input.startsAt.toISOString()}`}))`);
    const [busy] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      // The buyer's own earlier hold (they closed the payment window and retried) doesn't count.
      .where(and(eq(bookings.startsAt, input.startsAt), blocking(now), or(eq(bookings.status, "confirmed"), ne(bookings.email, input.email))))
      .limit(1);
    if (busy) return null;
    const [row] = await tx
      .insert(bookings)
      .values({ ...input, heldUntil: new Date(now.getTime() + HOLD_MINUTES * 60_000) })
      .returning();
    return row;
  });
}

const callTitle = () => `${discoveryCall.name} with ${site.name}`;

function invite(booking: Booking) {
  const description = [
    `${discoveryCall.minutes}-minute ${discoveryCall.name.toLowerCase()}.`,
    booking.meetingUrl ? `Join: ${booking.meetingUrl}` : "We will email the meeting link before the call.",
    booking.notes && `Agenda from ${booking.name}: ${booking.notes}`,
    `Questions or to reschedule: ${site.email}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const event = { start: booking.startsAt, title: callTitle(), description, location: booking.meetingUrl || "Online" };
  return {
    ...event,
    googleUrl: googleCalendarUrl(event),
    ics: calendarInvite({
      ...event,
      uid: `${booking.id}@${new URL(site.url).hostname}`,
      organizer: { name: site.name, email: site.email },
      attendee: { name: booking.name, email: booking.email },
    }),
  };
}

export type ConfirmResult =
  | { outcome: "confirmed" | "already-confirmed"; booking: Booking; calendarUrl: string; invoiceUrl: string | null }
  | { outcome: "unknown-order" }
  | { outcome: "clash"; booking: Booking };

/**
 * Turns a paid order into a confirmed booking and sends the invite, bill and team notice.
 * Verify and the webhook both call this; only the call that flips held → confirmed sends
 * email. If the hold lapsed and someone else booked the slot meanwhile, the unique index
 * refuses the confirmation and the team is told to reschedule or refund.
 */
export async function confirmBooking(orderId: string, paymentId: string): Promise<ConfirmResult> {
  let booking: Booking | undefined;
  try {
    [booking] = await db
      .update(bookings)
      .set({ status: "confirmed", paymentId })
      .where(and(eq(bookings.orderId, orderId), eq(bookings.status, "held")))
      .returning();
  } catch (error) {
    const [clashed] = await db.select().from(bookings).where(eq(bookings.orderId, orderId));
    if (!clashed) throw error;
    console.error("[booking] slot taken after hold lapsed:", orderId, error);
    await sendEmail({
      from: from(),
      to: team(),
      reply_to: clashed.email,
      subject: `BOOKING NEEDS ATTENTION: paid call for a taken slot — ${clashed.name}`,
      text: `${clashed.name} paid for a discovery call at ${formatSlot(clashed.startsAt)}, but their hold had lapsed and someone else booked that slot. Contact them to pick a new time (then set this booking's starts_at and status = 'confirmed'), or refund.\n\nEmail: ${clashed.email}\nPhone: ${clashed.phone}\nPayment ID: ${paymentId}\nOrder ID: ${orderId}`,
    });
    return { outcome: "clash", booking: clashed };
  }

  if (!booking) {
    const [existing] = await db.select().from(bookings).where(eq(bookings.orderId, orderId));
    if (!existing) return { outcome: "unknown-order" };
    const bill = await issueInvoice(billFor(existing, paymentId));
    return { outcome: "already-confirmed", booking: existing, calendarUrl: invite(existing).googleUrl, invoiceUrl: bill && invoiceUrl(bill) };
  }

  // Only the call that confirmed gets here, so each booking gets exactly one meeting.
  booking.meetingUrl = await createMeetingLink({
    topic: `${callTitle()}: ${booking.name}${booking.company ? `, ${booking.company}` : ""}`,
    agenda: booking.notes,
    start: booking.startsAt,
    minutes: discoveryCall.minutes,
  });
  const meetUrl = booking.meetingUrl;
  await db
    .update(bookings)
    .set({ meetingUrl: meetUrl })
    .where(eq(bookings.id, booking.id))
    .catch((error) => console.error("[booking] could not save meeting link (emails still carry it):", booking!.id, meetUrl, error));

  const bill = await issueInvoice(billFor(booking, paymentId));
  const billUrl = bill ? invoiceUrl(bill) : null;
  const event = invite(booking);
  const when = formatSlot(booking.startsAt);
  const attachments = [
    { filename: "discovery-call.ics", content: Buffer.from(event.ics).toString("base64"), content_type: "text/calendar; method=REQUEST" },
  ];
  const row = (label: string, value: string) =>
    `<tr><td style="padding:6px 16px 6px 0;color:#56655f">${label}</td><td>${value}</td></tr>`;

  await sendEmail({
    from: from(),
    to: [booking.email],
    reply_to: site.email,
    subject: `Booked: ${discoveryCall.name}, ${when}`,
    attachments,
    text: `Hi ${booking.name},\n\nYour ${discoveryCall.minutes}-minute ${discoveryCall.name.toLowerCase()} is booked.\n\nWhen: ${when}\nJoin: ${meetUrl}\nPaid: ${formatRupees(booking.amountPaise)} (incl. GST)\nPayment ID: ${paymentId}\n${billUrl ? `GST invoice: ${billUrl}\n` : ""}\nThe calendar invite is attached. Add to Google Calendar: ${event.googleUrl}\n\nNeed to reschedule? Reply to this email at least 24 hours before the call.\n\n${company.legalName}`,
    html: `<div style="font-family:system-ui,sans-serif;max-width:560px;color:#0b1916">
      <h1 style="font-size:22px;margin:0 0 16px">Your call is booked</h1>
      <p style="line-height:1.7;color:#56655f">Hi ${escapeHtml(booking.name)}, your ${discoveryCall.minutes}-minute <strong style="color:#0b1916">${escapeHtml(discoveryCall.name.toLowerCase())}</strong> is confirmed.</p>
      <table style="border-collapse:collapse;font-size:14px;margin:20px 0">
        ${row("When", escapeHtml(when))}
        ${row("Join", `<a href="${escapeHtml(meetUrl)}" style="color:#0b1916">${escapeHtml(meetUrl)}</a>`)}
        ${row("Paid", `${formatRupees(booking.amountPaise)} (incl. GST)`)}
        ${row("Payment ID", escapeHtml(paymentId))}
        ${billUrl ? row("GST invoice", `<a href="${escapeHtml(billUrl)}" style="color:#0b1916">${escapeHtml(bill!.number)}</a>`) : ""}
      </table>
      <a href="${escapeHtml(event.googleUrl)}" style="display:inline-block;background:#0b1916;color:#f5f3ec;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px">Add to Google Calendar</a>
      <p style="line-height:1.7;color:#56655f;margin-top:24px">The invite is also attached for Outlook and Apple Calendar. Need to reschedule? Reply at least 24 hours before the call.</p>
      <p style="font-size:12px;color:#56655f;margin-top:24px">${escapeHtml(company.legalName)}, ${escapeHtml(companyAddress)}</p>
    </div>`,
  });

  await sendEmail({
    from: from(),
    to: team(),
    reply_to: booking.email,
    subject: `New discovery call: ${when} — ${booking.name}${booking.company ? ` (${booking.company})` : ""}`,
    attachments,
    text: `When: ${when}\nJoin: ${meetUrl}\nName: ${booking.name}\nEmail: ${booking.email}\nPhone: ${booking.phone}\nCompany: ${booking.company ?? ""}\nGSTIN: ${booking.gstin ?? "(none)"}\nAgenda: ${booking.notes || "(none)"}\nAmount: ${formatRupees(booking.amountPaise)}\nPayment ID: ${paymentId}\nOrder ID: ${orderId}\nInvoice: ${billUrl ?? "NOT ISSUED, check COMPANY_GSTIN and logs"}\n\nAdd to Google Calendar: ${event.googleUrl}`,
  });

  return { outcome: "confirmed", booking, calendarUrl: event.googleUrl, invoiceUrl: billUrl };
}

const billFor = (booking: Booking, paymentId: string) => ({
  orderId: booking.orderId,
  paymentId,
  description: `${discoveryCall.name} (${discoveryCall.minutes} min), ${formatSlot(booking.startsAt)}`,
  totalPaise: booking.amountPaise,
  buyer: {
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    gstin: booking.gstin ?? undefined,
    company: booking.company ?? undefined,
    address: booking.billingAddress ?? undefined,
  },
});
