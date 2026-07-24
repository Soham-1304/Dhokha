#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$ROOT_DIR/.aws-deployment.env"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "Deployment state was not found at $STATE_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$STATE_FILE"

if [[ -z "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  echo "No CloudFront distribution is recorded."
  exit 0
fi

TEMP_DIR="$(mktemp -d -t dhokha-cloudfront-delete.XXXXXX)"
CONFIG_FILE="$TEMP_DIR/distribution.json"
UPDATED_STATE="$TEMP_DIR/deployment.env"
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

ETAG="$(aws cloudfront get-distribution-config \
  --profile "$AWS_PROFILE" \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --query ETag \
  --output text)"
aws cloudfront get-distribution-config \
  --profile "$AWS_PROFILE" \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --query DistributionConfig \
  --output json >"$CONFIG_FILE"

sed 's/"Enabled": true/"Enabled": false/' "$CONFIG_FILE" >"$TEMP_DIR/disabled.json"
aws cloudfront update-distribution \
  --profile "$AWS_PROFILE" \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config "file://$TEMP_DIR/disabled.json" >/dev/null

echo "Waiting for CloudFront to disable..."
aws cloudfront wait distribution-deployed \
  --profile "$AWS_PROFILE" \
  --id "$CLOUDFRONT_DISTRIBUTION_ID"

ETAG="$(aws cloudfront get-distribution-config \
  --profile "$AWS_PROFILE" \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --query ETag \
  --output text)"
aws cloudfront delete-distribution \
  --profile "$AWS_PROFILE" \
  --id "$CLOUDFRONT_DISTRIBUTION_ID" \
  --if-match "$ETAG"

grep -v '^CLOUDFRONT_\|^HTTPS_URL=' "$STATE_FILE" >"$UPDATED_STATE"
mv "$UPDATED_STATE" "$STATE_FILE"
echo "CloudFront distribution removed."
