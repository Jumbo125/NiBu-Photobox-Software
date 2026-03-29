# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
printer_core.py — Printer helpers for Photobooth (Windows + Linux)

Features:
- List printers / default printer (Windows via CIM, Linux via CUPS tools)
- Set default printer
- Open printer GUI
- Print an image on:
    - Windows: MSPaint (/pt) to default printer (silent queue)
      Optional printer selection:
        1) try MSPaint with explicit printer name: mspaint.exe /pt <file> "<printer>"
        2) fallback: temporarily set default printer -> print -> restore previous default
    - Linux: CUPS via lp, optional -d <printer>
- Update "active_event.print_counter" inside an event file (JSON, even if file extension is .xml)

Notes:
- `event_file` is expected to contain JSON with a top-level object, and a nested
  dict `active_event` holding fields:
    - print_counter (int)
    - max_prints (int, 0 = unlimited)
- If JSON parsing fails, we try a lenient fallback:
  extract the first {...} block from the file and parse it as JSON.
"""

import json
import os
import re
import shutil
import subprocess
import tempfile
from urllib.parse import quote
from typing import Optional, Dict, Any, List, Union


# ----------------------------
# OS / command helpers
# ----------------------------

def is_windows() -> bool:
    return os.name == "nt" or os.sys.platform.startswith("win")


def which(cmd: str) -> Optional[str]:
    return shutil.which(cmd)


def run_cmd(args: List[str], timeout: int = 8) -> Dict[str, Any]:
    """Run a subprocess command and capture output."""
    try:
        p = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=False
        )
        return {
            "ok": (p.returncode == 0),
            "rc": p.returncode,
            "out": (p.stdout or "").strip(),
            "err": (p.stderr or "").strip(),
            "cmd": args,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "rc": -1, "error": "timeout", "cmd": args}
    except Exception as e:
        return {"ok": False, "rc": -1, "error": str(e), "cmd": args}


# ----------------------------
# Printer listing / selection
# ----------------------------

def list_printers() -> Dict[str, Any]:
    """Return printers + default printer."""
    if is_windows():
        ps = (
            "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; "
            "$OutputEncoding=[Console]::OutputEncoding; "
            "$ErrorActionPreference='Stop'; "
            "$p = Get-CimInstance Win32_Printer | Select-Object Name, Default; "
            "$p | ConvertTo-Json -Compress"
        )
        r = run_cmd(
            ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
            timeout=8
        )

        if not r.get("ok") or not r.get("out"):
            return {"ok": False, "error": "printer_list_failed", "detail": r}

        try:
            data = json.loads(r["out"])
            if isinstance(data, dict):
                data = [data]

            printers: List[str] = []
            default_printer = ""

            for item in data:
                name = (item.get("Name") or "").strip()
                if not name:
                    continue
                printers.append(name)
                if item.get("Default") and not default_printer:
                    default_printer = name

            printers = sorted(list(dict.fromkeys(printers)))
            return {
                "ok": True,
                "printers": printers,
                "defaultPrinter": default_printer,
                "os": "windows",
            }
        except Exception as e:
            return {
                "ok": False,
                "error": "json_parse_failed",
                "message": str(e),
                "raw": r.get("out", ""),
            }

    # Linux
    if which("lpstat") is None:
        return {"ok": False, "error": "lpstat_not_found", "hint": "Install CUPS tools (lpstat)"}

    p = run_cmd(["lpstat", "-p"], timeout=5)
    if not p.get("ok"):
        return {"ok": False, "error": "lpstat_failed", "detail": p}

    printers: List[str] = []
    for line in (p.get("out") or "").splitlines():
        m = re.match(r"^printer\s+(\S+)\s+", line.strip())
        if m:
            printers.append(m.group(1))

    d = run_cmd(["lpstat", "-d"], timeout=5)
    system_default = ""
    m = re.search(r":\s*(\S+)\s*$", (d.get("out") or "").strip())
    if m:
        system_default = m.group(1)

    user_default = ""
    if which("lpoptions"):
        u = run_cmd(["lpoptions"], timeout=5)
        mm = re.search(r"\bdest=([^\s]+)", (u.get("out") or ""))
        if mm:
            user_default = mm.group(1)

    printers = sorted(list(dict.fromkeys(printers)))
    default_printer = user_default or system_default

    return {
        "ok": True,
        "printers": printers,
        "defaultPrinter": default_printer,
        "userDefault": user_default,
        "systemDefault": system_default,
        "os": "linux",
    }


def printer_exists(name: str) -> bool:
    name = (name or "").strip()
    if not name:
        return False
    lst = list_printers()
    if not lst.get("ok"):
        return False
    return name in (lst.get("printers") or [])


def get_default_printer_windows() -> Dict[str, Any]:
    """Get current Windows default printer name."""
    if not is_windows():
        return {"ok": False, "error": "not_windows"}

    ps = (
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; "
        "$OutputEncoding=[Console]::OutputEncoding; "
        "$ErrorActionPreference='Stop'; "
        "$p = Get-CimInstance Win32_Printer | Where-Object {$_.Default -eq $true} | "
        "Select-Object -First 1 -ExpandProperty Name; "
        "if ($p) { $p }"
    )
    r = run_cmd(["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps], timeout=8)
    name = (r.get("out") or "").strip()
    if r.get("ok") and name:
        return {"ok": True, "defaultPrinter": name}
    return {"ok": False, "error": "get_default_failed", "detail": r}


def set_default_printer(name: str) -> Dict[str, Any]:
    """Set default printer."""
    name = (name or "").strip()
    if not name:
        return {"ok": False, "error": "no_printer_selected"}

    if is_windows():
        r = run_cmd(["rundll32", "printui.dll,PrintUIEntry", "/y", "/n", name], timeout=8)
        if not r.get("ok"):
            return {"ok": False, "error": "set_default_failed", "detail": r}

        lst = list_printers()
        ok = lst.get("ok") and lst.get("defaultPrinter") == name
        return {"ok": ok, "defaultPrinter": lst.get("defaultPrinter", ""), "verified": ok, "os": "windows"}

    if which("lpoptions") is None:
        return {"ok": False, "error": "lpoptions_not_found", "hint": "Install CUPS client tools (lpoptions)"}

    r = run_cmd(["lpoptions", "-d", name], timeout=5)
    if not r.get("ok"):
        return {"ok": False, "error": "set_default_failed", "detail": r, "os": "linux"}

    lst = list_printers()
    ok = lst.get("ok") and (lst.get("defaultPrinter") == name)
    return {"ok": ok, "defaultPrinter": name, "verified": ok, "userDefault": True, "os": "linux"}


def open_printer_gui(printer: Optional[str], kind: str) -> Dict[str, Any]:
    """Open OS printer GUI/settings."""
    printer = (printer or "").strip()
    kind = (kind or "overview").strip().lower()

    if is_windows():
        try:
            if kind == "overview" or printer == "":
                subprocess.Popen(["control.exe", "printers"], close_fds=True)
                return {"ok": True, "os": "windows", "action": "overview"}

            if kind.startswith("pref"):
                args = ["rundll32", "printui.dll,PrintUIEntry", "/e", "/n", printer]
            else:
                args = ["rundll32", "printui.dll,PrintUIEntry", "/p", "/n", printer]

            subprocess.Popen(args, close_fds=True)
            return {"ok": True, "os": "windows", "action": kind, "printer": printer}
        except Exception as e:
            return {"ok": False, "os": "windows", "error": str(e)}

    candidates: List[List[str]] = []
    if which("system-config-printer"):
        candidates.append(["system-config-printer"])
    if which("gnome-control-center"):
        candidates.append(["gnome-control-center", "printers"])
    if which("kcmshell6"):
        candidates.append(["kcmshell6", "kcm_printer_manager"])
    if which("kcmshell5"):
        candidates.append(["kcmshell5", "kcm_printer_manager"])

    if which("xdg-open"):
        if printer:
            candidates.append(["xdg-open", f"http://localhost:631/printers/{quote(printer)}"])
        candidates.append(["xdg-open", "http://localhost:631/printers"])

    for cmd in candidates:
        try:
            subprocess.Popen(cmd, close_fds=True)
            return {"ok": True, "os": "linux", "action": "gui_opened", "cmd": cmd}
        except Exception:
            continue

    return {"ok": False, "os": "linux", "error": "no_printer_gui_found"}


# ----------------------------
# Printing + counter helpers
# ----------------------------

def _norm_printer_name(s: str) -> str:
    s = (s or "").replace("\u00A0", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s.casefold()

def resolve_printer_name(requested: str) -> dict:
    requested = (requested or "").strip()
    if not requested:
        return {"ok": True, "printer": None}

    lst = list_printers()
    if not lst.get("ok"):
        return {"ok": False, "error": "printer_list_failed", "detail": lst}

    printers = lst.get("printers") or []
    want = _norm_printer_name(requested)

    # map normalized -> actual
    mp = {}
    for p in printers:
        mp[_norm_printer_name(p)] = p

    if want in mp:
        return {"ok": True, "printer": mp[want], "matched": True}

    return {
        "ok": False,
        "error": "unknown_printer",
        "printer": requested,
        "printers": printers
    }


def _atomic_write_json(path: str, obj: Dict[str, Any]) -> None:
    """Write JSON atomically (temp file + os.replace)."""
    d = os.path.dirname(os.path.abspath(path)) or "."
    os.makedirs(d, exist_ok=True)
    fd, tmp = tempfile.mkstemp(prefix="._tmp_", dir=d, text=True)
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


def _is_supported_image(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    return ext in (".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif", ".tiff", ".webp")


def print_image(image_path: str, copies: int = 1, printer_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Print an image.
      - Linux: lp [-d printer] -n copies file
      - Windows: MSPaint /pt file [printer]
        If printer is given and MSPaint fails with explicit printer, fallback:
          temporarily set default printer -> print -> restore previous default.
    """
    image_path = (image_path or "").strip()
    printer_name = (printer_name or "").strip() or None

    if not image_path or not os.path.isfile(image_path):
        return {"ok": False, "error": "file_not_found", "path": image_path}

    if not _is_supported_image(image_path):
        return {"ok": False, "error": "unsupported_image_type", "path": image_path}

    copies = int(copies or 1)
    if copies < 1:
        copies = 1
    if copies > 20:
        copies = 20  # kiosk safety

    # optional: validate printer exists (clearer errors)
    if printer_name:
        rr = resolve_printer_name(printer_name)
        if not rr.get("ok"):
            return {"ok": False, **rr}
        printer_name = rr.get("printer")  # <-- canonical name

    if is_windows():
        # 1) If printer explicitly provided, try MSPaint with printer name (some setups support this)
        if printer_name:
            last = None
            ok_all = True
            for _ in range(copies):
                last = run_cmd(["mspaint.exe", "/pt", image_path, printer_name], timeout=30)
                if not last.get("ok"):
                    ok_all = False
                    break
            if ok_all:
                return {
                    "ok": True,
                    "method": "mspaint_pt_printer",
                    "queued": True,
                    "copies": copies,
                    "printer": printer_name,
                    "detail": last or {},
                }

            # 2) Fallback: temporarily change default printer -> print -> restore
            prev = get_default_printer_windows()
            prev_name = prev.get("defaultPrinter") if prev.get("ok") else None

            try:
                sw = set_default_printer(printer_name)
                if not sw.get("ok"):
                    return {"ok": False, "error": "set_default_failed", "printer": printer_name, "detail": sw}

                last2 = None
                for _ in range(copies):
                    last2 = run_cmd(["mspaint.exe", "/pt", image_path], timeout=30)
                    if not last2.get("ok"):
                        return {
                            "ok": False,
                            "error": "print_failed",
                            "method": "mspaint_pt",
                            "printer": printer_name,
                            "detail": last2,
                        }

                return {
                    "ok": True,
                    "method": "mspaint_pt_via_default",
                    "queued": True,
                    "copies": copies,
                    "printer": printer_name,
                    "detail": last2 or {},
                }

            finally:
                if prev_name and prev_name != printer_name:
                    try:
                        set_default_printer(prev_name)
                    except Exception:
                        pass

        # No printer specified: print to default
        last = None
        for _ in range(copies):
            last = run_cmd(["mspaint.exe", "/pt", image_path], timeout=30)
            if not last.get("ok"):
                return {"ok": False, "error": "print_failed", "method": "mspaint_pt", "detail": last}
        return {"ok": True, "method": "mspaint_pt", "queued": True, "copies": copies, "detail": last or {}}

    # Linux / CUPS
    if which("lp") is None:
        return {"ok": False, "error": "lp_not_found", "hint": "Install CUPS client tools (lp)"}

    cmd = ["lp"]
    if printer_name:
        cmd += ["-d", printer_name]
    cmd += ["-n", str(copies), image_path]

    r = run_cmd(cmd, timeout=15)
    if not r.get("ok"):
        return {"ok": False, "error": "print_failed", "method": "lp", "printer": printer_name, "detail": r}

    return {"ok": True, "method": "lp", "queued": True, "copies": copies, "printer": printer_name, "detail": r}


