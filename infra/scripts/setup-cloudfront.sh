#!/usr/bin/env bash
# ==============================================================================
# MaxxPixels OTT - AWS CloudFront CDN Setup Script for cdn.maxxpixels.com
# ==============================================================================
# This script provisions and configures an AWS CloudFront distribution
# tailored for HLS/DASH video streaming and static asset delivery.
#
# Prerequisites:
# 1. AWS CLI installed & configured (aws configure)
# 2. ACM SSL Certificate requested in us-east-1 for cdn.maxxpixels.com (or *.maxxpixels.com)
# 3. S3 Bucket created for video output (e.g., maxxpixels-streaming-output)
# ==============================================================================

set -e

# Configuration Variables
DOMAIN_NAME="cdn.maxxpixels.com"
S3_BUCKET_NAME="${S3_STREAMING_BUCKET:-maxxpixels-streaming-output}"
AWS_REGION="${AWS_DEFAULT_REGION:-ap-south-2}"
OAC_NAME="MaxxPixels-CloudFront-S3-OAC"
PRICE_CLASS="${CLOUDFRONT_PRICE_CLASS:-PriceClass_200}"

echo "======================================================================"
echo "    MaxxPixels AWS CloudFront Setup (cdn.maxxpixels.com) - ap-south-2 "
echo "======================================================================"

# 1. Verify AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ Error: AWS CLI is not installed or not in PATH."
    echo "Please install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

echo "✅ AWS CLI detected."

# 2. Create/Verify S3 Bucket in ap-south-2
echo "🔍 Checking S3 Bucket '${S3_BUCKET_NAME}' in region '${AWS_REGION}'..."
if ! aws s3api head-bucket --bucket "${S3_BUCKET_NAME}" 2>/dev/null; then
    echo "🚀 Creating S3 Bucket '${S3_BUCKET_NAME}' in region '${AWS_REGION}'..."
    if [ "${AWS_REGION}" == "us-east-1" ]; then
        aws s3api create-bucket --bucket "${S3_BUCKET_NAME}" --region "${AWS_REGION}"
    else
        aws s3api create-bucket --bucket "${S3_BUCKET_NAME}" --region "${AWS_REGION}" --create-bucket-configuration LocationConstraint="${AWS_REGION}"
    fi
    echo "✅ Created S3 Bucket '${S3_BUCKET_NAME}' in ${AWS_REGION}."
else
    echo "✅ S3 Bucket '${S3_BUCKET_NAME}' already exists."
fi

# 3. Configure CORS on S3 Bucket
echo "🌐 Configuring S3 CORS policy for video playback..."
aws s3api put-bucket-cors --bucket "${S3_BUCKET_NAME}" --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag", "Content-Length", "Content-Type"],
      "MaxAgeSeconds": 3000
    }
  ]
}'
echo "✅ S3 CORS policy applied."

# 4. Find ACM Certificate ARN in us-east-1
echo "🔍 Searching for ACM SSL Certificate for ${DOMAIN_NAME} in us-east-1..."
CERT_ARN=$(aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='${DOMAIN_NAME}' || DomainName=='*.maxxpixels.com'].CertificateArn" --output text)

if [ -z "$CERT_ARN" ] || [ "$CERT_ARN" == "None" ]; then
    echo "⚠️ Warning: No ACM SSL Certificate found for ${DOMAIN_NAME} or *.maxxpixels.com in us-east-1!"
    echo "   CloudFront requires custom SSL certificates to be in region us-east-1."
    echo "   Request a certificate using:"
    echo "   aws acm request-certificate --domain-name ${DOMAIN_NAME} --validation-method DNS --region us-east-1"
    echo ""
    read -p "Enter existing ACM Certificate ARN (or press ENTER to use default CloudFront *.cloudfront.net certificate): " CERT_ARN
fi

# 5. Create Origin Access Control (OAC) for S3 bucket security
echo "🛡️ Creating/Verifying Origin Access Control (OAC) for S3..."
OAC_ID=$(aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='${OAC_NAME}'].Id" --output text)

if [ -z "$OAC_ID" ] || [ "$OAC_ID" == "None" ]; then
    OAC_ID=$(aws cloudfront create-origin-access-control --origin-access-control-config "{
        \"Name\": \"${OAC_NAME}\",
        \"Description\": \"OAC for MaxxPixels S3 HLS Streaming Bucket\",
        \"SigningProtocol\": \"sigv4\",
        \"SigningBehavior\": \"always\",
        \"OriginAccessControlOriginType\": \"s3\"
    }" --query "OriginAccessControl.Id" --output text)
    echo "✅ Created OAC with ID: ${OAC_ID}"
else
    echo "✅ Found existing OAC with ID: ${OAC_ID}"
fi

# 6. Generate CloudFront Distribution Config JSON
S3_ORIGIN_DOMAIN="${S3_BUCKET_NAME}.s3.${AWS_REGION}.amazonaws.com"
CONFIG_FILE="/tmp/cloudfront-config-${DOMAIN_NAME}.json"

echo "📝 Generating CloudFront Distribution Config..."

if [ -n "$CERT_ARN" ] && [ "$CERT_ARN" != "None" ]; then
    SSL_CONFIG="{
        \"ACMCertificateArn\": \"${CERT_ARN}\",
        \"SSLSupportMethod\": \"sni-only\",
        \"MinimumProtocolVersion\": \"TLSv1.2_2021\",
        \"CertificateSource\": \"acm\"
    }"
    ALIASES_CONFIG="{
        \"Quantity\": 1,
        \"Items\": [\"${DOMAIN_NAME}\"]
    }"
