# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
# open_folder.py
from __future__ import annotations

import os
import platform
import subprocess
import threading
import time
import shutil
from pathlib import Path
from typing import Any, Dict, Optional

DEFAULT_COOLDOWN_SEC = 2.0

_OPEN_LOCK = threading.Lock()
_LAST_OPEN = {"path": "", "ts": 0.0}


def normalize_dir_for_open(raw_path: str, base_dir: Path) -> Path:
    """
    - leer -> Default (Pictures/Home)
    - relative Pfade -> relativ zu base_dir
    - wenn Datei übergeben wird -> parent Ordner
    """
    raw_path = (raw_path or "").strip().strip('"').strip("'")

    if not raw_path:
        home = Path.home()
        pics = home / "Pictures"
        p = pics if pics.exists() else home
        return p.resolve()

    p = Path(raw_path)

    if not p.is_absolute():
        p = (base_dir / p).resolve()

    if p.exists() and p.is_file():
        p = p.parent

    return p


# -----------------------------
# Foreground helpers
# -----------------------------
def _win_try_focus_explorer(folder: Path, timeout_sec: float = 1.6) -> bool:
    """
    Versucht ein Explorer-Fenster (CabinetWClass/ExploreWClass) zu aktivieren.
    Heuristik: Fenster-Titel enthält Ordnernamen.
    Keine Garantie (Windows focus lock).
    """
    try:
        import ctypes
        from ctypes import wintypes

        user32 = ctypes.WinDLL("user32", use_last_error=True)

        EnumWindows = user32.EnumWindows
        EnumWindows.argtypes = [wintypes.WNDENUMPROC, wintypes.LPARAM]
        EnumWindows.restype = wintypes.BOOL

        GetClassNameW = user32.GetClassNameW
        GetClassNameW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        GetClassNameW.restype = ctypes.c_int

        GetWindowTextW = user32.GetWindowTextW
        GetWindowTextW.argtypes = [wintypes.HWND, wintypes.LPWSTR, ctypes.c_int]
        GetWindowTextW.restype = ctypes.c_int

        IsWindowVisible = user32.IsWindowVisible
        IsWindowVisible.argtypes = [wintypes.HWND]
        IsWindowVisible.restype = wintypes.BOOL

        GetForegroundWindow = user32.GetForegroundWindow
        GetForegroundWindow.argtypes = []
        GetForegroundWindow.restype = wintypes.HWND

        GetWindowThreadProcessId = user32.GetWindowThreadProcessId
        GetWindowThreadProcessId.argtypes = [wintypes.HWND, ctypes.POINTER(wintypes.DWORD)]
        GetWindowThreadProcessId.restype = wintypes.DWORD

        AttachThreadInput = user32.AttachThreadInput
        AttachThreadInput.argtypes = [wintypes.DWORD, wintypes.DWORD, wintypes.BOOL]
        AttachThreadInput.restype = wintypes.BOOL

        BringWindowToTop = user32.BringWindowToTop
        BringWindowToTop.argtypes = [wintypes.HWND]
        BringWindowToTop.restype = wintypes.BOOL

        SetForegroundWindow = user32.SetForegroundWindow
        SetForegroundWindow.argtypes = [wintypes.HWND]
        SetForegroundWindow.restype = wintypes.BOOL

        ShowWindow = user32.ShowWindow
        ShowWindow.argtypes = [wintypes.HWND, ctypes.c_int]
        ShowWindow.restype = wintypes.BOOL

        SW_RESTORE = 9

        # Ziel-Titel-Token
        token = folder.name.lower().strip()
        if not token:
            token = str(folder).lower()

        best_hwnd: Optional[int] = None

        def find_candidate() -> Optional[int]:
            hwnds = []

            @wintypes.WNDENUMPROC
            def cb(hwnd, lparam):
                try:
                    if not IsWindowVisible(hwnd):
                        return True

                    cls_buf = ctypes.create_unicode_buffer(256)
                    GetClassNameW(hwnd, cls_buf, 256)
                    cls = (cls_buf.value or "").strip()

                    if cls not in ("CabinetWClass", "ExploreWClass"):
                        return True

                    txt_buf = ctypes.create_unicode_buffer(512)
                    GetWindowTextW(hwnd, txt_buf, 512)
                    title = (txt_buf.value or "").strip().lower()

                    # Explorer-Titel enthält oft den Ordnernamen (nicht immer)
                    score = 0
                    if token and token in title:
                        score = 10
                    elif folder.drive and folder.drive.lower() in title:
                        score = 3
                    else:
                        score = 1

                    hwnds.append((score, int(hwnd)))
                    return True
                except Exception:
                    return True

            EnumWindows(cb, 0)

            if not hwnds:
                return None
            hwnds.sort(reverse=True)
            return hwnds[0][1]

        t0 = time.time()
        while time.time() - t0 < timeout_sec:
            cand = find_candidate()
            if cand:
                best_hwnd = cand
                break
            time.sleep(0.08)

        if not best_hwnd:
            return False

        # Fokus versuchen (mit AttachThreadInput-Trick)
        fg = GetForegroundWindow()
        fg_tid = GetWindowThreadProcessId(fg, ctypes.byref(wintypes.DWORD(0))) if fg else 0
        me_tid = GetWindowThreadProcessId(best_hwnd, ctypes.byref(wintypes.DWORD(0)))

        try:
            if fg_tid and me_tid and fg_tid != me_tid:
                AttachThreadInput(fg_tid, me_tid, True)
        except Exception:
            pass

        try:
            ShowWindow(best_hwnd, SW_RESTORE)
            BringWindowToTop(best_hwnd)
            ok = bool(SetForegroundWindow(best_hwnd))
        finally:
            try:
                if fg_tid and me_tid and fg_tid != me_tid:
                    AttachThreadInput(fg_tid, me_tid, False)
            except Exception:
                pass

        return ok

    except Exception:
        return False


