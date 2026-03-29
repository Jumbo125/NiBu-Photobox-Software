# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
import argparse
import platform
import subprocess
import ctypes
from ctypes import wintypes
import os
from pathlib import Path

# ============================================================
# Helper: Standard-Startverzeichnisse & Pfadprüfung
# ============================================================

def get_default_start_dir() -> str:
    """Gibt einen systemabhängigen, existierenden Standard-Ordner zurück."""
    home = Path.home()
    sys = platform.system()
    if sys == "Windows":
        pics = home / "Pictures"
        if pics.exists():
            return str(pics)
        return "C:\\"
    else:
        pics = home / "Pictures"
        if pics.exists():
            return str(pics)
        return str(home)


def sanitize_initial_path(initial: str | None) -> str:
    """
    Prüft und korrigiert den initialen Pfad.
    - Leere oder ungültige Pfade werden auf Default gesetzt.
    - Relative Pfade werden relativ zum Skriptverzeichnis aufgelöst.
    """
    try:
        if not initial:
            return get_default_start_dir()

        p = Path(str(initial).strip().strip('"').strip("'"))

        # Relativpfade: relativ zum Speicherort dieses Skripts
        if not p.is_absolute():
            p = (Path(__file__).resolve().parent / p).resolve()

        # Wenn Ziel nicht existiert -> Default
        if not p.exists():
            return get_default_start_dir()

        return str(p)
    except Exception:
        # Fallback bei Fehler
        return get_default_start_dir()


# ============================================================
# GUID helper (portable)
# ============================================================
class GUID(ctypes.Structure):
    _fields_ = [
        ("Data1", wintypes.DWORD),
        ("Data2", wintypes.WORD),
        ("Data3", wintypes.WORD),
        ("Data4", wintypes.BYTE * 8),
    ]

    def __init__(self, s: str):
        import re
        m = re.match(r"^\{?([0-9A-Fa-f]{8})-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{4})-([0-9A-Fa-f]{12})\}?$", s)
        d4 = bytes.fromhex(m.group(4) + m.group(5))
        super().__init__(int(m[1], 16), int(m[2], 16), int(m[3], 16), (wintypes.BYTE * 8)(*d4))


