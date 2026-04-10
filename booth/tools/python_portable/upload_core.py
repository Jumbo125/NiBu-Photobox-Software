# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
upload_core.py — Hilfsfunktionen für /pickUpload

Ziele:
- Webroot aus server_config.json (caddyWebroot) lesen
- subdir sanitizen (kein Traversal)
- Filepicker starten (Windows + Linux)
- Dateiname bauen: prefix + "_" + original (oder original bei prefix leer)
- overwrite:
    - False (Default): wenn existiert -> _1, _2, ...
    - True: überschreibt vorhandene Datei
- Copy nach <webroot>/uploads(/subdir) + JSON-Metadaten
"""

from __future__ import annotations

import json
import mimetypes
import os
import platform
import re
import shutil
import subprocess
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional


# -----------------------------
# Generic helpers
# -----------------------------
def deep_get(d: Any, path: str, default=None):
    try:
        cur = d
        for k in str(path).split("."):
            if not isinstance(cur, dict) or k not in cur:
                return default
            cur = cur[k]
        return cur
    except Exception:
        return default


def load_json(path: str) -> Dict[str, Any]:
    try:
        if not path or not os.path.isfile(path):
            return {}
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def parse_bool(v: Any, default: bool = False) -> bool:
    if v is None:
        return default
    s = str(v).strip().lower()
    if s in ("1", "true", "yes", "y", "on"):
        return True
    if s in ("0", "false", "no", "n", "off", ""):
        return False
    return default


def get_caddy_webroot(cfg: Optional[Dict[str, Any]], cfg_path: str, here: Path) -> Optional[Path]:
    """Liest caddyWebroot aus dict (wenn vorhanden) oder aus cfg_path."""
    data = cfg if isinstance(cfg, dict) else load_json(cfg_path)

    val = (
        data.get("caddyWebroot")
        or deep_get(data, "caddyWebroot")
        or deep_get(data, "paths.caddyWebroot")
        or deep_get(data, "caddy.webroot")
        or deep_get(data, "webroot")
    )
    if not val:
        return None

    p = Path(str(val)).expanduser()
    if not p.is_absolute():
        p = (here / p).resolve()
    return p


# -----------------------------
# Sanitizers
# -----------------------------
_SUBDIR_RE = re.compile(r"^[A-Za-z0-9._\-/]+$")


def sanitize_subdir(subdir: Any) -> str:
    """Returns POSIX-like path without leading slash; strips traversal."""
    if not subdir:
        return ""
    s = str(subdir).strip().replace("\\", "/")
    if not s or s.startswith("/"):
        return ""
    if not _SUBDIR_RE.match(s):
        return ""
    parts = []
    for part in s.split("/"):
        part = part.strip()
        if not part or part in (".", ".."):
            continue
        if re.match(r"^[A-Za-z0-9._-]+$", part):
            parts.append(part)
    return "/".join(parts)


def safe_component(name: Any, max_len: int = 120) -> str:
    name = (str(name or "")).strip()
    if not name:
        return "file"
    name = os.path.basename(name)
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    name = name.strip("._-") or "file"
    return name[:max_len]


# -----------------------------
# File naming + copy
# -----------------------------
def build_dest_filename(source: Path, prefix: str = "") -> str:
    """prefix leer => Originalname; sonst prefix_original.ext"""
    src = Path(source)
    stem = safe_component(src.stem)
    ext = (src.suffix or "").lower()
    pre = safe_component(prefix) if str(prefix or "").strip() else ""
    if pre:
        stem = f"{pre}_{stem}"
    # Länge begrenzen (Ext behalten)
    max_total = 140
    if len(stem) + len(ext) > max_total:
        stem = stem[: max_total - len(ext)]
    return f"{stem}{ext}"


def resolve_dest_path(dest_dir: Path, filename: str, overwrite: bool) -> Path:
    """If overwrite=False and file exists, append counter _1, _2, ..."""
    dest_dir = Path(dest_dir)
    base = Path(filename)
    stem = base.stem
    ext = base.suffix
    dest = dest_dir / base.name

    if overwrite:
        return dest

    if not dest.exists():
        return dest

    for i in range(1, 10000):
        cand = dest_dir / f"{stem}_{i}{ext}"
        if not cand.exists():
            return cand

    return dest_dir / f"{stem}_{int(datetime.now().timestamp())}{ext}"


def file_dates(p: Path) -> Dict[str, Any]:
    try:
        st = Path(p).stat()
        mtime = datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds")
        ctime = datetime.fromtimestamp(st.st_ctime).isoformat(timespec="seconds")
        return {"modified_at": mtime, "created_at": ctime}
    except Exception:
        return {"modified_at": None, "created_at": None}


def copy_to_uploads(
    *,
    source: Path,
    webroot: Path,
    uploads_dir: Path,
    subdir: str = "",
    prefix: str = "",
    overwrite: bool = False,
) -> Dict[str, Any]:
    """Copies source into uploads_dir and returns JSON-like dict with metadata."""
    src = Path(source)
    if not src.is_file():
        return {"ok": False, "error": "source_not_a_file", "source_abs": str(src), "http_status": 400}

    try:
        uploads_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        return {
            "ok": False,
            "error": "uploads_dir_create_failed",
            "uploads_dir": str(uploads_dir),
            "detail": str(e),
            "http_status": 500,
        }

    filename = build_dest_filename(src, prefix=prefix)
    dest = resolve_dest_path(uploads_dir, filename, overwrite=overwrite)

    try:
        shutil.copy2(str(src), str(dest))
    except Exception as e:
        return {
            "ok": False,
            "error": "copy_failed",
            "source_abs": str(src),
            "dest_abs": str(dest),
            "detail": str(e),
            "http_status": 500,
        }

    # rel (zu webroot) + URL
    try:
        rel = os.path.relpath(str(dest), str(webroot))
    except Exception:
        rel = str(Path("uploads") / (subdir or "") / dest.name)

    rel_posix = rel.replace("\\", "/")
    if not rel_posix.startswith("uploads/") and rel_posix != "uploads":
        rel_posix = ("uploads/" + (subdir + "/" if subdir else "") + dest.name).replace("//", "/")

    mime = mimetypes.guess_type(str(dest))[0] or "application/octet-stream"
    try:
        size_bytes = int(dest.stat().st_size)
    except Exception:
        size_bytes = None

    dates = file_dates(dest)

    return {
        "ok": True,
        "webroot": str(webroot),
        "uploads_dir": str(uploads_dir),
        "subdir": subdir or "",
        "source_abs": str(src),
        "saved_abs": str(dest),
        "saved_rel": rel_posix,
        "saved_url": "/" + rel_posix.lstrip("/"),
        "file_name": dest.name,
        "size_bytes": size_bytes,
        "mime": mime,
        "overwrite": bool(overwrite),
        "prefix": str(prefix or ""),
        **dates,
        "http_status": 200,
    }


# -----------------------------
# OS-aware filter normalization (Windows vs Linux/Zenity)
# -----------------------------
def normalize_filter(filter_str: str) -> str:
    """
    Windows-Style:
      "Images|*.png;*.jpg;*.jpeg|All|*.*"

    Zenity (Linux) erwartet eher:
      "Images | *.png *.jpg *.jpeg"

    Da filepicker_core.py unter Linux nur EINEN --file-filter setzt,
    nehmen wir bei Windows-Style das erste Filter-Paar und wandeln ';' -> ' '.
    """
    s = (filter_str or "").strip()
    if not s:
        return s

    if platform.system() != "Linux":
        return s

    # already zenity style?
    if "|" not in s:
        return s

    tokens = [t.strip() for t in s.split("|") if t.strip()]
    if len(tokens) < 2:
        return s

    name = tokens[0]
    spec = tokens[1]  # first spec
    # spec might be "*.png;*.jpg;*.jpeg"
    spec = spec.replace(";", " ").replace(",", " ").strip()
    spec = re.sub(r"\s+", " ", spec)
    if not spec:
        spec = "*.*"

    return f"{name} | {spec}"


# -----------------------------
# Picker runner (Windows + Linux)
# -----------------------------
def run_picker(
    *,
    core_path: Path,
    python_executable: str,
    title: str,
    init_path: str,
    filter_str: str,
    timeout_sec: int = 180,
) -> Dict[str, Any]:
    if not core_path or not Path(core_path).is_file():
        return {"ok": False, "error": "filepicker_core_not_found", "core": str(core_path), "http_status": 500}

    # OS-aware filter
    flt = normalize_filter(filter_str)

    cmd = [
        python_executable,
        str(core_path),
        "--mode", "file",
        "--title", title or "Select",
        "--path", init_path or "",
        "--filter", flt or "All|*.*",
    ]

    try:
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_sec, shell=False)
        out = (p.stdout or "").strip()
        err = (p.stderr or "").strip()
        ok = (p.returncode == 0 and out != "")
        # Cancel => ok False but 200 (not an error)
        if not ok and out == "":
            return {"ok": False, "picked": "", "rc": p.returncode, "err": err, "http_status": 200}
        return {"ok": ok, "picked": out, "rc": p.returncode, "err": err, "http_status": 200 if ok else 200}
    except subprocess.TimeoutExpired:
        return {"ok": False, "error": "picker_timeout", "http_status": 500}
    except Exception as e:
        return {"ok": False, "error": "picker_failed", "detail": str(e), "http_status": 500}


# -----------------------------
# High-level: full /pickUpload in one call
# -----------------------------
def pick_upload(
    *,
    qs: Dict[str, Any],
    core_path: Path,
    python_executable: str,
    server_cfg: Optional[Dict[str, Any]],
    server_cfg_path: str,
    here: Path,
) -> Dict[str, Any]:
    """
    Führt den kompletten /pickUpload Flow aus:
    - webroot aus config lesen
    - uploads_dir anlegen
    - filepicker starten
    - copy + metadata zurückgeben

    Query-Parameter (wie bisher):
      title, path, filter, subdir, prefix, overwrite
    """
    # Parse query params (parse_qs style)
    def q(name: str, default: str = "") -> str:
        try:
            v = (qs.get(name, [default])[0] if isinstance(qs.get(name), list) else qs.get(name, default))
            return str(v if v is not None else default)
        except Exception:
            return default

    title = q("title", "Select")
    init_path = q("path", "")
    filter_str = q("filter", "Images|*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.gif|All|*.*")
    subdir_raw = q("subdir", "")
    prefix = q("prefix", "")
    overwrite = parse_bool(q("overwrite", "0"), default=False)

    webroot = get_caddy_webroot(server_cfg, server_cfg_path, here)
    if webroot is None or not webroot.is_dir():
        return {
            "ok": False,
            "error": "missing_or_invalid_caddyWebroot",
            "hint": "Setze server_config.json: { \"caddyWebroot\": \"C:/.../webroot\" }",
            "server_config": server_cfg_path,
            "caddyWebroot": str(webroot) if webroot else "",
            "http_status": 500,
        }

    safe_subdir = sanitize_subdir(subdir_raw)
    uploads_dir = (webroot / "uploads" / safe_subdir) if safe_subdir else (webroot / "uploads")
    try:
        uploads_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        return {
            "ok": False,
            "error": "uploads_dir_create_failed",
            "uploads_dir": str(uploads_dir),
            "detail": str(e),
            "http_status": 500,
        }

    pr = run_picker(
        core_path=core_path,
        python_executable=python_executable,
        title=title,
        init_path=init_path,
        filter_str=filter_str,
    )
    if not pr.get("ok"):
        # user cancel or picker error
        return {
            "ok": False,
            "picked": pr.get("picked", ""),
            "rc": pr.get("rc"),
            "err": pr.get("err", ""),
            "error": pr.get("error"),
            "detail": pr.get("detail"),
            "http_status": int(pr.get("http_status", 200)),
        }

    picked = str(pr.get("picked") or "").strip()
    src = Path(picked)
    if not src.is_file():
        return {"ok": False, "error": "picked_not_a_file", "source_abs": str(src), "http_status": 400}

    res = copy_to_uploads(
        source=src,
        webroot=webroot,
        uploads_dir=uploads_dir,
        subdir=safe_subdir,
        prefix=prefix,
        overwrite=overwrite,
    )

    # Add context
    res.update({
        "subdir": safe_subdir,
        "uploads_dir": str(uploads_dir),
        "webroot": str(webroot),
    })
    return res
