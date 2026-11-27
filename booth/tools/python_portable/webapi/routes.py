# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Andreas Rottmann
"""
Portierung der ehemaligen booth/api/*.php Endpunkte nach Python.

Jede Funktion hier bekommt (handler, qs, body) und ruft handler._send_json(...)
bzw. handler._send_file(...)/handler._send_bytes(...) auf. Die Registrierung
der Pfade passiert in python_server.py (do_GET / do_POST), dieses Modul
enthaelt nur die eigentliche Logik.

Alle Pfade sind bewusst 1:1 wie die alten PHP-Endpunkte benannt (siehe
booth/src/js/functions/*.js), damit das Frontend NICHT angepasst werden muss
-- nur die Caddy-Route vor dem jeweiligen /api/*.php Pfad aendert sich.
"""

import io
import json
import os
import re
import shutil
import tempfile
import zipfile
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
from xml.etree import ElementTree as ET
from xml.dom import minidom

from . import config_io

try:
    from render_core import get_booth_root
except Exception:
    def get_booth_root() -> Path:
        # webapi/ -> python_portable -> tools -> booth
        return Path(__file__).resolve().parents[2]


# -----------------------------------------------------------------
# Shared helpers
# -----------------------------------------------------------------

_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp", ".tiff", ".tif"}
_ASSET_EXTS = {"png", "jpg", "jpeg", "webp"}


def _sanitize_name(s: str) -> str:
    s = (s or "").strip().lower()
    s = re.sub(r"\s+", "_", s)
    s = re.sub(r"[^a-z0-9_-]", "", s)
    return s


def _resolve_template_paths(name: str, booth_root: Path) -> Tuple[Path, str]:
    if name == "activetemplate":
        return booth_root / "activeTemplate", "/activeTemplate"
    return booth_root / "templates" / name, "/templates/" + name


def _normalize_asset_src(src: str) -> str:
    src = (src or "").strip()
    if not src:
        return ""
    src = re.sub(r"^https?://[^/]+", "", src, flags=re.IGNORECASE)
    src = re.sub(r"^/templates/[^/]+/", "", src, flags=re.IGNORECASE)
    src = re.sub(r"^/activeTemplate/", "", src, flags=re.IGNORECASE)
    return src.lstrip("/")


def _norm_border_style(s: str) -> str:
    s = (s or "").strip().lower()
    return s if s in ("solid", "dashed", "dotted") else "solid"


def _rrmdir_contents(d: Path) -> None:
    if not d.is_dir():
        return
    for item in d.iterdir():
        if item.is_dir():
            shutil.rmtree(item, ignore_errors=True)
        else:
            try:
                item.unlink()
            except Exception:
                pass


def _rcopy(src: Path, dst: Path) -> None:
    dst.mkdir(parents=True, exist_ok=True)
    for item in src.iterdir():
        s = item
        d = dst / item.name
        if s.is_dir():
            _rcopy(s, d)
        else:
            shutil.copy2(s, d)


def _find_template_xml(d: Path) -> Optional[Path]:
    if not d.is_dir():
        return None
    for p in d.rglob("*"):
        if p.is_file() and p.name.lower() == "template.xml":
            return p
    return None


def _flatten_single_root_folder(target: Path) -> None:
    if not target.is_dir():
        return
    items = [p for p in target.iterdir()]
    if len(items) != 1 or not items[0].is_dir():
        return
    only = items[0]
    for child in only.iterdir():
        dest = target / child.name
        try:
            child.rename(dest)
        except Exception:
            pass
    shutil.rmtree(only, ignore_errors=True)


def _write_template_count(booth_root: Path, count: int) -> bool:
    cfg_path = booth_root / "config" / "config" / "active_event_config.json"
    data: Dict[str, Any] = {}
    if cfg_path.is_file():
        try:
            data = json.loads(cfg_path.read_text(encoding="utf-8-sig"))
            if not isinstance(data, dict):
                data = {}
        except Exception:
            data = {}

    data.setdefault("active_event", {})
    if not isinstance(data["active_event"], dict):
        data["active_event"] = {}
    data["active_event"]["templateCount"] = count

    try:
        tmp = str(cfg_path) + ".tmp"
        cfg_path.parent.mkdir(parents=True, exist_ok=True)
        Path(tmp).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(tmp, cfg_path)
        return True
    except Exception:
        return False


