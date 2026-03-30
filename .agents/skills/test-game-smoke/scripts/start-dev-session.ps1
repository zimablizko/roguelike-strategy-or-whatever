param(
  [string]$ServerHost = 'localhost',
  [int]$Port = 3000,
  [switch]$OpenBrowser
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillDir = Split-Path -Parent $scriptDir
$repoRoot = (Resolve-Path (Join-Path $skillDir '..\..\..')).Path
$artifactsDir = Join-Path $skillDir 'artifacts'
$stdoutLog = Join-Path $artifactsDir ("vite.$Port.stdout.log")
$stderrLog = Join-Path $artifactsDir ("vite.$Port.stderr.log")
$url = "http://${ServerHost}:$Port/"

New-Item -ItemType Directory -Force -Path $artifactsDir | Out-Null

function Test-DevServer {
  param([string]$ProbeUrl)

  try {
    $response = Invoke-WebRequest -Uri $ProbeUrl -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

$listener = Get-NetTCPConnection -State Listen -LocalPort $Port -ErrorAction SilentlyContinue |
  Select-Object -First 1
$startedPid = $null

if (-not $listener) {
  Remove-Item -LiteralPath $stdoutLog -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $stderrLog -ErrorAction SilentlyContinue

  $startedProcess = Start-Process `
    -FilePath 'C:\WINDOWS\System32\WindowsPowerShell\v1.0\powershell.exe' `
    -ArgumentList @(
      '-NoProfile',
      '-Command',
      "npm.cmd run dev -- --host $ServerHost --port $Port"
    ) `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru `
    -WindowStyle Hidden

  $startedPid = $startedProcess.Id
}

$deadline = (Get-Date).AddSeconds(20)
$ready = $false

while ((Get-Date) -lt $deadline) {
  if (Test-DevServer -ProbeUrl $url) {
    $ready = $true
    break
  }

  Start-Sleep -Milliseconds 500
}

if (-not $ready) {
  Write-Error "The dev server did not become ready at $url within 20 seconds. Check $stdoutLog and $stderrLog."
  exit 1
}

if ($OpenBrowser) {
  Start-Process $url | Out-Null
}

[pscustomobject]@{
  url = $url
  port = $Port
  startedPid = $startedPid
  stdoutLog = $stdoutLog
  stderrLog = $stderrLog
  repoRoot = $repoRoot
} | ConvertTo-Json
