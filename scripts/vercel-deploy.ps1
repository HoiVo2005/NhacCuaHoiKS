# =============================================================================
# Deploy NhacCuaHoiKS len Vercel (sau khi da dang nhap: npx vercel login).
# -----------------------------------------------------------------------------
# Script nay:
#   1) Doc .env (DATABASE_URL, DIRECT_URL, AUTH_SECRET...) - file da gitignore
#   2) Tao/lien ket project Vercel va nap tat ca bien moi truong
#   3) Deploy ban production (--prod)
#
# Cach dung: powershell -ExecutionPolicy Bypass -File scripts/vercel-deploy.ps1
# =============================================================================
$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path))

function Read-EnvValue([string]$key) {
  $line = Get-Content ".env" | Where-Object { $_ -match "^\s*$key\s*=" } | Select-Object -First 1
  if (-not $line) { return $null }
  return ($line -split "=", 2)[1].Trim().Trim([char]34)
}

# Storage doc tu .env (mac dinh "local"). TREN VERCEL serverless PHAI dat "s3" + dien S3_*
# (local se loi EROFS -> API tra "Loi he thong, vui long thu lai sau" khi upload file).
$storageDriver = Read-EnvValue "STORAGE_DRIVER"
if ([string]::IsNullOrWhiteSpace($storageDriver)) { $storageDriver = "local" }

# Cac bien se nap len Vercel (key -> value)
$vars = [ordered]@{
  "DATABASE_URL"           = Read-EnvValue "DATABASE_URL"
  "DIRECT_URL"             = Read-EnvValue "DIRECT_URL"
  "AUTH_SECRET"            = Read-EnvValue "AUTH_SECRET"
  "AUTH_URL"               = "https://nhaccuahoiks.vercel.app"
  "AUTH_TRUST_HOST"        = "true"
  "AUTH_USE_SECURE_COOKIES"= "true"
  "NEXT_PUBLIC_APP_NAME"   = "NhacCuaHoiKS"
  # STORAGE_DRIVER lay tu .env (mac dinh local) - xem ghi chu o tren
  "STORAGE_DRIVER"         = $storageDriver
  "STORAGE_LOCAL_DIR"      = ".data/uploads"
  "STORAGE_PUBLIC_PREFIX"  = "/api/files"
  # 10 MB theo yeu cau - NHUNG Vercel van chan request > ~4.5 MB truoc khi app chay (xem HUONG-DAN-DEPLOY-VERCEL.md)
  "UPLOAD_MAX_BYTES"       = "10485760"
  "METADATA_TIMEOUT_MS"    = "8000"
}

# STORAGE_DRIVER=s3 -> bat buoc day du thong tin S3/R2 (thieu se bi vong validation duoi chan ro rang)
if ($storageDriver -eq "s3") {
  foreach ($key in @("S3_BUCKET", "S3_ACCESS_KEY_ID", "S3_SECRET_ACCESS_KEY")) {
    $vars[$key] = Read-EnvValue $key
  }
  # Cac bien tuy chon (chi nap khi co gia tri): endpoint R2/MinIO, region, URL public phat nhac
  foreach ($key in @("S3_ENDPOINT", "S3_REGION", "S3_PUBLIC_BASE_URL")) {
    $value = Read-EnvValue $key
    if (-not [string]::IsNullOrWhiteSpace($value)) { $vars[$key] = $value }
  }
}

foreach ($k in $vars.Keys) {
  if ([string]::IsNullOrWhiteSpace($vars[$k])) { throw "Thieu gia tri cho $k trong .env" }
}

Write-Host "[vercel] Lien ket project..." -ForegroundColor Cyan
npx vercel link --yes --project nhaccuahoiks

$envs = @("production", "preview", "development")
foreach ($k in $vars.Keys) {
  foreach ($e in $envs) {
    # Xoa ban cu (neu co) de tranh loi "already exists"
    cmd /c "npx vercel env rm $k $e --yes >nul 2>&1"
    $vars[$k] | cmd /c "npx vercel env add $k $e >nul 2>&1"
  }
  Write-Host "  + da nap $k" -ForegroundColor DarkGray
}

Write-Host "[vercel] Deploy production..." -ForegroundColor Cyan
npx vercel --prod --yes