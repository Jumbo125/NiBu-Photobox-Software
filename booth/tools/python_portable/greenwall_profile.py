# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
greenwall_profile.py — Erzeugt Greenwall-Referenzprofile (.npy) aus vorhandenen Bilddateien.

Ziel
----
Dieses Modul ist bewusst vom HTTP-/Server-Code getrennt. Der API-Server reicht nur
einen absoluten Bildpfad und optionale Parameter hinein und erhält ein fertiges Profil plus Metadaten zurück.

Ein Greenwall-Profil ist ein vorberechnetes RGB-Array des *leeren* Hintergrunds in derselben
Kamera-Perspektive wie die späteren Capture-Bilder. Das Profil wird als `.npy` gespeichert, damit
`render_core.py` es schnell laden und für Diff-Keying verwenden kann.

Wichtige Hinweise zur Profil-Erstellung
---------------------------------------
- Das Quellbild sollte die leere Szene ohne Person zeigen.
- Kamera, Perspektive, Ausrichtung und Bildausschnitt sollten zu den späteren Fotos passen.
- Das Profil wird absichtlich nicht auf Collage-Größe gebracht, sondern in Bild-/Kamera-Perspektive
  gespeichert. `render_core.py` skaliert es später passend zur tatsächlichen Arbeitsgröße.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np
from PIL import Image, ImageOps


SAFE_NAME_RE = re.compile(r"[^A-Za-z0-9._-]+")


def _safe_stem(name: str, default: str = "greenwall_profile") -> str:
    raw = Path(str(name or "")).stem or default
    raw = SAFE_NAME_RE.sub("_", raw).strip("._-")
    return raw[:120] or default



def get_default_profile_dir(base_dir: Optional[Path] = None) -> Path:
    """
    Standard-Zielordner für erzeugte Greenwall-Profile.

    Wenn `base_dir` auf den Python-Tool-Server zeigt, landet das Profil typischerweise unter:
      booth/config/greenwall_profiles/
    """
    base = Path(base_dir or Path.cwd()).resolve()

    # Typischer Fall: .../booth/tools/python_portable/python_server.py -> booth als Parent mit config/
    for parent in [base] + list(base.parents):
        if (parent / "config").is_dir():
            return (parent / "config" / "greenwall_profiles").resolve()

    return (base / "greenwall_profiles").resolve()



def _open_source_image_rgb(image_path: Path) -> Image.Image:
    src = Path(image_path).expanduser().resolve()
    if not src.exists() or not src.is_file():
        raise FileNotFoundError(f"Reference image not found: {src}")

    with Image.open(src) as im:
        im = ImageOps.exif_transpose(im)
        rgb = im.convert("RGB")
        return rgb.copy()



def _build_profile_array(img_rgb: Image.Image) -> np.ndarray:
    arr = np.asarray(img_rgb)
    if arr.ndim != 3 or arr.shape[2] != 3:
        raise ValueError(f"Invalid image shape for greenwall profile: {arr.shape}")
    if arr.dtype != np.uint8:
        arr = np.clip(arr, 0, 255).astype(np.uint8)
    return np.ascontiguousarray(arr)



def _choose_profile_path(output_dir: Path, original_filename: str, profile_name: Optional[str]) -> Path:
    """
    Fester Zielpfad für das aktive Greenwall-Profil.

    Wunsch-Verhalten:
    - immer unter config/greenwall_profiles/
    - immer gleicher Dateiname
    - vorhandene Datei wird überschrieben

    `profile_name` und `original_filename` werden absichtlich ignoriert, damit der
    zurückgegebene Pfad für UI und render_config stabil bleibt.
    """
    output_dir.mkdir(parents=True, exist_ok=True)
    return (output_dir / "greenwall_profile.npy").resolve()



def create_greenwall_profile_from_path(
    image_path: str | Path,
    output_dir: Path,
    profile_name: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Erstellt aus einer vorhandenen Bilddatei ein `.npy`-Profil und liefert absolute Pfade zurück.
    """
    out_dir = Path(output_dir).expanduser().resolve()
    src = Path(image_path).expanduser().resolve()
    img_rgb = _open_source_image_rgb(src)
    arr = _build_profile_array(img_rgb)
    profile_path = _choose_profile_path(out_dir, src.name, profile_name)

    np.save(profile_path, arr, allow_pickle=False)

    size_bytes = profile_path.stat().st_size if profile_path.exists() else 0
    h, w = arr.shape[:2]
    return {
        "ok": True,
        "profile_path": str(profile_path),
        "absolute_path": str(profile_path),
        "output_dir": str(out_dir),
        "filename": profile_path.name,
        "source_image_path": str(src),
        "width": int(w),
        "height": int(h),
        "channels": int(arr.shape[2]),
        "dtype": str(arr.dtype),
        "size_bytes": int(size_bytes),
        "message": "Greenwall profile created from source image and overwritten at fixed path",
    }
