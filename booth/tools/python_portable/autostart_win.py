# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
autostart_win.py

Windows-Implementierung für den NibuBox-Autostart.

Ablauf bei enable:
  1. create_open_app_shortcut.ps1 ausführen
  2. die dadurch erzeugte NibuBox_Autostart.lnk aus dem Parent-Ordner der PS1 lesen
  3. diese .lnk in den Autostart-Ordner des aktuellen Windows-Users kopieren

Wichtig:
  Der Autostart-Ordner gehört immer zu dem User, unter dem python_server.py läuft.

Robuste Pfadlogik:
  - bevorzugt server_config.json: autostart.windows.shortcutPs1
  - Projekt-Default relativ zu python_server.py: ../../../launcher/create_open_app_shortcut.ps1
  - fallback: mehrere feste lokale Kandidaten rund um python_server.py und dieses Modul
  - keine freien Pfade aus Requests

Robuste PowerShell-Logik:
  - zuerst wie in printer_core.py: powershell
  - danach powershell.exe, pwsh, pwsh.exe
  - danach shutil.which(...)
  - danach absolute Windows-Fallback-Pfade
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional

AUTOSTART_LINK_NAME = "NibuBox_Autostart.lnk"
DEFAULT_PS1_NAME = "create_open_app_shortcut.ps1"


def _as_path(value: Any) -> Optional[Path]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    return Path(s).expanduser()


def _cfg_get(config: Optional[Dict[str, Any]], *keys: str) -> Any:
    cur: Any = config or {}
    for key in keys:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def _dedupe_paths(paths: List[Path]) -> List[Path]:
    out: List[Path] = []
    seen = set()
    for p in paths:
        try:
            rp = p.expanduser().resolve()
        except Exception:
            rp = p.expanduser().absolute()
        key = str(rp).lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(rp)
    return out


def _dedupe_strings(values: List[str]) -> List[str]:
    out: List[str] = []
    seen = set()
    for value in values:
        s = str(value or "").strip()
        if not s:
            continue
        key = s.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(s)
    return out


