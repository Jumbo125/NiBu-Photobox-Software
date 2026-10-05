@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "FLAG_NOPAUSE="
for %%A in (%*) do if /I "%%~A"=="/nopause" set "FLAG_NOPAUSE=1"

net session >nul 2>&1
if not %errorlevel%==0 (
  echo {"allOk":false,"error":"Bitte als Administrator starten."}
  if not defined FLAG_NOPAUSE pause
  exit /b 1
)

"%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass ^
  -File "%SCRIPT_DIR%\task_uninstall.ps1" ^
  -TaskNameFile "%SCRIPT_DIR%\watchdog_taskname.txt"

set "EC=%errorlevel%"
if not defined FLAG_NOPAUSE pause
exit /b %EC%
