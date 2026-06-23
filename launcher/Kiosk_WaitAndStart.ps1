param(
  [int]$DefaultCaddyPort = 8050,
  [int]$MaxWaitSeconds = 0,
  [int]$SleepMs = 600,
  [int]$HttpTimeoutMs = 800,
  [int]$FallbackStartAfterSecs = 30
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CaddyJsonPath = Join-Path $ScriptDir 'caddy_php_port.json'

$BrowserExePath = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir '..\browser\Fotobox.WebView2Host.exe'))
$BrowserDir     = Split-Path -Parent $BrowserExePath

$LogDir  = Join-Path $ScriptDir 'logs'
$LogFile = Join-Path $LogDir 'kiosk_autostart.log'
if (-not (Test-Path -LiteralPath $LogDir)) {
  New-Item -ItemType Directory -Path $LogDir -Force | Out-Null
}

function Log {
  param([string]$msg)
  $ts = (Get-Date).ToString('yyyy-MM-dd HH:mm:ss')
  "$ts [KIOSK] $msg" | Out-File -FilePath $LogFile -Encoding UTF8 -Append
}

function Read-JsonFirst {
  param([string[]]$Paths)

  foreach ($path in $Paths) {
    if ([string]::IsNullOrWhiteSpace($path)) { continue }
    if (-not (Test-Path -LiteralPath $path)) { continue }

    try {
      $raw = Get-Content -Raw -LiteralPath $path
      if ([string]::IsNullOrWhiteSpace($raw)) { continue }
      return (ConvertFrom-Json -InputObject $raw)
    }
    catch {
      Log ("WARN: JSON konnte nicht gelesen werden: {0} ({1})" -f $path, $_.Exception.Message)
    }
  }

  return $null
}

function Get-FirstValue {
  param(
    $Object,
    [string[]]$Paths
  )

  foreach ($path in $Paths) {
    $cur = $Object
    $ok = $true

    foreach ($seg in ($path -split '\.')) {
      if ($null -eq $cur) {
        $ok = $false
        break
      }

      $prop = $cur.PSObject.Properties | Where-Object { $_.Name -ieq $seg } | Select-Object -First 1
      if ($null -eq $prop) {
        $ok = $false
        break
      }

      $cur = $prop.Value
    }

    if ($ok -and $null -ne $cur) {
      $text = [string]$cur
      if (-not [string]::IsNullOrWhiteSpace($text)) {
        return $cur
      }
    }
  }

  return $null
}

function Read-CaddyPort {
  param([int]$Fallback)

  $json = Read-JsonFirst -Paths @($CaddyJsonPath)
  if ($null -eq $json) { return $Fallback }

  $value = Get-FirstValue -Object $json -Paths @('CADDY_PORT', 'caddy_port', 'caddyPort')
  $parsed = 0

  if (
    $null -ne $value -and
    [int]::TryParse(([string]$value).Trim(), [ref]$parsed) -and
    $parsed -gt 0 -and
    $parsed -lt 65536
  ) {
    return $parsed
  }

  return $Fallback
}


function Test-HttpOk {
  param(
    [string]$Url,
    [int]$TimeoutMs = 800
  )

  try {
    if ($Url -like '*?*') { $sep = '&' } else { $sep = '?' }
    $u = "$Url${sep}t=$([DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds())"

    $req = [System.Net.WebRequest]::Create($u)
    $req.Method = 'GET'
    $req.Timeout = $TimeoutMs
    $req.UseDefaultCredentials = $true

    if ($req -is [System.Net.HttpWebRequest]) {
      $req.ReadWriteTimeout = $TimeoutMs
      $req.KeepAlive = $false
      $req.Proxy = $null
      $req.AutomaticDecompression = [System.Net.DecompressionMethods]::GZip -bor [System.Net.DecompressionMethods]::Deflate
      $req.Headers['Cache-Control'] = 'no-cache, no-store, max-age=0'
      $req.UserAgent = 'PhotoboxKiosk/1.0'
    }

    $resp = $req.GetResponse()
    try {
      if ($resp -is [System.Net.HttpWebResponse]) {
        return ([int]$resp.StatusCode -ge 200 -and [int]$resp.StatusCode -lt 300)
      }
      return $true
    }
    finally {
      if ($resp) { $resp.Close() }
    }
  }
  catch [System.Net.WebException] {
    if ($_.Exception.Response -is [System.Net.HttpWebResponse]) {
      $status = [int]$_.Exception.Response.StatusCode
      $_.Exception.Response.Close()
      return ($status -ge 200 -and $status -lt 300)
    }
    return $false
  }
  catch {
    return $false
  }
}

function Host-AlreadyRunning {
  param([string]$ExePath)

  try {
    $procName = [System.IO.Path]::GetFileName($ExePath)
    $procs = Get-CimInstance Win32_Process -Filter "Name='$procName'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      if ($p.ExecutablePath -and ([System.IO.Path]::GetFullPath($p.ExecutablePath) -eq $ExePath)) {
        return $true
      }
      if ($p.CommandLine -and $p.CommandLine -like "*$ExePath*") {
        return $true
      }
    }
  }
  catch {
    Log ("WARN: Laufende Instanz konnte nicht sauber geprueft werden: {0}" -f $_.Exception.Message)
  }

  return $false
}

