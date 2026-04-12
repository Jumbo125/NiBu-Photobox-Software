# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
python_server.py — lokaler Tool-Server (Windows + Linux) für:
  - GET  /            -> Text "OK"
  - GET  /ping        -> JSON Healthcheck: {"ok": true}
  - GET  /runtime     -> kleine Debug-Infos (PID, CWD, ...)

  - GET  /pick        -> startet filepicker_core.py (GUI) und gibt Pfad zurück
  - GET  /pickUpload  -> Filepicker + Copy nach <caddyWebroot>/uploads (+subdir), gibt JSON-Metadaten zurück
  - GET  /openfolder  -> öffnet Ordner im Explorer/Finder/Dateimanager (legt ihn bei Bedarf an)

  - POST /closebrowser -> (Key geschützt) beendet den Browser-Prozess, der den Request ausgelöst hat

  - GET  /printers             -> listet Drucker (Logik in printer_core.py)
  - POST /printers/default     -> setzt Default-Drucker
  - POST /printers/dialog      -> öffnet Drucker-GUI / Eigenschaften / Preferences

  - POST /print/default        -> (Key geschützt) druckt Bild auf Standarddrucker (Standardeinstellungen)
                                 + erhöht active_event.print_counter in event_file nach erfolgreichem Queueing

NEU (Service-Wrapper für deine Server.exe via service_core.py):
  - GET  /service/status?exe=...&api_key=...
  - POST /service/start    { "exe":"...", "api_key":"..." }
  - POST /service/stop     { "exe":"...", "api_key":"..." }
  - POST /service/restart  { "exe":"...", "api_key":"..." }

NEU (Renderer / Collage):
  - POST /greenwall/profile     (lokal, OHNE API-Key)  { "reference_image_path": "C:/.../ref.jpg" }

  - POST /render/collage        (Key geschützt)

NEU (Renderer / Session Snapshot):
  - POST /render_from_session   (Key geschützt)  { "session_folder": "..." }

NEU (Preview: liefert gerendertes Bild binär aus session.json):
  - GET  /preview/session?api_key=...&session_folder=...   (Key geschützt)
    -> liefert image/jpeg oder image/png, wenn session.json: render.return_image == true
    -> sonst JSON: {ok:false,error:"missing_setting",...}

NEU (DNP Detect + Info, absichtlich OHNE API-Key):
  - GET  /dnp/info?printer=...&model=...
  - POST /dnp/info  { "printer":"...", "model":"..." }
    -> führt detect aus; falls kein Drucker gefunden wird: fail JSON
    -> falls gefunden: führt intern info gegen den gefundenen device path aus und gibt das JSON zurück
    {
        "message": "succes",
        "Printermodel": "QW410",
        "status": "Idle",
        "Remaining prints": 15,
        "Media": "6x4",
        "Free buffer": 1
    }

NEU (Python-Server selbst sauber beenden):
  - POST /shutdown         { "api_key":"..." }  oder Header X-Api-Key

Absicherung:
  - api_key aus Request muss == AuthKey aus server_config.json (neben python_server.py)
  - AUSNAHME: /dnp/info ist lokal erreichbar und benötigt absichtlich keinen API-Key
