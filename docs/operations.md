# Running indusai.academy: a guide for the team

Everything runs on AWS, account **902916048044** (Sociafy), region **Mumbai (ap-south-1)**.
There is no server to SSH into: the site runs as containers that AWS manages. You work through
the AWS console in a browser, or the `aws` command line. Architecture and deploy details:
[aws-hosting.md](aws-hosting.md).

## 1. Sign in

**Console:** <https://902916048044.signin.aws.amazon.com/console> with your IAM username and
password. Then set the region (top right) to **Asia Pacific (Mumbai)**. Everything below is
there; in any other region you'll see nothing.

**Command line**, needed to deploy or touch the database. Once:

1. Install the AWS CLI (`brew install awscli`), Docker Desktop, Node 24+ and `psql`
   (`brew install libpq`).
2. Console → IAM → Users → your user → Security credentials → Create access key (CLI).
3. `aws configure --profile sociafy`, paste the key and secret, region `ap-south-1`.
4. `git clone https://github.com/vivek-iitdelhi/indus-academy && cd indus-academy && npm ci`

Check it works: `aws sts get-caller-identity --profile sociafy` shows your user.

## 2. Is the site OK?

| Check | How |
| --- | --- |
| Up, and can reach its database | Open <https://indusai.academy/api/health>: `"ok":true`. `missing` lists any setting that's empty. |
| Containers running | Console → ECS → Clusters → `indus-academy` → Services → `indus-academy`. Should show 2 running (more under load, up to 10). Tab **Deployments** shows a rollout in progress. |
| Database | Console → RDS → Databases → `indus-academy`: status Available, CPU and connections under Monitoring. |
| Load balancer | Console → EC2 → Target groups: targets healthy. |

## 3. What's going wrong? Read the logs

Console → CloudWatch → Log groups → **`/ecs/indus-academy`**. Kept 14 days. From the terminal:

```sh
aws logs tail /ecs/indus-academy --profile sociafy --region ap-south-1 --since 30m --follow
aws logs tail /ecs/indus-academy --profile sociafy --region ap-south-1 --since 2h --filter-pattern '"[live]"'
```

Useful filters: `"Error"`, `"[live]"` (live classes), `"[api usage]"` (partner API).

## 4. Quick fixes

**Restart the site** (fresh containers, same code; fixes most "it got stuck"):

```sh
aws ecs update-service --profile sociafy --region ap-south-1 \
  --cluster indus-academy --service indus-academy --force-new-deployment
```

Takes ~3 minutes; the old containers keep serving until the new ones are healthy.

**Roll back a bad deploy:** every deploy is a numbered task definition (`indus-academy:20`,
`:21`, …). Go back one:

```sh
aws ecs update-service --profile sociafy --region ap-south-1 \
  --cluster indus-academy --service indus-academy --task-definition indus-academy:<previous number>
```

The current number is on the service page (Console → ECS → service → Configuration). A deploy
that fails its health checks already rolls itself back.

**Change a setting** (API keys, emails, the webinar.gg token): see "Change a setting" in
[aws-hosting.md](aws-hosting.md). Never remove a key from that JSON: the containers won't start.

## 5. Ship a code change

```sh
git pull                          # main is production
# make the change, run: npm test && npx tsc --noEmit
scripts/prod-db.sh npx drizzle-kit migrate   # only if the change added a drizzle/ migration
scripts/deploy-aws.sh                         # Docker must be running; ~10 minutes
git push origin main
```

Migrate **before** deploying code that needs the new tables. `deploy-aws.sh` builds from your
working folder, so deploy what you committed.

## 6. The database

```sh
scripts/prod-db.sh                              # a psql shell on production
scripts/prod-db.sh psql -c "select count(*) from enrollments"
```

It opens the database to your IP and closes it when you exit. This is the live data:
read freely, write only when you're sure (`begin;` … `commit;`). Backups are daily, kept 7 days
(Console → RDS → `indus-academy` → Maintenance & backups → restore to a point in time).

## 7. The website itself

- **Admin panel:** <https://indusai.academy/admin>, sign in with your email. Admins are managed
  at /admin/admins.
- **Live classes:** /admin/live. Schedule, Host (the studio opens inside our admin; nobody goes to
  webinar.gg), and per-class Attendance: who opened the class and who got into the room.
- **Partner API keys and usage:** /admin/distributors and /admin/analytics.
- **Test learner:** type `test@indusai.academy` at /signin, no code needed. An ordinary account
  with no courses.

## Don't

- Don't delete or modify the RDS database, the `indus-academy` CloudFormation stack, or the
  ECR repository from the console. The stack is changed only through `scripts/deploy-aws.sh`.
- Don't touch other projects in this account (Salesnix, xgreen, the GPU instances).
- Don't share your access key; each person gets their own IAM user.
- Don't change the webinar.gg token (`WEBINAR_GG_TOKEN`) casually: the webhook URL's key is
  derived from it, so the webhook must be set again afterwards
  (`PUT https://webinar-api.webinar.gg/api/developer/webhook-url` while signed in as the account
  owner), or recording links stop arriving.
