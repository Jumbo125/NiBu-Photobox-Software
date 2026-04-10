# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Renderer (Photobooth)

- Liest eine Template-XML (width/height, greenwall, greenwall-src, greenwall-bg, layer-Definitionen).
- Lädt Photos "Photo_n.jpg" aus input_dir sowie Bild-Assets aus Template-Ordner und/oder input_dir (assets/).
- Optional: Greenwall aktiv -> Hintergrund aus Photos entfernen (Diff gegen Referenz oder Chroma-Key).
- Sortiert nach z und rendert mit Größe, Rotation, Position.
- Speichert das fertige Bild mit fortlaufender Nummerierung in --output_collage.
- Kopiert verwendete Original-Photos nach --output_originals (mit Präfix der Collage-Nummer).
- Liest Qualitäts-/Greenwall-Tuning aus booth/config/render_config.json (robust relativ zur Script-Datei).

Beispiel:
  python xxx.py --template booth/templates/demo/template.xml ^
    --input_dir booth/photos/original ^
    --output_collage booth/photos/final ^
    --output_originals booth/photos/original_copies ^
    --ext .jpg

Optional:
  --render_config booth/config/render_config.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from PIL import Image, ImageFilter, ImageOps
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


DEFAULT_RENDER_CONFIG: Dict[str, Any] = {
    "output": {
        # Nur relevant, wenn du als JPG speicherst (final und greenwall-originale)
        "jpeg_quality": 95,
        "jpeg_subsampling": 0,   # 0=4:4:4, 2=4:2:0
        "jpeg_optimize": True,
        "jpeg_progressive": False,
        "dpi": 300,
    },
    "render": {
        # resize_mode: "stretch" (wie bisher), "cover" (fit+crop), "contain" (fit+letterbox)
        "resize_mode": "stretch",
    },
    "greenwall": {
        # Globaler Master-Switch zusätzlich zum XML-Flag
        "enabled": True,
        # "auto" nutzt diff wenn ref vorhanden, sonst chroma
        "mode": "auto",  # auto|diff|chroma

        # Diff-Key (Foto vs. Referenz)
        "diff_t0": 25,
        "diff_t1": 110,
        "diff_gamma": 0.90,  # <1 macht Kante etwas weicher

        # Chroma-Key
        "chroma_delta": 40,   # G muss > R+delta und > B+delta
        "chroma_min_g": 100,  # Mindest-Grün
        "chroma_t0": 20,      # greenness start background
        "chroma_t1": 120,     # greenness fully background
        "bg_alpha_cap": 20,   # Hintergrundpixel werden max so "sichtbar" gelassen

        # Mask-Postprocessing
        "blur_radius": 0.0,   # z.B. 1.5
        "close_iter": 0,      # 0..2 (kleine Löcher schließen)
        "spill_suppression": 0.0,  # 0..1 (reduziert grünen Rand minimal)

        # Debug
        "write_mask_debug": False,
    },
}


# -----------------------------
# Pfade & Config
# -----------------------------
def get_booth_root() -> Path:
    """
    Ermittelt booth/ robust relativ zur Script-Datei (nicht vom CWD abhängig).
    Erwartet typischerweise: booth/tools/render/xxx.py

    Falls die Struktur anders ist, wird nach oben nach einem Ordner gesucht,
    der "config/" enthält.
    """
    here = Path(__file__).resolve() if "__file__" in globals() else Path(sys.argv[0]).resolve()

    # Normalfall: booth/tools/render/xxx.py -> parents[2] = booth
    if len(here.parents) >= 3:
        candidate = here.parents[2]
        if (candidate / "config").is_dir():
            return candidate

    # Fallback: nach oben suchen
    for parent in here.parents:
        if (parent / "config").is_dir():
            return parent

    # Letzter Fallback: Script-Ordner
    return here.parent


