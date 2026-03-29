param(
  [string]$BaseDir = "",
  [string]$LauncherDir = "",
  [switch]$Debug
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Warn([string]$msg) {
  if ($Debug) { Write-Warning $msg }
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
      Warn "$Label konnte nicht gelesen werden: $path ($($_.Exception.Message))"
    }
  }

  return $null
}

function Get-FirstValue {
  param(
    $Object,
    [string[]]$Paths
  )

  foreach ($p in $Paths) {
    $cur = $Object
    $ok = $true
    foreach ($seg in ($p -split '\.')) {
      if ($null -eq $cur) { $ok = $false; break }
      $prop = $cur.PSObject.Properties | Where-Object { $_.Name -ieq $seg } | Select-Object -First 1
      if ($null -eq $prop) { $ok = $false; break }
      $cur = $prop.Value
    }
    if ($ok -and $null -ne $cur -and "$cur".Trim() -ne "") { return $cur }
  }

  return $null
}

function Get-PortOrDefault($Value, [int]$Fallback) {
  $parsed = 0
  if ($null -ne $Value -and [int]::TryParse(([string]$Value).Trim(), [ref]$parsed) -and $parsed -ge 1 -and $parsed -le 65535) {
    return $parsed
  }
  return $Fallback
}

if ([string]::IsNullOrWhiteSpace($LauncherDir)) {
  $LauncherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$LauncherDir = ([System.IO.Path]::GetFullPath($LauncherDir) -replace '[\\/ ]+$', '')

if ([string]::IsNullOrWhiteSpace($BaseDir)) {
  $BaseDir = Split-Path -Parent $LauncherDir
}
$BaseDir = ([System.IO.Path]::GetFullPath($BaseDir) -replace '[\\/ ]+$', '')

[int]$Caddy = 8050
[int]$Php   = 8051
[int]$Bridge= 8052
[int]$Py    = 8053

$caddyJsonPath = Join-Path $LauncherDir 'caddy_php_port.json'
$caddyJson = Read-JsonFirst -Paths @($caddyJsonPath) -Label 'caddy_php_port.json'
if ($caddyJson) {
  $Caddy = Get-PortOrDefault (Get-FirstValue $caddyJson @('CADDY_PORT','caddy_port','caddyPort')) $Caddy
  $Php   = Get-PortOrDefault (Get-FirstValue $caddyJson @('PHP_PORT','php_port','phpPort')) $Php
}
else {
  Warn "caddy_php_port.json nicht gefunden – benutze Defaults für Caddy/PHP"
}

$apiJsonPaths = @(
  (Join-Path $BaseDir 'booth\tools\camerabridge\APIServer\ApiServer_settings.json'),
  (Join-Path $LauncherDir 'defaultConfig\ApiServer_settings.json')
)
$apiJson = Read-JsonFirst -Paths $apiJsonPaths -Label 'ApiServer_settings.json'
$bridgeFromApi = $null
if ($apiJson) {
  $bridgeFromApi = Get-PortOrDefault (Get-FirstValue $apiJson @('Bridge.Port','Port','port')) $Bridge
  $Bridge = $bridgeFromApi
}

$serverJsonPaths = @(
  (Join-Path $BaseDir 'booth\tools\python_portable\server_config.json'),
  (Join-Path $LauncherDir 'defaultConfig\server_config.json')
)
$serverJson = Read-JsonFirst -Paths $serverJsonPaths -Label 'server_config.json'
if ($serverJson) {
  $serverBridge = Get-PortOrDefault (Get-FirstValue $serverJson @('port','Port')) $Bridge
  $serverPy     = Get-PortOrDefault (Get-FirstValue $serverJson @('Python_ServerPort','python_server_port','pythonServerPort','PY_PORT','py_port','pyPort','PythonPort','pythonPort')) $Py

  if ($null -eq $bridgeFromApi) {
    $Bridge = $serverBridge
  }
  elseif ($serverBridge -ne $Bridge) {
    Warn "server_config.json.port ($serverBridge) weicht von ApiServer_settings.json Bridge.Port ($Bridge) ab. ApiServer_settings.json bleibt maßgeblich."
  }

  $Py = $serverPy
}

"CADDY_PORT=$Caddy"
"PHP_PORT=$Php"
"BRIDGE_PORT=$Bridge"
"PY_PORT=$Py"

exit 0
