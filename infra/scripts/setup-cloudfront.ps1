# ==============================================================================
# MaxxPixels OTT - AWS CloudFront CDN Setup Script for cdn.maxxpixels.com (PowerShell)
# ==============================================================================

$DomainName = "cdn.maxxpixels.com"
$S3BucketName = if ($env:S3_STREAMING_BUCKET) { $env:S3_STREAMING_BUCKET } else { "maxxpixels-streaming-output" }
$AwsRegion = if ($env:AWS_DEFAULT_REGION) { $env:AWS_DEFAULT_REGION } else { "ap-south-2" }
$OacName = "MaxxPixels-CloudFront-S3-OAC"
$PriceClass = if ($env:CLOUDFRONT_PRICE_CLASS) { $env:CLOUDFRONT_PRICE_CLASS } else { "PriceClass_200" }

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "      MaxxPixels AWS CloudFront Setup (cdn.maxxpixels.com) - ap-south-2" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Verify AWS CLI
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\Amazon\AWSCLI\bin\aws.exe") {
        $env:PATH += ";C:\Program Files\Amazon\AWSCLI\bin"
    }
}

$awsPath = Get-Command aws -ErrorAction SilentlyContinue
if (-not $awsPath) {
    Write-Host "Error: AWS CLI is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install AWS CLI: https://aws.amazon.com/cli/" -ForegroundColor Yellow
    exit 1
}

Write-Host "[+] AWS CLI detected at $($awsPath.Source)." -ForegroundColor Green

# 2. Create/Verify S3 Bucket in Region ap-south-2
Write-Host "[+] Checking S3 Bucket '$S3BucketName' in region '$AwsRegion'..." -ForegroundColor Yellow
$bucketCheck = aws s3api head-bucket --bucket $S3BucketName 2>&1

if ($LASTEXITCODE -ne 0) {
    Write-Host "[+] Creating S3 Bucket '$S3BucketName' in region '$AwsRegion'..." -ForegroundColor Yellow
    if ($AwsRegion -eq "us-east-1") {
        $createRes = aws s3api create-bucket --bucket $S3BucketName --region $AwsRegion 2>&1
    } else {
        $createRes = aws s3api create-bucket --bucket $S3BucketName --region $AwsRegion --create-bucket-configuration LocationConstraint=$AwsRegion 2>&1
    }
    if ($LASTEXITCODE -eq 0) {
        Write-Host "[+] S3 Bucket '$S3BucketName' created successfully in $AwsRegion!" -ForegroundColor Green
    } else {
        Write-Host "[!] Could not create S3 bucket due to AWS permissions or bucket name conflict:" -ForegroundColor Red
        Write-Host $createRes -ForegroundColor Red
    }
} else {
    Write-Host "[+] S3 Bucket '$S3BucketName' already exists." -ForegroundColor Green
}

# 3. Configure CORS on S3 Bucket for HLS Streaming
Write-Host "[+] Configuring CORS policy on S3 Bucket '$S3BucketName'..." -ForegroundColor Yellow
$corsObject = @{
    CORSRules = @(
        @{
            AllowedHeaders = @("*")
            AllowedMethods = @("GET", "HEAD")
            AllowedOrigins = @("*")
            ExposeHeaders  = @("ETag", "Content-Length", "Content-Type")
            MaxAgeSeconds  = 3000
        }
    )
}
$corsJson = $corsObject | ConvertTo-Json -Depth 5
$corsTempPath = "$env:TEMP\s3-cors-config.json"
$corsJson | Out-File -FilePath $corsTempPath -Encoding ascii
$corsRes = aws s3api put-bucket-cors --bucket $S3BucketName --cors-configuration "file://$corsTempPath" 2>&1
Remove-Item $corsTempPath -ErrorAction SilentlyContinue
if ($LASTEXITCODE -eq 0) {
    Write-Host "[+] S3 CORS Policy configured for HLS streaming." -ForegroundColor Green
} else {
    Write-Host "[!] Warning: S3 CORS policy could not be set: $corsRes" -ForegroundColor Yellow
}

# 4. Find ACM Certificate ARN in us-east-1
Write-Host "[+] Searching for ACM SSL Certificate for $DomainName in us-east-1..." -ForegroundColor Yellow
$certRaw = (aws acm list-certificates --region us-east-1 --query "CertificateSummaryList[?DomainName=='$DomainName' || DomainName=='*.maxxpixels.com'].CertificateArn" --output text 2>$null)
$certArn = if ($certRaw) { $certRaw.ToString().Trim() } else { "" }

