# LMS — go-live checklist

Everything the LMS needs that is not code. Each step names the environment variables it
produces; set them in Vercel (Production and Preview) **before** the deploy that needs
them. The full list with one-line comments is in `.env.example`.

## 1. Database: Supabase

1. Create a project in the Mumbai region (`ap-south-1`).
2. Project Settings → Database → Connection string → **Transaction pooler** (port 6543).
   That is `DATABASE_URL`. The client already disables prepared statements for it.
3. From a machine with the repo: `DATABASE_URL=<that url> npm run db:migrate`.
   Do not run `db:seed` against production; it creates sample courses.
4. Supabase is used only as Postgres. Leave Supabase Auth, Storage and the Data API
   unused; nothing in the app talks to them.

## 2. Sign-in

- `BETTER_AUTH_SECRET`: `openssl rand -base64 32`.
- `BETTER_AUTH_URL`: `https://indusai.academy` (each preview deploy needs its own origin
  for Google sign-in to work there; magic links work anywhere).
- Magic links send through Resend from `ENQUIRY_FROM_EMAIL`, which must be on the
  verified domain.
- Google (optional): Google Cloud → APIs & Services → Credentials → OAuth client
  (Web). Authorised redirect URI `https://indusai.academy/api/auth/callback/google`.
  Gives `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. The button appears only when both are set.
- `ADMIN_EMAILS`: comma-separated; these accounts can open `/admin`.

## 3. Video: Cloudflare Stream

1. Cloudflare dashboard → Stream → subscribe (storage is prepaid in blocks of 1,000
   minutes at $5; delivery is $1 per 1,000 minutes watched).
2. `CLOUDFLARE_ACCOUNT_ID`: dashboard URL or the account home sidebar.
3. `CLOUDFLARE_STREAM_API_TOKEN`: My Profile → API Tokens → Create → custom token with
   **Account · Stream · Edit**.
4. `CLOUDFLARE_STREAM_CUSTOMER_CODE`: Stream → any video → the `customer-<CODE>` part of
   its URL.
5. Signing key, once:
   ```sh
   curl -X POST -H "Authorization: Bearer $CLOUDFLARE_STREAM_API_TOKEN" \
     https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/stream/keys
   ```
   `result.id` → `CLOUDFLARE_STREAM_SIGNING_KEY_ID`, `result.pem` (already base64) →
   `CLOUDFLARE_STREAM_SIGNING_KEY_PEM`. Cloudflare shows the private key only this once.
6. Stream → Settings → allowed origins: leave empty. Playback is protected by signed,
   expiring tokens, and distributors play on their own domains.

All uploads are made with "require signed URLs", so a copied link stops working when its
token expires (6 hours for learners; up to 24 hours for distributors).

## 4. Payments: Razorpay

- `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET` (live keys). Set them **before** the build:
  program pages read them at build time.
- Webhook: Razorpay dashboard → Webhooks → add `https://indusai.academy/api/razorpay/webhook`,
  events `payment.captured` and `order.paid`, and a secret you choose →
  `RAZORPAY_WEBHOOK_SECRET`. This enrols a learner who paid and closed the tab.
- Test: buy a course at ₹1 (set a test course's price to ₹1 in `/admin/courses`), check
  you land in the course, then refund it from `/admin/payments`.

## 5. Certificates, cron, email

- `CERTIFICATE_SECRET`: long random string. **Never change it** once certificates exist;
  every certificate's tamper check depends on it.
- `LINKEDIN_ORGANIZATION_ID` (optional): the number in the company page's admin URL.
  Without it, "Add to LinkedIn" fills in the company name instead.
- `CRON_SECRET` (already used by the newsletter): the daily idle-learner reminder at
  `/api/cron/nudge` (9:00 AM IST) refuses to run without it.

## 6. Before the first real sale

- [ ] `npm run build` output shows the marketing routes as ○/● (static), not ƒ.
- [ ] Sign in by magic link and by Google on production.
- [ ] Create a course in `/admin/courses`, upload a video, wait for it to process,
      publish, and watch it on a phone on mobile data.
- [ ] The ₹1 purchase-and-refund test above.
- [ ] Complete a short test course, check the certificate, `/verify/<serial>` and the
      LinkedIn button.
- [ ] Create a distributor in `/admin/distributors`, license a course, and call the API
      once (see [`distributor-api.md`](distributor-api.md)).
