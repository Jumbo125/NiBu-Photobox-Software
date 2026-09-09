# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
credit_core.py — Guthaben-Domäne für den ST-001-Münzprüfer (per Pi Pico
angebunden). Kennt keine Serial-/Pico-Details — bekommt nur den fertig
geparsten Münzwert (Cent) von pi_pico_core.py übergeben.

Scope dieser Phase: Nur die Pico-↔-PC-Schnittstelle (Guthaben im RAM
halten, atomar nach credit.json schreiben, Audit-Log pro Coin-Event).
Das Einlesen von credit.json durch die Photobox-WebUI (Anzeige,
Druck-Freigabe, Verbrauch/Abbuchen) ist NICHT Teil dieser Phase.

Guthaben lebt ausschließlich auf der PC-Seite (RAM + threading.Lock,
passend zum bestehenden Muster im Python-Server). Der Pico verwaltet
niemals das Gesamtguthaben — startet er neu oder fällt USB kurz aus,
bleibt das Guthaben sicher im Python-Server erhalten.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional

HERE = os.path.dirname(os.path.abspath(__file__))
CREDIT_FILE = os.path.join(HERE, "credit.json")
# Klartext-Log (.log, keine JSON-Datei) -- credit.json bleibt die einzige
# JSON-Datei hier und enthält ausschließlich den aktuellen Saldo (Zustand),
# nie den Verlauf. Der Verlauf gehört in dieses separate, menschenlesbare Log.
COIN_LOG_FILE = os.path.join(HERE, "logs", "coin_log.log")

# Bekannte ST-001-Nennwerte (Cent). Unbekannte Werte werden weiterhin
# gutgeschrieben (kein Geldverlust durch unerwartete aber echte Münzen),
# aber als "unexpected_value" geloggt statt kommentarlos verbucht.
KNOWN_COIN_VALUES_CENT = {10, 20, 50, 100, 200}

# Eindeutig unplausibel (Störsignal auf der UART-Leitung) statt nur
# unbekannt — diese werden NICHT gutgeschrieben.
MIN_PLAUSIBLE_CENT = 1
MAX_PLAUSIBLE_CENT = 500

_CREDIT_LOCK = threading.Lock()
_credit_cent = 0
_loaded = False


def _log(log_fn, event: str, message: str = "", **data: Any) -> None:
    if log_fn is None:
        return
    try:
        log_fn(event, message, **data)
    except Exception:
        pass


def _atomic_write_json(path: str, obj: Dict[str, Any]) -> None:
    """Write JSON atomically (temp file + os.replace). Gleiches Muster wie printer_core.py."""
    directory = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(directory, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="._tmp_", dir=directory, text=True)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            json.dump(obj, f, ensure_ascii=False, indent=2)
            f.flush()
            os.fsync(f.fileno())
        os.replace(tmp, path)
    finally:
        try:
            if os.path.exists(tmp):
                os.remove(tmp)
        except Exception:
            pass


