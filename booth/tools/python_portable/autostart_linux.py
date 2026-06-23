# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
autostart_linux.py

Linux-Implementierung für den reinen Autostart.

Wichtig:
  Diese Datei ist absichtlich NICHT mehr für systemd/watchdog zuständig.
  Die systemd-Logik für den "Task Planer Win / systemd Linux"-Schalter
  liegt in systemmd_linux.py.

Aktueller Stand:
  Platzhalter, bis die reine Linux-Autostart-Variante festgelegt ist
  (z. B. XDG autostart .desktop, Desktop-Session-Autostart, etc.).
"""

from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, Optional


def status(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "ok": True,
        "os": "linux",
        "enabled": False,
        "implemented": False,
        "error": "not_implemented_yet",
        "message": "Linux-Autostart ist vorbereitet, aber noch nicht implementiert. systemd liegt in systemmd_linux.py.",
    }


def enable(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "ok": False,
        "os": "linux",
        "action": "enable",
        "enabled": False,
        "implemented": False,
        "error": "not_implemented_yet",
        "message": "Linux-Autostart ist vorbereitet, aber noch nicht implementiert. systemd liegt in systemmd_linux.py.",
        "status": status(base_dir, config),
    }


def disable(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    return {
        "ok": False,
        "os": "linux",
        "action": "disable",
        "enabled": False,
        "implemented": False,
        "error": "not_implemented_yet",
        "message": "Linux-Autostart ist vorbereitet, aber noch nicht implementiert. systemd liegt in systemmd_linux.py.",
        "status": status(base_dir, config),
    }


def handle_action(action: str, base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    action = (action or "").strip().lower()
    if action == "status":
        return status(base_dir, config)
    if action == "enable":
        return enable(base_dir, config)
    if action == "disable":
        return disable(base_dir, config)
    return {
        "ok": False,
        "os": "linux",
        "error": "invalid_action",
        "allowed": ["enable", "disable", "status"],
        "action": action,
    }