"""

import io
import json
import mimetypes
import os
import platform
import re
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, Optional, Tuple
from urllib.parse import parse_qs, urlparse

# -----------------------------
# Konfiguration (Host/Port)
# -----------------------------
HOST = "127.0.0.1"
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8053

HERE = os.path.dirname(os.path.abspath(__file__))
CORE = os.path.join(HERE, "filepicker_core.py")
SERVER_CFG_PATH = os.path.join(HERE, "server_config.json")

# -----------------------------
# Debug-Schalter (gezielt Aktionen überspringen)
# -----------------------------
# True  = Aktion wird absichtlich NICHT ausgeführt
# False = normales Verhalten
DEBUG_SKIP_RENDER = False
DEBUG_SKIP_PRINT = False
DEBUG_SKIP_PRINT_COUNTER = False
DEBUG_SKIP_SERVICE_ACTIONS = False
DEBUG_SKIP_CLOSE_BROWSER = False
DEBUG_SKIP_OPENFOLDER = False
DEBUG_SKIP_FILEPICKER = False
DEBUG_SKIP_DNP_INFO = False


# -----------------------------
# OpenFolder ausgelagert
# -----------------------------
try:
    from open_folder import openfolder_endpoint as _openfolder_endpoint
    from open_folder import DEFAULT_COOLDOWN_SEC as _OPEN_DEFAULT_COOLDOWN
except Exception as e:
    _OPENFOLDER_IMPORT_ERROR = str(e)
    _openfolder_endpoint = None
    _OPEN_DEFAULT_COOLDOWN = 2.0
else:
    _OPENFOLDER_IMPORT_ERROR = ""

# -----------------------------
# CloseBrowser ausgelagert
# -----------------------------
try:
    from close_browser import close_browser_from_request as _close_browser_from_request
except Exception as e:
    _CLOSEBROWSER_IMPORT_ERROR = str(e)
    _close_browser_from_request = None
else:
    _CLOSEBROWSER_IMPORT_ERROR = ""

# -----------------------------
# Service core
# -----------------------------
try:
    from service_core import (
        get_service_status,
        load_server_config,
        restart_service,
        start_service,
        stop_service,
        validate_api_key,
    )
except Exception as e:
    _SERVICE_IMPORT_ERROR = str(e)
    load_server_config = None
    validate_api_key = None
    get_service_status = None
    start_service = None
    stop_service = None
    restart_service = None
else:
    _SERVICE_IMPORT_ERROR = ""

# -----------------------------
# Printer-Core import
# -----------------------------
try:
    from printer_core import (
        bump_print_counter,
        list_printers,
        open_printer_gui,
        print_image,
        set_default_printer,
    )
except Exception as e:
    _PRINTER_IMPORT_ERROR = str(e)
    list_printers = None
    set_default_printer = None
    open_printer_gui = None
    print_image = None
    bump_print_counter = None
else:
    _PRINTER_IMPORT_ERROR = ""

# -----------------------------
# Render-Core import
# -----------------------------
try:
    from render_core import get_booth_root, render_collage_api, render_from_session
except Exception as e:
    _RENDER_IMPORT_ERROR = str(e)
    render_collage_api = None
    render_from_session = None
    get_booth_root = None
else:
    _RENDER_IMPORT_ERROR = ""

# -----------------------------
# Greenwall profile import
# -----------------------------
try:
    from greenwall_profile import create_greenwall_profile_from_path, get_default_profile_dir
except Exception as e:
    _GREENWALL_PROFILE_IMPORT_ERROR = str(e)
    create_greenwall_profile_from_path = None
    get_default_profile_dir = None
else:
    _GREENWALL_PROFILE_IMPORT_ERROR = ""

# -----------------------------
# DNP import
# -----------------------------
try:
    from common_dnp import DnpProtocolClient, format_status
    from main_dnp import CliOptions, create_transport, detect_printer, resolve_printer_model
    from windows_dnp import WindowsUsbVidPidCatalog
except Exception as e:
    _DNP_IMPORT_ERROR = str(e)
    CliOptions = None
    create_transport = None
    detect_printer = None
    resolve_printer_model = None
    DnpProtocolClient = None
    format_status = None
else:
    _DNP_IMPORT_ERROR = ""

# server_config.json einmal laden (AuthKey, args, port, ...)
_SERVER_CFG = None
_SERVER_CFG_ERR = ""
if load_server_config is not None:
    _cfg_res = load_server_config(SERVER_CFG_PATH)
    if _cfg_res.get("ok"):
        _SERVER_CFG = _cfg_res.get("config")
    else:
        _SERVER_CFG_ERR = json.dumps(_cfg_res, ensure_ascii=False)
else:
    _SERVER_CFG_ERR = _SERVICE_IMPORT_ERROR or "service_core_import_failed"

# Locks
_RENDER_LOCK = threading.Lock()
_PRINT_LOCK = threading.Lock()
_DNP_LOCK = threading.Lock()
_DNP_LAST_INFO_TS = 0.0
_DNP_DEFAULT_MIN_INTERVAL_SEC = 60.0
_STARTUP_JSON_CHECKS = {"ok": False, "checks": {}}

# -----------------------------
# Webroot / uploads helpers
# -----------------------------
def _pb_deep_get(d, path, default=None):
    try:
        cur = d
        for k in str(path).split("."):
            if not isinstance(cur, dict) or k not in cur:
                return default
            cur = cur[k]
        return cur
    except Exception:
        return default


def _pb_load_json(path):
    try:
        if not path or not os.path.isfile(path):
            return {}
        with open(path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _pb_get_caddy_webroot():
    """Liest caddyWebroot aus server_config.json und gibt einen absoluten Path zurück."""
    cfg = globals().get("_SERVER_CFG") if isinstance(globals().get("_SERVER_CFG"), dict) else None
    if cfg is None:
        cfg = _pb_load_json(globals().get("SERVER_CFG_PATH", "")) or {}

    val = (
        cfg.get("caddyWebroot")
        or _pb_deep_get(cfg, "caddyWebroot")
        or _pb_deep_get(cfg, "paths.caddyWebroot")
        or _pb_deep_get(cfg, "caddy.webroot")
        or _pb_deep_get(cfg, "webroot")
    )
    if not val:
        return None

    p = Path(str(val)).expanduser()
    if not p.is_absolute():
        here = Path(globals().get("HERE", os.getcwd()))
        p = (here / p).resolve()
    return p


_SUBDIR_RE = re.compile(r"^[A-Za-z0-9._\-/]+$")


def _pb_sanitize_subdir(subdir):
    """Sanitizes optional subdir to prevent traversal. Returns POSIX-like path without leading slash."""
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


def _pb_safe_filename(name, max_len=120):
    name = (name or "").strip()
    if not name:
        return "file"
    name = os.path.basename(name)
    name = re.sub(r"[^A-Za-z0-9._-]+", "_", name)
    name = name.strip("._-") or "file"
    return name[:max_len]


def _pb_make_dest_name(src):
    src = Path(str(src))
    stem = _pb_safe_filename(src.stem)
    ext = src.suffix.lower()
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    rnd = secrets.token_hex(2)
    return f"{stem}_{ts}_{rnd}{ext}"


def _pb_file_dates(p):
    try:
        st = Path(str(p)).stat()
        mtime = datetime.fromtimestamp(st.st_mtime).isoformat(timespec="seconds")
        ctime = datetime.fromtimestamp(st.st_ctime).isoformat(timespec="seconds")
        return {"modified_at": mtime, "created_at": ctime}
    except Exception:
        return {"modified_at": None, "created_at": None}


# -----------------------------
# One-instance-safe: Port-Check
# -----------------------------
def is_port_in_use(host: str, port: int, timeout: float = 0.25) -> bool:
    """True wenn auf host:port schon jemand lauscht."""
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(timeout)
            return s.connect_ex((host, port)) == 0
    except Exception:
        return False


# Wenn Port belegt: sofort exit (one-instance-safe)
if is_port_in_use(HOST, PORT):
    print(f"[one-instance] Server already running on http://{HOST}:{PORT} -> exit")
    sys.exit(0)


# -----------------------------
# Helpers
# -----------------------------
def json_bytes(obj: Any) -> bytes:
    return json.dumps(obj, ensure_ascii=False).encode("utf-8")


def run_cmd(args, timeout: int = 8) -> Dict[str, Any]:
    try:
        p = subprocess.run(
            args,
            capture_output=True,
            text=False,
            timeout=timeout,
            shell=False,
        )
        out = (p.stdout or b"").decode("utf-8", errors="replace").strip()
        err = (p.stderr or b"").decode("utf-8", errors="replace").strip()

        return {
            "ok": (p.returncode == 0),
            "rc": p.returncode,
            "out": out,
            "err": err,
            "cmd": args,
        }
    except subprocess.TimeoutExpired:
        return {"ok": False, "rc": -1, "error": "timeout", "cmd": args}
    except Exception as e:
        return {"ok": False, "rc": -1, "error": str(e), "cmd": args}


def parse_body(handler: BaseHTTPRequestHandler) -> Dict[str, Any]:
    """Parst JSON oder form-urlencoded aus dem Request Body."""
    length = int(handler.headers.get("Content-Length", "0") or "0")
    raw = handler.rfile.read(length) if length > 0 else b""
    ctype = (handler.headers.get("Content-Type") or "").lower()

    if "application/json" in ctype and raw:
        try:
            return json.loads(raw.decode("utf-8", errors="replace"))
        except Exception:
            return {}

    try:
        return {k: v[0] for k, v in parse_qs(raw.decode("utf-8", errors="replace")).items()}
    except Exception:
        return {}



def _get_api_key_from_request(handler: BaseHTTPRequestHandler, qs: Dict[str, Any], body: Dict[str, Any]) -> str:
    hk = handler.headers.get("X-Api-Key") or handler.headers.get("x-api-key")
    if hk:
        return str(hk).strip()

    if qs and "api_key" in qs:
        try:
            return str(qs.get("api_key", [""])[0]).strip()
        except Exception:
            pass

    if body and "api_key" in body:
        return str(body.get("api_key") or "").strip()

    return ""


def _auth_or_403(handler: BaseHTTPRequestHandler, qs: Dict[str, Any], body: Dict[str, Any]) -> Dict[str, Any]:
    """Gibt {"ok":True} wenn api_key passt, sonst {"ok":False, ...}."""
    if _SERVER_CFG is None:
        return {"ok": False, "error": "server_config_missing", "detail": _SERVER_CFG_ERR}

    if validate_api_key is None:
        return {"ok": False, "error": "service_core_import_failed", "detail": _SERVICE_IMPORT_ERROR}

    provided = _get_api_key_from_request(handler, qs, body)
    return validate_api_key(provided, _SERVER_CFG)


def _pb_load_booth_config(booth_root: Path) -> Dict[str, Any]:
    p = booth_root / "config" / "config" / "config.json"
    return _pb_load_json(str(p)) or {}


def _pb_return_image_enabled_from_session(sess: Dict[str, Any]) -> Any:
    v = _pb_deep_get(sess, "render.return_image", None)
    if v is not None:
        return v

    v = _pb_deep_get(sess, "render.returnImage", None)
    if v is not None:
        return v

    v = _pb_deep_get(sess, "preview.return_image", None)
    if v is not None:
        return v

    return None



def _pb_to_positive_float(value: Any, default: float) -> float:
    try:
        num = float(value)
        if num > 0:
            return num
    except Exception:
        pass
    return float(default)


def _pb_get_booth_root_safe() -> Optional[Path]:
    try:
        if get_booth_root is None:
            return None
        root = get_booth_root()
        if root is None:
            return None
        return Path(root).resolve()
    except Exception:
        return None


def _json_file_check(path: Path, required: bool = True) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "path": str(path),
        "required": bool(required),
        "exists": False,
        "is_file": False,
        "json_ok": False,
        "error": "",
    }

    try:
        result["exists"] = path.exists()
        result["is_file"] = path.is_file()
        if not result["exists"]:
            result["error"] = "missing"
            return result
        if not result["is_file"]:
            result["error"] = "not_a_file"
            return result
        with path.open("r", encoding="utf-8-sig") as fh:
            data = json.load(fh)
        result["json_ok"] = isinstance(data, (dict, list))
        if not result["json_ok"]:
            result["error"] = "invalid_json_root"
        return result
    except Exception as e:
        result["error"] = str(e)
        return result


def _collect_startup_json_checks() -> Dict[str, Any]:
    booth_root = _pb_get_booth_root_safe()
    checks: Dict[str, Any] = {
        "server_config": _json_file_check(Path(SERVER_CFG_PATH), required=True),
    }

    if booth_root is not None:
        checks["booth_config"] = _json_file_check(booth_root / "config" / "config" / "config.json", required=False)
        checks["render_config"] = _json_file_check(booth_root / "config" / "config" / "render_config.json", required=False)
    else:
        checks["booth_config"] = {
            "path": "",
            "required": False,
            "exists": False,
            "is_file": False,
            "json_ok": False,
            "error": "booth_root_unavailable",
        }
        checks["render_config"] = {
            "path": "",
            "required": False,
            "exists": False,
            "is_file": False,
            "json_ok": False,
            "error": "booth_root_unavailable",
        }

    all_required_ok = all(
        bool(v.get("json_ok")) or not bool(v.get("required"))
        for v in checks.values()
        if isinstance(v, dict)
    )

    return {
        "ok": all_required_ok,
        "checks": checks,
    }


_STARTUP_JSON_CHECKS = _collect_startup_json_checks()


def _dnp_min_interval_sec() -> float:
    booth_root = _pb_get_booth_root_safe()
    if booth_root is None:
        return float(_DNP_DEFAULT_MIN_INTERVAL_SEC)

    cfg = _pb_load_booth_config(booth_root)
    candidates = (
        _pb_deep_get(cfg, "general.printer.dnpMinIntervalSec", None),
        _pb_deep_get(cfg, "general.printer.dnp_min_interval_sec", None),
        _pb_deep_get(cfg, "general.printer.dnp.minIntervalSec", None),
        _pb_deep_get(cfg, "general.printer.dnp.min_interval_sec", None),
        _pb_deep_get(cfg, "printer.dnpMinIntervalSec", None),
        _pb_deep_get(cfg, "printer.dnp_min_interval_sec", None),
        _pb_deep_get(cfg, "printer.dnp.minIntervalSec", None),
        _pb_deep_get(cfg, "printer.dnp.min_interval_sec", None),
        _pb_deep_get(cfg, "dnp.minIntervalSec", None),
        _pb_deep_get(cfg, "dnp.min_interval_sec", None),
    )
    for value in candidates:
        if value is not None:
            return _pb_to_positive_float(value, _DNP_DEFAULT_MIN_INTERVAL_SEC)

    return float(_DNP_DEFAULT_MIN_INTERVAL_SEC)


def _resolve_under_booth_root(p: str) -> str:
    """Wenn render_core.get_booth_root() verfügbar ist: relative Pfade darunter auflösen."""
    s = (p or "").strip()
    if not s:
        return s
    try:
        pp = Path(s).expanduser()
        if pp.is_absolute():
            return str(pp.resolve())
        if get_booth_root is None:
            return s
        booth_root = get_booth_root()
        return str((booth_root / pp).resolve())
    except Exception:
        return s


def _debug_skip_result(action: str, **extra: Any) -> Dict[str, Any]:
    result: Dict[str, Any] = {
        "ok": True,
        "debug": True,
        "skipped": True,
        "action": action,
        "message": f"{action} skipped by debug flag",
    }
    result.update(extra)
    return result


def _dnp_build_options(command: str, printer: Optional[str] = None, model: Optional[str] = None, device: Optional[str] = None):
    if CliOptions is None:
        return None
    return CliOptions(
        command=command,
        model=model,
        json_output=True,
        simulate=False,
        show_help=False,
        transport="auto",
        printer=printer,
        device=device,
        port=None,
        dll_path=None,
        start_port=0,
        end_port=7,
        read_timeout_ms=5000,
        post_write_delay_ms=75,
    )


def _dnp_close_transport_safely(transport: Any) -> None:
    try:
        close_fn = getattr(transport, "close", None)
        if callable(close_fn):
            close_fn()
    except Exception:
        pass


def _dnp_resolve_detected_model(detection: Any) -> Optional[str]:
    if detection is None:
        return None
    return getattr(detection, "model", None) or WindowsUsbVidPidCatalog.try_get_model(
        getattr(detection, "vendor_id", None),
        getattr(detection, "product_id", None),
    )


def _dnp_detect_and_info(printer: Optional[str] = None, model: Optional[str] = None) -> Tuple[int, Dict[str, Any]]:
    global _DNP_LAST_INFO_TS

    if detect_printer is None or create_transport is None or DnpProtocolClient is None or format_status is None:
        return 500, {
            "ok": False,
            "error": "dnp_import_failed",
            "detail": _DNP_IMPORT_ERROR,
        }

    detect_options = _dnp_build_options(command="detect", printer=printer, model=model)
    if detect_options is None:
        return 500, {"ok": False, "error": "dnp_options_unavailable"}

    with _DNP_LOCK:
        min_interval_sec = _dnp_min_interval_sec()
        now = time.time()
        elapsed = now - float(_DNP_LAST_INFO_TS or 0.0)

        if _DNP_LAST_INFO_TS and elapsed < min_interval_sec:
            retry_after = max(0.0, min_interval_sec - elapsed)
            return 429, {
                "ok": False,
                "error": "timer_too_short",
                "message": "DNP-Statusabfrage zu früh",
                "min_interval_sec": round(min_interval_sec, 3),
                "elapsed_sec": round(max(0.0, elapsed), 3),
                "retry_after_sec": round(retry_after, 3),
            }

        _DNP_LAST_INFO_TS = now
        detection = detect_printer(detect_options)

        if not getattr(detection, "success", False) or not getattr(detection, "query_value", None) or not str(detection.query_value).strip():
            return 200, {
                "ok": True,
                "found": False,
                "message": "kein drucker gefunden",
                "printerModel": "",
                "Printermodel": "",
                "status": "",
                "remainingPrints": None,
                "Remaining prints": None,
                "media": "",
                "Media": "",
                "freeBuffer": None,
                "Free buffer": None,
            }

        info_options = _dnp_build_options(
            command="info",
            printer=printer,
            model=model or getattr(detection, "model", None),
            device=str(detection.query_value).strip(),
        )
        if info_options is None:
            return 500, {"ok": False, "error": "dnp_options_unavailable"}

        transport = create_transport(info_options)
        try:
            client = DnpProtocolClient(transport)
            probe = client.probe()
        finally:
            _dnp_close_transport_safely(transport)

        detected_model = _dnp_resolve_detected_model(detection)

        resolved_model = None
        try:
            if resolve_printer_model is not None:
                resolved_model = resolve_printer_model(info_options)
        except Exception:
            resolved_model = None

        printer_model = resolved_model or detected_model or "unknown"

        remaining_value = probe.remaining_prints.count if probe.remaining_prints.count is not None else probe.remaining_prints.raw_value
        free_buffer_value = probe.free_buffer.count if probe.free_buffer.count is not None else probe.free_buffer.raw_value
        media_text = probe.media_type.name if str(probe.media_type.name).strip() else probe.media_type.raw_value
        status_text = format_status(probe.status)

        return 200, {
        "ok": True,
        "message": "succes",
        "detected": {
            "transport": getattr(detection, "transport", None),
            "VID": getattr(detection, "vendor_id", None),
            "PID": getattr(detection, "product_id", None),
            "Printermodel": detected_model,
            "Printermodel_raw": detected_model,
            "device_id": getattr(detection, "query_value", None),
            "printer_name": getattr(detection, "printer_name", None),
            "serial_number": getattr(detection, "serial_number", None),
        },
        "info": {
            "Printermodel": printer_model,
            "Printermodel_raw": detected_model,
            "status": status_text,
            "status_raw": probe.status.raw_code,
            "Remaining prints": remaining_value,
            "Remaining prints_raw": probe.remaining_prints.raw_value,
            "Media": media_text,
            "Media_raw": probe.media_type.raw_value,
            "Free buffer": free_buffer_value,
            "Free buffer_raw": probe.free_buffer.raw_value,
        },
        "polling": {
            "min_interval_sec": round(min_interval_sec, 3),
            "next_allowed_in_sec": round(min_interval_sec, 3),
        },
    }


# -----------------------------
# HTTP Handler
# -----------------------------
class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, X-Api-Key")
        self.send_header("Access-Control-Max-Age", "600")

    def _send_text(self, code: int, text: str):
        try:
            body = (text or "").encode("utf-8")
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", "text/plain; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError, OSError):
            return

    def _send_json(self, code: int, obj: Dict[str, Any]):
        try:
            body = json_bytes(obj)
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError, OSError):
            return

    def _send_file(self, code: int, file_path: str, mime: str, extra_headers: Optional[Dict[str, str]] = None):
        try:
            p = Path(file_path)
            if not p.exists() or not p.is_file():
                return self._send_json(404, {"ok": False, "error": "file_not_found", "file": str(p)})

            size = p.stat().st_size
            self.send_response(code)
            self._cors()
            self.send_header("Content-Type", mime or "application/octet-stream")
            self.send_header("Content-Length", str(size))
            self.send_header("Cache-Control", "no-store")
            if extra_headers:
                for k, v in extra_headers.items():
                    if v is None:
                        continue
                    self.send_header(str(k), str(v))
            self.end_headers()

            with p.open("rb") as f:
                shutil.copyfileobj(f, self.wfile, length=64 * 1024)
        except (BrokenPipeError, ConnectionAbortedError, ConnectionResetError, OSError):
            return
        except Exception as e:
            return self._send_json(500, {"ok": False, "error": "send_file_failed", "message": str(e)})

    def do_OPTIONS(self):
        self.send_response(200)
        self._cors()
        self.end_headers()

    def do_GET(self):
        u = urlparse(self.path)
        path = u.path
        qs = parse_qs(u.query)

        if path == "/":
            return self._send_text(200, "OK")

        if path == "/ping":
            return self._send_json(200, {"ok": True})

        if path == "/runtime":
            return self._send_json(200, {
                "ok": True,
                "pid": os.getpid(),
                "host": HOST,
                "port": PORT,
                "python": sys.executable,
                "cwd": os.getcwd(),
                "here": HERE,
                "platform": platform.platform(),
                "openfolder_import_error": _OPENFOLDER_IMPORT_ERROR,
                "closebrowser_import_error": _CLOSEBROWSER_IMPORT_ERROR,
                "printer_import_error": _PRINTER_IMPORT_ERROR,
                "render_import_error": _RENDER_IMPORT_ERROR,
                "greenwall_profile_import_error": _GREENWALL_PROFILE_IMPORT_ERROR,
                "service_import_error": _SERVICE_IMPORT_ERROR,
                "dnp_import_error": _DNP_IMPORT_ERROR,
                "debug_flags": {
                    "skip_render": DEBUG_SKIP_RENDER,
                    "skip_print": DEBUG_SKIP_PRINT,
                    "skip_print_counter": DEBUG_SKIP_PRINT_COUNTER,
                    "skip_service_actions": DEBUG_SKIP_SERVICE_ACTIONS,
                    "skip_close_browser": DEBUG_SKIP_CLOSE_BROWSER,
                    "skip_openfolder": DEBUG_SKIP_OPENFOLDER,
                    "skip_filepicker": DEBUG_SKIP_FILEPICKER,
                    "skip_dnp_info": DEBUG_SKIP_DNP_INFO,
                },
                "json_checks": _STARTUP_JSON_CHECKS,
            })

        if path == "/preview/session":
            body = {}
            auth = _auth_or_403(self, qs, body)
            if not auth.get("ok"):
                return self._send_json(403, {"ok": False, **auth})

            if get_booth_root is None:
                return self._send_json(500, {"ok": False, "error": "render_core_import_failed", "detail": _RENDER_IMPORT_ERROR})

            booth_root = get_booth_root()
            session_folder = (qs.get("session_folder", [""])[0] or "").strip()
            if not session_folder:
                return self._send_json(400, {"ok": False, "error": "missing_session_folder"})

            folder = Path(session_folder).expanduser()
            if not folder.is_absolute():
                folder = booth_root / folder
            folder = folder.resolve()

            sess_path = folder / "session.json"
            sess = _pb_load_json(str(sess_path))
            if not sess:
                return self._send_json(404, {"ok": False, "error": "session_not_found", "session_json": str(sess_path)})

            flag_val = _pb_return_image_enabled_from_session(sess)

            if flag_val is not True:
                return self._send_json(412, {
                    "ok": False,
                    "error": "missing_setting",
                    "need": "session.render.return_image",
                    "where_session": str(sess_path),
                    "found": flag_val,
                    "hint": {"render": {"return_image": True}},
                })

            rr = sess.get("renderResult") if isinstance(sess.get("renderResult"), dict) else {}
            out_path = (rr.get("output_path") or "").strip()
            if not out_path:
                return self._send_json(404, {"ok": False, "error": "no_render_result", "session_json": str(sess_path)})

            imgp = Path(out_path).expanduser()
            if not imgp.is_absolute():
                imgp = booth_root / imgp
            imgp = imgp.resolve()

            if not imgp.exists() or not imgp.is_file():
                return self._send_json(404, {"ok": False, "error": "output_missing", "output_path": str(imgp)})

            ext = imgp.suffix.lower()
            if ext not in (".jpg", ".jpeg", ".png"):
                return self._send_json(415, {"ok": False, "error": "unsupported_image_type", "ext": ext, "file": str(imgp)})

            mime = mimetypes.guess_type(str(imgp))[0] or ("image/jpeg" if ext in (".jpg", ".jpeg") else "image/png")
            return self._send_file(200, str(imgp), mime, extra_headers={
                "X-Render-Output-Name": str(rr.get("output_name", "")),
                "X-Render-Index": str(rr.get("index", "")),
            })

        if path == "/openfolder":
            if DEBUG_SKIP_OPENFOLDER:
                raw = qs.get("path", [""])[0] or ""
                return self._send_json(200, _debug_skip_result("openfolder", path=raw))

            if _openfolder_endpoint is None:
                return self._send_json(500, {"ok": False, "error": "open_folder_import_failed", "detail": _OPENFOLDER_IMPORT_ERROR})

            raw = qs.get("path", [""])[0] or ""
            create = (qs.get("create", ["1"])[0] or "1").strip().lower() in ("1", "true", "yes", "y", "on")
            cooldown = qs.get("cooldown", [str(_OPEN_DEFAULT_COOLDOWN)])[0]
            try:
                cooldown_sec = float(cooldown)
            except Exception:
                cooldown_sec = float(_OPEN_DEFAULT_COOLDOWN)

            result = _openfolder_endpoint(
                raw,
                create=create,
                cooldown_sec=cooldown_sec,
                base_dir=Path(HERE).resolve(),
            )

            if result.get("ok"):
                return self._send_json(200, result)
            if result.get("error") == "folder_not_found":
                return self._send_json(404, result)
            if result.get("error") in ("mkdir_failed",):
                return self._send_json(500, result)
            return self._send_json(400, result)

        if path == "/service/status":
            body = {}
            auth = _auth_or_403(self, qs, body)
            if not auth.get("ok"):
                return self._send_json(403, {"ok": False, **auth})

            if get_service_status is None:
                return self._send_json(500, {"ok": False, "error": "service_core_import_failed", "detail": _SERVICE_IMPORT_ERROR})

            exe = (qs.get("exe", [""])[0] or "").strip()
            if not exe:
                return self._send_json(400, {"ok": False, "error": "missing_exe"})

            return self._send_json(200, get_service_status(exe))

        if path == "/dnp/info":
            printer = (qs.get("printer", [""])[0] or "").strip() or None
            model = (qs.get("model", [""])[0] or "").strip() or None
            if DEBUG_SKIP_DNP_INFO:
                return self._send_json(200, _debug_skip_result("dnp_info", printer=printer, model=model))
            code, result = _dnp_detect_and_info(printer=printer, model=model)
            return self._send_json(code, result)

        if path == "/printers":
            if list_printers is None:
                return self._send_json(500, {
                    "ok": False,
                    "error": "printer_core_import_failed",
                    "message": _PRINTER_IMPORT_ERROR,
                })
            return self._send_json(200, list_printers())

        if path == "/pickUpload":
            title = qs.get("title", ["Select"])[0]
            init_path = qs.get("path", [""])[0]
            flt = qs.get("filter", ["Images|*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.gif|All|*.*"])[0]
            subdir = qs.get("subdir", [""])[0]

            if DEBUG_SKIP_FILEPICKER:
                return self._send_json(200, _debug_skip_result("pick_upload", title=title, init_path=init_path, filter=flt, subdir=subdir))

            if not os.path.isfile(CORE):
                return self._send_json(500, {"ok": False, "error": "filepicker_core_not_found", "core": CORE})

            webroot = _pb_get_caddy_webroot()
            if webroot is None or not webroot.is_dir():
                return self._send_json(500, {
                    "ok": False,
                    "error": "missing_or_invalid_caddyWebroot",
                    "hint": "Setze server_config.json: { \"caddyWebroot\": \"C:/.../webroot\" }",
                    "server_config": globals().get("SERVER_CFG_PATH", ""),
                    "caddyWebroot": str(webroot) if webroot else "",
                })

            safe_subdir = _pb_sanitize_subdir(subdir)
            uploads_dir = (webroot / "uploads" / safe_subdir) if safe_subdir else (webroot / "uploads")
            try:
                uploads_dir.mkdir(parents=True, exist_ok=True)
            except Exception as e:
                return self._send_json(500, {"ok": False, "error": "uploads_dir_create_failed", "uploads_dir": str(uploads_dir), "err": str(e)})

            cmd = [
                sys.executable, CORE,
                "--mode", "file",
                "--title", title,
                "--path", init_path,
                "--filter", flt,
            ]
            r = run_cmd(cmd, timeout=180)
            picked = (r.get("out") or "").strip()
            ok = (r.get("ok") and picked != "")
            if not ok:
                return self._send_json(200, {
                    "ok": False,
                    "picked": picked,
                    "rc": r.get("rc"),
                    "err": r.get("err", ""),
                })

            src = Path(picked)
            if not src.is_file():
                return self._send_json(400, {"ok": False, "error": "picked_not_a_file", "source_abs": str(src)})

            dest_name = _pb_make_dest_name(src)
            dest = uploads_dir / dest_name
            try:
                shutil.copy2(str(src), str(dest))
            except Exception as e:
                return self._send_json(500, {"ok": False, "error": "copy_failed", "source_abs": str(src), "dest_abs": str(dest), "err": str(e)})

            try:
                rel = os.path.relpath(str(dest), str(webroot))
            except Exception:
                rel = str(Path("uploads") / (safe_subdir or "") / dest_name)
            rel_posix = rel.replace("\\", "/")
            if not rel_posix.startswith("uploads/") and rel_posix != "uploads":
                rel_posix = ("uploads/" + (safe_subdir + "/" if safe_subdir else "") + dest_name).replace("//", "/")

            mime = mimetypes.guess_type(str(dest))[0] or "application/octet-stream"
            size_bytes = int(dest.stat().st_size) if dest.exists() else None
            dates = _pb_file_dates(dest)

            return self._send_json(200, {
                "ok": True,
                "webroot": str(webroot),
                "uploads_dir": str(uploads_dir),
                "subdir": safe_subdir,
                "source_abs": str(src),
                "saved_abs": str(dest),
                "saved_rel": rel_posix,
                "saved_url": "/" + rel_posix.lstrip("/"),
                "size_bytes": size_bytes,
                "mime": mime,
                **dates,
            })

        if path == "/pick":
            mode = (qs.get("mode", ["file"])[0] or "file").lower()
            title = qs.get("title", ["Select"])[0]
            init_path = qs.get("path", [""])[0]
            flt = qs.get("filter", ["All|*.*"])[0]

            if DEBUG_SKIP_FILEPICKER:
                return self._send_json(200, _debug_skip_result("pick", mode=mode, title=title, init_path=init_path, filter=flt))

            if not os.path.isfile(CORE):
                return self._send_json(500, {"ok": False, "error": "filepicker_core_not_found", "core": CORE})

            cmd = [
                sys.executable, CORE,
                "--mode", "folder" if mode.startswith("fold") else "file",
                "--title", title,
                "--path", init_path,
                "--filter", flt,
            ]

            r = run_cmd(cmd, timeout=180)
            picked = (r.get("out") or "").strip()
            ok = (r.get("ok") and picked != "")

            return self._send_json(200, {
                "ok": ok,
                "path": picked,
                "rc": r.get("rc"),
                "err": r.get("err", ""),
            })

        return self._send_json(404, {"ok": False, "error": "not_found", "path": path})

    def do_POST(self):
        u = urlparse(self.path)
        path = u.path
        qs = parse_qs(u.query)

        data = parse_body(self)

        if path == "/closebrowser":
            auth = _auth_or_403(self, qs, data)
            if not auth.get("ok"):
                return self._send_json(403, {"ok": False, **auth})

            if DEBUG_SKIP_CLOSE_BROWSER:
                return self._send_json(200, _debug_skip_result("closebrowser"))

            if _close_browser_from_request is None:
                return self._send_json(500, {"ok": False, "error": "close_browser_import_failed", "detail": _CLOSEBROWSER_IMPORT_ERROR})

            force = str(data.get("force") or "").strip().lower() in ("1", "true", "yes", "y", "on")
            client_ip, client_port = self.client_address[0], int(self.client_address[1])
            ua = self.headers.get("User-Agent") or ""

            result = _close_browser_from_request(
                client_ip=client_ip,
                client_port=client_port,
                server_ip=HOST,
                server_port=PORT,
                user_agent=ua,
                force=force,
            )

            code = 200 if result.get("ok") else (400 if result.get("error") else 500)
            return self._send_json(code, result)

        if path == "/shutdown":
            auth = _auth_or_403(self, qs, data)
            if not auth.get("ok"):
                return self._send_json(403, {"ok": False, **auth})

            self._send_json(200, {"ok": True, "shuttingDown": True, "pid": os.getpid()})
            threading.Thread(target=self.server.shutdown, daemon=True).start()
            return

        if path == "/greenwall/profile":
            if create_greenwall_profile_from_path is None or get_default_profile_dir is None:
                return self._send_json(500, {
                    "ok": False,
                    "error": "greenwall_profile_import_failed",
                    "detail": _GREENWALL_PROFILE_IMPORT_ERROR,
                })

            reference_image_path = str(
                data.get("reference_image_path")
                or data.get("image_path")
                or data.get("path")
                or ""
            ).strip()
            if not reference_image_path:
                return self._send_json(400, {
                    "ok": False,
                    "error": "missing_reference_image_path",
                    "message": "Provide an absolute source image path in 'reference_image_path'.",
                    "need": ["reference_image_path"],
                })

            src = Path(reference_image_path).expanduser()
            if not src.is_absolute():
                return self._send_json(400, {
                    "ok": False,
                    "error": "path_not_absolute",
                    "message": "reference_image_path must be an absolute path.",
                    "reference_image_path": reference_image_path,
                })

            base_dir = Path(HERE).resolve()
            requested_output_dir = str(data.get("output_dir") or "").strip()
            profile_name = str(data.get("profile_name") or "").strip() or None

            if requested_output_dir:
                output_dir = Path(_resolve_under_booth_root(requested_output_dir)).expanduser().resolve()
            else:
                output_dir = get_default_profile_dir(base_dir=base_dir)

            try:
                result = create_greenwall_profile_from_path(
                    image_path=str(src.resolve()),
                    output_dir=output_dir,
                    profile_name=profile_name,
                )
            except FileNotFoundError as e:
                return self._send_json(404, {"ok": False, "error": "reference_image_not_found", "message": str(e)})
            except Exception as e:
                return self._send_json(500, {"ok": False, "error": "greenwall_profile_create_failed", "message": str(e)})

            code = 200 if result.get("ok") else 400
            return self._send_json(code, result)

        if path == "/render/collage":
            auth = _auth_or_403(self, qs, data)
            if not auth.get("ok"):
                return self._send_json(403, {"ok": False, **auth})

            if DEBUG_SKIP_RENDER:
                return self._send_json(200, _debug_skip_result("render_collage"))

            if render_collage_api is None:
                return self._send_json(500, {
                    "ok": False,
                    "error": "render_core_import_failed",
                    "detail": _RENDER_IMPORT_ERROR,
                })

            base_dir = Path(HERE).resolve()
            with _RENDER_LOCK:
                result = render_collage_api(data, base_dir=base_dir)

            code = 200 if result.get("ok") else 400
            return self._send_json(code, result)

        if path in ("/render_from_session", "/render/fromSession"):
            auth = _auth_or_403(self, qs, data)
            if not auth.get("ok"):
                return self._send_json(403, {"ok": False, **auth})

            session_folder = str(data.get("session_folder") or "").strip()

            if DEBUG_SKIP_RENDER:
                debug_result = _debug_skip_result(
                    "render_from_session",
                    session_folder=session_folder,
                )

                try:
                    api_key = str((_SERVER_CFG or {}).get("AuthKey") or "").strip()
                except Exception:
                    api_key = ""

                if session_folder and api_key:
                    from urllib.parse import quote

                    debug_result["preview_url"] = (
                        f"http://{HOST}:{PORT}/preview/session"
                        f"?api_key={quote(api_key)}&session_folder={quote(session_folder)}"
                    )

                return self._send_json(200, debug_result)

            if render_from_session is None:
                return self._send_json(500, {
                    "ok": False,
                    "error": "render_core_import_failed",
                    "detail": _RENDER_IMPORT_ERROR,
                })

            if not session_folder:
                return self._send_json(400, {
                    "ok": False,
                    "error": "missing_session_folder",
                })

            base_dir = Path(HERE).resolve()
            with _RENDER_LOCK:
                result = render_from_session(session_folder, base_dir=base_dir)

            if result.get("ok"):
                try:
                    api_key = str((_SERVER_CFG or {}).get("AuthKey") or "").strip()
                except Exception:
                    api_key = ""

                if api_key:
                    from urllib.parse import quote

                    result["preview_url"] = (
                        f"http://{HOST}:{PORT}/preview/session"
                        f"?api_key={quote(api_key)}&session_folder={quote(session_folder)}"
                    )

            code = 200 if result.get("ok") else 400
            return self._send_json(code, result)

        if path == "/print/default":
            auth = _auth_or_403(self, qs, data)
            if not auth.get("ok"):
                return self._send_json(403, {"ok": False, **auth})

            if print_image is None or bump_print_counter is None:
                return self._send_json(500, {
                    "ok": False,
                    "error": "printer_core_import_failed",
                    "message": _PRINTER_IMPORT_ERROR,
                })

            image_path = str(data.get("image_path") or "").strip()
            event_file = str(data.get("event_file") or "").strip()

            try:
                copies = int(data.get("copies") or 1)
            except Exception:
                copies = 1
            if copies < 1:
                copies = 1
            if copies > 20:
                copies = 20

            printer_name = str(data.get("printerName") or data.get("printer_name") or "").strip() or None

            if not image_path:
                return self._send_json(400, {"ok": False, "error": "missing_image_path"})
            if not event_file:
                return self._send_json(400, {"ok": False, "error": "missing_event_file"})

            image_path_res = _resolve_under_booth_root(image_path)
            event_file_res = _resolve_under_booth_root(event_file)

            with _PRINT_LOCK:
                if DEBUG_SKIP_PRINT:
                    return self._send_json(200, {
                        **_debug_skip_result("print_default", image_path=image_path_res, event_file=event_file_res, copies=copies, printer=printer_name),
                        "printed": False,
                        "counter_updated": False,
                    })

                pr = print_image(image_path_res, copies=copies, printer_name=printer_name)
                if not pr.get("ok"):
                    return self._send_json(400, {"ok": False, "printed": False, **pr})

                if DEBUG_SKIP_PRINT_COUNTER:
                    return self._send_json(200, {
                        "ok": True,
                        "printed": True,
                        "copies": copies,
                        "image_path": image_path_res,
                        "event_file": event_file_res,
                        "printer": printer_name,
                        "print_method": pr.get("method"),
                        "counter_updated": False,
                        "debug": True,
                        "message": "print counter skipped by debug flag",
                    })

                cr = bump_print_counter(event_file_res, inc=copies)
                if not cr.get("ok"):
                    return self._send_json(500, {
                        "ok": False,
                        "printed": True,
                        "copies": copies,
                        "image_path": image_path_res,
                        "event_file": event_file_res,
                        "printer": printer_name,
                        "print": pr,
                        "counter": cr,
                    })

                return self._send_json(200, {
                    "ok": True,
                    "printed": True,
                    "copies": copies,
                    "image_path": image_path_res,
                    "event_file": event_file_res,
                    "printer": printer_name,
                    "print_method": pr.get("method"),
                    "counter_before": cr.get("counter_before"),
                    "counter_after": cr.get("counter_after"),
                    "max_prints": cr.get("max_prints"),
                    "counter_updated": True,
                })

        if path == "/dnp/info":
            printer = str(data.get("printer") or "").strip() or None
            model = str(data.get("model") or "").strip() or None
            if DEBUG_SKIP_DNP_INFO:
                return self._send_json(200, _debug_skip_result("dnp_info", printer=printer, model=model))
            code, result = _dnp_detect_and_info(printer=printer, model=model)
            return self._send_json(code, result)

        if path in ("/service/start", "/service/stop", "/service/restart"):
            auth = _auth_or_403(self, qs, data)
            if not auth.get("ok"):
                return self._send_json(403, {"ok": False, **auth})

            if DEBUG_SKIP_SERVICE_ACTIONS:
                exe = str(data.get("exe") or "").strip()
                return self._send_json(200, _debug_skip_result("service_action", endpoint=path, exe=exe))

            if _SERVER_CFG is None:
                return self._send_json(500, {"ok": False, "error": "server_config_missing", "detail": _SERVER_CFG_ERR})

            exe = str(data.get("exe") or "").strip()
            if not exe:
                return self._send_json(400, {"ok": False, "error": "missing_exe"})

            if path == "/service/start":
                if start_service is None:
                    return self._send_json(500, {"ok": False, "error": "service_core_import_failed", "detail": _SERVICE_IMPORT_ERROR})
                return self._send_json(200, start_service(exe, _SERVER_CFG))

            if path == "/service/stop":
                if stop_service is None:
                    return self._send_json(500, {"ok": False, "error": "service_core_import_failed", "detail": _SERVICE_IMPORT_ERROR})
                return self._send_json(200, stop_service(exe))

            if restart_service is None:
                return self._send_json(500, {"ok": False, "error": "service_core_import_failed", "detail": _SERVICE_IMPORT_ERROR})
            return self._send_json(200, restart_service(exe, _SERVER_CFG))

        if path == "/printers/default":
            if set_default_printer is None:
                return self._send_json(500, {
                    "ok": False,
                    "error": "printer_core_import_failed",
                    "message": _PRINTER_IMPORT_ERROR,
                })
            name = str(data.get("printer") or "").strip()
            return self._send_json(200, set_default_printer(name))

        if path == "/printers/dialog":
            if open_printer_gui is None:
                return self._send_json(500, {
                    "ok": False,
                    "error": "printer_core_import_failed",
                    "message": _PRINTER_IMPORT_ERROR,
                })
            name = str(data.get("printer") or "").strip()
            kind = str(data.get("kind") or "overview").strip()
            return self._send_json(200, open_printer_gui(name if name else None, kind))

        return self._send_json(404, {"ok": False, "error": "not_found", "path": path})

    def log_message(self, format, *args):
        return


# -----------------------------
# Server Start
# -----------------------------
def main():
    print(
        f"Tool server: http://{HOST}:{PORT}\n"
        f"  GET  /ping\n"
        f"  GET  /runtime\n"
        f"  GET  /pick?mode=file|folder&title=...&path=...&filter=...\n"
        f"  GET  /openfolder?path=...&create=1&cooldown=2\n"
        f"  GET  /dnp/info?printer=...&model=...  (min interval from config/config.json, default 60s)\n"
        f"  POST /dnp/info              {{\"printer\":\"...\",\"model\":\"...\"}}  (min interval from config/config.json, default 60s)\n"
        f"  POST /closebrowser         {{\"api_key\":\"...\",\"force\":false}}\n"
        f"  GET  /printers\n"
        f"  POST /printers/default     {{\"printer\":\"...\"}}\n"
        f"  POST /printers/dialog      {{\"printer\":\"...\",\"kind\":\"overview|properties|preferences\"}}\n"
        f"  POST /print/default        {{\"image_path\":\"...\",\"event_file\":\"...\",\"copies\":1}}\n"
        f"  GET  /service/status?exe=...&api_key=...\n"
        f"  POST /service/start        {{\"exe\":\"...\",\"api_key\":\"...\"}}\n"
        f"  POST /service/stop         {{\"exe\":\"...\",\"api_key\":\"...\"}}\n"
        f"  POST /service/restart      {{\"exe\":\"...\",\"api_key\":\"...\"}}\n"
        f"  POST /greenwall/profile    {{\"reference_image_path\":\"C:/.../ref.jpg\"}}\n"
        f"  POST /render/collage       {{...}}\n"
        f"  POST /render_from_session  {{\"session_folder\":\"...\"}}\n"
        f"  GET  /preview/session?api_key=...&session_folder=...\n"
        f"  POST /shutdown             {{\"api_key\":\"...\"}}\n"
        f"Debug flags:\n"
        f"  render={DEBUG_SKIP_RENDER} print={DEBUG_SKIP_PRINT} print_counter={DEBUG_SKIP_PRINT_COUNTER}\n"
        f"  service_actions={DEBUG_SKIP_SERVICE_ACTIONS} close_browser={DEBUG_SKIP_CLOSE_BROWSER}\n"
        f"  openfolder={DEBUG_SKIP_OPENFOLDER} filepicker={DEBUG_SKIP_FILEPICKER} dnp_info={DEBUG_SKIP_DNP_INFO}\n"
        f"Config:\n"
        f"  server_config.json = {SERVER_CFG_PATH}\n"
        f"Core:\n"
        f"  filepicker_core.py = {CORE}\n"
        f"  printer_core.py    = {os.path.join(HERE, 'printer_core.py')}\n"
        f"  service_core.py    = {os.path.join(HERE, 'service_core.py')}\n"
        f"  render_core.py     = {os.path.join(HERE, 'render_core.py')}\n"
        f"  open_folder.py     = {os.path.join(HERE, 'open_folder.py')}\n"
        f"  close_browser.py   = {os.path.join(HERE, 'close_browser.py')}\n"
        f"  main_dnp.py        = {os.path.join(HERE, 'main_dnp.py')}\n"
        f"  common_dnp.py      = {os.path.join(HERE, 'common_dnp.py')}\n"
    )

    print("JSON-Checks:")
    try:
        checks = (_STARTUP_JSON_CHECKS or {}).get("checks", {})
        for name, info in checks.items():
            if not isinstance(info, dict):
                continue
            status = "OK" if info.get("json_ok") else ("OPTIONAL_MISSING" if (not info.get("required") and not info.get("exists")) else "ERROR")
            print(f"  {name}: {status} -> {info.get('path', '')}")
            if info.get("error") and status != "OK":
                print(f"    detail: {info.get('error')}")
    except Exception as e:
        print(f"  startup json check failed: {e}")

    try:
        httpd = ThreadingHTTPServer((HOST, PORT), Handler)
        httpd.serve_forever()
    except OSError as e:
        msg = str(e).lower()
        if "address already in use" in msg or "10048" in msg or "eaddrinuse" in msg:
            print(f"[one-instance] Port {HOST}:{PORT} is already in use -> assume server is running -> exit")
            sys.exit(0)
        raise
    except KeyboardInterrupt:
        print("\nShutting down...")
        sys.exit(0)


if __name__ == "__main__":
    main()
