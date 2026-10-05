param(
  [Parameter(Mandatory=$true)][string]$LauncherDir,
  [Parameter(Mandatory=$true)][string]$ManifestPath,
  [string]$DebugLog = ""
)

$ErrorActionPreference = 'Stop'
$DebugEnabled = -not [string]::IsNullOrWhiteSpace($DebugLog)

function Ensure-DebugDir {
  if (-not $DebugEnabled) { return }
  try {
    $dir = Split-Path -Parent $DebugLog
    if ($dir -and -not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }
  } catch {}
}

function Dbg([string]$msg) {
  if (-not $DebugEnabled) { return }
  $line = ("{0} {1}" -f (Get-Date -Format "yyyy-MM-dd HH:mm:ss.fff"), $msg)
  try { Add-Content -LiteralPath $DebugLog -Value $line -Encoding UTF8 } catch {}
}

function Write-JsonAndExit([hashtable]$obj, [int]$code) {
  try {
    $json = [pscustomobject]$obj | ConvertTo-Json -Compress -Depth 10
    [Console]::Out.WriteLine($json)
  } catch {
    [Console]::Out.WriteLine('{"allOk":false,"error":"json serialization failed"}')
  }
  exit $code
}

function Run-ProcessTimeout([string]$fileName, [string]$arguments, [int]$timeoutMs = 1500) {
  $p = New-Object System.Diagnostics.Process
  $p.StartInfo.FileName = $fileName
  $p.StartInfo.Arguments = $arguments
  $p.StartInfo.UseShellExecute = $false
  $p.StartInfo.CreateNoWindow  = $true
  $p.StartInfo.RedirectStandardOutput = $false
  $p.StartInfo.RedirectStandardError  = $false

  $null = $p.Start()

  if (-not $p.WaitForExit($timeoutMs)) {
    try { $p.Kill() } catch {}
    return @{ timedOut=$true; exitCode=999 }
  }

  return @{ timedOut=$false; exitCode=$p.ExitCode }
}

function Write-PortWarning([string]$Message) {
  Dbg ("WARN: " + $Message)
}

function Read-JsonFirst {
  param(
    [string[]]$Paths,
    [string]$Label = 'JSON'
  )

  foreach ($path in $Paths) {
    if ([string]::IsNullOrWhiteSpace($path)) { continue }
    if (-not (Test-Path -LiteralPath $path)) { continue }
    try {
      $raw = Get-Content -Raw -LiteralPath $path
      if ([string]::IsNullOrWhiteSpace($raw)) { continue }
      return (ConvertFrom-Json -InputObject $raw)
    } catch {
      Write-PortWarning "$Label konnte nicht gelesen werden: $path ($($_.Exception.Message))"
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
      if ($null -eq $cur) { $ok = $false; break }
      $prop = $cur.PSObject.Properties | Where-Object { $_.Name -ieq $seg } | Select-Object -First 1
      if ($null -eq $prop) { $ok = $false; break }
      $cur = $prop.Value
    }

    if ($ok -and $null -ne $cur) {
      $text = [string]$cur
      if (-not [string]::IsNullOrWhiteSpace($text)) { return $cur }
    }
  }

  return $null
}

function Get-PortOrNull {
  param($Value)

  if ($null -eq $Value) { return $null }
  $text = [string]$Value
  if ([string]::IsNullOrWhiteSpace($text)) { return $null }

  $parsed = 0
  if ([int]::TryParse($text.Trim(), [ref]$parsed) -and $parsed -ge 1 -and $parsed -le 65535) {
    return $parsed
  }

  return $null
}

