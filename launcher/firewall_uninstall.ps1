param(
  [Parameter(Mandatory=$true)][string]$LauncherDir,
  [Parameter(Mandatory=$true)][string]$ManifestPath
)

$ErrorActionPreference = 'Stop'

# =========================================================
# Helpers
# =========================================================
function Write-JsonAndExit([hashtable]$obj, [int]$code) {
  try {
    [Console]::Out.WriteLine(([pscustomobject]$obj | ConvertTo-Json -Compress -Depth 10))
  } catch {
    [Console]::Out.WriteLine('{"allOk":false,"error":"json serialization failed"}')
  }
  exit $code
}

# =========================================================
# Port Resolver (TXT + JSON)
# =========================================================
function Resolve-PortSource([string]$launcherDir, [string]$portSource) {

  # Format: <relPath>:<key>
  $parts = $portSource -split ":", 2
  if ($parts.Count -ne 2 -or
      [string]::IsNullOrWhiteSpace($parts[0]) -or
      [string]::IsNullOrWhiteSpace($parts[1])) {
    return @{ ok=$false; port=$null; error="portSource invalid" }
  }

  $srcFile = $parts[0].Trim()
  $srcKey  = $parts[1].Trim()

  $srcPath = Join-Path $launcherDir $srcFile
  if (-not (Test-Path -LiteralPath $srcPath)) {
    return @{ ok=$false; port=$null; error=("PortSource-Datei fehlt: " + $srcPath) }
  }

  # -------------------------------
  # TXT (KEY=VALUE)
  # -------------------------------
  if ($srcPath -match '\.txt$') {
    try {
      foreach ($line in Get-Content -LiteralPath $srcPath) {
        if ($line -match '^\s*([^#=]+)\s*=\s*(\d+)\s*$') {
          if ($matches[1].Trim().ToUpper() -eq $srcKey.ToUpper()) {
            return @{ ok=$true; port=[int]$matches[2]; error=$null }
          }
        }
      }
      return @{ ok=$false; port=$null; error=("PortSource key missing: " + $srcKey) }
    } catch {
      return @{ ok=$false; port=$null; error=("PortSource read failed: " + $_.Exception.Message) }
    }
  }

  # -------------------------------
  # JSON
  # -------------------------------
  try {
    $j = Get-Content -Raw -LiteralPath $srcPath | ConvertFrom-Json
  } catch {
    $fallbackPath = $null
    if ($srcFile -ieq '..\booth\tools\camerabridge\APIServer\ApiServer_settings.json') {
      $fallbackPath = Join-Path $launcherDir 'defaultConfig\ApiServer_settings.json'
    } elseif ($srcFile -ieq '..\booth\tools\python_portable\server_config.json') {
      $fallbackPath = Join-Path $launcherDir 'defaultConfig\server_config.json'
    }

    if ($fallbackPath -and (Test-Path -LiteralPath $fallbackPath)) {
      try {
        $j = Get-Content -Raw -LiteralPath $fallbackPath | ConvertFrom-Json
      } catch {
        return @{ ok=$false; port=$null; error=("PortSource read failed: " + $_.Exception.Message) }
      }
    } else {
      return @{ ok=$false; port=$null; error=("PortSource read failed: " + $_.Exception.Message) }
    }
  }

  $cur = $j
  foreach ($k in ($srcKey -split "\.")) {
    if ($null -eq $cur) { break }
    $prop = $cur.PSObject.Properties[$k]
    if ($null -eq $prop) { $cur = $null; break }
    $cur = $prop.Value
  }

  if ($null -eq $cur) {
    return @{ ok=$false; port=$null; error=("PortSource key missing: " + $srcKey) }
  }

  return @{ ok=$true; port=$cur; error=$null }
}

# =========================================================
# Firewall helpers
# =========================================================
function Rule-Exists([string]$ruleName) {
  if ([string]::IsNullOrWhiteSpace($ruleName)) { return $false }
  try {
    & netsh advfirewall firewall show rule name="$ruleName" 1>$null 2>$null
    return ($LASTEXITCODE -eq 0)
  } catch { return $false }
}

