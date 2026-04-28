@echo off
setlocal EnableExtensions
set "SCRIPT_DIR=%~dp0"

REM Kompatibilitaets-Wrapper:
REM Alte Verknuepfungen duerfen weiterhin open_app.bat aufrufen,
REM aber gestartet wird ab jetzt die neue Kiosk-Logik mit Fotobox.WebView2Host.exe.
call "%SCRIPT_DIR%Kiosk_WaitAndStart.cmd" %*
exit /b %ERRORLEVEL%
