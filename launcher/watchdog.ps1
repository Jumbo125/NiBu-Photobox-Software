param(
  [int]$IntervalSeconds        = 5,
  [int]$StartupWaitSeconds     = 20,
  [int]$RestartCooldownSeconds = 60
)

# ============================================================
# DEBUG SWITCH
#   $true  = ausfuehrliche Logs
#   $false = minimale Logs
# ============================================================
$debug_log = $true

# ===================== BASIS =====================
$BaseDir   = "C:\Users\andre\Desktop\photo-software"
$CaddyPort = [int]"8050"
$PhpPort   = [int]"8051"

$LauncherDir  = Join-Path $BaseDir "launcher"
$StartFullBat = Join-Path $LauncherDir "start.bat"
$StartWebBat  = Join-Path $LauncherDir "start_only_web.bat"

# Script-Dir
$ScriptDir = $PSScriptRoot
if (-not $ScriptDir) { $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path }

# ===================== PATHS (LOKAL IM LAUNCHER) =====================
$FlagDir         = Join-Path $ScriptDir "Watchdog_flags"
$LogDir          = Join-Path $ScriptDir "logs"
$LogFile         = Join-Path $LogDir "watchdog_ps.log"
$StopFile        = Join-Path $FlagDir "watchdog.stop"
$BootAttemptFile = Join-Path $FlagDir "watchdog.bootattempt"

# ===================== LOGGING =====================
function Ensure-Dir([string]$path) {
  $d = Split-Path -Parent $path
  if ($d -and -not (Test-Path -LiteralPath $d)) {
    New-Item -ItemType Directory -Path $d -Force | Out-Null
  }
}

function _LogLine([string]$level, [string]$msg) {
  Ensure-Dir $LogFile
  Add-Content -LiteralPath $LogFile -Encoding UTF8 -Value (
    "[{0}] {1}: {2}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss"), $level, $msg
  )
}

function Log([string]$msg) { _LogLine "INFO"  $msg }
function LogW([string]$msg) { _LogLine "WARN" $msg }
function LogE([string]$msg) { _LogLine "ERR"  $msg }
function LogD([string]$msg) { if ($debug_log) { _LogLine "DEBUG" $msg } }

function LogEx([string]$prefix, $errRecord) {
  LogE $prefix
  if (-not $debug_log) { return }

  try {
    $ex = $errRecord.Exception
    if ($ex) {
      LogD ("EX: " + $ex.Message)
      LogD ("EXType: " + $ex.GetType().FullName)
      if ($errRecord.ScriptStackTrace) { LogD ("Stack: " + $errRecord.ScriptStackTrace) }
      if ($ex.InnerException) {
        LogD ("Inner: " + $ex.InnerException.Message)
        LogD ("InnerType: " + $ex.InnerException.GetType().FullName)
      }
    }
  } catch {}
}