function Get-EffectivePorts {
  param(
    [Parameter(Mandatory)][string]$LauncherDir,
    [Parameter(Mandatory)][string]$BaseDir,
    [switch]$WarnOnMismatch
  )

  $ports = [ordered]@{
    CaddyPort  = 8050
    PhpPort    = 8051
    BridgePort = 8052
    PyPort     = 8053
  }

  $caddyJsonPath = Join-Path $LauncherDir 'caddy_php_port.json'
  $caddyJson = Read-JsonFirst -Paths @($caddyJsonPath) -Label 'caddy_php_port.json'
  if ($caddyJson) {
    $caddy = Get-PortOrNull (Get-FirstValue -Object $caddyJson -Paths @('CADDY_PORT','caddy_port','caddyPort'))
    if ($null -ne $caddy) { $ports.CaddyPort = $caddy }

    $php = Get-PortOrNull (Get-FirstValue -Object $caddyJson -Paths @('PHP_PORT','php_port','phpPort'))
    if ($null -ne $php) { $ports.PhpPort = $php }
  }

  $apiJsonPaths = @(
    (Join-Path $BaseDir 'booth\tools\camerabridge\APIServer\ApiServer_settings.json'),
    (Join-Path $LauncherDir 'defaultConfig\ApiServer_settings.json')
  )

  $serverJsonPaths = @(
    (Join-Path $BaseDir 'booth\tools\python_portable\server_config.json'),
    (Join-Path $LauncherDir 'defaultConfig\server_config.json')
  )

  $bridgeFromApi = $null
  $apiJson = Read-JsonFirst -Paths $apiJsonPaths -Label 'ApiServer_settings.json'
  if ($apiJson) {
    $bridgeFromApi = Get-PortOrNull (Get-FirstValue -Object $apiJson -Paths @('Bridge.Port','Port','port'))
    if ($null -ne $bridgeFromApi) { $ports.BridgePort = $bridgeFromApi }
  }

  $bridgeFromServer = $null
  $pyFromServer = $null
  $serverJson = Read-JsonFirst -Paths $serverJsonPaths -Label 'server_config.json'
  if ($serverJson) {
    $bridgeFromServer = Get-PortOrNull (Get-FirstValue -Object $serverJson -Paths @('port','Port'))
    $pyFromServer = Get-PortOrNull (Get-FirstValue -Object $serverJson -Paths @('Python_ServerPort','python_server_port','pythonServerPort','PY_PORT','py_port','pyPort','PythonPort','pythonPort'))

    if ($null -eq $bridgeFromApi -and $null -ne $bridgeFromServer) { $ports.BridgePort = $bridgeFromServer }
    if ($null -ne $pyFromServer) { $ports.PyPort = $pyFromServer }
  }

  if ($WarnOnMismatch -and $null -ne $bridgeFromApi -and $null -ne $bridgeFromServer -and $bridgeFromApi -ne $bridgeFromServer) {
    Write-PortWarning "server_config.json.port ($bridgeFromServer) weicht von ApiServer_settings.json Bridge.Port ($bridgeFromApi) ab. ApiServer_settings.json bleibt maßgeblich."
  }

  return [pscustomobject]$ports
}

function Normalize-RuleKey([string]$name) {
  if ([string]::IsNullOrWhiteSpace($name)) { return '' }
  return (($name -replace '[^A-Za-z0-9]', '').ToUpperInvariant())
}

function Resolve-RulePort {
  param(
    [Parameter(Mandatory)]$Rule,
    [Parameter(Mandatory)]$Ports,
    [Parameter(Mandatory)][string]$LauncherDir,
    [Parameter(Mandatory)][string]$BaseDir
  )

  $nameKey = Normalize-RuleKey ([string]$Rule.name)
  switch ($nameKey) {
    'CADDY'  { return @{ ok=$true; port=[int]$Ports.CaddyPort; error=$null } }
    'PHP'    { return @{ ok=$true; port=[int]$Ports.PhpPort; error=$null } }
    'BRIDGE' { return @{ ok=$true; port=[int]$Ports.BridgePort; error=$null } }
    'API'    { return @{ ok=$true; port=[int]$Ports.BridgePort; error=$null } }
    'PYTHON' { return @{ ok=$true; port=[int]$Ports.PyPort; error=$null } }
    'PY'     { return @{ ok=$true; port=[int]$Ports.PyPort; error=$null } }
  }

  $portInt = Get-PortOrNull $Rule.port
  if ($null -ne $portInt) { return @{ ok=$true; port=$portInt; error=$null } }

  $portSource = [string]$Rule.portSource
  if ([string]::IsNullOrWhiteSpace($portSource)) {
    return @{ ok=$false; port=$null; error='invalid port' }
  }

  $parts = $portSource -split ':', 2
  if ($parts.Count -ne 2) {
    return @{ ok=$false; port=$null; error='portSource invalid' }
  }

  $srcFile = $parts[0].Trim()
  $srcKey  = $parts[1].Trim()

  $candidates = @()
  if ([System.IO.Path]::IsPathRooted($srcFile)) {
    $candidates += $srcFile
  } else {
    $candidates += (Join-Path $LauncherDir $srcFile)
    $candidates += (Join-Path $BaseDir $srcFile)
  }

  $srcPath = $candidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
  if (-not $srcPath) {
    return @{ ok=$false; port=$null; error=('portSource file missing: ' + $srcFile) }
  }

  if ($srcPath -match '\.txt$') {
    try {
      foreach ($line in Get-Content -LiteralPath $srcPath) {
        if ($line -match '^\s*([^#=]+)\s*=\s*(\d+)\s*$') {
          if ($matches[1].Trim().ToUpperInvariant() -eq $srcKey.Trim().ToUpperInvariant()) {
            return @{ ok=$true; port=[int]$matches[2]; error=$null }
          }
        }
      }
      return @{ ok=$false; port=$null; error=('portSource key missing: ' + $srcKey) }
    }
    catch {
      return @{ ok=$false; port=$null; error=('portSource read failed: ' + $_.Exception.Message) }
    }
  }

  try {
    $j = Get-Content -Raw -LiteralPath $srcPath | ConvertFrom-Json
  }
  catch {
    return @{ ok=$false; port=$null; error=('portSource read failed: ' + $_.Exception.Message) }
  }

  $value = Get-FirstValue -Object $j -Paths @($srcKey)
  $portInt = Get-PortOrNull $value
  if ($null -eq $portInt) {
    return @{ ok=$false; port=$null; error=('portSource key missing or invalid: ' + $srcKey) }
  }

  return @{ ok=$true; port=$portInt; error=$null }
}

