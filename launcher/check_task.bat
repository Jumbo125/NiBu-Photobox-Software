@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "TASKFILE=%SCRIPT_DIR%\watchdog_taskname.txt"
set "MANIFEST=%SCRIPT_DIR%\ops_manifest.json"
set "TASKNAME="

if exist "%TASKFILE%" (
  set /p TASKNAME=<"%TASKFILE%"
)

if "%TASKNAME%"=="" (
  if not exist "%MANIFEST%" (
    echo ERROR: watchdog_taskname.txt und ops_manifest.json fehlen.
    exit /b 2
  )

  for /f "usebackq delims=" %%T in (`
    powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ^
      "$m=Get-Content -Raw '%MANIFEST%' | ConvertFrom-Json; $n=$m.taskName; if($n){$n.ToString().Trim()} else {''}"
  `) do set "TASKNAME=%%T"
)

if "%TASKNAME%"=="" (
  echo ERROR: Taskname fehlt in watchdog_taskname.txt und ops_manifest.json
  exit /b 2
)

schtasks /Query /TN "%TASKNAME%" >nul 2>&1
if %errorlevel%==0 (
  echo INSTALLED: %TASKNAME%
  exit /b 0
)

echo NOT_INSTALLED: %TASKNAME%
exit /b 1
