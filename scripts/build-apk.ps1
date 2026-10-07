# build-apk.ps1 - Wrap the deployed web app into an installable Android APK
# (Trusted Web Activity) using Bubblewrap, driven non-interactively.
#
# Usage:
#   powershell -File scripts\build-apk.ps1 -Command init    # one-time project generation
#   powershell -File scripts\build-apk.ps1 -Command build   # build + sign the APK
#
# Output: %LOCALAPPDATA%\NhacCuaHoiKS\twa\app-release-signed.apk
#
# NOTE: the project MUST live in an ASCII-only path - Java keytool fails with
# "Bad pathname" on paths containing Vietnamese characters (e.g. "DU A...").
#
# Requires: @bubblewrap/cli (npm i -g), ~/.bubblewrap/config.json, Android SDK
# (scripts\setup-android-sdk.ps1), JDK 17+.
param(
    [Parameter(Mandatory = $true)][ValidateSet('init', 'build')][string]$Command,
    [string]$WorkDir = (Join-Path $env:LOCALAPPDATA 'NhacCuaHoiKS\twa'),
    [string]$Manifest = 'https://nhaccuahoiks.onrender.com/manifest.webmanifest',
    [string]$StorePass = 'nhaccuahoiks2026',
    [int]$TimeoutMinutes = 30
)
$ErrorActionPreference = 'Continue'
New-Item -ItemType Directory -Force -Path $WorkDir | Out-Null
$logFile = Join-Path $WorkDir ("build-" + $Command + ".log")

# Each rule matches one interactive prompt and supplies the answer.
# Empty answer = accept the prompt default (Enter). Rules fire once, in order.
$rules = @(
    @{ re = '\?\s*Domain:'; ans = '' }
    @{ re = '\?\s*URL path:'; ans = '' }
    @{ re = '\?\s*Application name:'; ans = '' }
    @{ re = '\?\s*Short name:'; ans = '' }
    @{ re = '\?\s*Application ID:'; ans = 'com.hoivo.nhaccuahoiks' }
    @{ re = '\?\s*Starting version code'; ans = '' }
    @{ re = '\?\s*Display mode:'; ans = '' }
    @{ re = '\?\s*Orientation:'; ans = '' }
    @{ re = '\?\s*Status bar color:'; ans = '' }
    @{ re = '\?\s*Splash screen color:'; ans = '' }
    @{ re = '\?\s*Icon URL:'; ans = 'https://nhaccuahoiks.onrender.com/icon-192.png' }
    @{ re = '\?\s*Maskable icon URL:'; ans = '' }
    @{ re = '\?\s*Monochrome icon URL:'; ans = '' }
    @{ re = '\?\s*Include support for Play Billing\?'; ans = '' }
    @{ re = '\?\s*Request geolocation permission\?'; ans = '' }
    @{ re = '\?\s*Key store location:'; ans = '' }
    @{ re = '\?\s*Key name:'; ans = '' }
    @{ re = '\?\s*Do you want to create one now\?'; ans = '' }
    @{ re = '\?\s*First and Last names'; ans = 'NhacCuaHoiKS' }
    @{ re = '\?\s*Organizational Unit'; ans = 'Dev' }
    @{ re = '\?\s*Organization \('; ans = 'HoiVo' }
    @{ re = '\?\s*Country \(2 letter code\)'; ans = 'VN' }
    @{ re = '\?\s*Password for the Key Store:'; ans = $StorePass }
    @{ re = '\?\s*Password for the Key:'; ans = $StorePass }
    @{ re = 'Accept\? \(y/N\)'; ans = 'y' }
    @{ re = 'Would you like to apply them to the project'; ans = '' }
    @{ re = 'would you like to regenerate your project'; ans = '' }
)
foreach ($r in $rules) { $r.done = $false }

$bwArgs = if ($Command -eq 'init') { 'init --manifest "' + $Manifest + '"' } else { 'build' }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "$env:windir\System32\cmd.exe"
$psi.Arguments = "/c bubblewrap " + $bwArgs
$psi.WorkingDirectory = $WorkDir
$psi.UseShellExecute = $false
$psi.RedirectStandardInput = $true
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.CreateNoWindow = $true

$p = [System.Diagnostics.Process]::Start($psi)

# Inquirer writes prompts WITHOUT a trailing newline, so line-based event
# reading never fires and would deadlock. Read raw bytes from stdout instead;
# match prompts against the incomplete tail as soon as it appears.
$enc = New-Object System.Text.UTF8Encoding($false)
$stdoutBuf = New-Object byte[] 16384
$readTask = $null
$pending = ''

