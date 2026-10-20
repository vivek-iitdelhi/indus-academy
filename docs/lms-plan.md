# LMS build plan

> **Superseded in part:** the stack and data model changed (Supabase, Better Auth, courses in the
> database, Cloudflare Stream). [`lms-foundation.md`](lms-foundation.md) is the current contract.

The LMS is built in this repository, as a route group alongside the marketing site.
It shares this site's auth, Razorpay integration and design, and deploys with it.

Written 19 October 2026. Reference points the business is aiming at: be10x.com,
outskill.in — low-priced Indian AI training sold self-serve, with a certificate at the
end.

## 1. The constraint everything follows from

This repository has **no database and no auth**. Its entire dependency
list is Next, React, Tailwind, `marked` and `gray-matter`. Even the newsletter's
double opt-in avoids storage by signing an HMAC token bound to the email address,
because there was nowhere to put a row.

An LMS is the opposite: accounts, enrolments, progress, certificates, payments. So this
is not a feature on a brochure site, it is a backend arriving underneath one.

**The marketing pages must stay statically rendered.** They rank, and they are fast
because nothing blocks them. Auth middleware is therefore scoped to the learner routes
only — a careless global matcher would make the whole site dynamic and cost real
traffic.

```
/                     static   marketing, blog, programs   (unchanged)
/learn/*              dynamic  authenticated learner app   (new)
/verify/<serial>      static-ish  public certificate check (new)
/api/*                dynamic  auth, payments, progress    (extended)
```

## 2. Stack

| Concern | Choice | Why |
| --- | --- | --- |
| Database | Neon Postgres | Serverless, generous free tier, no idle cost, good Vercel story |
| ORM | Drizzle | TypeScript-native, light, fast cold starts |
| Auth | Auth.js v5 — Resend magic links + Google | No new vendor, no passwords to leak, Resend is already paid for and DNS-verified |
| Payments | Razorpay | Already integrated for cohort seats; same account, same keys |
| Video | Gumlet | INR billing, Indian PoPs, React player with `onProgress`, DRM available later; see §7 |
| Certificates | `next/og` ImageResponse | Already used for OG images; no new dependency |
| Email | Resend | Already sending enquiry, enrolment and newsletter mail |

Clerk was considered for auth and is roughly a week faster, with user management
included. It was declined to avoid a third party owning identity and its pricing.

## 3. Data model

Course **structure** stays in the repository, the way `src/content/programs.ts` already holds programs. Only **state** goes in the database. That keeps catalogue pages
prerenderable, keeps content under code review, and means no CMS has to be built. If
non-technical staff later need to edit lessons, add a CMS then — not now.

```
users              id, email, name, phone, image, created_at
accounts/sessions  (Auth.js adapter tables)

enrollments        id, user_id, course_slug, source, status,
                   started_at, expires_at, cohort_id?
                   source: 'purchase' | 'cohort' | 'free' | 'manual'

lesson_progress    user_id, lesson_slug, seconds_watched,
                   furthest_seconds, completed_at
                   PK (user_id, lesson_slug)

certificates       serial, user_id, course_slug, issued_at,
                   revoked_at?, hash

payments           razorpay_order_id, razorpay_payment_id, user_id,
                   course_slug, amount_paise, status, created_at
```

`enrollments.source` plus `expires_at` is what lets self-paced, live cohort and free
lead-magnet courses coexist without a schema change later. Build one, but model all
three from the start.

`furthest_seconds` is kept separately from `seconds_watched` so scrubbing to the end
does not mark a lesson complete. Completion should mean watched, not visited.

## 4. Phases

Each phase ends with something a real person can use.

### Phase 1 — buy, log in, watch, resume
The only milestone that matters; everything after is additive.

- Auth.js with the Drizzle adapter; magic link email through Resend; Google provider
- `/learn` — enrolled courses, continue where you left off
- `/learn/<course>/<lesson>` — player, lesson list, progress saved as you watch
- Razorpay checkout for a single self-paced course, extending the existing
  `/api/checkout` route rather than duplicating it
- Enrolment granted on verified payment, in the same webhook path that already emails
  the learner

Rough size: 2–3 weeks of focused work.

### Phase 2 — certificates
- Serial, issue record, `hash` for tamper-evidence
- Generated certificate image via `next/og`
- `/verify/<serial>` — public page showing holder, course, issue date, status. A
  certificate nobody can check is decoration, and this page is also a quiet SEO asset
- LinkedIn **Add to profile** button (see §8)

### Phase 3 — the journey
Dashboard with completion percentage, module gating, quizzes and assignments, and
lifecycle email: welcome, nudge after 7 idle days, completion.

### Phase 4 — admin
Enrolment list, manual grants, refunds, revenue. Until this exists, treat the database
as the admin UI and keep the queries in `docs/`.

## 5. Course model

The business wants self-paced, live cohort and a free mini-course. The schema above
supports all three. The recommended order is:

1. **One paid self-paced course.** Simplest to build and to sell.
2. **Free mini-course.** Same machinery with payment skipped; feeds the email list.
3. **Live cohort delivery.** Most involved — access windows, session links, attendance —
   and it is the thing currently run by hand, so it is the least urgent to automate.

Shipping all three at once triples the surface area before any of it is proven.

