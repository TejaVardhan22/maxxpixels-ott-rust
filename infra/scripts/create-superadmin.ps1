$ErrorActionPreference = 'Stop'
$email = Read-Host 'Super admin email'
$name = Read-Host 'Full name [Super Admin]'
if (-not $name) { $name = 'Super Admin' }
$phone = Read-Host 'Phone number (optional)'
$password = Read-Host 'Super admin password' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
try {
    [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) |
        node (Join-Path $PSScriptRoot 'create-superadmin.js') $email $name $phone
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
} finally {
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
}
