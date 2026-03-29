@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "FLAG_NOPAUSE="
set "PS_ARGS="
for %%A in (%*) do (
  if /I "%%~A"=="/nopause" (
    set "FLAG_NOPAUSE=1"
    set "PS_ARGS=!PS_ARGS! -NoPause"
  ) else if /I "%%~A"=="-nopause" (
    set "FLAG_NOPAUSE=1"
    set "PS_ARGS=!PS_ARGS! -NoPause"
  ) else (
    set "PS_ARGS=!PS_ARGS! %%~A"
  )
)

if not exist "%SCRIPT_DIR%\windows_tweaks.ps1" (
  echo [ERR] windows_tweaks.ps1 nicht gefunden.
  if not defined FLAG_NOPAUSE pause
  exit /b 2
)

"%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\windows_tweaks.ps1" %PS_ARGS%
set "EC=%ERRORLEVEL%"

if not defined FLAG_NOPAUSE pause
exit /b %EC%