def _resolve_active_template_xml(booth_root: Path) -> Optional[Path]:
    """Mirrors template_info.php / read_count_of_photos.php resolution order."""
    base = booth_root / "activeTemplate"

    cfg_path = booth_root / "config" / "config" / "config.json"
    if cfg_path.is_file():
        try:
            cfg = json.loads(cfg_path.read_text(encoding="utf-8-sig"))
        except Exception:
            cfg = None
        configured = None
        if isinstance(cfg, dict):
            configured = (cfg.get("activeTemplate") or {}).get("path") if isinstance(cfg.get("activeTemplate"), dict) else None
        if isinstance(configured, str) and configured.strip():
            candidate = Path(configured.rstrip("\\/")) / "template.xml"
            if candidate.is_file():
                return candidate.resolve()

    slot_nums: List[int] = []
    if base.is_dir():
        for entry in base.iterdir():
            if entry.is_dir() and re.match(r"^[0-9]+$", entry.name):
                slot_nums.append(int(entry.name))
    for n in sorted(slot_nums):
        candidate = base / str(n) / "template.xml"
        if candidate.is_file():
            return candidate.resolve()

    flat = base / "template.xml"
    if flat.is_file():
        return flat.resolve()

    return None


# -----------------------------------------------------------------
# api/r_w_config.php -> /api/config
# -----------------------------------------------------------------

