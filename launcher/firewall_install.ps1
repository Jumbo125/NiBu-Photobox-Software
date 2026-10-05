param(
  [Parameter(Mandatory=$true)][string]$LauncherDir,
  [Parameter(Mandatory=$true)][string]$ManifestPath
)

$ErrorActionPreference = 'Stop'

function Write-JsonAndExit([hashtable]$obj, [int]$code) {
  try {
    [Console]::Out.WriteLine(([pscustomobject]$obj | ConvertTo-Json -Compress -Depth 10))
  } catch {
    [Console]::Out.WriteLine('{"allOk":false,"error":"json serialization failed"}')
  }
  exit $code
}

function Test-IsAdmin {
  try {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
  } catch { return $false }
}

function Write-PortWarning {
    param([string]$Message)
    Write-Warning $Message
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
        }
        catch {
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

function Get-PortOrNull {
    param($Value)

    if ($null -eq $Value) { return $null }

    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }

    $parsed = 0
    if ([int]::TryParse($text.Trim(), [ref]$parsed)) {
        if ($parsed -ge 1 -and $parsed -le 65535) {
            return $parsed
        }
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
        $caddy = Get-PortOrNull (Get-FirstValue -Object $caddyJson -Paths @('CADDY_PORT', 'caddy_port', 'caddyPort'))
        if ($null -ne $caddy) { $ports.CaddyPort = $caddy }

        $php = Get-PortOrNull (Get-FirstValue -Object $caddyJson -Paths @('PHP_PORT', 'php_port', 'phpPort'))
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
        $bridgeFromApi = Get-PortOrNull (Get-FirstValue -Object $apiJson -Paths @('Bridge.Port', 'Port', 'port'))
        if ($null -ne $bridgeFromApi) {
            $ports.BridgePort = $bridgeFromApi
        }
    }

    $bridgeFromServer = $null
    $pyFromServer = $null
    $serverJson = Read-JsonFirst -Paths $serverJsonPaths -Label 'server_config.json'
    if ($serverJson) {
        $bridgeFromServer = Get-PortOrNull (Get-FirstValue -Object $serverJson -Paths @('port', 'Port'))
        $pyFromServer = Get-PortOrNull (Get-FirstValue -Object $serverJson -Paths @('Python_ServerPort', 'python_server_port', 'pythonServerPort', 'PY_PORT', 'py_port', 'pyPort', 'PythonPort', 'pythonPort'))

        if ($null -eq $bridgeFromApi -and $null -ne $bridgeFromServer) {
            $ports.BridgePort = $bridgeFromServer
        }

        if ($null -ne $pyFromServer) {
            $ports.PyPort = $pyFromServer
        }
    }

    if ($WarnOnMismatch -and $null -ne $bridgeFromApi -and $null -ne $bridgeFromServer -and $bridgeFromApi -ne $bridgeFromServer) {
        Write-PortWarning "server_config.json.port ($bridgeFromServer) weicht von ApiServer_settings.json Bridge.Port ($bridgeFromApi) ab. ApiServer_settings.json bleibt maßgeblich."
    }

    return [pscustomobject]$ports
}

function Normalize-PortKey([string]$key) {
  if ([string]::IsNullOrWhiteSpace($key)) { return '' }
  return (($key -replace '[^A-Za-z0-9]', '').ToUpperInvariant())
}

function Resolve-PortSourceGeneric([string]$srcPath, [string]$srcKey) {
  if (-not (Test-Path -LiteralPath $srcPath)) {
    return @{ ok=$false; port=$null; error=("PortSource-Datei fehlt: " + $srcPath) }
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
      return @{ ok=$false; port=$null; error=("PortSource key missing: " + $srcKey) }
    }
    catch {
      return @{ ok=$false; port=$null; error=("PortSource read failed: " + $_.Exception.Message) }
    }
  }

  try {
    $j = Get-Content -Raw -LiteralPath $srcPath | ConvertFrom-Json
  }
  catch {
    return @{ ok=$false; port=$null; error=("PortSource read failed: " + $_.Exception.Message) }
  }

  $value = Get-FirstValue -Object $j -Paths @($srcKey)
  if ($null -eq $value) {
    return @{ ok=$false; port=$null; error=("PortSource key missing: " + $srcKey) }
  }

  return @{ ok=$true; port=$value; error=$null }
}

