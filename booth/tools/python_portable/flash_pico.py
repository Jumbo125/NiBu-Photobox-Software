# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
flash_pico.py — Kopiert main.py und lib/vl53l1x.py auf den Pi Pico (TOF/
Muenzzaehler) ueber die bestehende USB-Serial-Verbindung (mpremote).

KEIN BOOTSEL, KEIN UF2, KEIN AUSBAUEN DES PICO NOETIG: main.py und
lib/vl53l1x.py sind normale Dateien auf dem MicroPython-Dateisystem, keine
Firmware -- solange MicroPython bereits laeuft (das ist bei einem bereits
verbauten Pico immer der Fall), reicht die normale USB-Verbindung.

Voraussetzung: mpremote ist in dieser portablen Python-Installation
installiert (einmalig, braucht Internet):
    python.exe -m pip install mpremote

Pfad zum Pico-Projektordner (main.py / lib/vl53l1x.py):
Wird NICHT hier im Skript hartcodiert, sondern aus flash_pico_config.txt
(selber Ordner) gelesen -- dieser Pfad ist auf jedem Rechner (Dev-PC,
Release-PC, ...) unterschiedlich. Siehe Kommentare in
flash_pico_config.txt. Alternativ per --project-dir/--main/--lib
ueberschreibbar, ohne die Config-Datei anzufassen.

WICHTIG: Der serielle Port kann nur von einem Prozess gleichzeitig offen
sein. Vor dem Start dieses Skripts MUSS der laufende python_server.py
beendet werden (gleiche Einschraenkung wie bei coin_debug_monitor.py),
sonst schlaegt mpremote mit einem Port-Fehler fehl.

Benutzung (im Ordner booth/tools/python_portable):
    python.exe flash_pico.py COM4
    python.exe flash_pico.py COM4 --baud 115200
    python.exe flash_pico.py COM4 --project-dir "C:\\...\\NiBu Muenz_TOF"
    python.exe flash_pico.py COM4 --main "C:\\...\\main.py" --lib "C:\\...\\vl53l1x.py"
    python.exe flash_pico.py COM4 --skip-verify

Ablauf:
    1. legt /lib auf dem Pico an (falls noch nicht vorhanden)
    2. kopiert main.py -> :main.py
    3. kopiert lib/vl53l1x.py -> :lib/vl53l1x.py
    4. soft-resettet den Pico (main.py wird automatisch neu ausgefuehrt)
    5. liest kurz mit, ob READY vom Pico zurueckkommt (Bestaetigung)

