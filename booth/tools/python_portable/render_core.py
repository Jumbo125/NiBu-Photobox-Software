"""
render_core.py — Renderer-Modul für den Python Tool-Server

Diese Datei ist der zentrale Renderer für den Booth-/Server-Flow.
Sie kann auf zwei Arten verwendet werden:

1) render_collage_api(payload, base_dir=...)
   - Direkter API-/Payload-Weg.
   - Erwartet alle nötigen Render-Pfade bereits im Payload.
   - Geeignet für Endpunkte oder manuelle Server-Aufrufe.

2) render_from_session(session_folder, base_dir=...)
   - Session-Weg für den normalen Capture-Flow.
   - Liest session.json aus dem Capture-/TMP-Ordner.
   - Nimmt bevorzugt Werte aus session["render"] und baut daraus intern
     ein Payload für render_collage_api(...).
   - Schreibt Status und Ergebnis zurück in dieselbe session.json.

Wichtige Dateien / Datenquellen
-------------------------------
- session.json
  Liegt im Capture-/Session-Ordner.
  Enthält den aktuellen Booth-Status, die aufgenommenen Fotos und unter
  session["render"] die Render-Parameter wie Template, Ausgabeordner,
  Prefix, Dateiendung und optional render_config/render_config_inline.

- render_config.json
  Globale Render-/Greenwall-Konfiguration.
  Standardpfad: booth/config/config/render_config.json
  Sie wird mit DEFAULT_RENDER_CONFIG gemerged und zusätzlich durch
  Legacy-/Alias-Namen normalisiert.

- template.xml
  Beschreibt Größe der finalen Collage, Layer-Reihenfolge, Position,
  Rotation, optionale Greenwall-Flags sowie Layer-Effekte.

- render_time.log
  Wird bei jedem Render-Lauf neu überschrieben.
  Speicherort: im aktuellen input_dir / Session-Ordner.
  Die Datei enthält JSON-Zeilen mit Zeitstempeln für große Render-Schritte,
  damit Performance-Probleme leicht nachvollziehbar sind.

Greenwall-Modi
--------------
- Diff-Modus:
  Vergleicht das aktuelle Foto pixelweise mit einem vorbereiteten
  Referenzprofil (.npy/.npz).
- Chroma-Modus:
  Nutzt Farbton-/Schwellwert-Heuristiken, wenn kein Referenzprofil
  vorhanden ist oder mode='chroma' erzwungen wird.
- mode='auto':
  Bevorzugt Diff, fällt sonst auf Chroma zurück.

Layer-Effekte aus XML
---------------------
- radius="20"                     -> rounded corners
- border="1" border_width="20" border_color="#fff" border_style="solid"
- shadow="1" shadow_color="rgba(0,0,0,0.35)" shadow_x="0" shadow_y="6"
          shadow_blur="18" shadow_spread="0" shadow_preset="custom|1|..."
"""

from __future__ import annotations

import json
import math
import os
import re
import shutil
import sys
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageFilter, ImageOps, ImageDraw
from xml.etree import ElementTree as ET

# Pillow-Kompatibilität (ältere Versionen)
try:
    RES_LANCZOS = Image.Resampling.LANCZOS
    RES_BICUBIC = Image.Resampling.BICUBIC
    RES_BILINEAR = Image.Resampling.BILINEAR
except AttributeError:  # pragma: no cover
    RES_LANCZOS = Image.LANCZOS
    RES_BICUBIC = Image.BICUBIC
    RES_BILINEAR = Image.BILINEAR

# --- Shadow CSS->Pillow Kalibrierung (Durchschnittswerte) ---
# Ziel: Shadow sieht im Mittel ähnlich wie CSS box-shadow aus.
# --- Shadow CSS->Pillow Kalibrierung (Durchschnitt) ---
CSS_SHADOW_BLUR_FACTOR = 1.35
SHADOW_PAD_FACTOR = 4.0
SHADOW_PAD_EXTRA = 6
SHADOW_RENDER_SCALE = 0.7   # 0.5 = halb so groß rendern -> ~4x weniger Pixel fürs Blur

DEFAULT_RENDER_CONFIG: Dict[str, Any] = {
    "output": {
        "format": "png",
        "jpeg_quality": 95,
        "jpeg_subsampling": 0,   # 0=4:4:4, 2=4:2:0
        "jpeg_optimize": True,
        "jpeg_progressive": False,
        "dpi": 300,
    },
    "render": {
        # Default Mode
        "resize_mode": "stretch",  # stretch|cover|contain
        # Hintergrundfarbe für contain (Balken)
        "contain_bg": [0, 0, 0, 0],
        # Arbeitsauflösung für Photo-Layer relativ zur finalen Content-Größe.
        # Wird nur zum Verkleinern verwendet, niemals zum Hochskalieren.
        "photo_work_scale": 1.5,
    },
    "greenwall": {
        "enabled": True,          # Master-Switch zusätzlich zum XML-Flag
        "mode": "auto",           # auto|diff|chroma

        # Vorgefertigtes Referenzprofil für Diff-Keying (.npy/.npz).
        # Wird bevorzugt verwendet, da damit Bildladen/Decodieren pro Render entfällt.
        "ref_profile_path": "",

        # Diff-Key
        "diff_t0": 25,
        "diff_t1": 110,
        "diff_gamma": 0.90,

        # Chroma-Key
        "chroma_delta": 40,
        "chroma_min_g": 100,
        "chroma_t0": 20,
        "chroma_t1": 120,
        "bg_alpha_cap": 20,
        "green_ratio": 0.0,

        # Mask-Postprocessing
        "blur_radius": 0.0,
        "close_iter": 0,
        "spill_suppression": 0.0,

        "write_mask_debug": False,
    },
}


# -----------------------------
# Pfade & Config
# -----------------------------
def get_booth_root() -> Path:
    """
    Ermittelt booth/ robust relativ zur Datei (nicht vom CWD abhängig).
    Sucht nach einem Parent, der "config/" enthält.
    """
    here = Path(__file__).resolve() if "__file__" in globals() else Path(sys.argv[0]).resolve()
    for parent in [here.parent] + list(here.parents):
        if (parent / "config").is_dir():
            return parent
    return here.parent


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def _normalize_greenwall_mode(value: Any, default: str = "auto") -> str:
    """
    Normalisiert den Greenwall-Modus auf einen bekannten Wert.
    Unbekannte Eingaben fallen bewusst auf 'auto' zurück, damit Tippfehler
    in der Config den Render-Lauf nicht unbeabsichtigt deaktivieren.
    """
    mode = str(value or "").strip().lower()
    if mode in ("auto", "diff", "chroma"):
        return mode
    return default