def _append_coin_log(event: str, value_cent: int, balance_after_cent: int) -> None:
    try:
        directory = os.path.dirname(COIN_LOG_FILE)
        os.makedirs(directory, exist_ok=True)
        ts = datetime.now(timezone.utc).astimezone().strftime("%Y-%m-%d %H:%M:%S")
        line = f"{ts} | {event} | value={value_cent} cent | balance={balance_after_cent} cent"
        with open(COIN_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(line + "\n")
    except Exception:
        pass


def load_credit(log_warning=None) -> int:
    """
    Lädt credit.json einmalig in den RAM-Wert. Fehlt die Datei (z.B. beim
    allerersten Start, bevor je eine Münze eingeworfen wurde), wird sie
    sofort mit {"credit_cent": 0} angelegt statt nur den RAM-Wert auf 0 zu
    setzen -- die Datei soll immer auf der Platte existieren, damit externe
    Tools/Backups/manuelles Nachschauen nicht ins Leere laufen.
    """
    global _credit_cent, _loaded
    with _CREDIT_LOCK:
        if _loaded:
            return _credit_cent
        try:
            if os.path.isfile(CREDIT_FILE):
                with open(CREDIT_FILE, "r", encoding="utf-8-sig") as f:
                    data = json.load(f)
                _credit_cent = int(data.get("credit_cent") or 0)
            else:
                _credit_cent = 0
                try:
                    _atomic_write_json(CREDIT_FILE, {"credit_cent": 0})
                except Exception as e:
                    _log(log_warning, "credit_init_write_failed", "Could not create initial credit.json", error=str(e))
        except Exception as e:
            _log(log_warning, "credit_load_failed", "Could not load credit.json, starting at 0", error=str(e))
            _credit_cent = 0
        _loaded = True
        return _credit_cent


def get_credit_cent() -> int:
    with _CREDIT_LOCK:
        return _credit_cent


def add_credit(amount_cent: int, log_warning=None, log_event=None) -> Optional[int]:
    """
    Bucht einen Münzwert (Cent) gut, schreibt atomar nach credit.json und
    hängt einen Audit-Log-Eintrag an. Gibt den neuen Saldo zurück, oder
    None wenn der Wert eindeutig unplausibel war (nicht gebucht).
    """
    global _credit_cent

    if not _loaded:
        load_credit(log_warning=log_warning)

    if amount_cent < MIN_PLAUSIBLE_CENT or amount_cent > MAX_PLAUSIBLE_CENT:
        _log(log_warning, "credit_implausible_value_rejected", "Coin value out of plausible range, not credited", value_cents=amount_cent)
        _append_coin_log("coin_rejected_implausible", amount_cent, get_credit_cent())
        return None

    if amount_cent not in KNOWN_COIN_VALUES_CENT:
        _log(log_warning, "credit_unexpected_value", "Coin value not in known denominations, crediting anyway", value_cents=amount_cent, known=sorted(KNOWN_COIN_VALUES_CENT))

    with _CREDIT_LOCK:
        _credit_cent += amount_cent
        new_balance = _credit_cent
        try:
            _atomic_write_json(CREDIT_FILE, {"credit_cent": new_balance})
        except Exception as e:
            _log(log_warning, "credit_save_failed", "Could not write credit.json", error=str(e))

    _log(log_event, "coin_accepted", "Coin credited", value_cents=amount_cent, balance_after_cents=new_balance)
    _append_coin_log("coin_accepted", amount_cent, new_balance)
    return new_balance


def spend_credit(amount_cent: int, log_warning=None, log_event=None) -> Dict[str, Any]:
    """
    Bucht amount_cent vom Guthaben ab (Münz-Print-Flow — siehe
    capture_flow.js). Lehnt ab, wenn das Guthaben nicht ausreicht (kein
    negativer Saldo). Schreibt atomar nach credit.json und hängt einen
    Audit-Log-Eintrag an ("print_spent"). Gibt {"ok": True, "credit_cent":
    <neuer Saldo>} oder {"ok": False, "error": "insufficient_credit", ...}
    zurück.
    """
    global _credit_cent

    if not _loaded:
        load_credit(log_warning=log_warning)

    amount_cent = int(amount_cent or 0)
    if amount_cent <= 0:
        return {"ok": False, "error": "invalid_amount"}

    with _CREDIT_LOCK:
        if _credit_cent < amount_cent:
            _log(log_warning, "credit_spend_insufficient", "Print declined, insufficient credit", requested_cents=amount_cent, balance_cents=_credit_cent)
            return {"ok": False, "error": "insufficient_credit", "credit_cent": _credit_cent, "required_cent": amount_cent}

        _credit_cent -= amount_cent
        new_balance = _credit_cent
        try:
            _atomic_write_json(CREDIT_FILE, {"credit_cent": new_balance})
        except Exception as e:
            _log(log_warning, "credit_save_failed", "Could not write credit.json", error=str(e))

    _log(log_event, "print_spent", "Credit spent for print", value_cents=amount_cent, balance_after_cents=new_balance)
    _append_coin_log("print_spent", amount_cent, new_balance)
    return {"ok": True, "credit_cent": new_balance}