def deep_merge(base: Dict[str, Any], override: Dict[str, Any]) -> Dict[str, Any]:
    """Recursives dict-merge: override überschreibt base."""
    out = dict(base)
    for k, v in (override or {}).items():
        if isinstance(v, dict) and isinstance(out.get(k), dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = v
    return out


def load_render_config(explicit_path: Optional[str] = None) -> Dict[str, Any]:
    booth_root = get_booth_root()
    cfg_path = Path(explicit_path).resolve() if explicit_path else (booth_root / "config" / "render_config.json")

    if not cfg_path.exists():
        return dict(DEFAULT_RENDER_CONFIG)

    try:
        with cfg_path.open("r", encoding="utf-8") as f:
            user_cfg = json.load(f)
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


def parse_template_xml(xml_path: Path) -> Tuple[int, int, bool, str, str, List[Layer]]:
    tree = ET.parse(xml_path)
    root = tree.getroot()

    width = _parse_int(root.attrib.get("width"), 0)
    height = _parse_int(root.attrib.get("height"), 0)
    greenwall_flag = root.attrib.get("greenwall", "0").strip() in ("1", "true", "True", "yes", "YES")
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

        if ltype == "photo":
            idx = _parse_int(node.attrib.get("index"), 0)
            layers.append(Layer(type="photo", x=x, y=y, w=w, h=h, rotation=rotation, z=z, index=idx))
        elif ltype == "image":
            src = node.attrib.get("src") or ""
            layers.append(Layer(type="image", x=x, y=y, w=w, h=h, rotation=rotation, z=z, src=src))
        else:
            continue

    layers.sort(key=lambda L: L.z)
    return width, height, greenwall_flag, greenwall_src, greenwall_bg_src, layers


# -----------------------------
# IO Helpers
# -----------------------------
def open_image_copy(path: Path, mode: Optional[str] = None) -> Image.Image:
    """
    Lädt ein Bild:
    - exif_transpose (Kamera-EXIF Orientation)
    - copy() um Windows File-Locks zu vermeiden
    - optional convert(mode)
    """
    with Image.open(path) as im:
        im = ImageOps.exif_transpose(im)
        img = im.copy()
    if mode:
        img = img.convert(mode)
    return img


def next_output_index(output_dir: Path, prefix: str, ext: str) -> int:
    """
    Findet nächsten freien Index anhand existierender Dateien: prefix + 6-stellige Nummer + ext.
    Hinweis: nicht parallel-sicher (wenn du parallel renderst -> Lock/UUID verwenden).
    """
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
# Greenwall helpers
# -----------------------------
def _find_greenwall_reference(input_dir: Path, greenwall_src: str) -> Optional[Path]:
    # 1) If greenwall-src present, try basename from that
    if greenwall_src.strip():
        candidate = input_dir / _basename_from_src(greenwall_src.strip())
        if candidate.exists():
            return candidate
        cand2 = input_dir / "assets" / _basename_from_src(greenwall_src.strip())
        if cand2.exists():
            return cand2

    # 2) Otherwise try common filenames
    for name in ("greenwall.png", "greenwall.jpg", "greenwall.jpeg", "Greenwall.png", "Greenwall.jpg", "Greenwall.jpeg"):
        candidate = input_dir / name
        if candidate.exists():
            return candidate
        cand2 = input_dir / "assets" / name
        if cand2.exists():
            return cand2

    # 3) Last resort: any file named greenwall.*
    for d in (input_dir, input_dir / "assets"):
        if not d.exists():
            continue
        for p in d.iterdir():
            if p.is_file() and p.stem.lower() == "greenwall" and p.suffix.lower() in (".png", ".jpg", ".jpeg"):
                return p

    return None


def _find_greenwall_background(input_dir: Path, greenwall_bg_src: str) -> Optional[Path]:
    search_dirs = [input_dir, input_dir / "assets"]

    def _try_candidate(p: Path) -> Optional[Path]:
        try:
            return p if p.exists() and p.is_file() else None
        except Exception:
            return None

    # 1) explicit from XML
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

    # 2) common names
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
    # Simple morphological close: MaxFilter then MinFilter
    out = alpha_img
    for _ in range(max(0, int(iterations))):
        out = out.filter(ImageFilter.MaxFilter(3))
        out = out.filter(ImageFilter.MinFilter(3))
    return out


def remove_green_background(
    photo_rgba: Image.Image,
    ref_bg_rgb: Optional[Image.Image],
    gw_cfg: Dict[str, Any],
    debug_mask_path: Optional[Path] = None,
) -> Image.Image:
    """
    Ergebnis: RGBA mit Alpha. Parameter kommen aus gw_cfg.
    """
    # Ensure RGBA
    img = photo_rgba.convert("RGBA")
    rgb = img.convert("RGB")
    arr = np.asarray(rgb).astype(np.int16)  # (H,W,3)

    mode = str(gw_cfg.get("mode", "auto")).strip().lower()
    have_ref = ref_bg_rgb is not None

    use_diff = (mode == "diff") or (mode == "auto" and have_ref)
    use_chroma = (mode == "chroma") or (mode == "auto" and not have_ref)

    if mode == "diff" and not have_ref:
        # Fallback
        use_diff = False
        use_chroma = True
        print("Warnung: greenwall.mode=diff, aber kein Referenzbild gefunden -> fallback zu chroma.", file=sys.stderr)

    if use_diff and ref_bg_rgb is not None:
        ref = ref_bg_rgb.convert("RGB").resize(rgb.size, RES_BILINEAR)
        ref_arr = np.asarray(ref).astype(np.int16)
        diff = np.abs(arr - ref_arr).sum(axis=2)  # 0..765

        t0 = int(gw_cfg.get("diff_t0", 25))
        t1 = int(gw_cfg.get("diff_t1", 110))
        gamma = float(gw_cfg.get("diff_gamma", 0.90))

        alpha = (diff - t0) * 255.0 / max(1, (t1 - t0))
        alpha = np.clip(alpha, 0, 255).astype(np.uint8)

        if gamma and gamma != 1.0:
            alpha = (alpha.astype(np.float32) ** gamma).clip(0, 255).astype(np.uint8)

        alpha_img = Image.fromarray(alpha, mode="L")

    elif use_chroma:
        r = arr[:, :, 0]
        g = arr[:, :, 1]
        b = arr[:, :, 2]

        delta = int(gw_cfg.get("chroma_delta", 40))
        min_g = int(gw_cfg.get("chroma_min_g", 100))
        is_bg = (g > (r + delta)) & (g > (b + delta)) & (g > min_g)

        greenness = (g - np.maximum(r, b)).astype(np.int16)
        t0 = int(gw_cfg.get("chroma_t0", 20))
        t1 = int(gw_cfg.get("chroma_t1", 120))

        a = 255 - np.clip((greenness - t0) * 255.0 / max(1, (t1 - t0)), 0, 255)
        alpha = a.astype(np.uint8)

        bg_cap = int(gw_cfg.get("bg_alpha_cap", 20))
        alpha = np.where(is_bg, np.minimum(alpha, bg_cap), alpha).astype(np.uint8)
        alpha_img = Image.fromarray(alpha, mode="L")

    else:
        # Should not happen; keep fully opaque
        alpha_img = Image.new("L", rgb.size, 255)

    # Postprocess mask (blur + close)
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

    # Optional spill suppression (simple): reduce green channel on semi-transparent pixels
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
    """
    Returns (image, source_path_if_any).
    - Photo: aus input_dir
    - Image: zuerst template_dir, dann input_dir (inkl. assets/)
    """
    if layer.type == "photo":
        if layer.index is None:
            raise ValueError("Photo-Layer ohne index.")
        filename = f"Photo_{layer.index}.jpg"
        path = input_dir / filename
        if not path.exists():
            # fallback: any extension
            for ext in (".jpg", ".jpeg", ".png"):
                p2 = input_dir / f"Photo_{layer.index}{ext}"
                if p2.exists():
                    path = p2
                    break
        if not path.exists():
            raise FileNotFoundError(f"Photo nicht gefunden: {filename} (gesucht in {input_dir})")
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
            f"Bild nicht gefunden: {base} (aus src='{layer.src}') "
            f"gesucht in {template_dir} und {input_dir}"
        )

    raise ValueError(f"Unbekannter Layer-Typ: {layer.type}")


