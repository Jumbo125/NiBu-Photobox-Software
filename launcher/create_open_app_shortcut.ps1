$ErrorActionPreference = 'Stop'

# Script-Ordner (dort wo diese PS1 liegt)
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# RELATIVE Ziele
$BatPath     = Join-Path $ScriptDir "open_app.bat"
$LauncherExe = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir "..\NiBuLauncher.exe"))

# Kiosk-Wait Starter (tolerant: .bat bevorzugt, sonst .cmd)
$KioskBatPath = Join-Path $ScriptDir "kiosk_WaitAndStart.bat"
if (-not (Test-Path -LiteralPath $KioskBatPath)) {
    $KioskBatPath = Join-Path $ScriptDir "Kiosk_WaitAndStart.cmd"
}

# Icon in .\ico\ (nimmt das erste .ico, oder du setzt unten fix einen Namen)
$IcoDir  = Join-Path $ScriptDir "ico"
$IcoPath = $null

if (Test-Path -LiteralPath $IcoDir) {
    $firstIco = Get-ChildItem -LiteralPath $IcoDir -Filter *.ico -File -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($firstIco) { $IcoPath = $firstIco.FullName }
}

if (-not (Test-Path -LiteralPath $BatPath)) {
    throw "open_app.bat nicht gefunden: $BatPath"
}

if (-not (Test-Path -LiteralPath $LauncherExe)) {
    throw "NiBuLauncher.exe nicht gefunden: $LauncherExe"
}

if (-not (Test-Path -LiteralPath $KioskBatPath)) {
    throw "Kiosk-Wait Script nicht gefunden (erwartet kiosk_WaitAndStart.bat oder Kiosk_WaitAndStart.cmd): $ScriptDir"
}

# Desktop
$Desktop = [Environment]::GetFolderPath("Desktop")

# Shortcut-Helper
function New-Shortcut {
    param(
        [Parameter(Mandatory)] [string]$LinkPath,
        [Parameter(Mandatory)] [string]$TargetPath,
        [string]$Arguments = "",
        [string]$WorkingDirectory = "",
        [string]$IconLocation = ""
    )

    $wsh = New-Object -ComObject WScript.Shell
    $s = $wsh.CreateShortcut($LinkPath)
    $s.TargetPath = $TargetPath
    if ($Arguments)        { $s.Arguments = $Arguments }
    if ($WorkingDirectory) { $s.WorkingDirectory = $WorkingDirectory }
    if ($IconLocation)     { $s.IconLocation = $IconLocation }
    $s.Save()
}

# =========================
# 1) NibuBox.lnk -> open_app.bat
# =========================
$NibuBoxLink = Join-Path $Desktop "NibuBox.lnk"

# Icon: bevorzugt .\ico\*.ico, sonst fallback auf EXE-Icon
$batIcon = ""
if ($IcoPath -and (Test-Path -LiteralPath $IcoPath)) {
    $batIcon = $IcoPath
} else {
    $batIcon = "$LauncherExe,0"
}

New-Shortcut `
  -LinkPath $NibuBoxLink `
  -TargetPath "$env:WINDIR\System32\cmd.exe" `
  -Arguments "/c `"`"$BatPath`"`"" `
  -WorkingDirectory $ScriptDir `
  -IconLocation $batIcon

Write-Host "OK: Verknüpfung erstellt -> $NibuBoxLink"

# =========================
# 2) NiBuLauncher.lnk -> ..\NiBuLauncher.exe
# =========================
$LauncherLink = Join-Path $Desktop "NiBuLauncher.lnk"

# Launcher soll IMMER das Icon aus der EXE nehmen
$launcherIcon = "$LauncherExe,0"

New-Shortcut `
  -LinkPath $LauncherLink `
  -TargetPath $LauncherExe `
  -WorkingDirectory (Split-Path $LauncherExe) `
  -IconLocation $launcherIcon

Write-Host "OK: Verknüpfung erstellt -> $LauncherLink"

# =========================
# 3) NibuBox_Autostart.lnk -> kiosk_Wait..bat (eine Ebene höher als ScriptDir)
# =========================
$ParentDir = [System.IO.Path]::GetFullPath((Join-Path $ScriptDir ".."))
$AutostartLink = Join-Path $ParentDir "NibuBox_Autostart.lnk"

New-Shortcut `
  -LinkPath $AutostartLink `
  -TargetPath "$env:WINDIR\System32\cmd.exe" `
  -Arguments "/c `"`"$KioskBatPath`"`"" `
  -WorkingDirectory $ScriptDir `
  -IconLocation $batIcon

Write-Host "OK: Verknüpfung erstellt -> $AutostartLink"
Write-Host "    (Ziel: $KioskBatPath)"

# Ausgabe Icon-Quelle
if ($IcoPath) {
    Write-Host "NibuBox Icon: $IcoPath"
} else {
    Write-Host "NibuBox Icon: (keins gefunden unter .\ico\*.ico) -> Fallback: EXE-Icon"
}
Write-Host "Launcher Icon: EXE-Icon ($LauncherExe,0)"
Write-Host "Autostart Icon: ident zu NibuBox ($batIcon)"
