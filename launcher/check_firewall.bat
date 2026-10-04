@echo off
setlocal EnableExtensions DisableDelayedExpansion

for %%I in ("%~dp0.") do set "SCRIPT_DIR=%%~fI"
for %%I in ("%SCRIPT_DIR%\..") do set "BASEDIR=%%~fI"
cd /d "%BASEDIR%"

set "MANIFEST=%SCRIPT_DIR%\ops_manifest.json"

"%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%\check_firewall.ps1" -LauncherDir "%SCRIPT_DIR%" -ManifestPath "%MANIFEST%" -DebugLog "%BASEDIR%\logs\check_firewall_debug.log"

exit /b %ERRORLEVEL%
