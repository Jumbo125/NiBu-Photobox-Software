/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/* global fabric */
window.TE = window.TE || {};

(function () {
  'use strict';

  const TE = window.TE;

  // i18n helpers: pbT(key,fallback) bevorzugt globales pbT(), sonst TE.t(), sonst fallback
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

  // ---------------------------
  // Project helpers
  // ---------------------------
  TE.sanitizeName = function (s) {
    s = String(s || '').toLowerCase().trim();
    s = s.replace(/\s+/g, '_');
    s = s.replace(/[^a-z0-9_-]/g, '');
    return s;
  };

  TE.setActiveProject = function (name) {
    const safe = TE.sanitizeName(name);
    TE.activeProject = safe;
    TE.state.templateName = safe;
    const input = document.getElementById('teTemplateNameInput');
    if (input) input.value = safe;
    return safe;
  };

  // ---------------------------
  // Fix Fabric caching for photo placeholders (important for ZIP-load)
  // ---------------------------
  TE.fixPhotoPlaceholderRender = TE.fixPhotoPlaceholderRender || function (g) {
    if (!g || g.pbType !== 'photo') return;

    // Disable caching on the group to prevent stroke/text artifacts after scaling.
    g.set({
      objectCaching: false,
      noScaleCache: true,
      cachePadding: 20
    });

    // Also disable caching on the rect inside the group.
    const rect = Array.isArray(g._objects)
      ? g._objects.find(o => o && o.type === 'rect')
      : null;

    if (rect) {
      rect.set({
        objectCaching: false,
        noScaleCache: true,
        cachePadding: 20,
        strokeUniform: true
      });
      rect.dirty = true;
    }

    g.dirty = true;
  };

  TE.fixAllPhotoPlaceholderRender = TE.fixAllPhotoPlaceholderRender || function () {
    const c = TE.state.canvas;
    if (!c) return;
    c.getObjects().forEach(o => {
      if (o && o.pbType === 'photo') TE.fixPhotoPlaceholderRender(o);
    });
    c.requestRenderAll();
  };

  // ---------------------------
  // Serialize -> save/export
  // ---------------------------
  TE.serializeTemplate = function () {
    const c = TE.state.canvas;
    if (!c) return null;

    const layers = c.getObjects()
      .filter(o => !(o && (o.pbIsBorderOverlay || o.pbNoExport)))
      .map((o) => {
        TE.ensureUid(o);

        const base = {
          id: Number(o.pbUid || 0),
          type: o.pbType || 'item',
          x: Math.round(o.left || 0),
          y: Math.round(o.top || 0),
          w: Math.round(o.getScaledWidth()),
          h: Math.round(o.getScaledHeight()),
          rotation: Math.round(o.angle || 0)
        };

        // per-layer styles
        try {
          if (typeof TE.getSerializedStyle === 'function') {
            Object.assign(base, TE.getSerializedStyle(o));
          }
        } catch (e) {}

        if ((o.pbType || '') === 'photo') {
          base.index = Number(o.pbIndex || 0);
        } else if ((o.pbType || '') === 'image') {
          base.src = o.pbSrc || '';
          base.name = o.pbName || pbT('te.layer.image.default_name', 'IMAGE');
        } else {
          base.name = TE._objLabel(o);
        }
        return base;
      });

    const inputEl = document.getElementById('teTemplateNameInput');
    const inputVal = inputEl ? TE.sanitizeName(inputEl.value) : '';
    const activeName = inputVal || TE.activeProject || TE.state.templateName;

    return {
      templateName: activeName,
      width: TE.state.width,
      height: TE.state.height,
      photoCounter: TE.state.photoCounter,
      settings: {
        greenwall: !!TE.state.greenwall
      },
      layers
    };
  };

  TE.saveTemplate = async function () {
    const payload = TE.serializeTemplate();
    if (!payload) return;

    if (!payload.templateName) {
      alert(pbT('te.alert.no_active_project', 'Kein aktives Projekt gewählt / Template-Name fehlt.'));
      return;
    }

    return await TE.postJson('/api/template_editor_save.php', payload);
  };

  TE.exportZip = async function () {
    const inputEl = document.getElementById('teTemplateNameInput');
    const inputVal = inputEl ? TE.sanitizeName(inputEl.value) : '';
    const name = inputVal || TE.activeProject || TE.state.templateName;
    if (!name) {
      alert(pbT('te.alert.no_active_project', 'Kein aktives Projekt gewählt / Template-Name fehlt.'));
      return;
    }

    const r = await fetch('/api/template_editor_export.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ templateName: name }),
      cache: 'no-store'
    });

    if (!r.ok) {
      throw new Error(fmt('te.export.failed_http', 'Export fehlgeschlagen (HTTP {status})', { status: r.status }));
    }

    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${name}.zip`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  // ---------------------------
  // Import + Load
  // ---------------------------
  TE.importZip = async function (file) {
    if (!file) throw new Error(pbT('te.import.no_zip_selected', 'Kein ZIP ausgewählt'));
    const fd = new FormData();
    fd.append('zip', file);
    return await TE.uploadFile('/api/template_editor_import.php', fd);
  };

  TE._reorderToMatchLayers = function (layers) {
    const c = TE.state.canvas;
    if (!c || !Array.isArray(layers) || !layers.length) return;

    // layers[] is serialized bottom -> top
    layers.forEach((ly, targetIndex) => {
      const uid = Number(ly && ly.id);
      if (!uid) return;
      const obj = TE.getObjectByUid(uid);
      if (obj) TE._moveToIndex(c, obj, targetIndex);
    });

    c.requestRenderAll();
    TE.refreshLayers();
  };

  TE.loadFromData = function (data) {
    TE.initEditor({
      templateName: data.templateName,
      width: Number(data.width),
      height: Number(data.height)
    });

    if (data.baseUrl) TE.state.baseUrl = data.baseUrl;
    TE.state.photoCounter = Number(data.photoCounter || 0);

    TE.cacheGreenwallUi && TE.cacheGreenwallUi();
    TE.state.greenwall = !!(data.settings && data.settings.greenwall);

    TE.detectGreenwallAsset
      ? TE.detectGreenwallAsset({ activateIfFound: TE.state.greenwall })
      : (TE.syncGreenwallUiFromState && TE.syncGreenwallUiFromState());

    const c = TE.state.canvas;
    const layers = Array.isArray(data.layers) ? data.layers : [];

    const pendingImages = [];

    // 1) Photos synchron
    layers.forEach((ly) => {
      if (!ly) return;

      if (ly.type === 'photo') {
        const idx = Number(ly.index || 1);
        TE.state.photoCounter = Math.max(TE.state.photoCounter, idx);

        const fillCol = (typeof TE.pbPaletteFill === 'function')
          ? TE.pbPaletteFill(idx)
          : 'rgba(255,255,255,1)';

        const rect = new fabric.Rect({
          left: 0,
          top: 0,
          width: 420,
          height: 280,
          fill: fillCol,
          stroke: '#111',
          strokeDashArray: [10, 8],
          strokeWidth: 4,
          rx: 14,
          ry: 14,
          originX: 'left',
          originY: 'top',

          objectCaching: false,
          noScaleCache: true,
          cachePadding: 20,
          strokeUniform: true
        });

        const txt = new fabric.Text(
          fmt('te.layer.photo.placeholder', 'FOTO {idx}', { idx }),
          {
            left: 16,
            top: 16,
            fontSize: 34,
            fill: '#111',
            fontFamily: 'Arial',
            originX: 'left',
            originY: 'top'
          }
        );

        const g = new fabric.Group([rect, txt], {
          left: ly.x || 0,
          top: ly.y || 0,
          angle: ly.rotation || 0,
          originX: 'left',
          originY: 'top',

          objectCaching: false,
          noScaleCache: true,
          cachePadding: 20
        });

        g.pbType = 'photo';
        g.pbIndex = idx;
        TE.ensureUid(g, ly.id);

        // Apply serialized styles if available
        if (typeof TE.applySerializedStyleToObject === 'function') {
          TE.applySerializedStyleToObject(g, ly);
        }

        // Re-apply render-safe settings (styles/scaling may overwrite)
        rect.set({
          fill: fillCol,
          objectCaching: false,
          noScaleCache: true,
          cachePadding: 20,
          strokeUniform: true
        });

        if (ly.w) TE.scaleObjectToWidth(g, ly.w);
        if (ly.h) TE.scaleObjectToHeight(g, ly.h);

        TE.fixPhotoPlaceholderRender(g);

        c.add(g);
      }

      if (ly.type === 'image') pendingImages.push(ly);
    });

    // 2) Images async
    const promises = pendingImages.map(async (ly) => {
      const rel = ly.src || '';
      const base = (TE.state.baseUrl || `/templates/${TE.state.templateName}/`);
      const url = new URL(base.replace(/\/?$/, '/') + rel.replace(/^\//, ''), window.location.href).toString();

      if (typeof TE._fabricLoadImage !== 'function') {
        throw new Error(pbT('te.fabric.load_image_missing', 'TE._fabricLoadImage fehlt'));
      }

      let img;
      try {
        img = await TE._fabricLoadImage(url, { crossOrigin: 'anonymous' });
      } catch (e) {
        img = await TE._fabricLoadImage(url);
      }

      img.set({
        left: ly.x || 0,
        top: ly.y || 0,
        angle: ly.rotation || 0,
        originX: 'left',
        originY: 'top',
        selectable: true,
        evented: true
      });

      img.pbType = 'image';
      img.pbSrc = rel;
      img.pbName = ly.name || pbT('te.layer.image.default_name', 'IMAGE');
      TE.ensureUid(img, ly.id);

      if (typeof TE.applySerializedStyleToObject === 'function') {
        TE.applySerializedStyleToObject(img, ly);
      }

      if (ly.w) TE.scaleObjectToWidth(img, ly.w);
      if (ly.h) TE.scaleObjectToHeight(img, ly.h);

      c.add(img);
    });

    Promise.allSettled(promises).then(() => {
      TE._reorderToMatchLayers(layers);

      // After full load, ensure all photo placeholders render correctly.
      TE.fixAllPhotoPlaceholderRender();

      c.requestRenderAll();
      TE.refreshLayers();
      requestAnimationFrame(() => TE.fitCanvasToFrame());
    });

    c.requestRenderAll();
    TE.refreshLayers();
    requestAnimationFrame(() => TE.fitCanvasToFrame());
  };
})();
