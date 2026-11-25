@echo off
setlocal
set "SCRIPT_DIR=%~dp0"

set "COMPORT="
set /p COMPORT=COM-Port des Pi Pico eingeben (z.B. COM4):
if "%COMPORT%"=="" (
    echo Kein COM-Port angegeben, Abbruch.
    pause
    exit /b 1
)

set "DEBUG_CHOICE="
set /p DEBUG_CHOICE=Debug-Modus auf dem Pico aktivieren? (0=Nein, 1=Ja):
set "DEBUG_FLAG="
if "%DEBUG_CHOICE%"=="1" (
    set "DEBUG_FLAG=--debug-on"
    echo.
    echo DEBUG-Modus aktiv: Dieses Fenster UNBEDINGT mit Strg+C beenden, NICHT wegklicken!
    echo Nur Strg+C sendet DEBUG:OFF an den Pico zurueck. Sonst bleibt DEBUG
    echo dauerhaft an, bis es manuell per --debug-off zurueckgesetzt oder der
    echo Pico neu gestartet wird.
    echo.
)

"%SCRIPT_DIR%python.exe" "%SCRIPT_DIR%coin_debug_monitor.py" %COMPORT% %DEBUG_FLAG%
pause
endlocal