# -----------------------------
# Rendering helpers
# -----------------------------
def resize_to_box(img: Image.Image, w: int, h: int, mode: str) -> Image.Image:
    mode = (mode or "stretch").strip().lower()
    rgba = img.convert("RGBA")

    if mode == "cover":
        return ImageOps.fit(rgba, (w, h), method=RES_LANCZOS, centering=(0.5, 0.5))

    if mode == "contain":
        fitted = ImageOps.contain(rgba, (w, h), method=RES_LANCZOS)
        out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ox = (w - fitted.size[0]) // 2
        oy = (h - fitted.size[1]) // 2
        out.alpha_composite(fitted, dest=(ox, oy))
        return out

    return rgba.resize((w, h), RES_LANCZOS)


def place_layer(
    canvas: Image.Image,
    layer_img: Image.Image,
    x: int,
    y: int,
    w: int,
    h: int,
    rotation_deg: float,
    resize_mode: str,
) -> None:
    if w <= 0 or h <= 0:
        return

    img = resize_to_box(layer_img, w, h, resize_mode)

    angle = -rotation_deg if rotation_deg else 0.0
    if angle:
        img_rot = img.rotate(angle, resample=RES_BICUBIC, expand=True)
    else:
        img_rot = img

    cx = x + w / 2.0
    cy = y + h / 2.0
    px = int(round(cx - img_rot.size[0] / 2.0))
    py = int(round(cy - img_rot.size[1] / 2.0))

    canvas.alpha_composite(img_rot, dest=(px, py))


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
) -> Path:
    width, height, greenwall_flag, greenwall_src, greenwall_bg_src, layers = parse_template_xml(template_xml)

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

    resize_mode = str(render_cfg.get("resize_mode", "stretch"))

    sw = str(gw_cfg.get("switch", "auto")).lower()
    if sw == "off":
        greenwall_active = False
    elif sw == "on":
        greenwall_active = True
    else:
        greenwall_active = bool(greenwall_flag)

    idx = next_output_index(output_collage, prefix=prefix, ext=out_ext)

    ref_bg_path = _find_greenwall_reference(input_dir, greenwall_src) if greenwall_active else None
    ref_bg_img = open_image_copy(ref_bg_path, "RGB") if ref_bg_path else None

    greenwall_bg_path = _find_greenwall_background(input_dir, greenwall_bg_src) if greenwall_active else None
    greenwall_bg_img = open_image_copy(greenwall_bg_path, "RGB") if greenwall_bg_path else None

    greenwall_out_dir: Optional[Path] = None
    if greenwall_active:
        greenwall_out_dir = output_originals / "original_greenwall"
        greenwall_out_dir.mkdir(parents=True, exist_ok=True)

        if greenwall_bg_img is None:
            print(
                "Warnung: greenwall ist aktiv, aber kein Hintergrundbild gefunden. "
                "Lege z.B. ___greenwall.jpg in input_dir oder input_dir/assets ab, "
                "oder setze im XML greenwall-bg='...'.",
                file=sys.stderr,
            )

    canvas = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    used_photo_paths: List[Path] = []

    write_mask_debug = bool(gw_cfg.get("write_mask_debug", False))

    for layer in layers:
        img, src_path = load_asset_for_layer(layer, input_dir, template_dir)

        if layer.type == "photo" and src_path is not None:
            used_photo_paths.append(src_path)

        if greenwall_active and layer.type == "photo":
            debug_path = None
            if write_mask_debug and src_path is not None and greenwall_out_dir is not None:
                debug_path = greenwall_out_dir / f"{prefix}{idx:06d}_{src_path.stem}_mask.png"

            cutout = remove_green_background(img, ref_bg_img, gw_cfg, debug_mask_path=debug_path)

            if greenwall_bg_img is not None:
                bg_rgba = greenwall_bg_img.resize(cutout.size, RES_BILINEAR).convert("RGBA")
                bg_rgba.alpha_composite(cutout.convert("RGBA"))
                composed_rgb = bg_rgba.convert("RGB")

                if greenwall_out_dir is not None and src_path is not None:
                    try:
                        gw_name = f"{prefix}{idx:06d}_{src_path.stem}_greenwall.jpg"
                        save_jpeg(composed_rgb, greenwall_out_dir / gw_name, out_cfg)
                    except Exception as _e:
                        print(
                            f"Warnung: Konnte Greenwall-Kopie nicht speichern ({src_path.name}): {_e}",
                            file=sys.stderr,
                        )

                img = composed_rgb.convert("RGBA")
            else:
                img = cutout

        place_layer(
            canvas=canvas,
            layer_img=img,
            x=layer.x,
            y=layer.y,
            w=layer.w,
            h=layer.h,
            rotation_deg=layer.rotation,
            resize_mode=resize_mode,
        )

    out_name = f"{prefix}{idx:06d}{out_ext}"
    out_path = output_collage / out_name

    if out_ext.lower() in (".jpg", ".jpeg"):
        save_jpeg(canvas, out_path, out_cfg)
    else:
        canvas.save(out_path)

    for p in used_photo_paths:
        dest_name = f"{prefix}{idx:06d}_{p.name}"
        shutil.copy2(p, output_originals / dest_name)

    return out_path


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description="Erstellt eine Collage aus mehreren Fotos/Bildern nach XML-Template.")
    parser.add_argument("--template", required=True, help="Pfad zur Template-XML.")
    parser.add_argument("--input_dir", required=True, help="Ordner mit Photos (Photo_n.*) und ggf. Assets.")
    parser.add_argument("--output_collage", required=True, help="Zielordner für fertige Collagen.")
    parser.add_argument("--output_originals", required=True, help="Zielordner für kopierte Original-Photos.")
    parser.add_argument("--prefix", default="collage_", help="Dateipräfix (Standard: collage_).")
    parser.add_argument("--ext", default=".png", help="Ausgabeformat: .png (Standard) oder .jpg/.jpeg.")
    parser.add_argument(
        "--render_config",
        default=None,
        help="Optionaler Pfad zu render_config.json (Default: booth/config/render_config.json relativ zum Script).",
    )
    args = parser.parse_args(argv)

    cfg = load_render_config(args.render_config)

    template_xml = Path(args.template)
    input_dir = Path(args.input_dir)
    output_collage = Path(args.output_collage)
    output_originals = Path(args.output_originals)
    prefix = args.prefix
    out_ext = args.ext if args.ext.startswith(".") else f".{args.ext}"

    if not template_xml.exists():
        print(f"Fehler: Template-XML nicht gefunden: {template_xml}", file=sys.stderr)
        return 2
    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Fehler: input_dir ist kein Ordner oder existiert nicht: {input_dir}", file=sys.stderr)
        return 2

    try:
        out_path = build_collage(
            template_xml=template_xml,
            input_dir=input_dir,
            output_collage=output_collage,
            output_originals=output_originals,
            prefix=prefix,
            out_ext=out_ext,
            cfg=cfg,
        )
        print(str(out_path))
        return 0
    except Exception as e:
        print(f"Fehler: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
