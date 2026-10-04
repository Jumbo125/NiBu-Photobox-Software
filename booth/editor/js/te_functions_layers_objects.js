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
  // Fix Fabric caching for photo placeholders
  // ---------------------------
  TE.fixPhotoPlaceholderRender = function (g) {
    if (!g || g.pbType !== 'photo') return;

    // Disable caching on the group to avoid stroke/text artifacts after scaling.
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

  TE.fixAllPhotoPlaceholderRender = function () {
    const c = TE.state.canvas;
    if (!c) return;
    c.getObjects().forEach(o => {
      if (o && o.pbType === 'photo') TE.fixPhotoPlaceholderRender(o);
    });
    c.requestRenderAll();
  };

  // ---------------------------
  // Layers panel (render only)
  // ---------------------------
  TE.refreshLayers = function () {
    const wrap = document.getElementById('layersList');
    const c = TE.state.canvas;
    if (!wrap || !c) return;

    // Only show user layers (exclude overlays/no-export)
    const objects = c.getObjects().filter(o => !(o && (o.pbIsBorderOverlay || o.pbNoExport))); // bottom -> top
    const list = objects.slice().reverse(); // display: top first

    if (!list.length) {
      wrap.innerHTML =
        `<div class="p-3 text-secondary small">${TE._esc(pbT('te.layers.none', 'Keine Ebenen'))}</div>`;
      return;
    }

    const titleDrag = TE._esc(pbT('te.layers.drag.title', 'Ziehen'));
    const titleUp = TE._esc(pbT('te.layers.move_up.title', 'Nach vorne (hoch)'));
    const titleDown = TE._esc(pbT('te.layers.move_down.title', 'Nach hinten (runter)'));

    const rows = list.map((o) => {
      const uid = TE.ensureUid(o);
      const idx = objects.indexOf(o);
      const isTop = (idx === objects.length - 1);
      const isBottom = (idx === 0);
      const active = (o === TE.state.selected) ? ' active' : '';

      const type = String(o.pbType || 'item');
      const typeLabel = pbT(`te.layer.type.${type}`, type);

      return (
        `<div class="list-group-item list-group-item-action bg-dark text-light d-flex justify-content-between align-items-center${active} js-layer-row" data-uid="${uid}">
          <div class="d-flex align-items-center gap-2 flex-grow-1 min-width-0">
            <span class="text-secondary js-layer-drag" draggable="true" title="${titleDrag}">
              <i class="bi bi-grip-vertical"></i>
            </span>
            <div class="d-flex align-items-center gap-2 flex-grow-1 min-width-0 js-layer-select" role="button" tabindex="0">
              <span class="badge bg-secondary rounded-pill">${TE._esc(typeLabel)}</span>
              <span class="text-truncate">${TE._esc(TE._objLabel(o))}</span>
            </div>
          </div>
          <div class="btn-group btn-group-sm ms-2 flex-shrink-0">
            <button type="button" class="btn btn-outline-light js-layer-up" data-uid="${uid}" title="${titleUp}" ${isTop ? 'disabled' : ''}>
              <i class="bi bi-arrow-up"></i>
            </button>
            <button type="button" class="btn btn-outline-light js-layer-down" data-uid="${uid}" title="${titleDown}" ${isBottom ? 'disabled' : ''}>
              <i class="bi bi-arrow-down"></i>
            </button>
          </div>
        </div>`
      );
    }).join('');

    wrap.innerHTML = rows;
  };

  TE.selectByUid = function (uid) {
    const c = TE.state.canvas;
    const o = TE.getObjectByUid(uid);
    if (!c || !o) return;
    c.setActiveObject(o);
    c.requestRenderAll();
    TE.setSelected(o);
  };

  // Stacking helpers (Fabric v4/v5/v6)
  TE._stackUp = function (canvas, obj) {
    if (!canvas || !obj) return false;
    if (typeof canvas.bringForward === 'function') { canvas.bringForward(obj); return true; }
    if (typeof canvas.bringObjectForward === 'function') return canvas.bringObjectForward(obj, false);
    if (typeof canvas.bringObjectToFront === 'function') return canvas.bringObjectToFront(obj);
    return false;
  };

  TE._stackDown = function (canvas, obj) {
    if (!canvas || !obj) return false;
    if (typeof canvas.sendBackwards === 'function') { canvas.sendBackwards(obj); return true; }
    if (typeof canvas.sendObjectBackwards === 'function') return canvas.sendObjectBackwards(obj, false);
    if (typeof canvas.sendObjectToBack === 'function') return canvas.sendObjectToBack(obj);
    if (typeof canvas.sendToBack === 'function') { canvas.sendToBack(obj); return true; }
    return false;
  };

  TE._moveToIndex = function (canvas, obj, idx) {
    if (!canvas || !obj) return false;
    if (typeof canvas.moveTo === 'function') { canvas.moveTo(obj, idx); return true; }
    if (typeof canvas.moveObjectTo === 'function') return canvas.moveObjectTo(obj, idx);
    return false;
  };

  TE.moveLayerByUid = function (uid, dir) {
    const c = TE.state.canvas;
    const o = TE.getObjectByUid(uid);
    if (!c || !o) return;

    if (dir > 0) TE._stackUp(c, o);
    else TE._stackDown(c, o);

    c.requestRenderAll();
    TE.refreshLayers();
  };

  // Reorder by UI order (top -> bottom)
  TE.reorderLayersByDisplayOrder = function (uidsTopFirst) {
    const c = TE.state.canvas;
    if (!c || !Array.isArray(uidsTopFirst) || !uidsTopFirst.length) return;

    const uidsBottomFirst = uidsTopFirst.slice().reverse().map(Number).filter(Boolean);

    uidsBottomFirst.forEach((uid, targetIndex) => {
      const obj = TE.getObjectByUid(uid);
      if (obj) TE._moveToIndex(c, obj, targetIndex);
    });

    c.requestRenderAll();
    TE.refreshLayers();
  };

  // ---------------------------
  // Add Photo placeholder
  // ---------------------------
  TE.addPhotoPlaceholder = function () {
    const c = TE.state.canvas;
    if (!c) return;

    const count = (typeof TE.renumberPhotoPlaceholders === 'function')
      ? TE.renumberPhotoPlaceholders()
      : (TE.state.photoCounter || 0);

    const idx = count + 1;
    TE.state.photoCounter = idx;

    const rect = new fabric.Rect({
      left: 0,
      top: 0,
      width: 420,
      height: 280,
      fill: TE.pbPaletteFill(idx),
      stroke: '#111',
      strokeDashArray: [10, 8],
      strokeWidth: 4,
      originX: 'left',
      originY: 'top'
    });

    const txt = new fabric.Text(fmt('te.layer.photo.placeholder', 'FOTO {idx}', { idx }), {
      left: 16,
      top: 16,
      fontSize: 34,
      fill: '#111',
      fontFamily: 'Arial',
      originX: 'left',
      originY: 'top'
    });

    const g = new fabric.Group([rect, txt], {
      left: 80 + (idx - 1) * 18,
      top: 80 + (idx - 1) * 18,
      angle: 0,
      originX: 'left',
      originY: 'top'
    });

    g.pbType = 'photo';
    g.pbIndex = idx;
    TE.ensureUid(g);

    TE.fixPhotoPlaceholderRender(g);

    c.add(g);
    c.setActiveObject(g);
    c.requestRenderAll();
    TE.setSelected(g);
  };

  // ---------------------------
  // Add image (server url) - robust
  // ---------------------------
  TE._fabricLoadImage = function (url, opts) {
    const ImageClass = (window.fabric && (fabric.FabricImage || fabric.Image)) || null;
    const fromURL = ImageClass && ImageClass.fromURL;
    if (!fromURL) return Promise.reject(new Error(pbT('te.fabric.fromurl_missing', 'fabric Image.fromURL fehlt')));

    opts = opts || {};

    // Fabric v6+: Promise API
    try {
      const maybe = fromURL.call(ImageClass, url, opts);
      if (maybe && typeof maybe.then === 'function') return maybe;
    } catch (e) {}

    // Fabric v4/v5: Callback API
    return new Promise((resolve, reject) => {
      try {
        fromURL.call(ImageClass, url, (img) => {
          if (img) resolve(img);
          else reject(new Error(pbT('te.fabric.fromurl_returned_null', 'fromURL lieferte null')));
        }, opts);
      } catch (err) {
        reject(err);
      }
    });
  };

  TE.addImageFromServer = function (imageUrl, relPath, displayName) {
    const c = TE.state.canvas;
    if (!c) {
      TE.toast && TE.toast(pbT('te.canvas.no_active', 'Kein Canvas aktiv'));
      return;
    }

    const url = new URL(imageUrl, window.location.href).toString();

    return TE._fabricLoadImage(url, { crossOrigin: 'anonymous' })
      .catch(() => TE._fabricLoadImage(url))
      .then((img) => {
        img.set({
          left: 0,
          top: 0,
          originX: 'left',
          originY: 'top',
          selectable: true,
          evented: true
        });

        const maxW = Math.min(600, (TE.state.width || 0) - 40);
        if (maxW > 0 && img.width && img.width > maxW) img.scaleToWidth(maxW);

        img.pbType = 'image';
        img.pbSrc = relPath;
        img.pbName = displayName || pbT('te.layer.image.default_name', 'IMAGE');
        TE.ensureUid(img);

        c.add(img);
        c.setActiveObject(img);
        img.setCoords();
        c.requestRenderAll();
        TE.setSelected(img);
        TE.refreshLayers();

        return img;
      })
      .catch((err) => {
        console.error(pbT('te.image.load_failed.console', 'Bild-Laden fehlgeschlagen:'), url, err);
        TE.toast && TE.toast(pbT('te.image.could_not_load.toast', 'Bild konnte nicht geladen werden'));
      });
  };

  // ---------------------------
  // Z-order / delete (selected)
  // ---------------------------
  TE.bringForward = function () {
    const c = TE.state.canvas;
    const o = TE.state.selected;
    if (!c || !o) return;
    TE._stackUp(c, o);
    c.requestRenderAll();
    TE.refreshLayers();
  };

  TE.sendBackwards = function () {
    const c = TE.state.canvas;
    const o = TE.state.selected;
    if (!c || !o) return;
    TE._stackDown(c, o);
    c.requestRenderAll();
    TE.refreshLayers();
  };

  TE.deleteSelected = function () {
    const c = TE.state.canvas;
    const o = TE.state.selected;
    if (!c || !o) return;

    const wasPhoto = (o.pbType === 'photo');

    c.remove(o);
    c.discardActiveObject();
    c.requestRenderAll();
    TE.setSelected(null);

    if (wasPhoto && typeof TE.renumberPhotoPlaceholders === 'function') {
      TE.renumberPhotoPlaceholders();
    }
  };
})();
