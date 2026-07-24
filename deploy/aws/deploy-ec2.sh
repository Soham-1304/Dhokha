#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PROFILE="${AWS_PROFILE:-bharath@rama}"
REGION="${AWS_REGION:-ap-south-1}"
INSTANCE_TYPE="${INSTANCE_TYPE:-t3.micro}"
APP_NAME="dhokha-backend"
STATE_FILE="$ROOT_DIR/.aws-deployment.env"

ACCOUNT_ID="$(aws sts get-caller-identity --profile "$PROFILE" --query Account --output text)"
BUCKET="dhokha-deploy-${ACCOUNT_ID}-${REGION}"
OBJECT_KEY="releases/backend-$(date -u +%Y%m%dT%H%M%SZ).tar.gz"
TEMP_DIR="$(mktemp -d -t dhokha-deploy.XXXXXX)"
ARCHIVE="$TEMP_DIR/backend.tar.gz"
USER_DATA="$TEMP_DIR/user-data.sh"

cleanup() {
  rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

tar \
  --exclude='backend/.pytest_cache' \
  --exclude='backend/**/__pycache__' \
  --exclude='backend/data/*.db' \
  --exclude='backend/.benchmarks' \
  -czf "$ARCHIVE" \
  -C "$ROOT_DIR" backend

if ! aws s3api head-bucket --profile "$PROFILE" --bucket "$BUCKET" >/dev/null 2>&1; then
  aws s3api create-bucket \
    --profile "$PROFILE" \
    --region "$REGION" \
    --bucket "$BUCKET" \
    --create-bucket-configuration "LocationConstraint=$REGION" >/dev/null
fi

aws s3 cp \
  --profile "$PROFILE" \
  --region "$REGION" \
  "$ARCHIVE" "s3://$BUCKET/$OBJECT_KEY" >/dev/null

ARCHIVE_URL="$(aws s3 presign \
  --profile "$PROFILE" \
  --region "$REGION" \
  --expires-in 3600 \
  "s3://$BUCKET/$OBJECT_KEY")"
ARCHIVE_URL_B64="$(printf '%s' "$ARCHIVE_URL" | base64 | tr -d '\n')"
sed "s|__ARCHIVE_URL_B64__|$ARCHIVE_URL_B64|" \
  "$ROOT_DIR/deploy/aws/ec2-user-data.sh" >"$USER_DATA"

AMI_ID="$(aws ssm get-parameter \
  --profile "$PROFILE" \
  --region "$REGION" \
  --name /aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-x86_64 \
  --query Parameter.Value \
  --output text)"
VPC_ID="$(aws ec2 describe-vpcs \
  --profile "$PROFILE" \
  --region "$REGION" \
  --filters Name=is-default,Values=true \
  --query 'Vpcs[0].VpcId' \
  --output text)"
SUBNET_ID="$(aws ec2 describe-subnets \
  --profile "$PROFILE" \
  --region "$REGION" \
  --filters "Name=vpc-id,Values=$VPC_ID" Name=map-public-ip-on-launch,Values=true \
  --query 'Subnets[0].SubnetId' \
  --output text)"

SECURITY_GROUP_ID="$(aws ec2 describe-security-groups \
  --profile "$PROFILE" \
  --region "$REGION" \
  --filters "Name=vpc-id,Values=$VPC_ID" "Name=group-name,Values=$APP_NAME" \
  --query 'SecurityGroups[0].GroupId' \
  --output text)"
if [[ "$SECURITY_GROUP_ID" == "None" ]]; then
  SECURITY_GROUP_ID="$(aws ec2 create-security-group \
    --profile "$PROFILE" \
    --region "$REGION" \
    --group-name "$APP_NAME" \
    --description "Public HTTP access to the Dhokha demo backend" \
    --vpc-id "$VPC_ID" \
    --query GroupId \
    --output text)"
fi

ensure_public_port() {
  local port="$1"
  local description="$2"
  local rule_count
  rule_count="$(aws ec2 describe-security-groups \
    --profile "$PROFILE" \
    --region "$REGION" \
    --group-ids "$SECURITY_GROUP_ID" \
    --query "length(SecurityGroups[0].IpPermissions[?IpProtocol==\`tcp\` && FromPort==\`${port}\` && ToPort==\`${port}\`])" \
    --output text)"
  if [[ "$rule_count" == "0" ]]; then
    aws ec2 authorize-security-group-ingress \
      --profile "$PROFILE" \
      --region "$REGION" \
      --group-id "$SECURITY_GROUP_ID" \
      --ip-permissions "IpProtocol=tcp,FromPort=${port},ToPort=${port},IpRanges=[{CidrIp=0.0.0.0/0,Description=\"${description}\"}]" >/dev/null
  fi
}

ensure_public_port 80 "Dhokha demo HTTP"
ensure_public_port 443 "Dhokha demo HTTPS and WSS"

INSTANCE_ID="$(aws ec2 run-instances \
  --profile "$PROFILE" \
  --region "$REGION" \
  --image-id "$AMI_ID" \
  --instance-type "$INSTANCE_TYPE" \
  --subnet-id "$SUBNET_ID" \
  --security-group-ids "$SECURITY_GROUP_ID" \
  --user-data "file://$USER_DATA" \
  --metadata-options HttpTokens=required,HttpEndpoint=enabled \
  --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=8,VolumeType=gp3,DeleteOnTermination=true,Encrypted=true}' \
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$APP_NAME},{Key=Project,Value=Dhokha}]" \
  --query 'Instances[0].InstanceId' \
  --output text)"

aws ec2 wait instance-running \
  --profile "$PROFILE" \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID"
PUBLIC_IP="$(aws ec2 describe-instances \
  --profile "$PROFILE" \
  --region "$REGION" \
  --instance-ids "$INSTANCE_ID" \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)"

cat >"$STATE_FILE" <<EOF
AWS_PROFILE='$PROFILE'
AWS_REGION='$REGION'
INSTANCE_ID='$INSTANCE_ID'
SECURITY_GROUP_ID='$SECURITY_GROUP_ID'
S3_BUCKET='$BUCKET'
S3_OBJECT_KEY='$OBJECT_KEY'
PUBLIC_URL='http://$PUBLIC_IP'
EOF

echo "Instance: $INSTANCE_ID"
echo "Backend:  http://$PUBLIC_IP"
echo "Docs:     http://$PUBLIC_IP/docs"
echo "Waiting for the model service to become healthy..."

for attempt in {1..60}; do
  if curl --silent --show-error --fail --max-time 5 "http://$PUBLIC_IP/health"; then
    echo
    echo "Dhokha backend is ready."
    exit 0
  fi
  sleep 10
done

echo "The instance is running but the health check did not become ready in time." >&2
echo "Inspect its cloud-init output with:" >&2
echo "aws ec2 get-console-output --latest --instance-id $INSTANCE_ID --profile '$PROFILE' --region '$REGION' --output text" >&2
exit 1
