# LMS — data model

> **Superseded in part:** the stack and data model changed (Supabase, Better Auth, courses in the
> database, Cloudflare Stream). [`lms-foundation.md`](lms-foundation.md) is the current contract.

Postgres on Neon, accessed through Drizzle. Companion to [`lms-plan.md`](lms-plan.md)
and [`lms-prd.md`](lms-prd.md).

## The split

**Course structure lives in the repository.** Courses, modules and lessons are
TypeScript under `src/content/`, exactly as `programs.ts` already holds programs. They
are referenced everywhere by **slug**.

**Only state lives in the database.** Users, enrolments, progress, certificates,
payments.

Why: catalogue pages stay prerenderable, content changes go through code review, and
no CMS has to be built. The cost is that adding a lesson needs a deploy — acceptable
now, and the trigger to revisit is non-technical staff needing to edit lessons.

**Consequence to respect:** the database holds slugs, not foreign keys, for anything
that lives in the repo. Renaming a lesson slug orphans its progress rows. Treat slugs
as immutable once published; if one must change, write a migration that rewrites the
progress rows with it.

## Tables

### Auth.js tables

`users`, `accounts`, `sessions`, `verificationTokens` — created by the Drizzle adapter.
Do not hand-roll them. Extend `users` with:

```
name          text        -- as it will appear on the certificate
phone         text        -- collected at checkout, Razorpay needs it
created_at    timestamptz not null default now()
```

### enrollments

```
id            uuid pk default gen_random_uuid()
user_id       uuid not null references users(id) on delete cascade
course_slug   text not null
source        text not null         -- 'purchase' | 'cohort' | 'free' | 'manual'
status        text not null default 'active'   -- 'active' | 'revoked'
cohort_id     text                  -- set when source = 'cohort'
started_at    timestamptz not null default now()
expires_at    timestamptz           -- null = never, which is the self-paced case

unique (user_id, course_slug)
index on (user_id)
```

`source` plus `expires_at` is what lets self-paced, cohort and free lead-magnet
enrolments coexist without a schema change later. Build the first; model all three now.

An enrolment is current when `status = 'active'` and `expires_at` is null or in the
future. Put that in one `hasAccess()` helper and call it from every route that serves
a lesson or a signed video URL — including the API. Do not re-derive the rule inline.

### lesson_progress

```
user_id           uuid not null references users(id) on delete cascade
lesson_slug       text not null
seconds_watched   integer not null default 0   -- total time played, can exceed duration
furthest_seconds  integer not null default 0   -- high-water mark of position reached
completed_at      timestamptz
updated_at        timestamptz not null default now()

primary key (user_id, lesson_slug)
```

The two counters are separate on purpose. `furthest_seconds` is what decides
completion, so dragging the scrubber to the end does not finish a lesson.
`seconds_watched` is the honest engagement number.

Completion rule, applied server-side on write: set `completed_at` when
`furthest_seconds >= 0.9 * lesson.duration` and it is not already set. Never clear it
on a later write — rewatching does not un-complete a lesson.

Writes arrive at most every 15 seconds per playing learner, plus on pause and page
exit. Upsert on the primary key; this table takes the most write traffic in the system.

### certificates

```
serial        text primary key      -- human-quotable, e.g. IAA-2026-0001
user_id       uuid not null references users(id)
course_slug   text not null
issued_at     timestamptz not null default now()
revoked_at    timestamptz
hash          text not null         -- HMAC over serial|user_id|course_slug|issued_at

unique (user_id, course_slug)
```

The unique constraint enforces one certificate per learner per course.

`revoked_at` is set, never deleted — verification must be able to answer "revoked"
rather than "not found", because a missing page reads as a broken link and undermines
every valid certificate.

`hash` lets a certificate be checked without trusting the serial alone. Use the same
`NEWSLETTER_SECRET`-style server-side secret, not a key that reaches the browser.

### payments

```
id                   uuid pk default gen_random_uuid()
razorpay_order_id    text not null unique
razorpay_payment_id  text unique
user_id              uuid references users(id)
course_slug          text not null
amount_paise         integer not null
status               text not null    -- 'created' | 'paid' | 'failed' | 'refunded'
created_at           timestamptz not null default now()
updated_at           timestamptz not null default now()
```

A row is written at order creation, before the learner sees Razorpay, so an abandoned
payment leaves a trace that can be reconciled against the Razorpay dashboard.

**The amount is computed server-side from the course content and written here**, never
taken from the client. The existing `/api/checkout` route already works this way;
follow it rather than writing a second payment path.

## Ordering of writes at purchase

1. `payments` row at `status = 'created'` when the order is made.
2. Razorpay returns; `/api/checkout/verify` checks the signature **and re-fetches the
   payment from Razorpay** rather than trusting the browser.
3. On a captured payment, in one transaction: update `payments.status = 'paid'` and
   insert the `enrollments` row.
4. Email the learner and the team. **Email failures must not fail the request** — the
   money has already moved. Log and move on; this trap has already been hit once in
   the checkout route.

## Indexes worth having on day one

```
enrollments      (user_id)
lesson_progress  (user_id)                -- the dashboard reads every row for a user
certificates     (user_id)
payments         (razorpay_order_id)      -- unique already
```

## Migrations

`drizzle-kit generate` and `drizzle-kit migrate`, with migration files committed. Neon
branches make it cheap to test a migration against a copy of production before running
it. Never edit a migration that has run.
