param(
  [string]$BaseDir,
  [string]$LauncherDir
)

$ErrorActionPreference = 'Stop'

function Normalize-DirPath {
  param(
    [Parameter(Mandatory = $true)]
    [string]$PathValue,
    [string]$Label = 'Pfad'
  )

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    throw "$Label ist leer."
  }

  $raw = $PathValue

  # Whitespace außen weg
  $PathValue = $PathValue.Trim()

  # Führende / abschließende Anführungszeichen entfernen
  $PathValue = $PathValue.Trim('"')

  # Steuerzeichen entfernen
  $PathValue = $PathValue -replace "[`r`n`t]", ''

  if ([string]::IsNullOrWhiteSpace($PathValue)) {
    throw "$Label ist nach dem Bereinigen leer. RAW=[$raw]"
  }

  $invalidChars = [System.IO.Path]::GetInvalidPathChars()
  if ($PathValue.IndexOfAny($invalidChars) -ge 0) {
    throw "$Label enthaelt ungueltige Zeichen. RAW=[$raw] CLEAN=[$PathValue]"
  }

  try {
    $full = [System.IO.Path]::GetFullPath($PathValue)
  } catch {
    throw "$Label konnte nicht normalisiert werden. RAW=[$raw] CLEAN=[$PathValue] FEHLER=$($_.Exception.Message)"
  }

  return ($full -replace '[\\/ ]+$', '')
}

if ([string]::IsNullOrWhiteSpace($LauncherDir)) {
  if ($PSScriptRoot) {
    $LauncherDir = $PSScriptRoot
  } else {
    $LauncherDir = Split-Path -Parent $MyInvocation.MyCommand.Path
  }
}

if ([string]::IsNullOrWhiteSpace($BaseDir)) {
  $BaseDir = Split-Path -Parent $LauncherDir
}

Write-Host '=== INPUT DEBUG ==='
Write-Host "LauncherDir RAW: >$LauncherDir<"
Write-Host "BaseDir RAW:     >$BaseDir<"
Write-Host ''

try {
  $LauncherDir = Normalize-DirPath -PathValue $LauncherDir -Label 'LauncherDir'
  $BaseDir     = Normalize-DirPath -PathValue $BaseDir -Label 'BaseDir'
} catch {
  Write-Host "[ERR] $($_.Exception.Message)"
  exit 2
}

$manifestPath = Join-Path $LauncherDir 'ops_manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) {
  Write-Host "[ERR] ops_manifest.json fehlt: $manifestPath"
  exit 2
}

Write-Host '=== COPY ORIGINAL CONFIGS + PATCH BASEDIR ==='
Write-Host "BaseDir: $BaseDir"
Write-Host "LauncherDir: $LauncherDir"
Write-Host ''

try {
  $manifest = Get-Content -Raw -LiteralPath $manifestPath | ConvertFrom-Json
} catch {
  Write-Host "[ERR] ops_manifest.json ist ungueltig: $($_.Exception.Message)"
  exit 2
}

if (-not $manifest.configs) {
  Write-Host '[ERR] configs fehlt im ops_manifest.json'
  exit 2
}

$copiedTargets = New-Object System.Collections.Generic.List[string]

foreach ($c in $manifest.configs) {
  $srcRel = [string]$c.src
  $dstRel = [string]$c.dst

  if ([string]::IsNullOrWhiteSpace($srcRel) -or [string]::IsNullOrWhiteSpace($dstRel)) {
    Write-Host '[ERR] Ein config-Eintrag in ops_manifest.json hat kein src oder dst.'
    exit 3
  }

  $src = Join-Path $BaseDir $srcRel
  $dst = Join-Path $BaseDir $dstRel

  if (-not (Test-Path -LiteralPath $src)) {
    Write-Host "[ERR] SRC fehlt: $src"
    exit 3
  }

  $dstDir = Split-Path -Parent $dst
  if (-not (Test-Path -LiteralPath $dstDir)) {
    New-Item -ItemType Directory -Path $dstDir -Force | Out-Null
  }

  Copy-Item -LiteralPath $src -Destination $dst -Force
  $copiedTargets.Add($dst) | Out-Null
  Write-Host "[COPY] $srcRel -> $dstRel"
}

Write-Host ''

$baseToken = '__BASE_DIR__'
$baseValue = $BaseDir

foreach ($dst in $copiedTargets) {
  if (-not (Test-Path -LiteralPath $dst)) { continue }

  try {
    $txt = Get-Content -Raw -LiteralPath $dst
  } catch {
    Write-Host "[WARN] Datei konnte nicht gelesen werden: $dst"
    continue
  }

  if ($txt -like "*$baseToken*") {
    $replacementValue = $baseValue
    if ([System.IO.Path]::GetExtension($dst).Equals('.json', [System.StringComparison]::OrdinalIgnoreCase)) {
      $replacementValue = $replacementValue.Replace('\', '\\')
    }

    $txt = $txt.Replace($baseToken, $replacementValue)
    Set-Content -LiteralPath $dst -Value $txt -Encoding UTF8
    $rel = $dst.Substring($BaseDir.Length).TrimStart('\')
    Write-Host "[PATCH] BASEDIR ersetzt in: $rel"
  }
}

Write-Host ''

$remainingPortPlaceholders = @()
foreach ($dst in $copiedTargets) {
  if (-not (Test-Path -LiteralPath $dst)) { continue }

  try {
    $txt = Get-Content -Raw -LiteralPath $dst
  } catch {
    Write-Host "[WARN] Datei konnte nicht gelesen werden bei Port-Pruefung: $dst"
    continue
  }

  if ($txt -match '__BRIDGE_PORT__' -or
      $txt -match '__PY_PORT__' -or
      $txt -match '__CADDY_PORT__' -or
      $txt -match '__PHP_PORT__') {
    $remainingPortPlaceholders += $dst
  }
}

if ($remainingPortPlaceholders.Count -gt 0) {
  Write-Host '[ERR] Port-Platzhalter sind nach dem Kopieren noch vorhanden. Die UI muss die Vorlagen vor dem Install vorbereiten:'
  foreach ($p in $remainingPortPlaceholders) {
    $rel = $p.Substring($BaseDir.Length).TrimStart('\')
    Write-Host "      $rel"
  }
  exit 4
}

Write-Host '=== DONE ==='
exit 0