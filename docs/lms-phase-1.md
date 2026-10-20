# LMS — Phase 1

> **Superseded in part:** the stack and data model changed (Supabase, Better Auth, courses in the
> database, Cloudflare Stream). [`lms-foundation.md`](lms-foundation.md) is the current contract.

The milestone: **a stranger can buy a course, sign in, watch it, and come back
tomorrow to where they stopped.** Everything after Phase 1 is additive; nothing before
it is provable.

Read [`lms-prd.md`](lms-prd.md) for acceptance criteria, [`lms-schema.md`](lms-schema.md)
for the data model, and [`lms-plan.md`](lms-plan.md) for why the stack is what it is.

## Before writing code

Accounts to create. All free; none depends on another.

| | What you need | Notes |
| --- | --- | --- |
| Neon | a project, then `DATABASE_URL` | free tier; use a branch for local work |
| Google Cloud | OAuth client ID + secret | authorised redirect `/<origin>/api/auth/callback/google` |
| Gumlet | free tier to start | 60 storage minutes, 100 GB/month — enough to pilot 2–3 lessons |
| — | `AUTH_SECRET` | `openssl rand -base64 32` |

Already in Vercel and reused as-is: `RESEND_API_KEY`, `NEXT_PUBLIC_SITE_URL`,
`ENQUIRY_FROM_EMAIL`, `ENQUIRY_TO_EMAIL`. Razorpay keys are pending account approval —
Phase 1 can be built and tested without them, but checkout cannot go live until they
are set.

New environment variables to add to `.env.example` as they are introduced:

```
DATABASE_URL=
AUTH_SECRET=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
GUMLET_API_KEY=
GUMLET_COLLECTION_ID=
```

## Traps already known

These have each cost time in this repository before. They are not hypothetical.

1. **Razorpay keys are read at build time** for prerendered pages. `razorpayConfigured()`
   is evaluated during the build, so if the keys are not in Vercel *before* the build,
   the buy button silently does not render. Learner routes are dynamic so this affects
   catalogue pages only — but that is where the button lives.

2. **Keep the marketing site static.** Scope the auth middleware matcher to `/learn`
   and the learner APIs. A global matcher makes every page dynamic and costs real
   search traffic. Verify after any middleware change that `npm run build` still shows
   the marketing routes as prerendered.

3. **Email must never fail a confirmed payment.** `/api/checkout/verify` already wraps
   its Resend calls so a mail failure cannot throw — do not undo that. Someone who has
   just paid must not see an error.

4. **This repository deploys to production on every push to `main`.** There is no
   staging branch. Build Phase 1 on a long-lived branch with Vercel preview deploys and
   merge once, rather than shipping half-finished auth to a site that is selling
   cohorts.

5. **Always `git pull --rebase` before deploying.** The blog routine pushes two articles
   a day from a cloud agent. Deploying from a stale checkout has already taken live
   articles offline once.

6. **Slugs are the join key** between repo content and database rows. Treat a published
   lesson slug as immutable.

## Work, in order

### 1. Database and schema
Drizzle + Neon; the tables in [`lms-schema.md`](lms-schema.md); `drizzle-kit` migrations
committed. Done when migrations run clean against an empty Neon branch.

### 2. Auth
Auth.js v5 with the Drizzle adapter. Resend magic link provider — reuse the existing
Resend sender identity and match the visual style of the newsletter confirmation email
already in `src/lib/newsletter.ts`. Google provider. `/signin`, sign-out, and a session
helper usable in server components.

Done when A1–A3 in the PRD pass, including the reused-link and expired-link cases.

### 3. Course content model
`src/content/courses.ts` alongside `programs.ts`: course → modules → lessons, each
lesson carrying a slug, title, duration in seconds, and its Gumlet asset ID. Plus the
helpers the rest of the work needs — `courseBySlug`, `lessonBySlug`, `totalDuration`,
`nextLesson`.

Treat it the way `programs.ts` is treated: typed, exported, no stringly-typed lookups
scattered through components.

### 4. Access control
One `hasAccess(userId, courseSlug)` helper, used by every route that serves a lesson,
a signed video URL, or progress. Including the APIs. Do not re-derive the rule inline
anywhere — this is the thing that, if duplicated, eventually diverges and leaks a
course.

### 5. Video
A single `<VideoPlayer lessonId>` component wrapping `@gumlet/react-embed-player`.
Signed playback URLs minted server-side; domain restriction configured in Gumlet. The
component is the **only** place the provider is named, so swapping provider later is a
one-file change.

### 6. Progress
`POST /api/learn/progress` — upsert, server-side completion rule, throttled to at most
one write per 15 seconds per learner, plus pause and page exit (`visibilitychange`,
not `beforeunload`, which is unreliable on mobile Safari).

Done when C2 passes, including that scrubbing to the end does not complete a lesson.

### 7. Checkout
Extend the existing `/api/checkout` and `/api/checkout/verify` to take a course slug as
well as a program slug. Reuse `verifySignature()` and the payment re-fetch — do not
write a second payment path. Write the `payments` row at order creation; grant
enrolment in the same transaction that marks it paid.

### 8. The learner app
- `/learn` — enrolled courses, progress percentage, continue link
- `/learn/<course>` — lesson list with completion state
- `/learn/<course>/<lesson>` — player, lesson nav, next/previous

Match the existing design system. The marketing site has a settled visual language;
the learner app should look like the same company, not a bolted-on dashboard.

## Definition of done

- Every acceptance criterion in PRD sections A, B and C passes.
- `npm run build` and `npx eslint .` are clean.
- The marketing routes are still prerendered — check the build output, do not assume.
- A real payment of ₹1 completes end to end against live Razorpay keys, grants
  enrolment, and is then refunded.
- A learner without an enrolment gets a 404 (not a 403) on a lesson URL and cannot
  obtain a playable video URL.
- Progress survives a hard refresh, a second device, and a stalled connection.

## What Phase 1 does not include

Certificates, quizzes, gating, an admin UI, cohort access windows, the free
lead-magnet funnel, coupons. Phase 2 starts at certificates; until the loop above works
with real money, the rest is speculation.
