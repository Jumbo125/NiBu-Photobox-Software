# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
task_planer_service_win.py

Windows-Implementierung für den NibuBox Task-Scheduler-Watchdog.

Ablauf:
  enable:
    - ruft die vorhandene launcher/task_install.bat /nopause auf

  disable:
    - ruft die vorhandene launcher/task_uninstall.bat /nopause auf

  status:
    - liest watchdog_taskname.txt
    - prüft per schtasks, ob der Task existiert

Wichtig:
  Für enable/disable muss python_server.py mit Adminrechten laufen,
  weil die BAT/PS1 Scheduled Tasks als SYSTEM registriert/entfernt.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, List, Optional


INSTALL_BAT_NAME = "task_install.bat"
UNINSTALL_BAT_NAME = "task_uninstall.bat"
TASKNAME_FILE_NAME = "watchdog_taskname.txt"


def _cfg_get(config: Optional[Dict[str, Any]], *keys: str) -> Any:
    cur: Any = config or {}
    for key in keys:
        if not isinstance(cur, dict) or key not in cur:
            return None
        cur = cur[key]
    return cur


def _as_path(value: Any) -> Optional[Path]:
    if value is None:
        return None
    s = str(value).strip()
    if not s:
        return None
    return Path(s).expanduser()


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


def _launcher_dir_default(base_dir: Path) -> Path:
    return (base_dir.resolve() / ".." / ".." / ".." / "launcher").resolve()


def _configured_launcher_dir(base_dir: Path, config: Optional[Dict[str, Any]]) -> Optional[Path]:
    configured = (
        _cfg_get(config, "task_planer_service", "windows", "launcherDir")
        or _cfg_get(config, "task_planer_service", "windows", "launcher_dir")
        or _cfg_get(config, "taskScheduler", "windows", "launcherDir")
        or _cfg_get(config, "taskScheduler", "windows", "launcher_dir")
    )
    p = _as_path(configured)
    if p is None:
        return None
    if not p.is_absolute():
        p = base_dir / p
    return p.resolve()


def _launcher_dir_candidates(base_dir: Path, config: Optional[Dict[str, Any]]) -> List[Path]:
    base_dir = base_dir.resolve()
    module_dir = Path(__file__).resolve().parent
    cwd = Path.cwd().resolve()
    candidates: List[Path] = []

    configured = _configured_launcher_dir(base_dir, config)
    if configured is not None:
        candidates.append(configured)

    candidates.append(_launcher_dir_default(base_dir))

    for root in (base_dir, module_dir, cwd, base_dir.parent, module_dir.parent):
        candidates.extend([
            root / "launcher",
            root / ".." / "launcher",
            root,
        ])

    return _dedupe_paths(candidates)


def _find_launcher_dir(base_dir: Path, config: Optional[Dict[str, Any]]) -> Path:
    for p in _launcher_dir_candidates(base_dir, config):
        if (
            p.exists()
            and p.is_dir()
            and (p / INSTALL_BAT_NAME).exists()
            and (p / UNINSTALL_BAT_NAME).exists()
        ):
            return p.resolve()
    return _launcher_dir_default(base_dir)


def _configured_file(base_dir: Path, config: Optional[Dict[str, Any]], config_keys: List[List[str]], fallback: Path) -> Path:
    for keys in config_keys:
        value = _cfg_get(config, *keys)
        p = _as_path(value)
        if p is None:
            continue
        if not p.is_absolute():
            p = base_dir / p
        return p.resolve()
    return fallback.resolve()


def _install_bat(base_dir: Path, config: Optional[Dict[str, Any]]) -> Path:
    launcher_dir = _find_launcher_dir(base_dir, config)
    return _configured_file(
        base_dir,
        config,
        [
            ["task_planer_service", "windows", "installBat"],
            ["task_planer_service", "windows", "install_bat"],
            ["taskScheduler", "windows", "installBat"],
            ["taskScheduler", "windows", "install_bat"],
        ],
        launcher_dir / INSTALL_BAT_NAME,
    )


def _uninstall_bat(base_dir: Path, config: Optional[Dict[str, Any]]) -> Path:
    launcher_dir = _find_launcher_dir(base_dir, config)
    return _configured_file(
        base_dir,
        config,
        [
            ["task_planer_service", "windows", "uninstallBat"],
            ["task_planer_service", "windows", "uninstall_bat"],
            ["taskScheduler", "windows", "uninstallBat"],
            ["taskScheduler", "windows", "uninstall_bat"],
        ],
        launcher_dir / UNINSTALL_BAT_NAME,
    )


def _taskname_file(base_dir: Path, config: Optional[Dict[str, Any]]) -> Path:
    launcher_dir = _find_launcher_dir(base_dir, config)
    return _configured_file(
        base_dir,
        config,
        [
            ["task_planer_service", "windows", "taskNameFile"],
            ["task_planer_service", "windows", "task_name_file"],
            ["taskScheduler", "windows", "taskNameFile"],
            ["taskScheduler", "windows", "task_name_file"],
        ],
        launcher_dir / TASKNAME_FILE_NAME,
    )


def _cmd_exe() -> str:
    configured = os.environ.get("COMSPEC") or os.environ.get("ComSpec")
    if configured and Path(configured).exists():
        return configured
    found = shutil.which("cmd") or shutil.which("cmd.exe")
    if found:
        return found
    system_root = os.environ.get("SystemRoot") or os.environ.get("WINDIR") or r"C:\Windows"
    return str(Path(system_root) / "System32" / "cmd.exe")


def _short_text(value: str, limit: int = 8000) -> str:
    value = value or ""
    if len(value) <= limit:
        return value
    return value[:limit] + "...<truncated>"


