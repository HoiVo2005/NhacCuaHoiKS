# =============================================================================
# Sinh file WAV demo (nhac khong loi) de thu nghiem tinh nang "File tai len".
# Cach dung:  powershell -ExecutionPolicy Bypass -File scripts/generate-demo-audio.ps1
# =============================================================================
param(
  [string]$OutFile = "public/demo/nhaccuahoiks-demo.wav",
  [int]$SampleRate = 16000,
  [double]$DurationSeconds = 15
)

$ErrorActionPreference = "Stop"

$bitsPerSample = 16
$channels = 1
$numSamples = [int]($SampleRate * $DurationSeconds)
$dataSize = $numSamples * $channels * ($bitsPerSample / 8)

# Am giai ngu sac (A minor pentatonic) + bass drone
$melody = @(440.00, 523.25, 587.33, 659.25, 783.99, 659.25, 587.33, 523.25)
$bass = @(110.00, 110.00, 146.83, 146.83, 164.81, 164.81, 130.81, 130.81)
$noteDuration = $DurationSeconds / 8.0

$buffer = New-Object byte[] $dataSize

for ($i = 0; $i -lt $numSamples; $i++) {
  $t = $i / [double]$SampleRate
  $noteIndex = [int][Math]::Floor($t / $noteDuration)

  if ($noteIndex -gt 7) { $noteIndex = 7 }

  $localT = $t - ($noteIndex * $noteDuration)

  # Envelope: attack 15ms, decay nhe, release cuoi not
  $attack = [Math]::Min(1.0, $localT / 0.015)
  $release = [Math]::Min(1.0, ($noteDuration - $localT) / 0.25)
  $envelope = $attack * $release

  $leadFreq = $melody[$noteIndex]
  $bassFreq = $bass[$noteIndex]

  $lead = 0.32 * [Math]::Sin(2 * [Math]::PI * $leadFreq * $t)
  $lead += 0.10 * [Math]::Sin(2 * [Math]::PI * $leadFreq * 2 * $t)
  $pad = 0.22 * [Math]::Sin(2 * [Math]::PI * $bassFreq * $t)
  $pad += 0.08 * [Math]::Sin(2 * [Math]::PI * $bassFreq * 1.5 * $t)

  # Fade in / fade out toan bai
  $fadeIn = [Math]::Min(1.0, $t / 0.6)
  $fadeOut = [Math]::Min(1.0, ($DurationSeconds - $t) / 1.5)

  $value = ($lead * $envelope) + $pad
  $value = $value * $fadeIn * $fadeOut * 0.85

  $sample = [int16]([Math]::Max(-32000, [Math]::Min(32000, $value * 32000)))
  $bytes = [BitConverter]::GetBytes($sample)
  $buffer[$i * 2] = $bytes[0]
  $buffer[$i * 2 + 1] = $bytes[1]
}

$directory = Split-Path -Parent $OutFile
if ($directory -and -not (Test-Path $directory)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}

$stream = [System.IO.File]::Create($OutFile)
$writer = New-Object System.IO.BinaryWriter($stream)

$ascii = [System.Text.Encoding]::ASCII
$writer.Write($ascii.GetBytes("RIFF"))
$writer.Write([int32](36 + $dataSize))
$writer.Write($ascii.GetBytes("WAVE"))
$writer.Write($ascii.GetBytes("fmt "))
$writer.Write([int32]16)
$writer.Write([int16]1)
$writer.Write([int16]$channels)
$writer.Write([int32]$SampleRate)
$writer.Write([int32]($SampleRate * $channels * ($bitsPerSample / 8)))
$writer.Write([int16]($channels * ($bitsPerSample / 8)))
$writer.Write([int16]$bitsPerSample)
$writer.Write($ascii.GetBytes("data"))
$writer.Write([int32]$dataSize)
$writer.Write($buffer)

$writer.Flush()
$writer.Close()
$stream.Close()

Write-Host "Da tao file demo: $OutFile ($([Math]::Round((Get-Item $OutFile).Length / 1KB, 1)) KB, ${DurationSeconds}s)"
