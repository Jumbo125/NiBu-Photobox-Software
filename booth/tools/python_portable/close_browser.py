# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# close_browser.py
from __future__ import annotations

import os
import platform
import re
import signal
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Erlaubte Browser-Prozesse (Schutz gegen „Caddy/Python“ killen)
_BROWSER_TOKENS = {
    "chrome", "chromium", "msedge", "edge", "firefox", "brave", "opera",
    "google-chrome", "chromium-browser", "microsoft-edge",
}
_BROWSER_EXES_WIN = {
    "chrome.exe", "msedge.exe", "firefox.exe", "brave.exe", "opera.exe",
    "chromium.exe",
}

_RE_PORT = re.compile(r":(\d+)$")
_RE_SOCK_USERS = re.compile(r'users:\(\("([^"]+)",pid=(\d+)')

_RE_PID = re.compile(r"\bpid=(\d+)\b", re.IGNORECASE)


def _parse_host_port(addr: str) -> Tuple[str, Optional[int]]:
    addr = (addr or "").strip()
    # Windows netstat kann IPv6 als [::1]:123 oder ::1:123 zeigen
    addr = addr.strip("[]")
    m = _RE_PORT.search(addr)
    if not m:
        return addr, None
    port = int(m.group(1))
    host = addr[: m.start()]
    if host.endswith(":"):
        host = host[:-1]
    return host, port


def _is_browser_name(name: str) -> bool:
    n = (name or "").lower().strip()
    if not n:
        return False
    if n in _BROWSER_EXES_WIN:
        return True
    # linux/mac: "chrome", "firefox", "msedge", "chromium", ...
    for t in _BROWSER_TOKENS:
        if t in n:
            return True
    return False


def _ua_prefer_token(user_agent: str) -> Optional[str]:
    ua = (user_agent or "")
    # Edge UA enthält auch "Chrome" → daher Edge zuerst
    if "Edg/" in ua or "Edge/" in ua:
        return "msedge"
    if "Firefox/" in ua:
        return "firefox"
    if "Chrome/" in ua or "Chromium/" in ua:
        return "chrome"
    return None


# ------------------------
# Windows helpers
# ------------------------
def _win_tasklist_name(pid: int) -> str:
    try:
        r = subprocess.run(
            ["tasklist", "/FI", f"PID eq {pid}", "/FO", "CSV", "/NH"],
            capture_output=True, text=True, timeout=4
        )
        out = (r.stdout or "").strip()
        if not out or "No tasks" in out:
            return ""
        # CSV: "chrome.exe","1234",...
        first = out.splitlines()[0]
        parts = [p.strip().strip('"') for p in first.split('","')]
        return parts[0].strip('"') if parts else ""
    except Exception:
        return ""


def _win_proc_ppid(pid: int) -> int:
    # PowerShell CIM: schneller als wmic (wmic ist deprecated)
    cmd = [
        "powershell", "-NoProfile", "-Command",
        f"(Get-CimInstance Win32_Process -Filter \"ProcessId={pid}\").ParentProcessId"
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=4)
        s = (r.stdout or "").strip()
        return int(s) if s.isdigit() else 0
    except Exception:
        return 0


def _win_find_pid_by_ports(client_port: int, server_port: int) -> Optional[int]:
    """
    Findet PID des Clients (Browser) über netstat:
      Local: 127.0.0.1:<client_port>  Foreign: 127.0.0.1:<server_port>  PID
    """
    try:
        r = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=5)
        txt = (r.stdout or "")
        best: Optional[int] = None

        for line in txt.splitlines():
            line = line.strip()
            if not line.startswith("TCP"):
                continue
            cols = re.split(r"\s+", line)
            # TCP local foreign state pid
            if len(cols) < 5:
                continue
            local, foreign, state, pid_s = cols[1], cols[2], cols[3], cols[4]
            lh, lp = _parse_host_port(local)
            fh, fp = _parse_host_port(foreign)
            if lp is None or fp is None:
                continue
            if lp == client_port and fp == server_port and pid_s.isdigit():
                best = int(pid_s)
                break

        return best
    except Exception:
        return None


