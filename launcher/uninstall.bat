@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
if "%SCRIPT_DIR:~-1%"=="\" set "SCRIPT_DIR=%SCRIPT_DIR:~0,-1%"
set "FLAG_NOPAUSE="
for %%A in (%*) do if /I "%%~A"=="/nopause" set "FLAG_NOPAUSE=1"

set "FLAG_DIR=%SCRIPT_DIR%\Watchdog_flags"

echo === UNINSTALL ===

call "%SCRIPT_DIR%\stop.bat" /nopause
call "%SCRIPT_DIR%\task_uninstall.bat" /nopause
call "%SCRIPT_DIR%\firewall_uninstall.bat" /nopause

rem ---- Watchdog-Flags entfernen ----
del /f /q "%FLAG_DIR%\watchdog.bootattempt" 2>nul
del /f /q "%FLAG_DIR%\watchdog.stop" 2>nul
del /f /q "%FLAG_DIR%\last_action.txt" 2>nul
rd "%FLAG_DIR%" 2>nul

echo === UNINSTALL fertig ===
if not defined FLAG_NOPAUSE pause
exit /b 0
