# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
service_core.py — Start/Stop/Status/Restart für einen lokalen "Service" (z. B. ApiServer.exe)

Designziele:
- Einfache, lokale Absicherung via api_key (nicht "militärisch sicher", aber verhindert Zufallsaufrufe)
- Windows: Status möglichst gut (PID + optional ExecutablePath) via PowerShell/CIM
- Linux/Mac: Platzhalter (noch nicht implementiert, wie gewünscht)

server_config.json (neben python_server.py) — Minimal:
{
  "AuthKey": "DEIN_KEY",
  "Port": 8051,
  "args": ["--one-instance", "--port", "{port}"]
}
"""

import json
import os
import shlex
import subprocess
import sys
import hmac
from typing import Any, Dict, List, Optional


HERE = os.path.dirname(os.path.abspath(__file__))


def is_windows() -> bool:
    return os.name == "nt" or sys.platform.startswith("win")


def is_linux() -> bool:
    return sys.platform.startswith("linux")


def is_macos() -> bool:
    return sys.platform == "darwin"


def load_server_config(config_path: str) -> Dict[str, Any]:
    """
    Lädt server_config.json (neben python_server.py)
    """
    rp = os.path.realpath(config_path)
    if not os.path.isfile(rp):
        return {"ok": False, "error": "server_config_not_found", "path": rp}

    try:
        with open(rp, "r", encoding="utf-8") as f:
            data = json.load(f)
        if not isinstance(data, dict):
            return {"ok": False, "error": "server_config_invalid", "path": rp}
        data["_path"] = rp
        return {"ok": True, "config": data}
    except Exception as e:
        return {"ok": False, "error": "server_config_read_failed", "path": rp, "message": str(e)}


def safe_compare(a: str, b: str) -> bool:
    """
    Konstantes Timing (hmac.compare_digest)
    """
    if not isinstance(a, str) or not isinstance(b, str):
        return False
    return hmac.compare_digest(a, b)


def validate_api_key(provided_key: str, cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Prüft provided api_key gegen cfg["AuthKey"].
    """
    expected = str(cfg.get("AuthKey") or "")
    provided = str(provided_key or "")

    if not expected:
        return {"ok": False, "error": "api_key_not_configured"}
    if not provided:
        return {"ok": False, "error": "api_key_missing"}

    if not safe_compare(provided, expected):
        return {"ok": False, "error": "api_key_mismatch"}

    return {"ok": True}


def _normalize_args(args_val: Any, port: int) -> List[str]:
    """
    args kann List[str] oder String sein.
    Unterstützt Platzhalter "{port}".
    """
    if args_val is None:
        args = []
    elif isinstance(args_val, list):
        args = [str(x) for x in args_val]
    else:
        args = shlex.split(str(args_val))

    # Platzhalter ersetzen
    out: List[str] = []
    for a in args:
        out.append(a.replace("{port}", str(port)))
    return out