## 6. Razorpay

Already coded for cohort seats here, in `src/lib/razorpay.ts`, and gated behind
`razorpayConfigured()`. Note the existing trap: **keys are read at build time for
prerendered pages**, so they must exist in Vercel *before* a build or the buy button
silently does not render. Learner routes are dynamic, so this applies to catalogue
pages only.

Reuse `verifySignature()` and the payment re-fetch that already exist — do not write a
second payment path.

## 7. Video — Gumlet

Moving off YouTube unlisted, because unlisted means anyone with the link can watch
forever: no domain restriction, no signed URLs, no expiry.

**Chosen: [Gumlet](https://www.gumlet.com/pricing/).** Growth plan, $19/month.

Every lesson still renders through one `<VideoPlayer lessonId=...>` component, so the
provider stays swappable in a single file. That costs nothing now and is the difference
between a one-file change and a refactor later.

### Why

| | Launch: 20 h stored, 100 students x 10 h/mo | Growth: 60 h stored, 2,000 students x 8 h/mo |
| --- | --- | --- |
| **Gumlet** | **$19** | $591 |
| Bunny Stream | $21 | **$337** |
| Mux | $0 | $851 |
| Cloudflare Stream | $70 | $980 |
| VdoCipher | $82 | $909 |
| api.video | $105 | $1,642 |

Assumes 0.7 GB per hour delivered — a mobile-weighted ABR ladder. At 0.4 GB/h every
per-GB vendor drops about 43%; the per-minute vendors (Mux, Cloudflare, api.video) do
not move at all.

Gumlet is the only vendor that scores on all four things this project needs:

- **INR billing.** Everyone else is USD-only.
- **Indian delivery.** 40+ embedded PoPs plus a Mumbai regional edge cache, for an
  audience on Indian mobile networks.
- **`@gumlet/react-embed-player` with an `onProgress` callback**, plus
  `event.embed.viewed` webhooks. Progress tracking is the hardest part of an LMS
  player and this hands it to us.
- **Widevine + FairPlay DRM as a $99/month switch to flip later**, not a contract to
  sign now.

Rejected, with reasons:

- **Mux** — free at launch and the best Next.js DX of the eight, but publishes no India
  PoP list and its own engineering blog says the custom-PoP CDN covers only North
  America and Europe. Disqualifying for this audience.
- **Bunny** — 43% cheaper at growth with the same five Indian metros. Take it if cost at
  scale becomes the dominant criterion; the price is no INR invoice, no GST, and
  wrapping their Player.js iframe by hand.
- **Cloudflare Stream** — best Indian network and simplest pricing, but **no DRM at
  all**, which is the thing we are switching for.
- **Vimeo** — every self-serve plan caps bandwidth at 2 TB/month, which the growth
  scenario exceeds 5.6x, and DRM is Enterprise-only.
- **VdoCipher** — strongest protection in the set (DRM and dynamic watermarking on
  every tier, from $49) and actually cheapest *with DRM* at launch. Rejected on prepaid
  annual-only billing and the worst growth figure of any DRM-capable vendor.

### Decisions that follow

- **Do not buy DRM yet.** $99/month is five times the hosting cost, to protect a course
  that does not exist. Signed URLs plus domain restriction are included from the $6 tier
  and stop casual link-sharing, which is the realistic threat. DRM does not stop a phone
  pointed at a screen.
- **Budget for the storage cliff.** Gumlet meters storage in minutes and sells no
  storage overage below the $99 Business plan. Growth covers 3,000 minutes = **50
  hours**. Crossing ~50 hours of library forces $99/month whatever the audience size.

### Verify before paying

- Ask Gumlet whether they issue a **GSTIN-bearing tax invoice**. Their payment policy
  confirms INR billing but is silent on GST, and the entity is Singapore-incorporated
  with Bengaluru operations. It affects input-credit recovery.
- VdoCipher's non-DRM page lists overage at $0.011/GB against $0.11/GB on its DRM
  plans. Almost certainly a decimal error, but if it is real it is the cheapest Indian
  option available and worth reopening this decision for.

## 8. Certificates and LinkedIn

LinkedIn's *Add to profile* is a URL taking `name`, `organizationId`, `issueYear`,
`issueMonth`, `certUrl` and `certId`. Two prerequisites:

1. The **numeric LinkedIn organisation ID** for the company page.
2. A **public verification URL** — `certUrl` points at `/verify/<serial>`.

Certificates are issued by INDUS AI Private Limited, which the site's Terms already
state, and awarded on completing the programme and the assessed work — not on
attendance alone. Keep that true; it is the only thing that makes the certificate worth
putting on a profile.

## 9. Cost

Effectively zero to start: Neon free tier, Auth.js free, Resend already paid, Vercel as
is. Video is the first real line item, and the first to grow.

## 10. Risk worth stating

An LMS does not create demand. The October cohort took no registrations and the
newsletter stands at two subscribers. be10x sells a ₹929 live workshop on heavy paid
acquisition — the funnel is the product and the LMS is only delivery.

The pivot is still directionally right: a ₹999–2,999 self-paced course is far easier to
sell than a ₹25,000 cohort, and it gives the blog and the newsletter something to
convert into. Build Phase 1 around one course that can be sold cheaply.