if (-not $certArn -or $certArn -eq "None") {
    Write-Host "[!] Warning: No ACM SSL Certificate found for $DomainName or *.maxxpixels.com in us-east-1!" -ForegroundColor Yellow
    Write-Host "    CloudFront requires custom SSL certificates to be in region us-east-1."
    $certArn = Read-Host "Enter existing ACM Certificate ARN (or press ENTER to use default CloudFront *.cloudfront.net certificate)"
}

# 5. Create Origin Access Control (OAC)
Write-Host "[+] Creating/Verifying Origin Access Control (OAC)..." -ForegroundColor Yellow
$oacRaw = (aws cloudfront list-origin-access-controls --query "OriginAccessControlList.Items[?Name=='$OacName'].Id" --output text 2>$null)
$oacId = if ($oacRaw) { $oacRaw.ToString().Trim() } else { "" }

if (-not $oacId -or $oacId -eq "None") {
    $oacObject = @{
        Name                          = $OacName
        Description                   = "OAC for MaxxPixels S3 HLS Streaming Bucket"
        SigningProtocol               = "sigv4"
        SigningBehavior               = "always"
        OriginAccessControlOriginType = "s3"
    }
    $oacJson = $oacObject | ConvertTo-Json -Depth 3
    $oacTempPath = "$env:TEMP\oac-config.json"
    $oacJson | Out-File -FilePath $oacTempPath -Encoding ascii
    $oacId = (aws cloudfront create-origin-access-control --origin-access-control-config "file://$oacTempPath" --query "OriginAccessControl.Id" --output text).Trim()
    Remove-Item $oacTempPath -ErrorAction SilentlyContinue
    Write-Host "[+] Created OAC with ID: $oacId" -ForegroundColor Green
} else {
    Write-Host "[+] Found existing OAC with ID: $oacId" -ForegroundColor Green
}

# 6. Generate CloudFront Distribution Config JSON
$s3OriginDomain = "$S3BucketName.s3.$AwsRegion.amazonaws.com"
$cfTempConfigPath = "$env:TEMP\cloudfront-config-$DomainName.json"

$callerRef = "maxxpixels-cf-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$viewerCert = @{}
if ($certArn -and $certArn -ne "None") {
    $viewerCert = @{
        ACMCertificateArn      = $certArn
        SSLSupportMethod        = "sni-only"
        MinimumProtocolVersion  = "TLSv1.2_2021"
        CertificateSource       = "acm"
    }
    $aliasesObj = @{
        Quantity = 1
        Items    = @($DomainName)
    }
} else {
    $viewerCert = @{
        CloudFrontDefaultCertificate = $true
        MinimumProtocolVersion       = "TLSv1.2_2021"
    }
    $aliasesObj = @{
        Quantity = 0
        Items    = @()
    }
}

