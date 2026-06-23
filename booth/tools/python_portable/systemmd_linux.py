# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
systemmd_linux.py

Linux-Implementierung für den NibuBox Task-Planer-/Watchdog-Service via systemd --user.

Bei enable wird eine User-Service-Datei erzeugt und mit systemctl --user enabled.
Diese Datei ist bewusst getrennt von autostart_linux.py.
"""

from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path
from typing import Any, Dict, Optional

SERVICE_NAME = "nibubox-watchdog.service"
DEFAULT_SCRIPT_CANDIDATES = (
    "kiosk_WaitAndStart.sh",
    "Kiosk_WaitAndStart.sh",
    "kiosk_WaitAndStart.bash",
    "open_app.sh",
    "open_app.bash",
)


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


def _systemctl() -> Optional[str]:
    return shutil.which("systemctl")


def _service_dir(config: Optional[Dict[str, Any]] = None) -> Path:
    configured = (
        _cfg_get(config, "task_planer_service", "linux", "systemdUserDir")
        or _cfg_get(config, "task_planer_service", "linux", "systemd_user_dir")
        or _cfg_get(config, "systemmd", "linux", "systemdUserDir")
        or _cfg_get(config, "systemmd", "linux", "systemd_user_dir")
    )
    p = _as_path(configured)
    if p is not None:
        return p.resolve()

    xdg_config_home = os.environ.get("XDG_CONFIG_HOME")
    if xdg_config_home:
        return (Path(xdg_config_home) / "systemd" / "user").resolve()

    return (Path.home() / ".config" / "systemd" / "user").resolve()


def _service_path(config: Optional[Dict[str, Any]] = None) -> Path:
    return (_service_dir(config) / SERVICE_NAME).resolve()


def _resolve_start_script(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Optional[Path]:
    configured = (
        _cfg_get(config, "task_planer_service", "linux", "startScript")
        or _cfg_get(config, "task_planer_service", "linux", "start_script")
        or _cfg_get(config, "systemmd", "linux", "startScript")
        or _cfg_get(config, "systemmd", "linux", "start_script")
    )
    p = _as_path(configured)
    if p is not None:
        if not p.is_absolute():
            p = base_dir / p
        return p.resolve()

    for name in DEFAULT_SCRIPT_CANDIDATES:
        candidate = (base_dir / name).resolve()
        if candidate.exists() and candidate.is_file():
            return candidate

    return None


def _run(args: list[str], timeout_sec: int = 15) -> Dict[str, Any]:
    try:
        proc = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout_sec,
            shell=False,
        )
        return {
            "ok": proc.returncode == 0,
            "rc": proc.returncode,
            "stdout": (proc.stdout or "")[:4000],
            "stderr": (proc.stderr or "")[:4000],
            "cmd": args,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "timeout", "timeout_sec": timeout_sec, "cmd": args}
    except Exception as exc:
        return {"ok": False, "error": "exception", "message": str(exc), "cmd": args}


def _systemctl_user(*args: str) -> Dict[str, Any]:
    exe = _systemctl()
    if not exe:
        return {"ok": False, "error": "systemctl_not_found", "cmd": ["systemctl", "--user", *args]}
    return _run([exe, "--user", *args])


def _service_content(start_script: Path) -> str:
    # systemd akzeptiert /bin/bash + Pfad robust, auch wenn das Script nicht executable ist.
    return f"""[Unit]
Description=NibuBox Watchdog Service
After=graphical-session.target

[Service]
Type=simple
WorkingDirectory={start_script.parent}
ExecStart=/bin/bash {start_script}
Restart=on-failure
RestartSec=5

[Install]
WantedBy=default.target
"""


def status(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    service_path = _service_path(config)
    start_script = _resolve_start_script(base_dir, config)
    systemctl_exists = _systemctl() is not None

    is_enabled = None
    systemctl_status = None
    if systemctl_exists:
        systemctl_status = _systemctl_user("is-enabled", SERVICE_NAME)
        if systemctl_status.get("ok"):
            is_enabled = True
        elif str(systemctl_status.get("stdout") or systemctl_status.get("stderr") or "").strip() in ("disabled", "not-found"):
            is_enabled = False

    return {
        "ok": True,
        "os": "linux",
        "enabled": bool(is_enabled) if is_enabled is not None else service_path.exists(),
        "service_name": SERVICE_NAME,
        "service_path": str(service_path),
        "service_exists": service_path.exists(),
        "systemctl_exists": systemctl_exists,
        "systemctl_is_enabled": systemctl_status,
        "start_script": str(start_script) if start_script else "",
        "start_script_exists": bool(start_script and start_script.exists()),
    }


def enable(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    start_script = _resolve_start_script(base_dir, config)
    if start_script is None or not start_script.exists() or not start_script.is_file():
        return {
            "ok": False,
            "os": "linux",
            "action": "enable",
            "error": "start_script_not_found",
            "searched": [str((base_dir / name).resolve()) for name in DEFAULT_SCRIPT_CANDIDATES],
            "status": status(base_dir, config),
        }

    service_dir = _service_dir(config)
    service_path = _service_path(config)

    try:
        service_dir.mkdir(parents=True, exist_ok=True)
        service_path.write_text(_service_content(start_script), encoding="utf-8")
    except Exception as exc:
        return {
            "ok": False,
            "os": "linux",
            "action": "enable",
            "error": "write_service_failed",
            "message": str(exc),
            "service_path": str(service_path),
        }

    daemon_reload = _systemctl_user("daemon-reload")
    enable_result = _systemctl_user("enable", SERVICE_NAME)

    st = status(base_dir, config)
    ok = bool(daemon_reload.get("ok") and enable_result.get("ok") and st.get("enabled"))
    return {
        "ok": ok,
        "os": "linux",
        "action": "enable",
        "enabled": bool(st.get("enabled")),
        "service_path": str(service_path),
        "start_script": str(start_script),
        "daemon_reload": daemon_reload,
        "systemctl_enable": enable_result,
        "status": st,
    }


def disable(base_dir: Path, config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    service_path = _service_path(config)
    disable_result = _systemctl_user("disable", SERVICE_NAME)

    removed = False
    remove_error = ""
    try:
        if service_path.exists():
            service_path.unlink()
            removed = True
    except Exception as exc:
        remove_error = str(exc)

    daemon_reload = _systemctl_user("daemon-reload")
    st = status(base_dir, config)

    ok = not bool(st.get("enabled")) and not remove_error
    return {
        "ok": ok,
        "os": "linux",
        "action": "disable",
        "removed": removed,
        "remove_error": remove_error,
        "enabled": bool(st.get("enabled")),
        "service_path": str(service_path),
        "systemctl_disable": disable_result,
        "daemon_reload": daemon_reload,
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
        "os": "linux",
        "error": "invalid_action",
        "allowed": ["enable", "disable", "status"],
        "action": action,
    }