def _extract_json_from_text(text: str) -> Optional[Dict[str, Any]]:
    text = (text or "").strip()
    if not text:
        return None
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    # Best effort: letztes JSON-Objekt aus gemischter BAT-Ausgabe extrahieren.
    matches = list(re.finditer(r"\{.*\}", text, flags=re.DOTALL))
    for m in reversed(matches):
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict):
                return obj
        except Exception:
            continue
    return None


def _run_bat(bat_path: Path, timeout_sec: int = 90) -> Dict[str, Any]:
    if not bat_path.exists() or not bat_path.is_file():
        return {
            "ok": False,
            "error": "bat_not_found",
            "bat_path": str(bat_path),
        }

    cmd = [_cmd_exe(), "/d", "/c", str(bat_path), "/nopause"]
    try:
        proc = subprocess.run(
            cmd,
            cwd=str(bat_path.parent),
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            shell=False,
        )
    except subprocess.TimeoutExpired:
        return {
            "ok": False,
            "error": "bat_timeout",
            "timeout_sec": timeout_sec,
            "cmd": cmd,
            "bat_path": str(bat_path),
        }
    except Exception as exc:
        return {
            "ok": False,
            "error": "bat_exception",
            "message": str(exc),
            "cmd": cmd,
            "bat_path": str(bat_path),
        }

    stdout = proc.stdout or ""
    stderr = proc.stderr or ""
    parsed = _extract_json_from_text(stdout) or _extract_json_from_text(stderr)

    ok_from_json = None
    if isinstance(parsed, dict):
        if "allOk" in parsed:
            ok_from_json = bool(parsed.get("allOk"))
        elif "ok" in parsed:
            ok_from_json = bool(parsed.get("ok"))

    ok = bool(ok_from_json) if ok_from_json is not None else proc.returncode == 0
    return {
        "ok": ok,
        "rc": proc.returncode,
        "stdout": _short_text(stdout),
        "stderr": _short_text(stderr),
        "json": parsed,
        "cmd": cmd,
        "bat_path": str(bat_path),
        "working_dir": str(bat_path.parent),
    }


def _read_task_name(base_dir: Path, config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    path = _taskname_file(base_dir, config)
    if not path.exists() or not path.is_file():
        return {"ok": False, "error": "taskname_file_not_found", "task_name_file": str(path)}
    try:
        raw = path.read_text(encoding="utf-8-sig", errors="replace").strip()
    except Exception as exc:
        return {"ok": False, "error": "taskname_file_read_failed", "message": str(exc), "task_name_file": str(path)}
    raw = raw.strip().strip('"').strip("'").strip()
    if not raw:
        return {"ok": False, "error": "task_name_empty", "task_name_file": str(path)}
    return {"ok": True, "task": raw, "task_name_file": str(path)}


def _task_exists(task_name: str) -> Dict[str, Any]:
    task_name = (task_name or "").strip()
    if not task_name:
        return {"ok": False, "exists": False, "error": "missing_task_name"}

    schtasks = shutil.which("schtasks") or shutil.which("schtasks.exe") or "schtasks"
    cmd = [schtasks, "/Query", "/TN", task_name, "/FO", "LIST", "/V"]

    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=10, shell=False)
    except Exception as exc:
        return {"ok": False, "exists": False, "error": "schtasks_exception", "message": str(exc), "cmd": cmd}

    return {
        "ok": True,
        "exists": proc.returncode == 0,
        "rc": proc.returncode,
        "stdout": _short_text(proc.stdout or ""),
        "stderr": _short_text(proc.stderr or ""),
        "cmd": cmd,
    }


def status(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    launcher_dir = _find_launcher_dir(base_dir, config)
    install_bat = _install_bat(base_dir, config)
    uninstall_bat = _uninstall_bat(base_dir, config)
    task_file = _taskname_file(base_dir, config)
    task_name_result = _read_task_name(base_dir, config)
    task_name = str(task_name_result.get("task") or "").strip()
    exists_result = _task_exists(task_name) if task_name else {"ok": False, "exists": False, "error": "task_name_unavailable"}

    return {
        "ok": True,
        "os": "windows",
        "enabled": bool(exists_result.get("exists")),
        "launcher_dir": str(launcher_dir),
        "launcher_dir_exists": launcher_dir.exists(),
        "launcher_candidates": [str(p) for p in _launcher_dir_candidates(base_dir, config)],
        "install_bat": str(install_bat),
        "install_bat_exists": install_bat.exists(),
        "uninstall_bat": str(uninstall_bat),
        "uninstall_bat_exists": uninstall_bat.exists(),
        "task_name_file": str(task_file),
        "task_name_file_exists": task_file.exists(),
        "task": task_name,
        "task_name": task_name,
        "task_name_result": task_name_result,
        "task_exists": exists_result,
    }


def enable(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    install_bat = _install_bat(base_dir, config)
    run = _run_bat(install_bat, timeout_sec=90)
    st = status(base_dir, config)
    return {
        "ok": bool(run.get("ok") and st.get("enabled")),
        "os": "windows",
        "action": "enable",
        "enabled": bool(st.get("enabled")),
        "run": run,
        "status": st,
    }


def disable(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    uninstall_bat = _uninstall_bat(base_dir, config)
    run = _run_bat(uninstall_bat, timeout_sec=90)
    st = status(base_dir, config)
    return {
        "ok": bool(run.get("ok") and not st.get("enabled")),
        "os": "windows",
        "action": "disable",
        "enabled": bool(st.get("enabled")),
        "run": run,
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
