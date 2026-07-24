#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck disable=SC1091
source "$ROOT_DIR/.aws-deployment.env"

API_KEY_CSV="${BEDROCK_API_KEY_CSV:-${1:-}}"
if [[ -z "$API_KEY_CSV" || ! -f "$API_KEY_CSV" ]]; then
  echo "Usage: BEDROCK_API_KEY_CSV=/path/to/key.csv $0" >&2
  exit 1
fi

CLIENT_IP="${CLIENT_IP:-$(curl --silent --show-error --fail https://checkip.amazonaws.com | tr -d '[:space:]')}"
HOST="${PUBLIC_URL#http://}"
TEMP_DIR="$(mktemp -d -t dhokha-gemma-update.XXXXXX)"
KEY_PATH="$TEMP_DIR/ec2-connect"
ARCHIVE="$TEMP_DIR/backend.tar.gz"
CONTROL_PATH="$TEMP_DIR/ssh-control"
SSH_RULE_ADDED=false
SSH_MASTER_STARTED=false

cleanup() {
  if [[ "$SSH_MASTER_STARTED" == true ]]; then
    ssh -o ControlPath="$CONTROL_PATH" -O exit "ec2-user@$HOST" >/dev/null 2>&1 || true
  fi
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

python3 - "$API_KEY_CSV" <<'PY'
import csv
import sys

with open(sys.argv[1], newline="") as source:
    rows = list(csv.DictReader(source))
if len(rows) != 1 or not rows[0].get("API key"):
    raise SystemExit("The CSV must contain exactly one non-empty 'API key' value")
if "\n" in rows[0]["API key"] or "\r" in rows[0]["API key"]:
    raise SystemExit("The API key contains an invalid newline")
PY

tar \
  --exclude='backend/.venv' \
  --exclude='backend/.pytest_cache' \
  --exclude='backend/**/__pycache__' \
  --exclude='backend/data/*.db' \
  --exclude='backend/.benchmarks' \
  -czf "$ARCHIVE" \
  -C "$ROOT_DIR" backend

AVAILABILITY_ZONE="$(aws ec2 describe-instances \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].Placement.AvailabilityZone' \
  --output text)"

if aws ec2 authorize-security-group-ingress \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --group-id "$SECURITY_GROUP_ID" \
  --protocol tcp \
  --port 22 \
  --cidr "$CLIENT_IP/32" >/dev/null 2>&1; then
  SSH_RULE_ADDED=true
fi

ssh-keygen -q -t ed25519 -N '' -f "$KEY_PATH"
aws ec2-instance-connect send-ssh-public-key \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-id "$INSTANCE_ID" \
  --availability-zone "$AVAILABILITY_ZONE" \
  --instance-os-user ec2-user \
  --ssh-public-key "file://$KEY_PATH.pub" >/dev/null

SSH_OPTIONS=(
  -i "$KEY_PATH"
  -o BatchMode=yes
  -o ConnectTimeout=10
  -o StrictHostKeyChecking=accept-new
  -o UserKnownHostsFile="$TEMP_DIR/known_hosts"
  -o ControlMaster=auto
  -o ControlPersist=120
  -o ControlPath="$CONTROL_PATH"
)

ssh "${SSH_OPTIONS[@]}" -MNf "ec2-user@$HOST"
SSH_MASTER_STARTED=true

scp "${SSH_OPTIONS[@]}" "$ARCHIVE" "ec2-user@$HOST:/tmp/dhokha-backend.tar.gz"

python3 - "$API_KEY_CSV" <<'PY' |
import base64
import csv
import sys

with open(sys.argv[1], newline="") as source:
    key = next(csv.DictReader(source))["API key"]
environment = "\n".join(
    (
        "BEDROCK_ENABLED=true",
        f"BEDROCK_API_KEY={key}",
        "BEDROCK_REGION=ap-south-1",
        "BEDROCK_BASE_URL=https://bedrock-mantle.ap-south-1.api.aws/v1",
        "BEDROCK_MODEL_ID=google.gemma-3-4b-it",
        "BEDROCK_CONNECT_TIMEOUT=1.0",
        "BEDROCK_READ_TIMEOUT=4.0",
        "BEDROCK_MAX_TOKENS=160",
        "",
    )
)
sys.stdout.write(base64.b64encode(environment.encode()).decode())
PY
ssh "${SSH_OPTIONS[@]}" "ec2-user@$HOST" \
  'base64 --decode | sudo tee /etc/dhokha.env >/dev/null && sudo chmod 600 /etc/dhokha.env && sudo chown root:root /etc/dhokha.env'

ssh "${SSH_OPTIONS[@]}" "ec2-user@$HOST" '
  set -e
  sudo systemctl stop dhokha
  sudo tar --extract --gzip --file /tmp/dhokha-backend.tar.gz --directory /opt/dhokha
  sudo /opt/dhokha/venv/bin/pip install --quiet --requirement /opt/dhokha/backend/requirements.txt
  sudo chown -R dhokha:dhokha /opt/dhokha/backend
  sudo mkdir -p /etc/systemd/system/dhokha.service.d
  printf "[Service]\nEnvironmentFile=/etc/dhokha.env\n" |
    sudo tee /etc/systemd/system/dhokha.service.d/gemma.conf >/dev/null
  sudo systemctl daemon-reload
  sudo systemctl restart dhokha
  curl --retry 20 --retry-delay 2 --retry-connrefused --fail --silent --show-error http://127.0.0.1:8000/health
'

echo
echo "Gemma API fallback deployed. Temporary SSH access was removed."
