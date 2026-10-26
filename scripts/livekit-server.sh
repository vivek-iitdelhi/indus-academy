#!/usr/bin/env bash
# The self-hosted LiveKit server for live classes: one Lightsail box in Mumbai running
# LiveKit (video), Egress (records each class to R2), Redis, and Caddy (TLS on 443, which
# also carries TURN for networks that block UDP). Kept off the Indus Labs voice box so a
# recording can't starve live calls.
#
# Usage: scripts/livekit-server.sh
#   First run: creates the box, its static IP and SSH key, and prints the DNS records to add
#   at Hostinger. Run again once they resolve: it installs Docker, writes the configs and
#   starts the stack. Safe to re-run at any time; it reuses the box, IP, key and API secret.
#   LIVE_HOST / TURN_HOST override the hostnames. R2 credentials come from .env.encoder.
set -euo pipefail
cd "$(dirname "$0")/.."

export AWS_PROFILE="${AWS_PROFILE:-sociafy}" AWS_REGION="${AWS_REGION:-ap-south-1}"
NAME=indus-livekit SECRET=indus-academy/livekit KEY="$HOME/.ssh/indus-livekit.pem"
LIVE_HOST="${LIVE_HOST:-live.indusai.academy}" TURN_HOST="${TURN_HOST:-turn.indusai.academy}"
set -a; source .env.encoder; set +a

# --- The box -------------------------------------------------------------------------------
if [[ ! -f "$KEY" ]]; then
  aws lightsail create-key-pair --key-pair-name "$NAME" --query privateKeyBase64 --output text > "$KEY"
  chmod 600 "$KEY"
fi
if ! aws lightsail get-instance --instance-name "$NAME" >/dev/null 2>&1; then
  # 8 vCPU / 16 GB with an IPv4 address, cheapest such bundle ($168/mo compute-optimised
  # as of Oct 2026; Mumbai includes 3.5 TB/mo of outbound transfer).
  bundle=$(aws lightsail get-bundles --query \
    'sort_by(bundles[?isActive && cpuCount==`8` && ramSizeInGb==`16.0` && contains(supportedPlatforms, `LINUX_UNIX`) && !contains(bundleId, `ipv6`)], &price)[0].bundleId' \
    --output text)
  echo "Creating $NAME ($bundle)"
  aws lightsail create-instances --instance-names "$NAME" --availability-zone "${AWS_REGION}a" \
    --blueprint-id ubuntu_24_04 --bundle-id "$bundle" --key-pair-name "$NAME" >/dev/null
  aws lightsail allocate-static-ip --static-ip-name "$NAME-ip" >/dev/null 2>&1 || true
  until [[ $(aws lightsail get-instance-state --instance-name "$NAME" --query state.name --output text) == running ]]; do sleep 5; done
  aws lightsail attach-static-ip --static-ip-name "$NAME-ip" --instance-name "$NAME" >/dev/null
fi
# 80/443 TLS and signalling (443 also TURN/TLS), 7881 ICE over TCP, 3478 TURN/UDP, 50000-60000 media.
aws lightsail put-instance-public-ports --instance-name "$NAME" --port-infos \
  fromPort=22,toPort=22,protocol=tcp fromPort=80,toPort=80,protocol=tcp fromPort=443,toPort=443,protocol=tcp \
  fromPort=7881,toPort=7881,protocol=tcp fromPort=3478,toPort=3478,protocol=udp \
  fromPort=50000,toPort=60000,protocol=udp >/dev/null
ip=$(aws lightsail get-static-ip --static-ip-name "$NAME-ip" --query staticIp.ipAddress --output text)

# --- DNS: Caddy can only get certificates once both names point here -----------------------
if [[ $(dig +short "$LIVE_HOST" | tail -1) != "$ip" || $(dig +short "$TURN_HOST" | tail -1) != "$ip" ]]; then
  echo "Add these A records at Hostinger, then run this script again:"
  echo "  ${LIVE_HOST%%.*}  ->  $ip"
  echo "  ${TURN_HOST%%.*}  ->  $ip"
  exit 0
fi

# --- API key: generated once, kept in Secrets Manager --------------------------------------
if creds=$(aws secretsmanager get-secret-value --secret-id "$SECRET" --query SecretString --output text 2>/dev/null); then
  api_key=$(node -pe 'JSON.parse(process.argv[1]).LIVEKIT_API_KEY' "$creds")
  api_secret=$(node -pe 'JSON.parse(process.argv[1]).LIVEKIT_API_SECRET' "$creds")