def _normalize_legacy_render_config(cfg: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Normalisiert ältere/alternative Config-Namen auf die aktuell intern genutzten Keys.
    So bleiben bestehende render_config.json-Dateien kompatibel, ohne die Render-Logik
    überall mit Sonderfällen zu belasten.
    """
    out = json.loads(json.dumps(cfg or {}))

    output_cfg = out.setdefault("output", {})
    if "format" in output_cfg and output_cfg["format"] is not None:
        output_cfg["format"] = str(output_cfg["format"]).strip().lower().lstrip(".")

    gw_cfg = out.setdefault("greenwall", {})

    # Vorgefertigtes Referenzprofil bevorzugen: mehrere Schreibweisen zulassen.
    profile_value = None
    for key in ("ref_profile_path", "ref_profile", "profile_path", "profile"):
        val = gw_cfg.get(key)
        if isinstance(val, str) and val.strip():
            profile_value = val.strip()
            break
    if profile_value is not None:
        gw_cfg["ref_profile_path"] = profile_value

    # Greenwall-Modus robust normalisieren.
    gw_cfg["mode"] = _normalize_greenwall_mode(gw_cfg.get("mode", "auto"), default="auto")

    # Legacy-Aliase übernehmen, wenn die neuen Keys fehlen.
    if "diff_t0" not in gw_cfg and "diff_threshold" in gw_cfg:
        try:
            gw_cfg["diff_t0"] = int(float(gw_cfg.get("diff_threshold")))
        except Exception:
            pass
    if "diff_t1" not in gw_cfg and "diff_threshold" in gw_cfg:
        try:
            t0 = int(float(gw_cfg.get("diff_threshold")))
            gw_cfg["diff_t1"] = max(t0 + 1, t0 + 85)
        except Exception:
            pass
    if "chroma_min_g" not in gw_cfg and "green_min" in gw_cfg:
        gw_cfg["chroma_min_g"] = gw_cfg.get("green_min")
    if "blur_radius" not in gw_cfg and "feather" in gw_cfg:
        gw_cfg["blur_radius"] = gw_cfg.get("feather")

    return out


# Pfade & Config
# -----------------------------
def load_render_config(explicit_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Lädt render_config.json, normalisiert Legacy-/Alias-Namen und merged die
    Datei mit DEFAULT_RENDER_CONFIG.

    Wichtig für Außenstehende:
    - Diese Config ist die globale Render-Basis.
    - Werte aus session.json bzw. Payload bestimmen *wo* gerendert wird.
    - render_config.json bestimmt vor allem *wie* gerendert wird.
    """
    booth_root = get_booth_root()
    cfg_path = Path(explicit_path).resolve() if explicit_path else (booth_root / "config" / "config" / "render_config.json")

    if not cfg_path.exists():
        return dict(DEFAULT_RENDER_CONFIG)

    try:
        with cfg_path.open("r", encoding="utf-8-sig") as f:
            user_cfg = json.load(f)
            user_cfg = _normalize_legacy_render_config(user_cfg)
    except Exception as e:
        print(f"Warnung: render_config.json konnte nicht gelesen werden ({cfg_path}): {e}", file=sys.stderr)
        user_cfg = {}

    return deep_merge(DEFAULT_RENDER_CONFIG, user_cfg)


# -----------------------------
# Template Parsing
# -----------------------------
@dataclass
class Layer:
    type: str  # "photo" | "image"
    x: int
    y: int
    w: int
    h: int
    rotation: float
    z: int

    index: Optional[int] = None
    src: Optional[str] = None  # for "image"

    # Style / Effects (optional)
    radius: int = 0

    border: int = 0
    border_color: Any = "#000000"
    border_style: str = "solid"
    border_width: int = 0

    shadow: int = 0
    shadow_preset: str = "custom"  # "custom" | "1" | ...
    shadow_color: Any = "rgba(0,0,0,0.35)"
    shadow_x: int = 0
    shadow_y: int = 6
    shadow_blur: int = 18
    shadow_spread: int = 0


def _basename_from_src(src: str) -> str:
    return os.path.basename(src.replace("\\", "/"))


def _parse_int(value: Optional[str], default: int = 0) -> int:
    try:
        return int(float(value)) if value is not None else default
    except Exception:
        return default


def _parse_float(value: Optional[str], default: float = 0.0) -> float:
    try:
        return float(value) if value is not None else default
    except Exception:
        return default


def _parse_bool(value: Optional[str], default: bool = False) -> bool:
    """
    Robust für XML-Exports:
      - "1"/"0"
      - "true"/"false"
      - "yes"/"no"
      - "on"/"off"
      - Zahlen als String
    """
    if value is None:
        return default
    s = str(value).strip().lower()
    if s in ("1", "true", "yes", "on"):
        return True
    if s in ("0", "false", "no", "off", ""):
        return False
    try:
        return float(s) != 0.0
    except Exception:
        return default


def parse_template_xml(xml_path: Path) -> Tuple[int, int, bool, str, str, List[Layer]]:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    width = _parse_int(root.attrib.get("width"), 0)
    height = _parse_int(root.attrib.get("height"), 0)
    greenwall_flag = root.attrib.get("greenwall", "0").strip().lower() in ("1", "true", "yes", "on")
    greenwall_src = root.attrib.get("greenwall-src", "") or ""
    greenwall_bg_src = root.attrib.get("greenwall-bg", "") or ""

    layers: List[Layer] = []
    for node in root.findall("layer"):
        ltype = (node.attrib.get("type") or "").strip().lower()
        x = _parse_int(node.attrib.get("x"), 0)
        y = _parse_int(node.attrib.get("y"), 0)
        w = _parse_int(node.attrib.get("w"), 0)
        h = _parse_int(node.attrib.get("h"), 0)
        rotation = _parse_float(node.attrib.get("rotation"), 0.0)
        z = _parse_int(node.attrib.get("z"), 0)

        # ---- Style attributes (optional) ----
        radius = _parse_int(node.attrib.get("radius"), 0)

        # border/shadow robust bool
        border = 1 if _parse_bool(node.attrib.get("border"), False) else 0
        border_color = node.attrib.get("border_color", "#000000")
        border_style = (node.attrib.get("border_style") or "solid").strip().lower()
        border_width = _parse_int(node.attrib.get("border_width"), 0)

        shadow = 1 if _parse_bool(node.attrib.get("shadow"), False) else 0
        shadow_preset = str(node.attrib.get("shadow_preset", "custom")).strip()
        shadow_color = node.attrib.get("shadow_color", "rgba(0,0,0,0.35)")
        shadow_x = _parse_int(node.attrib.get("shadow_x"), 0)
        shadow_y = _parse_int(node.attrib.get("shadow_y"), 6)
        shadow_blur = _parse_int(node.attrib.get("shadow_blur"), 18)
        shadow_spread = _parse_int(node.attrib.get("shadow_spread"), 0)

        if ltype == "photo":
            idx = _parse_int(node.attrib.get("index"), 0)
            layers.append(
                Layer(
                    type="photo",
                    x=x, y=y, w=w, h=h,
                    rotation=rotation, z=z,
                    index=idx,
                    radius=radius,
                    border=border, border_color=border_color, border_style=border_style, border_width=border_width,
                    shadow=shadow, shadow_preset=shadow_preset, shadow_color=shadow_color,
                    shadow_x=shadow_x, shadow_y=shadow_y, shadow_blur=shadow_blur, shadow_spread=shadow_spread,
                )
            )
        elif ltype == "image":
            src = node.attrib.get("src") or ""
            layers.append(
                Layer(
                    type="image",
                    x=x, y=y, w=w, h=h,
                    rotation=rotation, z=z,
                    src=src,
                    radius=radius,
                    border=border, border_color=border_color, border_style=border_style, border_width=border_width,
                    shadow=shadow, shadow_preset=shadow_preset, shadow_color=shadow_color,
                    shadow_x=shadow_x, shadow_y=shadow_y, shadow_blur=shadow_blur, shadow_spread=shadow_spread,
                )
            )

    layers.sort(key=lambda L: L.z)
    return width, height, greenwall_flag, greenwall_src, greenwall_bg_src, layers


# -----------------------------
# IO Helpers
# -----------------------------
def open_image_copy(path: Path, mode: Optional[str] = None) -> Image.Image:
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        img = im.copy()
    if mode:
        img = img.convert(mode)
    return img


def next_output_index(output_dir: Path, prefix: str, ext: str) -> int:
    pattern = re.compile(rf"^{re.escape(prefix)}(\d{{6}}){re.escape(ext)}$", re.IGNORECASE)
    max_idx = 0
    if output_dir.exists():
        for f in output_dir.iterdir():
            if not f.is_file():
                continue
            m = pattern.match(f.name)
            if m:
                try:
                    max_idx = max(max_idx, int(m.group(1)))
                except Exception:
                    pass
    return max_idx + 1


# -----------------------------
# Render config helpers (Mode + Bg Color)
# -----------------------------
def _clamp8(x: int) -> int:
    return max(0, min(255, int(x)))


def _parse_rgba(value: Any, default: Tuple[int, int, int, int] = (0, 0, 0, 0)) -> Tuple[int, int, int, int]:
    """
    Akzeptiert:
      - [r,g,b] / [r,g,b,a]
      - "#RRGGBB" / "#RRGGBBAA"
      - "rgb(r,g,b)" / "rgba(r,g,b,a)"  (a kann 0..1 oder 0..255 sein)
      - "r,g,b" / "r,g,b,a"
      - "black"/"white"/"transparent"
    """
    if isinstance(value, (list, tuple)) and 3 <= len(value) <= 4:
        r = _clamp8(value[0]); g = _clamp8(value[1]); b = _clamp8(value[2])
        a = _clamp8(value[3]) if len(value) == 4 else 255
        return (r, g, b, a)

    if isinstance(value, str):
        s = value.strip().lower()

        named = {
            "black": (0, 0, 0, 255),
            "white": (255, 255, 255, 255),
            "transparent": (0, 0, 0, 0),
        }
        if s in named:
            return named[s]

        # #RRGGBB / #RRGGBBAA
        if s.startswith("#"):
            h = s[1:]
            try:
                if len(h) == 6:
                    r = int(h[0:2], 16); g = int(h[2:4], 16); b = int(h[4:6], 16)
                    return (_clamp8(r), _clamp8(g), _clamp8(b), 255)
                if len(h) == 8:
                    r = int(h[0:2], 16); g = int(h[2:4], 16); b = int(h[4:6], 16); a = int(h[6:8], 16)
                    return (_clamp8(r), _clamp8(g), _clamp8(b), _clamp8(a))
            except Exception:
                return default

        # rgb(...) / rgba(...)
        m = re.match(r"^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$", s)
        if m:
            r = float(m.group(1)); g = float(m.group(2)); b = float(m.group(3))
            a_raw = m.group(4)
            if a_raw is None:
                a = 255
            else:
                af = float(a_raw)
                a = int(round(af * 255)) if 0.0 <= af <= 1.0 else int(round(af))
            return (_clamp8(r), _clamp8(g), _clamp8(b), _clamp8(a))

        # "r,g,b" / "r,g,b,a"
        if "," in s:
            parts = [p.strip() for p in s.split(",")]
            if 3 <= len(parts) <= 4:
                try:
                    r = float(parts[0]); g = float(parts[1]); b = float(parts[2])
                    if len(parts) == 4:
                        af = float(parts[3])
                        a = int(round(af * 255)) if 0.0 <= af <= 1.0 else int(round(af))
                    else:
                        a = 255
                    return (_clamp8(r), _clamp8(g), _clamp8(b), _clamp8(a))
                except Exception:
                    return default

    return default


def _normalize_resize_mode(mode: Any, default: str = "stretch") -> str:
    m = str(mode or "").strip().lower()
    if m in ("stretch", "cover", "contain"):
        return m
    return default


def _effective_layer_content_size(layer: Layer) -> Tuple[int, int]:
    bw = int(layer.border_width or 0) if int(layer.border or 0) else 0
    bw = max(0, min(bw, min(layer.w, layer.h) // 2))
    cw = layer.w - 2 * bw if bw > 0 else layer.w
    ch = layer.h - 2 * bw if bw > 0 else layer.h
    return max(1, cw), max(1, ch)


def _prepare_photo_work_image(
    img: Image.Image,
    layer: Layer,
    photo_work_scale: float,
) -> Image.Image:
    """
    Verkleinert Photo-Layer vor der Weiterverarbeitung auf eine sinnvolle
    Arbeitsgröße relativ zur finalen Layer-Content-Größe.

    Regeln:
    - nur downscale, niemals upscale
    - Seitenverhältnis des Quellbilds bleibt erhalten
    - die skalierte Version bleibt groß genug, damit cover/contain/stretch
      danach noch sauber arbeiten können
    """
    try:
        scale = float(photo_work_scale)
    except Exception:
        scale = 1.5

    if scale <= 0:
        scale = 1.5

    cw, ch = _effective_layer_content_size(layer)
    target_w = max(1, int(math.ceil(cw * scale)))
    target_h = max(1, int(math.ceil(ch * scale)))

    src_w, src_h = img.size
    if src_w <= 0 or src_h <= 0:
        return img

    ratio = max(target_w / float(src_w), target_h / float(src_h))

    # Nur verkleinern, niemals hochskalieren
    if ratio >= 1.0:
        return img

    new_w = max(1, int(round(src_w * ratio)))
    new_h = max(1, int(round(src_h * ratio)))

    if new_w >= src_w and new_h >= src_h:
        return img

    return img.resize((new_w, new_h), RES_LANCZOS)


# -----------------------------
# Greenwall profile helpers
# -----------------------------
class ReferenceProfile:
    """
    Hält ein vorberechnetes Referenzprofil im Speicher und liefert für
    angeforderte Zielgrößen gecachte RGB-Arrays als int16.

    Zweck:
    - Das Profil ersetzt das wiederholte Laden/Resizen eines Referenzprofiles.
    - Für den Diff-Modus ist das schneller und ressourcenschonender.
    - Das Profil beschreibt den *leeren* Hintergrund in derselben Kamera-
      Perspektive wie die späteren Capture-Bilder.

    Erwartete Formate:
      - .npy  -> direktes Array (H,W,3) oder (H,W,4)
      - .npz  -> bevorzugt Schlüssel ref_rgb / rgb / image / ref_image
    """

    def __init__(self, rgb_u8: np.ndarray, source_path: Path):
        arr = np.asarray(rgb_u8)
        if arr.ndim == 2:
            arr = np.stack([arr, arr, arr], axis=2)
        if arr.ndim != 3:
            raise ValueError(f"Ungültiges Referenzprofil-Format: ndim={arr.ndim}")
        if arr.shape[2] == 4:
            arr = arr[:, :, :3]
        if arr.shape[2] != 3:
            raise ValueError(f"Ungültige Referenzprofil-Kanäle: shape={arr.shape}")
        if arr.dtype != np.uint8:
            arr = np.clip(arr, 0, 255).astype(np.uint8)

        self.rgb_u8 = np.ascontiguousarray(arr)
        self.source_path = Path(source_path)
        self.cache: Dict[Tuple[int, int], np.ndarray] = {}
        self.cache_hits = 0
        self.cache_misses = 0

    @property
    def size(self) -> Tuple[int, int]:
        h, w = self.rgb_u8.shape[:2]
        return (w, h)

    @classmethod
    def load(cls, path: Path) -> "ReferenceProfile":
        p = Path(path).expanduser().resolve()
        suffix = p.suffix.lower()
        if suffix == ".npy":
            arr = np.load(p, allow_pickle=False)
            return cls(arr, p)

        if suffix == ".npz":
            with np.load(p, allow_pickle=False) as data:
                for key in ("ref_rgb", "rgb", "image", "ref_image"):
                    if key in data:
                        return cls(data[key], p)
                if data.files:
                    return cls(data[data.files[0]], p)
            raise ValueError(f"NPZ-Profil enthält kein verwendbares Array: {p}")

        raise ValueError(f"Nicht unterstütztes Referenzprofil-Format: {p.suffix}")

    def get_rgb_int16(self, size: Tuple[int, int]) -> np.ndarray:
        w = max(1, int(size[0]))
        h = max(1, int(size[1]))
        key = (w, h)
        cached = self.cache.get(key)
        if cached is not None:
            self.cache_hits += 1
            return cached

        self.cache_misses += 1
        if self.size == key:
            arr = self.rgb_u8.astype(np.int16, copy=False)
        else:
            ref = Image.fromarray(self.rgb_u8, mode="RGB").resize((w, h), RES_BILINEAR)
            arr = np.asarray(ref).astype(np.int16)
        self.cache[key] = arr
        return arr


def _resolve_reference_profile_path(profile_value: str, input_dir: Path, template_dir: Path, booth_root: Path) -> Optional[Path]:
    val = str(profile_value or "").strip()
    if not val:
        return None

    raw = Path(val.replace("\\", "/"))
    candidates: List[Path] = []
    if raw.is_absolute():
        candidates.append(raw)
    else:
        candidates.extend([
            input_dir / raw,
            input_dir / "assets" / raw.name,
            template_dir / raw,
            template_dir / "assets" / raw.name,
            booth_root / raw,
        ])

    for cand in candidates:
        try:
            if cand.exists() and cand.is_file():
                return cand.resolve()
        except Exception:
            continue
    return None


# -----------------------------
# Greenwall helpers
# -----------------------------
def _find_greenwall_background(input_dir: Path, greenwall_bg_src: str) -> Optional[Path]:
    search_dirs = [input_dir, input_dir / "assets"]

    def _try_candidate(p: Path) -> Optional[Path]:
        try:
            return p if p.exists() and p.is_file() else None
        except Exception:
            return None

    if greenwall_bg_src.strip():
        rel = Path(greenwall_bg_src.strip().replace("\\", "/"))
        for d in search_dirs:
            cand = _try_candidate(d / rel)
            if cand:
                return cand

        base = _basename_from_src(greenwall_bg_src.strip())
        for d in search_dirs:
            cand2 = _try_candidate(d / base)
            if cand2:
                return cand2

    common = (
        "___greenwall.png", "___greenwall.jpg", "___greenwall.jpeg",
        "___Greenwall.png", "___Greenwall.jpg", "___Greenwall.jpeg",
        "greenwall_bg.png", "greenwall_bg.jpg", "greenwall_bg.jpeg",
        "greenwall.png",
    )
    for name in common:
        for d in search_dirs:
            cand = _try_candidate(d / name)
            if cand:
                return cand

    return None


def _apply_close(alpha_img: Image.Image, iterations: int) -> Image.Image:
    out = alpha_img
    for _ in range(max(0, int(iterations))):
        out = out.filter(ImageFilter.MaxFilter(3))
        out = out.filter(ImageFilter.MinFilter(3))
    return out


def remove_green_background(
    photo_rgba: Image.Image,
    gw_cfg: Dict[str, Any],
    debug_mask_path: Optional[Path] = None,
    ref_profile: Optional[ReferenceProfile] = None,
) -> Image.Image:
    img = photo_rgba.convert("RGBA")
    rgb = img.convert("RGB")
    arr = np.asarray(rgb).astype(np.int16)

    mode = _normalize_greenwall_mode(gw_cfg.get("mode", "auto"), default="auto")
    have_ref = ref_profile is not None

    use_diff = (mode == "diff") or (mode == "auto" and have_ref)
    use_chroma = (mode == "chroma") or (mode == "auto" and not have_ref)

    if mode == "diff" and not have_ref:
        use_diff = False
        use_chroma = True
        print("Warnung: greenwall.mode=diff, aber kein Referenzprofil gefunden -> fallback zu chroma.", file=sys.stderr)

    if use_diff and have_ref:
        ref_arr = ref_profile.get_rgb_int16(rgb.size)
        diff = np.abs(arr - ref_arr).sum(axis=2)  # 0..765

        t0 = int(gw_cfg.get("diff_t0", 25))
        t1 = int(gw_cfg.get("diff_t1", 110))
        gamma = float(gw_cfg.get("diff_gamma", 1.0))

        alpha = (diff - t0) * 255.0 / max(1, (t1 - t0))
        alpha = np.clip(alpha, 0, 255).astype(np.uint8)

        # gamma korrekt auf 0..1 normalisiert anwenden
        if gamma and gamma != 1.0:
            a = alpha.astype(np.float32) / 255.0
            a = np.clip(a, 0.0, 1.0) ** gamma
            alpha = (a * 255.0).clip(0, 255).astype(np.uint8)

        alpha_img = Image.fromarray(alpha, mode="L")

    elif use_chroma:
        r = arr[:, :, 0].astype(np.float32)
        g = arr[:, :, 1].astype(np.float32)
        b = arr[:, :, 2].astype(np.float32)

        delta = float(gw_cfg.get("chroma_delta", 40) or 0)
        min_g = float(gw_cfg.get("chroma_min_g", 100) or 0)
        ratio = float(gw_cfg.get("green_ratio", 0.0) or 0.0)

        is_bg = (g > min_g)
        if delta > 0:
            is_bg = is_bg & (g > (r + delta)) & (g > (b + delta))
        if ratio > 0:
            safe_r = np.maximum(r, 1.0)
            safe_b = np.maximum(b, 1.0)
            is_bg = is_bg & (g >= (safe_r * ratio)) & (g >= (safe_b * ratio))

        greenness = (g - np.maximum(r, b)).astype(np.float32)
        t0 = float(gw_cfg.get("chroma_t0", 20) or 20)
        t1 = float(gw_cfg.get("chroma_t1", 120) or 120)

        a = 255 - np.clip((greenness - t0) * 255.0 / max(1.0, (t1 - t0)), 0, 255)
        alpha = a.astype(np.uint8)

        bg_cap = int(gw_cfg.get("bg_alpha_cap", 20))
        alpha = np.where(is_bg, np.minimum(alpha, bg_cap), alpha).astype(np.uint8)
        alpha_img = Image.fromarray(alpha, mode="L")

    else:
        alpha_img = Image.new("L", rgb.size, 255)

    blur_radius = float(gw_cfg.get("blur_radius", 0.0) or 0.0)
    if blur_radius > 0:
        alpha_img = alpha_img.filter(ImageFilter.GaussianBlur(radius=blur_radius))

    close_iter = int(gw_cfg.get("close_iter", 0) or 0)
    if close_iter > 0:
        alpha_img = _apply_close(alpha_img, close_iter)

    if debug_mask_path is not None:
        try:
            debug_mask_path.parent.mkdir(parents=True, exist_ok=True)
            alpha_img.save(debug_mask_path)
        except Exception as e:
            print(f"Warnung: Konnte Mask-Debug nicht speichern: {e}", file=sys.stderr)

    alpha = np.asarray(alpha_img).astype(np.uint8)

    spill = float(gw_cfg.get("spill_suppression", 0.0) or 0.0)
    if spill > 0:
        spill = max(0.0, min(1.0, spill))
        a = alpha.astype(np.float32) / 255.0
        edge = (alpha > 0) & (alpha < 255)
        reduce = (1.0 - a) * (spill * 60.0)
        g_ch = arr[:, :, 1].astype(np.float32)
        g_ch[edge] = np.clip(g_ch[edge] - reduce[edge], 0, 255)
        arr[:, :, 1] = g_ch.astype(np.int16)

    rgba = np.dstack([arr.astype(np.uint8), alpha])
    return Image.fromarray(rgba, mode="RGBA")


# -----------------------------
# Asset Loading
# -----------------------------
def load_asset_for_layer(layer: Layer, input_dir: Path, template_dir: Path) -> Tuple[Image.Image, Optional[Path]]:
    if layer.type == "photo":
        if layer.index is None:
            raise ValueError("Photo-Layer ohne index.")
        # default: Photo_n.jpg
        filename = f"Photo_{layer.index}.jpg"
        path = input_dir / filename
        if not path.exists():
            for ext in (".jpg", ".jpeg", ".png"):
                p2 = input_dir / f"Photo_{layer.index}{ext}"
                if p2.exists():
                    path = p2
                    break
        if not path.exists():
            raise FileNotFoundError(f"Photo nicht gefunden: Photo_{layer.index}.* (gesucht in {input_dir})")
        return open_image_copy(path), path

    if layer.type == "image":
        if not layer.src:
            raise ValueError("Image-Layer ohne src.")

        rel = Path(layer.src.replace("\\", "/"))
        base = _basename_from_src(layer.src)

        candidates = [
            template_dir / rel,
            template_dir / "assets" / base,
            template_dir / base,
            input_dir / rel,
            input_dir / "assets" / base,
            input_dir / base,
        ]

        for p in candidates:
            if p.exists() and p.is_file():
                return open_image_copy(p), p

        raise FileNotFoundError(
            f"Bild nicht gefunden: {base} (src='{layer.src}') gesucht in {template_dir} und {input_dir}"
        )

    raise ValueError(f"Unbekannter Layer-Typ: {layer.type}")


# -----------------------------
# Rendering helpers
# -----------------------------
def resize_to_box(img: Image.Image, w: int, h: int, mode: str, contain_bg: Tuple[int, int, int, int]) -> Image.Image:
    mode = _normalize_resize_mode(mode, default="stretch")
    rgba = img.convert("RGBA")

    if mode == "cover":
        return ImageOps.fit(rgba, (w, h), method=RES_LANCZOS, centering=(0.5, 0.5))

    if mode == "contain":
        fitted = ImageOps.contain(rgba, (w, h), method=RES_LANCZOS)
        out = Image.new("RGBA", (w, h), contain_bg)  # Balkenfarbe
        ox = (w - fitted.size[0]) // 2
        oy = (h - fitted.size[1]) // 2
        out.alpha_composite(fitted, dest=(ox, oy))
        return out

    # stretch (oder unknown -> stretch)
    return rgba.resize((w, h), RES_LANCZOS)


# ---- Layer styles: radius / border / shadow ----
def _apply_radius_mask(img_rgba: Image.Image, radius: int) -> Image.Image:
    w, h = img_rgba.size
    r = max(0, int(radius or 0))
    if r <= 0:
        return img_rgba
    r = min(r, min(w, h) // 2)

    mask = Image.new("L", (w, h), 0)
    dr = ImageDraw.Draw(mask)
    dr.rounded_rectangle([0, 0, w - 1, h - 1], radius=r, fill=255)

    out = img_rgba.convert("RGBA").copy()
    # Alpha korrekt "multiplizieren", damit vorhandene Transparenz erhalten bleibt
    old_a = out.getchannel("A")
    a = (np.asarray(old_a).astype(np.uint16) * np.asarray(mask).astype(np.uint16) // 255).astype(np.uint8)
    out.putalpha(Image.fromarray(a, mode="L"))
    return out


def _draw_solid_border(img_rgba: Image.Image, radius: int, border_width: int,
                       border_color_rgba: Tuple[int, int, int, int]) -> Image.Image:
    bw = max(0, int(border_width or 0))
    if bw <= 0:
        return img_rgba

    w, h = img_rgba.size
    bw = min(bw, min(w, h) // 2)

    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    dr = ImageDraw.Draw(overlay)

    inset = bw / 2.0
    rect = [inset, inset, (w - 1) - inset, (h - 1) - inset]

    r = max(0, int(radius or 0))
    rr = max(0, r - inset)  # damit Außenradius ≈ radius bleibt

    dr.rounded_rectangle(rect, radius=rr, outline=border_color_rgba, width=bw)

    out = img_rgba.copy()
    out.alpha_composite(overlay)
    return out

def _apply_spread(alpha: Image.Image, spread: int) -> Image.Image:
    s = int(spread or 0)
    if s == 0:
        return alpha
    k = min(2 * abs(s) + 1, 101)  # cap
    if s > 0:
        return alpha.filter(ImageFilter.MaxFilter(k))
    return alpha.filter(ImageFilter.MinFilter(k))


def _make_shadow_layer(
    rot_rgba: Image.Image,
    shadow_color_rgba: Tuple[int, int, int, int],
    blur: float,
    spread: int,
) -> Tuple[Image.Image, int]:
    alpha = rot_rgba.getchannel("A")

    # Downscale-Faktor (für Speed)
    s = float(SHADOW_RENDER_SCALE or 1.0)
    s = max(0.25, min(1.0, s))  # safety

    w, h = rot_rgba.size
    ws = max(1, int(round(w * s)))
    hs = max(1, int(round(h * s)))

    # Alpha runter skalieren (Shadow wird weich, Bilinear passt)
    alpha_s = alpha.resize((ws, hs), resample=RES_BILINEAR)

    # Spread (in skalierten Pixeln)
    spread_s = int(round((spread or 0) * s))
    alpha_s = _apply_spread(alpha_s, spread_s)

    # Blur (CSS->Pillow Faktor + in skalierten Pixeln)
    blur_eff = float(blur or 0.0) * CSS_SHADOW_BLUR_FACTOR * s

    # WICHTIG: Padding VOR dem Blur, sonst Cutoff / bei (0,0) unsichtbar
    pad_s = int(math.ceil(blur_eff * SHADOW_PAD_FACTOR + abs(spread_s))) + SHADOW_PAD_EXTRA

    big = Image.new("L", (ws + 2 * pad_s, hs + 2 * pad_s), 0)
    big.paste(alpha_s, (pad_s, pad_s))

    if blur_eff > 0:
        big = big.filter(ImageFilter.GaussianBlur(radius=blur_eff))

    r, g, b, a0 = shadow_color_rgba
    shadow_s = Image.new("RGBA", big.size, (r, g, b, 0))

    # Alpha der Schattenfarbe (rgba / hex-alpha)
    if a0 < 255:
        arr = np.asarray(big).astype(np.float32)
        arr = (arr * (a0 / 255.0)).clip(0, 255).astype(np.uint8)
        big = Image.fromarray(arr, mode="L")

    shadow_s.putalpha(big)

    # Wieder hochskalieren auf Originalgröße (inkl. Padding)
    pad = int(round(pad_s / s))
    W = w + 2 * pad
    H = h + 2 * pad
    shadow = shadow_s.resize((W, H), resample=RES_BILINEAR)

    return shadow, pad


def _compose_with_shadow(rot_rgba: Image.Image, layer: Layer) -> Image.Image:
    if int(layer.shadow or 0) != 1:
        return rot_rgba

    sc = _parse_rgba(layer.shadow_color, default=(0, 0, 0, 90))
    sx = int(layer.shadow_x or 0)
    sy = int(layer.shadow_y or 0)
    blur = float(layer.shadow_blur or 0)
    spread = int(layer.shadow_spread or 0)

    shadow, pad = _make_shadow_layer(rot_rgba, sc, blur=blur, spread=spread)

    pad_x = pad + abs(sx)
    pad_y = pad + abs(sy)

    out = Image.new(
        "RGBA",
        (rot_rgba.size[0] + 2 * pad_x, rot_rgba.size[1] + 2 * pad_y),
        (0, 0, 0, 0),
    )

    out.alpha_composite(shadow, dest=(pad_x + sx - pad, pad_y + sy - pad))
    out.alpha_composite(rot_rgba, dest=(pad_x, pad_y))
    return out

def _apply_layer_styles(img_rgba: Image.Image, layer: Layer) -> Image.Image:
    out = img_rgba.convert("RGBA")

    # radius
    if int(layer.radius or 0) > 0:
        out = _apply_radius_mask(out, layer.radius)

    # border (aktuell: nur solid)
    if int(layer.border or 0) and int(layer.border_width or 0) > 0:
        if (layer.border_style or "solid") != "solid":
            print(f"Warnung: border_style='{layer.border_style}' noch nicht unterstützt -> fallback 'solid'", file=sys.stderr)
        bc = _parse_rgba(layer.border_color, default=(0, 0, 0, 255))
        out = _draw_solid_border(out, layer.radius, int(layer.border_width), bc)

    return out


def place_layer(
    canvas: Image.Image,
    layer_img: Image.Image,
    layer: Layer,
    resize_mode: str,
    contain_bg: Tuple[int, int, int, int],
) -> None:
    if layer.w <= 0 or layer.h <= 0:
        return

    # --- Border-Box Fix: Border soll NICHT "im Bild" liegen ---
    bw = int(layer.border_width or 0) if int(layer.border or 0) else 0
    bw = max(0, min(bw, min(layer.w, layer.h) // 2))

    # Content-Größe (innen), damit außen Platz für Border bleibt
    cw = layer.w - 2 * bw if bw > 0 else layer.w
    ch = layer.h - 2 * bw if bw > 0 else layer.h
    cw = max(1, cw)
    ch = max(1, ch)

    # 1) resize Content in die "Innenbox"
    content = resize_to_box(layer_img, cw, ch, resize_mode, contain_bg=contain_bg)

    # 2) Content in Outer-Box einsetzen (damit Border nicht im Bild liegt)
    if bw > 0:
        img = Image.new("RGBA", (layer.w, layer.h), (0, 0, 0, 0))
        img.alpha_composite(content, dest=(bw, bw))
    else:
        img = content

    # 3) radius/border auf die Outer-Box anwenden
    img = _apply_layer_styles(img, layer)

    # 4) rotation
    angle = -layer.rotation if layer.rotation else 0.0
    if angle:
        img_rot = img.rotate(angle, resample=RES_BICUBIC, expand=True)
    else:
        img_rot = img

    # 5) shadow NACH rotation
    img_final = _compose_with_shadow(img_rot, layer)

    # 6) Zentrieren auf Layer-Box
    cx = layer.x + layer.w / 2.0
    cy = layer.y + layer.h / 2.0
    px = int(round(cx - img_final.size[0] / 2.0))
    py = int(round(cy - img_final.size[1] / 2.0))

    canvas.alpha_composite(img_final, dest=(px, py))


def save_jpeg(img: Image.Image, out_path: Path, out_cfg: Dict[str, Any]) -> None:
    q = int(out_cfg.get("jpeg_quality", 95))
    subs = int(out_cfg.get("jpeg_subsampling", 0))
    opt = bool(out_cfg.get("jpeg_optimize", True))
    prog = bool(out_cfg.get("jpeg_progressive", False))
    dpi = int(out_cfg.get("dpi", 300))

    save_kwargs = dict(quality=q, subsampling=subs, optimize=opt, progressive=prog, dpi=(dpi, dpi))

    if "A" in img.getbands():
        rgba = img.convert("RGBA")
        bg = Image.new("RGB", rgba.size, (255, 255, 255))
        bg.paste(rgba, mask=rgba.split()[-1])
        bg.save(out_path, "JPEG", **save_kwargs)
    else:
        img.convert("RGB").save(out_path, "JPEG", **save_kwargs)


class RenderProfiler:
    """
    Schreibt render_time.log als JSON-Lines-Datei.

    Speicherort:
    - build_collage(...) legt die Datei immer in input_dir/render_time.log ab.

    Inhalt:
    - Startzeit
    - Kontext (Template, Pfade, vorhandene Fotos)
    - Zeitstempel für große Verarbeitungsschritte
    - Fehler / Ende des Render-Laufs
    """
    def __init__(self, log_path: Path, context: Optional[Dict[str, Any]] = None):
        self.log_path = Path(log_path)
        self.log_path.parent.mkdir(parents=True, exist_ok=True)
        self.started_perf = time.perf_counter()
        self._fh = self.log_path.open("w", encoding="utf-8")
        self.log("render_start")
        if context:
            self.log("context", **context)

    def _now(self) -> str:
        return datetime.now().astimezone().isoformat(timespec="milliseconds")

    def log(self, stage: str, **data: Any) -> None:
        elapsed = time.perf_counter() - self.started_perf
        payload = {"ts": self._now(), "elapsed_s": round(elapsed, 3), "stage": stage}
        payload.update(data)
        self._fh.write(json.dumps(payload, ensure_ascii=False) + "\n")
        self._fh.flush()

    def close(self, stage: str = "render_end", **data: Any) -> None:
        if not self._fh.closed:
            self.log(stage, **data)
            self._fh.close()


# -----------------------------
# Main Collage builder
# -----------------------------
def build_collage(
    template_xml: Path,
    input_dir: Path,
    output_collage: Path,
    output_originals: Path,
    prefix: str,
    out_ext: str,
    cfg: Dict[str, Any],
) -> Dict[str, Any]:
    """
    Führt den eigentlichen Render-Lauf aus.

    input_dir ist der operative Arbeitsordner für den aktuellen Render.
    Dort liegen in der Regel:
    - Photo_1.jpg / Photo_2.jpg / ...
    - session.json (wenn der Session-Weg genutzt wurde)
    - render_time.log (wird hier neu geschrieben)

    Die Funktion rendert Layer für Layer auf die finale Canvas und gibt ein
    Ergebnis-Dict zurück, das später in session.json unter renderResult
    abgelegt werden kann.
    """
    # Performance-Log immer direkt im Session-/Input-Ordner ablegen, damit
    # Log und verarbeitete Fotos am selben Ort liegen. Die Datei wird pro
    # Render-Lauf neu überschrieben.
    profiler = RenderProfiler(
        input_dir / "render_time.log",
        context={
            "template": str(template_xml),
            "input_dir": str(input_dir),
            "output_collage": str(output_collage),
            "output_originals": str(output_originals),
            "prefix": prefix,
            "ext": out_ext,
            "photos_present": sorted(p.name for p in input_dir.glob("Photo_*")),
        },
    )

    try:
        profiler.log("parse_template.start")
        width, height, greenwall_flag, greenwall_src, greenwall_bg_src, layers = parse_template_xml(template_xml)
        profiler.log(
            "parse_template.done",
            width=width,
            height=height,
            layer_count=len(layers),
            xml_greenwall=bool(greenwall_flag),
            xml_greenwall_src=greenwall_src,
            xml_greenwall_bg=greenwall_bg_src,
        )

        if width <= 0 or height <= 0:
            raise ValueError(f"Ungültige Template-Größe: width={width}, height={height}")

        template_dir = template_xml.parent

        output_collage = output_collage.resolve()
        output_originals = output_originals.resolve()
        output_collage.mkdir(parents=True, exist_ok=True)
        output_originals.mkdir(parents=True, exist_ok=True)

        out_cfg = cfg.get("output", {}) or {}
        render_cfg = cfg.get("render", {}) or {}
        gw_cfg = cfg.get("greenwall", {}) or {}

        resize_mode = _normalize_resize_mode(
            render_cfg.get("resize_mode", render_cfg.get("mode", "stretch")),
            default="stretch"
        )
        contain_bg = _parse_rgba(
            render_cfg.get("contain_bg", render_cfg.get("bg_color", [0, 0, 0, 0])),
            default=(0, 0, 0, 0)
        )

        try:
            photo_work_scale = float(render_cfg.get("photo_work_scale", render_cfg.get("photo_scale", 1.5)))
        except Exception:
            photo_work_scale = 1.5
        if photo_work_scale <= 0:
            photo_work_scale = 1.5

        gw_enabled = bool(gw_cfg.get("enabled", True))
        gw_mode = _normalize_greenwall_mode(gw_cfg.get("mode", "auto"), default="auto")
        sw = str(gw_cfg.get("switch", "auto")).strip().lower()
        if sw == "off":
            greenwall_active = False
        elif sw == "on":
            greenwall_active = True and gw_enabled
        else:
            greenwall_active = bool(greenwall_flag) and gw_enabled

        profiler.log(
            "config.effective",
            resize_mode=resize_mode,
            contain_bg=list(contain_bg),
            photo_work_scale=photo_work_scale,
            greenwall_active=bool(greenwall_active),
            greenwall_mode=gw_mode,
            greenwall_ref_profile_cfg=str(gw_cfg.get("ref_profile_path") or ""),
            greenwall_profile_configured=bool(str(gw_cfg.get("ref_profile_path") or "").strip()),
            greenwall_ratio=float(gw_cfg.get("green_ratio", 0.0) or 0.0),
        )

        idx = next_output_index(output_collage, prefix=prefix, ext=out_ext)
        profiler.log("output.index", index=idx)

        ref_profile: Optional[ReferenceProfile] = None
        ref_profile_path: Optional[Path] = None
        if greenwall_active:
            ref_profile_path = _resolve_reference_profile_path(
                str(gw_cfg.get("ref_profile_path") or ""),
                input_dir=input_dir,
                template_dir=template_dir,
                booth_root=get_booth_root(),
            )
            profiler.log(
                "greenwall.reference_profile",
                configured=str(gw_cfg.get("ref_profile_path") or ""),
                path=str(ref_profile_path) if ref_profile_path else "",
                found=bool(ref_profile_path),
            )
            if ref_profile_path is not None:
                try:
                    ref_profile = ReferenceProfile.load(ref_profile_path)
                    profiler.log(
                        "greenwall.reference_profile.loaded",
                        size=list(ref_profile.size),
                        source=str(ref_profile.source_path),
                    )
                except Exception as e:
                    profiler.log("greenwall.reference_profile.error", message=str(e), path=str(ref_profile_path))
                    ref_profile = None
        profiler.log(
            "greenwall.effective",
            enabled=bool(greenwall_active),
            mode=gw_mode,
            profile_used=bool(ref_profile is not None),
            profile_path=str(ref_profile.source_path) if ref_profile is not None else "",
        )
        # greenwall-src bleibt das Ersatz-Hintergrundbild aus dem Template.
        bg_source = greenwall_src or greenwall_bg_src
        greenwall_bg_path = _find_greenwall_background(input_dir, bg_source) if greenwall_active else None
        profiler.log("greenwall.background", path=str(greenwall_bg_path) if greenwall_bg_path else "", found=bool(greenwall_bg_path), source=bg_source)
        greenwall_bg_img = open_image_copy(greenwall_bg_path, "RGB") if greenwall_bg_path else None
        if greenwall_bg_img is not None:
            profiler.log("greenwall.background.loaded", size=list(greenwall_bg_img.size))

        greenwall_out_dir: Optional[Path] = None
        if greenwall_active:
            greenwall_out_dir = output_originals / "original_greenwall"
            greenwall_out_dir.mkdir(parents=True, exist_ok=True)

            if greenwall_bg_img is None:
                print(
                    "Warnung: greenwall aktiv, aber kein Hintergrundbild gefunden. "
                    "Lege das Bild aus greenwall-src im input_dir oder input_dir/assets ab.",
                    file=sys.stderr,
                )

        canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
        used_photo_paths: List[Path] = []
        write_mask_debug = bool(gw_cfg.get("write_mask_debug", False))

        for layer_idx, layer in enumerate(layers, start=1):
            profiler.log(
                "layer.start",
                layer_index=layer_idx,
                layer_type=layer.type,
                z=layer.z,
                box=[layer.x, layer.y, layer.w, layer.h],
                rotation=layer.rotation,
                photo_index=layer.index,
                src=layer.src,
            )

            img, src_path = load_asset_for_layer(layer, input_dir, template_dir)
            profiler.log(
                "layer.asset_loaded",
                layer_index=layer_idx,
                path=str(src_path) if src_path else "",
                size=list(img.size),
            )

            if layer.type == "photo":
                before = img.size
                img = _prepare_photo_work_image(img, layer, photo_work_scale)
                profiler.log(
                    "layer.photo_work_image",
                    layer_index=layer_idx,
                    before_size=list(before),
                    after_size=list(img.size),
                )

            if layer.type == "photo" and src_path is not None:
                used_photo_paths.append(src_path)

            if greenwall_active and layer.type == "photo":
                debug_path = None
                if write_mask_debug and src_path is not None and greenwall_out_dir is not None:
                    debug_path = greenwall_out_dir / f"{prefix}{idx:06d}_{src_path.stem}_mask.png"

                profiler.log("layer.greenwall.start", layer_index=layer_idx, has_profile=bool(ref_profile), has_background=bool(greenwall_bg_img))
                cutout = remove_green_background(
                    img,
                    gw_cfg,
                    debug_mask_path=debug_path,
                    ref_profile=ref_profile,
                )
                profiler.log("layer.greenwall.cutout_done", layer_index=layer_idx, size=list(cutout.size))

                if greenwall_bg_img is not None:
                    bg_rgba = greenwall_bg_img.resize(cutout.size, RES_BILINEAR).convert("RGBA")
                    bg_rgba.alpha_composite(cutout.convert("RGBA"))
                    composed_rgb = bg_rgba.convert("RGB")
                    profiler.log("layer.greenwall.background_composite", layer_index=layer_idx, size=list(composed_rgb.size))

                    if greenwall_out_dir is not None and src_path is not None:
                        try:
                            gw_name = f"{prefix}{idx:06d}_{src_path.stem}_greenwall.jpg"
                            save_jpeg(composed_rgb, greenwall_out_dir / gw_name, out_cfg)
                            profiler.log("layer.greenwall.saved_original", layer_index=layer_idx, filename=gw_name)
                        except Exception as _e:
                            print(f"Warnung: Konnte Greenwall-Kopie nicht speichern ({src_path.name}): {_e}", file=sys.stderr)
                            profiler.log("layer.greenwall.saved_original_failed", layer_index=layer_idx, error=str(_e))

                    img = composed_rgb.convert("RGBA")
                else:
                    img = cutout

            place_layer(
                canvas=canvas,
                layer_img=img,
                layer=layer,
                resize_mode=resize_mode,
                contain_bg=contain_bg,
            )
            profiler.log("layer.placed", layer_index=layer_idx)

        out_name = f"{prefix}{idx:06d}{out_ext}"
        out_path = output_collage / out_name

        profiler.log("output.save.start", path=str(out_path), canvas_size=list(canvas.size))
        if out_ext.lower() in (".jpg", ".jpeg"):
            save_jpeg(canvas, out_path, out_cfg)
        else:
            canvas.save(out_path)
        profiler.log("output.save.done", path=str(out_path), exists=bool(out_path.exists()))

        copied: List[str] = []
        for p in used_photo_paths:
            dest_name = f"{prefix}{idx:06d}_{p.name}"
            shutil.copy2(p, output_originals / dest_name)
            copied.append(dest_name)
            profiler.log("output.original_copied", src=str(p), dest=str(output_originals / dest_name))

        result = {
            "ok": True,
            "index": idx,
            "output_path": str(out_path),
            "output_name": out_name,
            "template": str(template_xml),
            "input_dir": str(input_dir),
            "output_collage": str(output_collage),
            "output_originals": str(output_originals),
            "greenwall_active": bool(greenwall_active),
            "greenwall_ref_profile": str(ref_profile.source_path) if ref_profile is not None else "",
            "greenwall_bg": str(greenwall_bg_path) if greenwall_bg_path else "",
            "used_photos": [str(p) for p in used_photo_paths],
            "copied_originals": copied,
            "resize_mode": resize_mode,
            "contain_bg": list(contain_bg),
            "photo_work_scale": photo_work_scale,
            "effective_greenwall_cfg": {
                "enabled": gw_enabled,
                "switch": sw,
                "mode": gw_mode,
                "ref_profile_path": str(gw_cfg.get("ref_profile_path") or ""),
                "diff_t0": gw_cfg.get("diff_t0"),
                "diff_t1": gw_cfg.get("diff_t1"),
                "diff_gamma": gw_cfg.get("diff_gamma"),
                "chroma_delta": gw_cfg.get("chroma_delta"),
                "chroma_min_g": gw_cfg.get("chroma_min_g"),
                "chroma_t0": gw_cfg.get("chroma_t0"),
                "chroma_t1": gw_cfg.get("chroma_t1"),
                "bg_alpha_cap": gw_cfg.get("bg_alpha_cap"),
                "green_ratio": gw_cfg.get("green_ratio"),
                "blur_radius": gw_cfg.get("blur_radius"),
                "close_iter": gw_cfg.get("close_iter"),
                "spill_suppression": gw_cfg.get("spill_suppression"),
                "write_mask_debug": gw_cfg.get("write_mask_debug"),
            },
            "render_time_log": str((input_dir / "render_time.log").resolve()),
        }
        profiler.close("render_success", output_path=str(out_path))
        return result

    except Exception as e:
        profiler.log("render_exception", error=str(e))
        profiler.close("render_failed", error=str(e))
        raise


# -----------------------------
# API Wrapper für Server
# -----------------------------
def _resolve_path(p: str, base_dir: Optional[Path]) -> Path:
    pp = Path(p)
    if not pp.is_absolute():
        if base_dir is None:
            base_dir = Path.cwd()
        pp = (base_dir / pp)
    return pp.resolve()


def render_collage_api(payload: Dict[str, Any], base_dir: Optional[Path] = None) -> Dict[str, Any]:
    """
    Direkter API-Einstieg für den Renderer.

    Dieser Weg wird verwendet, wenn der Aufrufer bereits alle Render-Pfade
    kennt und kein session.json-basierter Booth-Flow nötig ist.

    Erwartet JSON wie:
    {
      "template": ".../template.xml",
      "input_dir": "...",
      "output_collage": "...",
      "output_originals": "...",
      "prefix": "collage_",
      "ext": ".png",
      "render_config": null | "path/to/render_config.json",
      "render_config_inline": {
         "render": { "resize_mode": "contain", "contain_bg": "#000000" }
      }
    }

    Erweiterung:
      - gibt zusätzlich Debug/Info zurück:
        - render_config_path (absolut)
        - render_config_exists
        - render_config_source
        - render_config_inline_used
        - effective_render_cfg (aus cfg["render"])
    """
    try:
        template = str(payload.get("template") or "").strip()
        input_dir = str(payload.get("input_dir") or "").strip()
        output_collage = str(payload.get("output_collage") or "").strip()
        output_originals = str(payload.get("output_originals") or "").strip()

        if not template or not input_dir or not output_collage or not output_originals:
            return {
                "ok": False,
                "error": "missing_params",
                "need": ["template", "input_dir", "output_collage", "output_originals"]
            }

        prefix = str(payload.get("prefix") or "collage_")
        payload_ext = str(payload.get("ext") or "").strip()

        booth_root = get_booth_root()

        # -----------------------------
        # Config laden + Pfad-Info sammeln
        # -----------------------------
        render_config = payload.get("render_config")
        if isinstance(render_config, str) and render_config.strip():
            cfg_path_used = Path(render_config).expanduser().resolve()
            cfg_source = "payload.render_config"
            cfg = load_render_config(str(cfg_path_used))
        else:
            cfg_path_used = (booth_root / "config" / "config" / "render_config.json").resolve()
            cfg_source = "default booth/config/render_config.json"
            cfg = load_render_config(None)

        # Inline-Overrides aus Payload
        inline = payload.get("render_config_inline")
        inline_used = bool(isinstance(inline, dict) and inline)
        if inline_used:
            cfg = deep_merge(cfg, _normalize_legacy_render_config(inline))

        ext = payload_ext
        if not ext:
            ext = str((cfg.get("output") or {}).get("format") or ".png").strip()
        if ext and not ext.startswith("."):
            ext = "." + ext
        if not ext:
            ext = ".png"

        # -----------------------------
        # Pfade auflösen
        # -----------------------------
        template_xml = _resolve_path(template, base_dir)
        input_dir_p = _resolve_path(input_dir, base_dir)
        output_collage_p = _resolve_path(output_collage, base_dir)
        output_originals_p = _resolve_path(output_originals, base_dir)

        if not template_xml.exists():
            return {"ok": False, "error": "template_not_found", "template": str(template_xml)}
        if not input_dir_p.exists() or not input_dir_p.is_dir():
            return {"ok": False, "error": "input_dir_invalid", "input_dir": str(input_dir_p)}

        # -----------------------------
        # Rendern
        # -----------------------------
        res = build_collage(
            template_xml=template_xml,
            input_dir=input_dir_p,
            output_collage=output_collage_p,
            output_originals=output_originals_p,
            prefix=prefix,
            out_ext=ext,
            cfg=cfg,
        )

        # -----------------------------
        # Output erweitern (Debug)
        # -----------------------------
        if isinstance(res, dict):
            res["render_config_path"] = str(cfg_path_used)
            res["render_config_exists"] = bool(cfg_path_used.exists())
            res["render_config_source"] = cfg_source
            res["render_config_inline_used"] = inline_used
            res["effective_render_cfg"] = (cfg.get("render") or {})
            res["effective_output_cfg"] = (cfg.get("output") or {})
            # effective_greenwall_cfg wird bereits in build_collage(...) mit den
            # tatsächlich genutzten Werten und Alias-Auflösungen zurückgegeben.

        return res

    except Exception as e:
        return {"ok": False, "error": "exception", "message": str(e)}


# -----------------------------
# session.json helpers (Snapshot)
# -----------------------------
def _load_session_json(folder: Path) -> Optional[Dict[str, Any]]:
    f = folder / "session.json"
    if not f.exists():
        return None
    try:
        with f.open("r", encoding="utf-8-sig") as fh:
            return json.load(fh)
    except Exception as e:
        print(f"[render_core] Warnung: session.json konnte nicht gelesen werden: {e}", file=sys.stderr)
        return None


def _write_session_json(folder: Path, data: Dict[str, Any]) -> None:
    try:
        folder.mkdir(parents=True, exist_ok=True)
        tmp = folder / "session.json.tmp"
        out = folder / "session.json"
        data["updatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        with tmp.open("w", encoding="utf-8-sig") as fh:
            json.dump(data, fh, indent=2, ensure_ascii=False)
        tmp.replace(out)
    except Exception as e:
        print(f"[render_core] Warnung: session.json konnte nicht geschrieben werden: {e}", file=sys.stderr)


def _find_template_xml(booth_root: Path) -> Optional[Path]:
    """
    Fallback-Suche nach template.xml.
    Für deterministisches Rendern: template-Pfad in session.json unter session.render.template setzen!
    """
    candidates = [
        booth_root / "template.xml",
        booth_root / "templates" / "template.xml",
        booth_root / "templates" / "current" / "template.xml",
        booth_root / "templates" / "active" / "template.xml",
    ]
    for c in candidates:
        if c.exists() and c.is_file():
            return c

    tdir = booth_root / "templates"
    if tdir.exists():
        for p in tdir.rglob("template.xml"):
            if p.is_file():
                return p

    for p in booth_root.rglob("template.xml"):
        if p.is_file():
            return p

    return None


def render_from_session(session_folder: str | Path, base_dir: Optional[Path] = None) -> Dict[str, Any]:
    """
    Session-basierter Renderer für den normalen Capture-Flow.

    Erwartet einen Capture-/TMP-Ordner, in dem session.json liegt.
    Der Ablauf ist:
    1. session.json laden
    2. Status auf RENDERING setzen
    3. session["render"] bevorzugt auslesen
    4. daraus ein internes Payload für render_collage_api(...) bauen
    5. Rendering ausführen
    6. renderResult / Fehler und finalen Status zurück in session.json schreiben

    Wichtige Felder in session.json:
    - session["render"]["template"]
    - session["render"]["output_collage"]
    - session["render"]["output_originals"]
    - session["render"]["prefix"]
    - session["render"]["ext"]
    - session["render"]["render_config"]
    - session["render"]["render_config_inline"]

    Deterministisch bedeutet hier: Wenn session["render"] Werte gesetzt sind,
    werden diese bevorzugt und nur bei Bedarf durch Fallbacks ergänzt.
    """
    folder = Path(session_folder).resolve()
    session = _load_session_json(folder)
    if not session:
        return {"ok": False, "error": "session_not_found", "folder": str(folder)}

    booth_root = base_dir.resolve() if isinstance(base_dir, Path) else get_booth_root()

    try:
        session["status"] = "RENDERING"
        _write_session_json(folder, session)

        # session["render"] ist die fachliche Verbindung zwischen Capture-Flow
        # und Renderer. Hier stehen Template, Output-Ordner, Prefix, Endung und
        # optionale Render-Config-Overrides für genau diese Session.
        render = session.get("render") if isinstance(session.get("render"), dict) else {}

        # Template: bevorzugt aus session.render.template, sonst Fallback scan
        template = str(render.get("template") or "").strip()
        if not template:
            t = _find_template_xml(booth_root)
            if not t:
                session["status"] = "ERROR"
                session["error"] = {"code": "TEMPLATE_NOT_FOUND", "message": "template.xml nicht gefunden"}
                _write_session_json(folder, session)
                return {"ok": False, "error": "template_not_found"}
            template = str(t)

        # Outputs: aus session.render oder eventPath fallback
        event_path = str(session.get("eventPath") or "").strip()
        if not event_path:
            event_path = str(folder)

        output_collage = str(render.get("output_collage") or (Path(event_path) / "final"))
        output_originals = str(render.get("output_originals") or (Path(event_path) / "original_copies"))

        prefix = str(render.get("prefix") or "collage_")
        ext = str(render.get("ext") or "").strip()
        if ext and not ext.startswith("."):
            ext = "." + ext

        payload: Dict[str, Any] = {
            "template": template,
            "input_dir": str(folder),
            "output_collage": output_collage,
            "output_originals": output_originals,
            "prefix": prefix,
        }
        if ext:
            payload["ext"] = ext

        # Optional: render_config file path
        rc = render.get("render_config")
        if isinstance(rc, str) and rc.strip():
            payload["render_config"] = rc.strip()

        # Optional: Inline overrides (greenwall etc.)
        inline = render.get("render_config_inline")
        if inline is None:
            inline = session.get("renderConfigInline")
        if isinstance(inline, dict) and inline:
            payload["render_config_inline"] = inline

        res = render_collage_api(payload, base_dir=booth_root)

        if res.get("ok"):
            session["status"] = "DONE"
            session["renderResult"] = res
        else:
            session["status"] = "ERROR"
            session["error"] = res

        _write_session_json(folder, session)
        return res

    except Exception as e:
        session["status"] = "ERROR"
        session["error"] = {"code": "EXCEPTION", "message": str(e)}
        _write_session_json(folder, session)
        return {"ok": False, "error": "exception", "message": str(e)}
