@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "BASEDIR=%%~fI"
cd /d "%BASEDIR%"

set "PS_FLAGS="

for %%A in (%*) do (
  if /I "%%~A"=="/web"     set "PS_FLAGS=-Web !PS_FLAGS!"
  if /I "%%~A"=="/nopause" set "PS_FLAGS=-NoPause !PS_FLAGS!"
)

"%WINDIR%\System32\WindowsPowerShell\v1.0\powershell.exe" ^
  -NoProfile ^
  -NonInteractive ^
  -ExecutionPolicy Bypass ^
  -File "%SCRIPT_DIR%stop.ps1" ^
  -BaseDir "%BASEDIR%" %PS_FLAGS%

exit /b %ERRORLEVEL%
