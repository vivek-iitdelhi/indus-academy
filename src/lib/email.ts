/**
 * Sends one email through Resend. Never throws: callers include paths where money has
 * already moved, so a mail failure must not become an error screen. Failures are logged.
 * `payload` is Resend's /emails body (from, to, subject, html, text, reply_to, ...).
 */
export async function sendEmail(payload: Record<string, unknown>) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.info("[email] RESEND_API_KEY not set; email skipped:", payload.subject);
    return;
  }
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[email] failed:", res.status, await res.text());
  } catch (error) {
    console.error("[email] threw:", payload.subject, error);
  }
}