def build_command(exe_path: str, cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Baut den Start-Command aus exe_path + cfg(port,args)
    """
    port = int(cfg.get("Port") or 0) or 0
    args = _normalize_args(cfg.get("args"), port)

    cmd = [exe_path] + args
    return {"ok": True, "cmd": cmd, "port": port, "args": args}


# -----------------------------
# Windows: Running Check (PID + Path wenn möglich)
# -----------------------------
def _win_query_processes_by_name(exe_name: str) -> Dict[str, Any]:
    """
    Versucht über PowerShell/CIM Instanzen zu finden und gibt PID + ExecutablePath zurück.
    Fallback ist dann tasklist (ohne Path).
    """
    # PowerShell CIM: liefert ProcessId + ExecutablePath (wenn verfügbar)
    ps = (
        "Get-CimInstance Win32_Process "
        f"-Filter \"Name='{exe_name}'\" | "
        "Select-Object ProcessId,ExecutablePath,Name | ConvertTo-Json -Compress"
    )
    cmd = ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps]

    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=3, shell=False)
        if p.returncode != 0:
            return {"ok": False, "error": "powershell_failed", "rc": p.returncode, "err": (p.stderr or "").strip()}
        raw = (p.stdout or "").strip()
        if not raw:
            return {"ok": True, "items": []}

        data = json.loads(raw)
        items: List[Dict[str, Any]] = []
        if isinstance(data, list):
            for it in data:
                if isinstance(it, dict):
                    items.append(it)
        elif isinstance(data, dict):
            items.append(data)

        # Normalisieren
        norm = []
        for it in items:
            pid = it.get("ProcessId")
            path = it.get("ExecutablePath") or ""
            name = it.get("Name") or exe_name
            try:
                pid = int(pid)
            except Exception:
                pid = None
            norm.append({"pid": pid, "path": str(path), "name": str(name)})

        return {"ok": True, "items": norm}
    except Exception as e:
        return {"ok": False, "error": "powershell_exception", "message": str(e)}


def _win_tasklist_fallback(exe_name: str) -> Dict[str, Any]:
    """
    tasklist Fallback. Liefert PIDs via CSV-Ausgabe.
    """
    cmd = ["cmd", "/c", "tasklist", "/FI", f"IMAGENAME eq {exe_name}", "/FO", "CSV", "/NH"]
    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=3, shell=False)
        out = (p.stdout or "").strip()
        if not out or "No tasks are running" in out:
            return {"ok": True, "items": []}

        # CSV rows: "Image Name","PID","Session Name","Session#","Mem Usage"
        items = []
        for line in out.splitlines():
            line = line.strip()
            if not line:
                continue
            parts = [x.strip().strip('"') for x in line.split('","')]
            # parts[0] may start with " and end with "
            if len(parts) >= 2 and parts[0].lower().endswith(exe_name.lower()):
                try:
                    pid = int(parts[1])
                except Exception:
                    pid = None
                items.append({"pid": pid, "path": "", "name": exe_name})
        return {"ok": True, "items": items}
    except Exception as e:
        return {"ok": False, "error": "tasklist_exception", "message": str(e)}


def get_service_status(exe_path: str) -> Dict[str, Any]:
    """
    Status: running + pids.
    Windows: versucht Path-Match, fällt sonst auf Name-Match zurück.
    Linux/mac: TODO/NotImplemented
    """
    exe_rp = os.path.realpath(exe_path)
    exe_name = os.path.basename(exe_rp)

    if is_windows():
        # 1) PowerShell CIM
        r = _win_query_processes_by_name(exe_name)
        items = []
        if r.get("ok"):
            items = r.get("items", [])
        else:
            # 2) Fallback tasklist
            r2 = _win_tasklist_fallback(exe_name)
            if r2.get("ok"):
                items = r2.get("items", [])
            else:
                return {"ok": False, "error": "process_query_failed", "detail": {"cim": r, "tasklist": r2}}

        # optional: path match (falls CIM path liefert)
        matches = []
        for it in items:
            p = (it.get("path") or "").strip()
            if p:
                if os.path.realpath(p) == exe_rp:
                    matches.append(it)
            else:
                # kein Path -> Name-only
                matches.append(it)

        pids = [it.get("pid") for it in matches if it.get("pid")]
        return {
            "ok": True,
            "running": len(pids) > 0,
            "pids": pids,
            "exe": exe_rp,
            "exeName": exe_name,
            "detail": {"items": matches},
        }

    # Linux/mac: du wolltest hier erstmal nur Kommentar/Platzhalter
    if is_linux() or is_macos():
        # TODO: Implementieren, z.B. via `pgrep -f <exe_path>` / `ps aux` Parsing
        return {"ok": False, "error": "not_implemented_on_this_os", "os": sys.platform}

    return {"ok": False, "error": "unsupported_os", "os": sys.platform}


def start_service(exe_path: str, cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Startet den Service (Windows implementiert).
    Linux/mac: TODO/NotImplemented.
    """
    exe_rp = os.path.realpath(exe_path)
    if not os.path.isfile(exe_rp):
        return {"ok": False, "error": "exe_not_found", "exe": exe_rp}

    st = get_service_status(exe_rp)
    if st.get("ok") and st.get("running"):
        return {"ok": True, "alreadyRunning": True, "status": st}

    bc = build_command(exe_rp, cfg)
    cmd = bc["cmd"]

    if is_windows():
        try:
            # Detached / kein Console-Fenster:
            DETACHED_PROCESS = 0x00000008
            CREATE_NEW_PROCESS_GROUP = 0x00000200

            p = subprocess.Popen(
                cmd,
                cwd=os.path.dirname(exe_rp),
                stdin=subprocess.DEVNULL,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                creationflags=DETACHED_PROCESS | CREATE_NEW_PROCESS_GROUP,
                close_fds=True,
            )
            # kurzer Re-Check
            st2 = get_service_status(exe_rp)
            return {
                "ok": True,
                "started": True,
                "pid": p.pid,
                "cmd": cmd,
                "status": st2,
            }
        except Exception as e:
            return {"ok": False, "error": "start_failed", "message": str(e), "cmd": cmd}

    # Linux/mac placeholder
    if is_linux() or is_macos():
        # TODO: Implementieren (nohup / start_new_session / systemd / launchd etc.)
        return {"ok": False, "error": "not_implemented_on_this_os", "os": sys.platform, "cmd": cmd}

    return {"ok": False, "error": "unsupported_os", "os": sys.platform, "cmd": cmd}


def stop_service(exe_path: str) -> Dict[str, Any]:
    """
    Stoppt den Service (Windows implementiert).
    Linux/mac: TODO/NotImplemented.
    """
    exe_rp = os.path.realpath(exe_path)
    exe_name = os.path.basename(exe_rp)

    st = get_service_status(exe_rp)
    if st.get("ok") and not st.get("running"):
        return {"ok": True, "alreadyStopped": True, "status": st}

    if is_windows():
        # taskkill alle gefundenen PIDs (robust, auch wenn mehrere Instanzen)
        pids = st.get("pids") if st.get("ok") else []
        if not pids:
            # Fallback: kill by image name
            cmd = ["cmd", "/c", "taskkill", "/IM", exe_name, "/F", "/T"]
            try:
                p = subprocess.run(cmd, capture_output=True, text=True, timeout=5, shell=False)
                out = (p.stdout or "").strip()
                err = (p.stderr or "").strip()
                # nachher nochmal status
                st2 = get_service_status(exe_rp)
                return {"ok": True, "killedBy": "image", "cmd": cmd, "rc": p.returncode, "out": out, "err": err, "status": st2}
            except Exception as e:
                return {"ok": False, "error": "stop_failed", "message": str(e)}

        killed = []
        for pid in pids:
            cmd = ["cmd", "/c", "taskkill", "/PID", str(pid), "/F", "/T"]
            try:
                p = subprocess.run(cmd, capture_output=True, text=True, timeout=5, shell=False)
                killed.append({"pid": pid, "rc": p.returncode, "out": (p.stdout or "").strip(), "err": (p.stderr or "").strip()})
            except Exception as e:
                killed.append({"pid": pid, "rc": -1, "error": str(e)})

        st2 = get_service_status(exe_rp)
        return {"ok": True, "killed": killed, "status": st2}

    # Linux/mac placeholder
    if is_linux() or is_macos():
        # TODO: Implementieren (pkill -f / kill PID / systemd stop / launchctl)
        return {"ok": False, "error": "not_implemented_on_this_os", "os": sys.platform}

    return {"ok": False, "error": "unsupported_os", "os": sys.platform}


def restart_service(exe_path: str, cfg: Dict[str, Any]) -> Dict[str, Any]:
    """
    Restart = stop + start
    """
    s1 = stop_service(exe_path)
    if not s1.get("ok"):
        return {"ok": False, "error": "stop_failed", "stop": s1}

    s2 = start_service(exe_path, cfg)
    if not s2.get("ok"):
        return {"ok": False, "error": "start_failed", "stop": s1, "start": s2}

    return {"ok": True, "stop": s1, "start": s2}
