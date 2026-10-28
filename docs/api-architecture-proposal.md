# API architecture proposal (for discussion)

Status: draft, 23 Oct 2026. Since built (28 Oct 2026, for large partners such as BLS): rate
limiting, in the app (120 a minute per key, `src/lib/rate-limit.ts`) and as WAF rules on the
ALB for floods; outbound webhooks as proposed below (`src/lib/partner-webhooks.ts`); two keys
per partner and `iaa_test_` test keys (G8, table `distributor_keys`); `500 internal_error` in the
v1 shape; and, against this proposal's "skip", an `Idempotency-Key` store (`src/lib/idempotency.ts`),
because the owner asked for it. Operations: [`aws-hosting.md`](aws-hosting.md), "Partner API".
Contract docs stay authoritative:
[`lms-foundation.md`](lms-foundation.md), [`distributor-api.md`](distributor-api.md),
[`aws-hosting.md`](aws-hosting.md).

**Recommendation in one line:** keep new integration APIs in `/api/v1` inside the Next app,
reusing `withDistributor`, the v1 error shape and the v1 versioning rules. Add AWS WAF
rate-based rules at the ALB, and a Postgres outbox plus an EventBridge cron for outbound
webhooks. No new service, no API Gateway, no Redis.

## 1. What exists today

24 route files under `src/app/api/`.

| Audience | Route | Methods | Auth |
| --- | --- | --- | --- |
| Public | `/api/health` | GET | none (DB status + names of missing env vars) `health/route.ts:11` |
| Public | `/api/consulting/slots` | GET | none `consulting/slots/route.ts:5` |
| Public | `/api/consulting/book` | POST | none; price and slot decided on the server `consulting/book/route.ts:18` |
| Public | `/api/checkout` (program seat) | POST | none (guest) `checkout/route.ts:24` |
| Public | `/api/checkout/verify` | POST | none; only `orderId` is trusted, checked against Cashfree `checkout/verify/route.ts:29` |
| Public | `/api/video/[uid]/[...path]` | GET | HMAC playback token `?t=` `video/[uid]/[...path]/route.ts:11` |
| Auth | `/api/auth/[...all]` | GET, POST | Better Auth (magic link, Google) `auth/[...all]/route.ts:4` |
| Learner session | `/api/checkout` (course) | POST | `getUser()` or 401 `checkout/route.ts:100` |
| Learner session | `/api/learn/progress`, `/quiz`, `/enroll-free` | POST | `getUser()` or 401 `learn/progress/route.ts:7` |
| Learner session | `/api/learn/ownership` | GET | optional session `learn/ownership/route.ts:13` |
| Learner session | `/api/forms/[slug]/upload` | POST | `getUser()` or 401 `forms/[slug]/upload/route.ts:17` |
| Admin | `/api/admin/uploads` | POST, PUT | `requireAdminApi()` (404 otherwise) `admin/uploads/route.ts:23` |
| Admin | `/api/admin/lessons/[id]/video`, `/forms/[id]/export`, `/forms/[id]/file`, `/google/connect`, `/google/callback` | GET | `requireAdminApi()` |
| Partner | `/api/v1/courses`, `/courses/[slug]`, `/lessons/[id]/playback` | GET | `Bearer iaa_live_…`, sha256 lookup `v1/_shared.ts:15`, `lib/distributors.ts:28` |
| Webhook in | `/api/cashfree/webhook` | POST | HMAC signature `cashfree/webhook/route.ts:28` |
| Cron | `/api/cron/nudge` | GET | `Bearer CRON_SECRET`, fails closed `cron/nudge/route.ts:11` |
| Cron | `/api/newsletter/send` | GET | `Bearer CRON_SECRET`, **fails open if unset** `newsletter/send/route.ts:13` |
| Ops | `/api/newsletter/stats` | GET | `?token=STATS_TOKEN` in the query string `newsletter/stats/route.ts:20` |

Things to fix whatever we decide here:
- `newsletter/send` runs for anyone when `CRON_SECRET` is missing. On a public ALB that means
  anyone can trigger a newsletter send. Make it fail closed, the way `nudge` already does.
- `stats` puts its secret in the URL, so the secret lands in any ALB access logs. Move it to a header.
- Two error shapes exist. Internal routes return `{error: "text"}` and v1 returns
  `{error: {code, message}}` (`v1/_shared.ts:9`). Leave the internal ones alone, since our own UI
  is their only client. Every integration endpoint uses the v1 shape.

## 2. Gaps for integrations

"Grounded" means the code or a doc already points at the need. "Guess" means nobody has asked for it yet.

