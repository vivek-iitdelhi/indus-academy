# Docs

## LMS

Built in this repository alongside the marketing site: `/courses` (catalogue),
`/learn` (learner app), `/admin` (course builder and operations), `/verify/<serial>`
(public certificate check) and `/api/v1` (distributor API).

Current:

1. **[lms-foundation.md](lms-foundation.md)** — the contract: stack (Supabase Postgres +
   Drizzle, Better Auth, Cloudflare R2 video), schema, module APIs and the rules every
   change follows. Start here before touching LMS code.
2. **[lms-go-live.md](lms-go-live.md)** — accounts, keys and environment variables to
   set, and the checks to run before the first real sale.
3. **[distributor-api.md](distributor-api.md)** — for partner developers receiving our
   courses over the API.

Background (the original plan; superseded where the foundation doc says so):
[lms-prd.md](lms-prd.md) (requirements and acceptance criteria, still current),
[lms-plan.md](lms-plan.md), [lms-schema.md](lms-schema.md), [lms-phase-1.md](lms-phase-1.md).

## Operations

- **[program-delivery.md](program-delivery.md)** — how the live programmes are run:
  delivery standards, cohort dates, early-bird rules, refund terms.
- **[blog-automation.md](blog-automation.md)** — the cloud routine that researches and
  publishes two articles a day under the founder's name.
