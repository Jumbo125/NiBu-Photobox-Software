@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "BASEDIR=%%~fI"
cd /d "%BASEDIR%"

set "FLAG_NOPAUSE="
for %%A in (%*) do if /I "%%~A"=="/nopause" set "FLAG_NOPAUSE=1"

echo === NiBu Backend START (WEB-ONLY) ===
echo BaseDir: %BASEDIR%

set "PSEXE=%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe"
set "PS1=%SCRIPT_DIR%start_only_web.ps1"

if not exist "%PS1%" (
  echo [ERR] start_only_web.ps1 not found: "%PS1%"
  if not defined FLAG_NOPAUSE pause
  exit /b 2
)

"%PSEXE%" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%PS1%" -BaseDir "%BASEDIR%" -NoPause
set "EC=%ERRORLEVEL%"

if not defined FLAG_NOPAUSE pause
exit /b %EC%