$cfDistributionObj = @{
    CallerReference      = $callerRef
    Aliases              = $aliasesObj
    DefaultRootObject    = ""
    Origins              = @{
        Quantity = 1
        Items    = @(
            @{
                Id                    = "S3-MaxxPixels-Streaming"
                DomainName            = $s3OriginDomain
                OriginPath            = ""
                CustomHeaders         = @{ Quantity = 0 }
                S3OriginConfig        = @{ OriginAccessIdentity = "" }
                OriginAccessControlId = $oacId
                ConnectionAttempts    = 3
                ConnectionTimeout     = 10
            }
        )
    }
    OriginGroups         = @{ Quantity = 0 }
    DefaultCacheBehavior = @{
        TargetOriginId       = "S3-MaxxPixels-Streaming"
        ViewerProtocolPolicy = "redirect-to-https"
        AllowedMethods       = @{
            Quantity      = 3
            Items         = @("GET", "HEAD", "OPTIONS")
            CachedMethods = @{
                Quantity = 2
                Items    = @("GET", "HEAD")
            }
        }
        SmoothStreaming      = $false
        Compress             = $true
        LambdaFunctionAssociations = @{ Quantity = 0 }
        FunctionAssociations       = @{ Quantity = 0 }
        FieldLevelEncryptionId     = ""
        CachePolicyId              = "658327ea-f89d-4fab-a63d-7e88639e58f6"
        OriginRequestPolicyId      = "88a5e910-804c-4e1a-8e93-27b3001c4600"
        ResponseHeadersPolicyId    = "5cc37139-f094-4044-8e32-25054455f704"
    }
    CacheBehaviors       = @{
        Quantity = 1
        Items    = @(
            @{
                PathPattern          = "*.m3u8"
                TargetOriginId       = "S3-MaxxPixels-Streaming"
                ViewerProtocolPolicy = "redirect-to-https"
                AllowedMethods       = @{
                    Quantity      = 3
                    Items         = @("GET", "HEAD", "OPTIONS")
                    CachedMethods = @{
                        Quantity = 2
                        Items    = @("GET", "HEAD")
                    }
                }
                Compress             = $true
                CachePolicyId        = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
                OriginRequestPolicyId = "88a5e910-804c-4e1a-8e93-27b3001c4600"
                ResponseHeadersPolicyId = "5cc37139-f094-4044-8e32-25054455f704"
            }
        )
    }
    CustomErrorResponses = @{ Quantity = 0 }
    Comment              = "MaxxPixels OTT HLS Video CDN (cdn.maxxpixels.com)"
    Logging              = @{
        Enabled        = $false
        IncludeCookies = $false
        Bucket         = ""
        Prefix         = ""
    }
    PriceClass           = $PriceClass
    Enabled              = $true
    ViewerCertificate    = $viewerCert
    HttpVersion          = "http2and3"
    IsIPV6Enabled        = $true
}

$cfConfigJson = $cfDistributionObj | ConvertTo-Json -Depth 10
$cfConfigJson | Out-File -FilePath $cfTempConfigPath -Encoding ascii

# 7. Create CloudFront Distribution
Write-Host "[+] Creating CloudFront Distribution via AWS CLI..." -ForegroundColor Yellow
$cfResultRaw = aws cloudfront create-distribution --distribution-config "file://$cfTempConfigPath" --output json
$cfResult = $cfResultRaw | ConvertFrom-Json

$cfId = $cfResult.Distribution.Id
$cfDomain = $cfResult.Distribution.DomainName
$cfArn = $cfResult.Distribution.ARN

Remove-Item $cfTempConfigPath -ErrorAction SilentlyContinue

if (-not $cfId) {
    Write-Host "Error creating CloudFront distribution." -ForegroundColor Red
    Write-Host $cfResultRaw
    exit 1
}

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "[+] CloudFront Distribution Successfully Created!" -ForegroundColor Green
Write-Host "----------------------------------------------------------------------"
Write-Host "  Distribution ID  : $cfId"
Write-Host "  CloudFront Domain: $cfDomain"
Write-Host "  Custom CNAME     : $DomainName"
Write-Host "======================================================================" -ForegroundColor Cyan

# 8. Instructions
Write-Host ""
Write-Host "NEXT STEPS FOR FULL ACTIVATION:" -ForegroundColor Yellow
Write-Host "----------------------------------------------------------------------"
Write-Host "1. Apply S3 Bucket Policy to allow CloudFront OAC access:" -ForegroundColor White

$s3PolicyObj = @{
    Version   = "2012-10-17"
    Statement = @(
        @{
            Sid       = "AllowCloudFrontServicePrincipal"
            Effect    = "Allow"
            Principal = @{ Service = "cloudfront.amazonaws.com" }
            Action    = "s3:GetObject"
            Resource  = "arn:aws:s3:::$S3BucketName/*"
            Condition = @{
                StringEquals = @{ "AWS:SourceArn" = $cfArn }
            }
        }
    )
}
$s3PolicyJson = $s3PolicyObj | ConvertTo-Json -Depth 5
Write-Host $s3PolicyJson -ForegroundColor Gray

Write-Host "----------------------------------------------------------------------"
Write-Host "2. Add DNS Record in Cloudflare / Route 53:" -ForegroundColor White
Write-Host "   Type  : CNAME"
Write-Host "   Name  : cdn"
Write-Host "   Target: $cfDomain"
Write-Host "   Proxy : DNS Only (Grey cloud) if using AWS ACM SSL certificate"
Write-Host "----------------------------------------------------------------------"
Write-Host "3. Production API setting is pre-configured in backend application.yml:" -ForegroundColor White
Write-Host "   OTT_CDN_DOMAIN=https://$DomainName"
Write-Host "======================================================================" -ForegroundColor Cyan
