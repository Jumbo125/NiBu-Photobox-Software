# SPDX-License-Identifier: AGPL-3.0-or-later
# Copyright (c) 2026 Andreas Rottmann
"""
Minimaler multipart/form-data Parser fuer die Upload-Endpunkte
(set_active_template, template_editor_import, template_editor_upload_asset).

python_server.py's parse_body() kennt nur JSON/urlencoded -- die alten PHP
Endpunkte haben $_FILES/$_POST aus multipart/form-data gelesen, das brauchen
wir hier 1:1 nach: Felder werden als Strings, Dateien als {"name","data"}
Dicts zurueckgegeben.
"""

import re
from http.server import BaseHTTPRequestHandler
from typing import Any, Dict, List, Optional, Tuple


def _get_boundary(content_type: str) -> Optional[bytes]:
    m = re.search(r'boundary="?([^";]+)"?', content_type or "")
    if not m:
        return None
    return ("--" + m.group(1)).encode("utf-8")


def _parse_headers(block: bytes) -> Dict[str, str]:
    headers: Dict[str, str] = {}
    for line in block.split(b"\r\n"):
        if b":" not in line:
            continue
        k, v = line.split(b":", 1)
        headers[k.decode("latin-1").strip().lower()] = v.decode("latin-1").strip()
    return headers


def parse_multipart(handler: BaseHTTPRequestHandler) -> Tuple[Dict[str, str], Dict[str, List[Dict[str, Any]]]]:
    """
    Liest den Request-Body (multipart/form-data) vom handler.

    Returns:
      (fields, files)
      fields: {name: value} fuer normale Text-Felder
      files:  {name: [{"name": filename, "data": bytes}, ...]} fuer Datei-Felder
              (Liste, weil ein Feldname wie "zip" mehrfach vorkommen kann,
              z.B. <input type="file" name="zip" multiple>)
    """
    content_type = handler.headers.get("Content-Type", "")
    boundary = _get_boundary(content_type)
    length = int(handler.headers.get("Content-Length", "0") or "0")
    raw = handler.rfile.read(length) if length > 0 else b""

    fields: Dict[str, str] = {}
    files: Dict[str, List[Dict[str, Any]]] = {}

    if not boundary or not raw:
        return fields, files

    parts = raw.split(boundary)
    for part in parts:
        part = part.strip(b"\r\n")
        if not part or part == b"--":
            continue
        if b"\r\n\r\n" not in part:
            continue

        header_block, content = part.split(b"\r\n\r\n", 1)
        content = content.rstrip(b"\r\n")
        headers = _parse_headers(header_block)

        disposition = headers.get("content-disposition", "")
        name_m = re.search(r'name="([^"]*)"', disposition)
        if not name_m:
            continue
        field_name = name_m.group(1)

        filename_m = re.search(r'filename="([^"]*)"', disposition)
        if filename_m is not None:
            filename = filename_m.group(1)
            if filename == "" and not content:
                # leerer <input type="file"> ohne Auswahl -> ueberspringen
                continue
            files.setdefault(field_name, []).append({"name": filename, "data": content})
        else:
            fields[field_name] = content.decode("utf-8", errors="replace")

    return fields, files
