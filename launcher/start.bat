@echo off
setlocal EnableExtensions EnableDelayedExpansion

REM === Ordner der BAT ===
set "SCRIPT_DIR=%~dp0"

REM === Default BaseDir: ein Ordner über launcher ===
set "BASE_DIR=%SCRIPT_DIR%.."

REM === PS1 Pfad ===
set "PS1=%SCRIPT_DIR%start.ps1"

REM === Erwarteter VC++-Installer direkt neben start.bat ===
set "VC_REDIST=%SCRIPT_DIR%VC_redist.x64.exe"

REM === Debug-Modus: sichtbares Konsolenfenster via start_debug.bat ===
if /I "%~1"=="/debug" (
  call "%SCRIPT_DIR%start_debug.bat"
  exit /b %errorlevel%
)

REM === VC++ Redistributable x64 pruefen ===
call :CheckVCRedistX64
if errorlevel 1 (
  echo [INFO] Microsoft Visual C++ Redistributable 2015-2022 x64 ist nicht installiert.
  echo [HINWEIS] Diese Laufzeit wird fuer PHP unter Windows benoetigt.
  if exist "%VC_REDIST%" (
    echo [ACTION] Installiere VC_redist.x64.exe silent, bitte warten...
    "%VC_REDIST%" /install /quiet /norestart
    if errorlevel 1 (
      echo [ERR] VC++ Installation fehlgeschlagen ^(ExitCode=%ERRORLEVEL%^).
      echo [HINWEIS] Bitte VC_redist.x64.exe manuell installieren und danach neu starten.
      exit /b 20
    )
    echo [OK] VC++ erfolgreich installiert.
  ) else (
    echo [ERR] VC_redist.x64.exe wurde nicht neben start.bat gefunden.
    echo [HINWEIS] Datei hier ablegen: "%VC_REDIST%"
    exit /b 20
  )
)

REM === Argument-Uebersetzung (Batch /... oder -... -> PowerShell -...) ===
set "PS_EXTRA="

:loop
if "%~1"=="" goto run

set "A=%~1"

REM --- BaseDir override erlauben ---
if /I "%A%"=="-BaseDir" (
  set "BASE_DIR=%~2"
  shift
  shift
  goto loop
)
if /I "%A%"=="/basedir" (
  set "BASE_DIR=%~2"
  shift
  shift
  goto loop
)

REM --- Slash- und Dash-Flags mappen ---
if /I "%A%"=="/nopause" (set "PS_EXTRA=!PS_EXTRA! -NoPause" & shift & goto loop)
if /I "%A%"=="-nopause" (set "PS_EXTRA=!PS_EXTRA! -NoPause" & shift & goto loop)

if /I "%A%"=="/web"     (set "PS_EXTRA=!PS_EXTRA! -Web"     & shift & goto loop)
if /I "%A%"=="-web"     (set "PS_EXTRA=!PS_EXTRA! -Web"     & shift & goto loop)

if /I "%A%"=="/clean"   (set "PS_EXTRA=!PS_EXTRA! -Clean"   & shift & goto loop)
if /I "%A%"=="-clean"   (set "PS_EXTRA=!PS_EXTRA! -Clean"   & shift & goto loop)

if /I "%A%"=="/kiosk"   (set "PS_EXTRA=!PS_EXTRA! -Kiosk"        & shift & goto loop)
if /I "%A%"=="-kiosk"   (set "PS_EXTRA=!PS_EXTRA! -Kiosk"        & shift & goto loop)

if /I "%A%"=="/debug"   (set "PS_EXTRA=!PS_EXTRA! -DebugConsole" & shift & goto loop)
if /I "%A%"=="-debug"   (set "PS_EXTRA=!PS_EXTRA! -DebugConsole" & shift & goto loop)

REM --- Alles andere unveraendert durchreichen ---
set "PS_EXTRA=!PS_EXTRA! %~1"
shift
goto loop

:run
powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "%PS1%" -BaseDir "%BASE_DIR%" %PS_EXTRA%
exit /b %errorlevel%

:CheckVCRedistX64
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >nul 2>&1
if not errorlevel 1 exit /b 0
reg query "HKLM\SOFTWARE\Wow6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >nul 2>&1
if not errorlevel 1 exit /b 0
exit /b 1
