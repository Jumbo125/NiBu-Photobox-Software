@echo off
setlocal EnableExtensions

REM === Ordner der BAT ===
set "SCRIPT_DIR=%~dp0"
set "BASE_DIR=%SCRIPT_DIR%.."
set "PS1=%SCRIPT_DIR%start.ps1"

echo [DEBUG-MODE] NiBu Debug-Start - Konsolenfenster wird sichtbar geoeffnet...

REM Startet start.ps1 in einem NEUEN sichtbaren PowerShell-Fenster.
REM -DebugConsole: alle Dienste (Caddy/PHP/Bridge/Python) starten sichtbar.
REM Ohne -NoPause: start.ps1 endet mit "Taste druecken..." (pause).
REM 'start' kehrt sofort zurueck, damit der Launcher nicht wartet.
start "NiBu Debug-Start" powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%PS1%" -BaseDir "%BASE_DIR%" -DebugConsole

exit /b 0