def _linux_try_focus(folder: Path) -> bool:
    """
    Versucht Fokus über wmctrl/xdotool (wenn installiert).
    Keine Garantie, hängt vom Desktop/WM ab.
    """
    token = folder.name.strip()
    if not token:
        return False

    try:
        if shutil.which("wmctrl"):
            r = subprocess.run(["wmctrl", "-a", token], capture_output=True, text=True, timeout=2)
            return r.returncode == 0

        if shutil.which("xdotool"):
            # sucht ein Fenster mit Namen token und aktiviert es
            r = subprocess.run(
                ["xdotool", "search", "--name", token, "windowactivate", "--sync"],
                capture_output=True,
                text=True,
                timeout=2,
            )
            return r.returncode == 0

    except Exception:
        return False

    return False


def _mac_try_focus_finder() -> bool:
    """
    Finder aktivieren via AppleScript.
    """
    try:
        r = subprocess.run(
            ["osascript", "-e", 'tell application "Finder" to activate'],
            capture_output=True,
            text=True,
            timeout=2,
        )
        return r.returncode == 0
    except Exception:
        return False


# -----------------------------
# Open folder (native + foreground attempt)
# -----------------------------
def open_folder_native(folder: Path, foreground: bool = False) -> Dict[str, Any]:
    """Öffnet folder im nativen Dateimanager. 'foreground' versucht Fokus zu holen."""
    sysname = platform.system()
    try:
        fg_ok = None

        if sysname == "Windows":
            # explorer direkt starten (verlässlicher als nur startfile für "Focus"-Versuch)
            subprocess.Popen(["explorer", str(folder)], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            if foreground:
                fg_ok = _win_try_focus_explorer(folder)
            return {"ok": True, "platform": "Windows", "foreground_ok": fg_ok}

        if sysname == "Linux":
            subprocess.Popen(
                ["xdg-open", str(folder)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if foreground:
                fg_ok = _linux_try_focus(folder)
            return {"ok": True, "platform": "Linux", "foreground_ok": fg_ok}

        if sysname == "Darwin":
            subprocess.Popen(
                ["open", str(folder)],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            if foreground:
                fg_ok = _mac_try_focus_finder()
            return {"ok": True, "platform": "Darwin", "foreground_ok": fg_ok}

        return {"ok": False, "error": "unsupported_platform", "platform": sysname}

    except Exception as e:
        return {"ok": False, "error": "open_failed", "detail": str(e), "platform": sysname}


def openfolder_endpoint(
    raw_path: str,
    *,
    create: bool = True,
    cooldown_sec: float = DEFAULT_COOLDOWN_SEC,
    base_dir: Path,
    foreground: bool = False,
) -> Dict[str, Any]:
    """
    Komplettlogik:
    - normalize
    - mkdir optional
    - cooldown anti-spam
    - open native (+ optional foreground attempt)
    """
    folder = normalize_dir_for_open(raw_path, base_dir=base_dir)
    created = False

    try:
        if not folder.exists():
            if not create:
                return {
                    "ok": False,
                    "error": "folder_not_found",
                    "path": str(folder),
                    "created": False,
                    "opened": False,
                }
            folder.mkdir(parents=True, exist_ok=True)
            created = True

        if not folder.is_dir():
            return {
                "ok": False,
                "error": "not_a_directory",
                "path": str(folder),
                "created": created,
                "opened": False,
            }

    except Exception as e:
        return {
            "ok": False,
            "error": "mkdir_failed",
            "path": str(folder),
            "created": False,
            "opened": False,
            "detail": str(e),
        }

    now = time.time()
    with _OPEN_LOCK:
        if cooldown_sec and (now - _LAST_OPEN["ts"]) < cooldown_sec:
            return {
                "ok": True,
                "path": str(folder),
                "created": created,
                "opened": False,
                "skipped": True,
                "reason": "cooldown",
                "cooldown_sec": float(cooldown_sec),
                "last_opened_path": _LAST_OPEN["path"],
                "last_opened_ago_sec": round(now - _LAST_OPEN["ts"], 3),
                "foreground_requested": bool(foreground),
            }

        r = open_folder_native(folder, foreground=foreground)
        if r.get("ok"):
            _LAST_OPEN["path"] = str(folder)
            _LAST_OPEN["ts"] = now

        return {
            "ok": bool(r.get("ok")),
            "path": str(folder),
            "created": created,
            "opened": bool(r.get("ok")),
            "skipped": False,
            "platform": r.get("platform"),
            "error": r.get("error"),
            "detail": r.get("detail"),
            "foreground_requested": bool(foreground),
            "foreground_ok": r.get("foreground_ok"),
        }