function Resolve-PortSource([string]$launcherDir, [string]$baseDir, [string]$portSource, $effectivePorts) {
  if ([string]::IsNullOrWhiteSpace($portSource)) {
    return @{ ok=$false; port=$null; error='portSource leer' }
  }

  $srcFile = ''
  $srcKey  = $portSource

  if ($portSource -match '^[^:]+:[^:]+$') {
    $parts = $portSource -split ':', 2
    $srcFile = $parts[0].Trim()
    $srcKey  = $parts[1].Trim()
  }

  $normKey = Normalize-PortKey $srcKey

  switch ($normKey) {
    'CADDYPORT'        { return @{ ok=$true; port=[int]$effectivePorts.CaddyPort;  error=$null } }
    'PHPPORT'          { return @{ ok=$true; port=[int]$effectivePorts.PhpPort;    error=$null } }
    'BRIDGEPORT'       { return @{ ok=$true; port=[int]$effectivePorts.BridgePort; error=$null } }
    'PYPORT'           { return @{ ok=$true; port=[int]$effectivePorts.PyPort;     error=$null } }
    'PYTHONPORT'       { return @{ ok=$true; port=[int]$effectivePorts.PyPort;     error=$null } }
    'PYTHONSERVERPORT' { return @{ ok=$true; port=[int]$effectivePorts.PyPort;     error=$null } }
    'PORT' {
      if ($srcFile -match 'server_config\.json$' -or $srcFile -match 'ApiServer_settings\.json$') {
        return @{ ok=$true; port=[int]$effectivePorts.BridgePort; error=$null }
      }
    }
  }

  $candidatePaths = @()
  if (-not [string]::IsNullOrWhiteSpace($srcFile)) {
    if ([System.IO.Path]::IsPathRooted($srcFile)) {
      $candidatePaths += $srcFile
    }
    else {
      $candidatePaths += (Join-Path $launcherDir $srcFile)
      $candidatePaths += (Join-Path $baseDir $srcFile)
    }
  }

  foreach ($candidate in ($candidatePaths | Select-Object -Unique)) {
    $res = Resolve-PortSourceGeneric -srcPath $candidate -srcKey $srcKey
    if ($res.ok) { return $res }
  }

  return @{ ok=$false; port=$null; error=("PortSource konnte nicht aufgelöst werden: " + $portSource) }
}

try {
  $LauncherDir = ([System.IO.Path]::GetFullPath($LauncherDir) -replace '[\\/ ]+$', '')
  $BaseDir = Split-Path -Parent $LauncherDir

  if (-not (Test-IsAdmin)) {
    Write-JsonAndExit @{ allOk=$false; error='Bitte als Administrator starten.' } 1
  }

  if (-not (Test-Path -LiteralPath $ManifestPath)) {
    Write-JsonAndExit @{ allOk=$false; error='ops_manifest.json missing'; path=$ManifestPath } 2
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

  $deletedCombined = $false
  try {
    & netsh advfirewall firewall delete rule name="NiBu Photobooth - TCP Ports" 1>$null 2>$null
    $deletedCombined = ($LASTEXITCODE -eq 0)
  } catch { $deletedCombined = $false }

  $results = @()

  foreach ($r in $m.firewallRules) {
    $name = [string]$r.name
    $port = $r.port
    $err  = $null

    if ((-not $port) -and $r.portSource) {
      $res = Resolve-PortSource -launcherDir $LauncherDir -baseDir $BaseDir -portSource ([string]$r.portSource) -effectivePorts $effectivePorts
      if (-not $res.ok) { $err = $res.error }
      else { $port = $res.port }
    }

    $portInt = $null
    try { $portInt = [int]$port } catch { $portInt = $null }

    if ($null -eq $portInt -or $portInt -lt 1 -or $portInt -gt 65535) {
      if (-not $err) { $err = 'Ungueltiger Port' }
      $results += [pscustomobject]@{
        name  = $name
        port  = $port
        rule  = $null
        ok    = $false
        error = $err
      }
      continue
    }

    $tpl = [string]$r.ruleTemplate
    $ruleName = if ($tpl) {
      $tpl -replace "\{port\}", ([string]$portInt)
    } else {
      ("NiBu Photobooth " + $name + " (" + $portInt + ")")
    }

    try {
      & netsh advfirewall firewall delete rule name="$ruleName" 1>$null 2>$null
    } catch {}

    $ok = $false
    $addErr = $null
    try {
      & netsh advfirewall firewall add rule `
        name="$ruleName" `
        dir=in action=allow protocol=TCP localport="$portInt" `
        profile=any enable=yes 1>$null 2>$null

      $ok = ($LASTEXITCODE -eq 0)
      if (-not $ok) { $addErr = 'netsh add failed' }
    } catch {
      $ok = $false
      $addErr = $_.Exception.Message
    }

    $results += [pscustomobject]@{
      name  = $name
      port  = $portInt
      rule  = $ruleName
      ok    = $ok
      error = $addErr
    }
  }

  $failed = ($results | Where-Object { -not $_.ok }).Count
  $allOk  = ($results.Count -gt 0) -and ($failed -eq 0)

  $payload = @{
    allOk = $allOk
    deletedCombinedRule = $deletedCombined
    summary = @{
      total  = $results.Count
      ok     = ($results.Count - $failed)
      failed = $failed
    }
    results = $results
  }

  if ($allOk) { Write-JsonAndExit $payload 0 }
  else        { Write-JsonAndExit $payload 3 }
}
catch {
  Write-JsonAndExit @{ allOk=$false; error=$_.Exception.Message } 2
}