def rw_config_get(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    file_param = (qs.get("file", [""])[0] or "").strip()
    if not file_param:
        return handler._send_json(400, {"ok": False, "error_key": "api.rw_config.err.missing_file_parameter", "error": "Missing file parameter"})

    booth_root = get_booth_root()
    ok, abs_path, err = config_io.resolve_config_path(booth_root, file_param)
    if not ok:
        return handler._send_json(400 if err != "config_dir_not_available" else 500, {"ok": False, "error_key": f"api.rw_config.err.{err}", "error": err})

    data, _meta = config_io.load_json_file(abs_path)
    return handler._send_json(200, {
        "ok": True,
        "mode": "read",
        "requested": file_param,
        "resolved": abs_path,
        "exists": os.path.isfile(abs_path),
        "data": data,
    })


def rw_config_post(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    file_param = (qs.get("file", [""])[0] or body.get("file") or "").strip()
    if not file_param:
        return handler._send_json(400, {"ok": False, "error_key": "api.rw_config.err.missing_file_parameter", "error": "Missing file parameter"})

    booth_root = get_booth_root()
    ok, abs_path, err = config_io.resolve_config_path(booth_root, file_param)
    if not ok:
        return handler._send_json(400, {"ok": False, "error_key": f"api.rw_config.err.{err}", "error": err})

    if not isinstance(body, dict):
        return handler._send_json(400, {"ok": False, "error_key": "api.rw_config.err.invalid_json_body", "error": "Invalid JSON body"})

    patch = body.get("data") if isinstance(body.get("data"), dict) else body
    if not isinstance(patch, dict):
        return handler._send_json(400, {"ok": False, "error_key": "api.rw_config.err.invalid_data_payload", "error": "Invalid data payload"})

    existing, meta_load = config_io.load_json_file(abs_path)

    corrupt_backup = None
    if meta_load.get("invalid_json"):
        ts = datetime.now().strftime("%Y%m%d_%H%M%S")
        corrupt_backup = f"{abs_path}.corrupt_{ts}.json"
        try:
            shutil.copy2(abs_path, corrupt_backup)
        except Exception:
            pass
        existing = {}

    merged = config_io.deep_merge_patch(existing, patch)
    ok_save, meta_save = config_io.save_json_file(abs_path, merged)

    warnings = [w for w in [
        meta_load.get("recovered"),
        meta_load.get("invalid_json"),
        meta_save.get("encode_error"),
        meta_save.get("swap_error"),
        meta_save.get("write_error"),
    ] if w]

    return handler._send_json(200 if ok_save else 500, {
        "ok": ok_save,
        "mode": "write",
        "requested": file_param,
        "resolved": abs_path,
        "backup": meta_save.get("backup", abs_path + ".bak"),
        "corruptBackup": corrupt_backup,
        "warnings": warnings,
        "data": merged,
    })


# -----------------------------------------------------------------
# api/list_folders.php -> /api/list_folders
# -----------------------------------------------------------------

def list_folders(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    booth_root = get_booth_root()
    photos_root = (booth_root / "photos").resolve()

    requested = (qs.get("path", [""])[0] or "").strip()
    if not requested:
        requested_path = photos_root / "EVENTS"
    else:
        requested_path = Path(requested)

    try:
        if requested_path.exists():
            real = requested_path.resolve()
        else:
            parent = requested_path.parent.resolve()
            real = parent / requested_path.name
    except Exception:
        return handler._send_json(400, {"ok": False, "error": "invalid_path", "message": "Path is outside allowed directory or invalid."})

    real_norm = str(real).rstrip(os.sep)
    allowed_norm = str(photos_root).rstrip(os.sep)
    if not real_norm.lower().startswith(allowed_norm.lower()):
        return handler._send_json(400, {"ok": False, "error": "invalid_path", "message": "Path is outside allowed directory or invalid."})

    safe_path = Path(real_norm)
    if not safe_path.is_dir():
        return handler._send_json(200, {"ok": True, "path": str(safe_path), "folders": [], "files": []})

    folders = []
    files = []
    try:
        items = list(safe_path.iterdir())
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "scandir_failed"})

    for item in items:
        if item.is_dir():
            img_count = 0
            try:
                for sub in item.iterdir():
                    if sub.suffix.lower().lstrip(".") in {e.lstrip(".") for e in _IMAGE_EXTS} or sub.is_dir():
                        img_count += 1
            except Exception:
                pass
            folders.append({"name": item.name, "path": str(item), "children": img_count})
        else:
            if item.suffix.lower() in _IMAGE_EXTS:
                files.append({"name": item.name, "path": str(item)})

    folders.sort(key=lambda x: x["name"].lower())
    files.sort(key=lambda x: x["name"].lower())

    return handler._send_json(200, {"ok": True, "path": str(safe_path), "folders": folders, "files": files})


# -----------------------------------------------------------------
# api/list_active_templates.php -> /api/list_active_templates
# -----------------------------------------------------------------

def list_active_templates(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    booth_root = get_booth_root()
    base = booth_root / "activeTemplate"

    if not base.is_dir():
        return handler._send_json(200, {"ok": True, "multiSlot": False, "templates": []})

    slot_dirs: Dict[int, Path] = {}
    for entry in base.iterdir():
        if entry.is_dir() and re.match(r"^[0-9]+$", entry.name):
            slot_dirs[int(entry.name)] = entry

    templates = []
    if slot_dirs:
        for slot in sorted(slot_dirs):
            d = slot_dirs[slot]
            xml_path = d / "template.xml"
            if not xml_path.is_file():
                continue
            preview_path = d / "preview.jpg"
            has_preview = preview_path.is_file()
            templates.append({
                "slot": slot,
                "label": str(slot),
                "hasPreview": has_preview,
                "previewUrl": f"activeTemplate/{slot}/preview.jpg?_={int(preview_path.stat().st_mtime)}" if has_preview else None,
            })
        return handler._send_json(200, {"ok": True, "multiSlot": True, "templateCount": len(templates), "templates": templates})

    xml_path = base / "template.xml"
    if xml_path.is_file():
        preview_path = base / "preview.jpg"
        has_preview = preview_path.is_file()
        templates.append({
            "slot": 1,
            "label": "1",
            "hasPreview": has_preview,
            "previewUrl": f"activeTemplate/preview.jpg?_={int(preview_path.stat().st_mtime)}" if has_preview else None,
        })

    return handler._send_json(200, {"ok": True, "multiSlot": False, "templateCount": len(templates), "templates": templates})


# -----------------------------------------------------------------
# api/read_count_of_photos.php -> /api/read_count_of_photos
# -----------------------------------------------------------------

def read_count_of_photos(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    booth_root = get_booth_root()
    xml_path = _resolve_active_template_xml(booth_root)

    if xml_path is None:
        return handler._send_json(404, {"ok": False, "error": "template.xml nicht gefunden", "path": None})

    try:
        xml_str = xml_path.read_text(encoding="utf-8")
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "template.xml konnte nicht gelesen werden"})

    if not xml_str.strip():
        return handler._send_json(500, {"ok": False, "error": "template.xml konnte nicht gelesen werden"})

    try:
        root = ET.fromstring(xml_str)
    except Exception as e:
        return handler._send_json(400, {"ok": False, "error": "template.xml ist kein gültiges XML", "details": [str(e)]})

    for el in root.iter():
        tag = el.tag.split("}")[-1]
        if tag == "anzahl_an_foto" and (el.text or "").strip():
            try:
                count = int((el.text or "0").strip())
            except ValueError:
                count = 0
            if count > 0:
                return handler._send_json(200, {"ok": True, "count": count, "source": "element"})

    for el in root.iter():
        val = el.attrib.get("anzahl_an_foto")
        if val:
            try:
                count = int(val.strip())
            except ValueError:
                count = 0
            if count > 0:
                return handler._send_json(200, {"ok": True, "count": count, "source": "attribute"})

    return handler._send_json(422, {"ok": False, "error": "anzahl_an_foto nicht gefunden oder ungültig"})


# -----------------------------------------------------------------
# api/template_info.php -> /api/template_info
# -----------------------------------------------------------------

def template_info(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    booth_root = get_booth_root()
    xml_path = _resolve_active_template_xml(booth_root)

    if xml_path is None or not xml_path.is_file():
        return handler._send_json(200, {"ok": False, "code": "TEMPLATE_XML_MISSING", "photo_count": 0})

    try:
        tree = ET.parse(str(xml_path))
        root = tree.getroot()
    except Exception as e:
        return handler._send_json(200, {"ok": False, "code": "TEMPLATE_XML_INVALID", "photo_count": 0, "debug": {"xml_errors": [str(e)]}})

    photo_layers = [el for el in root.iter("layer") if el.attrib.get("type") == "photo"]
    count = len(photo_layers)

    if count <= 0:
        return handler._send_json(200, {"ok": False, "code": "TEMPLATE_NO_PHOTO_LAYERS", "photo_count": 0})

    def _int_attr(name: str) -> int:
        try:
            return int(root.attrib.get(name, "0"))
        except ValueError:
            return 0

    return handler._send_json(200, {
        "ok": True,
        "code": "OK",
        "photo_count": count,
        "template": {
            "width": _int_attr("width"),
            "height": _int_attr("height"),
            "greenwall": _int_attr("greenwall"),
        },
    })


# -----------------------------------------------------------------
# api/session_snapshot.php -> /api/session_snapshot
# -----------------------------------------------------------------

def session_snapshot(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    if not isinstance(body, dict) or "folder" not in body or "session" not in body:
        return handler._send_json(400, {"ok": False, "error": "invalid_payload", "need": ["folder", "session"]})

    folder = str(body["folder"]).rstrip("/\\")
    session = body["session"]

    if not folder:
        return handler._send_json(400, {"ok": False, "error": "folder_empty"})
    if not isinstance(session, dict):
        return handler._send_json(400, {"ok": False, "error": "invalid_payload", "need": ["folder", "session"]})

    folder_path = Path(folder)
    folder_path.mkdir(parents=True, exist_ok=True)

    file_path = folder_path / "session.json"
    tmp_path = str(file_path) + ".tmp"

    session["updatedAt"] = datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        Path(tmp_path).write_text(json.dumps(session, indent=2, ensure_ascii=False), encoding="utf-8")
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "write_tmp_failed"})

    try:
        if file_path.exists():
            file_path.unlink()
        os.rename(tmp_path, file_path)
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "rename_failed"})

    return handler._send_json(200, {"ok": True, "file": str(file_path)})


