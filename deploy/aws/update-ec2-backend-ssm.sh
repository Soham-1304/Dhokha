#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/.aws-deployment.env"

TEMP_DIR="$(mktemp -d -t dhokha-ssm-update.XXXXXX)"
ARCHIVE="$TEMP_DIR/backend.tar.gz"
PARAMETERS="$TEMP_DIR/parameters.json"
OBJECT_KEY="releases/backend-update-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"

cleanup() {
  aws s3 rm \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    "s3://$S3_BUCKET/$OBJECT_KEY" >/dev/null 2>&1 || true
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

COPYFILE_DISABLE=1 tar \
  --exclude='backend/.venv' \
  --exclude='backend/.pytest_cache' \
  --exclude='backend/**/__pycache__' \
  --exclude='backend/data/*.db' \
  --exclude='backend/.benchmarks' \
  -czf "$ARCHIVE" \
  -C "$ROOT_DIR" backend

aws s3 cp \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  "$ARCHIVE" "s3://$S3_BUCKET/$OBJECT_KEY" >/dev/null

ARCHIVE_URL="$(aws s3 presign \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --expires-in 900 \
  "s3://$S3_BUCKET/$OBJECT_KEY")"
ARCHIVE_URL_B64="$(printf '%s' "$ARCHIVE_URL" | base64 | tr -d '\n')"

python3 - "$PARAMETERS" "$ARCHIVE_URL_B64" <<'PY'
import json
import sys

output_path, archive_url_b64 = sys.argv[1:]
command = f"""
set -e
printf '%s' '{archive_url_b64}' | base64 --decode > /tmp/dhokha-release-url
curl --fail --silent --show-error --location "$(cat /tmp/dhokha-release-url)" --output /tmp/dhokha-backend.tar.gz
rm -f /tmp/dhokha-release-url
sudo systemctl stop dhokha
sudo tar --extract --gzip --file /tmp/dhokha-backend.tar.gz --directory /opt/dhokha
sudo /opt/dhokha/venv/bin/pip install --quiet --requirement /opt/dhokha/backend/requirements.txt
sudo chown -R dhokha:dhokha /opt/dhokha/backend
sudo systemctl restart dhokha
curl --retry 20 --retry-delay 2 --retry-connrefused --fail --silent --show-error http://127.0.0.1:8000/health
"""
with open(output_path, "w", encoding="utf-8") as destination:
    json.dump({"commands": [command]}, destination)
PY

COMMAND_ID="$(aws ssm send-command \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --document-name AWS-RunShellScript \
  --comment "Update Dhokha backend" \
  --parameters "file://$PARAMETERS" \
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
  --query '{Status:Status,Output:StandardOutputContent,Error:StandardErrorContent}' \
  --output json
