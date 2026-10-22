// A video link of its own for every discovery call: Google Meet on the connected Google
// Calendar, or a private Jitsi room when no calendar is connected or Google fails after the
// buyer has paid, so a booking never goes out without a link.
import { createGoogleEvent } from "@/lib/google-calendar";
import { jitsiRoom } from "@/lib/slots";

/**
 * Never throws. `googleEventId` is set when the call is on the connected Google Calendar;
 * Google has then emailed the buyer the invite.
 */
export async function createMeeting(input: Parameters<typeof createGoogleEvent>[0]) {
  try {
    const event = await createGoogleEvent(input);
    if (event?.meetUrl) return { meetingUrl: event.meetUrl, googleEventId: event.eventId };
    if (event) {
      console.error("[meeting] Google created the event but no Meet link; adding a Jitsi room:", event.eventId);
      return { meetingUrl: jitsiRoom(), googleEventId: event.eventId };
    }
  } catch (error) {
    console.error("[meeting] Google Calendar failed; using a Jitsi room instead:", error);
  }
  return { meetingUrl: jitsiRoom(), googleEventId: null };
}
