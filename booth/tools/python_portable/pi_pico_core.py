# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
pi_pico_core.py — Liest Präsenz-Events von einem Pi Pico (USB-seriell,
ToF-Sensor VL53L1X) und triggert LiveView-Vorwärmung über die CameraBridge,
bevor der Nutzer den Start-Button drückt.

Protokoll (seriell, eine Zeile pro Event):
  - "DISTANCE:<mm>\n" (bevorzugt): Pico sendet die rohe Distanz in
    Millimetern, ohne selbst über Präsenz zu entscheiden. Die
    WebUI-einstellbare Schwelle (external_pc.distance_threshold_mm) wird
    serverseitig in diesem Modul ausgewertet — Vorteil: Die Schwelle lässt
    sich ändern, ohne die Pico-Firmware neu zu flashen.
  - "PRESENCE\n" (Altprotokoll, weiterhin unterstützt): Pico hat bereits
    selbst entschieden (Firmware-seitige Schwelle). Wird wie ein einzelner
    Distanz-Wert unterhalb der Schwelle behandelt.

Ablauf:
  1. Serieller Reader-Thread liest Zeilen vom Pi Pico.
  2. Bei DISTANCE: Serverseitiger Schwellenwert-Vergleich
     (external_pc.distance_threshold_mm) mit Flankenerkennung — nur der
     Übergang "außerhalb Reichweite" → "innerhalb Reichweite" löst aus,
     nicht jede einzelne Distanzmeldung unterhalb der Schwelle (der Pico
     sendet die Distanz vermutlich kontinuierlich, z.B. jede Sekunde).
  3. Cooldown prüfen (verhindert Pingpong mit liveview_max_runtime_minutes-
     Zwangsstopp und unnötige HTTP-Last). Bei DISTANCE-Protokoll gilt ein
     eigener, standardmäßig höherer Cooldown
     (external_pc.distance_cooldown_sec) als beim reinen PRESENCE-Flag,
     da die Flankenerkennung selbst schon Wiederholungen filtert, aber der
     HTTP-Call trotzdem nicht bei jeder kurzen Bewegung vor dem Sensor neu
     feuern soll.
  4. Wenn Cooldown abgelaufen: HTTP POST an CameraBridge
     (http://127.0.0.1:<bridge_port>/api/liveview/start). Der Bridge-Port
     wird nicht hier konfiguriert, sondern zur Laufzeit aus
     ../camerabridge/APIServer/ApiServer_settings.json (Bridge.Port)
     gelesen — bleibt bei einer Port-Änderung dort automatisch korrekt.
  5. CameraBridge/Worker ist idempotent — kein Schaden bei redundanten Calls.

Reconnect: Serielle Verbindung kann bei USB-Aussetzern abreißen — Reader-
Thread verbindet bei Verbindungsverlust automatisch neu (Retry mit Backoff).

pyserial ist ein optionales Import (wie pywin32/Pillow in printer_core.py):
fehlt es, wird das Feature weich deaktiviert und nur geloggt.
"""

from __future__ import annotations

import json
import os
import platform
import sys
import threading
import time
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Any, Dict, Optional

try:
    import serial  # pyserial
except Exception as e:
    serial = None
    _PYSERIAL_IMPORT_ERROR = str(e)
else:
    _PYSERIAL_IMPORT_ERROR = ""

try:
    import credit_core as _credit_core
except Exception as e:
    _credit_core = None
    _CREDIT_CORE_IMPORT_ERROR = str(e)
else:
    _CREDIT_CORE_IMPORT_ERROR = ""


def is_windows() -> bool:
    return os.name == "nt" or sys.platform.startswith("win")


def is_linux() -> bool:
    return sys.platform.startswith("linux")


def default_serial_port() -> str:
    """Plattformtypischer Default-Port, falls in der Config keiner gesetzt ist."""
    if is_windows():
        return "COM5"
    if is_linux():
        return "/dev/ttyACM0"
    return ""


HERE = os.path.dirname(os.path.abspath(__file__))
_BRIDGE_SETTINGS_PATH = os.path.join(HERE, "..", "camerabridge", "APIServer", "ApiServer_settings.json")
_DEFAULT_BRIDGE_PORT = 8052

# Dediziertes Append-Log für ToF-Trigger-Versuche (Klartext, .log — keine
# JSON-Datei, um Verwechslung mit Zustandsdateien wie credit.json zu
# vermeiden) — eine Zeile pro Trigger-Versuch mit Zeitstempel und der zu
# diesem Zeitpunkt erkannten Distanz. Wichtig: Ein Eintrag mit "sent"
# bedeutet nur, dass der HTTP-POST an die CameraBridge erfolgreich
# abgesetzt wurde — ob der Worker den Befehl tatsächlich ausführt oder
# intern verwirft (z.B. weil LiveView schon läuft), liefert keine
# Response an Python zurück und kann daher hier nicht protokolliert
# werden. Es können also mehr "sent"-Zeilen auftauchen, als tatsächlich
# vom Worker umgesetzte LiveView-Starts.
TOF_TRIGGER_LOG_FILE = os.path.join(HERE, "logs", "tof_trigger_log.log")


def _append_tof_trigger_log(event: str, distance_mm: Optional[int] = None, **extra: Any) -> None:
    try:
        directory = os.path.dirname(TOF_TRIGGER_LOG_FILE)
        os.makedirs(directory, exist_ok=True)
        ts = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")
        parts = [ts, event, f"distance_mm={distance_mm if distance_mm is not None else '-'}"]
        for key, value in extra.items():
            parts.append(f"{key}={value}")
        line = " | ".join(parts)
        with open(TOF_TRIGGER_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def _read_bridge_settings() -> Dict[str, Any]:
    try:
        with open(_BRIDGE_SETTINGS_PATH, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
        return data.get("Bridge", {}) if isinstance(data, dict) else {}
    except Exception:
        return {}


def _resolve_bridge_liveview_start_url() -> str:
    """
    Leitet die CameraBridge-URL dynamisch aus deren eigener Settings-Datei
    (Bridge.Port in ApiServer_settings.json) ab, statt den Port hier
    hart zu kodieren — bleibt bei einer Port-Änderung dort automatisch
    korrekt. Fällt bei fehlender/unlesbarer Datei auf den Standardport zurück.
    """
    bridge = _read_bridge_settings()
    port = int(bridge.get("Port") or _DEFAULT_BRIDGE_PORT)
    return f"http://127.0.0.1:{port}/api/liveview/start"


def _resolve_bridge_api_key() -> str:
    """
    CameraBridge verlangt für alle Endpoints außer wenigen öffentlichen
    (siehe bridge_api.js-Kommentar) den X-Api-Key-Header, sonst 401
    Unauthorized -- genau wie capture_api.js ihn beim regulären Start-Klick
    mitschickt (Bridge.AuthKey aus ApiServer_settings.json).
    """
    bridge = _read_bridge_settings()
    return str(bridge.get("AuthKey") or "").strip()


# Exklusiver Portzugriff, geteilt mit identify_external_pc_core.py: Der
# Reader-Thread hält diesen Lock nur kurz beim (Wieder-)Öffnen des Ports.
# identify_external_pc_core.py pausiert den Reader-Thread (pause/resume)
# und nimmt den Lock währenddessen, um Portkonflikte zu vermeiden.
PORT_ACCESS_LOCK = threading.Lock()

_STATE_LOCK = threading.Lock()
_state: Dict[str, Any] = {
    "running": False,
    "connected": False,
    "os": platform.system().lower(),
    "last_presence_ts": None,
    "last_distance_mm": None,
    "in_range": False,
    "last_trigger_ts": None,
    "last_coin_ts": None,
    "last_credit_cent": None,
    "last_error": "",
}

_last_trigger_monotonic: Optional[float] = None
_cooldown_lock = threading.Lock()

_DEFAULT_DISTANCE_THRESHOLD_MM = 800
_DEFAULT_DISTANCE_COOLDOWN_SEC = 180  # höher als der PRESENCE-Cooldown (90s):
# die Flankenerkennung filtert zwar bereits Wiederholungen, aber ein
# kontinuierlicher Distanz-Stream (statt einzelnem Debounce-Event vom Pico)
# erzeugt tendenziell mehr Flanken (z.B. Person tritt kurz zurück/vor).

_in_range_lock = threading.Lock()
_was_in_range: bool = False

_stop_event = threading.Event()
_pause_event = threading.Event()
_reader_thread: Optional[threading.Thread] = None

# Laufzeit-Flags, getrennt aktivierbar über die WebUI (/pi_pico/tof/enable
# bzw. /pi_pico/coin/enable) — wirken sofort auf den laufenden Reader-
# Thread, ohne dass der Python-Server neu gestartet werden muss. Der
# serielle Listener selbst läuft, sobald mindestens eines von beiden
# true ist; welche Zeilentypen dabei tatsächlich verarbeitet werden,
# filtert der Reader-Loop anhand dieser beiden Flags.
_flags_lock = threading.Lock()
_tof_enabled: bool = False
_coin_enabled: bool = False


def _set_runtime_flags(tof_enabled: bool, coin_enabled: bool) -> None:
    global _tof_enabled, _coin_enabled
    with _flags_lock:
        _tof_enabled = bool(tof_enabled)
        _coin_enabled = bool(coin_enabled)


def get_runtime_flags() -> Dict[str, bool]:
    with _flags_lock:
        return {"tof_enabled": _tof_enabled, "coin_enabled": _coin_enabled}


def set_tof_enabled(enabled: bool) -> None:
    """Wirkt sofort auf den laufenden Reader-Thread (falls aktiv)."""
    global _tof_enabled
    with _flags_lock:
        _tof_enabled = bool(enabled)


def set_coin_enabled(enabled: bool) -> None:
    """Wirkt sofort auf den laufenden Reader-Thread (falls aktiv)."""
    global _coin_enabled
    with _flags_lock:
        _coin_enabled = bool(enabled)


# Capture-Unterdrückung: capture_flow.js meldet Start/Ende eines Capture-
# Vorgangs an python_server.py (POST /pico/capture_state), das hierüber
# _capture_active setzt. _trigger_liveview_warmup() unterdrückt Trigger,
# solange ein Capture läuft — ein ToF-ausgelöster StartLiveView-IPC-Call
# an die CameraBridge während eines laufenden CapturePhoto()-Zyklus
# konkurriert sonst um dieselbe Kamera-Hardware ("MTP device busy").
# _capture_active_since dient als Sicherheitsnetz: läuft die "Ende"-Meldung
# nie ein (Browser-Reload/Absturz mitten im Capture), verfällt die Sperre
# nach CAPTURE_ACTIVE_MAX_AGE_SEC von selbst, statt ToF dauerhaft stummzuschalten.
CAPTURE_ACTIVE_MAX_AGE_SEC = 120.0
_capture_lock = threading.Lock()
_capture_active: bool = False
_capture_active_since: Optional[float] = None


def set_capture_active(active: bool) -> None:
    global _capture_active, _capture_active_since
    with _capture_lock:
        _capture_active = bool(active)
        _capture_active_since = time.monotonic() if _capture_active else None


def is_capture_active() -> bool:
    with _capture_lock:
        if not _capture_active:
            return False
        if _capture_active_since is not None and (time.monotonic() - _capture_active_since) > CAPTURE_ACTIVE_MAX_AGE_SEC:
            return False
        return True


def _log(log_fn, event: str, message: str = "", **data: Any) -> None:
    if log_fn is None:
        return
    try:
        log_fn(event, message, **data)
    except Exception:
        pass


def _update_state(**kwargs: Any) -> None:
    with _STATE_LOCK:
        _state.update(kwargs)


def get_status() -> Dict[str, Any]:
    with _STATE_LOCK:
        status = dict(_state)
    status.update(get_runtime_flags())
    return status


def _trigger_liveview_warmup(bridge_url: str, cooldown_sec: float, distance_mm: Optional[int] = None, log_warning=None, log_event=None) -> bool:
    """
    Cooldown-gated HTTP POST an die CameraBridge. Gibt True zurück, wenn
    getriggert wurde. distance_mm (falls bekannt, sonst None bei PRESENCE)
    wird für jeden Versuch in TOF_TRIGGER_LOG_FILE protokolliert — siehe
    Doku dort zur Grenze dieses Logs (kein Worker-Response bekannt).
    """
    global _last_trigger_monotonic

    if is_capture_active():
        _append_tof_trigger_log("capture_active_suppressed", distance_mm=distance_mm)
        return False

    now = time.monotonic()
    with _cooldown_lock:
        if _last_trigger_monotonic is not None and (now - _last_trigger_monotonic) < cooldown_sec:
            _append_tof_trigger_log("cooldown_blocked", distance_mm=distance_mm)
            return False
        _last_trigger_monotonic = now

    try:
        headers = {}
        api_key = _resolve_bridge_api_key()
        if api_key:
            headers["X-Api-Key"] = api_key
        req = urllib.request.Request(bridge_url, data=b"", method="POST", headers=headers)
        with urllib.request.urlopen(req, timeout=3) as resp:
            resp.read()
        _update_state(last_trigger_ts=time.time())
        _log(log_event, "pi_pico_liveview_triggered", "ToF presence triggered liveview warmup", bridge_url=bridge_url)
        _append_tof_trigger_log("sent", distance_mm=distance_mm, bridge_url=bridge_url)
        return True
    except (urllib.error.URLError, OSError) as e:
        _update_state(last_error=str(e))
        _log(log_warning, "pi_pico_liveview_trigger_failed", "Could not reach CameraBridge for warmup", bridge_url=bridge_url, error=str(e))
        _append_tof_trigger_log("send_failed", distance_mm=distance_mm, bridge_url=bridge_url, error=str(e))
        return False


def _reset_distance_edge_state() -> None:
    """Bei Reconnect/Pause: verhindert, dass der erste DISTANCE-Wert nach
    einer Unterbrechung fälschlich als 'kein neuer Übergang' gilt."""
    global _was_in_range
    with _in_range_lock:
        _was_in_range = False


def _handle_distance_line(distance_mm: int, threshold_mm: float, bridge_url: str, cooldown_sec: float, log_warning=None, log_event=None) -> None:
    """Flankenerkennung: nur der Übergang außerhalb -> innerhalb Reichweite triggert."""
    global _was_in_range

    now_in_range = distance_mm <= threshold_mm
    _update_state(last_distance_mm=distance_mm, in_range=now_in_range)

    with _in_range_lock:
        rising_edge = now_in_range and not _was_in_range
        _was_in_range = now_in_range

    if rising_edge:
        _update_state(last_presence_ts=time.time())
        _trigger_liveview_warmup(bridge_url, cooldown_sec, distance_mm=distance_mm, log_warning=log_warning, log_event=log_event)


def _handle_coin_line(line: str, log_warning=None, log_event=None) -> None:
    """Parst 'COIN:<cent>' und delegiert an credit_core.add_credit(). Kein
    Zusammenzählen hier — pi_pico_core.py kennt keine Guthaben-Logik,
    reines Parsen und Weiterreichen (siehe Modul-Trennung credit_core.py)."""
    if _credit_core is None:
        _log(log_warning, "pi_pico_credit_core_missing", "credit_core not available, coin event dropped", line=line, error=_CREDIT_CORE_IMPORT_ERROR)
        return

    try:
        amount_cent = int(line.split(":", 1)[1])
    except (ValueError, IndexError):
        _log(log_warning, "pi_pico_coin_parse_failed", "Could not parse COIN line", line=line)
        return

    _update_state(last_coin_ts=time.time())
    new_balance = _credit_core.add_credit(amount_cent, log_warning=log_warning, log_event=log_event)
    if new_balance is not None:
        _update_state(last_credit_cent=new_balance)


def _serial_reader_loop(port: str, baudrate: int, bridge_url: str, cooldown_sec: float, distance_threshold_mm: float, distance_cooldown_sec: float, log_warning=None, log_event=None) -> None:
    backoff = 1.0
    while not _stop_event.is_set():
        if _pause_event.is_set():
            _update_state(connected=False)
            if _stop_event.wait(0.2):
                break
            continue

        try:
            with PORT_ACCESS_LOCK:
                if _stop_event.is_set() or _pause_event.is_set():
                    continue
                ser = serial.Serial(port, baudrate, timeout=1)
            try:
                _update_state(connected=True, last_error="")
                _reset_distance_edge_state()
                _log(log_event, "pi_pico_serial_connected", "Connected to Pi Pico", port=port, baudrate=baudrate)
                backoff = 1.0
                while not _stop_event.is_set() and not _pause_event.is_set():
                    line = ser.readline().decode(errors="ignore").strip()
                    if not line:
                        continue
                    flags = get_runtime_flags()
                    if line.startswith("DISTANCE:"):
                        if not flags["tof_enabled"]:
                            continue
                        try:
                            distance_mm = int(line.split(":", 1)[1])
                        except (ValueError, IndexError):
                            _log(log_warning, "pi_pico_distance_parse_failed", "Could not parse DISTANCE line", line=line)
                            continue
                        _handle_distance_line(
                            distance_mm, distance_threshold_mm, bridge_url, distance_cooldown_sec,
                            log_warning=log_warning, log_event=log_event,
                        )
                    elif line == "PRESENCE":
                        if not flags["tof_enabled"]:
                            continue
                        _update_state(last_presence_ts=time.time())
                        _trigger_liveview_warmup(bridge_url, cooldown_sec, log_warning=log_warning, log_event=log_event)
                    elif line.startswith("COIN:"):
                        if not flags["coin_enabled"]:
                            continue
                        _handle_coin_line(line, log_warning=log_warning, log_event=log_event)
            finally:
                ser.close()
        except (serial.SerialException, OSError) as e:
            _update_state(connected=False, last_error=str(e))
            _log(log_warning, "pi_pico_serial_error", "Pi Pico serial connection lost/unavailable", port=port, error=str(e))
        if _stop_event.wait(backoff):
            break
        backoff = min(backoff * 2, 30.0)


def pause_listener(timeout: float = 3.0) -> bool:
    """
    Pausiert den Reader-Thread kurz (für identify_external_pc_core.py, damit
    der Port exklusiv geöffnet werden kann). Gibt True zurück, sobald der
    Port sicher freigegeben ist (oder wenn kein Thread läuft).
    """
    if _reader_thread is None or not _reader_thread.is_alive():
        return True
    _pause_event.set()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        with _STATE_LOCK:
            if not _state.get("connected"):
                return True
        time.sleep(0.05)
    return not _state.get("connected", False)


def resume_listener() -> None:
    _pause_event.clear()


def start_pico_listener(config: Dict[str, Any], log_warning=None, log_event=None) -> Dict[str, Any]:
    """
    Startet den Background-Reader-Thread, wenn external_pc.tof_enabled oder
    external_pc.coin_enabled true ist in config und pyserial verfügbar ist.
    Nicht-fatal bei fehlendem Pico/pyserial. Welche Zeilentypen tatsächlich
    verarbeitet werden, steuert get_runtime_flags() zur Laufzeit — separat
    für ToF (PRESENCE/DISTANCE) und Coin (COIN:), über set_tof_enabled()/
    set_coin_enabled() auch nachträglich ohne Server-Neustart änderbar.
    """
    global _reader_thread

    pico_cfg = config.get("external_pc") if isinstance(config, dict) else None
    pico_cfg = pico_cfg if isinstance(pico_cfg, dict) else {}

    tof_enabled = bool(pico_cfg.get("tof_enabled"))
    coin_enabled = bool(pico_cfg.get("coin_enabled"))
    _set_runtime_flags(tof_enabled, coin_enabled)

    if not (tof_enabled or coin_enabled):
        return {"ok": True, "started": False, "reason": "disabled"}

    if serial is None:
        _log(log_warning, "pi_pico_pyserial_missing", "pyserial not available, ToF pretrigger disabled", error=_PYSERIAL_IMPORT_ERROR)
        return {"ok": False, "started": False, "error": "pyserial_missing", "detail": _PYSERIAL_IMPORT_ERROR}

    if _reader_thread is not None and _reader_thread.is_alive():
        return {"ok": True, "started": False, "reason": "already_running"}

    port = str(pico_cfg.get("serial_port") or "").strip() or default_serial_port()
    baudrate = int(pico_cfg.get("baudrate") or 115200)
    cooldown_sec = float(pico_cfg.get("cooldown_sec") or 90)
    distance_threshold_mm = float(pico_cfg.get("distance_threshold_mm") or _DEFAULT_DISTANCE_THRESHOLD_MM)
    distance_cooldown_sec = float(pico_cfg.get("distance_cooldown_sec") or _DEFAULT_DISTANCE_COOLDOWN_SEC)
    bridge_url = _resolve_bridge_liveview_start_url()

    if not port:
        _log(log_warning, "pi_pico_no_port", "external_pc.serial_port not configured and no OS default available", config=pico_cfg, os=platform.system())
        return {"ok": False, "started": False, "error": "no_serial_port"}

    _stop_event.clear()
    _reader_thread = threading.Thread(
        target=_serial_reader_loop,
        args=(port, baudrate, bridge_url, cooldown_sec, distance_threshold_mm, distance_cooldown_sec),
        kwargs={"log_warning": log_warning, "log_event": log_event},
        daemon=True,
        name="pi-pico-reader",
    )
    _reader_thread.start()
    _update_state(running=True)
    _log(
        log_event, "pi_pico_listener_started", "Pi Pico presence listener started",
        port=port, baudrate=baudrate, cooldown_sec=cooldown_sec,
        distance_threshold_mm=distance_threshold_mm, distance_cooldown_sec=distance_cooldown_sec,
    )
    return {
        "ok": True, "started": True, "port": port, "baudrate": baudrate, "cooldown_sec": cooldown_sec,
        "distance_threshold_mm": distance_threshold_mm, "distance_cooldown_sec": distance_cooldown_sec,
    }


def stop_pico_listener() -> None:
    _stop_event.set()
    _update_state(running=False, connected=False)
