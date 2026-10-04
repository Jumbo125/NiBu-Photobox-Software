@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "LAUNCHERDIR=%SCRIPT_DIR:~0,-1%"
for %%I in ("%SCRIPT_DIR%..") do set "BASEDIR=%%~fI\"
cd /d "%BASEDIR%"

set "FLAG_NOPAUSE="
for %%A in (%*) do if /I "%%~A"=="/nopause" set "FLAG_NOPAUSE=1"

net session >nul 2>&1
if not %errorlevel%==0 (
  echo {"allOk":false,"error":"Bitte als Administrator starten."}
  if not defined FLAG_NOPAUSE pause
  exit /b 1
)

set "MANIFEST=%SCRIPT_DIR%ops_manifest.json"
if not exist "%MANIFEST%" (
  echo {"allOk":false,"error":"ops_manifest.json nicht gefunden","path":"%MANIFEST%"}
  if not defined FLAG_NOPAUSE pause
  exit /b 2
)

"%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass ^
  -File "%SCRIPT_DIR%firewall_install.ps1" ^
  -LauncherDir "%LAUNCHERDIR%" ^
  -ManifestPath "%MANIFEST%"

set "EC=%errorlevel%"
if not defined FLAG_NOPAUSE pause
exit /b %EC%
