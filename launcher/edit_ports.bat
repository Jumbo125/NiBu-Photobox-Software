@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "JSON_FILE=%~dp0caddy_php_port.json"

set "NEW_CADDY="
set "NEW_PHP="
set "NOPAUSE="

:parse
if "%~1"=="" goto parsed
if /I "%~1"=="/caddy"   (set "NEW_CADDY=%~2" & shift & shift & goto parse)
if /I "%~1"=="/php"     (set "NEW_PHP=%~2"   & shift & shift & goto parse)
if /I "%~1"=="/nopause" (set "NOPAUSE=1"     & shift & goto parse)

if not defined NEW_CADDY (
  set "NEW_CADDY=%~1"
) else if not defined NEW_PHP (
  set "NEW_PHP=%~1"
)
shift
goto parse

:parsed
if not defined NEW_CADDY goto usage
if not defined NEW_PHP goto usage

call :ValidatePort "%NEW_CADDY%" || goto badport
call :ValidatePort "%NEW_PHP%"   || goto badport

if "%NEW_CADDY%"=="%NEW_PHP%" (
  echo [ERR] Caddy und PHP Port duerfen nicht gleich sein.
  exit /b 2
)

call :WriteJson "%JSON_FILE%" "%NEW_CADDY%" "%NEW_PHP%" || exit /b 3

echo [OK] caddy_php_port.json neu geschrieben:
type "%JSON_FILE%"
echo(
echo [INFO] Bridge/API und Python werden nicht hier geaendert.
echo [INFO] Dafuer bleiben ApiServer_settings.json und server_config.json massgeblich.

if defined NOPAUSE exit /b 0
pause
exit /b 0

:usage
echo Usage:
echo   %~nx0 /caddy 8050 /php 8051 [/nopause]
echo   %~nx0 8050 8051 [/nopause]
exit /b 1

:badport
echo [ERR] Ungueltige Ports: Caddy="%NEW_CADDY%" PHP="%NEW_PHP%"
exit /b 1

:ValidatePort
setlocal
set "P=%~1"
for /f "delims=0123456789" %%X in ("%P%") do exit /b 1
set /a N=%P% 2>nul || exit /b 1
if %N% LSS 1 exit /b 1
if %N% GTR 65535 exit /b 1
exit /b 0

:WriteJson
setlocal
set "JF=%~1"
set "C=%~2"
set "P=%~3"

>"%JF%"  echo {
>>"%JF%" echo   "CADDY_PORT": %C%,
>>"%JF%" echo   "PHP_PORT": %P%
>>"%JF%" echo }

exit /b 0