# -----------------------------------------------------------------
# api/set_Active_template.php -> /api/set_active_template (multipart ZIP upload)
# -----------------------------------------------------------------

def set_active_template(handler, qs: Dict[str, Any], uploads: List[Dict[str, Any]]) -> None:
    """uploads: list of {"name": str, "data": bytes} from the parsed multipart body (field 'zip')."""
    if not uploads:
        return handler._send_json(400, {"ok": False, "error_key": "api.upload.err.no_file_uploaded", "error": 'No file uploaded (field name must be "zip" or "zip[]")'})

    for idx, f in enumerate(uploads):
        if not re.search(r"\.zip$", f["name"], re.IGNORECASE):
            return handler._send_json(400, {"ok": False, "error_key": "api.upload.err.file_must_be_zip", "error": f"File must be a .zip ('{f['name']}')"})

    booth_root = get_booth_root()
    target = booth_root / "activeTemplate"
    target.mkdir(parents=True, exist_ok=True)

    zips = []
    xml_entries_by_slot: Dict[int, List[str]] = {}

    try:
        for idx, f in enumerate(uploads):
            try:
                zf = zipfile.ZipFile(io.BytesIO(f["data"]))
            except Exception:
                return handler._send_json(400, {"ok": False, "error_key": "api.upload.err.cannot_open_zip", "error": f"Cannot open ZIP ('{f['name']}')"})

            entries = [n for n in zf.namelist() if re.search(r"(^|/|\\)template\.xml$", n, re.IGNORECASE)]
            if not entries:
                return handler._send_json(400, {"ok": False, "error_key": "api.upload.err.template_xml_missing", "error": f"ZIP does not contain template.xml ('{f['name']}')"})

            zips.append(zf)
            xml_entries_by_slot[idx] = entries

        _rrmdir_contents(target)

        slots = []
        total_extracted = 0
        total_dirs = 0
        total_skipped = 0

        for idx, zf in enumerate(zips):
            slot_dir = target / str(idx + 1)
            slot_dir.mkdir(parents=True, exist_ok=True)

            extracted = 0
            skipped = 0
            for info in zf.infolist():
                name = info.filename.replace("\\", "/").lstrip("/")
                if not name or name == ".":
                    skipped += 1
                    continue
                parts = []
                bad = False
                for p in name.split("/"):
                    if p in ("", "."):
                        continue
                    if p == "..":
                        if parts:
                            parts.pop()
                        continue
                    if re.search(r"[\x00-\x1f\x7f]", p):
                        bad = True
                        break
                    parts.append(p)
                if bad or not parts:
                    skipped += 1
                    continue
                dest = slot_dir / Path(*parts)
                if info.is_dir():
                    dest.mkdir(parents=True, exist_ok=True)
                    continue
                dest.parent.mkdir(parents=True, exist_ok=True)
                with zf.open(info) as src, open(dest, "wb") as out:
                    shutil.copyfileobj(src, out)
                extracted += 1
            zf.close()

            _flatten_single_root_folder(slot_dir)

            template_xml_path = _find_template_xml(slot_dir)
            if template_xml_path is None:
                return handler._send_json(400, {"ok": False, "error_key": "api.upload.err.template_xml_not_found_after_extract", "error": f"template.xml not found after extraction (slot {idx + 1})"})

            slots.append({
                "slot": idx + 1,
                "name": uploads[idx]["name"],
                "target": str(slot_dir),
                "templateXmlPath": str(template_xml_path),
                "templateXmlEntries": xml_entries_by_slot[idx],
                "extractedFiles": extracted,
                "createdDirs": total_dirs,
                "skippedEntries": skipped,
            })
            total_extracted += extracted
            total_skipped += skipped
    finally:
        for zf in zips:
            try:
                zf.close()
            except Exception:
                pass

    template_count = len(slots)
    config_written = _write_template_count(booth_root, template_count)

    return handler._send_json(200, {
        "ok": True,
        "target": str(target),
        "templateCount": template_count,
        "multiSlot": True,
        "slots": slots,
        "configWritten": config_written,
        "templateXmlEntries": slots[0]["templateXmlEntries"] if slots else [],
        "templateXmlPath": slots[0]["templateXmlPath"] if slots else None,
        "extractedFiles": total_extracted,
        "createdDirs": total_dirs,
        "skippedEntries": total_skipped,
    })


