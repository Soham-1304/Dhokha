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

if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  echo "CloudFront already exists: $CLOUDFRONT_DISTRIBUTION_ID" >&2
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

TEMP_DIR="$(mktemp -d -t dhokha-cloudfront.XXXXXX)"
CONFIG_FILE="$TEMP_DIR/distribution.json"
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

CALLER_REFERENCE="dhokha-$(date -u +%Y%m%dT%H%M%SZ)"
sed \
  -e "s|__CALLER_REFERENCE__|$CALLER_REFERENCE|" \
  -e "s|__ORIGIN_DOMAIN__|$ORIGIN_DOMAIN|" \
  "$ROOT_DIR/deploy/aws/cloudfront-config.json" >"$CONFIG_FILE"

read -r DISTRIBUTION_ID DISTRIBUTION_DOMAIN DISTRIBUTION_STATUS < <(
  aws cloudfront create-distribution \
    --profile "$AWS_PROFILE" \
    --distribution-config "file://$CONFIG_FILE" \
    --query 'Distribution.[Id,DomainName,Status]' \
    --output text
)

cat >>"$STATE_FILE" <<EOF
CLOUDFRONT_DISTRIBUTION_ID='$DISTRIBUTION_ID'
CLOUDFRONT_DOMAIN='$DISTRIBUTION_DOMAIN'
HTTPS_URL='https://$DISTRIBUTION_DOMAIN'
EOF

echo "Distribution: $DISTRIBUTION_ID"
echo "Status:       $DISTRIBUTION_STATUS"
echo "HTTPS API:    https://$DISTRIBUTION_DOMAIN"
echo "Waiting for CloudFront to deploy globally..."

aws cloudfront wait distribution-deployed \
  --profile "$AWS_PROFILE" \
  --id "$DISTRIBUTION_ID"

echo "CloudFront deployment is ready."