| # | Gap | Evidence | Status |
| --- | --- | --- | --- |
| G1 | **Enrol a partner's learner on our platform** (`PUT /v1/enrollments`) | The doc says partners run enrolment and progress on their own platform (`distributor-api.md:3-5`), but the schema expects us to host them. `distributor_courses` is "licensed to enrol learners into" (`schema.ts:253`), `enrollments.distributor_id` exists (`schema.ts:282`), and `source='distributor'` is in the enum (`schema.ts:31`). Nothing writes any of them: only `manual`, `free` and `purchase` are used (`admin/learners/actions.ts:47`, `learn/enroll-free/route.ts:20`, `lib/lms/purchase.ts:106`). | Grounded. Decide hosted or licensed first (Q2) |
| G2 | **Progress and completion reporting** (`GET /v1/enrollments?course=&updated_since=`) | Corporate sponsors get "the list of certified participants with the summary report" (`program-delivery.md:92`). Today someone produces that by hand. | Grounded |
| G3 | **Learner sign-in from the partner's site** (SSO or a signed launch link) | Only magic link and Google are configured (`auth.ts:67-80`). Hosted partner learners would need a second sign-in. | Guess, but required if G1 is hosted |
| G4 | **Bulk provisioning** (CSV upload or a batch endpoint) | Corporate cohorts start from a participant list (`program-delivery.md:22`). The admin grant takes one learner who already has an account (`admin/learners/actions.ts:32-43`). | Grounded need; guess on volume |
| G5 | **Outbound webhooks** (`course.updated`, `enrollment.completed`, `certificate.issued`) | Partners poll `updated_at` to know when to re-sync (`distributor-api.md:64`). | Guess |
| G6 | **Certificates for partner learners** (completion write-back in licensed mode, or ours in hosted mode) | Certificates are "issued by INDUS AI" with public verification (`lms-prd.md:138-148`). A licensed partner grades quizzes itself, so it can never earn one of ours. | Guess. Business decision (Q3) |
| G7 | **Certificate verification JSON** (`GET /v1/certificates/{serial}`) for HR systems | `/verify/<serial>` exists only as a page (`lms-prd.md:144-148`). Cheap to add. | Guess |
| G8 | **Key management:** scopes, two live keys during rotation | One key per distributor (`schema.ts:246-247`). Rotation cuts the old key immediately (`distributor-api.md:22`), which is fine for reads but breaks a partner's writes mid-rotation. | Add only when writes ship |

Not proposed: SCORM/LTI/xAPI packages (big, and nobody has asked), a mobile-app API (the
PRD rules a mobile app out, `lms-prd.md:66`), and CRM sync.

## 3. Options

### A. Extend `/api/v1` in the Next app (recommended)

New endpoints are more route files under `src/app/api/v1/`, wrapped in `withDistributor`.
They call the existing `src/lib/lms/*` functions directly (`hasAccess`, `recordProgress`,
`issueCertificate`), so they follow foundation rule 1 for free.

- **For:** no new deploy, image, env set or pipeline. One codebase for a small team.
  Auth, the error shape, versioning and the docs style already exist. Every v1 request already
  goes through one wrapper (`v1/_shared.ts:15`), so logging and limits go in one place.
- **Against:** a partner hammering the API shares CPU with learners. At this scale that
  doesn't matter much. 5,000 concurrent learners reporting progress every 15 s is about
  330 req/s on `/api/learn/progress` alone, and partner traffic is noise beside it. ECS
  already scales on CPU (`infra/aws.yml:213-229`).
- **Revisit when** partner traffic becomes a real share of load, or a partner needs an SLA
  that has to be isolated from the website.

### B. Separate API service (e.g. a Hono container on the same cluster, ALB path rule `/api/v1/*`)

- **For:** scales and deploys on its own, and partner load is isolated from learner traffic.
  `src/lib/lms` and `src/db` already use relative imports with `.ts` extensions
  (`lms-foundation.md:31-32`), so they could be shared.
- **Against:** a second service, task definition, pipeline and secrets set, plus shared
  library versioning between two deployables. Version skew between them during rolling deploys.
  It solves an isolation problem we don't have yet. Too expensive for the team size.

### C. AWS API Gateway in front

- **For:** managed per-key throttling and quotas (REST API usage plans), plus a managed request log.
- **Against:** a second key system alongside `iaa_live_` hashes. Either partners hold two
  credentials, or we sync keys into Gateway. Adds a hop (Gateway → VPC link → ALB),
  per-request cost and another console to operate. Rate limiting is the only thing we'd use
  it for, and WAF on the ALB we already have does that (section 4).

**Pick A.** Option B stays available later: the routes are thin over `src/lib/lms`, so
moving them out is mostly copying files.

## 4. Cross-cutting concerns on multi-container AWS

