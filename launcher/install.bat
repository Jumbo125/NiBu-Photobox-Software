@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
set "FLAG_NOPAUSE="
for %%A in (%*) do if /I "%%~A"=="/nopause" set "FLAG_NOPAUSE=1"

for %%I in ("%SCRIPT_DIR%..") do set "BASEDIR=%%~fI"

echo === INSTALL ===
echo.

rem -------------------------------------------------
rem VC++ Redistributable x64 pruefen und ggf. installieren
rem -------------------------------------------------
set "VC_REDIST=%SCRIPT_DIR%VC_redist.x64.exe"
call :CheckVCRedistX64
if errorlevel 1 (
  echo [INFO] Microsoft Visual C++ Redistributable 2015-2022 x64 ist nicht installiert.
  echo [HINWEIS] Diese Laufzeit wird fuer PHP unter Windows benoetigt.
  if exist "%VC_REDIST%" (
    echo [ACTION] Installiere VC_redist.x64.exe silent, bitte warten...
    "%VC_REDIST%" /install /quiet /norestart
    if errorlevel 1 (
      echo [ERR] VC++ Installation fehlgeschlagen ^(ExitCode=%ERRORLEVEL%^).
      echo [HINWEIS] Bitte VC_redist.x64.exe manuell installieren und danach neu starten.
      if not defined FLAG_NOPAUSE pause
      exit /b 20
    )
    echo [OK] VC++ erfolgreich installiert.
  ) else (
    echo [ERR] VC_redist.x64.exe wurde nicht neben install.bat gefunden.
    echo [HINWEIS] Datei hier ablegen: "%VC_REDIST%"
    if not defined FLAG_NOPAUSE pause
    exit /b 20
  )
)

rem -------------------------------------------------
rem Vorpruefung: bestimmte Dateien werden vor dem Install
rem durch Launcher.exe oder manuell erzeugt.
rem -------------------------------------------------
set "CADDY_JSON=%SCRIPT_DIR%caddy_php_port.json"
set "SERVERCFG=%SCRIPT_DIR%defaultConfig\server_config.json"
set "APICFG=%SCRIPT_DIR%defaultConfig\ApiServer_settings.json"
set "MISSING_PREP=0"

if not exist "%CADDY_JSON%" (
  echo [ERR] Datei nicht gefunden: %CADDY_JSON%
  if not defined FLAG_NOPAUSE pause
  exit /b 2
)

call :checkPreparedFile "defaultConfig\server_config.json"
call :checkPreparedFile "defaultConfig\ApiServer_settings.json"

if "%MISSING_PREP%"=="1" (
  echo.
  echo [ERR] install.bat wurde direkt gestartet, aber vorbereitete Dateien fehlen.
  echo [HINWEIS] Diese Dateien werden normalerweise vorher durch Launcher.exe erstellt.
  echo [HINWEIS] Bitte fehlende Dateien manuell anlegen oder die Installation ueber Launcher.exe starten.
  echo.
  if not defined FLAG_NOPAUSE pause
  exit /b 2
)

rem -----------------------------------
rem 1) Ports aus den JSON-Dateien lesen
rem -----------------------------------
set "CADDY_PORT="
set "PHP_PORT="
set "BRIDGE_PORT="
set "PY_PORT="

for /f "usebackq tokens=1* delims==" %%A in (`powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command ^
  "$ErrorActionPreference='Stop';" ^
  "$c = Get-Content -Raw '%CADDY_JSON%' | ConvertFrom-Json;" ^
  "$s = Get-Content -Raw '%SERVERCFG%' | ConvertFrom-Json;" ^
  "$a = Get-Content -Raw '%APICFG%' | ConvertFrom-Json;" ^
  "$caddy = if ($null -ne $c.CADDY_PORT) { [int]$c.CADDY_PORT } elseif ($null -ne $c.caddy_port) { [int]$c.caddy_port } elseif ($null -ne $c.caddyPort) { [int]$c.caddyPort } else { throw 'CADDY_PORT fehlt in caddy_php_port.json' };" ^
  "$php = if ($null -ne $c.PHP_PORT) { [int]$c.PHP_PORT } elseif ($null -ne $c.php_port) { [int]$c.php_port } elseif ($null -ne $c.phpPort) { [int]$c.phpPort } else { throw 'PHP_PORT fehlt in caddy_php_port.json' };" ^
  "$bridgeFromApi = [int]$a.Bridge.Port;" ^
  "$bridgeFromServer = [int]$s.port;" ^
  "$py = [int]$s.Python_ServerPort;" ^
  "if ($bridgeFromApi -ne $bridgeFromServer) { throw ('Bridge-Port ist inkonsistent: ApiServer_settings.json=' + $bridgeFromApi + ', server_config.json=' + $bridgeFromServer) }" ^
  "Write-Output ('CADDY_PORT=' + $caddy);" ^
  "Write-Output ('PHP_PORT=' + $php);" ^
  "Write-Output ('BRIDGE_PORT=' + $bridgeFromApi);" ^
  "Write-Output ('PY_PORT=' + $py);"`) do (
  set "%%A=%%B"
)