else
    SSL_CONFIG="{
        \"CloudFrontDefaultCertificate\": true,
        \"MinimumProtocolVersion\": \"TLSv1.2_2021\"
    }"
    ALIASES_CONFIG="{
        \"Quantity\": 0
    }"
fi

cat <<EOF > "$CONFIG_FILE"
{
  "CallerReference": "maxxpixels-cf-$(date +%s)",
  "Aliases": ${ALIASES_CONFIG},
  "DefaultRootObject": "",
  "Origins": {
    "Quantity": 1,
    "Items": [
      {
        "Id": "S3-MaxxPixels-Streaming",
        "DomainName": "${S3_ORIGIN_DOMAIN}",
        "OriginPath": "",
        "CustomHeaders": { "Quantity": 0 },
        "S3OriginConfig": {
          "OriginAccessIdentity": ""
        },
        "OriginAccessControlId": "${OAC_ID}",
        "ConnectionAttempts": 3,
        "ConnectionTimeout": 10
      }
    ]
  },
  "OriginGroups": { "Quantity": 0 },
  "DefaultCacheBehavior": {
    "TargetOriginId": "S3-MaxxPixels-Streaming",
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 3,
      "Items": ["GET", "HEAD", "OPTIONS"],
      "CachedMethods": {
        "Quantity": 2,
        "Items": ["GET", "HEAD"]
      }
    },
    "SmoothStreaming": false,
    "Compress": true,
    "LambdaFunctionAssociations": { "Quantity": 0 },
    "FunctionAssociations": { "Quantity": 0 },
    "FieldLevelEncryptionId": "",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "OriginRequestPolicyId": "88a5e910-804c-4e1a-8e93-27b3001c4600",
    "ResponseHeadersPolicyId": "5cc37139-f094-4044-8e32-25054455f704"
  },
  "CacheBehaviors": {
    "Quantity": 1,
    "Items": [
      {
        "PathPattern": "*.m3u8",
        "TargetOriginId": "S3-MaxxPixels-Streaming",
        "ViewerProtocolPolicy": "redirect-to-https",
        "AllowedMethods": {
          "Quantity": 3,
          "Items": ["GET", "HEAD", "OPTIONS"],
          "CachedMethods": {
            "Quantity": 2,
            "Items": ["GET", "HEAD"]
          }
        },
        "Compress": true,
        "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
        "OriginRequestPolicyId": "88a5e910-804c-4e1a-8e93-27b3001c4600",
        "ResponseHeadersPolicyId": "5cc37139-f094-4044-8e32-25054455f704"
      }
    ]
  },
  "CustomErrorResponses": { "Quantity": 0 },
  "Comment": "MaxxPixels OTT HLS Video CDN (cdn.maxxpixels.com)",
  "Logging": {
    "Enabled": false,
    "IncludeCookies": false,
    "Bucket": "",
    "Prefix": ""
  },
  "PriceClass": "${PRICE_CLASS}",
  "Enabled": true,
  "ViewerCertificate": ${SSL_CONFIG},
  "HttpVersion": "http2and3",
  "IsIPV6Enabled": true
}
EOF

# 5. Create CloudFront Distribution
echo "🚀 Creating CloudFront Distribution..."
CF_RESULT=$(aws cloudfront create-distribution --distribution-config file://"$CONFIG_FILE" --output json)

CF_ID=$(echo "$CF_RESULT" | jq -r '.Distribution.Id // empty')
CF_DOMAIN=$(echo "$CF_RESULT" | jq -r '.Distribution.DomainName // empty')
CF_ARN=$(echo "$CF_RESULT" | jq -r '.Distribution.ARN // empty')

if [ -z "$CF_ID" ]; then
    echo "❌ Failed to create CloudFront distribution. Output:"
    echo "$CF_RESULT"
    exit 1
fi

echo "======================================================================"
echo "✅ CloudFront Distribution Successfully Created!"
echo "----------------------------------------------------------------------"
echo "  Distribution ID  : ${CF_ID}"
echo "  CloudFront Domain: ${CF_DOMAIN}"
echo "  Custom CNAME     : ${DOMAIN_NAME}"
echo "======================================================================"

# 6. S3 Bucket Policy update instructions
echo ""
echo "📌 NEXT STEPS FOR FULL ACTIVATION:"
echo "----------------------------------------------------------------------"
echo "1. Apply S3 Bucket Policy to allow CloudFront OAC access:"
echo ""
cat <<POLICY
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowCloudFrontServicePrincipal",
      "Effect": "Allow",
      "Principal": {
        "Service": "cloudfront.amazonaws.com"
      },
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::${S3_BUCKET_NAME}/*",
      "Condition": {
        "StringEquals": {
          "AWS:SourceArn": "${CF_ARN}"
        }
      }
    }
  ]
}
POLICY
echo "----------------------------------------------------------------------"
echo "2. Add DNS Record in Cloudflare / Route 53:"
echo "   Type : CNAME"
echo "   Name : cdn"
echo "   Target: ${CF_DOMAIN}"
echo "   Proxy : DNS Only (Grey cloud) if using AWS ACM SSL certificate"
echo "----------------------------------------------------------------------"
echo "3. Production API setting is pre-configured in backend:"
echo "   OTT_CDN_DOMAIN=https://${DOMAIN_NAME}"
echo "======================================================================"
