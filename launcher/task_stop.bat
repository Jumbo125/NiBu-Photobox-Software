@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"

set "FLAG_DIR=%SCRIPT_DIR%\Watchdog_flags"
set "STOPFILE=%FLAG_DIR%\watchdog.stop"
set "STATUSFILE=%FLAG_DIR%\last_action.txt"
set "TASKFILE=%SCRIPT_DIR%\watchdog_taskname.txt"

if not exist "%FLAG_DIR%" mkdir "%FLAG_DIR%" >nul 2>&1

> "%STOPFILE%" echo stop

timeout /t 2 /nobreak >nul

if not exist "%TASKFILE%" (
  > "%STATUSFILE%" echo STOP_SIGNAL_WRITTEN
  exit /b 0
)

set /p TASKNAME=<"%TASKFILE%"
if "%TASKNAME%"=="" (
  > "%STATUSFILE%" echo STOP_SIGNAL_WRITTEN
  exit /b 0
)

set "TASK_RAW=%TASKNAME%"
set "TASK_STATE="
for /f "usebackq delims=" %%S in (`"%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "$ErrorActionPreference='SilentlyContinue'; Import-Module ScheduledTasks -ErrorAction SilentlyContinue; $raw=$env:TASK_RAW; $task=Get-ScheduledTask -ErrorAction SilentlyContinue | Where-Object { ($_.TaskPath + $_.TaskName) -ieq $raw -or $_.TaskName -ieq $raw.TrimStart('\') } | Select-Object -First 1; if($task){ [Console]::Out.WriteLine([string]$task.State) } else { [Console]::Out.WriteLine('UNKNOWN') }"`) do set "TASK_STATE=%%S"

if /I "%TASK_STATE%"=="Running" (
  > "%STATUSFILE%" echo STOP_PENDING
  exit /b 1
)

if /I "%TASK_STATE%"=="UNKNOWN" (
  > "%STATUSFILE%" echo STOP_SIGNAL_WRITTEN
  exit /b 0
)

> "%STATUSFILE%" echo STOPPED
exit /b 0
