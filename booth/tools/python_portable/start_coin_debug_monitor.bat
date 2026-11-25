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

"%SCRIPT_DIR%python.exe" "%SCRIPT_DIR%coin_debug_monitor.py" %COMPORT% --debug-on
pause
endlocal
