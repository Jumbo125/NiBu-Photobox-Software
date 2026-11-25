@echo off
REM flash_muenz.bat - startet flash_pico.py mit der portablen python.exe
REM aus demselben Ordner (relativer Pfad ueber %~dp0, funktioniert
REM unabhaengig davon, wo dieser Ordner auf dem jeweiligen Rechner liegt).
REM
REM Benutzung:
REM   Doppelklick                 -> fragt interaktiv nach dem COM-Port
REM   flash_muenz.bat COM4        -> direkt ohne Rueckfrage
REM   flash_muenz.bat COM4 --skip-verify   -> Argumente werden durchgereicht
REM
REM Voraussetzung: python_server.py muss vorher beendet sein (Port sonst
REM belegt), siehe flash_pico.py.

setlocal
set "HERE=%~dp0"

if "%~1"=="" (
    set /p PICO_PORT="Serieller Port des Pi Pico (z.B. COM4): "
    "%HERE%python.exe" "%HERE%flash_pico.py" %PICO_PORT%
) else (
    "%HERE%python.exe" "%HERE%flash_pico.py" %*
)

echo.
pause
