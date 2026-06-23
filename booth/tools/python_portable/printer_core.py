# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
printer_core.py — Printer helpers for Photobooth (Windows + Linux)

Goals of this rewrite:
- No hard pywin32 dependency at import time
- Windows printer selection/default handling prefers win32print when available
- Windows falls back to PowerShell / PrintUI where sensible
- Linux continues to use CUPS tools (lp, lpstat, lpoptions)
- Public function names and return structures stay broadly compatible
- Windows printing uses pywin32 + Pillow when available

Features:
- List printers / default printer
- Set default printer
- Open printer GUI
- Print an image on:
    - Windows: direct GDI printing to default printer (silent, no dialog, proportional fit)
      Optional printer selection remains supported via explicit printer_name
    - Linux: CUPS via lp, optional -d <printer>
- Update "active_event.print_counter" inside an event file (JSON,
  even if the file extension is .xml)

Notes:
- event_file is expected to contain JSON with a top-level object, and a nested
  dict active_event holding:
    - print_counter (int)
    - max_prints (int, 0 = unlimited)
- If JSON parsing fails, a lenient fallback extracts the first {...} block.
"""

from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
import tempfile
import ctypes
from typing import Any, Dict, List, Optional
from urllib.parse import quote


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
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            shell=False,
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


def _windows_shell_execute(file: str, params: str = "") -> Dict[str, Any]:
    """Start a Windows GUI action visibly via ShellExecuteW."""
    try:
        rc = ctypes.windll.shell32.ShellExecuteW(None, "open", file, params, None, 1)
        ok = int(rc) > 32
        return {
            "ok": ok,
            "rc": int(rc),
            "cmd": ["ShellExecuteW", file, params],
        }
    except Exception as e:
        return {
            "ok": False,
            "rc": -1,
            "error": str(e),
            "cmd": ["ShellExecuteW", file, params],
        }


def _windows_desktop_context() -> Dict[str, Any]:
    user = os.environ.get("USERNAME") or ""
    session_name = os.environ.get("SESSIONNAME") or ""
    is_machine_account = user.endswith("$")

    # SESSIONNAME may be absent when the process is launched via pythonw.exe,
    # Task Scheduler, or a parent that did not inherit the desktop environment.
    # Fall back to checking whether the process has a visible window station.
    has_session = bool(session_name)
    if not has_session:
        try:
            # GetConsoleWindow returns non-NULL for console processes on a desktop
            has_console = ctypes.windll.kernel32.GetConsoleWindow() != 0
            # ProcessIdToSessionId tells us the logon session id (0 = services)
            session_id = ctypes.c_ulong(0)
            ctypes.windll.kernel32.ProcessIdToSessionId(
                ctypes.windll.kernel32.GetCurrentProcessId(),
                ctypes.byref(session_id),
            )
            has_session = has_console or (session_id.value != 0)
        except Exception:
            # If the Win32 calls fail, assume interactive rather than block the user
            has_session = True

    is_interactive = has_session and not is_machine_account
    return {
        "pid": os.getpid(),
        "user": user,
        "userDomain": os.environ.get("USERDOMAIN") or "",
        "sessionName": session_name,
        "isInteractive": is_interactive,
        "isMachineAccount": is_machine_account,
    }


# ----------------------------
# Windows helpers (optional pywin32)
# ----------------------------


def _get_win32print():
    """Import win32print lazily so Linux / non-pywin32 setups still work."""
    if not is_windows():
        raise RuntimeError("not_windows")
    import win32print  # type: ignore

    return win32print



def _get_win32ui():
    """Import win32ui lazily for direct GDI printing on Windows."""
    if not is_windows():
        raise RuntimeError("not_windows")
    import win32ui  # type: ignore

    return win32ui



def _get_pillow_modules():
    """Import Pillow modules lazily so they are only required when printing on Windows."""
    from PIL import Image, ImageOps, ImageWin  # type: ignore

    return Image, ImageOps, ImageWin


def _powershell_available() -> bool:
    return which("powershell") is not None or which("powershell.exe") is not None


def _list_printers_windows_win32() -> Dict[str, Any]:
    """Windows printer list via win32print (preferred)."""
    try:
        win32print = _get_win32print()
        flags = win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS
        items = win32print.EnumPrinters(flags)

        printers: List[str] = []
        for item in items:
            # Common pywin32 tuple layout: (flags, description, name, comment)
            name = item[2] if len(item) > 2 else None
            if name:
                printers.append(str(name))

        printers = sorted(dict.fromkeys(printers))

        try:
            default_printer = str(win32print.GetDefaultPrinter())
        except Exception:
            default_printer = ""

        return {
            "ok": True,
            "printers": printers,
            "defaultPrinter": default_printer,
            "os": "windows",
            "backend": "win32print",
        }
    except ImportError:
        return {
            "ok": False,
            "error": "pywin32_not_installed",
            "hint": "pip install pywin32",
            "os": "windows",
            "backend": "win32print",
        }
    except Exception as e:
        return {
            "ok": False,
            "error": "printer_list_failed",
            "message": str(e),
            "os": "windows",
            "backend": "win32print",
        }



def _list_printers_windows_powershell() -> Dict[str, Any]:
    """Windows printer list via PowerShell / CIM fallback."""
    if not _powershell_available():
        return {
            "ok": False,
            "error": "powershell_not_found",
            "os": "windows",
            "backend": "powershell",
        }

    ps = (
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; "
        "$OutputEncoding=[Console]::OutputEncoding; "
        "$ErrorActionPreference='Stop'; "
        "$p = Get-CimInstance Win32_Printer | Select-Object Name, Default; "
        "$p | ConvertTo-Json -Compress"
    )
    r = run_cmd(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
        timeout=8,
    )
    if not r.get("ok") or not r.get("out"):
        return {
            "ok": False,
            "error": "printer_list_failed",
            "detail": r,
            "os": "windows",
            "backend": "powershell",
        }

    try:
        data = json.loads(r["out"])
        if isinstance(data, dict):
            data = [data]

        printers: List[str] = []
        default_printer = ""
        for row in data:
            if not isinstance(row, dict):
                continue
            name = str(row.get("Name") or "").strip()
            if name:
                printers.append(name)
            if row.get("Default") is True and name:
                default_printer = name

        printers = sorted(dict.fromkeys(printers))
        return {
            "ok": True,
            "printers": printers,
            "defaultPrinter": default_printer,
            "os": "windows",
            "backend": "powershell",
        }
    except Exception as e:
        return {
            "ok": False,
            "error": "printer_list_parse_failed",
            "message": str(e),
            "detail": r,
            "os": "windows",
            "backend": "powershell",
        }



def _get_default_printer_windows_win32() -> Dict[str, Any]:
    try:
        win32print = _get_win32print()
        name = str(win32print.GetDefaultPrinter() or "").strip()
        if name:
            return {
                "ok": True,
                "defaultPrinter": name,
                "os": "windows",
                "backend": "win32print",
            }
        return {
            "ok": False,
            "error": "get_default_failed",
            "os": "windows",
            "backend": "win32print",
        }
    except ImportError:
        return {
            "ok": False,
            "error": "pywin32_not_installed",
            "hint": "pip install pywin32",
            "os": "windows",
            "backend": "win32print",
        }
    except Exception as e:
        return {
            "ok": False,
            "error": "get_default_failed",
            "message": str(e),
            "os": "windows",
            "backend": "win32print",
        }



def _get_default_printer_windows_powershell() -> Dict[str, Any]:
    if not _powershell_available():
        return {
            "ok": False,
            "error": "powershell_not_found",
            "os": "windows",
            "backend": "powershell",
        }

    ps = (
        "[Console]::OutputEncoding=[System.Text.Encoding]::UTF8; "
        "$OutputEncoding=[Console]::OutputEncoding; "
        "$ErrorActionPreference='Stop'; "
        "$p = Get-CimInstance Win32_Printer | Where-Object {$_.Default -eq $true} | "
        "Select-Object -First 1 -ExpandProperty Name; "
        "if ($p) { $p }"
    )
    r = run_cmd(
        ["powershell", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", ps],
        timeout=8,
    )
    name = (r.get("out") or "").strip()
    if r.get("ok") and name:
        return {
            "ok": True,
            "defaultPrinter": name,
            "os": "windows",
            "backend": "powershell",
        }

    return {
        "ok": False,
        "error": "get_default_failed",
        "detail": r,
        "os": "windows",
        "backend": "powershell",
    }



def _set_default_printer_windows_win32(name: str) -> Dict[str, Any]:
    try:
        win32print = _get_win32print()
        win32print.SetDefaultPrinter(name)
        current = str(win32print.GetDefaultPrinter() or "").strip()
        ok = current == name
        return {
            "ok": ok,
            "defaultPrinter": current,
            "verified": ok,
            "os": "windows",
            "backend": "win32print",
        }
    except ImportError:
        return {
            "ok": False,
            "error": "pywin32_not_installed",
            "hint": "pip install pywin32",
            "os": "windows",
            "backend": "win32print",
        }
    except Exception as e:
        return {
            "ok": False,
            "error": "set_default_failed",
            "message": str(e),
            "os": "windows",
            "backend": "win32print",
        }



def _set_default_printer_windows_printui(name: str) -> Dict[str, Any]:
    r = run_cmd(["rundll32", "printui.dll,PrintUIEntry", "/y", "/n", name], timeout=8)
    if not r.get("ok"):
        return {
            "ok": False,
            "error": "set_default_failed",
            "detail": r,
            "os": "windows",
            "backend": "printui",
        }

    verify = get_default_printer_windows()
    current = verify.get("defaultPrinter", "") if verify.get("ok") else ""
    ok = bool(verify.get("ok") and current == name)
    return {
        "ok": ok,
        "defaultPrinter": current,
        "verified": ok,
        "os": "windows",
        "backend": "printui",
        "detail": r,
    }


# ----------------------------
# Printer listing / selection
# ----------------------------


def list_printers() -> Dict[str, Any]:
    """Return printers + default printer."""
    if is_windows():
        primary = _list_printers_windows_win32()
        if primary.get("ok"):
            return primary

        fallback = _list_printers_windows_powershell()
        if fallback.get("ok"):
            fallback["fallbackFrom"] = primary.get("backend")
            return fallback

        return {
            "ok": False,
            "error": "printer_list_failed",
            "primary": primary,
            "fallback": fallback,
            "os": "windows",
        }

    # Linux / CUPS
    if which("lpstat") is None:
        return {
            "ok": False,
            "error": "lpstat_not_found",
            "hint": "Install CUPS tools (lpstat)",
            "os": "linux",
        }

    p = run_cmd(["lpstat", "-p"], timeout=5)
    if not p.get("ok"):
        return {"ok": False, "error": "lpstat_failed", "detail": p, "os": "linux"}

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

    printers = sorted(dict.fromkeys(printers))
    default_printer = user_default or system_default

    return {
        "ok": True,
        "printers": printers,
        "defaultPrinter": default_printer,
        "userDefault": user_default,
        "systemDefault": system_default,
        "os": "linux",
        "backend": "cups-tools",
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

    primary = _get_default_printer_windows_win32()
    if primary.get("ok"):
        return primary

    fallback = _get_default_printer_windows_powershell()
    if fallback.get("ok"):
        fallback["fallbackFrom"] = primary.get("backend")
        return fallback

    return {
        "ok": False,
        "error": "get_default_failed",
        "primary": primary,
        "fallback": fallback,
        "os": "windows",
    }



def set_default_printer(name: str) -> Dict[str, Any]:
    """Set default printer."""
    name = (name or "").strip()
    if not name:
        return {"ok": False, "error": "no_printer_selected"}

    if is_windows():
        resolved = resolve_printer_name(name)
        if not resolved.get("ok"):
            return {"ok": False, **resolved, "os": "windows"}
        canonical = resolved.get("printer") or name

        primary = _set_default_printer_windows_win32(canonical)
        if primary.get("ok"):
            primary["requestedPrinter"] = name
            primary["printer"] = canonical
            return primary

        fallback = _set_default_printer_windows_printui(canonical)
        if fallback.get("ok"):
            fallback["fallbackFrom"] = primary.get("backend")
            fallback["requestedPrinter"] = name
            fallback["printer"] = canonical
            return fallback

        return {
            "ok": False,
            "error": "set_default_failed",
            "primary": primary,
            "fallback": fallback,
            "requestedPrinter": name,
            "printer": canonical,
            "os": "windows",
        }

    if which("lpoptions") is None:
        return {
            "ok": False,
            "error": "lpoptions_not_found",
            "hint": "Install CUPS client tools (lpoptions)",
            "os": "linux",
        }

    r = run_cmd(["lpoptions", "-d", name], timeout=5)
    if not r.get("ok"):
        return {"ok": False, "error": "set_default_failed", "detail": r, "os": "linux"}

    lst = list_printers()
    ok = lst.get("ok") and (lst.get("defaultPrinter") == name)
    return {
        "ok": ok,
        "defaultPrinter": name,
        "verified": ok,
        "userDefault": True,
        "os": "linux",
    }



def open_printer_gui(printer: Optional[str], kind: str) -> Dict[str, Any]:
    """Open OS printer GUI/settings."""
    printer = (printer or "").strip()
    kind = (kind or "overview").strip().lower()

    if is_windows():
        try:
            desktop = _windows_desktop_context()

            if not desktop.get("isInteractive"):
                return {
                    "ok": False,
                    "os": "windows",
                    "error": "non_interactive_windows_session",
                    "message": (
                        "Windows printer dialogs can only be shown from the logged-in "
                        "interactive user session. The Python server is currently not "
                        "running in that visible desktop."
                    ),
                    "desktop": desktop,
                }

            def open_windows_printer_overview() -> Dict[str, Any]:
                attempts: List[Dict[str, Any]] = []

                r = _windows_shell_execute("ms-settings:printers")
                attempts.append(r)
                if r.get("ok"):
                    return {"ok": True, "cmd": r.get("cmd"), "attempts": attempts}

                r = _windows_shell_execute("explorer.exe", "ms-settings:printers")
                attempts.append(r)
                if r.get("ok"):
                    return {"ok": True, "cmd": r.get("cmd"), "attempts": attempts}

                args = ["control.exe", "printers"]
                subprocess.Popen(args, close_fds=True)
                attempts.append({"ok": True, "cmd": args})
                return {"ok": True, "cmd": args, "attempts": attempts}

            if kind == "overview" or printer == "":
                overview = open_windows_printer_overview()
                return {
                    "ok": True,
                    "os": "windows",
                    "action": "overview",
                    "cmd": overview.get("cmd"),
                    "attempts": overview.get("attempts"),
                    "desktop": desktop,
                }

            resolved = resolve_printer_name(printer)
            if not resolved.get("ok"):
                return {
                    "ok": False,
                    "os": "windows",
                    "error": "printer_not_found",
                    "printer": printer,
                    "detail": resolved,
                }

            canonical = str(resolved.get("printer") or printer)

            if kind.startswith("pref"):
                printui_params = f'printui.dll,PrintUIEntry /e /n "{canonical}"'
                fallback_params = f'printui.dll,PrintUIEntry /p /n "{canonical}"'
            else:
                printui_params = f'printui.dll,PrintUIEntry /p /n "{canonical}"'
                fallback_params = ""

            attempts: List[Dict[str, Any]] = []
            r = _windows_shell_execute("rundll32.exe", printui_params)
            attempts.append(r)

            if r.get("ok"):
                return {
                    "ok": True,
                    "os": "windows",
                    "action": kind,
                    "printer": canonical,
                    "requestedPrinter": printer,
                    "cmd": r.get("cmd"),
                    "attempts": attempts,
                    "fallback": False,
                    "desktop": desktop,
                }

            if fallback_params:
                r = _windows_shell_execute("rundll32.exe", fallback_params)
                attempts.append(r)
                if r.get("ok"):
                    return {
                        "ok": True,
                        "os": "windows",
                        "action": "properties",
                        "requestedAction": kind,
                        "printer": canonical,
                        "requestedPrinter": printer,
                        "cmd": r.get("cmd"),
                        "attempts": attempts,
                        "fallback": True,
                        "desktop": desktop,
                    }

            overview = open_windows_printer_overview()
            attempts.extend(overview.get("attempts") or [])
            return {
                "ok": True,
                "os": "windows",
                "action": "overview",
                "requestedAction": kind,
                "printer": canonical,
                "requestedPrinter": printer,
                "cmd": overview.get("cmd"),
                "attempts": attempts,
                "fallback": True,
                "desktop": desktop,
                "message": "Specific printer dialog did not stay open; opened printer overview instead.",
            }
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


def _norm_printer_name(value: str) -> str:
    value = (value or "").replace("\u00A0", " ")
    value = re.sub(r"\s+", " ", value).strip()
    return value.casefold()



def resolve_printer_name(requested: str) -> Dict[str, Any]:
    """Resolve a user-supplied printer name against installed printers."""
    requested = (requested or "").strip()
    if not requested:
        return {"ok": True, "printer": None}

    lst = list_printers()
    if not lst.get("ok"):
        return {"ok": False, "error": "printer_list_failed", "detail": lst}

    printers = lst.get("printers") or []
    want = _norm_printer_name(requested)

    mapping: Dict[str, str] = {}
    for printer in printers:
        mapping[_norm_printer_name(printer)] = printer

    if want in mapping:
        return {"ok": True, "printer": mapping[want], "matched": True}

    return {
        "ok": False,
        "error": "unknown_printer",
        "printer": requested,
        "printers": printers,
    }



def _atomic_write_json(path: str, obj: Dict[str, Any]) -> None:
    """Write JSON atomically (temp file + os.replace)."""
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



def _is_supported_image(path: str) -> bool:
    ext = os.path.splitext(path)[1].lower()
    return ext in (".jpg", ".jpeg", ".png", ".bmp", ".gif", ".tif", ".tiff", ".webp")



def _fit_rect(src_w: int, src_h: int, max_w: int, max_h: int) -> tuple[int, int]:
    """Return a centered fit size without cropping."""
    if src_w <= 0 or src_h <= 0 or max_w <= 0 or max_h <= 0:
        return max(1, max_w), max(1, max_h)

    scale = min(max_w / float(src_w), max_h / float(src_h))
    dst_w = max(1, int(round(src_w * scale)))
    dst_h = max(1, int(round(src_h * scale)))
    return dst_w, dst_h



def _print_windows_gdi_fit(image_path: str, copies: int, printer_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Print directly to a Windows printer using GDI and Pillow.
    - no print dialog
    - uses current printer defaults unless the caller explicitly chooses a printer
    - keeps the full image and scales proportionally to fit the printable area
    """
    try:
        win32print = _get_win32print()
        win32ui = _get_win32ui()
        Image, ImageOps, ImageWin = _get_pillow_modules()
    except ImportError as e:
        return {
            "ok": False,
            "error": "windows_print_dependencies_missing",
            "message": str(e),
            "hint": "Install pywin32 and Pillow",
            "os": "windows",
        }
    except Exception as e:
        return {"ok": False, "error": "windows_print_init_failed", "message": str(e), "os": "windows"}

    try:
        target_printer = (printer_name or "").strip() or str(win32print.GetDefaultPrinter() or "").strip()
    except Exception as e:
        return {"ok": False, "error": "get_default_failed", "message": str(e), "os": "windows"}

    if not target_printer:
        return {"ok": False, "error": "no_default_printer", "os": "windows"}

    DOC_NAME = os.path.basename(image_path) or "Photo Print"
    last_metrics: Dict[str, Any] = {}

    for _ in range(copies):
        hdc = None
        try:
            hdc = win32ui.CreateDC()
            hdc.CreatePrinterDC(target_printer)

            # Win32 device caps
            HORZRES = 8
            VERTRES = 10
            PHYSICALOFFSETX = 112
            PHYSICALOFFSETY = 113

            printable_w = int(hdc.GetDeviceCaps(HORZRES))
            printable_h = int(hdc.GetDeviceCaps(VERTRES))
            offset_x = int(hdc.GetDeviceCaps(PHYSICALOFFSETX))
            offset_y = int(hdc.GetDeviceCaps(PHYSICALOFFSETY))

            if printable_w <= 0 or printable_h <= 0:
                return {
                    "ok": False,
                    "error": "invalid_printable_area",
                    "printer": target_printer,
                    "os": "windows",
                }

            with Image.open(image_path) as src:
                prepared = ImageOps.exif_transpose(src).convert("RGB")
                src_w, src_h = prepared.size
                draw_w, draw_h = _fit_rect(src_w, src_h, printable_w, printable_h)
                rendered = prepared.resize((draw_w, draw_h), resample=Image.Resampling.LANCZOS)

            left = offset_x + max(0, (printable_w - draw_w) // 2)
            top = offset_y + max(0, (printable_h - draw_h) // 2)
            right = left + draw_w
            bottom = top + draw_h

            last_metrics = {
                "imageWidth": src_w,
                "imageHeight": src_h,
                "printableWidth": printable_w,
                "printableHeight": printable_h,
                "drawWidth": draw_w,
                "drawHeight": draw_h,
                "drawLeft": left,
                "drawTop": top,
            }

            dib = ImageWin.Dib(rendered)
            hdc.StartDoc(DOC_NAME)
            hdc.StartPage()
            dib.draw(
                hdc.GetHandleOutput(),
                (left, top, right, bottom),
            )
            hdc.EndPage()
            hdc.EndDoc()
        except Exception as e:
            try:
                if hdc is not None:
                    hdc.AbortDoc()
            except Exception:
                pass
            return {
                "ok": False,
                "error": "print_failed",
                "method": "win32_gdi_fit",
                "printer": target_printer,
                "message": str(e),
                "os": "windows",
            }
        finally:
            try:
                if hdc is not None:
                    hdc.DeleteDC()
            except Exception:
                pass

    return {
        "ok": True,
        "method": "win32_gdi_fit",
        "queued": True,
        "copies": copies,
        "printer": target_printer,
        "scaling": "fit",
        "note": "full_image_no_recrop",
        "os": "windows",
        **last_metrics,
    }


def print_image(image_path: str, copies: int = 1, printer_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Print an image.
      - Linux: lp [-d printer] -n copies file
      - Windows: direct GDI printing to the current default printer (or an explicitly supplied printer)
        without a dialog and with proportional *fit* scaling (no extra crop).
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

    # optional: validate printer exists for clearer errors
    if printer_name:
        rr = resolve_printer_name(printer_name)
        if not rr.get("ok"):
            return {"ok": False, **rr}
        printer_name = rr.get("printer")

    if is_windows():
        return _print_windows_gdi_fit(image_path, copies, printer_name=printer_name)

    # Linux / CUPS
    if which("lp") is None:
        return {"ok": False, "error": "lp_not_found", "hint": "Install CUPS client tools (lp)"}

    cmd = ["lp"]
    if printer_name:
        cmd += ["-d", printer_name]
    cmd += ["-n", str(copies), image_path]

    r = run_cmd(cmd, timeout=15)
    if not r.get("ok"):
        return {
            "ok": False,
            "error": "print_failed",
            "method": "lp",
            "printer": printer_name,
            "detail": r,
            "os": "linux",
        }

    return {
        "ok": True,
        "method": "lp",
        "queued": True,
        "copies": copies,
        "printer": printer_name,
        "detail": r,
        "os": "linux",
    }



def _parse_event_file_lenient(text: str) -> Dict[str, Any]:
    """
    Best-effort JSON parser:
    - first try json.loads(text)
    - then try to extract first {...} block and parse that
    """
    text = text or ""

    try:
        obj = json.loads(text)
        if isinstance(obj, dict):
            return obj
    except Exception:
        pass

    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        snippet = text[start : end + 1]
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

    try:
        with open(event_path, "r", encoding="utf-8", errors="replace") as f:
            raw = f.read()
    except Exception as e:
        return {"ok": False, "error": "event_read_failed", "message": str(e)}

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
        return {
            "ok": False,
            "error": "max_prints_reached",
            "max_prints": max_prints,
            "counter": before,
        }

    ae["print_counter"] = before + inc
    _atomic_write_json(event_path, data)

    return {
        "ok": True,
        "counter_before": before,
        "counter_after": before + inc,
        "max_prints": max_prints,
    }


# Backward compatible alias (prints to default)
def print_image_default(image_path: str, copies: int = 1) -> Dict[str, Any]:
    return print_image(image_path=image_path, copies=copies, printer_name=None)
