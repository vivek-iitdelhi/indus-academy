import { ENCODER_OFFLINE_MS, encoderLastSeen, videoConfigured } from "@/lib/video";
import { formatDateTime } from "@/lib/admin/ops";
import { Badge, SectionTitle } from "./learners/admin-ui";

// What each integration needs; see docs/lms-go-live.md. Only names are shown, never values.
const INTEGRATIONS = [
  { name: "Sign-in emails", vars: ["RESEND_API_KEY", "ENQUIRY_FROM_EMAIL"] },
  { name: "Google sign-in", vars: ["AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"], optional: true },
  { name: "Payments", vars: ["RAZORPAY_KEY_ID", "RAZORPAY_KEY_SECRET"] },
  { name: "Payment webhook", vars: ["RAZORPAY_WEBHOOK_SECRET"] },
  { name: "Video storage", vars: ["R2_ENDPOINT", "R2_BUCKET", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "VIDEO_TOKEN_SECRET"] },
  { name: "Certificates", vars: ["CERTIFICATE_SECRET"] },
  { name: "Daily reminders", vars: ["CRON_SECRET"] },
  { name: "LinkedIn company page", vars: ["LINKEDIN_ORGANIZATION_ID"], optional: true },
];

async function encoderRow() {
  if (!videoConfigured()) return { tone: "muted" as const, label: "Needs video storage", detail: "" };
  const seen = await encoderLastSeen().catch(() => undefined);
  if (seen === undefined) return { tone: "bad" as const, label: "Can't reach storage", detail: "Check the R2 keys and bucket." };
  if (!seen) return { tone: "bad" as const, label: "Never connected", detail: "Start it on the encoder machine: npm run encoder" };
  const online = Date.now() - seen.getTime() <= ENCODER_OFFLINE_MS;
  return { tone: online ? ("good" as const) : ("bad" as const), label: online ? "Online" : "Offline", detail: `Last seen ${formatDateTime(seen)}` };
}

/** Which integrations still need keys, and whether the encoder machine is running. */
export async function SetupStatus() {
  const rows = INTEGRATIONS.map((i) => ({ ...i, missing: i.vars.filter((v) => !process.env[v]) }));
  const encoder = await encoderRow();
  const pending = rows.filter((r) => r.missing.length && !r.optional).length + (encoder.tone === "good" ? 0 : 1);
  return (
    <details open={pending > 0} className="mt-8 rounded-2xl border border-line bg-white p-5">
      <summary className="flex cursor-pointer items-center gap-2 font-medium">
        Setup <Badge tone={pending ? "warn" : "good"}>{pending ? `${pending} to do` : "complete"}</Badge>
      </summary>
      <ul className="mt-4 divide-y divide-line text-sm">
        {rows.map((r) => (
          <li key={r.name} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
            <span>
              {r.name}
              {r.optional && <span className="text-muted"> (optional)</span>}
            </span>
            {r.missing.length ? (
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted">{r.missing.join(", ")}</span>
                <Badge tone={r.optional ? "muted" : "warn"}>Missing</Badge>
              </span>
            ) : (
              <Badge tone="good">Set</Badge>
            )}
          </li>
        ))}
        <li className="flex flex-wrap items-center justify-between gap-2 py-2.5">
          <span>Video encoder machine</span>
          <span className="flex flex-wrap items-center gap-2">
            {encoder.detail && <span className="text-xs text-muted">{encoder.detail}</span>}
            <Badge tone={encoder.tone}>{encoder.label}</Badge>
          </span>
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted">Keys go in the hosting environment variables; see docs/lms-go-live.md.</p>
    </details>
  );
}
