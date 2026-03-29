param(
  [Parameter(Mandatory = $true)]
  [string]$TaskNameFile,

  [Parameter(Mandatory = $true)]
  [string]$CaddyPhpJsonFile,

  [Parameter(Mandatory = $true)]
  [string]$WatchdogTemplate,

  [Parameter(Mandatory = $true)]
  [string]$WatchdogOut,

  [Parameter(Mandatory = $true)]
  [string]$BaseDir,

  [Parameter(Mandatory = $true)]
  [string]$WorkingDir,

  [int]$IntervalSeconds = 5
)

$ErrorActionPreference = 'Stop'

function Write-JsonAndExit([hashtable]$obj, [int]$code) {
  try {
    [Console]::Out.WriteLine(
      ([pscustomobject]$obj | ConvertTo-Json -Compress -Depth 10)
    )
  } catch {
    [Console]::Out.WriteLine(
      '{"allOk":false,"error":"json serialization failed"}'
    )
  }
  exit $code
}

function Add-Step($steps, [string]$name, [bool]$ok, [string]$msg = '') {
  $steps.Add([pscustomobject]@{
    step = $name
    ok   = $ok
    msg  = $msg
  }) | Out-Null
}

function Get-JsonPortOrDefault {
  param(
    [Parameter(Mandatory = $true)][string]$Path,
    [Parameter(Mandatory = $true)][string[]]$Names,
    [Parameter(Mandatory = $true)][int]$DefaultValue
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    return $DefaultValue
  }

  try {
    $json = Get-Content -LiteralPath $Path -Raw | ConvertFrom-Json
  } catch {
    throw "JSON konnte nicht gelesen werden: $Path ($($_.Exception.Message))"
  }

  foreach ($name in $Names) {
    $prop = $json.PSObject.Properties | Where-Object { $_.Name -ieq $name } | Select-Object -First 1
    if ($null -ne $prop -and $null -ne $prop.Value) {
      $parsed = 0
      if ([int]::TryParse(([string]$prop.Value).Trim(), [ref]$parsed) -and $parsed -ge 1 -and $parsed -le 65535) {
        return $parsed
      }
    }
  }

  return $DefaultValue
}

try {
  Import-Module ScheduledTasks -ErrorAction Stop

  $steps = New-Object 'System.Collections.Generic.List[object]'

  if (-not (Test-Path -LiteralPath $TaskNameFile)) {
    Write-JsonAndExit @{
      allOk = $false
      error = 'watchdog_taskname.txt missing'
      path  = $TaskNameFile
    } 2
  }

  $raw = (Get-Content -LiteralPath $TaskNameFile -Raw).Trim()
  if ([string]::IsNullOrWhiteSpace($raw)) {
    Write-JsonAndExit @{
      allOk = $false
      error = 'TaskName leer in watchdog_taskname.txt'
    } 2
  }

  $taskPath = '\'
  $taskNameOnly = $raw.TrimStart('\')

  if ($raw.StartsWith('\')) {
    $idx = $raw.LastIndexOf('\')
    if ($idx -gt 0) {
      $taskPath     = $raw.Substring(0, $idx + 1)
      $taskNameOnly = $raw.Substring($idx + 1)
    }
  }

  Add-Step $steps 'taskName' $true "$taskPath$taskNameOnly"

  $caddyPort = Get-JsonPortOrDefault -Path $CaddyPhpJsonFile -Names @('CADDY_PORT','caddy_port','caddyPort') -DefaultValue 8050
  $phpPort   = Get-JsonPortOrDefault -Path $CaddyPhpJsonFile -Names @('PHP_PORT','php_port','phpPort') -DefaultValue 8051
  Add-Step $steps 'readPorts' $true "caddy=$caddyPort php=$phpPort"

  if (-not (Test-Path -LiteralPath $WatchdogTemplate)) {
    Write-JsonAndExit @{
      allOk = $false
      error = 'watchdog.ps1.example missing'
      path  = $WatchdogTemplate
    } 3
  }

  try {
    $tpl = Get-Content -LiteralPath $WatchdogTemplate -Raw
    $tpl = $tpl.Replace('__BASEDIR__', $BaseDir)
    $tpl = $tpl.Replace('__CADDY_PORT__', [string]$caddyPort)
    $tpl = $tpl.Replace('__PHP_PORT__', [string]$phpPort)

    $outDir = Split-Path -Parent $WatchdogOut
    if ($outDir -and -not (Test-Path -LiteralPath $outDir)) {
      New-Item -ItemType Directory -Path $outDir -Force | Out-Null
    }

    Set-Content -LiteralPath $WatchdogOut -Value $tpl -Encoding UTF8
    Add-Step $steps 'renderWatchdog' $true $WatchdogOut
  } catch {
    Add-Step $steps 'renderWatchdog' $false $_.Exception.Message
    Write-JsonAndExit @{
      allOk = $false
      error = 'Render watchdog failed'
      steps = $steps
    } 3
  }

  $psExe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $wd    = $WorkingDir.TrimEnd('\')
  $arg   = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$WatchdogOut`" -IntervalSeconds $IntervalSeconds"

  $action    = New-ScheduledTaskAction -Execute $psExe -Argument $arg -WorkingDirectory $wd
  $tBoot     = New-ScheduledTaskTrigger -AtStartup
  $tLogon    = New-ScheduledTaskTrigger -AtLogOn
  $principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
  $settings  = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero)
  $task      = New-ScheduledTask -Action $action -Trigger @($tBoot, $tLogon) -Principal $principal -Settings $settings

  try {
    Unregister-ScheduledTask -TaskName $taskNameOnly -TaskPath $taskPath -Confirm:$false -ErrorAction Stop
    Add-Step $steps 'unregister' $true ''
  } catch {
    Add-Step $steps 'unregister' $true 'not existing / ignored'
  }

  try {
    Register-ScheduledTask -TaskName $taskNameOnly -TaskPath $taskPath -InputObject $task -Force | Out-Null
    Add-Step $steps 'register' $true ''
  } catch {
    Add-Step $steps 'register' $false $_.Exception.Message
    Write-JsonAndExit @{
      allOk = $false
      error = 'Register-ScheduledTask failed'
      steps = $steps
    } 4
  }

  $found = Get-ScheduledTask -TaskName $taskNameOnly -TaskPath $taskPath -ErrorAction SilentlyContinue
  if (-not $found) {
    Add-Step $steps 'verify' $false 'Task not found after register'
    Write-JsonAndExit @{
      allOk = $false
      error = 'Verify failed'
      steps = $steps
    } 6
  }
  Add-Step $steps 'verify' $true ''

  $started = $false
  try {
    Start-ScheduledTask -TaskName $taskNameOnly -TaskPath $taskPath -ErrorAction Stop
    $started = $true
    Add-Step $steps 'start' $true ''
  } catch {
    Add-Step $steps 'start' $false $_.Exception.Message
  }

  Write-JsonAndExit @{
    allOk       = $true
    task        = $raw
    taskName    = $taskNameOnly
    taskPath    = $taskPath
    started     = $started
    watchdogPs1 = $WatchdogOut
    interval    = $IntervalSeconds
    ports       = @{
      caddy = $caddyPort
      php   = $phpPort
    }
    steps       = $steps
  } 0
}
catch {
  Write-JsonAndExit @{
    allOk = $false
    error = $_.Exception.Message
  } 2
}
