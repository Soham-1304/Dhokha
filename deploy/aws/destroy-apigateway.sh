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

if [[ -z "${API_GATEWAY_ID:-}" ]]; then
  echo "No API Gateway is recorded."
  exit 0
fi

aws apigatewayv2 delete-api \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --api-id "$API_GATEWAY_ID"

TEMP_DIR="$(mktemp -d -t dhokha-api-delete.XXXXXX)"
UPDATED_STATE="$TEMP_DIR/deployment.env"
cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

grep -v '^API_GATEWAY_ID=\|^HTTPS_URL=' "$STATE_FILE" >"$UPDATED_STATE"
mv "$UPDATED_STATE" "$STATE_FILE"
echo "API Gateway removed."
