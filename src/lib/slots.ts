// Discovery-call slots and calendar invites. Pure functions, so they run in tests.
import { discoveryCall as call } from "../content/consulting.ts";

const IST = "+05:30";
const istDay = (date: Date) => date.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** Every bookable start time from `now` on, minus `taken` (epoch ms of held or booked slots). */
export function openSlots(now: Date, taken: Set<number> = new Set()) {
  const earliest = now.getTime() + call.minNoticeHours * 3_600_000;
  const slots: Date[] = [];
  for (let d = 0; d <= call.daysAhead; d++) {
    const day = istDay(new Date(now.getTime() + d * 86_400_000));
    // Noon in India is the same calendar day in UTC, so getUTCDay is the Indian weekday.
    const weekday = new Date(`${day}T12:00:00${IST}`).getUTCDay();
    if (!call.weekdays.includes(weekday) || call.blockedDates.includes(day)) continue;
    for (const time of call.startTimes) {
      const start = new Date(`${day}T${time}:00${IST}`);
      if (start.getTime() >= earliest && !taken.has(start.getTime())) slots.push(start);
    }
  }
  return slots;
}

export const callEnd = (start: Date) => new Date(start.getTime() + call.minutes * 60_000);

/** "Mon, 3 Nov, 2026, 11:30 am IST" */
export const formatSlot = (start: Date) =>
  `${start.toLocaleString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  })} IST`;

const icsTime = (date: Date) => date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const icsText = (value: string) => value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const cn = (name: string) => `"${name.replace(/"/g, "")}"`;

type Invite = {
  uid: string;
  start: Date;
  title: string;
  description: string;
  location: string;
  organizer: { name: string; email: string };
  attendee: { name: string; email: string };
};

/**
 * An iCalendar invite (METHOD:REQUEST), which mail apps show with Accept/Add to calendar.
 * ponytail: lines are not folded at 75 octets; Google, Apple and Outlook accept long lines.
 */
export function calendarInvite(invite: Invite) {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Indus AI Academy//Discovery calls//EN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${invite.uid}`,
    `DTSTAMP:${icsTime(new Date())}`,
    `DTSTART:${icsTime(invite.start)}`,
    `DTEND:${icsTime(callEnd(invite.start))}`,
    `SUMMARY:${icsText(invite.title)}`,
    `DESCRIPTION:${icsText(invite.description)}`,
    `LOCATION:${icsText(invite.location)}`,
    `ORGANIZER;CN=${cn(invite.organizer.name)}:mailto:${invite.organizer.email}`,
    `ATTENDEE;CN=${cn(invite.attendee.name)};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=TRUE:mailto:${invite.attendee.email}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}

/** A one-click "Add to Google Calendar" link for the same event. */
export function googleCalendarUrl(invite: Pick<Invite, "start" | "title" | "description" | "location">) {
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: invite.title,
    dates: `${icsTime(invite.start)}/${icsTime(callEnd(invite.start))}`,
    details: invite.description,
    location: invite.location,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
