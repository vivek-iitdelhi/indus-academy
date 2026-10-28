import { ActionForm } from "@/app/admin/learners/action-form";
import type { Distributor } from "@/db/schema";
import { distributorKeyList } from "@/lib/distributors";
import { listWebhookEvents, webhookStatus } from "@/lib/partner-webhooks";
import { retryWebhooks, revokeKey, saveRateLimit } from "./platform-actions";
import { CreateKeyForm, RotateSecretForm, WebhookUrlForm } from "./platform-forms";

// The partner page's API sections: keys (two at once, for rotation), rate limit, webhooks.

const when = (date: Date | null) =>
  date ? date.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" }) : "–";
const button = "h-9 rounded-full bg-ink px-4 text-sm font-medium text-paper hover:bg-pine";
const link = "text-sm font-medium text-pine underline underline-offset-4";
const th = "font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted";

export async function PlatformSections({ distributor }: { distributor: Distributor }) {
  const id = distributor.id;
  const [keys, events, failed] = await Promise.all([distributorKeyList(id), listWebhookEvents(id, undefined, 20), listWebhookEvents(id, "failed", 1)]);

  return (
    <>
      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">API keys</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          To rotate without downtime: create a second live key, send it to the partner, and revoke the old one once they
          have switched (its last use shows here). Test keys reach the same courses and learners in test mode.
        </p>
        <table className="mt-4 w-full text-left text-sm">
          <thead className={th}>
            <tr>
              <th className="py-2">Key</th>
              <th>Label</th>
              <th>Created</th>
              <th>Last used</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id} className={`border-t border-line ${k.revokedAt ? "text-muted" : ""}`}>
                <td className="py-2 font-mono text-xs">
                  {k.prefix}… {k.test && <span className="ml-1 rounded-full bg-saffron/20 px-2 py-0.5">test</span>}
                </td>
                <td>{k.label ?? "–"}</td>
                <td>{when(k.createdAt)}</td>
                <td>{when(k.lastUsedAt)}</td>
                <td className="text-right">
                  {k.revokedAt ? (
                    `Revoked ${when(k.revokedAt)}`
                  ) : (
                    <ActionForm action={revokeKey} confirm={`Revoke ${k.prefix}…? It stops working at once.`}>
                      <input type="hidden" name="distributorId" value={id} />
                      <input type="hidden" name="keyId" value={k.id} />
                      <button className={link}>Revoke</button>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-4">
          <CreateKeyForm distributorId={id} />
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Rate limit</h2>
        <ActionForm action={saveRateLimit} className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <input type="hidden" name="distributorId" value={id} />
          <input
            name="rateLimitPerMinute"
            type="number"
            min={1}
            max={5000}
            required
            defaultValue={distributor.rateLimitPerMinute}
            aria-label="Requests per minute per key"
            className="h-10 w-28 rounded-xl border border-line px-3"
          />
          <span className="text-muted">requests a minute, per key (default 3000). Over it, they get 429 rate_limited.</span>
          <button className={button}>Save</button>
        </ActionForm>
      </section>

      <section className="mt-8 rounded-2xl border border-line bg-white p-5">
        <h2 className="font-semibold">Webhooks</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">
          We POST signed events (certificate released, batch paid, enrolment cancelled, course updated) to this URL, and
          retry for 24 hours. Leave it empty to send none.
        </p>
        <div className="mt-4 grid gap-3">
          <WebhookUrlForm distributorId={id} url={distributor.webhookUrl} />
          {distributor.webhookSecret && <RotateSecretForm distributorId={id} />}
        </div>
        {events.length > 0 && (
          <table className="mt-6 w-full text-left text-sm">
            <caption className="pb-2 text-left font-medium">Latest events</caption>
            <thead className={th}>
              <tr>
                <th className="py-2">Event</th>
                <th>Created</th>
                <th>Status</th>
                <th>Tries</th>
                <th>Last error</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {events.map((e) => {
                const status = webhookStatus(e);
                return (
                  <tr key={e.id} className="border-t border-line align-top">
                    <td className="py-2 font-mono text-xs">{e.type}</td>
                    <td>{when(e.createdAt)}</td>
                    <td className={status === "failed" ? "text-red-700" : ""}>{status}</td>
                    <td className="tabular-nums">{e.attempts}</td>
                    <td className="max-w-xs break-words text-muted">{e.lastError ?? "–"}</td>
                    <td className="text-right">
                      {status === "failed" && (
                        <ActionForm action={retryWebhooks}>
                          <input type="hidden" name="distributorId" value={id} />
                          <input type="hidden" name="eventId" value={e.id} />
                          <button className={link}>Retry</button>
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {failed.length > 0 && (
          <ActionForm action={retryWebhooks} className="mt-4 flex flex-wrap items-center gap-3">
            <input type="hidden" name="distributorId" value={id} />
            <button className={button}>Retry every failed event</button>
          </ActionForm>
        )}
      </section>
    </>
  );
}
