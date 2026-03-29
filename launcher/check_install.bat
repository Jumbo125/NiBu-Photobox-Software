@echo off
rem ------------------------------------------------------------
rem INSTALL-STATUS PRÜFEN (Datei-basiert)
rem
rem Diese Prüfung definiert „installiert“ bewusst simpel:
rem Es wird nur kontrolliert, ob alle im ops_manifest.json unter
rem `configs[].dst` aufgeführten Ziel-Dateien (typischerweise JSON-
rem Konfigurationsdateien) im Zielverzeichnis vorhanden sind.
rem
rem Ablauf:
rem  1) ops_manifest.json laden
rem  2) configs[].dst auslesen (Zielpfade relativ zum BaseDir)
rem  3) jede dst-Datei auf Existenz prüfen
rem  4) Ergebnis:
rem     - alle vorhanden  -> Ausgabe "INSTALLED" + Exitcode 0
rem     - mindestens eine fehlt -> Ausgabe "MISSING: <pfad>" + Exitcode 1
rem     - Manifest fehlt/Fehler -> Exitcode 2
rem
rem Hinweis:
rem Diese Prüfung sagt nichts über laufende Prozesse/Services,
rem Firewall-Regeln oder Task-Scheduler aus – dafür gibt es separate
rem Checks (z.B. Firewall/Task/Healthchecks).
rem ------------------------------------------------------------

setlocal EnableExtensions EnableDelayedExpansion


set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "BASEDIR=%%~fI"
cd /d "%BASEDIR%"

set "MANIFEST=%SCRIPT_DIR%ops_manifest.json"
if not exist "%MANIFEST%" (
  echo ERROR: ops_manifest.json missing: %MANIFEST%
  exit /b 2
)

set "MISSING=0"

rem configs[*].dst aus JSON lesen und Existenz prüfen
for /f "usebackq delims=" %%D in (`
  powershell -NoProfile -Command ^
    "$m=Get-Content '%MANIFEST%' -Raw|ConvertFrom-Json; $m.configs | %%{ $_.dst }"
`) do (
  set "DST=%%D"
  if not exist "!DST!" (
    set "MISSING=1"
    echo MISSING: !DST!
  )
)

if "%MISSING%"=="0" (
  echo INSTALLED
  exit /b 0
)

exit /b 1
