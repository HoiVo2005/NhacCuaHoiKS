# setup-android-sdk.ps1 - Install the minimal Android SDK needed to build the TWA APK.
# Idempotent: safe to re-run. Requires internet (dl.google.com).
$ErrorActionPreference = 'Continue'
$ProgressPreference = 'SilentlyContinue'

$sdk = Join-Path $env:LOCALAPPDATA 'Android\Sdk'
New-Item -ItemType Directory -Force -Path $sdk | Out-Null

$sdkManager = Join-Path $sdk 'cmdline-tools\latest\bin\sdkmanager.bat'
if (-not (Test-Path $sdkManager)) {
    $zip = Join-Path $sdk 'ct.zip'
    $zipUrl = 'https://dl.google.com/android/repository/commandlinetools-win-13114758_latest.zip'
    if (-not (Test-Path $zip)) {
        Write-Output "Downloading commandline-tools (~136 MB)..."
        Invoke-WebRequest -Uri $zipUrl -OutFile $zip
    }
    $tmp = Join-Path $sdk 'ct-tmp'
    if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath $tmp -Force
    $src = Join-Path $tmp 'cmdline-tools'
    if (-not (Test-Path $src)) { $src = Join-Path $tmp 'tools' }
    $dest = Join-Path $sdk 'cmdline-tools\latest'
    if (Test-Path $dest) { Remove-Item $dest -Recurse -Force }
    New-Item -ItemType Directory -Force -Path (Join-Path $sdk 'cmdline-tools') | Out-Null
    Move-Item $src $dest
    Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue
    Write-Output 'Extracted cmdline-tools.'
}

# Bubblewrap validatePath() accepts an SDK root that contains tools/ OR bin/.
# installBuildTools() looks for tools/bin/sdkmanager.bat, so create a junction
# tools -> cmdline-tools/latest (junctions do not need admin rights).
$toolsLink = Join-Path $sdk 'tools'
if (-not (Test-Path $toolsLink)) {
    New-Item -ItemType Junction -Path $toolsLink -Target (Join-Path $sdk 'cmdline-tools\latest') | Out-Null
    Write-Output 'Created junction tools -> cmdline-tools/latest'
}

Write-Output '=== Accepting SDK licenses ==='
(1..30) | ForEach-Object { 'y' } | & $sdkManager --licenses | Select-Object -Last 3

Write-Output '=== Installing packages (platform-tools, platforms;android-36, build-tools;36.1.0) ==='
& $sdkManager 'platform-tools' 'platforms;android-36' 'build-tools;36.1.0' | Select-Object -Last 6

$btOk = Test-Path (Join-Path $sdk 'build-tools\36.1.0')
$pfOk = Test-Path (Join-Path $sdk 'platforms\android-36')
Write-Output "build-tools/36.1.0 : $btOk"
Write-Output "platforms/android-36: $pfOk"
if (-not ($btOk -and $pfOk)) {
    Write-Output 'SETUP FAILED'
    exit 1
}
Write-Output 'SETUP DONE'
