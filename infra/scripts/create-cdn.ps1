# ==============================================================================
# MaxxPixels OTT - AWS CloudFront CDN Distribution Creator
# ==============================================================================

$DomainName = "cdn.maxxpixels.com"
$S3BucketName = "maxxpixels-streaming-output"
$AwsRegion = "ap-south-2"
$OacId = "E3LHW0QLPLBVZZ"
$PriceClass = "PriceClass_200"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host "         Creating AWS CloudFront CDN for cdn.maxxpixels.com           " -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# Ensure AWS CLI in PATH
if (-not (Get-Command aws -ErrorAction SilentlyContinue)) {
    if (Test-Path "C:\Program Files\Amazon\AWSCLI\bin\aws.exe") {
        $env:PATH += ";C:\Program Files\Amazon\AWSCLI\bin"
    }
}

# 1. Generate Config
$s3OriginDomain = "$S3BucketName.s3.$AwsRegion.amazonaws.com"
$cfTempConfigPath = "$env:TEMP\create-cdn-config.json"
$callerRef = "maxxpixels-cdn-" + [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()

$cfDistributionObj = @{
    CallerReference      = $callerRef
    Aliases              = @{ Quantity = 0; Items = @() }
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
                OriginAccessControlId = $OacId
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
    ViewerCertificate    = @{
        CloudFrontDefaultCertificate = $true
        MinimumProtocolVersion       = "TLSv1.2_2021"
    }
    HttpVersion          = "http2and3"
    IsIPV6Enabled        = $true
}

$cfConfigJson = $cfDistributionObj | ConvertTo-Json -Depth 10
$cfConfigJson | Out-File -FilePath $cfTempConfigPath -Encoding ascii

Write-Host "[+] Creating CloudFront Distribution pointing to '$s3OriginDomain'..." -ForegroundColor Yellow
$cfResultRaw = aws cloudfront create-distribution --distribution-config "file://$cfTempConfigPath" --output json 2>&1
Remove-Item $cfTempConfigPath -ErrorAction SilentlyContinue

Write-Host $cfResultRaw
