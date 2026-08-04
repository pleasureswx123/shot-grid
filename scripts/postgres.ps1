param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'status'
)

$ErrorActionPreference = 'Stop'
$runtimeRoot = Join-Path $env:LOCALAPPDATA 'ShotGridLight'
$postgresRoot = Join-Path $runtimeRoot 'postgresql'
$dataRoot = Join-Path $runtimeRoot 'postgres-data'
$logPath = Join-Path $runtimeRoot 'postgres.log'
$pgCtl = Join-Path $postgresRoot 'bin\pg_ctl.exe'
$pgIsReady = Join-Path $postgresRoot 'bin\pg_isready.exe'

if (-not (Test-Path -LiteralPath $pgCtl)) {
  throw "PostgreSQL runtime is not installed at $postgresRoot"
}
if (-not (Test-Path -LiteralPath (Join-Path $dataRoot 'PG_VERSION'))) {
  throw "PostgreSQL data directory is not initialized at $dataRoot"
}

switch ($Action) {
  'start' {
    & $pgIsReady -h 127.0.0.1 -p 5432 | Out-Null
    if ($LASTEXITCODE -eq 0) {
      Write-Output 'PostgreSQL is already running on 127.0.0.1:5432.'
      exit 0
    }

    & $pgCtl -D $dataRoot -l $logPath -o '-h 127.0.0.1 -p 5432' -w start
    if ($LASTEXITCODE -ne 0) {
      throw "PostgreSQL failed to start. Check $logPath"
    }
    Write-Output 'PostgreSQL started on 127.0.0.1:5432.'
  }
  'stop' {
    & $pgIsReady -h 127.0.0.1 -p 5432 | Out-Null
    if ($LASTEXITCODE -ne 0) {
      Write-Output 'PostgreSQL is already stopped.'
      exit 0
    }

    & $pgCtl -D $dataRoot -m fast -w stop
    if ($LASTEXITCODE -ne 0) {
      throw 'PostgreSQL failed to stop.'
    }
    Write-Output 'PostgreSQL stopped.'
  }
  'status' {
    & $pgIsReady -h 127.0.0.1 -p 5432
    if ($LASTEXITCODE -ne 0) {
      exit 1
    }
  }
}
