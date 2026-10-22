import Link from "next/link";
import { formatDateTime } from "@/lib/admin/ops";
import { googleClientConfigured, googleConnection } from "@/lib/google-calendar";
import { Badge } from "./learners/admin-ui";

/** Which Google Calendar discovery calls are booked on, and the button to (re)connect one. */
export async function CalendarCard({ error }: { error?: string }) {
  const connection = await googleConnection();
  return (
    <section id="calendar" className="mt-8 scroll-mt-24 rounded-2xl border border-line bg-white p-5 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="flex items-center gap-2 font-medium">
          Discovery-call calendar
          <Badge tone={connection ? "good" : "warn"}>{connection ? "Connected" : "Not connected"}</Badge>
        </span>
        {googleClientConfigured() ? (
          <Link
            href="/api/admin/google/connect"
            prefetch={false}
            className="inline-flex h-9 items-center rounded-full bg-ink px-4 font-medium text-paper transition-colors hover:bg-pine"
          >
            {connection ? "Connect a different account" : "Connect Google Calendar"}
          </Link>
        ) : (
          <span className="font-mono text-xs text-muted">AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET missing</span>
        )}
      </div>
      <p className="mt-3 leading-relaxed text-muted">
        {connection
          ? `Calls go on ${connection.email}'s Google Calendar with their own Meet link, and times it is busy aren't offered. Connected by ${connection.connectedBy}, ${formatDateTime(connection.connectedAt)}.`
          : "Until a Google account is connected, every booked call gets its own Jitsi video room and slots follow the fixed weekly hours."}
      </p>
      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-red-800">
          {error}
        </p>
      )}
    </section>
  );
}