if errorlevel 1 (
  echo [ERR] Ports konnten aus den JSON-Dateien nicht gelesen werden.
  echo       Wahrscheinlich sind Platzhalter noch nicht ersetzt oder die JSON-Datei ist ungueltig.
  if not defined FLAG_NOPAUSE pause
  exit /b 3
)

if not defined CADDY_PORT (
  echo [ERR] CADDY_PORT konnte nicht ermittelt werden.
  if not defined FLAG_NOPAUSE pause
  exit /b 3
)
if not defined PHP_PORT (
  echo [ERR] PHP_PORT konnte nicht ermittelt werden.
  if not defined FLAG_NOPAUSE pause
  exit /b 3
)
if not defined BRIDGE_PORT (
  echo [ERR] BRIDGE_PORT konnte nicht ermittelt werden.
  if not defined FLAG_NOPAUSE pause
  exit /b 3
)
if not defined PY_PORT (
  echo [ERR] PY_PORT konnte nicht ermittelt werden.
  if not defined FLAG_NOPAUSE pause
  exit /b 3
)

echo [INFO] Ports:
echo        Caddy  = %CADDY_PORT%
echo        PHP    = %PHP_PORT%
echo        Bridge = %BRIDGE_PORT%
echo        Python = %PY_PORT%

rem ----------------------------------------------------------
rem 2) Default-Configs kopieren + __BASE_DIR__ ersetzen
rem ----------------------------------------------------------
powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%SCRIPT_DIR%copy_original_config.ps1" -BaseDir "%BASEDIR%" -LauncherDir "%SCRIPT_DIR%"
if errorlevel 1 (
  echo [ERR] copy_original_config fehlgeschlagen.
  if not defined FLAG_NOPAUSE pause
  exit /b 5
)

rem -----------------------------
rem 3) php.ini anpassen:
rem    - error_log
rem    - extension_dir
rem -----------------------------
set "PHP_INI=%SCRIPT_DIR%..\php\php.ini"

for %%I in ("%SCRIPT_DIR%..\logs") do set "LOG_DIR=%%~fI"
for %%I in ("%SCRIPT_DIR%..\logs\php_errors.log") do set "PHP_ERROR_LOG=%%~fI"
for %%I in ("%SCRIPT_DIR%..\php\ext") do set "PHP_EXT_DIR=%%~fI"

set "PHP_ERROR_LOG=%PHP_ERROR_LOG:\=/%"
set "PHP_EXT_DIR=%PHP_EXT_DIR:\=/%"

if not exist "%LOG_DIR%" mkdir "%LOG_DIR%"

if not exist "%PHP_INI%" (
  echo [ERR] php.ini nicht gefunden: %PHP_INI%
  if not defined FLAG_NOPAUSE pause
  exit /b 7
)

set "TMP_INI=%TEMP%\php_ini_%RANDOM%_%RANDOM%.tmp"
set "REPLACED="
set "REPLACED_EXT="

