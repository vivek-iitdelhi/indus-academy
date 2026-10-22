import { calendarBusy, takenSlots } from "@/lib/bookings";
import { openSlots } from "@/lib/slots";

/** Free discovery-call start times (ISO), soonest first. */
export async function GET() {
  try {
    const now = new Date();
    const [taken, busy] = await Promise.all([takenSlots(now), calendarBusy(now)]);
    const slots = openSlots(now, taken, busy).map((s) => s.toISOString());
    return Response.json({ slots }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[booking] could not list slots:", error);
    return Response.json({ error: "Could not load the calendar. Please refresh." }, { status: 502 });
  }
}