def _parse_event_file_lenient(text: str) -> Dict[str, Any]:
    """
    Best-effort JSON parser:
    - first try json.loads(text)
    - then try to extract first {...} block and parse that
    """
    text = text or ""
    # direct
    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    # extract first {...}
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        snippet = text[start:end + 1]
        obj2 = json.loads(snippet)
        if isinstance(obj2, dict):
            return obj2

    raise ValueError("Could not parse JSON from event file")


def bump_print_counter(event_path: str, inc: int) -> Dict[str, Any]:
    """
    Increase active_event.print_counter inside event file.
    Respects active_event.max_prints: 0 = unlimited.
    """
    event_path = (event_path or "").strip()
    if not event_path or not os.path.isfile(event_path):
        return {"ok": False, "error": "event_file_not_found", "event_file": event_path}

    inc = int(inc or 1)
    if inc < 1:
        inc = 1

    # read file
    try:
        with open(event_path, "r", encoding="utf-8", errors="replace") as f:
            raw = f.read()
    except Exception as e:
        return {"ok": False, "error": "event_read_failed", "message": str(e)}

    # parse json (strict -> lenient)
    try:
        data = json.loads(raw)
        if not isinstance(data, dict):
            return {"ok": False, "error": "invalid_event_root"}
    except Exception:
        try:
            data = _parse_event_file_lenient(raw)
        except Exception as e2:
            return {"ok": False, "error": "event_parse_failed", "message": str(e2)}

    ae = data.get("active_event")
    if not isinstance(ae, dict):
        ae = {}
        data["active_event"] = ae

    max_prints = int(ae.get("max_prints") or 0)  # 0 = unlimited
    before = int(ae.get("print_counter") or 0)

    if max_prints > 0 and before + inc > max_prints:
        return {"ok": False, "error": "max_prints_reached", "max_prints": max_prints, "counter": before}

    ae["print_counter"] = before + inc
    _atomic_write_json(event_path, data)

    return {"ok": True, "counter_before": before, "counter_after": before + inc, "max_prints": max_prints}


# Backward compatible alias (prints to default)
def print_image_default(image_path: str, copies: int = 1) -> Dict[str, Any]:
    return print_image(image_path=image_path, copies=copies, printer_name=None)