# ===================== EARLY START LOG (VOR MUTEX) =====================
try {
  New-Item -ItemType Directory -Path $FlagDir -Force | Out-Null
  New-Item -ItemType Directory -Path $LogDir  -Force | Out-Null

  LogD ("BOOTSTRAP pre-mutex user={0} pid={1} cwd={2} scriptDir={3}" -f `
    $env:USERNAME, $PID, (Get-Location).Path, $ScriptDir)

  if ($debug_log) {
    LogD ("Paths: BaseDir={0}" -f $BaseDir)
    LogD ("Paths: LauncherDir={0}" -f $LauncherDir)
    LogD ("Paths: FlagDir={0}" -f $FlagDir)
    LogD ("Paths: LogFile={0}" -f $LogFile)
    LogD ("Paths: StopFile={0}" -f $StopFile)
    LogD ("Paths: BootAttemptFile={0}" -f $BootAttemptFile)
    LogD ("Ports: caddy={0} php={1}" -f $CaddyPort, $PhpPort)
  }
} catch {}

# ===================== SINGLE INSTANCE (Global -> Fallback) =====================
$createdNew = $false
$mutex      = $null
$mutexName  = $null

# Security so that if SYSTEM creates the global mutex, a normal user can OPEN it later (for "already running" detection)
$mutexSec = $null
try {
  $mutexSec = New-Object System.Security.AccessControl.MutexSecurity
  $mutexSec.AddAccessRule((New-Object System.Security.AccessControl.MutexAccessRule("NT AUTHORITY\SYSTEM","FullControl","Allow")))
  $mutexSec.AddAccessRule((New-Object System.Security.AccessControl.MutexAccessRule("BUILTIN\Administrators","FullControl","Allow")))
  $mutexSec.AddAccessRule((New-Object System.Security.AccessControl.MutexAccessRule("BUILTIN\Users","Synchronize,Modify","Allow")))
} catch {
  # Wenn das nicht geht, ist es nicht kritisch
  if ($debug_log) { LogW "WARN: MutexSecurity setup failed (ignored)" }
}

$mutexCandidates = @(
  @{ name = "Global\NiBu_Watchdog_WebOnly"; sec = $mutexSec },
  @{ name = "NiBu_Watchdog_WebOnly";        sec = $null    }
)

foreach ($c in $mutexCandidates) {
  try {
    $createdNew = $false

    if ($c.sec) {
      $mutex = New-Object System.Threading.Mutex($true, $c.name, [ref]$createdNew, $c.sec)
    } else {
      $mutex = New-Object System.Threading.Mutex($true, $c.name, [ref]$createdNew)
    }

    $mutexName = $c.name
    LogD ("Mutex OK name={0} createdNew={1}" -f $mutexName, $createdNew)
    break
  }
  catch {
    LogW ("Mutex create/open failed for '{0}': {1}" -f $c.name, $_.Exception.Message)
    if ($debug_log) { LogEx ("Mutex exception for " + $c.name) $_ }
    $mutex = $null
  }
}

if (-not $mutex) {
  LogE "Mutex create failed (all candidates) -> exit"
  exit 2
}

if (-not $createdNew) {
  LogW ("EXIT: mutex exists -> watchdog already running (name={0})" -f $mutexName)
  try { $mutex.Dispose() } catch {}
  exit 0
}

# ===================== FIRST START SINCE BOOT =====================
function Get-BootStamp {
  try {
    $os = Get-CimInstance Win32_OperatingSystem -OperationTimeoutSec 5
    if ($os -and $os.LastBootUpTime) { return $os.LastBootUpTime.ToString("o") }
    return ""
  } catch {
    if ($debug_log) { LogEx "Get-BootStamp failed" $_ }
    return ""
  }
}

$bootStamp = Get-BootStamp
$IsFirstStartThisBoot = $true

try {
  if ($bootStamp -and (Test-Path -LiteralPath $BootAttemptFile)) {
    $prev = (Get-Content -LiteralPath $BootAttemptFile -Raw).Trim()
    if ($prev -eq $bootStamp) { $IsFirstStartThisBoot = $false }
  }
} catch {
  if ($debug_log) { LogEx "BootAttempt read failed" $_ }
}

Log ("BOOT: stamp=$bootStamp firstStartThisBoot=$IsFirstStartThisBoot")

# Wird im laufenden Prozess gesetzt, damit nicht mehrfach Full-Start passiert.
$script:FullStartAlreadyUsed = $false

# ===================== HEALTH =====================
$HealthCaddy = "http://127.0.0.1:$CaddyPort/watchdog/_health.txt"
$HealthPhp   = "http://127.0.0.1:$CaddyPort/watchdog/_php_ping.php"

function HttpOk([string]$url, [string]$expect) {
  try {
    $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3
    if ($debug_log) { LogD ("HTTP {0} -> {1}" -f $url, $r.StatusCode) }
    if ($r.StatusCode -ne 200) { return $false }
    if ($expect -and ($r.Content -notmatch $expect)) {
      if ($debug_log) { LogD ("HTTP content mismatch expect='{0}'" -f $expect) }
      return $false
    }
    return $true
  }
  catch {
    if ($debug_log) { LogD ("HTTP FAIL {0} : {1}" -f $url, $_.Exception.Message) }
    return $false
  }
}

function HealthOk {
  (HttpOk $HealthCaddy "OK") -and (HttpOk $HealthPhp "OK")
}

# ===================== STATE =====================
$failCount        = 0
$lastRestart      = Get-Date "2000-01-01"
$startupBlockedTo = Get-Date "2000-01-01"
$loopCount        = 0

# ===================== BAT RUNNER =====================
function Run-Bat([string]$batPath, [string]$args) {
  try {
    if (-not (Test-Path -LiteralPath $batPath)) {
      LogE "bat not found: $batPath"
      return $false
    }

    $cmdArgs = "/d /s /c ""`"$batPath`" $args"""
    Log ("CMD: cmd.exe $cmdArgs")
    if ($debug_log) { LogD ("BAT WD={0}" -f $LauncherDir) }

    Start-Process `
      -FilePath "cmd.exe" `
      -ArgumentList $cmdArgs `
      -WorkingDirectory $LauncherDir `
      -WindowStyle Hidden | Out-Null

    return $true
  } catch {
    LogEx ("Run-Bat failed: " + $batPath) $_
    return $false
  }
}

# ===================== ACTION =====================
function Start-Web {
  $now = Get-Date

  if (($now - $lastRestart).TotalSeconds -lt $RestartCooldownSeconds) {
    Log "RESTART skipped (cooldown)"
    return
  }

  if ($IsFirstStartThisBoot -and -not $script:FullStartAlreadyUsed) {

    Log "FIRST START THIS BOOT -> FULL START (start.bat)"

    if ($bootStamp) {
      try {
        Set-Content -LiteralPath $BootAttemptFile -Value $bootStamp -Encoding ASCII
        LogD "Wrote bootattempt marker"
      } catch {
        LogW "WARN: failed to write bootattempt file"
        if ($debug_log) { LogEx "bootattempt write ex" $_ }
      }
    }

    $ok = Run-Bat $StartFullBat "/nopause"
    if ($ok) { $script:FullStartAlreadyUsed = $true }

  } else {

    Log "RESTART -> WEB-ONLY (start_only_web.bat)"
    Run-Bat $StartWebBat "/nopause" | Out-Null
  }

  $script:lastRestart      = $now
  $script:startupBlockedTo = $now.AddSeconds($StartupWaitSeconds)

  Log ("WAIT {0} s (startup grace)" -f $StartupWaitSeconds)
}

Log "WATCHDOG START"

# ===================== MAIN LOOP =====================
try {
  while ($true) {
    $loopCount++

    if ($debug_log -and ($loopCount % 12 -eq 0)) {
      LogD ("HEARTBEAT loop={0} failCount={1} blockedTo={2}" -f $loopCount, $failCount, $startupBlockedTo.ToString("HH:mm:ss"))
    }

    if (Test-Path -LiteralPath $StopFile) {
      Log "STOPFILE -> exit"
      break
    }

    $now = Get-Date

    if ($now -lt $startupBlockedTo) {
      Start-Sleep -Seconds $IntervalSeconds
      continue
    }

    $ok = HealthOk
    if ($ok) {
      if ($debug_log) { LogD "HEALTH OK" }
      $failCount = 0
      Start-Sleep -Seconds $IntervalSeconds
      continue
    }

    $failCount++
    Log ("HEALTH FAIL (#{0})" -f $failCount)

    if ($failCount -ge 2) {
      Start-Web
      $failCount = 0
    }

    Start-Sleep -Seconds $IntervalSeconds
  }
}
catch {
  LogEx "MAIN LOOP crashed" $_
}
finally {
  try { $mutex.ReleaseMutex() | Out-Null } catch {}
  try { $mutex.Dispose() } catch {}
  Log "WATCHDOG END"
}

