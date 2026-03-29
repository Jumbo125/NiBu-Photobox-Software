param(
  [int]$DefaultCaddyPort = 8050,
  [int]$MaxWaitSeconds = 0,
  [int]$SleepMs = 600,
  [int]$HttpTimeoutMs = 800,
  [switch]$EnsureAutostart = $true
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$CaddyJsonPath = Join-Path $ScriptDir 'caddy_php_port.json'

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

function Ensure-AutostartShortcut {
  try {
    $StartupDir = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
    if (-not (Test-Path -LiteralPath $StartupDir)) {
      New-Item -ItemType Directory -Path $StartupDir -Force | Out-Null
    }

    $LinkName = 'Photobox Kiosk.lnk'
    $LnkPath = Join-Path $StartupDir $LinkName
    $BatPath = Join-Path $ScriptDir 'open_app.bat'
    $CmdExe = (Get-Command cmd.exe -ErrorAction Stop).Source

    $IcoPath = $null
    $IcoDir = Join-Path $ScriptDir 'ico'
    if (Test-Path -LiteralPath $IcoDir) {
      $firstIco = Get-ChildItem -LiteralPath $IcoDir -Filter *.ico -File -ErrorAction SilentlyContinue | Select-Object -First 1
      if ($firstIco) {
        $IcoPath = $firstIco.FullName
      }
    }

    $desiredTarget = $CmdExe
    if (Test-Path -LiteralPath $BatPath) {
      $desiredArgs = '/c "' + $BatPath + '"'
    }
    else {
      $psExe = (Get-Command powershell.exe -ErrorAction Stop).Source
      $thisScript = $MyInvocation.MyCommand.Path
      $desiredTarget = $psExe
      $desiredArgs = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $thisScript + '"'
    }

    $desiredWorkDir = $ScriptDir
    $desiredIcon = $null
    if ($IcoPath) {
      $desiredIcon = "$IcoPath,0"
    }

    $wsh = New-Object -ComObject WScript.Shell
    $sc = $wsh.CreateShortcut($LnkPath)

    $needsSave = $false

    if ($sc.TargetPath -ne $desiredTarget) {
      $sc.TargetPath = $desiredTarget
      $needsSave = $true
    }

    if ($sc.Arguments -ne $desiredArgs) {
      $sc.Arguments = $desiredArgs
      $needsSave = $true
    }

    if ($sc.WorkingDirectory -ne $desiredWorkDir) {
      $sc.WorkingDirectory = $desiredWorkDir
      $needsSave = $true
    }

    if ($desiredIcon -and $sc.IconLocation -ne $desiredIcon) {
      $sc.IconLocation = $desiredIcon
      $needsSave = $true
    }

    if ($needsSave) {
      $sc.Save()
      Log ("Autostart-Link erstellt/aktualisiert: {0} -> {1} {2}" -f $LnkPath, $desiredTarget, $desiredArgs)
    }
    else {
      Log ("Autostart-Link ok (keine Aenderung): {0}" -f $LnkPath)
    }
  }
  catch {
    Log ("WARN: Autostart-Link konnte nicht erstellt/aktualisiert werden: {0}" -f $_.Exception.Message)
  }
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

function Kiosk-AlreadyRunning {
  param([string]$Url)

  try {
    $procs = Get-CimInstance Win32_Process -Filter "Name='chrome.exe' OR Name='msedge.exe'" -ErrorAction SilentlyContinue
    foreach ($p in $procs) {
      $cmd = $p.CommandLine
      if ([string]::IsNullOrWhiteSpace($cmd)) { continue }
      if ($cmd -match '--kiosk' -and $cmd -like "*$Url*") {
        return $true
      }
    }
  }
  catch {
  }

  return $false
}

function Find-ChromeExe {
  $cmd = Get-Command chrome.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $c = Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe'
  if (Test-Path -LiteralPath $c) { return $c }

  $c = Join-Path ${env:ProgramFiles} 'Google\Chrome\Application\chrome.exe'
  if (Test-Path -LiteralPath $c) { return $c }

  $pf86 = ${env:ProgramFiles(x86)}
  if ($pf86) {
    $c = Join-Path $pf86 'Google\Chrome\Application\chrome.exe'
    if (Test-Path -LiteralPath $c) { return $c }
  }

  return $null
}

function Find-EdgeExe {
  $cmd = Get-Command msedge.exe -ErrorAction SilentlyContinue
  if ($cmd -and $cmd.Source) { return $cmd.Source }

  $e = Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe'
  if (Test-Path -LiteralPath $e) { return $e }

  $pf86 = ${env:ProgramFiles(x86)}
  if ($pf86) {
    $e = Join-Path $pf86 'Microsoft\Edge\Application\msedge.exe'
    if (Test-Path -LiteralPath $e) { return $e }
  }

  $e = Join-Path ${env:ProgramFiles} 'Microsoft\Edge\Application\msedge.exe'
  if (Test-Path -LiteralPath $e) { return $e }

  return $null
}

Log ("Start. Script={0}" -f $MyInvocation.MyCommand.Path)
if ($EnsureAutostart) {
  Ensure-AutostartShortcut
}

$caddyPort = Read-CaddyPort -Fallback $DefaultCaddyPort
$baseUrl = "http://127.0.0.1:$caddyPort/"
$healthCaddy = "http://127.0.0.1:$caddyPort/watchdog/_health.txt"
$healthPhp = "http://127.0.0.1:$caddyPort/watchdog/_php_ping.php"

Log ("CADDY_PORT={0}" -f $caddyPort)
Log ("HealthCaddy={0}" -f $healthCaddy)
Log ("HealthPhp={0}" -f $healthPhp)

if (Kiosk-AlreadyRunning -Url $baseUrl) {
  Log ("Kiosk bereits aktiv ({0}). Exit." -f $baseUrl)
  exit 0
}

$start = Get-Date
$tries = 0
while ($true) {
  $tries++

  $ok1 = Test-HttpOk -Url $healthCaddy -TimeoutMs $HttpTimeoutMs
  $ok2 = Test-HttpOk -Url $healthPhp -TimeoutMs $HttpTimeoutMs

  if ($ok1 -and $ok2) {
    Log ("Health OK nach {0} Versuchen. Starte Kiosk: {1}" -f $tries, $baseUrl)
    break
  }

  if ($tries -eq 1 -or ($tries % 10 -eq 0)) {
    Log ("Warte... (try={0}) caddy={1} php={2}" -f $tries, $ok1, $ok2)
  }

  if ($MaxWaitSeconds -gt 0) {
    $elapsed = (Get-Date) - $start
    if ($elapsed.TotalSeconds -ge $MaxWaitSeconds) {
      Log ("Timeout nach {0} s. Kiosk wird NICHT gestartet." -f $MaxWaitSeconds)
      exit 2
    }
  }

  Start-Sleep -Milliseconds $SleepMs
}

$ChromeProfile = Join-Path $ScriptDir 'chrome_kiosk_profile'
$EdgeProfile = Join-Path $ScriptDir 'edge_kiosk_profile'

$chrome = Find-ChromeExe
if ($chrome) {
  $args = @(
    '--kiosk', $baseUrl,
    '--new-window',
    '--no-first-run',
    '--disable-session-crashed-bubble',
    "--user-data-dir=$ChromeProfile"
  )

  Start-Process -FilePath $chrome -ArgumentList $args -WorkingDirectory $ScriptDir | Out-Null
  Log ("Chrome gestartet: {0}" -f $chrome)
  exit 0
}

$edge = Find-EdgeExe
if ($edge) {
  $args = @(
    '--kiosk', $baseUrl,
    '--edge-kiosk-type=fullscreen',
    '--no-first-run',
    '--disable-session-crashed-bubble',
    "--user-data-dir=$EdgeProfile"
  )

  Start-Process -FilePath $edge -ArgumentList $args -WorkingDirectory $ScriptDir | Out-Null
  Log ("Edge gestartet: {0}" -f $edge)
  exit 0
}

Start-Process $baseUrl | Out-Null
Log 'Fallback: Default Browser gestartet.'
exit 0
