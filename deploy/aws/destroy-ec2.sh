#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
STATE_FILE="$ROOT_DIR/.aws-deployment.env"

if [[ ! -f "$STATE_FILE" ]]; then
  echo "No deployment state found at $STATE_FILE" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$STATE_FILE"

if [[ -n "${API_GATEWAY_ID:-}" ]]; then
  "$ROOT_DIR/deploy/aws/destroy-apigateway.sh"
  # Reload the state after the API Gateway entries are removed.
  # shellcheck disable=SC1090
  source "$STATE_FILE"
fi

if [[ -n "${CLOUDFRONT_DISTRIBUTION_ID:-}" ]]; then
  "$ROOT_DIR/deploy/aws/destroy-cloudfront.sh"
  # Reload the state after the CloudFront entries are removed.
  # shellcheck disable=SC1090
  source "$STATE_FILE"
fi

aws ec2 terminate-instances \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID" >/dev/null
aws ec2 wait instance-terminated \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --instance-ids "$INSTANCE_ID"

if [[ -n "${SSM_PARAMETER_NAME:-}" ]] && aws ssm get-parameter \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --name "$SSM_PARAMETER_NAME" >/dev/null 2>&1; then
  aws ssm delete-parameter \
    --profile "$AWS_PROFILE" \
    --region "$AWS_REGION" \
    --name "$SSM_PARAMETER_NAME"
fi

if [[ -n "${IAM_INSTANCE_PROFILE_NAME:-}" ]] && aws iam get-instance-profile \
  --profile "$AWS_PROFILE" \
  --instance-profile-name "$IAM_INSTANCE_PROFILE_NAME" >/dev/null 2>&1; then
  aws iam remove-role-from-instance-profile \
    --profile "$AWS_PROFILE" \
    --instance-profile-name "$IAM_INSTANCE_PROFILE_NAME" \
    --role-name "$IAM_ROLE_NAME"
  aws iam delete-instance-profile \
    --profile "$AWS_PROFILE" \
    --instance-profile-name "$IAM_INSTANCE_PROFILE_NAME"
fi

if [[ -n "${IAM_ROLE_NAME:-}" ]] && aws iam get-role \
  --profile "$AWS_PROFILE" \
  --role-name "$IAM_ROLE_NAME" >/dev/null 2>&1; then
  aws iam delete-role-policy \
    --profile "$AWS_PROFILE" \
    --role-name "$IAM_ROLE_NAME" \
    --policy-name DhokhaDeploymentAccess
  aws iam detach-role-policy \
    --profile "$AWS_PROFILE" \
    --role-name "$IAM_ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore
  aws iam delete-role \
    --profile "$AWS_PROFILE" \
    --role-name "$IAM_ROLE_NAME"
fi

aws s3 rm \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  "s3://$S3_BUCKET" \
  --recursive
aws s3api delete-bucket \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --bucket "$S3_BUCKET"

aws ec2 delete-security-group \
  --profile "$AWS_PROFILE" \
  --region "$AWS_REGION" \
  --group-id "$SECURITY_GROUP_ID"

rm -f "$STATE_FILE"
echo "Dhokha EC2 deployment removed."