**Rate limiting: needs shared state, and WAF provides it.** Any limiter kept in process
memory gets multiplied by the task count (2–10), because the ALB spreads requests across tasks.
- **Partner keys:** an AWS WAF rate-based rule on `/api/v1/*`, aggregated on the
  `Authorization` header (so effectively per key) with a custom 429 body
  `{"error":{"code":"rate_limited",…}}`. WAF counts at the ALB, so no Redis and no app code.
  Adding `rate_limited` to the error table is allowed within v1 (`distributor-api.md:185`).
- **Auth endpoints, already affected today:** Better Auth's limiter is on in production and
  defaults to `memory` storage (`node_modules/better-auth/dist/context/create-context.mjs:172-175`),
  so magic-link limits are per task. Fix with a per-IP WAF rule on `/api/auth/*`, or set
  `rateLimit.storage: "database"`, which needs a migration.
- WAF isn't in `infra/aws.yml`. That file's owner needs to add it (Q7).
- Skip: Redis, token buckets in app code, per-endpoint quotas.

**Idempotency: design writes so they don't need a key store.**
- Model writes as `PUT` on natural keys: an enrolment is `(user, course)`, and
  `enrollments_user_id_course_id_unique` plus an upsert already makes it replay-safe
  (`admin/learners/actions.ts:45-52`). Progress is monotonic and completion is never cleared
  (`lms-foundation.md:119-124`), and `issueCertificate` is idempotent (`lms-foundation.md:139`).
- Require the partner's own `external_user_id` (plus email) when provisioning, so a retried
  "create learner" finds the same row. That means one new column or table, through a migration.
- Skip: an `Idempotency-Key` header and its table. Add them only for a write with no
  natural key, which none of G1–G7 has.

**Outbound webhooks (G5): use an outbox, not `after()`.**
- `after()` runs inside the task that served the request
  (`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/after.md:50`). When ECS
  scales in or deploys, that task stops and undelivered events are lost.
- Instead, write a `webhook_deliveries` row in the same transaction as the event. Try one
  delivery straight away in `after()`, then let an EventBridge-scheduled endpoint retry
  failures with backoff for about 24 h. That uses the same pattern as the existing crons
  (`infra/aws.yml:233-294`, `Bearer CRON_SECRET`, fail closed). The drain claims rows with
  `FOR UPDATE SKIP LOCKED`, so overlapping runs don't double-send.
- Sign payloads with HMAC-SHA256 over `timestamp + body`. That's the scheme we already verify
  for Cashfree (`lib/cashfree.ts:137-145`), so partners get a familiar shape.
- Rows that are still failing show up in `/admin/distributors`.
- Skip: SQS/SNS, fan-out infrastructure, per-event subscriptions. One URL per partner is enough.

**Versioning: keep the existing rule** (`distributor-api.md:183-187`): the version is in the
path, v1 only ever grows, and breaking changes go to `/api/v2`. New write endpoints are additions to v1.

**Docs and OpenAPI.** Keep `distributor-api.md` as the contract and extend it per endpoint.
Hand-write a static `openapi.yaml` only when a partner wants to generate a client. Skip
schema generators and a docs portal.

**Observability.**
- Add one structured JSON log line per v1 request in `withDistributor`: distributor id,
  route, status, duration and the ALB's `X-Amzn-Trace-Id`. Return that id in error bodies so
  partners can quote it. Logs go to CloudWatch with 14-day retention (`infra/aws.yml:112-116`),
  which is enough to start with.
- Add a CloudWatch metric filter and alarm on v1 5xx and on webhook rows still failing.
- Skip: X-Ray, an APM vendor, per-partner dashboards (a CloudWatch Logs Insights query covers those).

**Multi-instance cache.** `revalidateCourse()` only reaches the task that ran it
(`lib/catalog-cache.ts:4-8`, `self-hosting.md:245`), and pages fall back to a 60 s
revalidate. That only matters if a partner API ever writes catalogue content. None of G1–G8 does.

## 5. Open questions for you

1. **Who integrates?** Distributors reselling on their own LMS, corporate clients (HRMS,
   SSO), internal tools (CRM, n8n), or all three? This decides which of G1–G8 to build first.
2. **Hosted or licensed?** Do partner learners learn on indusai.academy (G1, G3), or do
   partners keep running everything themselves, as `distributor-api.md` says today? The schema
   is half-built for hosted.
3. **Certificates for partner learners:** ours, theirs, or none? If ours in licensed mode,
   are we OK trusting a partner's completion report?
4. **Sign-in for hosted partner learners:** is a signed one-time launch link enough, or do
   specific clients need SAML or OIDC (which IdPs)?
5. **Learner data to partners:** emails, progress and quiz scores leaving our system needs
   a privacy policy amendment and maybe a DPA (`lms-prd.md:170-174`). That's your call.
6. **Limits and SLA:** what request rate and uptime are we promising partners? This sets the
   WAF thresholds.
7. **WAF:** OK to ask the `infra/aws.yml` owner to add a web ACL to the ALB (roughly
   $5/month plus per-request charges)?
