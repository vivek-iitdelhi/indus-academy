# AWS hosting

The site runs on AWS account **902916048044** (Sociafy), region **ap-south-1** (Mumbai),
as the same Next.js app it was on Vercel, packaged as a container.

```
indusai.academy ─► Application Load Balancer ─► ECS Fargate: 2–10 containers (0.5 vCPU / 1 GB, ARM)
                                                 ├─ RDS Postgres 17 (Mumbai, same network)
                                                 └─ Cloudflare R2 video (unchanged)
```

| Piece | Where |
| --- | --- |
| Everything below as one CloudFormation stack, `indus-academy` | `infra/aws.yml` |
| Container image (last 10 kept) | ECR repository `indus-academy` |
| Containers, auto-scaled on CPU (target 60%, min 2, max 10) | ECS cluster and service `indus-academy` |
| App environment, one JSON object | Secrets Manager `indus-academy/prod` |
| Logs (14 days) | CloudWatch `/ecs/indus-academy` |
| Weekly newsletter, daily nudge (were Vercel crons) | EventBridge rules (on since 23 Oct 2026) |
| Partner API flood protection: rate-based rules on `/api/v*` (see "Partner API" below) | WAF web ACL `indus-academy` on the load balancer |
| Partner webhooks, every minute | EventBridge rule `PartnerWebhooksSchedule` → `/api/cron/partner-webhooks` |
| Database: RDS `indus-academy` (db.t4g.small, 7-day backups, deletion protection). Admits only the app containers; `deploy-aws.sh` lets the build machine in while it builds | Master password in the RDS-managed secret (stack output `DatabaseSecretArn`) |

The load balancer checks `/`, not `/api/health`. `/api/health` queries the database, so a
database blip would mark every container unhealthy at once. Use `/api/health` yourself to
diagnose a deployment.

## Deploy

```sh
aws login --profile sociafy   # when the session has expired
scripts/deploy-aws.sh
```

This builds the image from your working tree, pushes it, and rolls it out. It waits until
the new containers pass health checks. A rollout that fails health checks rolls back on its
own. It needs Docker running.

## Change a setting

```sh
aws secretsmanager get-secret-value --profile sociafy --region ap-south-1 \
  --secret-id indus-academy/prod --query SecretString --output text > /tmp/env.json
# edit /tmp/env.json, then:
aws secretsmanager put-secret-value --profile sociafy --region ap-south-1 \
  --secret-id indus-academy/prod --secret-string file:///tmp/env.json && rm /tmp/env.json
aws ecs update-service --profile sociafy --region ap-south-1 \
  --cluster indus-academy --service indus-academy --force-new-deployment
```

Every key listed under `Secrets` in `infra/aws.yml` must exist in the JSON (an empty string
is fine). A missing key stops the containers from starting. To add a new setting, add it in
both places.

## Status

Live since 23 Oct 2026: `indusai.academy` and `www` point at the load balancer (Hostinger ALIAS/CNAME),
HTTPS uses ACM certificate `598fc400-…`, and the database moved from Supabase (Sydney) to RDS in
Mumbai the same day. The Supabase project still holds the data as of that move: a backup, not live.
The Vercel project no longer serves the domain.

## Going live (DNS at Hostinger), done

1. Request the certificate: `aws acm request-certificate --profile sociafy --region ap-south-1
   --domain-name indusai.academy --subject-alternative-names www.indusai.academy
   --validation-method DNS`. Add the CNAME it gives you (`aws acm describe-certificate`) at
   Hostinger and wait for `ISSUED`.
2. `CERTIFICATE_ARN=<arn> scripts/deploy-aws.sh`: adds HTTPS and redirects HTTP to it.
3. At Hostinger, point `indusai.academy` and `www` at the load balancer (stack output
   `LoadBalancerDns`). For the apex, use an ALIAS/ANAME record, or a CNAME on `www` with the
   apex redirecting to it.
4. Update the Cashfree webhook URL and the Google OAuth redirect if they named a Vercel host.
5. Remove the crons from Vercel (or the Vercel project), then
   `CRONS_ENABLED=true scripts/deploy-aws.sh`. Run both and every newsletter goes out twice.

## Multi-container rules

- The catalogue (`/courses`, the sitemap) revalidates every 60 s. `revalidateCourse()` only
  refreshes the container that handled the admin edit; the others catch up within a minute.
- `deploymentId` is the image tag, so tabs that were open during a deploy reload cleanly.
- Anything kept in memory (a `Map`, a counter) exists once per container. Shared state
  belongs in Postgres.

## Partner API: rate limits and webhooks

Two layers keep one partner from swamping the site:

| Layer | Limit | Answers |
| --- | --- | --- |
| App, in `withDistributor` (`src/lib/rate-limit.ts`) | Per key: `distributors.rate_limit_per_minute`, default 120, set on the partner's admin page (1–5,000). One upsert per request on `api_rate_limits` | `429 rate_limited` with `ratelimit` headers and the exact `retry_after` |
| AWS WAF on the load balancer (`ApiWebAcl` in `infra/aws.yml`) | Paths `^/api/v[0-9]+/` only: 6,000 a minute per `Authorization` header, and 12,000 a minute per IP (catches requests with no key or a fresh fake key each time) | The same `429 rate_limited` body, `Retry-After: 60`, without touching a container |

