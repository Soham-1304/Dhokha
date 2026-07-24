#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$ROOT_DIR/.aws-deployment.env"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "EC2 deployment state was not found at $STATE_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$STATE_FILE"

BACKEND_DOMAIN="${1:-${BACKEND_DOMAIN:-api.dhokha.bharathperni.dev}}"
PUBLIC_IP="${PUBLIC_URL#http://}"
RESOLVED_IP="$(dig +short A "$BACKEND_DOMAIN" | tail -1)"

if [[ "$RESOLVED_IP" != "$PUBLIC_IP" ]]; then
  echo "$BACKEND_DOMAIN resolves to '${RESOLVED_IP:-nothing}', expected $PUBLIC_IP." >&2
  echo "Create an A record and wait for DNS propagation before retrying." >&2
  exit 1
fi

HTTPS_RULE_COUNT="$(aws ec2 describe-security-groups \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --group-ids "$SECURITY_GROUP_ID" \
  --query 'length(SecurityGroups[0].IpPermissions[?IpProtocol==`tcp` && FromPort==`443` && ToPort==`443`])' \
  --output text)"
if [[ "$HTTPS_RULE_COUNT" == "0" ]]; then
  aws ec2 authorize-security-group-ingress \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --group-id "$SECURITY_GROUP_ID" \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 >/dev/null
fi

PARAMETERS="$(jq -cn \
  --arg domain "$BACKEND_DOMAIN" \
  '{commands:[
    "set -euo pipefail",
    "sudo dnf install -y certbot python3-certbot-nginx",
    ("sudo sed -i \"s/server_name _dhokha_origin;/server_name " + $domain + ";/\" /etc/nginx/conf.d/dhokha.conf"),
    "sudo nginx -t",
    "sudo systemctl restart nginx",
    ("sudo certbot --nginx -d " + $domain + " --non-interactive --agree-tos --register-unsafely-without-email --redirect"),
    "sudo systemctl enable --now certbot-renew.timer",
    "sudo nginx -t",
    ("curl --fail --silent --show-error https://" + $domain + "/health")
  ]}')"

COMMAND_ID="$(aws ssm send-command \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --parameters "$PARAMETERS" \
  --query 'Command.CommandId' \
  --output text)"
aws ssm wait command-executed \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID"
aws ssm get-command-invocation \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --command-id "$COMMAND_ID" \
  --instance-id "$INSTANCE_ID" \
  --query '[Status,StandardOutputContent,StandardErrorContent]' \
  --output text

TEMP_STATE="$(mktemp)"
grep -v \
  -e '^BACKEND_DOMAIN=' \
  -e '^CUSTOM_HTTPS_URL=' \
  -e '^WSS_URL=' \
  "$STATE_FILE" >"$TEMP_STATE"
cat >>"$TEMP_STATE" <<EOF
BACKEND_DOMAIN='$BACKEND_DOMAIN'
CUSTOM_HTTPS_URL='https://$BACKEND_DOMAIN'
WSS_URL='wss://$BACKEND_DOMAIN/stream'
EOF
mv "$TEMP_STATE" "$STATE_FILE"

echo
echo "HTTPS API: https://$BACKEND_DOMAIN"
echo "WebSocket: wss://$BACKEND_DOMAIN/stream"
