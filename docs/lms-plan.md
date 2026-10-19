# LMS build plan

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
| Video | **undecided** | Leaving YouTube unlisted; see §7 |
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

## 7. Video — open question

Moving off YouTube unlisted. The reason is protection: unlisted means anyone with the
link can watch forever, with no domain restriction, no signed URLs and no expiry.

Whatever is chosen, **every lesson renders through one `<VideoPlayer lessonId=…>`
component**, so the provider can be swapped in one file. That abstraction costs nothing
now and is the difference between a one-file change and a refactor later.

Requirements to judge against:

- Signed or expiring playback URLs, and domain restriction
- A playback-position API, since progress tracking depends on it
- Adaptive bitrate — the audience is Indian professionals on mobile networks
- Indian edge presence
- INR billing with a GST invoice, ideally
- DRM (Widevine/FairPlay) is worth pricing, though it is a real cost step and does not
  stop a phone pointed at a screen

Costing is being done against two scenarios so vendors are comparable:

- **Launch:** 20 hours stored, 100 students, 10 hours watched each per month
- **Growth:** 60 hours stored, 2,000 students, 8 hours watched each per month

Delivery, not storage, is what grows. At the growth scenario the per-GB rate decides
the bill.

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