else
  api_key="API$(openssl rand -hex 6)" api_secret=$(openssl rand -base64 36 | tr -d '/+=')
  aws secretsmanager create-secret --name "$SECRET" --description "Self-hosted LiveKit for live classes" \
    --secret-string "$(node -pe 'JSON.stringify({LIVEKIT_URL: process.argv[1], LIVEKIT_API_KEY: process.argv[2], LIVEKIT_API_SECRET: process.argv[3]})' \
      "wss://$LIVE_HOST" "$api_key" "$api_secret")" >/dev/null
fi

# --- Configs -------------------------------------------------------------------------------
conf=$(mktemp -d); trap 'rm -rf "$conf"' EXIT
cat > "$conf/docker-compose.yaml" <<'EOF'
services:
  caddy:
    image: livekit/caddyl4
    command: run --config /etc/caddy.yaml --adapter yaml
    restart: unless-stopped
    network_mode: host
    volumes: [./caddy.yaml:/etc/caddy.yaml, ./caddy_data:/data]
  livekit:
    image: livekit/livekit-server:latest
    command: --config /etc/livekit.yaml
    restart: unless-stopped
    network_mode: host
    volumes: [./livekit.yaml:/etc/livekit.yaml]
  redis:
    image: redis:7-alpine
    command: redis-server --bind 127.0.0.1 --protected-mode yes
    restart: unless-stopped
    network_mode: host
  egress:
    image: livekit/egress:latest
    restart: unless-stopped
    network_mode: host
    environment: [EGRESS_CONFIG_FILE=/etc/egress.yaml]
    volumes: [./egress.yaml:/etc/egress.yaml]
    cap_add: [SYS_ADMIN]
EOF
cat > "$conf/caddy.yaml" <<EOF
storage: { module: file_system, root: /data }
apps:
  tls:
    certificates:
      automate: [$LIVE_HOST, $TURN_HOST]
  layer4:
    servers:
      main:
        listen: [":443"]
        routes:
          - match: [{ tls: { sni: [$TURN_HOST] } }]
            handle: [{ handler: tls }, { handler: proxy, upstreams: [{ dial: ["localhost:5349"] }] }]
          - match: [{ tls: { sni: [$LIVE_HOST] } }]
            handle:
              - { handler: tls, connection_policies: [{ alpn: [http/1.1] }] }
              - { handler: proxy, upstreams: [{ dial: ["localhost:7880"] }] }
EOF
cat > "$conf/livekit.yaml" <<EOF
port: 7880
rtc:
  tcp_port: 7881
  port_range_start: 50000
  port_range_end: 60000
  use_external_ip: true
redis: { address: localhost:6379 }
turn:
  enabled: true
  domain: $TURN_HOST
  tls_port: 5349
  udp_port: 3478
  external_tls: true
keys:
  $api_key: $api_secret
EOF
cat > "$conf/egress.yaml" <<EOF
api_key: $api_key
api_secret: $api_secret
ws_url: ws://localhost:7880
redis: { address: localhost:6379 }
health_port: 8080
s3:
  access_key: $R2_ACCESS_KEY_ID
  secret: $R2_SECRET_ACCESS_KEY
  region: auto
  endpoint: $R2_ENDPOINT
  bucket: $R2_BUCKET
  force_path_style: true
EOF

# --- Install and start ---------------------------------------------------------------------
ssh_() { ssh -i "$KEY" -o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 "ubuntu@$ip" "$@"; }
until ssh_ true 2>/dev/null; do sleep 5; done
ssh_ 'command -v docker >/dev/null || curl -fsSL https://get.docker.com | sudo sh; mkdir -p ~/livekit'
scp -q -i "$KEY" "$conf"/*.yaml "ubuntu@$ip:livekit/"
ssh_ 'cd ~/livekit && chmod 600 *.yaml && sudo docker compose pull -q && sudo docker compose up -d --remove-orphans'

echo "Waiting for https://$LIVE_HOST"
for _ in $(seq 60); do [[ $(curl -s -m 5 "https://$LIVE_HOST") == OK ]] && break; sleep 5; done
[[ $(curl -s -m 5 "https://$LIVE_HOST") == OK ]] || { echo "LiveKit not answering on https://$LIVE_HOST; check: ssh -i $KEY ubuntu@$ip 'cd livekit && sudo docker compose logs'"; exit 1; }
echo "LiveKit is up: wss://$LIVE_HOST  (key and secret in Secrets Manager: $SECRET)"
echo "SSH: ssh -i $KEY ubuntu@$ip"
