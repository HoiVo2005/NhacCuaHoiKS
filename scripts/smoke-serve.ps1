# Khoi dong server production (khong build lai) va chay smoke test.
# powershell -ExecutionPolicy Bypass -File scripts/smoke-serve.ps1
$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $root

Remove-Item "smoke-final.txt" -ErrorAction SilentlyContinue

$server = Start-Process -FilePath "npm.cmd" -ArgumentList "start" `
  -PassThru -WindowStyle Hidden `
  -RedirectStandardOutput "run-out.log" -RedirectStandardError "run-err.log"

$ready = $false
for ($attempt = 1; $attempt -le 20; $attempt += 1) {
  Start-Sleep -Seconds 3
  try {
    if ((Invoke-WebRequest "http://localhost:3000/api/health" -UseBasicParsing -TimeoutSec 5).StatusCode -eq 200) {
      $ready = $true
      break
    }
  } catch {
    # chua san sang
  }
}

$output = "SERVER_READY=$ready"

if ($ready) {
  $output += "`n" + (& node scripts/smoke-test.cjs 2>&1 | Out-String)
} else {
  $output += "`nSERVER_ERROR=" + ((Get-Content run-err.log -ErrorAction SilentlyContinue) -join " / ")
}

taskkill /PID $server.Id /T /F 2>&1 | Out-Null
$output | Set-Content -Path "smoke-final.txt" -Encoding UTF8