def _configured_ps1_path(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Optional[Path]:
    configured = (
        _cfg_get(config, "autostart", "windows", "shortcutPs1")
        or _cfg_get(config, "autostart", "windows", "shortcut_ps1")
        or _cfg_get(config, "autostart", "shortcutPs1")
        or _cfg_get(config, "autostart", "shortcut_ps1")
    )

    p = _as_path(configured)
    if p is None:
        return None
    if not p.is_absolute():
        p = base_dir / p
    return p.resolve()


def _candidate_ps1_paths(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> List[Path]:
    """Feste, sichere Kandidaten. Keine Request-Pfade."""
    base_dir = base_dir.resolve()
    module_dir = Path(__file__).resolve().parent
    cwd = Path.cwd().resolve()

    candidates: List[Path] = []

    configured = _configured_ps1_path(base_dir, config)
    if configured is not None:
        candidates.append(configured)

    # Projekt-Default: vom Ordner der python_server.py ausgehend liegt die PS1 hier:
    #   ../../../launcher/create_open_app_shortcut.ps1
    candidates.append(base_dir / ".." / ".." / ".." / "launcher" / DEFAULT_PS1_NAME)

    for root in (base_dir, module_dir, cwd, base_dir.parent, module_dir.parent):
        candidates.extend([
            root / DEFAULT_PS1_NAME,
            root / "scripts" / DEFAULT_PS1_NAME,
            root / "tools" / DEFAULT_PS1_NAME,
            root / "shortcut" / DEFAULT_PS1_NAME,
            root / "shortcuts" / DEFAULT_PS1_NAME,
        ])

    return _dedupe_paths(candidates)


def _resolve_ps1_path(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Path:
    """PS1-Pfad aus Config oder sicheren Defaults ableiten."""
    candidates = _candidate_ps1_paths(base_dir, config)
    for p in candidates:
        if p.exists() and p.is_file():
            return p

    configured = _configured_ps1_path(base_dir, config)
    if configured is not None:
        return configured

    return (base_dir.resolve() / DEFAULT_PS1_NAME).resolve()


def _startup_dir(config: Optional[Dict[str, Any]] = None) -> Path:
    configured = (
        _cfg_get(config, "autostart", "windows", "startupDir")
        or _cfg_get(config, "autostart", "windows", "startup_dir")
    )
    p = _as_path(configured)
    if p is not None:
        return p.resolve()

    appdata = os.environ.get("APPDATA")
    if appdata:
        return (
            Path(appdata)
            / "Microsoft"
            / "Windows"
            / "Start Menu"
            / "Programs"
            / "Startup"
        ).resolve()

    userprofile = os.environ.get("USERPROFILE")
    if userprofile:
        return (
            Path(userprofile)
            / "AppData"
            / "Roaming"
            / "Microsoft"
            / "Windows"
            / "Start Menu"
            / "Programs"
            / "Startup"
        ).resolve()

    raise RuntimeError("APPDATA/USERPROFILE nicht gesetzt; Autostart-Ordner kann nicht bestimmt werden")


def _source_link_from_ps1(ps1_path: Path) -> Path:
    # Laut create_open_app_shortcut.ps1: ParentDir = ScriptDir\.., dort NibuBox_Autostart.lnk
    return (ps1_path.parent.parent / AUTOSTART_LINK_NAME).resolve()


def _target_link(config: Optional[Dict[str, Any]] = None) -> Path:
    return (_startup_dir(config) / AUTOSTART_LINK_NAME).resolve()


def _short_text(value: str, limit: int = 4000) -> str:
    value = value or ""
    if len(value) <= limit:
        return value
    return value[:limit] + "...<truncated>"


def _powershell_command_candidates(config: Optional[Dict[str, Any]] = None) -> List[str]:
    """
    Ermittelt Kandidaten zum Starten von PowerShell.

    Wichtig:
      - zuerst wie in printer_core.py der bare command "powershell"
      - danach "powershell.exe"
      - danach pwsh-Varianten
      - danach shutil.which(...)
      - danach feste absolute Fallbacks
    """
    candidates: List[str] = []

    configured = (
        _cfg_get(config, "autostart", "windows", "powershellCommand")
        or _cfg_get(config, "autostart", "windows", "powershell_command")
        or _cfg_get(config, "autostart", "windows", "powershellExe")
        or _cfg_get(config, "autostart", "windows", "powershell_exe")
    )
    if configured:
        candidates.append(str(configured).strip())

    candidates.extend([
        "powershell",
        "powershell.exe",
        "pwsh",
        "pwsh.exe",
    ])

    for name in ("powershell", "powershell.exe", "pwsh", "pwsh.exe"):
        found = shutil.which(name)
        if found:
            candidates.append(str(found))

    system_root = os.environ.get("SystemRoot") or os.environ.get("WINDIR") or r"C:\Windows"
    win = Path(system_root)

    candidates.extend([
        str(win / "System32" / "WindowsPowerShell" / "v1.0" / "powershell.exe"),
        str(win / "Sysnative" / "WindowsPowerShell" / "v1.0" / "powershell.exe"),
        str(win / "SysWOW64" / "WindowsPowerShell" / "v1.0" / "powershell.exe"),
        r"C:\Program Files\PowerShell\7\pwsh.exe",
        r"C:\Program Files (x86)\PowerShell\7\pwsh.exe",
    ])

    return _dedupe_strings(candidates)


def _run_ps1(ps1_path: Path, base_dir: Path, config: Optional[Dict[str, Any]] = None, timeout_sec: int = 30) -> Dict[str, Any]:
    ps1_candidates = [str(p) for p in _candidate_ps1_paths(base_dir, config)]

    if not ps1_path.exists() or not ps1_path.is_file():
        return {
            "ok": False,
            "error": "ps1_not_found",
            "ps1_path": str(ps1_path),
            "ps1_candidates": ps1_candidates,
            "hint": "Standardpfad ist ../../../launcher/create_open_app_shortcut.ps1 relativ zu python_server.py. Alternativ server_config.json setzen: autostart.windows.shortcutPs1",
        }

    powershell_candidates = _powershell_command_candidates(config)
    attempts: List[Dict[str, Any]] = []

    for powershell_cmd in powershell_candidates:
        cmd = [
            powershell_cmd,
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ps1_path),
        ]

        try:
            proc = subprocess.run(
                cmd,
                cwd=str(ps1_path.parent),
                capture_output=True,
                text=True,
                timeout=timeout_sec,
                shell=False,
            )
        except FileNotFoundError as exc:
            attempts.append({
                "ok": False,
                "error": "powershell_candidate_not_found",
                "message": str(exc),
                "cmd": cmd,
                "powershell_cmd": powershell_cmd,
            })
            continue
        except subprocess.TimeoutExpired:
            return {
                "ok": False,
                "error": "ps1_timeout",
                "timeout_sec": timeout_sec,
                "cmd": cmd,
                "ps1_path": str(ps1_path),
                "powershell_cmd": powershell_cmd,
                "attempts": attempts,
                "powershell_candidates": powershell_candidates,
            }
        except Exception as exc:
            attempts.append({
                "ok": False,
                "error": "ps1_exception",
                "message": str(exc),
                "cmd": cmd,
                "powershell_cmd": powershell_cmd,
            })
            continue

        result = {
            "ok": proc.returncode == 0,
            "rc": proc.returncode,
            "stdout": _short_text(proc.stdout or ""),
            "stderr": _short_text(proc.stderr or ""),
            "cmd": cmd,
            "ps1_path": str(ps1_path),
            "powershell_cmd": powershell_cmd,
            "attempts": attempts,
            "powershell_candidates": powershell_candidates,
        }

        # Wenn PowerShell gestartet werden konnte, aber die PS1 selbst Fehler liefert,
        # nicht weitere Kandidaten probieren. Das ist dann ein echter PS1-Fehler.
        return result

    return {
        "ok": False,
        "error": "powershell_not_found",
        "message": "Kein PowerShell-Command konnte gestartet werden.",
        "ps1_path": str(ps1_path),
        "ps1_candidates": ps1_candidates,
        "powershell_candidates": powershell_candidates,
        "attempts": attempts,
    }


def status(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    try:
        ps1_path = _resolve_ps1_path(base_dir, config)
        source_link = _source_link_from_ps1(ps1_path)
        startup_dir = _startup_dir(config)
        target_link = _target_link(config)
        candidates = _candidate_ps1_paths(base_dir, config)

        return {
            "ok": True,
            "os": "windows",
            "enabled": target_link.exists(),
            "ps1_path": str(ps1_path),
            "ps1_exists": ps1_path.exists(),
            "ps1_candidates": [str(p) for p in candidates],
            "powershell_command_candidates": _powershell_command_candidates(config),
            "source_link": str(source_link),
            "source_exists": source_link.exists(),
            "startup_dir": str(startup_dir),
            "startup_dir_exists": startup_dir.exists(),
            "target_link": str(target_link),
            "target_exists": target_link.exists(),
            "link_name": AUTOSTART_LINK_NAME,
        }
    except Exception as exc:
        return {
            "ok": False,
            "os": "windows",
            "error": "status_exception",
            "message": str(exc),
        }


def enable(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    ps1_path = _resolve_ps1_path(base_dir, config)
    source_link = _source_link_from_ps1(ps1_path)
    startup_dir = _startup_dir(config)
    target_link = _target_link(config)

    ps = _run_ps1(ps1_path, base_dir, config)
    if not ps.get("ok"):
        return {
            "ok": False,
            "os": "windows",
            "action": "enable",
            "error": "ps1_failed",
            "ps1": ps,
            "status": status(base_dir, config),
        }

    if not source_link.exists() or not source_link.is_file():
        return {
            "ok": False,
            "os": "windows",
            "action": "enable",
            "error": "source_link_missing_after_ps1",
            "source_link": str(source_link),
            "ps1": ps,
            "status": status(base_dir, config),
        }

    try:
        startup_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(str(source_link), str(target_link))
    except Exception as exc:
        return {
            "ok": False,
            "os": "windows",
            "action": "enable",
            "error": "copy_failed",
            "message": str(exc),
            "source_link": str(source_link),
            "target_link": str(target_link),
            "ps1": ps,
            "status": status(base_dir, config),
        }

    st = status(base_dir, config)
    return {
        "ok": bool(st.get("enabled")),
        "os": "windows",
        "action": "enable",
        "enabled": bool(st.get("enabled")),
        "copied": True,
        "source_link": str(source_link),
        "target_link": str(target_link),
        "startup_dir": str(startup_dir),
        "ps1": ps,
        "status": st,
    }


def disable(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    target_link = _target_link(config)
    removed = False

    try:
        if target_link.exists():
            target_link.unlink()
            removed = True
    except Exception as exc:
        return {
            "ok": False,
            "os": "windows",
            "action": "disable",
            "error": "remove_failed",
            "message": str(exc),
            "target_link": str(target_link),
            "status": status(base_dir, config),
        }

    st = status(base_dir, config)
    return {
        "ok": not bool(st.get("enabled")),
        "os": "windows",
        "action": "disable",
        "removed": removed,
        "enabled": bool(st.get("enabled")),
        "target_link": str(target_link),
        "status": st,
    }


def handle_action(action: str, base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    action = (action or "").strip().lower()
    if action == "enable":
        return enable(base_dir, config)
    if action == "disable":
        return disable(base_dir, config)
    if action == "status":
        return status(base_dir, config)
    return {
        "ok": False,
        "os": "windows",
        "error": "invalid_action",
        "allowed": ["enable", "disable", "status"],
        "action": action,
    }