# -----------------------------------------------------------------
# api/template_set_active.php -> /api/template_set_active
# -----------------------------------------------------------------

def template_set_active(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    if not isinstance(body, dict):
        return handler._send_json(400, {"ok": False, "error": "Invalid JSON"})

    name = _sanitize_name(str(body.get("templateName", "")))
    if not name:
        return handler._send_json(400, {"ok": False, "error": "templateName fehlt"})
    if name == "activetemplate":
        return handler._send_json(400, {"ok": False, "error": "Das aktive Template kann nicht sich selbst überschreiben"})

    booth_root = get_booth_root()
    src = booth_root / "templates" / name
    base = booth_root / "activeTemplate"
    dst = base / "1"

    if not src.is_dir():
        return handler._send_json(404, {"ok": False, "error": f"Template '{name}' nicht gefunden"})

    if not (src / "template.xml").is_file():
        return handler._send_json(400, {"ok": False, "error": f"template.xml fehlt in '{name}'"})

    _rrmdir_contents(base)
    _rcopy(src, dst)

    return handler._send_json(200, {"ok": True, "templateName": name, "target": str(dst)})


# -----------------------------------------------------------------
# api/template_editor_lade_config.php -> /api/template_editor_lade_config
# -----------------------------------------------------------------

def template_editor_lade_config(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    booth_root = get_booth_root()
    config_file = booth_root / "config" / "config.json"
    default = {"lang": "de"}

    if not config_file.is_file():
        return handler._send_json(200, {"ok": True, "exists": False, "config": default})

    try:
        j = json.loads(config_file.read_text(encoding="utf-8-sig"))
    except Exception:
        return handler._send_json(200, {"ok": True, "exists": True, "config": default, "warning": "config.json ist ungültig (JSON)"})

    if not isinstance(j, dict):
        return handler._send_json(200, {"ok": True, "exists": True, "config": default, "warning": "config.json ist ungültig (JSON)"})

    if not j.get("lang") or not isinstance(j.get("lang"), str):
        j["lang"] = default["lang"]

    return handler._send_json(200, {"ok": True, "exists": True, "config": j})


# -----------------------------------------------------------------
# api/template_editor_save_config.php -> /api/template_editor_save_config
# -----------------------------------------------------------------

def template_editor_save_config(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    if not isinstance(body, dict):
        return handler._send_json(400, {"ok": False, "error": "Ungültiges JSON"})

    lang = str(body.get("lang", "")).strip().lower() if body.get("lang") is not None else None
    if not lang:
        return handler._send_json(400, {"ok": False, "error": 'Feld "lang" fehlt'})
    if lang not in ("de", "en"):
        return handler._send_json(400, {"ok": False, "error": "Ungültige Sprache. Erlaubt: de, en"})

    booth_root = get_booth_root()
    config_dir = booth_root / "config"
    config_file = config_dir / "config.json"
    config_dir.mkdir(parents=True, exist_ok=True)

    current: Dict[str, Any] = {}
    if config_file.is_file():
        try:
            j = json.loads(config_file.read_text(encoding="utf-8-sig"))
            if isinstance(j, dict):
                current = j
        except Exception:
            pass

    current["lang"] = lang
    current["updated_at"] = datetime.now().isoformat()

    tmp = str(config_file) + ".tmp"
    try:
        Path(tmp).write_text(json.dumps(current, indent=2, ensure_ascii=False), encoding="utf-8")
        os.replace(tmp, config_file)
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "Konnte config.json nicht schreiben"})

    return handler._send_json(200, {"ok": True, "config": current})


# -----------------------------------------------------------------
# api/template_editor_list_projects.php -> /api/template_editor_list_projects
# -----------------------------------------------------------------

def template_editor_list_projects(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    booth_root = get_booth_root()
    root = booth_root / "templates"
    if not root.is_dir():
        return handler._send_json(200, {"ok": False, "error": "Templates directory missing"})

    projects = []
    for d in root.iterdir():
        if not d.is_dir():
            continue
        xml = d / "template.xml"
        if not xml.is_file():
            continue
        mtime = xml.stat().st_mtime
        projects.append({
            "name": d.name,
            "xml": f"/templates/{d.name}/template.xml",
            "modified": datetime.fromtimestamp(mtime).strftime("%Y-%m-%d %H:%M"),
        })

    projects.sort(key=lambda p: p["modified"], reverse=True)
    return handler._send_json(200, {"ok": True, "projects": projects})


# -----------------------------------------------------------------
# api/template_editor_save.php -> /api/template_editor_save
# -----------------------------------------------------------------

def template_editor_save(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    if not isinstance(body, dict):
        return handler._send_json(400, {"ok": False, "error": "Invalid JSON"})

    name = _sanitize_name(str(body.get("templateName", "")))
    w = int(body.get("width", 0) or 0)
    h = int(body.get("height", 0) or 0)
    settings = body.get("settings") or {}
    greenwall = bool(settings.get("greenwall")) or bool(body.get("greenwall"))
    layers = body.get("layers") or []

    if not name:
        return handler._send_json(400, {"ok": False, "error": "templateName fehlt"})
    if w < 100 or h < 100:
        return handler._send_json(400, {"ok": False, "error": "Ungültige Templategröße"})
    if not isinstance(layers, list):
        return handler._send_json(400, {"ok": False, "error": "layers muss array sein"})

    booth_root = get_booth_root()
    tpl_dir, url_prefix = _resolve_template_paths(name, booth_root)
    assets_dir = tpl_dir / "assets"

    try:
        assets_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "Kann templates dir nicht anlegen"})

    root = ET.Element("template")
    root.set("name", name)
    root.set("width", str(w))
    root.set("height", str(h))
    root.set("greenwall", "1" if greenwall else "0")

    z = 0
    for ly in layers:
        if not isinstance(ly, dict):
            continue
        z += 1
        el = ET.SubElement(root, "layer")
        el.set("type", str(ly.get("type", "item")))

        lid = int(ly.get("id", 0) or 0)
        if lid > 0:
            el.set("id", str(lid))

        el.set("x", str(int(ly.get("x", 0) or 0)))
        el.set("y", str(int(ly.get("y", 0) or 0)))
        if "cx" in ly:
            el.set("cx", str(int(ly["cx"])))
        if "cy" in ly:
            el.set("cy", str(int(ly["cy"])))
        el.set("w", str(int(ly.get("w", 0) or 0)))
        el.set("h", str(int(ly.get("h", 0) or 0)))
        el.set("rotation", str(int(ly.get("rotation", 0) or 0)))
        el.set("z", str(z))

        el.set("radius", str(int(ly.get("radius", 0) or 0)))
        el.set("border", str(int(ly.get("border", 0) or 0)))
        el.set("border_color", str(ly.get("border_color", "#000000")))
        el.set("border_style", _norm_border_style(ly.get("border_style", "solid")))
        el.set("border_width", str(int(ly.get("border_width", 0) or 0)))

        el.set("shadow", str(int(ly.get("shadow", 0) or 0)))
        el.set("shadow_preset", str(ly.get("shadow_preset", "1")))
        el.set("shadow_color", str(ly.get("shadow_color", "rgba(0,0,0,0.35)")))
        el.set("shadow_x", str(int(ly.get("shadow_x", 0) or 0)))
        el.set("shadow_y", str(int(ly.get("shadow_y", 6) or 6)))
        el.set("shadow_blur", str(int(ly.get("shadow_blur", 18) or 18)))
        el.set("shadow_spread", str(int(ly.get("shadow_spread", 0) or 0)))

        ltype = str(ly.get("type", "item"))
        if ltype == "photo":
            el.set("index", str(int(ly.get("index", 0) or 0)))
            if ly.get("label"):
                el.set("label", str(ly["label"]))
        elif ltype == "image":
            el.set("src", _normalize_asset_src(str(ly.get("src", ""))))
            el.set("name", str(ly.get("name", "IMAGE")))
        else:
            el.set("name", str(ly.get("name", "ITEM")))

    xml_path = tpl_dir / "template.xml"
    try:
        rough = ET.tostring(root, encoding="utf-8")
        pretty = minidom.parseString(rough).toprettyxml(indent="  ", encoding="UTF-8")
        xml_path.write_bytes(pretty)
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "Kann template.xml nicht schreiben"})

    preview_data_url = str(body.get("previewDataUrl", ""))
    m = re.match(r"^data:image/(jpeg|jpg);base64,(.+)$", preview_data_url, re.IGNORECASE)
    if m:
        import base64
        try:
            preview_bin = base64.b64decode(m.group(2))
            (tpl_dir / "preview.jpg").write_bytes(preview_bin)
        except Exception:
            pass

    return handler._send_json(200, {"ok": True, "templateName": name, "path": f"{url_prefix}/template.xml"})


