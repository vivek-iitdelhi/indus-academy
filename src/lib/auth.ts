import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins";
import { site } from "@/content/site";
import { db, schema } from "@/db";
import { escapeHtml, shell } from "@/lib/newsletter";

const MAGIC_LINK_TTL_SECONDS = 15 * 60;

export const googleConfigured = () =>
  Boolean(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);

async function sendMagicLinkEmail(email: string, url: string) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (process.env.NODE_ENV === "production") throw new Error("RESEND_API_KEY is not set");
    console.info(`[auth] magic link for ${email}: ${url}`);
    return;
  }

  const html = shell(
    `<h1 style="margin:0 0 16px;font-size:24px;line-height:1.25;color:#0b1916">Sign in to ${escapeHtml(site.name)}</h1>
     <p style="margin:0 0 24px;font-size:15px;line-height:1.7;color:#56655f">Click below to sign in. No password needed.</p>
     <a href="${url}" style="display:inline-block;background:#0b1916;color:#f5f3ec;text-decoration:none;font-weight:600;font-size:15px;padding:14px 28px;border-radius:999px">Sign in</a>
     <p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#56655f">
       The link works once and expires in 15 minutes. If you didn't request it, ignore this email.
     </p>`,
    `<p style="margin:0">You received this because someone asked to sign in with this address at ${escapeHtml(site.url.replace(/^https?:\/\//, ""))}.</p>`,
  );

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: process.env.ENQUIRY_FROM_EMAIL ?? `${site.name} <enquiries@indusai.academy>`,
      to: [email],
      reply_to: site.email,
      subject: `Your sign-in link for ${site.name}`,
      html,
      text: `Sign in to ${site.name}: ${url}\n\nThe link works once and expires in 15 minutes.`,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Resend responded ${res.status}: ${await res.text()}`);
}

export const auth = betterAuth({
  // BETTER_AUTH_SECRET and BETTER_AUTH_URL are read from the environment.
  database: drizzleAdapter(db, { provider: "pg", schema }),
  user: {
    additionalFields: {
      phone: { type: "string", required: false },
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 30, // 30 days, rolling
    updateAge: 60 * 60 * 24,
  },
  // One person, one account: Google and magic link resolve to the same user by email.
  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },
  socialProviders: googleConfigured()
    ? {
        google: {
          clientId: process.env.AUTH_GOOGLE_ID as string,
          clientSecret: process.env.AUTH_GOOGLE_SECRET as string,
          prompt: "select_account",
        },
      }
    : {},
  plugins: [
    magicLink({
      expiresIn: MAGIC_LINK_TTL_SECONDS,
      sendMagicLink: ({ email, url }) => sendMagicLinkEmail(email, url),
    }),
    nextCookies(), // must stay last
  ],
});

export type SessionUser = typeof auth.$Infer.Session.user;
