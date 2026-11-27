# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Andreas Rottmann
"""
Portierung von booth/api/r_w_config.php nach Python.

GET  -> read JSON file unter booth/config/<rel>
POST -> write (deep-merge patch) JSON file unter booth/config/<rel>

Verhalten bewusst 1:1 wie das alte PHP:
- nur .json Dateien
- Pfad-Sandboxing relativ zu booth/config (mit Sonderfall "../" erlaubt bis Projekt-Root)
- Backup-Rotation (.bak, .bak.1 .. .bak.N)
- atomarer Write via temp-file + rename
"""

import json
import os
import re
import tempfile
from pathlib import Path
from typing import Any, Dict, Tuple

_SUBDIR_SEGMENT_RE = re.compile(r"^[a-zA-Z0-9._-]+$")


def _is_assoc(d: Any) -> bool:
    return isinstance(d, dict)


def deep_merge_patch(base: Dict[str, Any], patch: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base)
    for k, v in (patch or {}).items():
        if _is_assoc(v) and _is_assoc(out.get(k)):
            out[k] = deep_merge_patch(out[k], v)
        else:
            out[k] = v
    return out


def config_dir(booth_root: Path) -> Path:
    d = booth_root / "config"
    d.mkdir(parents=True, exist_ok=True)
    return d


def _normalize_relpath(rel: str, allow_parent: bool) -> Tuple[bool, str, str]:
    rel = rel.strip().replace("\\", "/")
    if rel == "" or rel.startswith("/") or re.match(r"^[a-zA-Z]:/", rel):
        return False, "", "invalid_file_path"

    parts = [p for p in rel.split("/") if p != ""]
    safe = []
    for p in parts:
        if p == ".":
            continue
        if p == "..":
            if not allow_parent:
                if safe:
                    safe.pop()
                continue
            if safe and safe[-1] != "..":
                safe.pop()
            else:
                safe.append("..")
            continue
        if not _SUBDIR_SEGMENT_RE.match(p):
            return False, "", "invalid_path_segment"
        safe.append(p)

    norm = "/".join(safe)
    if not norm.lower().endswith(".json"):
        return False, "", "only_json_files_allowed"
    return True, norm, ""


def resolve_config_path(booth_root: Path, rel: str) -> Tuple[bool, str, str]:
    """Returns (ok, abs_path_or_empty, error_code)."""
    base = config_dir(booth_root).resolve()

    allow_outside = ("../" in rel) or ("..\\" in rel)
    rel = rel.replace("\\", "/")
    ok, rel_norm, err = _normalize_relpath(rel, allow_outside)
    if not ok:
        return False, "", err

    abs_a = (base / rel_norm).resolve() if not rel_norm.startswith("..") else (base / rel_norm)
    abs_a = Path(os.path.normpath(str(base / rel_norm)))

    abs_path = abs_a
    if rel_norm.startswith("config/"):
        rel_stripped = rel_norm[len("config/"):]
        abs_b = Path(os.path.normpath(str(base / rel_stripped)))
        if abs_a.is_file() or abs_a.parent.is_dir():
            abs_path = abs_a
        elif abs_b.is_file() or abs_b.parent.is_dir():
            abs_path = abs_b

    target_dir = abs_path.parent
    target_dir.mkdir(parents=True, exist_ok=True)
    abs_dir = target_dir.resolve()

    if not allow_outside:
        try:
            abs_dir.relative_to(base)
        except ValueError:
            return False, "", "invalid_target_directory"
    else:
        booth_dir = base.parent
        project_root = booth_dir.parent
        try:
            abs_dir.relative_to(project_root)
        except ValueError:
            return False, "", "invalid_target_directory_outside_project_root"

    return True, str(abs_path), ""


def load_json_file(abs_path: str) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    meta: Dict[str, Any] = {}
    p = Path(abs_path)
    if not p.is_file():
        return {}, meta

    try:
        raw = p.read_text(encoding="utf-8-sig")
    except Exception:
        meta["read_error"] = "file read failed"
        return {}, meta

    if raw.strip() == "":
        return {}, meta

    try:
        data = json.loads(raw)
        return (data if isinstance(data, dict) else {}), meta
    except Exception as e:
        meta["invalid_json"] = f"Invalid JSON: {e}"
        return {}, meta


def _rotate_backups(abs_path: str, keep: int = 4) -> None:
    bak = abs_path + ".bak"
    for i in range(keep - 1, 0, -1):
        src = f"{bak}.{i}"
        dst = f"{bak}.{i + 1}"
        if os.path.isfile(src):
            try:
                os.replace(src, dst)
            except Exception:
                pass
    if os.path.isfile(bak):
        try:
            os.replace(bak, f"{bak}.1")
        except Exception:
            pass


def save_json_file(abs_path: str, data: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
    meta: Dict[str, Any] = {}
    directory = os.path.dirname(abs_path) or "."
    os.makedirs(directory, exist_ok=True)

    try:
        payload = json.dumps(data, ensure_ascii=False, indent=2) + "\n"
    except Exception as e:
        meta["encode_error"] = str(e)
        return False, meta

    fd, tmp = tempfile.mkstemp(prefix="cfg_", dir=directory)
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as f:
            f.write(payload)
            f.flush()
            os.fsync(f.fileno())
    except Exception as e:
        meta["write_error"] = str(e)
        try:
            os.remove(tmp)
        except Exception:
            pass
        return False, meta

    _rotate_backups(abs_path, 4)
    bak = abs_path + ".bak"
    old = abs_path + ".old"

    if os.path.isfile(old):
        try:
            os.remove(old)
        except Exception:
            pass

    if os.path.isfile(abs_path):
        try:
            os.replace(abs_path, old)
        except Exception as e:
            meta["swap_error"] = f"Failed to rename current file to .old: {e}"
            try:
                os.remove(tmp)
            except Exception:
                pass
            return False, meta

    try:
        os.replace(tmp, abs_path)
    except Exception as e:
        if os.path.isfile(old) and not os.path.isfile(abs_path):
            try:
                os.replace(old, abs_path)
            except Exception:
                pass
        meta["swap_error"] = f"Failed to rename temp file to target: {e}"
        try:
            os.remove(tmp)
        except Exception:
            pass
        return False, meta

    if os.path.isfile(old):
        try:
            os.replace(old, bak)
        except Exception:
            pass

    meta["backup"] = bak
    return True, meta
