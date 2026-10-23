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
