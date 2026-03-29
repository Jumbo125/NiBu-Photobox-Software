/*
 * Template Editor – Align UI (ANCHOR fixed) + Fabric guideline extensions bootstrap
 *
 * Behavior:
 *  - 1 object selected: align to canvas
 *  - 2+ objects selected: first selected (anchor) stays fixed; all other selected objects align to anchor.
 *
 * IMPORTANT (Fix for "springt wo ganz anders hin"):
 *  When multiple objects are selected, Fabric wraps them in an ActiveSelection and sets each object's
 *  `group` to that ActiveSelection, meaning the object's left/top are in GROUP coordinates.
 *  So we MUST convert the canvas-space delta (dx/dy) into the object's local (group) coordinate space
 *  before applying it. Otherwise objects jump.
 *
 * Border/Shadow:
 *  Border is drawn as overlay (pbBorderOverlay). After programmatic moves we sync it immediately.
 */

/* global fabric, $, initAligningGuidelines, initCenteringGuidelines */
window.TE = window.TE || {};

(function () {
  'use strict';

  if (window.__TE_ALIGN_UI_ANCHOR_V2_BOUND) return;
  window.__TE_ALIGN_UI_ANCHOR_V2_BOUND = true;

  const TE = window.TE;

  function getCanvas() { return TE && TE.state ? TE.state.canvas : null; }

  function isBorderOverlay(o) {
    try { if (TE && typeof TE.isBorderOverlay === 'function') return !!TE.isBorderOverlay(o); } catch (_) {}
    return !!(o && (o.pbIsBorderOverlay || o.pbNoExport));
  }

  function getSelectedObjects(canvas) {
    if (!canvas) return [];
    if (typeof canvas.getActiveObjects === 'function') {
      return (canvas.getActiveObjects() || []).filter(Boolean);
    }
    const a = canvas.getActiveObject && canvas.getActiveObject();
    if (!a) return [];
    if (a.type === 'activeSelection' || a.type === 'ActiveSelection') {
      if (typeof a.getObjects === 'function') return (a.getObjects() || []).filter(Boolean);
      if (Array.isArray(a._objects)) return a._objects.filter(Boolean);
    }
    return [a];
  }

  function rectAbs(o) {
    if (!o || typeof o.getBoundingRect !== 'function') return { left: 0, top: 0, width: 0, height: 0 };
    // absolute + include transformations
    return o.getBoundingRect(true, true);
  }

  function canvasDeltaToLocal(o, dx, dy) {
    // If object is in a group/activeSelection, its left/top are in group coordinates.
    // Convert a canvas-space delta vector into the group's coordinate space.
    const g = o && o.group;
    if (!g || !window.fabric || !fabric.util || !fabric.Point) return { dx, dy };

    try {
      const inv = fabric.util.invertTransform(g.calcTransformMatrix());
      // vector conversion: transform (0,0) and (dx,dy) and subtract
      const p0 = fabric.util.transformPoint(new fabric.Point(0, 0), inv);
      const p1 = fabric.util.transformPoint(new fabric.Point(dx, dy), inv);
      return { dx: (p1.x - p0.x), dy: (p1.y - p0.y) };
    } catch (_) {
      return { dx, dy };
    }
  }

  function moveByCanvasDelta(o, dx, dy) {
    if (!o || (!dx && !dy)) return;

    const d = canvasDeltaToLocal(o, dx, dy);
    o.set({
      left: (Number(o.left) || 0) + (Number(d.dx) || 0),
      top: (Number(o.top) || 0) + (Number(d.dy) || 0)
    });

    if (typeof o.setCoords === 'function') o.setCoords();
    o.dirty = true;
  }

  function syncBorderOverlay(o) {
    try {
      if (TE && typeof TE._syncBorderOverlay === 'function' && typeof TE.getLayerStyle === 'function') {
        TE._syncBorderOverlay(o, TE.getLayerStyle(o));
      }
    } catch (_) {}
    try {
      if (o && o.pbBorderOverlay) {
        o.pbBorderOverlay.dirty = true;
        if (typeof o.pbBorderOverlay.setCoords === 'function') o.pbBorderOverlay.setCoords();
      }
    } catch (_) {}
  }

  function refreshActiveSelection(canvas) {
    if (!canvas) return;
    const a = canvas.getActiveObject && canvas.getActiveObject();
    if (!a) return;
    try {
      if (typeof a._calcBounds === 'function') a._calcBounds();
      if (typeof a._updateObjectsCoords === 'function') a._updateObjectsCoords();
      if (typeof a.setCoords === 'function') a.setCoords();
    } catch (_) {}
  }

  // -------- Anchor tracking: first selected object stays fixed --------
  function bindAnchorTracking(canvas) {
    if (!canvas || canvas.__teAnchorTrackingBoundV2) return;
    canvas.__teAnchorTrackingBoundV2 = true;

    const setAnchor = function (o) {
      if (!o || isBorderOverlay(o) || o.selectable === false) return;
      TE.state = TE.state || {};
      TE.state.alignAnchor = o;
    };

    canvas.on('selection:cleared', function () {
      TE.state = TE.state || {};
      TE.state.alignAnchor = null;
    });

    canvas.on('selection:created', function (e) {
      const sel = e && e.selected ? e.selected : null;
      if (sel && sel.length) setAnchor(sel[0]); // first selected
    });

    canvas.on('selection:updated', function () {
      // keep existing anchor if still selected, else pick the first active object
      const objs = getSelectedObjects(canvas).filter((o) => o && !isBorderOverlay(o) && o.selectable !== false);
      if (!objs.length) return;

      TE.state = TE.state || {};
      const a = TE.state.alignAnchor;
      if (a && objs.indexOf(a) >= 0) return;

      setAnchor(objs[0]);
    });
  }

  function getAnchor(objs) {
    TE.state = TE.state || {};
    const a = TE.state.alignAnchor;
    if (a && objs.indexOf(a) >= 0) return a;
    return objs[0] || null;
  }

  // -------- Align implementation --------
  TE.alignSelected = function (mode) {
    const canvas = getCanvas();
    if (!canvas) return;

    const objs = getSelectedObjects(canvas).filter((o) => o && !isBorderOverlay(o) && o.selectable !== false);
    if (!objs.length) return;

    // Single -> align to canvas
    if (objs.length === 1) {
      const o = objs[0];
      const r = rectAbs(o);
      const W = Number(TE.state && TE.state.width) || (canvas.getWidth ? canvas.getWidth() : 0);
      const H = Number(TE.state && TE.state.height) || (canvas.getHeight ? canvas.getHeight() : 0);

      let dx = 0, dy = 0;
      switch (String(mode)) {
        case 'left':     dx = 0 - r.left; break;
        case 'centerH':  dx = (W / 2) - (r.left + r.width / 2); break;
        case 'right':    dx = W - (r.left + r.width); break;

        case 'top':      dy = 0 - r.top; break;
        case 'middleV':  dy = (H / 2) - (r.top + r.height / 2); break;
        case 'bottom':   dy = H - (r.top + r.height); break;
        default: break;
      }

      moveByCanvasDelta(o, dx, dy);
      syncBorderOverlay(o);

      refreshActiveSelection(canvas);
      canvas.requestRenderAll();

      try { TE.syncInspectorFromSelected && TE.syncInspectorFromSelected(); } catch (_) {}
      try { TE.syncStyleInspectorFromSelected && TE.syncStyleInspectorFromSelected(); } catch (_) {}
      try { TE.refreshLayers && TE.refreshLayers(); } catch (_) {}
      return;
    }

    // Multi -> align others to anchor (first selected)
    const anchor = getAnchor(objs);
    if (!anchor) return;

    const ar = rectAbs(anchor);
    const axL = ar.left;
    const axC = ar.left + ar.width / 2;
    const axR = ar.left + ar.width;

    const ayT = ar.top;
    const ayC = ar.top + ar.height / 2;
    const ayB = ar.top + ar.height;

    objs.forEach((o) => {
      if (o === anchor) return;

      const r = rectAbs(o);
      let dx = 0, dy = 0;

      switch (String(mode)) {
        case 'left':     dx = axL - r.left; break;
        case 'centerH':  dx = axC - (r.left + r.width / 2); break;
        case 'right':    dx = axR - (r.left + r.width); break;

        case 'top':      dy = ayT - r.top; break;
        case 'middleV':  dy = ayC - (r.top + r.height / 2); break;
        case 'bottom':   dy = ayB - (r.top + r.height); break;
        default: break;
      }

      if (dx || dy) {
        moveByCanvasDelta(o, dx, dy);
        syncBorderOverlay(o);
      }
    });

    refreshActiveSelection(canvas);
    canvas.requestRenderAll();

    try { TE.syncInspectorFromSelected && TE.syncInspectorFromSelected(); } catch (_) {}
    try { TE.syncStyleInspectorFromSelected && TE.syncStyleInspectorFromSelected(); } catch (_) {}
    try { TE.refreshLayers && TE.refreshLayers(); } catch (_) {}
  };

  // -------- guidelines init (always on) --------
  function initGuidesOnce(canvas) {
    if (!canvas || canvas.__teGuidesInited) return;
    canvas.__teGuidesInited = true;
    try { if (typeof window.initCenteringGuidelines === 'function') initCenteringGuidelines(canvas); } catch (_) {}
    try { if (typeof window.initAligningGuidelines === 'function') initAligningGuidelines(canvas); } catch (_) {}
  }

  // -------- UI binding --------
  function bindUi() {
    $('#btnAlignLeft').off('click.teAlign').on('click.teAlign', function () { TE.alignSelected('left'); });
    $('#btnAlignCenterH').off('click.teAlign').on('click.teAlign', function () { TE.alignSelected('centerH'); });
    $('#btnAlignRight').off('click.teAlign').on('click.teAlign', function () { TE.alignSelected('right'); });

    $('#btnAlignTop').off('click.teAlign').on('click.teAlign', function () { TE.alignSelected('top'); });
    $('#btnAlignMiddleV').off('click.teAlign').on('click.teAlign', function () { TE.alignSelected('middleV'); });
    $('#btnAlignBottom').off('click.teAlign').on('click.teAlign', function () { TE.alignSelected('bottom'); });
  }

  $(function () {
    bindUi();

    if (typeof TE.onEditorReady === 'function') {
      TE.onEditorReady(function (canvas) {
        initGuidesOnce(canvas);
        bindAnchorTracking(canvas);
      });
    }

    $(document).on('te:editorReady', function () {
      const c = getCanvas();
      initGuidesOnce(c);
      bindAnchorTracking(c);
    });

    const c0 = getCanvas();
    initGuidesOnce(c0);
    bindAnchorTracking(c0);
  });
})();
