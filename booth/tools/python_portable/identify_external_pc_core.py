# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
identify_external_pc_core.py — Identifiziert die serielle Schnittstelle
eines angeschlossenen Pi Pico ("Externer PC"-Bereich, ToF-Presence /
Münzprüfer) auf Windows und Linux.

Getrennt von pi_pico_core.py (laufender Presence-/Coin-Listener-Thread):
dieses Modul ist nur für das einmalige/gelegentliche Scannen und Prüfen der
seriellen Schnittstelle zuständig (ID?/ID:TOF_Muenzzaehler-Handshake).

Windows: Ports erscheinen als COMx.
Linux:   Ports erscheinen als /dev/ttyACM* (USB-CDC) bzw. /dev/ttyUSB*.
pyserial liefert auf beiden Plattformen bereits die korrekten Gerätepfade
(serial.tools.list_ports.comports()); der explizite OS-Check dient nur der
zusätzlichen Filterung unter Linux (Rauschen durch andere /dev/tty*-
Einträge vermeiden).
"""

from __future__ import annotations

from typing import Any, Dict, List

try:
    import serial
    import serial.tools.list_ports
except Exception as e:
    serial = None
    _PYSERIAL_IMPORT_ERROR = str(e)
else:
    _PYSERIAL_IMPORT_ERROR = ""

try:
    import pi_pico_core as _pi_pico_core
except Exception:
    _pi_pico_core = None

_ID_QUERY = b"ID?\n"
_ID_RESPONSE = "ID:TOF_Muenzzaehler"


def is_windows() -> bool:
    return _pi_pico_core.is_windows() if _pi_pico_core else False


def _candidate_ports() -> List[str]:
    ports = [p.device for p in serial.tools.list_ports.comports()]
    if is_windows():
        return ports  # COMx bereits korrekt vorgefiltert durch pyserial
    # Linux: nur Pico-typische USB-CDC/USB-Seriell-Devices berücksichtigen
    return [d for d in ports if "/ttyACM" in d or "/ttyUSB" in d]


def _probe_port(device: str, baudrate: int, timeout_sec: float) -> bool:
    try:
        with serial.Serial(device, baudrate, timeout=timeout_sec) as ser:
            ser.write(_ID_QUERY)
            resp = ser.readline().decode(errors="ignore").strip()
            return resp == _ID_RESPONSE
    except (serial.SerialException, OSError):
        return False


def _with_paused_listener(fn):
    """Pausiert pi_pico_core's Reader-Thread (falls aktiv) für exklusiven Portzugriff."""
    paused = False
    try:
        if _pi_pico_core is not None:
            paused = _pi_pico_core.pause_listener()
        return fn()
    finally:
        if paused and _pi_pico_core is not None:
            _pi_pico_core.resume_listener()


def list_identify(baudrate: int = 115200, timeout_sec: float = 0.5) -> Dict[str, Any]:
    """Scannt alle (ggf. OS-gefilterten) seriellen Ports nach dem Pi Pico."""
    if serial is None:
        return {"ok": False, "error": "pyserial_missing", "detail": _PYSERIAL_IMPORT_ERROR}

    def _scan() -> Dict[str, Any]:
        for device in _candidate_ports():
            if _probe_port(device, baudrate, timeout_sec):
                return {"ok": True, "port": device, "identified": True}
        return {"ok": True, "port": None, "identified": False}

    return _with_paused_listener(_scan)


def check_identify(port: str, baudrate: int = 115200, timeout_sec: float = 0.5) -> Dict[str, Any]:
    """Prüft gezielt, ob der Pi Pico über die übergebene Schnittstelle erreichbar ist."""
    if serial is None:
        return {"ok": False, "error": "pyserial_missing", "detail": _PYSERIAL_IMPORT_ERROR}

    port = str(port or "").strip()
    if not port:
        return {"ok": False, "error": "no_port_given"}

    def _check() -> Dict[str, Any]:
        reachable = _probe_port(port, baudrate, timeout_sec)
        return {"ok": True, "port": port, "reachable": reachable}

    return _with_paused_listener(_check)
