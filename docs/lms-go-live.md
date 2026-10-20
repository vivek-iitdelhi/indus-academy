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

## 3. Video: Cloudflare R2 + our encoder machine

Videos are stored in a private R2 bucket and encoded on our own machine. Learners get
adaptive HLS (240p up to the source's quality, 6-second segments); the player picks the
quality from their connection and switches mid-video.

**Bucket**

1. Cloudflare dashboard → R2 → Create bucket (e.g. `iaa-videos`), location hint
   **Asia-Pacific**. Keep it private: no public access, no r2.dev URL. Name → `R2_BUCKET`.
2. Bucket → Settings → S3 API URL, without the bucket name
   (`https://<account id>.r2.cloudflarestorage.com`) → `R2_ENDPOINT`.
3. R2 → Manage API tokens → Create: **Object Read & Write**, this bucket only →
   `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`.
4. Bucket → Settings → CORS policy:
   ```json
   [{ "AllowedOrigins": ["*"], "AllowedMethods": ["GET", "PUT"], "AllowedHeaders": ["*"],
      "ExposeHeaders": ["ETag"], "MaxAgeSeconds": 86400 }]
   ```
   Any origin, because distributors play on their own sites; every URL is signed and
   expires. `PUT` and `ETag` are for admin uploads, which go from the browser straight to
   the bucket.
5. `VIDEO_TOKEN_SECRET`: `openssl rand -base64 32`. Playback links last 6 hours for
   learners (up to 24 for distributors); a copied link stops working when it expires.

**Encoder machine** (runs `scripts/encoder.ts`; Vercel only stores and signs)

1. Install Node 24+ and ffmpeg. On an NVIDIA GPU, check `ffmpeg -encoders | grep nvenc`
   lists `h264_nvenc`.
2. Clone this repo (no `npm ci` needed: the encoder uses only Node built-ins).
3. Create `.env.encoder` in the repo root with the four `R2_*` values above, plus
   `VIDEO_ENCODER=h264_nvenc` for the GPU (default is CPU `libx264`), and
   optionally `ENCODER_WORK_DIR` on a disk with ~3× the largest upload free.
4. `npm run encoder`. It checks the bucket every 30 s, logs each video, and keeps going.
   Keep it running as a service, e.g. systemd:
   ```ini
   [Service]
   WorkingDirectory=/opt/indus-academy
   ExecStart=/usr/bin/npm run encoder
   Restart=always
   ```
5. While it is off, uploads wait as "Processing…" and deletions wait too; nothing is
   lost. To update: `git pull`, restart.

The encoder deletes each original once encoded: **keep your master files**.

**Costs:** storage $0.015 per GB-month (a 3-hour course at 1080p is about 10 GB, so about
$0.15). Downloads are free. Each segment fetched is a read: 10 million free a month, then
$0.36 per million; an hour of viewing is about 600. Segments come straight from the
bucket, without a CDN cache; if Indian viewers see slow starts, a Cloudflare Worker cache
in front is the next step.

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
- [ ] With the encoder running, create a course in `/admin/courses`, upload a video,
      wait for it to process, publish, and watch it on a phone on mobile data.
- [ ] The ₹1 purchase-and-refund test above.
- [ ] Complete a short test course, check the certificate, `/verify/<serial>` and the
      LinkedIn button.
- [ ] Create a distributor in `/admin/distributors`, license a course, and call the API
      once (see [`distributor-api.md`](distributor-api.md)).
