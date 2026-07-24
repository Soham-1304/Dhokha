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

if [[ -n "${API_GATEWAY_ID:-}" ]]; then
  echo "API Gateway already exists: $API_GATEWAY_ID" >&2
  exit 1
fi

ORIGIN_DOMAIN="$(aws ec2 describe-instances \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicDnsName' \
  --output text)"
if [[ -z "$ORIGIN_DOMAIN" || "$ORIGIN_DOMAIN" == "None" ]]; then
  echo "The EC2 instance does not have a public DNS name." >&2
  exit 1
fi

read -r API_ID API_ENDPOINT < <(
  aws apigatewayv2 create-api \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --name dhokha-backend \
    --description "HTTPS proxy for the Dhokha EC2 ONNX fraud backend" \
    --protocol-type HTTP \
    --target "http://$ORIGIN_DOMAIN" \
    --cors-configuration \
      '{"AllowOrigins":["*"],"AllowMethods":["*"],"AllowHeaders":["*"],"ExposeHeaders":["*"],"MaxAge":3600}' \
    --tags Project=Dhokha,ManagedBy=Codex \
    --query '[ApiId,ApiEndpoint]' \
    --output text
)

cat >>"$STATE_FILE" <<EOF
API_GATEWAY_ID='$API_ID'
HTTPS_URL='$API_ENDPOINT'
EOF

echo "API Gateway: $API_ID"
echo "HTTPS API:   $API_ENDPOINT"
curl --silent --show-error --fail --max-time 20 "$API_ENDPOINT/health"
echo
echo "API Gateway is ready."
