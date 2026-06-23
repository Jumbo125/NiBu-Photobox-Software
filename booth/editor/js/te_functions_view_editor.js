/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/* global fabric */
window.TE = window.TE || {};

(function () {
  'use strict';

  const TE = window.TE;

  // i18n helpers: pbT(key,fallback) prefers global pbT(), then TE.t(), then fallback
  const pbT = function (key, fallback) {
    if (typeof window.pbT === 'function') return window.pbT(key, fallback);
    if (typeof TE.t === 'function') return TE.t(key, fallback);
    return (fallback != null) ? String(fallback) : String(key);
  };

  const fmt = function (key, fallback, vars) {
    let s = pbT(key, fallback);
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        const re = new RegExp('\\{' + k + '\\}', 'g');
        s = s.replace(re, String(vars[k]));
      });
    }
    return s;
  };

  TE.updateTemplateInfo = function (displayName, width, height) {
    const name = (displayName != null && displayName !== '')
      ? displayName
      : (TE.state && TE.state.templateName) || '';

    const input = document.getElementById('teTemplateNameInput');
    if (input) input.value = name;

    const info = document.getElementById('teTemplateInfo');
    if (info) {
      const w = Number(width) || 0;
      const h = Number(height) || 0;
      info.textContent = (w && h) ? `${w}×${h}px` : '';
    }
  };

  // ---------------------------
  // View: Scale (Shrink/Zoom)
  // ---------------------------
  TE._applyViewScale = function () {
    const c = TE.state && TE.state.canvas;
    if (!c || !TE.state.width || !TE.state.height) return;

    const s = TE._clamp(Number(TE.state.viewScale) || 1, 0.05, 6);

    const cssW = Math.max(1, Math.round(TE.state.width * s));
    const cssH = Math.max(1, Math.round(TE.state.height * s));

    c.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });

    if (c.wrapperEl) {
      c.wrapperEl.style.width = cssW + 'px';
      c.wrapperEl.style.height = cssH + 'px';
    }
    if (c.lowerCanvasEl) {
      c.lowerCanvasEl.style.width = cssW + 'px';
      c.lowerCanvasEl.style.height = cssH + 'px';
    }
    if (c.upperCanvasEl) {
      c.upperCanvasEl.style.width = cssW + 'px';
      c.upperCanvasEl.style.height = cssH + 'px';
    }

    const lbl = document.getElementById('teScaleInfo');
    if (lbl) lbl.textContent = `${Math.round(s * 100)}%`;

    c.calcOffset();
    c.requestRenderAll();
  };

  TE.setZoomScale = function (newScale, opts) {
    const c = TE.state && TE.state.canvas;
    if (!c) return;

    const options = Object.assign({
      fromFit: false,
      keepCenter: true
    }, (opts || {}));

    const frame = TE.getFrameEl();
    const scrollEl = (typeof TE.getScrollEl === 'function' ? TE.getScrollEl() : frame);
    const prevScale = TE._clamp(Number(TE.state.viewScale) || 1, 0.05, 6);

    let relX = 0.5;
    let relY = 0.5;
    if (scrollEl && options.keepCenter) {
      const oldW = Math.max(1, TE.state.width * prevScale);
      const oldH = Math.max(1, TE.state.height * prevScale);
      const cx = scrollEl.scrollLeft + (scrollEl.clientWidth / 2);
      const cy = scrollEl.scrollTop + (scrollEl.clientHeight / 2);
      relX = TE._clamp(cx / oldW, 0, 1);
      relY = TE._clamp(cy / oldH, 0, 1);
    }

    const s = TE._clamp(Number(newScale) || 1, 0.05, 6);
    TE.state.viewScale = s;

    TE.state.autoFit = !!options.fromFit;
    if (!options.fromFit) TE.state.autoFit = false;

    TE._applyViewScale();

    if (scrollEl && options.keepCenter) {
      const newW = Math.max(1, TE.state.width * s);
      const newH = Math.max(1, TE.state.height * s);

      const targetSL = (relX * newW) - (scrollEl.clientWidth / 2);
      const targetST = (relY * newH) - (scrollEl.clientHeight / 2);

      const maxSL = Math.max(0, newW - scrollEl.clientWidth);
      const maxST = Math.max(0, newH - scrollEl.clientHeight);

      scrollEl.scrollLeft = TE._clamp(targetSL, 0, maxSL);
      scrollEl.scrollTop = TE._clamp(targetST, 0, maxST);
    }
  };

  TE.zoomIn = function () {
    TE.setZoomScale((TE.state.viewScale || 1) * 1.1, { fromFit: false, keepCenter: true });
  };

  TE.zoomOut = function () {
    TE.setZoomScale((TE.state.viewScale || 1) / 1.1, { fromFit: false, keepCenter: true });
  };

  TE.fitCanvasToFrame = function () {
    const frame = TE.getFrameEl();
    const scrollEl = (typeof TE.getScrollEl === 'function' ? TE.getScrollEl() : frame);
    const c = TE.state && TE.state.canvas;
    if (!frame || !c || !TE.state.width || !TE.state.height) return;

    if (!TE.state.autoFit) return;

    const st = window.getComputedStyle(frame);
    const padX = (parseFloat(st.paddingLeft) || 0) + (parseFloat(st.paddingRight) || 0);
    const padY = (parseFloat(st.paddingTop) || 0) + (parseFloat(st.paddingBottom) || 0);

    const availW = Math.max(50, scrollEl.clientWidth - padX);
    const availH = Math.max(50, scrollEl.clientHeight - padY);

    const scale = Math.min(availW / TE.state.width, availH / TE.state.height, 1);
    TE.setZoomScale(scale, { fromFit: true, keepCenter: false });

    scrollEl.scrollLeft = 0;
    scrollEl.scrollTop = 0;
  };

  TE.fitToScreen = function () {
    TE.state.autoFit = true;
    TE.fitCanvasToFrame();
  };

  TE.bindAutoFit = function () {
    if (TE.state._fitBound) return;
    TE.state._fitBound = true;

    window.addEventListener('resize', () => TE.fitCanvasToFrame(), { passive: true });

    const frame = TE.getFrameEl();
    if (frame && 'ResizeObserver' in window) {
      const ro = new ResizeObserver(() => TE.fitCanvasToFrame());
      ro.observe(frame);
    }
  };

  // ---------------------------
  // Dispose / Init
  // ---------------------------
  TE.disposeEditor = function () {
    const c = TE.state && TE.state.canvas;
    if (c) {
      try { c.dispose(); } catch (e) {}
    }
    TE.state.canvas = null;
    TE.state.selected = null;

    TE.state.viewScale = 1;
    TE.state.autoFit = true;
    TE.state._nextUid = 1;
  };

  TE.initEditor = function ({ templateName, width, height, displayName, baseUrl }) {
    TE.disposeEditor();

    TE.state.greenwall = false;
    TE.state.greenwallSrc = '';
    TE.state.greenwallName = '';
    TE.state.greenwallAsset = null;

    TE.state.templateName = templateName;
    TE.state.width = Number(width) || 0;
    TE.state.height = Number(height) || 0;
    TE.state.baseUrl = baseUrl || `/templates/${templateName}/`;

    TE.updateTemplateInfo(
      (displayName != null && displayName !== '') ? displayName : templateName,
      TE.state.width,
      TE.state.height
    );

    const canvasEl = document.getElementById('editorCanvas');
    canvasEl.width = TE.state.width;
    canvasEl.height = TE.state.height;

    const c = new fabric.Canvas('editorCanvas', {
      preserveObjectStacking: true,
      selection: true
    });
    TE.state.canvas = c;

    if (typeof TE.bindBorderOverlaySync === 'function') {
      TE.bindBorderOverlaySync(TE.state.canvas);
    }

    fabric.Object.prototype.transparentCorners = false;
    fabric.Object.prototype.cornerStyle = 'circle';
    fabric.Object.prototype.cornerSize = 10;

    c.on('selection:cleared', () => TE.setSelected(null));
    c.on('selection:created', (e) => TE.setSelected(e.selected && e.selected[0]));
    c.on('selection:updated', (e) => TE.setSelected(e.selected && e.selected[0]));

    c.on('object:modified', (e) => {
      const o = e && e.target;
      if (o) {
        const sw = (o.strokeWidth || 0);
        const off = (sw % 2) ? 0.5 : 0;

        o.set({
          left: Math.round(o.left || 0) + off,
          top: Math.round(o.top || 0) + off
        });
        o.setCoords();
      }

      c.requestRenderAll();

      TE.syncInspectorFromSelected();
      TE.refreshLayers && TE.refreshLayers();
    });

    c.on('object:moving', () => TE.syncInspectorFromSelected());
    c.on('object:scaling', () => TE.syncInspectorFromSelected());
    c.on('object:rotating', () => TE.syncInspectorFromSelected());

    TE.refreshLayers();
    TE.syncInspectorFromSelected();

    TE.bindAutoFit();
    requestAnimationFrame(() => TE.fitCanvasToFrame());

    TE.cacheGreenwallUi && TE.cacheGreenwallUi();
    TE.syncGreenwallUiFromState && TE.syncGreenwallUiFromState();

    TE.detectGreenwallAsset && TE.detectGreenwallAsset({ activateIfFound: false });

    TE._fireEditorReady();
  };

  TE.setSelected = function (obj) {
    TE.state.selected = obj || null;
    if (TE.state.selected) TE.ensureUid(TE.state.selected);

    TE.syncInspectorFromSelected();
    if (typeof TE.syncStyleInspectorFromSelected === 'function') {
      TE.syncStyleInspectorFromSelected();
    }
    TE.refreshLayers();
  };

  TE._objLabel = function (obj) {
    if (!obj) return pbT('te.obj.none', '—');

    const t = obj.pbType || 'item';

    if (t === 'photo') {
      const idx = (obj.pbIndex != null && obj.pbIndex !== '') ? obj.pbIndex : '?';
      return fmt('te.layer.photo.placeholder', 'FOTO {idx}', { idx });
    }

    if (t === 'image') {
      return obj.pbName || pbT('te.layer.image.default_name', 'BILD');
    }

    if (t === 'item') {
      return pbT('te.layer.type.item', 'Element');
    }

    return String(t).toUpperCase();
  };

  // ---------------------------
  // Inspector
  // ---------------------------
  TE.syncInspectorFromSelected = function () {
    if (TE.state.suppressInspector) return;

    const o = TE.state.selected;
    const hint = document.getElementById('teSelHint');

    const set = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.value = (v ?? '');
    };

    if (!o) {
      if (hint) hint.textContent = pbT('te.inspector.none_selected', 'Kein Objekt selektiert');
      set('inX', ''); set('inY', ''); set('inW', ''); set('inH', ''); set('inR', '');
      if (typeof TE.syncStyleInspectorFromSelected === 'function') {
        TE.syncStyleInspectorFromSelected();
      }
      return;
    }

    if (hint) hint.textContent = TE._objLabel(o);

    const x = Math.round(o.left || 0);
    const y = Math.round(o.top || 0);
    const w = Math.round(o.getScaledWidth());
    const h = Math.round(o.getScaledHeight());
    const r = Math.round(o.angle || 0);

    set('inX', x);
    set('inY', y);
    set('inW', w);
    set('inH', h);
    set('inR', r);
  };

  TE.scaleObjectToWidth = function (obj, targetW) {
    const baseW = obj.width || 1;
    const scale = targetW / baseW;
    obj.set('scaleX', scale);
  };

  TE.scaleObjectToHeight = function (obj, targetH) {
    const baseH = obj.height || 1;
    const scale = targetH / baseH;
    obj.set('scaleY', scale);
  };

  TE.applyInspectorToSelected = function () {
    const o = TE.state.selected;
    if (!o) return;

    const getN = (id) => {
      const el = document.getElementById(id);
      return el ? Number(el.value) : NaN;
    };

    const x = getN('inX');
    const y = getN('inY');
    const w = getN('inW');
    const h = getN('inH');
    const r = getN('inR');

    if (!Number.isNaN(x)) o.set('left', x);
    if (!Number.isNaN(y)) o.set('top', y);

    if (!Number.isNaN(w) && w > 1) TE.scaleObjectToWidth(o, w);
    if (!Number.isNaN(h) && h > 1) TE.scaleObjectToHeight(o, h);

    if (!Number.isNaN(r)) o.set('angle', r);

    o.setCoords();
    TE.state.canvas.requestRenderAll();
    TE.refreshLayers();
  };
})();
