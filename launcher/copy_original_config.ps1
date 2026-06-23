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

function Read-TextSmart {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path
  )

  $bytes = [System.IO.File]::ReadAllBytes($Path)

  if ($bytes.Length -eq 0) {
    return ''
  }

  # UTF-8 BOM: EF BB BF
  if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
    return [System.Text.Encoding]::UTF8.GetString($bytes, 3, $bytes.Length - 3)
  }

  # UTF-16 LE BOM: FF FE
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFF -and $bytes[1] -eq 0xFE) {
    return [System.Text.Encoding]::Unicode.GetString($bytes, 2, $bytes.Length - 2)
  }

  # UTF-16 BE BOM: FE FF
  if ($bytes.Length -ge 2 -and $bytes[0] -eq 0xFE -and $bytes[1] -eq 0xFF) {
    return [System.Text.Encoding]::BigEndianUnicode.GetString($bytes, 2, $bytes.Length - 2)
  }

  # Zuerst striktes UTF-8 probieren.
  # Wichtig: throwOnInvalidBytes = true, damit ANSI/Windows-1252 nicht still kaputt gelesen wird.
  try {
    $utf8Strict = New-Object System.Text.UTF8Encoding($false, $true)
    return $utf8Strict.GetString($bytes)
  } catch {
    # Fallback für alte Windows/ANSI-Dateien mit Umlauten.
    # Windows-1252 zuerst versuchen, danach Encoding.Default als letzter Fallback.
    try {
      return [System.Text.Encoding]::GetEncoding(1252).GetString($bytes)
    } catch {
      try {
        return [System.Text.Encoding]::Default.GetString($bytes)
      } catch {
        throw "Datei konnte weder als UTF-8 noch als ANSI/Windows-1252 gelesen werden: $Path"
      }
    }
  }
}

function Write-TextUtf8NoBom {
  param(
    [Parameter(Mandatory = $true)]
    [string]$Path,

    [Parameter(Mandatory = $true)]
    [string]$Text
  )

  # Echtes BOM entfernen, falls es als Unicode-Zeichen im String gelandet ist.
  $Text = $Text.TrimStart([char]0xFEFF)

  # Kaputtes/sichtbares BOM entfernen: ï»¿
  $Text = $Text -replace '^\u00EF\u00BB\u00BF', ''

  # UTF-8 OHNE BOM schreiben. Nicht Set-Content -Encoding UTF8 verwenden,
  # weil Windows PowerShell 5.1 damit UTF-8 MIT BOM schreibt.
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [System.IO.File]::WriteAllText($Path, $Text, $utf8NoBom)
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
  $manifestText = Read-TextSmart -Path $manifestPath
  $manifest = $manifestText | ConvertFrom-Json
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

  # Bytegenaue Kopie. Das Encoding wird hier nicht verändert.
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
    $txt = Read-TextSmart -Path $dst
  } catch {
    Write-Host "[WARN] Datei konnte nicht gelesen werden: $dst"
    Write-Host "       $($_.Exception.Message)"
    continue
  }

  if ($txt -like "*$baseToken*") {
    $replacementValue = $baseValue
    if ([System.IO.Path]::GetExtension($dst).Equals('.json', [System.StringComparison]::OrdinalIgnoreCase)) {
      $replacementValue = $replacementValue.Replace('\', '\\')
    }

    $txt = $txt.Replace($baseToken, $replacementValue)

    # Gepatchte Dateien immer UTF-8 ohne BOM schreiben.
    # Dadurch bleiben Umlaute korrekt und DataContractJsonSerializer stolpert nicht über BOM.
    Write-TextUtf8NoBom -Path $dst -Text $txt

    $rel = $dst.Substring($BaseDir.Length).TrimStart('\')
    Write-Host "[PATCH] BASEDIR ersetzt in: $rel"
  }
}

Write-Host ''

$remainingPortPlaceholders = @()
foreach ($dst in $copiedTargets) {
  if (-not (Test-Path -LiteralPath $dst)) { continue }

  try {
    $txt = Read-TextSmart -Path $dst
  } catch {
    Write-Host "[WARN] Datei konnte nicht gelesen werden bei Port-Pruefung: $dst"
    Write-Host "       $($_.Exception.Message)"
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