def _win_find_browser_pid_any_connection(server_port: int, prefer_token: Optional[str]) -> Optional[int]:
    """Fallback: irgendein Browser-PID, der mit server_port verbunden ist."""
    try:
        r = subprocess.run(["netstat", "-ano"], capture_output=True, text=True, timeout=5)
        txt = (r.stdout or "")
        candidates: List[int] = []

        for line in txt.splitlines():
            line = line.strip()
            if not line.startswith("TCP"):
                continue
            cols = re.split(r"\s+", line)
            if len(cols) < 5:
                continue
            foreign, pid_s = cols[2], cols[4]
            _, fp = _parse_host_port(foreign)
            if fp != server_port:
                continue
            if not pid_s.isdigit():
                continue
            candidates.append(int(pid_s))

        # dedupe
        candidates = list(dict.fromkeys(candidates))

        # Name match + UA preference
        scored: List[Tuple[int, int]] = []
        for pid in candidates:
            name = _win_tasklist_name(pid).lower()
            if not _is_browser_name(name):
                continue
            score = 1
            if prefer_token and prefer_token in name:
                score = 10
            scored.append((score, pid))

        if not scored:
            return None
        scored.sort(reverse=True)
        return scored[0][1]
    except Exception:
        return None


def _win_kill_pid(pid: int, force: bool) -> Dict[str, Any]:
    # Versuch ohne /F, dann optional /F
    try:
        r1 = subprocess.run(["taskkill", "/PID", str(pid), "/T"], capture_output=True, text=True, timeout=6)
        if r1.returncode == 0:
            return {"ok": True, "method": "taskkill", "forced": False, "stdout": (r1.stdout or "").strip(), "stderr": (r1.stderr or "").strip()}
        if force:
            r2 = subprocess.run(["taskkill", "/PID", str(pid), "/T", "/F"], capture_output=True, text=True, timeout=6)
            return {"ok": (r2.returncode == 0), "method": "taskkill", "forced": True, "stdout": (r2.stdout or "").strip(), "stderr": (r2.stderr or "").strip()}
        return {"ok": False, "method": "taskkill", "forced": False, "stdout": (r1.stdout or "").strip(), "stderr": (r1.stderr or "").strip()}
    except Exception as e:
        return {"ok": False, "error": "taskkill_failed", "detail": str(e)}


# ------------------------
# Linux/mac helpers
# ------------------------
def _proc_name_linux(pid: int) -> str:
    try:
        return Path(f"/proc/{pid}/comm").read_text(encoding="utf-8", errors="replace").strip()
    except Exception:
        return ""


def _proc_ppid_linux(pid: int) -> int:
    try:
        stat = Path(f"/proc/{pid}/stat").read_text(encoding="utf-8", errors="replace")
        # pid (comm) state ppid ...
        # Split carefully: comm can contain spaces but is in parentheses.
        after = stat.split(") ", 1)[1]
        parts = after.split()
        return int(parts[1])  # state=parts[0], ppid=parts[1]
    except Exception:
        return 0


def _pid_exists(pid: int) -> bool:
    if pid <= 0:
        return False
    try:
        os.kill(pid, 0)
        return True
    except Exception:
        return False


def _linux_ss_find_pid(client_port: int, server_port: int) -> Optional[Tuple[int, str]]:
    # ss -tnpH: ohne Header
    for cmd in (["ss", "-tnpH"], ["ss", "-tnp"]):
        try:
            r = subprocess.run(cmd, capture_output=True, text=True, timeout=5)
            txt = (r.stdout or "")
            for line in txt.splitlines():
                line = line.strip()
                if not line:
                    continue
                # Erwartet: STATE ... LOCAL PEER users:(("name",pid=123,fd=..))
                cols = re.split(r"\s+", line)
                if len(cols) < 5:
                    continue
                local = cols[3]
                peer = cols[4]
                _, lp = _parse_host_port(local)
                _, pp = _parse_host_port(peer)
                if lp != client_port or pp != server_port:
                    continue
                m = _RE_SOCK_USERS.search(line)
                if m:
                    name = m.group(1)
                    pid = int(m.group(2))
                    return pid, name
            return None
        except Exception:
            continue
    return None


