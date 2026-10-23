# Partner learners, completions and paid certificate release

Status: approved design, 23 Oct 2026. Not built yet.

## What and why

A client ("distributor") runs our licensed courses on its own platform (`docs/distributor-api.md`).
Today it gets course content and playback from us, and that's all. This adds three things:

1. **Learners.** The client tells us about each of its learners.
2. **Completions.** The client tells us when a learner finishes a course.
3. **Certificates, released when the admin says.** We issue our certificate, co-branded
   with the client. For each client the admin picks when that happens: once the batch is
   paid (the default), as soon as the learner completes, or only when an admin clicks
   "Generate". Unpaid certificates answer `402 payment_pending`.

Learners keep learning on the client's platform. They never sign in to indusai.academy.

## Decisions

| Question | Decision |
| --- | --- |
| Where the APIs live | `/api/v1` in this app, behind `withDistributor` (`src/app/api/v1/_shared.ts`). No new service. |
| Payment granularity | Per **batch**. The client names a batch per completion, e.g. `TCS-Jan-2027`. A single student is a batch of one. |
| Learner identity | Separate records per client, keyed on (client, client's user id). Never merged with direct customers, even on the same email. |
| Who decides completion | The client. We trust its report and don't check quiz results. |
| When a certificate is issued | The admin chooses per client (`certificate_release`): **`on_payment`** (default; issued when the course is completed and the batch is paid, at whichever happens last), **`on_completion`** (issued as soon as the client reports completion; for prepaid clients), or **`manual`** (only when an admin clicks Generate). Whatever the mode, an admin can generate one learner's or a whole batch's certificates at any time. The issue date is the moment of issue. |
| Turning the toggle off | Stops further releases. Released certificates stay valid; withdraw one with the existing revocation. |
| Certificate files | Not stored. The existing on-demand PNG (`/api/certificates/<serial>/image`) and `/verify/<serial>` page serve them. No S3. |
| Branding | Co-branded: "Delivered in partnership with <client certificate name>". |

## Data (one migration, `drizzle/0014_partner_learners.sql`)

**`partner_learners`** (new)
- `distributor_id` uuid → distributors, cascade
- `external_id` text: the client's user id, 1–200 chars
- `user_id` text → user, cascade, unique
- `email` text null: contact only, never used to sign in or to match accounts
- `created_at`, `updated_at`
- Primary key `(distributor_id, external_id)`

Each partner learner also gets a `user` row: `name` from the API, `email` =
`p-<uuid>@learners.invalid`. The `.invalid` domain keeps it unique, keeps it away from real
accounts, and means no magic link can ever reach it.

**`distributor_batches`** (new)
- `id` uuid
- `distributor_id` → distributors, cascade
- `name` text, 1–100 chars, unique per distributor
- `paid_at` timestamptz null: set means paid
- `paid_by` text null: admin email
- `created_at`

Batches are created the first time a client uses a name in a completion.

**`batch_payment_events`** (new): the toggle's history.
- `id`, `batch_id` → batches, cascade
- `paid` boolean: the new state
- `by` text: admin email
- `at` timestamptz

**`enrollments`** (existing): partner enrolments use `source = 'distributor'` (already in
the enum, unused until now) and `distributor_id` (exists), plus two new columns:
- `batch_id` uuid null → distributor_batches
- `completed_at` timestamptz null: the completion time the client reported

**`distributors`** (existing): two new columns.
- `certificate_name` text null: the name printed on co-branded certificates. Null means
  our plain certificate.
- `certificate_release` text not null, default `'on_payment'`, enum
  `on_payment | on_completion | manual`.

**`certificates`** (existing): add `partner_name` text null. It's a snapshot of
`certificate_name` at issue, the same pattern as `holder_name`. The hash doesn't cover it,
so existing certificates still verify. Partner certificates get `search_visible = false`:
these learners can't sign in to choose, and a client's staff names don't belong in our
public sitemap. Their verification page stays public by link.

## API (additions to `/api/v1`)

All of these follow the existing v1 rules: Bearer key, JSON, `Cache-Control: no-store`,
errors as `{ "error": { "code", "message" } }`, and 404 for anything that isn't the
caller's. `{external_id}` is URL-encoded.

### `PUT /learners/{external_id}`
Body `{ "name": "Asha Rao", "email": "asha@tcs.com" }`. `name` is required, 1–120 chars,
and printed on certificates. `email` is optional. The call creates or updates the learner:
201 on create, 200 on update.

```json
{ "learner": { "external_id": "u_123", "name": "Asha Rao", "email": "asha@tcs.com", "created_at": "…" } }
```

Changing the name updates the learner. Certificates already released keep the name they
were issued with; an admin corrects those (see Admin).

### `POST /learners/{external_id}/completions`
Body `{ "course": "<slug>", "batch": "TCS-Jan-2027", "completed_at": "<ISO, optional, default now>" }`.

- The learner must exist (404 `learner_not_found`).
- The course must be licensed to the client and published (404 `not_found`).
- `completed_at` can't be in the future.
- Upserts the partner enrolment for (learner, course) with that batch and completion time.

The call is safe to repeat. Repeating it while the certificate is unreleased may move the
learner to a different batch. Once the certificate is released it changes nothing.

If the client's release mode allows it, the certificate is issued in the same request:
- `on_completion`: always
- `on_payment`: when the batch is already paid
- `manual`: never

The course must also have certificates enabled. Response, 200:

```json
{ "completion": { "course": "ai-at-work-essentials", "batch": "TCS-Jan-2027", "completed_at": "…",
  "certificate": { "status": "pending_payment" } } }
```

### `DELETE /learners/{external_id}/completions/{course}`
Undoes a mistaken completion: clears `completed_at` and the batch. Returns 204. Once the
certificate is released it returns 409 `certificate_released`; ask us to revoke instead.

### `GET /learners/{external_id}/certificates`
Every completed course for the learner. `certificate.status` is one of:
- `pending_payment` (mode `on_payment`, batch unpaid)
- `pending_release` (mode `manual`, not generated yet)
- `released`
- `revoked`
- `not_offered` (the course has certificates switched off)

Released and revoked ones carry `serial`, `issued_at`, `image_url` (append `?download=1` to
download), and `verify_url`.

### `GET /learners/{external_id}/certificates/{course}`
One certificate, in the same shape. Errors:

| Status | `code` | When |
| --- | --- | --- |
| 402 | `payment_pending` | "Payment for batch TCS-Jan-2027 is not completed." |
| 409 | `certificate_pending` | Mode `manual` and not generated yet: "The certificate has not been released yet." |
| 404 | `not_completed` | The learner hasn't completed the course |
| 404 | `learner_not_found` | Unknown learner |
| 409 | `certificate_not_offered` | The course has certificates switched off |

### `GET /batches`
The client's batches: `name`, `paid` (bool), `paid_at`, `learners`, `completed`,
`released`.

### Bulk: `POST /learners/bulk` and `POST /completions/bulk`
Bodies `{ "learners": [ {external_id, name, email?} ] }` and
`{ "completions": [ {external_id, course, batch, completed_at?} ] }`, each 1–500 items.
Each item is handled exactly like the single call. The response is 200 with
`{ "results": [ { "index", "ok", "error"? } ] }`. One bad item doesn't fail the rest.

## Release rule (one function, `src/lib/lms/partners.ts`)

`releaseCertificates(enrollmentIds, { force })` issues certificates for the given partner
enrolments that have `completed_at` set and a course with `certificate_enabled`. Without
`force`, it also follows the client's mode: `on_completion` issues, `on_payment` issues only
for paid batches, `manual` issues nothing. `force: true` is the admin's Generate button and
skips the mode check.
It goes through the existing `issueOrGetCertificate`, which is idempotent and safe under
concurrency, and passes the partner name and `search_visible = false`.

Callers:
- the completion endpoint, for that one enrolment, without `force`
- the payment toggle, for every enrolment in the batch, without `force`
- the admin's Generate buttons (one learner, or a whole batch), with `force`
- switching a client's mode to `on_completion`, for its completed but unissued enrolments,
  without `force`

Because issuing is idempotent, the two callers racing each other still produce exactly one
certificate.

## Admin

`/admin/distributors` gains a link per client to `/admin/distributors/[id]`. That page shows:

- **Certificate settings:**
  - "Certificate name", the co-brand line
  - **"Generate certificates"**, a choice of *After payment* (default) / *As soon as the
    learner completes* / *Only when I click Generate*. Switching to *As soon as the learner
    completes* asks for confirmation ("This will issue 17 waiting certificates now.") and
    then issues them.

- **Batches table:** name · learners · completed · released · **Payment received** toggle ·
  paid at and by whom
- **Toggle:** confirms first ("Release 42 certificates for TCS-Jan-2027?"). Turning it on sets
  `paid_at` / `paid_by`, writes a `batch_payment_events` row, and runs `releaseCertificates`
  for the batch. Turning it off clears `paid_at` and writes an event.
- **Generate now:** a button per batch ("Generate 42 certificates"), and per learner in the
  drill-down. It issues regardless of payment or mode, after a confirmation.
- **Batch drill-down:** each learner's name, external id, course, completed at, and
  certificate status, with a link when released.
- **Name correction:** edit a learner's name. It also updates `holder_name` on that learner's
  unrevoked certificates. That's safe because the hash doesn't cover the name.

Partner certificates also appear on the existing `/admin/certificates` page, so revocation
works as it does today.

## Certificate rendering

The image route and `/verify/<serial>` add the line "Delivered in partnership with
<partner_name>" when `partner_name` is set. Nothing else changes, and the line is part of
the image's ETag.

## Side effects to guard

- **Nudge cron** (`/api/cron/nudge`): skip `source = 'distributor'` enrolments. Those
  learners have `.invalid` emails and no access to our site.
- **Learner-facing pages:** partner users can't sign in, so `/learn` never sees them. Nothing to change.
- **Licence removed later:** existing completions and certificates stay. New completions for
  that course get 404.

## Tests (`node --test`, next to the code)

- Release rule, `on_payment`: completed then paid, and paid then completed, each issue
  exactly once. Toggling off and on doesn't issue twice.
- `on_completion` issues on completion even when the batch is unpaid.
- `manual` issues only with `force`, and its API answers 409 `certificate_pending` until then.
- `force` on an unpaid batch issues the certificate.
- With `certificate_enabled = false`, nothing is issued, even with `force`.
- Upserts are safe to repeat: the same learner PUT twice gives one user, and the same
  completion twice gives one enrolment.
- Isolation: client B gets 404 for client A's learner and batch.
- An unpaid batch returns 402 `payment_pending` with the batch name in the message.
- DELETE completion after release returns 409.
- Nudge skips partner enrolments.

## Docs

Extend `docs/distributor-api.md` with every endpoint above, the new error codes and a short
"learner lifecycle" walkthrough. All of it fits the v1 rule of only adding.

## Out of scope (later, when asked)

Outbound webhooks (`certificate.released`), learner sign-in on our site (SSO or launch
links), a PDF format, automatic payment through Cashfree invoices, a release mode per batch (the
per-client mode plus Generate now covers it), and WAF rate limits (see `docs/api-architecture-proposal.md`).
