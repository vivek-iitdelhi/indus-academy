import { takenSlots } from "@/lib/bookings";
import { openSlots } from "@/lib/slots";

/** Free discovery-call start times (ISO), soonest first. */
export async function GET() {
  try {
    const now = new Date();
    const slots = openSlots(now, await takenSlots(now)).map((s) => s.toISOString());
    return Response.json({ slots }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("[booking] could not list slots:", error);
    return Response.json({ error: "Could not load the calendar. Please refresh." }, { status: 502 });
  }
}
