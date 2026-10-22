import assert from "node:assert/strict";
import { test } from "node:test";
import { calendarInvite, formatSlot, openSlots } from "./slots.ts";

// Thursday 22 Oct 2026, 10:00 IST.
const now = new Date("2026-10-22T04:30:00Z");

test("slots start after 24 hours' notice, on weekdays only, in India time", () => {
  const slots = openSlots(now);
  // Friday 23 Oct, 11:00 IST is 25 hours away, so the first slot.
  assert.equal(slots[0].toISOString(), "2026-10-23T05:30:00.000Z");
  assert.equal(formatSlot(slots[0]), "Fri, 23 Oct, 2026, 11:00 am IST");
  for (const s of slots) {
    const weekday = new Date(s.getTime() + 5.5 * 3_600_000).getUTCDay();
    assert.ok(weekday >= 1 && weekday <= 5, s.toISOString());
  }
  assert.ok(!slots.some((s) => s.getTime() < now.getTime() + 24 * 3_600_000));
});

test("taken slots are not offered", () => {
  const first = openSlots(now)[0];
  assert.notEqual(openSlots(now, new Set([first.getTime()]))[0].getTime(), first.getTime());
});

test("the invite is a valid-looking iCalendar request", () => {
  const ics = calendarInvite({
    uid: "abc@indusai.academy",
    start: new Date("2026-10-23T05:30:00Z"),
    title: "Discovery call",
    description: "Line one\nwith, commas; and semis",
    location: "https://meet.google.com/x",
    organizer: { name: "Indus", email: "hello@indusai.academy" },
    attendee: { name: 'A "B"', email: "a@b.com" },
  });
  assert.match(ics, /\r\nDTSTART:20261023T053000Z\r\nDTEND:20261023T060000Z\r\n/);
  assert.match(ics, /DESCRIPTION:Line one\\nwith\\, commas\\; and semis/);
  assert.match(ics, /ATTENDEE;CN="A B";/);
});

test("Zoho start times are India time in Zoho's format; Jitsi rooms are unique", async () => {
  const { jitsiRoom, zohoStartTime } = await import("./meeting.ts");
  assert.equal(zohoStartTime(new Date("2026-10-23T13:30:00Z")), "Oct 23, 2026 07:00 PM");
  assert.equal(zohoStartTime(new Date("2026-01-05T05:30:00Z")), "Jan 05, 2026 11:00 AM");
  assert.notEqual(jitsiRoom(), jitsiRoom());
  assert.match(jitsiRoom(), /^https:\/\/meet\.jit\.si\/IndusAI-[A-Za-z0-9_-]{12}$/);
});