# -----------------------------------------------------------------
# api/template_editor_export.php -> /api/template_editor_export (binary ZIP response)
# -----------------------------------------------------------------

def template_editor_export(handler, qs: Dict[str, Any], body: Dict[str, Any]) -> None:
    if not isinstance(body, dict):
        return handler._send_json(400, {"ok": False, "error": "Invalid JSON"})

    name = _sanitize_name(str(body.get("templateName", "")))
    if not name:
        return handler._send_json(400, {"ok": False, "error": "templateName fehlt"})

    booth_root = get_booth_root()
    tpl_dir, _ = _resolve_template_paths(name, booth_root)
    xml = tpl_dir / "template.xml"

    if not tpl_dir.is_dir() or not xml.is_file():
        return handler._send_json(404, {"ok": False, "error": "Template nicht gefunden"})

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for p in tpl_dir.rglob("*"):
            if p.is_file() and not p.is_symlink():
                rel = p.relative_to(tpl_dir).as_posix()
                zf.write(p, rel)

    data = buf.getvalue()
    return handler._send_bytes(200, data, "application/zip", extra_headers={
        "Content-Disposition": f'attachment; filename="{name}.zip"',
        "Cache-Control": "no-store",
    })


# -----------------------------------------------------------------
# api/template_editor_import.php -> /api/template_editor_import (multipart ZIP upload)
# -----------------------------------------------------------------