def _linux_procscan_find_pid(client_port: int, server_port: int) -> Optional[int]:
    """
    Fallback ohne ss/lsof: /proc/net/tcp -> inode -> /proc/*/fd socket:[inode]
    """
    try:
        # /proc/net/tcp: ports in hex
        want_lp = f"{client_port:04X}"
        want_rp = f"{server_port:04X}"

        inode = None
        with open("/proc/net/tcp", "r", encoding="utf-8", errors="replace") as f:
            for line in f.readlines()[1:]:
                parts = line.split()
                if len(parts) < 10:
                    continue
                local_hex = parts[1]  # IP:PORT
                remote_hex = parts[2]
                state = parts[3]
                ino = parts[9]
                if state != "01":  # 01 = ESTABLISHED
                    continue
                if ":" not in local_hex or ":" not in remote_hex:
                    continue
                lp = local_hex.split(":")[1].upper()
                rp = remote_hex.split(":")[1].upper()
                if lp == want_lp and rp == want_rp:
                    inode = ino
                    break

        if not inode:
            return None

        target = f"socket:[{inode}]"
        # scan pids
        for p in os.listdir("/proc"):
            if not p.isdigit():
                continue
            pid = int(p)
            fd_dir = f"/proc/{p}/fd"
            try:
                for fd in os.listdir(fd_dir):
                    fp = os.path.join(fd_dir, fd)
                    try:
                        link = os.readlink(fp)
                        if link == target:
                            return pid
                    except Exception:
                        continue
            except Exception:
                continue

        return None
    except Exception:
        return None


def _posix_kill_browser(pid: int, force: bool, timeout_sec: float = 2.0) -> Dict[str, Any]:
    """
    Beendet pid möglichst sauber:
      - SIGTERM an pid
      - optional SIGTERM an Prozessgruppe (wenn pid Gruppen-Leader ist)
      - Escalation zu SIGKILL bei force
    """
    try:
        if not _pid_exists(pid):
            return {"ok": False, "error": "pid_not_running", "pid": pid}

        # 1) SIGTERM
        os.kill(pid, signal.SIGTERM)

        t0 = time.time()
        while time.time() - t0 < timeout_sec:
            if not _pid_exists(pid):
                return {"ok": True, "method": "sigterm", "forced": False}
            time.sleep(0.05)

        # 2) Prozessgruppe (nur wenn sicher)
        try:
            pgid = os.getpgid(pid)
            if pgid == pid:
                os.killpg(pgid, signal.SIGTERM)
                t1 = time.time()
                while time.time() - t1 < 0.8:
                    if not _pid_exists(pid):
                        return {"ok": True, "method": "sigterm_pgroup", "forced": False}
                    time.sleep(0.05)
        except Exception:
            pass

        if not force:
            return {"ok": False, "error": "sigterm_timeout", "pid": pid}

        # 3) SIGKILL (force)
        try:
            os.kill(pid, signal.SIGKILL)
        except Exception:
            pass

        try:
            pgid = os.getpgid(pid)
            if pgid == pid:
                os.killpg(pgid, signal.SIGKILL)
        except Exception:
            pass

        time.sleep(0.1)
        return {"ok": (not _pid_exists(pid)), "method": "sigkill", "forced": True, "pid": pid}
    except Exception as e:
        return {"ok": False, "error": "kill_failed", "detail": str(e), "pid": pid}


