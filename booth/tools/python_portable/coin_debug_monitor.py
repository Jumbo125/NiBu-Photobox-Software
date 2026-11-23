# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
coin_debug_monitor.py — Eigenstaendiges Diagnose-Tool fuer den Pi Pico
Muenzeinwurf. Oeffnet den seriellen Port DIREKT (ohne python_server.py) und
protokolliert JEDE Zeile, die vom Pico ankommt, mit Zeitstempel.

Zweck: Herausfinden, warum keine COIN:<cent>-Zeilen ankommen, obwohl
DISTANCE:/PRESENCE (ToF) funktioniert. Zeigt, ob der Pico ueberhaupt etwas
vom ST-001-Muenzpruefer empfaengt.

WICHTIG: Der serielle Port kann nur von einem Prozess gleichzeitig offen
sein. Vor dem Start dieses Skripts MUSS der laufende python_server.py
(Port 8053) beendet werden, sonst schlaegt das Oeffnen des Ports fehl
("Access is denied" / "could not open port").

Benutzung (auf dem Release-PC, im Ordner booth/tools/python_portable):
    python.exe coin_debug_monitor.py COM4
    python.exe coin_debug_monitor.py COM4 --baud 115200

Waehrend das Skript laeuft: Muenze(n) in den ST-001 einwerfen und
beobachten, was ausgegeben wird:
    - "COIN:<cent>" taucht auf           -> Pico empfaengt den Muenzpruefer
      korrekt, das Problem liegt NICHT am Pico/ST-001, sondern z.B. an
      coin_enabled=false in server_config.json oder am Server selbst.
    - GAR KEINE Zeile beim Muenzeinwurf  -> Pico bekommt nichts vom
      ST-001 (Verkabelung UART1/GP5, Stromversorgung ST-001, falsche
      Baudrate/Pins pruefen).
    - Irgendeine ANDERE Zeile/Mischmasch -> ST-001 sendet ein Format, das
      main.py (parse_st001_line) nicht erkennt -- Zeile hier im Log
      vergleichen mit dem erwarteten "value:<cent>,frequency:<...>".

Mit DEBUG=True in main.py auf dem Pico (vor main() testweise aendern)
sieht man zusaetzlich rohe UART1-Bytes als "DBG:ST001 raw: ..."-Zeilen.
Danach main.py wieder auf DEBUG=False zuruecksetzen, bevor der normale
Betrieb weiterlaeuft -- DEBUG-Ausgaben sind nicht fuer Produktivbetrieb
gedacht (Spam auf dem seriellen Kanal).

Beenden mit Strg+C.
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime

try:
    import serial
except ImportError:
    print("FEHLER: pyserial ist nicht verfuegbar in dieser Python-Installation.")
    print("Dieses Skript muss mit der portablen python.exe aus diesem Ordner")
    print("ausgefuehrt werden, z.B.: python.exe coin_debug_monitor.py COM4")
    sys.exit(1)


def ts() -> str:
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]


def classify(line: str) -> str:
    if line.startswith("COIN:"):
        return "MUENZE ERKANNT"
    if line.startswith("DISTANCE:"):
        return "ToF"
    if line == "PRESENCE":
        return "ToF (Altprotokoll)"
    if line.startswith("STATUS:"):
        return "Status"
    if line.startswith("DBG:"):
        return "Debug (Pico)"
    if line == "READY":
        return "Pico-Start"
    return "UNBEKANNT"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("port", help="Serieller Port des Pi Pico, z.B. COM4")
    parser.add_argument("--baud", type=int, default=115200, help="Baudrate (Default: 115200)")
    args = parser.parse_args()

    print(f"Oeffne {args.port} @ {args.baud} Baud ...")
    try:
        ser = serial.Serial(args.port, args.baud, timeout=1)
    except Exception as e:
        print(f"FEHLER beim Oeffnen von {args.port}: {e}")
        print()
        print("Haeufigste Ursache: python_server.py laeuft noch und haelt den")
        print("Port offen. Server zuerst beenden (Taskleiste/Taskmanager,")
        print("Prozess 'python.exe' bzw. den Autostart-Launcher), dann erneut")
        print("versuchen.")
        return 1

    print(f"Verbunden. Warte auf Zeilen vom Pico ... (Strg+C zum Beenden)")
    print(f"Jetzt eine Testmuenze in den ST-001 einwerfen.")
    print("-" * 70)

    coin_count = 0
    total_lines = 0
    try:
        while True:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode(errors="ignore").strip()
            if not line:
                continue
            total_lines += 1
            kind = classify(line)
            if kind == "MUENZE ERKANNT":
                coin_count += 1
            print(f"[{ts()}] [{kind:20s}] {line}")
    except KeyboardInterrupt:
        pass
    finally:
        ser.close()

    print("-" * 70)
    print(f"Beendet. Insgesamt {total_lines} Zeile(n) empfangen, davon {coin_count} COIN-Event(s).")
    if total_lines == 0:
        print()
        print("=> Es kam UEBERHAUPT KEINE Zeile vom Pico an, auch kein READY/")
        print("   DISTANCE/PRESENCE. Pruefen: richtiger COM-Port? USB-Kabel?")
        print("   Pico eingeschaltet/laeuft die Firmware?")
    elif coin_count == 0:
        print()
        print("=> ToF/Status-Zeilen kamen an, aber KEIN COIN-Event, obwohl eine")
        print("   Muenze eingeworfen wurde. Der Fehler liegt zwischen ST-001 und")
        print("   Pico: UART1-Verkabelung (GP5=RX), Stromversorgung des ST-001,")
        print("   oder das vom ST-001 gesendete Format weicht vom erwarteten")
        print("   'value:<cent>,frequency:<...>' ab (main.py: parse_st001_line).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