# stderr messages (warnings etc.) are newline-terminated: event reading is fine.
$global:bwq = [System.Collections.Queue]::Synchronized((New-Object System.Collections.Queue))
$act = { if ($null -ne $EventArgs.Data) { [void]$global:bwq.Enqueue($EventArgs.Data) } }
Register-ObjectEvent -InputObject $p -EventName ErrorDataReceived -Action $act | Out-Null
$p.BeginErrorReadLine()

function Strip-Ansi([string]$s) {
    return ($s -replace "`e\[[0-9;?]*[ -/]*[@-~]", '' -replace "`r", '')
}
function Invoke-Answer($r) {
    $r.done = $true
    try {
        $p.StandardInput.WriteLine($r.ans)
        $p.StandardInput.Flush()
    } catch { }
    $msg = ">>> ANSWER [" + $r.re + "] => '" + $r.ans + "'"
    Add-Content -Path $logFile -Value $msg
    Write-Output $msg
}
function Invoke-Line([string]$plain) {
    if ($plain.Trim().Length -eq 0) { return }
    Add-Content -Path $logFile -Value $plain
    Write-Output $plain
    foreach ($r in $rules) {
        if (-not $r.done -and $plain -match $r.re) {
            Invoke-Answer $r
            break
        }
    }
}

Set-Content -Path $logFile -Value ("=== bubblewrap " + $bwArgs + " @ " + (Get-Date -Format s) + " ===")
$deadline = (Get-Date).AddMinutes($TimeoutMinutes)

while (-not $p.HasExited -and (Get-Date) -lt $deadline) {
    if ($null -ne $readTask -and $readTask.IsCompleted) {
        $n = $readTask.Result
        if ($n -gt 0) { $pending += $enc.GetString($stdoutBuf, 0, $n) }
        $readTask = $null
    }
    if ($null -eq $readTask) {
        $readTask = $p.StandardOutput.BaseStream.ReadAsync($stdoutBuf, 0, $stdoutBuf.Length)
    }
    # Process complete lines (\n-terminated).
    $nlIdx = $pending.IndexOf("`n")
    while ($nlIdx -ge 0) {
        $line = Strip-Ansi $pending.Substring(0, $nlIdx)
        $pending = $pending.Substring($nlIdx + 1)
        Invoke-Line $line
        $nlIdx = $pending.IndexOf("`n")
    }
    # Match prompts sitting in the incomplete tail (prompt has no newline).
    $tail = Strip-Ansi $pending
    foreach ($r in $rules) {
        if (-not $r.done -and $tail -match $r.re) {
            Invoke-Answer $r
            break
        }
    }
    while ($global:bwq.Count -gt 0) {
        $errLine = Strip-Ansi ([string]$global:bwq.Dequeue())
        if ($errLine.Trim().Length -gt 0) {
            Add-Content -Path $logFile -Value ("[stderr] " + $errLine)
            Write-Output ("[stderr] " + $errLine)
        }
    }
    if ($pending.Length -lt 4096) { Start-Sleep -Milliseconds 100 }
}

$timedOut = (Get-Date) -ge $deadline
if ($timedOut) {
    try { $p.Kill() } catch { }
    Write-Output ("TIMEOUT after " + $TimeoutMinutes + " minutes")
    Add-Content -Path $logFile -Value 'TIMEOUT'
}
Start-Sleep -Milliseconds 800
# Final drain.
if ($null -ne $readTask) {
    try {
        if ($readTask.Wait(1000)) {
            $n = $readTask.Result
            if ($n -gt 0) { $pending += $enc.GetString($stdoutBuf, 0, $n) }
        }
    } catch { }
}
foreach ($seg in ($pending -split "`n")) {
    $line = Strip-Ansi $seg
    if ($line.Trim().Length -gt 0) {
        Add-Content -Path $logFile -Value $line
        Write-Output $line
    }
}
while ($global:bwq.Count -gt 0) {
    $errLine = Strip-Ansi ([string]$global:bwq.Dequeue())
    if ($errLine.Trim().Length -gt 0) {
        Add-Content -Path $logFile -Value ("[stderr] " + $errLine)
        Write-Output ("[stderr] " + $errLine)
    }
}
$code = -1
try { $code = $p.ExitCode } catch { }
Write-Output ("=== exit code: " + $code + " (log: " + $logFile + ") ===")
exit $code
