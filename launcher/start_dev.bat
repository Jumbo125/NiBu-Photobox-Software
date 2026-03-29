@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "BASE_DIR=%SCRIPT_DIR%.."
set "PS1=%SCRIPT_DIR%start_dev.ps1"

set "PS_EXTRA="

:loop
if "%~1"=="" goto run

set "A=%~1"

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

if /I "%A%"=="/nopause" (set "PS_EXTRA=!PS_EXTRA! -NoPause" & shift & goto loop)
if /I "%A%"=="/web"     (set "PS_EXTRA=!PS_EXTRA! -Web"     & shift & goto loop)
if /I "%A%"=="/clean"   (set "PS_EXTRA=!PS_EXTRA! -Clean"   & shift & goto loop)
if /I "%A%"=="/kiosk"   (set "PS_EXTRA=!PS_EXTRA! -Kiosk"   & shift & goto loop)

set "PS_EXTRA=!PS_EXTRA! %~1"
shift
goto loop

:run
"%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%PS1%" -BaseDir "%BASE_DIR%" %PS_EXTRA%
exit /b %errorlevel%