def template_editor_import(handler, qs: Dict[str, Any], upload: Optional[Dict[str, Any]]) -> None:
    if upload is None:
        return handler._send_json(400, {"ok": False, "error": "ZIP Upload fehlgeschlagen"})

    orig = os.path.basename(upload["name"])
    base = _sanitize_name(Path(orig).stem)
    if not base:
        base = "import_" + datetime.now().strftime("%Y%m%d_%H%M%S")

    booth_root = get_booth_root()
    templates_dir = booth_root / "templates"

    tpl_name = base
    dest = templates_dir / tpl_name
    i = 2
    while dest.is_dir():
        tpl_name = f"{base}_{i}"
        dest = templates_dir / tpl_name
        i += 1

    dest.mkdir(parents=True, exist_ok=False)

    try:
        zf = zipfile.ZipFile(io.BytesIO(upload["data"]))
    except Exception:
        return handler._send_json(400, {"ok": False, "error": "ZIP kann nicht geöffnet werden"})

    for n in zf.namelist():
        if re.search(r"(^/|^[A-Za-z]:|\x00|\.\.)", n):
            zf.close()
            return handler._send_json(400, {"ok": False, "error": "Unsicherer ZIP Inhalt (Pfad)"})

    try:
        zf.extractall(dest)
    except Exception:
        zf.close()
        return handler._send_json(500, {"ok": False, "error": "ZIP konnte nicht entpackt werden"})
    zf.close()

    xml_path = dest / "template.xml"
    if not xml_path.is_file():
        found = _find_template_xml(dest)
        if found is None:
            return handler._send_json(400, {"ok": False, "error": "template.xml nicht gefunden"})
        xml_path = found

    try:
        tree = ET.parse(str(xml_path))
        tpl = tree.getroot()
    except Exception:
        return handler._send_json(400, {"ok": False, "error": "Ungültige template.xml"})

    if tpl.tag != "template":
        found_tpl = tpl.find(".//template")
        if found_tpl is None:
            return handler._send_json(400, {"ok": False, "error": "Ungültige template.xml"})
        tpl = found_tpl

    width = int(tpl.attrib.get("width", 0) or 0)
    height = int(tpl.attrib.get("height", 0) or 0)
    gw_attr = str(tpl.attrib.get("greenwall", "")).strip().lower()
    greenwall = gw_attr in ("1", "true")
    settings = {"greenwall": greenwall}

    layers = []
    photo_counter = 0
    style_attrs_int = {"radius", "border", "border_width", "shadow", "shadow_x", "shadow_y", "shadow_blur", "shadow_spread"}
    style_attrs = style_attrs_int | {"border_color", "border_style", "shadow_preset", "shadow_color"}

    order = 0
    for ly in tpl.iter("layer"):
        order += 1
        ltype = ly.attrib.get("type", "item")
        item: Dict[str, Any] = {
            "_z": int(ly.attrib.get("z", 0) or 0),
            "_o": order,
            "id": int(ly.attrib.get("id", 0) or 0),
            "type": ltype,
            "x": int(ly.attrib.get("x", 0) or 0),
            "y": int(ly.attrib.get("y", 0) or 0),
            "w": int(ly.attrib.get("w", 0) or 0),
            "h": int(ly.attrib.get("h", 0) or 0),
            "rotation": int(ly.attrib.get("rotation", 0) or 0),
        }

        for a in style_attrs:
            if a in ly.attrib:
                item[a] = int(ly.attrib[a]) if a in style_attrs_int else str(ly.attrib[a])

        if ltype == "photo":
            item["index"] = int(ly.attrib.get("index", 0) or 0)
            photo_counter = max(photo_counter, item["index"])
        elif ltype == "image":
            item["src"] = _normalize_asset_src(ly.attrib.get("src", ""))
            item["name"] = ly.attrib.get("name") or "IMAGE"
        else:
            item["name"] = ly.attrib.get("name") or "ITEM"

        layers.append(item)

    has_z = any(it.get("_z") for it in layers)
    if has_z:
        layers.sort(key=lambda it: (it.get("_z", 0), it.get("_o", 0)))

    for it in layers:
        it.pop("_z", None)
        it.pop("_o", None)

    return handler._send_json(200, {
        "ok": True,
        "templateName": tpl_name,
        "width": width,
        "height": height,
        "layers": layers,
        "photoCounter": photo_counter,
        "baseUrl": f"/templates/{tpl_name}/",
        "settings": settings,
    })