> "%TMP_INI%" (
  for /f "usebackq delims=" %%L in ("%PHP_INI%") do (
    set "LINE=%%L"
    setlocal EnableDelayedExpansion

    set "CHECK=!LINE!"
    for /f "tokens=* delims= " %%A in ("!CHECK!") do set "CHECK=%%A"

    if /I "!CHECK:~0,10!"=="error_log " (
      echo error_log = %PHP_ERROR_LOG%
      endlocal
      set "REPLACED=1"
    ) else if /I "!CHECK:~0,10!"=="error_log=" (
      echo error_log = %PHP_ERROR_LOG%
      endlocal
      set "REPLACED=1"
    ) else if /I "!CHECK:~0,11!"==";error_log " (
      echo error_log = %PHP_ERROR_LOG%
      endlocal
      set "REPLACED=1"
    ) else if /I "!CHECK:~0,11!"==";error_log=" (
      echo error_log = %PHP_ERROR_LOG%
      endlocal
      set "REPLACED=1"
    ) else if /I "!CHECK:~0,13!"=="extension_dir" (
      echo extension_dir = "%PHP_EXT_DIR%"
      endlocal
      set "REPLACED_EXT=1"
    ) else if /I "!CHECK:~0,14!"==";extension_dir" (
      echo extension_dir = "%PHP_EXT_DIR%"
      endlocal
      set "REPLACED_EXT=1"
    ) else (
      echo(!LINE!
      endlocal
    )
  )
)

if not defined REPLACED (
  >> "%TMP_INI%" echo error_log = %PHP_ERROR_LOG%
)

if not defined REPLACED_EXT (
  >> "%TMP_INI%" echo extension_dir = "%PHP_EXT_DIR%"
)

move /Y "%TMP_INI%" "%PHP_INI%" >nul
if errorlevel 1 (
  echo [ERR] php.ini konnte nicht aktualisiert werden.
  if exist "%TMP_INI%" del /Q "%TMP_INI%" >nul 2>&1
  if not defined FLAG_NOPAUSE pause
  exit /b 7
)

echo [OK] php.ini angepasst:
echo      error_log     = %PHP_ERROR_LOG%
echo      extension_dir = %PHP_EXT_DIR%

rem -----------------------------
rem 4) Restliche Install-Schritte
rem -----------------------------
call "%SCRIPT_DIR%unblock.bat" /nopause
if errorlevel 1 (
  echo [WARN] unblock.bat fehlgeschlagen ^(ExitCode=%ERRORLEVEL%^). Install wird fortgesetzt.
)

call "%SCRIPT_DIR%firewall_install.bat" /nopause
if errorlevel 1 (
  echo [ERR] firewall_install fehlgeschlagen ^(ExitCode=%ERRORLEVEL%^).
  if not defined FLAG_NOPAUSE pause
  exit /b 8
)

call "%SCRIPT_DIR%task_install.bat" /nopause
if errorlevel 1 (
  echo [ERR] task_install fehlgeschlagen ^(ExitCode=%ERRORLEVEL%^).
  if not defined FLAG_NOPAUSE pause
  exit /b 9
)

rem -----------------------------
rem 5) Desktop-Verknuepfung(en)
rem -----------------------------
echo [INFO] Erstelle Desktop-Verknuepfung(en)...
call "%SCRIPT_DIR%create_open_app_shortcut.bat" /nopause
if errorlevel 1 (
  echo [WARN] Shortcut-Erstellung fehlgeschlagen ^(ExitCode=%ERRORLEVEL%^). Install wird fortgesetzt.
) else (
  echo [OK] Desktop-Verknuepfung erstellt.
)

rem -----------------------------
rem 6) Edge-Hinweise deaktivieren
rem -----------------------------
set "EDGE_PS1=%SCRIPT_DIR%disable_edge_msg.ps1"
if exist "%EDGE_PS1%" (
  echo [INFO] Setze Edge-Richtlinien...
  powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File "%EDGE_PS1%"
  if errorlevel 1 (
    echo [WARN] disable_edge_msg.ps1 fehlgeschlagen ^(ExitCode=%ERRORLEVEL%^). Install wird fortgesetzt.
  ) else (
    echo [OK] Edge-Richtlinien gesetzt.
  )
) else (
  echo [WARN] Datei nicht gefunden: %EDGE_PS1%
)

echo === INSTALL fertig ===
if not defined FLAG_NOPAUSE pause
exit /b 0

:checkPreparedFile
if not exist "%SCRIPT_DIR%%~1" (
  echo [MISSING] %~1
  set "MISSING_PREP=1"
)
exit /b 0

:CheckVCRedistX64
reg query "HKLM\SOFTWARE\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >nul 2>&1
if not errorlevel 1 exit /b 0
reg query "HKLM\SOFTWARE\Wow6432Node\Microsoft\VisualStudio\14.0\VC\Runtimes\x64" /v Version >nul 2>&1
if not errorlevel 1 exit /b 0
exit /b 1
