@echo off
setlocal
set "SCRIPT_DIR=%~dp0"
"%SCRIPT_DIR%python.exe" "%SCRIPT_DIR%coin_debug_monitor.py"
pause
endlocal