Nach erfolgreichem Flash: python_server.py wieder starten.
"""

from __future__ import annotations

import argparse
import subprocess
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
CONFIG_FILE = HERE / "flash_pico_config.txt"


def read_project_dir_from_config() -> Path | None:
    """
    Liest PICO_PROJECT_DIR=<pfad> aus flash_pico_config.txt (selber
    Ordner). Diese Datei ist pro Rechner unterschiedlich und wird
    absichtlich nicht im Skript hartcodiert -- siehe Kommentare in der
    Config-Datei selbst.
    """
    if not CONFIG_FILE.is_file():
        return None

    for raw_line in CONFIG_FILE.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        if key.strip() == "PICO_PROJECT_DIR":
            value = value.strip()
            return Path(value) if value else None
    return None


def mpremote_available() -> bool:
    try:
        import mpremote  # noqa: F401
    except ImportError:
        return False
    return True


def run_mpremote(port: str, *args: str) -> subprocess.CompletedProcess:
    cmd = [sys.executable, "-m", "mpremote", "connect", port, *args]
    print("  $ " + " ".join(cmd))
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip())
    return result


def wait_for_ready(port: str, baud: int, timeout_sec: float = 10.0) -> bool:
    """
    Oeffnet den Port nach dem Reset erneut und wartet auf READY.
    Der Pico/USB-CDC braucht nach einem Reset unter Windows unterschiedlich
    lang, um sich wieder zu melden (Reenumeration) -- das kann sogar noch
    passieren, NACHDEM der Port schon erfolgreich geoeffnet wurde (das
    Handle wird dann beim naechsten read() ungueltig). Deshalb wird nicht
    nur das Oeffnen, sondern der komplette Open-+Read-Versuch wiederholt,
    bis entweder READY ankommt oder das Zeitbudget aufgebraucht ist.
    """
    try:
        import serial
    except ImportError:
        print("Hinweis: pyserial nicht verfuegbar, kann READY nicht automatisch pruefen.")
        return False

    deadline = time.monotonic() + timeout_sec
    ok = False

    while not ok and time.monotonic() < deadline:
        ser = None
        try:
            ser = serial.Serial(port, baud, timeout=1)
            while time.monotonic() < deadline:
                line = ser.readline().decode(errors="ignore").strip()
                if not line:
                    continue
                print(f"  Pico: {line}")
                if line == "READY":
                    ok = True
                    break
        except Exception:
            # Port gerade am (Re-)Enumerieren -- kurz warten, erneut
            # versuchen statt abzubrechen.
            time.sleep(0.5)
        finally:
            if ser is not None:
                try:
                    ser.close()
                except Exception:
                    pass

    if not ok:
        print(f"WARNUNG: Keine READY-Zeile innerhalb von {timeout_sec:.0f}s empfangen.")
    return ok


def main() -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("port", help="Serieller Port des Pi Pico, z.B. COM4")
    parser.add_argument("--baud", type=int, default=115200, help="Baudrate fuer die READY-Pruefung (Default: 115200)")
    parser.add_argument(
        "--project-dir", type=Path, default=None,
        help="Pico-Projektordner (enthaelt main.py und lib/vl53l1x.py). "
             "Default: PICO_PROJECT_DIR aus flash_pico_config.txt.",
    )
    parser.add_argument("--main", type=Path, default=None, help="Pfad zur lokalen main.py (ueberschreibt --project-dir)")
    parser.add_argument("--lib", type=Path, default=None, help="Pfad zur lokalen lib/vl53l1x.py (ueberschreibt --project-dir)")
    parser.add_argument("--skip-verify", action="store_true", help="Nach dem Reset nicht auf READY warten")
    args = parser.parse_args()

    project_dir = args.project_dir or read_project_dir_from_config()
    if args.main is not None:
        main_path = args.main
    elif project_dir is not None:
        main_path = project_dir / "main.py"
    else:
        main_path = None

    if args.lib is not None:
        lib_path = args.lib
    elif project_dir is not None:
        lib_path = project_dir / "lib" / "vl53l1x.py"
    else:
        lib_path = None

    if main_path is None or lib_path is None:
        print(f"FEHLER: Kein Pico-Projektordner bekannt (weder --project-dir/--main/--lib noch {CONFIG_FILE.name} vorhanden).")
        print()
        print(f"Bitte in {CONFIG_FILE} eintragen, z.B.:")
        print(r"    PICO_PROJECT_DIR=C:\Users\<du>\Documents\arduino_platform_ide\NiBu Muenz_TOF")
        print(f"(Datei existiert bereits als Vorlage: {CONFIG_FILE})" if CONFIG_FILE.is_file() else "(Datei muss neu angelegt werden)")
        return 1
    args.main = main_path
    args.lib = lib_path

    if not mpremote_available():
        print("FEHLER: mpremote ist nicht installiert in dieser Python-Installation.")
        print("Einmalig installieren mit:")
        print("    python.exe -m pip install mpremote")
        return 1

    if not args.main.is_file():
        print(f"FEHLER: main.py nicht gefunden: {args.main}")
        return 1
    if not args.lib.is_file():
        print(f"FEHLER: lib/vl53l1x.py nicht gefunden: {args.lib}")
        return 1

    print(f"main.py : {args.main}")
    print(f"lib     : {args.lib}")
    print(f"Port    : {args.port}")
    print()
    print("Hinweis: python_server.py muss gestoppt sein, sonst ist der Port belegt.")
    print()

    print("1) Lege /lib auf dem Pico an (falls noch nicht vorhanden) ...")
    run_mpremote(args.port, "fs", "mkdir", "lib")
    # Nicht fatal werten: "existiert bereits" ist der haeufigste Fehlerfall
    # und voellig normal nach dem ersten Flash. Ein echtes Problem (Port
    # belegt o.ae.) faellt spaetestens beim naechsten Schritt (cp) auf.

    print("2) Kopiere main.py ...")
    result = run_mpremote(args.port, "fs", "cp", str(args.main), ":main.py")
    if result.returncode != 0:
        print("FEHLER beim Kopieren von main.py. Laeuft noch python_server.py und haelt den Port offen?")
        return 1

    print("3) Kopiere lib/vl53l1x.py ...")
    result = run_mpremote(args.port, "fs", "cp", str(args.lib), ":lib/vl53l1x.py")
    if result.returncode != 0:
        print("FEHLER beim Kopieren von lib/vl53l1x.py.")
        return 1

    print("4) Soft-Reset (main.py wird automatisch neu gestartet) ...")
    result = run_mpremote(args.port, "reset")
    if result.returncode != 0:
        print("WARNUNG: Reset ueber mpremote fehlgeschlagen -- Pico ggf. manuell per USB neu stecken.")

    if args.skip_verify:
        print()
        print("Fertig (ohne READY-Pruefung, --skip-verify gesetzt).")
        print("Nicht vergessen: python_server.py wieder starten.")
        return 0

    print("5) Warte auf READY vom Pico ...")
    ok = wait_for_ready(args.port, args.baud)

    print()
    if ok:
        print("=> Flash erfolgreich, Pico meldet READY.")
    else:
        print("=> KEIN READY innerhalb von 5s empfangen. Pico/Verkabelung pruefen,")
        print("   z.B. mit coin_debug_monitor.py.")
    print()
    print("Nicht vergessen: python_server.py wieder starten.")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