function Rule-ExistsDetailed([string]$ruleName) {
  if ([string]::IsNullOrWhiteSpace($ruleName)) {
    return @{ exists=$false; timedOut=$false; error='empty ruleName' }
  }

  try {
    if (Get-Command Get-NetFirewallRule -ErrorAction SilentlyContinue) {
      $r = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
      return @{ exists=($null -ne $r); timedOut=$false; error=$null }
    }
  } catch {}

  $args = "advfirewall firewall show rule name=`"$ruleName`""
  Dbg ("netsh " + $args)
  $res = Run-ProcessTimeout -fileName 'netsh.exe' -arguments $args -timeoutMs 1500

  if ($res.timedOut) { return @{ exists=$false; timedOut=$true; error='netsh timeout' } }
  if ($res.exitCode -eq 0) { return @{ exists=$true; timedOut=$false; error=$null } }
  return @{ exists=$false; timedOut=$false; error=$null }
}

try {
  Ensure-DebugDir
  Dbg 'START check_firewall.ps1'

  $LauncherDir = ([System.IO.Path]::GetFullPath($LauncherDir) -replace '[\\/ ]+$', '')
  $BaseDir = Split-Path -Parent $LauncherDir

  if (-not (Test-Path -LiteralPath $ManifestPath)) {
    Write-JsonAndExit @{ allOk=$false; error='ops_manifest.json missing' } 2
  }

  try {
    $m = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
  } catch {
    Write-JsonAndExit @{ allOk=$false; error=('ops_manifest.json invalid: ' + $_.Exception.Message) } 2
  }

  if ($null -eq $m.firewallRules) {
    Write-JsonAndExit @{ allOk=$false; error='firewallRules missing' } 2
  }

  $effectivePorts = Get-EffectivePorts -LauncherDir $LauncherDir -BaseDir $BaseDir -WarnOnMismatch
  Dbg ("Ports: Caddy=$($effectivePorts.CaddyPort) PHP=$($effectivePorts.PhpPort) Bridge=$($effectivePorts.BridgePort) Python=$($effectivePorts.PyPort)")

  $out = @()
  foreach ($r in $m.firewallRules) {
    $name = [string]$r.name
    $res = Resolve-RulePort -Rule $r -Ports $effectivePorts -LauncherDir $LauncherDir -BaseDir $BaseDir

    if (-not $res.ok) {
      $out += [pscustomobject]@{
        name        = $name
        port        = $null
        freigegeben = $false
        rule        = $null
        error       = $res.error
      }
      continue
    }

    $portInt = [int]$res.port
    $tpl = [string]$r.ruleTemplate
    $ruleName = if ($tpl) { $tpl -replace "\{port\}", ([string]$portInt) }
                else { ("NiBu Photobooth " + $name + " (" + $portInt + ")") }

    $existsInfo = Rule-ExistsDetailed -ruleName $ruleName
    $ok = [bool]$existsInfo.exists
    $ruleErr = if ($existsInfo.timedOut) { $existsInfo.error }
               elseif (-not $ok) { 'not found' }
               else { $null }

    $out += [pscustomobject]@{
      name        = $name
      port        = $portInt
      freigegeben = $ok
      rule        = $ruleName
      error       = $ruleErr
    }
  }

  $allOk = ($out.Count -gt 0) -and (($out | Where-Object { -not $_.freigegeben }).Count -eq 0)
  Write-JsonAndExit @{ allOk=$allOk; ports=$out } 0
}
catch {
  try { Dbg ('FATAL: ' + $_.Exception.Message) } catch {}
  Write-JsonAndExit @{ allOk=$false; error=$_.Exception.Message } 2
}