$StartBatPath = Join-Path $ScriptDir 'start.bat'
$TaskStartBat = Join-Path $ScriptDir 'task_start.bat'

Log ("Start. Script={0}" -f $MyInvocation.MyCommand.Path)
[Console]::WriteLine("[NiBuBox] Starte NiBuBox Kiosk...")


if (-not (Test-Path -LiteralPath $BrowserExePath)) {
  Log ("ERROR: Browser-EXE nicht gefunden: {0}" -f $BrowserExePath)
  exit 3
}

$caddyPort   = Read-CaddyPort -Fallback $DefaultCaddyPort
$baseUrl     = "http://127.0.0.1:$caddyPort/"
$healthCaddy = "http://127.0.0.1:$caddyPort/watchdog/_health.txt"
$healthPhp   = "http://127.0.0.1:$caddyPort/watchdog/_php_ping.php"

Log ("BrowserExe={0}" -f $BrowserExePath)
Log ("CADDY_PORT={0}" -f $caddyPort)
Log ("HealthCaddy={0}" -f $healthCaddy)
Log ("HealthPhp={0}" -f $healthPhp)

if (Host-AlreadyRunning -ExePath $BrowserExePath) {
  Log ("Browser-App bereits aktiv. Exit.")
  exit 0
}

$start = Get-Date
$tries = 0
$fallbackTriggered = $false

while ($true) {
  $tries++
  $elapsed = ((Get-Date) - $start).TotalSeconds

  $ok1 = Test-HttpOk -Url $healthCaddy -TimeoutMs $HttpTimeoutMs
  $ok2 = Test-HttpOk -Url $healthPhp -TimeoutMs $HttpTimeoutMs

  if ($ok1 -and $ok2) {
    Log ("Health OK nach {0} Versuchen ({1} s). Starte Browser-App auf: {2}" -f $tries, [int]$elapsed, $baseUrl)
    [Console]::WriteLine(("[NiBuBox] Server bereit nach {0} s. Starte Browser..." -f [int]$elapsed))
    break
  }

  if ($tries -eq 1 -or ($tries % 10 -eq 0)) {
    Log ("Warte... (try={0}, {1} s) caddy={2} php={3}" -f $tries, [int]$elapsed, $ok1, $ok2)
    [Console]::WriteLine(("[NiBuBox] Versuch {0} ({1} s): warte auf Server... caddy={2} php={3}" -f $tries, [int]$elapsed, $ok1, $ok2))
  }

  # Fallback: wenn Server nach FallbackStartAfterSecs noch nicht laufen, einmalig start.bat aufrufen
  if (-not $fallbackTriggered -and $elapsed -ge $FallbackStartAfterSecs) {
    $fallbackTriggered = $true
    Log ("FALLBACK nach {0} s: versuche task_start.bat oder start.bat" -f [int]$elapsed)
    [Console]::WriteLine(("[NiBuBox] Server nach {0} s nicht erreichbar - versuche Watchdog/Server zu starten..." -f [int]$elapsed))

    # Erst Watchdog-Task starten (bevorzugt), sonst direkt start.bat
    if (Test-Path -LiteralPath $TaskStartBat) {
      try {
        Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c "' + $TaskStartBat + '"') -WindowStyle Hidden | Out-Null
        Log "Fallback: task_start.bat gestartet"
      } catch {
        Log ("WARN: task_start.bat fehlgeschlagen: {0}" -f $_.Exception.Message)
      }
    } elseif (Test-Path -LiteralPath $StartBatPath) {
      try {
        Start-Process -FilePath 'cmd.exe' -ArgumentList ('/c "' + $StartBatPath + ' /nopause"') -WindowStyle Hidden | Out-Null
        Log "Fallback: start.bat gestartet"
      } catch {
        Log ("WARN: start.bat fehlgeschlagen: {0}" -f $_.Exception.Message)
      }
    } else {
      Log "WARN: Weder task_start.bat noch start.bat gefunden"
      [Console]::WriteLine("[NiBuBox] WARNUNG: Kein Start-Script gefunden!")
    }
  }

  if ($MaxWaitSeconds -gt 0 -and $elapsed -ge $MaxWaitSeconds) {
    Log ("Timeout nach {0} s. Browser-App wird NICHT gestartet." -f $MaxWaitSeconds)
    [Console]::WriteLine(("[NiBuBox] Timeout nach {0} s. Browser wird nicht gestartet." -f $MaxWaitSeconds))
    exit 2
  }

  Start-Sleep -Milliseconds $SleepMs
}

$BrowserArgs = @(
  "--url=$baseUrl",
  "--port=$caddyPort",
  "--kiosk=true"
)

Start-Process -FilePath $BrowserExePath -ArgumentList $BrowserArgs -WorkingDirectory $BrowserDir | Out-Null
Log ("Browser-App gestartet: {0} {1}" -f $BrowserExePath, ($BrowserArgs -join ' '))
exit 0