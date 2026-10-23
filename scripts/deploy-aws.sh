#!/usr/bin/env bash
# Build the app image, push it to ECR and roll it out on ECS (infra/aws.yml).
# Usage: scripts/deploy-aws.sh
#   CERTIFICATE_ARN=arn:...   attach the HTTPS certificate (kept on later runs)
#   CRONS_ENABLED=true|false  switch the scheduled jobs (kept on later runs)
# See docs/aws-hosting.md.
set -euo pipefail
cd "$(dirname "$0")/.."

export AWS_PROFILE="${AWS_PROFILE:-sociafy}" AWS_REGION="${AWS_REGION:-ap-south-1}"
STACK=indus-academy REPO=indus-academy SECRET=indus-academy/prod

account=$(aws sts get-caller-identity --query Account --output text)
registry="$account.dkr.ecr.$AWS_REGION.amazonaws.com"
tag="$(git rev-parse --short HEAD)-$(date +%Y%m%d%H%M%S)"
image="$registry/$REPO:$tag"

if ! aws ecr describe-repositories --repository-names "$REPO" >/dev/null 2>&1; then
  aws ecr create-repository --repository-name "$REPO" >/dev/null
  aws ecr put-lifecycle-policy --repository-name "$REPO" --lifecycle-policy-text \
    '{"rules":[{"rulePriority":1,"description":"keep last 10","selection":{"tagStatus":"any","countType":"imageCountMoreThan","countNumber":10},"action":{"type":"expire"}}]}' >/dev/null
fi
aws ecr get-login-password | docker login --username AWS --password-stdin "$registry" >/dev/null

secret_arn=$(aws secretsmanager describe-secret --secret-id "$SECRET" --query ARN --output text)
# The database admits only the app containers; let this machine in for the build, then out.
db_sg=$(aws cloudformation describe-stack-resource --stack-name "$STACK" --logical-resource-id DbSecurityGroup \
  --query StackResourceDetail.PhysicalResourceId --output text 2>/dev/null || true)
if [[ -n "$db_sg" ]]; then
  my_ip="$(curl -s https://checkip.amazonaws.com)/32"
  aws ec2 authorize-security-group-ingress --group-id "$db_sg" --protocol tcp --port 5432 --cidr "$my_ip" >/dev/null 2>&1 || true
  trap 'aws ec2 revoke-security-group-ingress --group-id "$db_sg" --protocol tcp --port 5432 --cidr "$my_ip" >/dev/null 2>&1 || true' EXIT
fi
# Lets the build prerender the course catalogue from the live database.
DATABASE_URL=$(aws secretsmanager get-secret-value --secret-id "$SECRET" --query SecretString --output text |
  node -e 'process.stdout.write(JSON.parse(require("fs").readFileSync(0, "utf8")).DATABASE_URL || "")')
export DATABASE_URL

echo "Building $image"
docker build --platform linux/arm64 --build-arg DEPLOYMENT_ID="$tag" \
  --secret id=database_url,env=DATABASE_URL -t "$image" .
docker push "$image" >/dev/null

vpc=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId' --output text)
subnets=$(aws ec2 describe-subnets --filters Name=vpc-id,Values="$vpc" Name=default-for-az,Values=true \
  --query 'Subnets[].SubnetId' --output text | tr '\t' ',')

params=(ImageUri="$image" VpcId="$vpc" SubnetIds="$subnets" SecretArn="$secret_arn")
[[ -n "${CERTIFICATE_ARN:-}" ]] && params+=(CertificateArn="$CERTIFICATE_ARN")
[[ -n "${CRONS_ENABLED:-}" ]] && params+=(CronsEnabled="$CRONS_ENABLED")

echo "Rolling out (waits until the new containers are healthy)"
aws cloudformation deploy --stack-name "$STACK" --template-file infra/aws.yml \
  --capabilities CAPABILITY_IAM --no-fail-on-empty-changeset --parameter-overrides "${params[@]}"

aws cloudformation describe-stacks --stack-name "$STACK" \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output text