# ------------------------
# Root PID resolution (Browser-Hauptprozess)
# ------------------------
def _resolve_root_browser_pid(pid: int, name: str) -> int:
    """
    Einige Browser (Chrome/Edge) nutzen viele Child-Prozesse.
    Wir laufen Parent-Kette hoch, solange Parent ebenfalls Browser-Name ist.
    """
    sysname = platform.system()
    root = pid
    cur = pid
    for _ in range(12):  # begrenzen
        if sysname == "Windows":
            ppid = _win_proc_ppid(cur)
            if ppid <= 0:
                break
            pname = _win_tasklist_name(ppid)
            if not _is_browser_name(pname):
                break
            root = ppid
            cur = ppid
        else:
            ppid = _proc_ppid_linux(cur)
            if ppid <= 0:
                break
            pname = _proc_name_linux(ppid)
            if not _is_browser_name(pname):
                break
            root = ppid
            cur = ppid
    return root


# ------------------------
# Public API
# ------------------------
def close_browser_from_request(
    *,
    client_ip: str,
    client_port: int,
    server_ip: str,
    server_port: int,
    user_agent: str = "",
    force: bool = False,
) -> Dict[str, Any]:
    """
    Findet den Browserprozess, der die HTTP-Connection zu server_port aufgebaut hat,
    und beendet ihn (Key-Check passiert im Server).
    """
    sysname = platform.system()
    prefer = _ua_prefer_token(user_agent)

    # 1) Primär: PID über genaue Connection (client_port -> server_port)
    pid: Optional[int] = None
    pname: str = ""

    if sysname == "Windows":
        pid = _win_find_pid_by_ports(client_port, server_port)
        if pid:
            pname = _win_tasklist_name(pid)
        if not pid:
            pid = _win_find_browser_pid_any_connection(server_port, prefer)
            if pid:
                pname = _win_tasklist_name(pid)
    else:
        got = _linux_ss_find_pid(client_port, server_port)
        if got:
            pid, pname = got
        if not pid:
            # Fallback procscan
            pid2 = _linux_procscan_find_pid(client_port, server_port)
            if pid2:
                pid = pid2
                pname = _proc_name_linux(pid)

    if not pid:
        return {
            "ok": False,
            "error": "pid_not_found",
            "hint": "Konnte keinen Client-PID über netstat/ss (/proc fallback) finden.",
            "client_ip": client_ip,
            "client_port": client_port,
            "server_ip": server_ip,
            "server_port": server_port,
            "platform": sysname,
        }

    # 2) Sicherheit: Nur Browser-Prozesse killen (außer force)
    if not _is_browser_name(pname) and not force:
        return {
            "ok": False,
            "error": "not_a_browser_process",
            "pid": pid,
            "process_name": pname,
            "hint": "PID gehört nicht zu einem bekannten Browser (Schutz). Nutze force=true, wenn du es trotzdem willst.",
            "platform": sysname,
        }

    # 3) Root PID bestimmen (Hauptprozess)
    root_pid = _resolve_root_browser_pid(pid, pname)

    # nie den eigenen Prozess killen
    if root_pid == os.getpid():
        return {"ok": False, "error": "refuse_kill_self", "pid": root_pid}

    # Root-Name
    root_name = ""
    if sysname == "Windows":
        root_name = _win_tasklist_name(root_pid)
    else:
        root_name = _proc_name_linux(root_pid)

    # 4) Kill
    if sysname == "Windows":
        kr = _win_kill_pid(root_pid, force=True)  # in Kiosk meist ok -> /F fallback aktiv
    else:
        kr = _posix_kill_browser(root_pid, force=True)

    return {
        "ok": bool(kr.get("ok")),
        "platform": sysname,
        "client_port": client_port,
        "server_port": server_port,
        "user_agent": user_agent,
        "pid_found": pid,
        "pid_found_name": pname,
        "root_pid": root_pid,
        "root_name": root_name,
        "kill": kr,
    }
