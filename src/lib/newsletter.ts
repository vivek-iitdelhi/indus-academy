import { createHmac, timingSafeEqual } from "node:crypto";
import type { Post } from "@/lib/blog";
import { company, site } from "@/content/site";

const RESEND_API = "https://api.resend.com";
const TOKEN_TTL_MS = 48 * 60 * 60 * 1000;

export const newsletterConfigured = () =>
  Boolean(process.env.RESEND_API_KEY && process.env.RESEND_SEGMENT_ID);

const from = () => process.env.NEWSLETTER_FROM ?? `${site.name} <newsletter@indusai.academy>`;

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

async function resend<T>(path: string, init: RequestInit): Promise<T> {
  const res = await fetch(`${RESEND_API}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${requireEnv("RESEND_API_KEY")}`,
      "content-type": "application/json",
      ...init.headers,
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend ${path} responded ${res.status}: ${await res.text()}`);
  return (await res.json()) as T;
}

/**
 * Double opt-in without a database: the confirmation link carries a signed,
 * expiring token, so an address only joins the list after the owner clicks it.
 */
export function signSubscription(email: string, issuedAt = Date.now()) {
  const signature = createHmac("sha256", requireEnv("NEWSLETTER_SECRET"))
    .update(`${email.trim().toLowerCase()}.${issuedAt}`)
    .digest("base64url");
  return `${issuedAt}.${signature}`;
}

export function verifySubscription(email: string, token: string): "valid" | "expired" | "invalid" {
  const [issuedAt, signature] = token.split(".");
  if (!issuedAt || !signature) return "invalid";

  const expected = signSubscription(email, Number(issuedAt)).split(".")[1];
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length || !timingSafeEqual(given, want)) return "invalid";

  return Date.now() - Number(issuedAt) > TOKEN_TTL_MS ? "expired" : "valid";
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const trackedUrl = (path: string, campaign: string) =>
  `${site.url}${path}?utm_source=newsletter&utm_medium=email&utm_campaign=${campaign}`;

const shell = (body: string, footer: string) => `
  <div style="margin:0;padding:24px;background:#f5f3ec;font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
    <div style="max-width:560px;margin:0 auto;background:#ffffff;border-radius:20px;padding:32px">
      <p style="margin:0 0 28px;font-size:15px;font-weight:600;color:#2a524a">${escapeHtml(site.name)}</p>
      ${body}
    </div>
    <div style="max-width:560px;margin:20px auto 0;font-size:12px;line-height:1.6;color:#56655f;text-align:center">
      ${footer}
      <p style="margin:12px 0 0">${escapeHtml(company.legalName)}, ${escapeHtml(company.location)}</p>
    </div>
  </div>`;

export async function sendConfirmationEmail(email: string) {
  const url = `${site.url}/newsletter/confirm?email=${encodeURIComponent(email)}&token=${signSubscription(email)}`;
  const html = shell(
    `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1916">Confirm your subscription</h1>
     <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#56655f">
       Click below to start receiving our weekly AI update: practical articles on using AI at work, every Tuesday.
     </p>
     <a href="${url}" style="display:inline-block;background:#0b1916;color:#f5f3ec;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px">Confirm subscription</a>
     <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#56655f">
       The link expires in 48 hours. If you didn't request this, ignore this email and nothing happens.
     </p>`,
    `<p style="margin:0">You received this because someone entered this address at ${escapeHtml(site.url.replace("https://", ""))}.</p>`
  );

  await resend("/emails", {
    method: "POST",
    body: JSON.stringify({
      from: from(),
      to: [email],
      reply_to: site.email,
      subject: `Confirm your subscription to ${site.name}`,
      html,
      text: `Confirm your subscription to ${site.name}: ${url}\n\nThe link expires in 48 hours.`,
    }),
  });
}

export async function addSubscriber(email: string) {
  const segmentId = requireEnv("RESEND_SEGMENT_ID");
  try {
    await resend("/contacts", {
      method: "POST",
      body: JSON.stringify({ email, unsubscribed: false, segments: [{ id: segmentId }] }),
    });
  } catch {
    // Most likely the contact already exists; make sure they are in the segment.
    await resend(`/contacts/${encodeURIComponent(email)}/segments/${segmentId}`, { method: "POST" });
  }
}

/** YYYY-MM-DD in India, which is how article dates are written. */
export const todayInIndia = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export async function digestAlreadySent(name: string) {
  const { data } = await resend<{ data?: { name?: string }[] }>("/broadcasts", { method: "GET" });
  return (data ?? []).some((broadcast) => broadcast.name === name);
}

export async function sendDigest(posts: Post[], date: string) {
  const campaign = `weekly-${date}`;
  const articles = posts
    .map(
      (post) => `
      <div style="margin:0 0 28px;padding:0 0 24px;border-bottom:1px solid #dcd8cc">
        <a href="${trackedUrl(`/blog/${post.slug}`, campaign)}" style="font-size:19px;line-height:1.3;font-weight:600;color:#0b1916;text-decoration:none">${escapeHtml(post.title)}</a>
        <p style="margin:10px 0 16px;font-size:15px;line-height:1.65;color:#56655f">${escapeHtml(post.description)}</p>
        <a href="${trackedUrl(`/blog/${post.slug}`, campaign)}" style="display:inline-block;background:#f0a43a;color:#0b1916;text-decoration:none;font-weight:600;font-size:14px;padding:11px 22px;border-radius:999px">Read the article</a>
        <span style="display:inline-block;margin-left:10px;font-size:13px;color:#56655f">${post.readingMinutes} min read</span>
      </div>`
    )
    .join("");

  const html = shell(
    `<h1 style="margin:0 0 8px;font-size:22px;line-height:1.3;color:#0b1916">This week at ${escapeHtml(site.name)}</h1>
     <p style="margin:0 0 28px;font-size:14px;line-height:1.6;color:#56655f">Practical ways to work better with AI, ${posts.length > 1 ? `${posts.length} new articles` : "one new article"} this week.</p>
     ${articles}
     <a href="${trackedUrl("/blog", campaign)}" style="font-size:14px;font-weight:600;color:#2a524a">Read all articles &rarr;</a>`,
    `<p style="margin:0">You subscribed to AI updates at ${escapeHtml(site.url.replace("https://", ""))}.
      <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="color:#56655f">Unsubscribe</a>.</p>`
  );

  // Lead with the newest article: a specific subject line beats "weekly digest".
  const subject =
    posts.length > 1 ? `${posts[0].title} (+${posts.length - 1} more)` : posts[0].title;

  await resend("/broadcasts", {
    method: "POST",
    body: JSON.stringify({
      segment_id: requireEnv("RESEND_SEGMENT_ID"),
      from: from(),
      reply_to: site.email,
      name: `Daily digest ${date}`,
      subject,
      html,
      send: true,
    }),
  });
}
