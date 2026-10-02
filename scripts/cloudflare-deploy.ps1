# =============================================================================
# Deploy NhacCuaHoiKS len Cloudflare Workers (tranh 2 loi thuong gap):
#   1) Windows chan tao symlink (EPERM)  -> bat Developer Mode / chay Admin / dung CI.
#   2) Hyperdrive doi chuoi local khi deploy ("no local hyperdrive connection string").
#
# Cach dung:  npm run deploy:cf
#        hoac powershell -ExecutionPolicy Bypass -File scripts/cloudflare-deploy.ps1
#
# Vi sao can script nay:
#   `opennextjs-cloudflare deploy` goi getPlatformProxy voi `envFiles: []` => .dev.vars KHONG duoc nap.
#   wrangler BAT BUOC co bien CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE (hoac
#   `localConnectionString` trong wrangler.jsonc). Script nay doc DIRECT_URL tu .env (file da gitignore),
#   bo hau to "-pooler", roi gan vao bien moi truong truoc khi goi `npm run deploy`.
# =============================================================================
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$envFile = Join-Path $root ".env"
if (-not (Test-Path $envFile)) {
  throw 'Khong thay file .env. Hay chay "npm run env:write" truoc.'
}

$line = Get-Content $envFile | Where-Object { $_ -match '^\s*DIRECT_URL\s*=' } | Select-Object -First 1
if (-not $line) {
  $line = Get-Content $envFile | Where-Object { $_ -match '^\s*DATABASE_URL\s*=' } | Select-Object -First 1
}
if (-not $line) {
  throw 'Khong tim thay DIRECT_URL hoac DATABASE_URL trong .env.'
}

# Bo tien to "KEY =", bo dau ngoac kep, va bo "-pooler" (Hyperdrive can chuoi TRUC TIEP).
$url = ($line -replace '^\s*(DIRECT_URL|DATABASE_URL)\s*=\s*', '').Trim().Trim('"') -replace '-pooler', ''

$env:CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE = $url

$safe = $url -replace '(://[^:]*:)[^@]*(@)', '$1***$2'
Write-Host "[deploy:cf] Hyperdrive local: $safe" -ForegroundColor DarkGray

npm run deploy
