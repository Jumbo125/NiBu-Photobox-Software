/**
 * Template Editor – Layer Style Modul (Radius / Border / Shadow + UI + XML)
 * -----------------------------------------------------------------------
 * Zweck:
 *  Dieses Modul erweitert den Template Editor (Fabric.js) um ein einheitliches
 *  Style-System pro Layer/Objekt. Es verwaltet Eckenradius, Rahmen und Schatten,
 *  kann diese Styles auf Fabric-Objekte anwenden, im XML-Format speichern/laden
 *  und mit einem UI-Inspector synchronisieren.
 *
 * Kernideen:
 *  - Pro Objekt wird der Style in `obj.pbStyle` gespeichert.
 *  - `TE.STYLE_DEFAULTS` definiert Default-Werte.
 *  - `TE.normalizeLayerStyle()` sorgt für saubere/valide Werte (Boolean, Zahlen, Farben, Border-Style).
 *  - `TE.applyLayerStyleToObject()` wendet Style robust an und verhindert "Springen"
 *    durch Stroke/Shadow/Clip, indem die Bounding-Box vorher/nachher verglichen
 *    und `left/top` ggf. korrigiert werden.
 *
 * Spezielle Behandlung für Foto-Platzhalter:
 *  - Foto-Platzhalter sind typischerweise Fabric-Groups (`obj.pbType === "photo" && obj.type === "group"`).
 *  - Der Rahmen/Radius wird auf das innere `rect` angewendet (nicht auf die Group selbst).
 *  - Der ursprüngliche Placeholder-Stroke wird einmalig als `rect.pbHelperStroke` gesichert,
 *    um ihn wiederherstellen zu können, wenn Border deaktiviert wird.
 *  - Radius bleibt in Output-Pixeln konstant: rx/ry werden invers zur Group-Skalierung gesetzt.
 *
 * Radius bei normalen Objekten:
 *  - Wird über `obj.clipPath` (fabric.Rect) umgesetzt, ebenfalls mit inverser Skalierung,
 *    damit der Radius optisch konstant bleibt.
 *
 * Border Styles:
 *  - Unterstützt: solid / dashed / dotted
 *  - Für dashed/dotted wird `strokeDashArray` abhängig von `border.width` erzeugt.
 *
 * Shadow:
 *  - Setzt `obj.shadow` via `fabric.Shadow` (color, blur, offsetX, offsetY).
 *  - `shadow.spread` wird aktuell nur gespeichert/serialisiert (Fabric unterstützt das nicht direkt).
 *
 * XML/Serializer:
 *  - `TE.getSerializedStyle(obj)` liefert flache Felder (radius, border_*, shadow_*),
 *    geeignet zum Schreiben in XML.
 *  - `TE.applySerializedStyleToObject(obj, ly)` liest verschiedene Key-Varianten
 *    (snake_case + camelCase) und setzt `obj.pbStyle` + wendet den Style an.
 *
 * UI Inspector:
 *  - `TE.syncStyleInspectorFromSelected()` spiegelt den Style des selektierten Objekts
 *    in die UI (Checkboxen/Inputs) und aktiviert/deaktiviert Controls passend.
 *  - `TE.applyStyleInspectorToSelected()` übernimmt UI-Werte ins Objekt und wendet sie an.
 *
 * Abhängigkeiten / Erwartungen:
 *  - `window.TE.state.canvas` muss gesetzt sein (Fabric Canvas).
 *  - `TE.state.selected` enthält das aktuell selektierte Objekt.
 *  - Es werden DOM-Elemente per ID erwartet (z.B. chkRadius, borderColor, shadowBlurNum, ...).
 */
/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/* global fabric */
window.TE = window.TE || {};