The app limit is the one partners normally meet. WAF exists for floods ("50,000 requests at
once"): those never reach a container or Postgres. WAF takes a few seconds, up to about a
minute, to start blocking a new flood, and until it does, the app limit answers each request with
a couple of queries. The site, `/api/learn/*` and `/api/video/*` are not counted. Blocked requests
show in CloudWatch (namespace `AWS/WAFV2`, metrics `api-per-key` and `api-per-ip`) and as
sampled requests in the WAF console.

Webhooks go out from `/api/cron/partner-webhooks`, which EventBridge calls every minute
(`PartnerWebhooksSchedule`, same `CRON_SECRET` and `CronsEnabled` switch as the other crons).
The same run prunes old `api_rate_limits` and `api_idempotency_keys` rows. Failed events show
on the partner's admin page with a Retry button.

**Deploy (first time).**
1. Migrate first: `scripts/prod-db.sh npx drizzle-kit migrate`. It adds the tables, adds the new
   `distributors` columns, and copies every partner's current key into `distributor_keys`.
   The running containers don't read any of it, so nothing changes yet.
2. Then `scripts/deploy-aws.sh` straight away. The stack update creates the web ACL, attaches it
   to the load balancer, and adds the webhook schedule; the new image reads keys from
   `distributor_keys`. Don't create or rotate partner keys between steps 1 and 2: a key made by
   the old admin page in that gap is not copied.
3. Check: a partner request answers with `ratelimit-policy: 120;w=60`; the WAF console lists
   `indus-academy` with the load balancer under "Associated AWS resources".

To roll back the WAF alone, delete `ApiWebAcl` and `ApiWebAclAssociation` from the template and
deploy. Rolling back the image mostly works: the old code reads `distributors.key_hash`, which
holds each partner's original key, or the one from the last "Rotate key" (revoking a key scrubs
it there). A second key made on the partner's page is not in it, so a partner already using one
gets 401 on the old image.

**Cost.** WAF: $5 a month for the web ACL, plus $1 per rule (two), plus $0.60 per million
requests. WAF inspects every request to the load balancer, the whole site and not only the API,
so at 10 million requests a month that is about $13 a month in all. The every-minute
EventBridge call is about 43,000 API-destination invocations a month, roughly $0.01. The
Postgres tables add one small row per active key per minute (pruned) and nothing measurable on
the db.t4g.small.

## Tear down

`aws cloudformation delete-stack --profile sociafy --region ap-south-1 --stack-name indus-academy`
removes everything except the ECR repository and the secret.

## Video encoder (L40S GPU)

`scripts/encoder.ts` runs on the L40S box `l40ssociafy` (SSH alias in `~/.ssh/config`;
Sociafy account, ap-south-2) as the systemd **user** service `indus-encoder`, encoding with
`h264_nvenc` and encrypting the segments (AES-128) before upload. It needs only three files,
copied to `~/indus-encoder/` there, plus `.env.encoder` (R2 keys, `VIDEO_ENCODER=h264_nvenc`):

```sh
scp scripts/encoder.ts l40ssociafy:indus-encoder/scripts/
scp src/lib/video.ts src/lib/hls-crypto.ts l40ssociafy:indus-encoder/src/lib/
ssh l40ssociafy 'systemctl --user restart indus-encoder && systemctl --user is-active indus-encoder'
```

Node 24 lives in `~/.local/node` there (no sudo on that box). The admin panel shows the encoder
online from its heartbeat in R2 (`encoder/heartbeat.json`).

### Low-bandwidth rungs for older videos (not run yet)

New encodes include a 144p rung (~150 kbps) and an audio-only rendition after the usual
ladder. Videos encoded before 28 Oct 2026 get both from `--add-low-rungs`. It encodes them from
an existing rung, encrypts them with the video's own key, and uploads them as the next rung
numbers. It changes `master.m3u8` last, so players never see a missing rung. Other rungs aren't
touched. Re-running it skips videos that already have 144p. Deploy the encoder first (above),
then on the box:

```sh
ssh l40ssociafy
cd ~/indus-encoder
# 1. Dry run on one video: downloads and encodes, prints the variants it would add, writes nothing.
~/.local/node/bin/node --env-file=.env.encoder scripts/encoder.ts --add-low-rungs --dry-run --only <uid>
# 2. That video for real, then play it in the admin panel.
~/.local/node/bin/node --env-file=.env.encoder scripts/encoder.ts --add-low-rungs --only <uid>
# 3. All videos, one at a time (most of the time goes to downloading one rung each).
nohup ~/.local/node/bin/node --env-file=.env.encoder scripts/encoder.ts --add-low-rungs > ~/low-rungs.log 2>&1 &
```

It runs beside the service and doesn't send heartbeats. A video that fails is logged
(`add low rungs failed`) and the run moves on; run it again to retry. Videos that were never
encrypted are skipped: run `scripts/encrypt-videos.ts` first.
