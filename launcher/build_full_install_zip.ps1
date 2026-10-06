<#
.SYNOPSIS
    Baut das "Full Install"-ZIP fuer NiBu Photobooth aus dem aktuellen
    Arbeitsstand (photo-software/), inkl. aller Vendor-/Runtime-Ordner,
    aber OHNE die PC-spezifischen Configs/Laufzeitdaten dieses Dev-PCs.

.DESCRIPTION
    Ersetzt das bisherige manuelle Zusammenbauen des Release-ZIPs.
    Fragt die Versionsnummer interaktiv ab (oder per -Version Parameter),
    baut daraus Name und Pfad des ZIPs, erzeugt zusaetzlich eine .sha256.txt
    daneben - fertig zum Hochladen als GitHub-Release-Asset.

.PARAMETER Version
    Versionsnummer, z.B. "2.1". Wird nicht abgefragt, wenn gesetzt.

.PARAMETER OutDir
    Zielordner fuer das fertige ZIP. Default: Desktop.

.EXAMPLE
    .\build_full_install_zip.ps1
    .\build_full_install_zip.ps1 -Version "2.1" -OutDir "D:\Releases"
#>

param(
    [string]$Version,
    [string]$OutDir = "$env:USERPROFILE\Desktop"
)

$ErrorActionPreference = "Stop"

# BaseDir = photo-software/ (ein Verzeichnis ueber launcher/)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BaseDir   = Split-Path -Parent $ScriptDir

Write-Host "=== NiBu Photobooth - Full Install ZIP Builder ===" -ForegroundColor Cyan
Write-Host "BaseDir: $BaseDir"
Write-Host ""

if (-not $Version) {
    $Version = Read-Host "Versionsnummer eingeben (z.B. 2.1)"
}
if ([string]::IsNullOrWhiteSpace($Version)) {
    throw "Keine Versionsnummer angegeben."
}

$DateStr  = Get-Date -Format "dd_MM_yyyy"
$ZipName  = "NiBu_Photobox_win64_v${Version}_${DateStr}.zip"
$ZipPath  = Join-Path $OutDir $ZipName

if (-not (Test-Path $OutDir)) {
    New-Item -ItemType Directory -Path $OutDir -Force | Out-Null
}

# -------------------------------------------------------------------
# Ordner/Dateien, die komplett ausgeschlossen werden (PC-spezifisch,
# Laufzeitdaten, Entwicklungs-Only, nicht Teil der Auslieferung).
# Pfade relativ zu BaseDir, Vergleich erfolgt auf dem vollen Pfad.
# -------------------------------------------------------------------
$ExcludeDirs = @(
    ".git"
    ".claude"
    ".vscode"
    ".github"
    "DEV"
    "test"
    "booth_alt_nicht_ändern"
    "dumps"
    "screenshots"
    "Debug"
    "config-skizze"

    "booth\config\config"
    "booth\.ACTIVE_SESSION_TMP"
    "booth\api\.ACTIVE_SESSION_TMP"
    "booth\CAPTURE"
    "booth\EVENTS"
    "booth\uploads"
    "booth\templates"
    "booth\activeTemplate"
    "booth\photos"
    "booth\logs"

    "launcher\edge_kiosk_profile"
    "launcher\logs"

    "Caddy\cache"
    "Caddy\config"
    "Caddy\data"

    "logs"
    "photos"
)

$ExcludeFiles = @(
    "launcher\caddy_php_port.json"
    "launcher\ops_manifest.json"
    "launcher\watchdog_pause.json"
    "launcher\last_action.txt"
    "launcher\watchdog_taskname.txt"

    "changes.md"
    "changes_2026-08-25.md"
    "changes_datum.md"
    "debug.log"
    "run_php_fcgi.ps1"
)

# Datei-Muster, die ueberall (rekursiv) ausgeschlossen werden
$ExcludeFilePatterns = @(
    "*.bak"
    "*.bak.*"
    "*.lock"
    "desktop.ini"
    "*.log"
)

Write-Host "Sammle Dateien..." -ForegroundColor Yellow

$ExcludeDirsFull = $ExcludeDirs | ForEach-Object { (Join-Path $BaseDir $_).TrimEnd('\') }
$ExcludeFilesFull = $ExcludeFiles | ForEach-Object { Join-Path $BaseDir $_ }

$AllItems = Get-ChildItem -Path $BaseDir -Recurse -Force -ErrorAction SilentlyContinue

$SelectedFiles = @()
$SkippedCount = 0

foreach ($item in $AllItems) {
    if ($item.PSIsContainer) { continue }

    $full = $item.FullName

    # In einem ausgeschlossenen Verzeichnis?
    $inExcludedDir = $false
    foreach ($ex in $ExcludeDirsFull) {
        if ($full -like "$ex\*" -or $full -eq $ex) {
            $inExcludedDir = $true
            break
        }
    }
    if ($inExcludedDir) { $SkippedCount++; continue }

    # Explizit ausgeschlossene Einzeldatei?
    if ($ExcludeFilesFull -contains $full) { $SkippedCount++; continue }

    # Dateimuster-Ausschluss
    $matchesPattern = $false
    foreach ($pat in $ExcludeFilePatterns) {
        if ($item.Name -like $pat) { $matchesPattern = $true; break }
    }
    if ($matchesPattern) { $SkippedCount++; continue }

    $SelectedFiles += $item
}

Write-Host "  $($SelectedFiles.Count) Dateien werden eingepackt, $SkippedCount uebersprungen." -ForegroundColor Green
Write-Host ""

# -------------------------------------------------------------------
# ZIP bauen (ueber Staging-Ordner, damit die interne Struktur sauber
# bei BaseDir\... beginnt, ohne den vollen Windows-Pfad mitzuschleppen)
# -------------------------------------------------------------------
$StagingDir = Join-Path $env:TEMP "nibu_build_staging_$(Get-Random)"
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

Write-Host "Kopiere nach Staging-Ordner..." -ForegroundColor Yellow
try {
    foreach ($item in $SelectedFiles) {
        $rel = $item.FullName.Substring($BaseDir.Length).TrimStart('\')
        $dest = Join-Path $StagingDir $rel
        $destDir = Split-Path -Parent $dest
        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }
        try {
            Copy-Item -Path $item.FullName -Destination $dest -Force -ErrorAction Stop
        } catch {
            Write-Warning "Kopieren fehlgeschlagen: $($item.FullName) -> $dest : $($_.Exception.Message)"
        }
    }

    Write-Host "Erzeuge ZIP: $ZipPath" -ForegroundColor Yellow
    if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

    # .NET ZipFile ist deutlich schneller als Compress-Archive bei vielen/grossen Dateien
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory(
        $StagingDir,
        $ZipPath,
        [System.IO.Compression.CompressionLevel]::Optimal,
        $false
    )

    Write-Host "Berechne SHA256..." -ForegroundColor Yellow
    $hash = Get-FileHash -Path $ZipPath -Algorithm SHA256
    $shaPath = "$ZipPath.sha256.txt"
    "$($hash.Hash)  $ZipName" | Out-File -FilePath $shaPath -Encoding ascii -NoNewline

    $sizeMb = [Math]::Round((Get-Item $ZipPath).Length / 1MB, 1)

    Write-Host ""
    Write-Host "=== FERTIG ===" -ForegroundColor Cyan
    Write-Host "ZIP:     $ZipPath ($sizeMb MB)"
    Write-Host "SHA256:  $shaPath"
    Write-Host "Hash:    $($hash.Hash)"
}
finally {
    Remove-Item -Path $StagingDir -Recurse -Force -ErrorAction SilentlyContinue
}
