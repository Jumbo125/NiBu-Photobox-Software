@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "CADDY_JSON=%SCRIPT_DIR%caddy_php_port.json"
set "CADDY_PORT=8050"

if exist "%CADDY_JSON%" (
  for /f "usebackq tokens=1* delims==" %%A in (`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ^
    "$ErrorActionPreference='Stop';" ^
    "$j = Get-Content -Raw '%CADDY_JSON%' | ConvertFrom-Json;" ^
    "$p = $null;" ^
    "foreach($n in @('CADDY_PORT','caddy_port','caddyPort')) { if($null -eq $p) { $prop = $j.PSObject.Properties | Where-Object { $_.Name -ieq $n } | Select-Object -First 1; if($prop) { $p = $prop.Value } } }" ^
    "$v = 8050;" ^
    "if($null -ne $p) { $tmp = 0; if([int]::TryParse(([string]$p).Trim(), [ref]$tmp) -and $tmp -ge 1 -and $tmp -le 65535) { $v = $tmp } }" ^
    "Write-Output ('CADDY_PORT=' + $v)" 2^>nul`) do (
    set "%%A=%%B"
  )
)

set "URL=http://127.0.0.1:%CADDY_PORT%/"
echo [KIOSK] %URL%

set "CHROME_PROFILE=%SCRIPT_DIR%chrome_kiosk_profile"
set "EDGE_PROFILE=%SCRIPT_DIR%edge_kiosk_profile"

call :FindChrome
if defined CHROME_EXE (
  start "" "%CHROME_EXE%" ^
    --kiosk "%URL%" ^
    --new-window ^
    --no-first-run ^
    --disable-session-crashed-bubble ^
    --user-data-dir="%CHROME_PROFILE%"
  exit /b 0
)

call :FindEdge
if defined EDGE_EXE (
  start "" "%EDGE_EXE%" ^
    --kiosk "%URL%" ^
    --edge-kiosk-type=fullscreen ^
    --no-first-run ^
    --disable-session-crashed-bubble ^
    --user-data-dir="%EDGE_PROFILE%"
  exit /b 0
)

start "" "%URL%"
exit /b 0

:FindChrome
set "CHROME_EXE="
where /q chrome.exe && (
  for /f "delims=" %%C in ('where chrome.exe 2^>nul') do set "CHROME_EXE=%%C"
  goto :eof
)
if exist "%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%LOCALAPPDATA%\Google\Chrome\Application\chrome.exe" & goto :eof
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles%\Google\Chrome\Application\chrome.exe" & goto :eof
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME_EXE=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
goto :eof

:FindEdge
set "EDGE_EXE="
where /q msedge.exe && (
  for /f "delims=" %%E in ('where msedge.exe 2^>nul') do set "EDGE_EXE=%%E"
  goto :eof
)
if exist "%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%LOCALAPPDATA%\Microsoft\Edge\Application\msedge.exe" & goto :eof
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" & goto :eof
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" set "EDGE_EXE=%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
goto :eof
