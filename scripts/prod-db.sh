#!/usr/bin/env bash
# Run a command against the production database, which normally admits only the app
# containers. Opens it to this machine's public IPs, runs the command with DATABASE_URL set,
# then closes it again.
#   scripts/prod-db.sh                         # psql shell
#   scripts/prod-db.sh psql -c "select 1"      # one query
#   scripts/prod-db.sh npx drizzle-kit migrate  # apply new migrations (before deploying code that needs them)
set -euo pipefail
export AWS_PROFILE=${AWS_PROFILE:-sociafy} AWS_REGION=${AWS_REGION:-ap-south-1}

DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id indus-academy/prod --query SecretString --output text |
  node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).DATABASE_URL || "")')
export DATABASE_URL
db_sg=$(aws cloudformation describe-stack-resource --stack-name indus-academy --logical-resource-id DbSecurityGroup \
  --query StackResourceDetail.PhysicalResourceId --output text)

# Some networks leave by more than one public IP; allow every one seen.
ips=$(for u in https://checkip.amazonaws.com https://api.ipify.org https://icanhazip.com https://ifconfig.me/ip; do
  curl -s --max-time 5 "$u"; echo; done | grep -E '^[0-9]+(\.[0-9]+){3}$' | sort -u)
for ip in $ips; do
  aws ec2 authorize-security-group-ingress --group-id "$db_sg" --protocol tcp --port 5432 --cidr "$ip/32" >/dev/null 2>&1 || true
done
trap 'for ip in $ips; do aws ec2 revoke-security-group-ingress --group-id "$db_sg" --protocol tcp --port 5432 --cidr "$ip/32" >/dev/null 2>&1 || true; done' EXIT
echo "Database open to: $(echo $ips) (closed again on exit)" >&2
sleep 3

if [[ $# -eq 0 ]]; then psql "$DATABASE_URL"
elif [[ $1 == psql ]]; then psql "$DATABASE_URL" "${@:2}"
else "$@"; fi
