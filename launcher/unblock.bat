@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "BASEDIR=%%~fI\"

set "FLAG_NOPAUSE="
for %%A in (%*) do if /I "%%~A"=="/nopause" set "FLAG_NOPAUSE=1"

echo === Unblock Files ===
echo BaseDir: %BASEDIR%

set "T0=%BASEDIR%caddy_windows_amd64.exe"
set "T1=%BASEDIR%booth\tools\camerabridge\APIServer\Photobox.Bridge.ApiServer.exe"
set "T2=%BASEDIR%booth\tools\camerabridge\Worker\CameraWorker.exe"
set "T3=%BASEDIR%booth\tools\python_portable\python.exe"

call :UnblockOne "%T0%"
call :UnblockOne "%T1%"
call :UnblockOne "%T2%"
call :UnblockOne "%T3%"

call :UnblockDir "%BASEDIR%booth\tools\camerabridge"
call :UnblockDir "%BASEDIR%booth\tools\python_portable"

echo === Unblock fertig ===
if not defined FLAG_NOPAUSE pause
exit /b 0

:UnblockOne
set "P=%~1"
if exist "%P%" (
  echo [FILE] %P%
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try{Unblock-File -LiteralPath '%P%' -ErrorAction SilentlyContinue}catch{}" >nul 2>&1
) else (
  echo [WARN] Nicht gefunden: %P%
)
exit /b 0

:UnblockDir
set "D=%~1"
if exist "%D%\*" (
  echo [DIR ] %D%  ^(rekursiv *.exe/*.dll^)
  powershell -NoProfile -ExecutionPolicy Bypass -Command "try{Get-ChildItem -LiteralPath '%D%' -Recurse -Include *.exe,*.dll -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue}catch{}" >nul 2>&1
)
exit /b 0