(function () {
  "use strict";

  const TE = window.TE;

  // ---------------------------
  // Layer Style (per layer)
  // ---------------------------
  TE.STYLE_DEFAULTS = {
    radius: { enabled: false, px: 0 },
    border: { enabled: false, color: "#000000", style: "solid", width: 0 },
    shadow: {
      enabled: false,
      preset: "custom",
      color: "rgba(0,0,0,0.35)",
      x: 0,
      y: 6,
      blur: 18,
      spread: 0
    }
  };

  TE._clone = function (o) {
    try {
      return JSON.parse(JSON.stringify(o));
    } catch (e) {
      return Object.assign({}, o);
    }
  };

  TE._mergeDeep = function (target, src) {
    if (!src || typeof src !== "object") return target;
    Object.keys(src).forEach((k) => {
      const v = src[k];
      if (v && typeof v === "object" && !Array.isArray(v)) {
        target[k] = TE._mergeDeep(
          target[k] && typeof target[k] === "object" ? target[k] : {},
          v
        );
      } else {
        target[k] = v;
      }
    });
    return target;
  };

  TE._normColor = function (c, fallback) {
    const s = String(c || "").trim();
    return s || fallback || "#000000";
  };

  TE._normBorderStyle = function (s) {
    const v = String(s || "solid").toLowerCase().trim();
    if (["solid", "dashed", "dotted"].includes(v)) return v;
    return "solid";
  };

  TE._dashArrayForBorder = function (style, width) {
    const w = Math.max(1, Number(width) || 1);
    const st = TE._normBorderStyle(style);
    if (st === "dashed") return [Math.max(6, w * 3), Math.max(4, w * 2)];
    if (st === "dotted") return [Math.max(1, w), Math.max(3, w * 2)];
    return null;
  };

  TE.normalizeLayerStyle = function (style) {
    const s = TE._mergeDeep(TE._clone(TE.STYLE_DEFAULTS), style || {});

    s.radius = s.radius || {};
    s.radius.enabled = !!s.radius.enabled;
    s.radius.px = Math.max(0, Number(s.radius.px) || 0);

    s.border = s.border || {};
    s.border.enabled = !!s.border.enabled;
    s.border.color = TE._normColor(s.border.color, "#000000");
    s.border.style = TE._normBorderStyle(s.border.style);
    s.border.width = Math.max(0, Number(s.border.width) || 0);

    s.shadow = s.shadow || {};
    s.shadow.enabled = !!s.shadow.enabled;
    s.shadow.preset = String(s.shadow.preset || "custom");
    s.shadow.color = TE._normColor(s.shadow.color, "rgba(0,0,0,0.35)");
    s.shadow.x = Number(s.shadow.x) || 0;
    s.shadow.y = Number(s.shadow.y) || 0;
    s.shadow.blur = Math.max(0, Number(s.shadow.blur) || 0);
    s.shadow.spread = Math.max(0, Number(s.shadow.spread) || 0);

    return s;
  };

  TE.getLayerStyle = function (obj) {
    if (!obj) return TE._clone(TE.STYLE_DEFAULTS);
    const base = TE._clone(TE.STYLE_DEFAULTS);
    const merged = TE._mergeDeep(
      base,
      obj.pbStyle && typeof obj.pbStyle === "object" ? obj.pbStyle : {}
    );
    return TE.normalizeLayerStyle(merged);
  };

  TE.setLayerStyle = function (obj, style) {
    if (!obj) return;
    obj.pbStyle = TE.normalizeLayerStyle(style);
    TE.applyLayerStyleToObject(obj);
  };

  TE._getPhotoRect = function (groupObj) {
    if (!groupObj || groupObj.type !== "group" || !Array.isArray(groupObj._objects)) return null;
    return groupObj._objects.find((o) => o && o.type === "rect") || null;
  };

  TE._ensurePhotoHelperStroke = function (groupObj) {
    const rect = TE._getPhotoRect(groupObj);
    if (!rect) return;
    if (rect.pbHelperStrokeSet) return;

    rect.pbHelperStrokeSet = true;
    rect.pbHelperStroke = {
      color: rect.stroke || "#111",
      width: Number(rect.strokeWidth) || 0,
      dash: Array.isArray(rect.strokeDashArray) ? rect.strokeDashArray.slice() : null
    };
  };

  // ---------------------------
  // Border Overlay (separate layer above the object)
  // ---------------------------
  TE.isBorderOverlay = function (o) {
    return !!(o && o.pbIsBorderOverlay);
  };

  TE._removeBorderOverlay = function (owner) {
    const c = TE.state && TE.state.canvas;
    if (!owner || !owner.pbBorderOverlay) return;

    try {
      if (c) c.remove(owner.pbBorderOverlay);
    } catch (e) {}

    owner.pbBorderOverlay = null;
  };

  TE._ensureBorderOverlay = function (owner) {
    const c = TE.state && TE.state.canvas;
    if (!c || !owner || owner.pbBorderOverlay) return owner && owner.pbBorderOverlay;

    if (!(window.fabric && fabric.Rect)) return null;

    const ov = new fabric.Rect({
      fill: "transparent",
      selectable: false,
      evented: false,
      hasControls: false,
      hasBorders: false,
      objectCaching: false,
      originX: "center",
      originY: "center"
    });

    // Mark as non-exportable helper object
    ov.pbIsBorderOverlay = true;
    ov.pbNoExport = true;

    // Link overlay to owner (used by tools like layer lists / hit-tests if needed)
    ov.pbOwnerUid = Number(owner.pbUid || 0);

    // Prevent treating it as a normal layer
    ov.pbType = "__border_overlay";

    owner.pbBorderOverlay = ov;
    c.add(ov);
    return ov;
  };

  TE._syncBorderOverlay = function (owner, st) {
    const c = TE.state && TE.state.canvas;
    if (!c || !owner) return;

    if (owner.pbBorderOverlay) {
      owner.pbBorderOverlay.pbOwnerUid = Number(owner.pbUid || 0);
    }

    // Overlay only if border is enabled and has width
    const borderEnabled = !!(st && st.border && st.border.enabled);
    const bw = borderEnabled ? Math.max(0, Number(st.border.width) || 0) : 0;

    if (!borderEnabled || bw <= 0) {
      TE._removeBorderOverlay(owner);
      return;
    }

    const ov = TE._ensureBorderOverlay(owner);
    if (!ov) return;

    // Robust scaled size
    const scaledW =
      typeof owner.getScaledWidth === "function"
        ? owner.getScaledWidth()
        : (Number(owner.width) || 1) * Math.abs(Number(owner.scaleX) || 1);

    const scaledH =
      typeof owner.getScaledHeight === "function"
        ? owner.getScaledHeight()
        : (Number(owner.height) || 1) * Math.abs(Number(owner.scaleY) || 1);

    const center =
      typeof owner.getCenterPoint === "function"
        ? owner.getCenterPoint()
        : { x: owner.left || 0, y: owner.top || 0 };

    const bc = (st && st.border && st.border.color) || "#000000";
    const dash = TE._dashArrayForBorder(st && st.border ? st.border.style : "solid", bw);

    const radiusPx =
      st && st.radius && st.radius.enabled ? Math.max(0, Number(st.radius.px) || 0) : 0;

    // Keep stroke outside the content by making the overlay rect slightly larger (+bw)
    const outW = Math.max(1, scaledW + bw);
    const outH = Math.max(1, scaledH + bw);
    const r = radiusPx > 0 ? (radiusPx + bw / 2) : 0;

    ov.set({
      left: center.x,
      top: center.y,
      angle: Number(owner.angle) || 0,

      width: outW,
      height: outH,
      scaleX: 1,
      scaleY: 1,

      rx: r,
      ry: r,

      stroke: bc,
      strokeWidth: bw,
      strokeDashArray: dash,
      strokeUniform: true,
      strokeLineJoin: "round",

      // Mirror owner visibility/opacity
      visible: owner.visible !== false,
      opacity: Number.isFinite(owner.opacity) ? owner.opacity : 1
    });

    // Keep overlay directly above the owner in z-order
    const idx = c.getObjects().indexOf(owner);
    if (idx >= 0) {
      const target = Math.min(idx + 1, c.getObjects().length - 1);
      try { ov.moveTo(target); } catch (e) {}
    }

    ov.setCoords();
  };

  // Canvas events: keep overlay synced to moves/scales/rotations and cleanup on remove
  TE.bindBorderOverlaySync = function (canvas) {
    const c = canvas || (TE.state && TE.state.canvas);
    if (!c || c._pbBorderOverlayBound) return;
    c._pbBorderOverlayBound = true;

    const sync = (e) => {
      const t = e && e.target;
      if (!t || TE.isBorderOverlay(t)) return;
      TE._syncBorderOverlay(t, TE.getLayerStyle(t));
    };

    c.on("object:moving", sync);
    c.on("object:scaling", sync);
    c.on("object:rotating", sync);
    c.on("object:skewing", sync);
    c.on("object:modified", sync);

    c.on("object:removed", (e) => {
      const t = e && e.target;
      if (!t || TE.isBorderOverlay(t)) return;
      TE._removeBorderOverlay(t);
    });
  };

  TE.applyLayerStyleToObject = function (obj) {
    const c = TE.state && TE.state.canvas;
    if (!obj) return;

    const st = TE.getLayerStyle(obj);

    const centerBefore =
      typeof obj.getCenterPoint === "function" ? obj.getCenterPoint() : null;

    const radiusPx = st.radius.enabled ? Math.max(0, Number(st.radius.px) || 0) : 0;

    const borderEnabled = !!st.border.enabled;
    const bw = borderEnabled ? Math.max(0, Number(st.border.width) || 0) : 0;

    const shadowEnabled = !!st.shadow.enabled;

    if ((obj.pbType || "") === "photo" && obj.type === "group") {
      const rect = TE._getPhotoRect(obj);
      if (rect) {
        TE._ensurePhotoHelperStroke(obj);

        // Keep radius constant in output pixels (invert by group scale)
        const sx = Number(obj.scaleX) || 1;
        const sy = Number(obj.scaleY) || 1;
        rect.set({ rx: radiusPx / sx, ry: radiusPx / sy });

        // Border is drawn as overlay; hide internal helper stroke when border is active
        if (borderEnabled && bw > 0) {
          rect.set({ stroke: null, strokeWidth: 0, strokeDashArray: null });
        } else {
          const helper = rect.pbHelperStroke || null;
          if (helper) {
            rect.set({
              stroke: helper.color,
              strokeWidth: helper.width,
              strokeDashArray: helper.dash
            });
          } else {
            rect.set({ stroke: null, strokeWidth: 0, strokeDashArray: null });
          }
        }
      }
    } else {
      // Radius via clipPath (keeps radius constant in output pixels even when scaled)
      if (radiusPx > 0 && window.fabric && fabric.Rect) {
        try {
          const sx = Number(obj.scaleX) || 1;
          const sy = Number(obj.scaleY) || 1;
          const cp = new fabric.Rect({
            width: Math.max(1, Number(obj.width) || 1),
            height: Math.max(1, Number(obj.height) || 1),
            rx: radiusPx / sx,
            ry: radiusPx / sy,
            originX: "center",
            originY: "center",
            left: 0,
            top: 0
          });

          cp.absolutePositioned = false;
          obj.clipPath = cp;
        } catch (e) {
          obj.clipPath = null;
        }
      } else {
        obj.clipPath = null;
      }

      // Border is drawn as overlay (not on the object itself)
      obj.set({ stroke: null, strokeWidth: 0, strokeDashArray: null });
    }

    if (shadowEnabled && window.fabric && fabric.Shadow) {
      try {
        const sh = new fabric.Shadow({
          color: st.shadow.color,
          blur: Math.max(0, Number(st.shadow.blur) || 0),
          offsetX: Number(st.shadow.x) || 0,
          offsetY: Number(st.shadow.y) || 0
        });
        obj.set("shadow", sh);
      } catch (e) {
        obj.set("shadow", null);
      }
    } else {
      obj.set("shadow", null);
    }

    if (centerBefore && typeof obj.setPositionByOrigin === "function") {
      try {
        obj.setCoords();
        obj.setPositionByOrigin(centerBefore, "center", "center");
        obj.setCoords();
      } catch (e) {}
    }

    // Update/remove border overlay after applying style changes
    TE._syncBorderOverlay(obj, st);

    obj.dirty = true;
    if (c) c.requestRenderAll();
  };

  // ---------------------------
  // Serializer (for XML)
  // ---------------------------
  TE.getSerializedStyle = function (obj) {
    const st = TE.getLayerStyle(obj);
    return {
      radius: st.radius.enabled ? Math.round(st.radius.px) : 0,
      border: st.border.enabled ? 1 : 0,
      border_color: st.border.color,
      border_style: st.border.style,
      border_width: Math.round(st.border.width),
      shadow: st.shadow.enabled ? 1 : 0,
      shadow_preset: String(st.shadow.preset || "custom"),
      shadow_color: st.shadow.color,
      shadow_x: Math.round(st.shadow.x),
      shadow_y: Math.round(st.shadow.y),
      shadow_blur: Math.round(st.shadow.blur),
      shadow_spread: Math.round(st.shadow.spread)
    };
  };

  TE.applySerializedStyleToObject = function (obj, ly) {
    if (!obj || !ly) return;

    const toN = (v, d) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

    const radius = toN(ly.radius ?? ly.radiusPx ?? ly.radius_px, 0);
    const border = toN(ly.border ?? ly.borderEnabled ?? ly.border_enabled, 0);
    const shadow = toN(ly.shadow ?? ly.shadowEnabled ?? ly.shadow_enabled, 0);

    const st = TE.normalizeLayerStyle({
      radius: { enabled: radius > 0, px: radius },
      border: {
        enabled: border === 1 || border === true,
        color: ly.border_color ?? ly.borderColor ?? "#000000",
        style: ly.border_style ?? ly.borderStyle ?? "solid",
        width: toN(ly.border_width ?? ly.borderWidth, 0)
      },
      shadow: {
        enabled: shadow === 1 || shadow === true,
        preset: String(ly.shadow_preset ?? ly.shadowPreset ?? "custom"),
        color: ly.shadow_color ?? ly.shadowColor ?? "rgba(0,0,0,0.35)",
        x: toN(ly.shadow_x ?? ly.shadowX, 0),
        y: toN(ly.shadow_y ?? ly.shadowY, 0),
        blur: toN(ly.shadow_blur ?? ly.shadowBlur, 0),
        spread: toN(ly.shadow_spread ?? ly.shadowSpread, 0)
      }
    });

    const hadAny =
      "radius" in ly ||
      "border" in ly ||
      "shadow" in ly ||
      "border_color" in ly ||
      "border_style" in ly ||
      "border_width" in ly ||
      "shadow_color" in ly ||
      "shadow_x" in ly ||
      "shadow_y" in ly ||
      "shadow_blur" in ly ||
      "shadow_spread" in ly;

    if (hadAny) {
      obj.pbStyle = st;
      TE.applyLayerStyleToObject(obj);
    }
  };

  // ---------------------------
  // Style Inspector (UI)
  // ---------------------------
  TE.syncStyleInspectorFromSelected = function () {
    if (TE.state && TE.state.suppressInspector) return;

    const o = TE.state ? TE.state.selected : null;

    const el = (id) => document.getElementById(id);
    const setChecked = (id, v) => { const e = el(id); if (e) e.checked = !!v; };
    const setVal = (id, v) => { const e = el(id); if (e) e.value = v ?? ""; };
    const setDisabled = (id, v) => { const e = el(id); if (e) e.disabled = !!v; };
    const setHidden = (id, v) => { const e = el(id); if (e) e.classList.toggle("d-none", !!v); };

    const setRangePair = (rangeId, numId, v) => {
      setVal(rangeId, v);
      setVal(numId, v);
    };

    if (!o) {
      setChecked("chkRadius", false);
      setVal("inRadiusPx", 0);

      setChecked("chkBorder", false);
      setVal("borderColor", "#000000");
      setVal("borderStyle", "solid");
      setVal("borderWidth", 0);

      setChecked("chkShadow", false);
      setVal("shadowPreset", "custom");
      setVal("shadowColor", "rgba(0,0,0,0.35)");
      setRangePair("shadowOffsetX", "shadowOffsetXNum", 0);
      setRangePair("shadowOffsetY", "shadowOffsetYNum", 0);
      setRangePair("shadowBlur", "shadowBlurNum", 0);
      setRangePair("shadowSpread", "shadowSpreadNum", 0);

      [
        "chkRadius", "inRadiusPx",
        "chkBorder", "borderColor", "borderStyle", "borderWidth",
        "chkShadow", "shadowPreset", "shadowColor",
        "shadowOffsetX", "shadowOffsetXNum",
        "shadowOffsetY", "shadowOffsetYNum",
        "shadowBlur", "shadowBlurNum",
        "shadowSpread", "shadowSpreadNum"
      ].forEach((id) => setDisabled(id, true));

      setHidden("borderAccordionWrap", true);
      setHidden("shadowControlsWrap", true);
      return;
    }

    ["chkRadius", "chkBorder", "chkShadow"].forEach((id) => setDisabled(id, false));

    const st = TE.getLayerStyle(o);

    setChecked("chkRadius", !!st.radius.enabled);
    setVal("inRadiusPx", Math.round(st.radius.px || 0));
    setDisabled("inRadiusPx", !st.radius.enabled);

    setChecked("chkBorder", !!st.border.enabled);
    setVal("borderColor", st.border.color || "#000000");
    setVal("borderStyle", st.border.style || "solid");
    setVal("borderWidth", Math.round(st.border.width || 0));
    setDisabled("borderColor", !st.border.enabled);
    setDisabled("borderStyle", !st.border.enabled);
    setDisabled("borderWidth", !st.border.enabled);
    setHidden("borderAccordionWrap", !st.border.enabled);

    setChecked("chkShadow", !!st.shadow.enabled);
    setVal("shadowPreset", String(st.shadow.preset || "custom"));
    setVal("shadowColor", st.shadow.color || "rgba(0,0,0,0.35)");
    setRangePair("shadowOffsetX", "shadowOffsetXNum", Number(st.shadow.x) || 0);
    setRangePair("shadowOffsetY", "shadowOffsetYNum", Number(st.shadow.y) || 0);
    setRangePair("shadowBlur", "shadowBlurNum", Number(st.shadow.blur) || 0);
    setRangePair("shadowSpread", "shadowSpreadNum", Number(st.shadow.spread) || 0);

    [
      "shadowPreset", "shadowColor",
      "shadowOffsetX", "shadowOffsetXNum",
      "shadowOffsetY", "shadowOffsetYNum",
      "shadowBlur", "shadowBlurNum",
      "shadowSpread", "shadowSpreadNum"
    ].forEach((id) => setDisabled(id, !st.shadow.enabled));

    setHidden("shadowControlsWrap", !st.shadow.enabled);
  };

  TE.applyStyleInspectorToSelected = function () {
    const o = TE.state ? TE.state.selected : null;
    if (!o) return;

    const el = (id) => document.getElementById(id);
    const getChecked = (id) => { const e = el(id); return !!(e && e.checked); };
    const getVal = (id) => { const e = el(id); return e ? e.value : ""; };
    const getNum = (id, d) => {
      const e = el(id);
      const n = Number(e ? e.value : NaN);
      return Number.isFinite(n) ? n : d;
    };

    const radiusEnabled = getChecked("chkRadius");
    const borderEnabled = getChecked("chkBorder");
    const shadowEnabled = getChecked("chkShadow");

    let radiusPx = Math.max(0, getNum("inRadiusPx", 0));
    if (radiusEnabled && radiusPx === 0) radiusPx = 14;

    let borderW = Math.max(0, getNum("borderWidth", 0));
    if (borderEnabled && borderW === 0) borderW = 2;

    const st = TE.getLayerStyle(o);

    st.radius.enabled = radiusEnabled;
    st.radius.px = radiusPx;

    st.border.enabled = borderEnabled;
    st.border.color = getVal("borderColor") || "#000000";
    st.border.style = getVal("borderStyle") || "solid";
    st.border.width = borderW;

    st.shadow.enabled = shadowEnabled;
    st.shadow.preset = String(getVal("shadowPreset") || "custom");
    st.shadow.color = getVal("shadowColor") || "rgba(0,0,0,0.35)";
    st.shadow.x = getNum("shadowOffsetX", 0);
    st.shadow.y = getNum("shadowOffsetY", 0);
    st.shadow.blur = Math.max(0, getNum("shadowBlur", 0));
    st.shadow.spread = Math.max(0, getNum("shadowSpread", 0));

    TE.setLayerStyle(o, st);
    TE.syncStyleInspectorFromSelected();
  };
})();