function Rule-Delete([string]$ruleName) {
  if ([string]::IsNullOrWhiteSpace($ruleName)) {
    return @{ ok=$false; error="empty ruleName" }
  }
  try {
    & netsh advfirewall firewall delete rule name="$ruleName" 1>$null 2>$null
    if ($LASTEXITCODE -eq 0) {
      return @{ ok=$true; error=$null }
    }
    return @{ ok=$false; error="netsh delete failed" }
  } catch {
    return @{ ok=$false; error=$_.Exception.Message }
  }
}

# =========================================================
# MAIN
# =========================================================
try {

  # --- Manifest ---
  if (-not (Test-Path -LiteralPath $ManifestPath)) {
    Write-JsonAndExit @{ allOk=$false; error="ops_manifest.json missing"; path=$ManifestPath } 2
  }

  try {
    $m = Get-Content -Raw -LiteralPath $ManifestPath | ConvertFrom-Json
  } catch {
    Write-JsonAndExit @{ allOk=$false; error=("ops_manifest.json invalid: " + $_.Exception.Message) } 2
  }

  if ($null -eq $m.firewallRules) {
    Write-JsonAndExit @{ allOk=$false; error="firewallRules missing" } 2
  }

  # --- Alte Sammelregel entfernen ---
  $combinedName = "NiBu Photobooth - TCP Ports"
  $deletedCombined = $false
  try {
    if (Rule-Exists $combinedName) {
      $res = Rule-Delete $combinedName
      $deletedCombined = [bool]$res.ok
    }
  } catch { $deletedCombined = $false }

  $results = @()
  $deleted = 0
  $missing = 0
  $failed  = 0
  $skippedInvalidPort = 0

  foreach ($r in $m.firewallRules) {

    $name = [string]$r.name
    $port = $r.port
    $err  = $null

    # --- Port ermitteln ---
    if ((-not $port) -and $r.portSource) {
      $res = Resolve-PortSource -launcherDir $LauncherDir -portSource ([string]$r.portSource)
      if (-not $res.ok) { $err = $res.error }
      else { $port = $res.port }
    }

    # --- Validieren ---
    $portInt = $null
    try { $portInt = [int]$port } catch { $portInt = $null }

    if ($null -eq $portInt -or $portInt -lt 1 -or $portInt -gt 65535) {
      $skippedInvalidPort++
      $results += [pscustomobject]@{
        name   = $name
        port   = $port
        rule   = $null
        status = "skipped"
        ok     = $false
        error  = $(if ($err) { $err } else { "ungueltiger Port" })
      }
      continue
    }

    # --- Regelname ---
    $tpl = [string]$r.ruleTemplate
    $ruleName = if ($tpl) {
      $tpl -replace "\{port\}", ([string]$portInt)
    } else {
      ("NiBu Photobooth " + $name + " (" + $portInt + ")")
    }

    # --- Existiert? ---
    if (-not (Rule-Exists $ruleName)) {
      $missing++
      $results += [pscustomobject]@{
        name   = $name
        port   = $portInt
        rule   = $ruleName
        status = "missing"
        ok     = $true
        error  = $null
      }
      continue
    }

    # --- Löschen ---
    $del = Rule-Delete $ruleName
    if ($del.ok) {
      $deleted++
      $results += [pscustomobject]@{
        name   = $name
        port   = $portInt
        rule   = $ruleName
        status = "deleted"
        ok     = $true
        error  = $null
      }
    } else {
      $failed++
      $results += [pscustomobject]@{
        name   = $name
        port   = $portInt
        rule   = $ruleName
        status = "failed"
        ok     = $false
        error  = $del.error
      }
    }
  }

  $allOk = ($failed -eq 0)

  $payload = @{
    allOk = $allOk
    deletedCombinedRule = $deletedCombined
    summary = @{
      deleted = $deleted
      missing = $missing
      failed  = $failed
      skippedInvalidPort = $skippedInvalidPort
      total   = $results.Count
    }
    results = $results
  }

  if ($allOk) { Write-JsonAndExit $payload 0 }
  else        { Write-JsonAndExit $payload 3 }

}
catch {
  Write-JsonAndExit @{ allOk=$false; error=$_.Exception.Message } 2
}