# -----------------------------------------------------------------
# api/template_editor_upload_asset.php -> /api/template_editor_upload_asset (multipart)
# -----------------------------------------------------------------

def template_editor_upload_asset(handler, qs: Dict[str, Any], form: Dict[str, Any], upload: Optional[Dict[str, Any]]) -> None:
    name = _sanitize_name(str(form.get("templateName", "")))
    if not name:
        return handler._send_json(400, {"ok": False, "error": "templateName fehlt"})

    if upload is None:
        return handler._send_json(400, {"ok": False, "error": "Upload fehlgeschlagen"})

    booth_root = get_booth_root()
    tpl_dir, url_prefix = _resolve_template_paths(name, booth_root)
    asset_dir = tpl_dir / "assets"
    try:
        asset_dir.mkdir(parents=True, exist_ok=True)
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "Kann assets/ nicht anlegen"})

    orig = os.path.basename(upload["name"])
    ext = Path(orig).suffix.lower().lstrip(".")
    if ext not in _ASSET_EXTS:
        return handler._send_json(400, {"ok": False, "error": "Nur png/jpg/jpeg/webp erlaubt"})

    target_name = os.path.basename(str(form.get("targetName", "")).strip())
    if target_name:
        if not re.match(r"^___greenwall\.(png|jpg|jpeg)$", target_name, re.IGNORECASE):
            return handler._send_json(400, {"ok": False, "error": "Ungültiger targetName"})
        t_ext = Path(target_name).suffix.lower().lstrip(".")
        if t_ext not in ("png", "jpg", "jpeg"):
            return handler._send_json(400, {"ok": False, "error": "Ungültige Greenwall-Endung"})
        if t_ext != ext:
            return handler._send_json(400, {"ok": False, "error": "Dateiendung passt nicht zum targetName (z.B. png zu ___greenwall.png)"})

        fn = target_name.lower()
        target = asset_dir / fn
        for c in ("___greenwall.png", "___greenwall.jpg", "___greenwall.jpeg"):
            p = asset_dir / c
            if c != fn and p.is_file():
                try:
                    p.unlink()
                except Exception:
                    pass
    else:
        base_name = re.sub(r"[^a-z0-9_-]", "_", Path(orig).stem, flags=re.IGNORECASE) or "img"
        fn = f"{base_name}.{ext}"
        target = asset_dir / fn
        i = 2
        while target.exists():
            fn = f"{base_name}_{i}.{ext}"
            target = asset_dir / fn
            i += 1

    try:
        target.write_bytes(upload["data"])
    except Exception:
        return handler._send_json(500, {"ok": False, "error": "Kann Datei nicht speichern"})

    rel_path = f"assets/{fn}"
    url = f"{url_prefix}/{rel_path}"

    return handler._send_json(200, {
        "ok": True,
        "name": orig,
        "savedName": fn,
        "relPath": rel_path,
        "url": url,
    })


# -----------------------------------------------------------------
# api/test_print.php -> kein eigener Endpunkt mehr noetig.
#
# Das alte PHP hat nur templateName -> template_dir aufgeloest und das
# Ergebnis 1:1 per curl an den (separaten) Python-Server /print/test
# weitergereicht. Jetzt laeuft alles im selben Prozess: /print/test in
# python_server.py akzeptiert bereits "template_dir" + "printerName" direkt
# (siehe do_POST dort), das Frontend ruft diesen Pfad seitdem unmittelbar
# auf -- dieser Wrapper bleibt nur für das alte "templateName"-Feld.
# -----------------------------------------------------------------

def resolve_template_dir_for_name(template_name: str) -> Path:
    booth_root = get_booth_root()
    name = (template_name or "").strip().lower()
    name = re.sub(r"\s+", "_", name)
    name = re.sub(r"[^a-z0-9_-]", "", name)
    if not name or name == "activetemplate":
        return booth_root / "activeTemplate"
    return booth_root / "templates" / name
