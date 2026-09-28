# =============================================================================
# Script kiem tra tong the: build -> start server -> smoke test -> tat server
# Cach dung: powershell -ExecutionPolicy Bypass -File scripts/verify.ps1
# =============================================================================
$ErrorActionPreference = "Continue"

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

$verifyFile = Join-Path $root "verify.txt"
$lines = New-Object System.Collections.Generic.List[string]

function Write-Verify($text) {
  $lines.Add($text)
  Write-Host $text
}

# 1) Tat cac tien trinh node cua du an nay (neu con sot lai)
$projectNode = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like "*Nhac_cua_hoi*" }

foreach ($process in $projectNode) {
  Write-Verify "KILL_NODE=$($process.ProcessId)"
  Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
}

Start-Sleep -Seconds 2

# 2) Build production
Write-Verify "=== BUILD ==="
& npm.cmd run build *> build.log 2>&1
$buildExit = $LASTEXITCODE
Write-Verify "BUILD_EXIT=$buildExit"
Write-Verify ((Get-Content build.log -Tail 4) -join " / ")

if ($buildExit -ne 0) {
  $lines | Set-Content -Path $verifyFile -Encoding UTF8
  exit 1
}

# 3) Khoi dong server production
$server = Start-Process -FilePath "npm.cmd" -ArgumentList "start" `
  -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput "run-out.log" -RedirectStandardError "run-err.log"

Write-Verify "SERVER_PID=$($server.Id)"

# 4) Cho server san sang (thu toi da 60 giay)
$ready = $false
for ($attempt = 1; $attempt -le 20; $attempt += 1) {
  Start-Sleep -Seconds 3
  try {
    $response = Invoke-WebRequest "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -eq 200) {
      $ready = $true
      Write-Verify "SERVER_READY_AFTER_ATTEMPT=$attempt"
      break
    }
  } catch {
    # chua san sang
  }
}

Write-Verify "SERVER_READY=$ready"

# 5) Chay smoke test
if ($ready) {
  $smokeOutput = & node scripts/smoke-test.cjs 2>&1 | Out-String
  Write-Verify "=== SMOKE ==="
  Write-Verify $smokeOutput.Trim()

  # 5b) Kiem tra stream file nhac + do muot khi phat (can server dang chay)
  $perfOutput = & npx.cmd tsx scripts/verify-playback-perf.ts 2>&1 | Out-String
  Write-Verify "=== PLAYBACK PERF ==="
  Write-Verify $perfOutput.Trim()
} else {
  Write-Verify "SERVER_LOG:"
  Write-Verify ((Get-Content run-err.log -ErrorAction SilentlyContinue) -join " / ")
}

# 6) Tat server
taskkill /PID $server.Id /T /F 2>&1 | Out-Null
Write-Verify "SERVER_STOPPED=true"

$lines | Set-Content -Path $verifyFile -Encoding UTF8
