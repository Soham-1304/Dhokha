#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/.aws-deployment.env"

CLIENT_IP="${1:?Usage: repair-ec2-proxy.sh <public-ip>}"
TEMP_DIR="$(mktemp -d -t dhokha-repair.XXXXXX)"
KEY_PATH="$TEMP_DIR/ec2-connect"
NGINX_CONFIG="$TEMP_DIR/dhokha.conf"
SSH_RULE_ADDED=false

cleanup() {
  if [[ "$SSH_RULE_ADDED" == true ]]; then
    aws ec2 revoke-security-group-ingress \
      --profile "$AWS_PROFILE" \
      --region "$AWS_REGION" \
      --group-id "$SECURITY_GROUP_ID" \
      --protocol tcp \
      --port 22 \
      --cidr "$CLIENT_IP/32" >/dev/null || true
  fi
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

AVAILABILITY_ZONE="$(aws ec2 describe-instances \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' \
  --output text)"

ssh-keygen -q -t ed25519 -N '' -f "$KEY_PATH"
aws ec2 authorize-security-group-ingress \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --group-id "$SECURITY_GROUP_ID" \
  --protocol tcp \
  --port 22 \
  --cidr "$CLIENT_IP/32" >/dev/null
SSH_RULE_ADDED=true

aws ec2-instance-connect send-ssh-public-key \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-id "$INSTANCE_ID" \
  --availability-zone "$AVAILABILITY_ZONE" \
  --instance-os-user ec2-user \
  --ssh-public-key "file://$KEY_PATH.pub" >/dev/null

cat >"$NGINX_CONFIG" <<'NGINX'
server {
    listen 80 default_server;
    server_name _dhokha_origin;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_read_timeout 300;
    }
}
NGINX

SSH_OPTIONS=(
  -i "$KEY_PATH"
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o StrictHostKeyChecking=accept-new
  -o UserKnownHostsFile="$TEMP_DIR/known_hosts"
)

ssh "${SSH_OPTIONS[@]}" "ec2-user@${PUBLIC_URL#http://}" \
  'sudo systemctl is-active dhokha nginx && curl -fsS http://127.0.0.1:8000/health'
base64 <"$NGINX_CONFIG" | ssh "${SSH_OPTIONS[@]}" "ec2-user@${PUBLIC_URL#http://}" \
  'base64 --decode | sudo tee /etc/nginx/conf.d/dhokha.conf >/dev/null && sudo nginx -t && sudo systemctl restart nginx && curl -fsS http://127.0.0.1/health'

echo
echo "Nginx proxy repaired; temporary SSH access was removed."
