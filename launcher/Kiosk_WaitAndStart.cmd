@echo off
set "SCRIPT_DIR=%~dp0"
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%Kiosk_WaitAndStart.ps1" %*