# ============================================================
# Windows: IFileDialog via COM
# ============================================================
def _win_pick_path(title="Select", pick_folders=False, initial="", filter="All files (*.*)|*.*") -> str | None:
    initial = sanitize_initial_path(initial)  # ✅ sicherstellen, dass Pfad gültig ist

    ole32 = ctypes.OleDLL("ole32")
    ctypes.WinDLL("user32", use_last_error=True)
    CLSID_FileOpenDialog = GUID("{DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7}")
    IID_IFileOpenDialog = GUID("{D57C7288-D4AD-4768-BE02-9D969532D960}")
    CLSCTX_INPROC_SERVER = 1
    SIGDN_FILESYSPATH = 0x80058000
    FOS_PICKFOLDERS = 0x00000020
    FOS_FORCEFILESYSTEM = 0x00000040
    FOS_FILEMUSTEXIST = 0x00001000

    ole32.CoInitializeEx(None, 2)
    dlg = ctypes.c_void_p()
    if ole32.CoCreateInstance(
        ctypes.byref(CLSID_FileOpenDialog),
        None,
        CLSCTX_INPROC_SERVER,
        ctypes.byref(IID_IFileOpenDialog),
        ctypes.byref(dlg),
    ) != 0:
        return None

    vtbl = ctypes.cast(dlg, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
    Show = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, wintypes.HWND)(vtbl[3])
    SetOptions = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, wintypes.DWORD)(vtbl[9])
    SetTitle = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, wintypes.LPCWSTR)(vtbl[17])
    GetResult = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.POINTER(ctypes.c_void_p))(vtbl[20])

    SetTitle(dlg, title)
    opts = FOS_FORCEFILESYSTEM | (FOS_PICKFOLDERS if pick_folders else FOS_FILEMUSTEXIST)
    SetOptions(dlg, opts)

    # Filter
    if not pick_folders and filter:
        tokens = [t.strip() for t in filter.split('|') if t.strip()]
        pairs = [(tokens[i], tokens[i + 1]) for i in range(0, len(tokens) - 1, 2)]
        if not pairs:
            pairs = [("All files", "*.*")]
        class COMDLG_FILTERSPEC(ctypes.Structure):
            _fields_ = [("pszName", wintypes.LPCWSTR), ("pszSpec", wintypes.LPCWSTR)]
        arr = (COMDLG_FILTERSPEC * len(pairs))(*pairs)
        SetFileTypes = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_uint)(vtbl[10])
        SetFileTypes(dlg, arr, len(pairs))
        try:
            SetFileTypeIndex = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.c_uint)(vtbl[11])
            SetFileTypeIndex(dlg, 1)
        except Exception:
            pass

    # Set initial folder
    if initial and os.path.isdir(initial):
        try:
            SHCreateItemFromParsingName = ctypes.OleDLL("shell32").SHCreateItemFromParsingName
            SHCreateItemFromParsingName.argtypes = [
                wintypes.LPCWSTR, wintypes.LPVOID, ctypes.POINTER(GUID), ctypes.POINTER(ctypes.c_void_p)
            ]
            IID_IShellItem = GUID("{43826D1E-E718-42EE-BC55-A1E261C37BFE}")
            pItem = ctypes.c_void_p()
            if SHCreateItemFromParsingName(initial, None, ctypes.byref(IID_IShellItem), ctypes.byref(pItem)) == 0:
                SetFolder = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, ctypes.c_void_p)(vtbl[11])
                SetFolder(dlg, pItem)
        except Exception:
            pass  # falls initial ungültig – kein Fehler mehr!

    user32 = ctypes.WinDLL("user32", use_last_error=True)
    GetForegroundWindow = user32.GetForegroundWindow
    GetForegroundWindow.restype = wintypes.HWND

    hwnd = GetForegroundWindow()
    hr = Show(dlg, hwnd)
    if hr != 0:
        return None

    si = ctypes.c_void_p()
    GetResult(dlg, ctypes.byref(si))
    si_vtbl = ctypes.cast(si, ctypes.POINTER(ctypes.POINTER(ctypes.c_void_p))).contents
    GetDisplayName = ctypes.WINFUNCTYPE(ctypes.c_long, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.LPWSTR))(si_vtbl[5])
    psz = wintypes.LPWSTR()
    GetDisplayName(si, SIGDN_FILESYSPATH, ctypes.byref(psz))
    path = psz.value
    ole32.CoTaskMemFree(psz)
    return path


# ============================================================
# Linux: zenity (GUI)
# ============================================================
def _linux_pick(title="Select", folder=False, initial="", filter=""):
    initial = sanitize_initial_path(initial)
    args = ["zenity", "--file-selection", "--title", title]
    if folder:
        args.append("--directory")
    if initial:
        args += ["--filename", initial + "/"]
    if filter and not folder:
        args += ["--file-filter", filter]
    try:
        return subprocess.check_output(args, text=True).strip() or None
    except Exception:
        return None


# ============================================================
# Cross-platform wrapper
# ============================================================
def pick(title="Select", folder=False, initial="", filter=""):
    sys = platform.system()
    if sys == "Windows":
        return _win_pick_path(title, pick_folders=folder, initial=initial, filter=filter)
    if sys == "Linux":
        return _linux_pick(title, folder=folder, initial=initial, filter=filter)
    return None


# ============================================================
# CLI
# ============================================================
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["file", "folder"], default="file")
    parser.add_argument("--title", default="Select")
    parser.add_argument("--path", default="")
    parser.add_argument("--filter", default="All files (*.*)|*.*")
    args = parser.parse_args()

    folder = args.mode == "folder"
    result = pick(args.title, folder, args.path, args.filter)
    if result:
        print(result)
    else:
        print("")  # leere Ausgabe statt Crash
