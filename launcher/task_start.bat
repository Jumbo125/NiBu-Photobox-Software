@echo off
setlocal EnableExtensions

set "SCRIPT_DIR=%~dp0"
"%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%task_start.ps1"
exit /b %errorlevel%
