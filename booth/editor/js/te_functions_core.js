/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/* global fabric, $, bootstrap */
window.TE = window.TE || {};

(function () {
  'use strict';

  const TE = window.TE;

  // i18n helper: nutzt pbT(), falls vorhanden, sonst fallback
  const t = function (key, fallback) {
    return (typeof window.pbT === 'function') ? window.pbT(key, fallback) : fallback;
  };

  // ---------------------------
  // Palette Fill (Photos)
  // ---------------------------
  TE.pbPaletteFill = function (idx = 1) {
    const PB_PLACEHOLDER_FILLS = [
      'rgba(255, 99, 132, 1)',
      'rgba(54, 162, 235, 1)',
      'rgba(255, 206, 86, 1)',
      'rgba(75, 192, 192, 1)',
      'rgba(153, 102, 255, 1)',
      'rgba(255, 159, 64, 1)'
    ];
    const i = (Math.max(1, Number(idx) || 1) - 1) % PB_PLACEHOLDER_FILLS.length;
    return PB_PLACEHOLDER_FILLS[i];
  };

  // ---------------------------
  // State
  // ---------------------------
  TE.state = TE.state || {
    templateName: null,
    width: 0,
    height: 0,
    baseUrl: null, // "/templates/<name>/"
    canvas: null,

    photoCounter: 0,
    selected: null,
    suppressInspector: false,

    // View (nur Anzeige / UI)
    viewScale: 1,
    autoFit: true,
    _fitBound: false,

    // Layer IDs (stabil für delegated UI + re-order beim Import)
    _nextUid: 1,

    // Globales Template-Setting
    greenwall: false,
    // Greenwall asset (fixer Dateiname im assets/)
    greenwallSrc: '',
    greenwallName: '',
    greenwallAsset: null, // { name, relPath, url }

    // Hooks
    _onReady: []
  };

  // Stub, wird in layers_objects überschrieben (verhindert Fehler in initEditor)
  TE.refreshLayers = TE.refreshLayers || function () {};

  // ---------------------------
  // Hooks
  // ---------------------------
  TE.onEditorReady = function (fn) {
    if (typeof fn !== 'function') return;
    TE.state._onReady.push(fn);
  };

  TE._fireEditorReady = function () {
    const c = TE.state.canvas;
    TE.state._onReady.forEach((fn) => {
      try { fn(c); } catch (e) { /* ignore */ }
    });
  };

  // ---------------------------
  // Helpers
  // ---------------------------
  TE.toast = function (msg, ms = 1800) {
    const toastEl = document.getElementById('teToast');
    const bodyEl = document.getElementById('teToastBody');
    if (!toastEl || !bodyEl || !window.bootstrap) return;

    bodyEl.textContent = msg;
    const toast = window.bootstrap.Toast.getOrCreateInstance(toastEl, { delay: ms });
    toast.show();
  };

  TE.sanitizeNameClient = function (name) {
    return String(name || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_-]/g, '');
  };

  TE._clamp = function (v, min, max) {
    return Math.min(Math.max(v, min), max);
  };

  TE._esc = function (s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  };

  TE.getFrameEl = function () {
    return document.querySelector('.te-canvas-frame');
  };

  // Der echte Scroll-/Viewport-Container (wichtig für Pan + Zoom Centering)
  TE.getScrollEl = function () {
    return (
      document.querySelector('.te-canvas-wrap') ||
      document.querySelector('.te-canvas-scroll') ||
      document.querySelector('.te-canvas-frame')
    );
  };

  TE.postJson = async function (url, dataObj) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(dataObj || {}),
      cache: 'no-store'
    });

    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) {}

    if (!r.ok) {
      const fallback = t('net.err.http_status', 'HTTP {status}').replace('{status}', String(r.status));
      const msg = (data && data.error) ? data.error : (txt || fallback);
      throw new Error(msg);
    }
    return data;
  };

  TE.uploadFile = async function (url, formData) {
    const r = await fetch(url, { method: 'POST', body: formData, cache: 'no-store' });

    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) {}

    if (!r.ok) {
      const fallback = t('net.err.http_status', 'HTTP {status}').replace('{status}', String(r.status));
      const msg = (data && data.error) ? data.error : (txt || fallback);
      throw new Error(msg);
    }
    return data;
  };

  // ---------------------------
  // UID helpers (Layer mapping)
  // ---------------------------
  TE.ensureUid = function (obj, forcedId) {
    if (!obj) return 0;
    if (forcedId && Number.isFinite(Number(forcedId))) {
      obj.pbUid = Number(forcedId);
      TE.state._nextUid = Math.max(TE.state._nextUid, obj.pbUid + 1);
      return obj.pbUid;
    }
    if (!obj.pbUid) {
      obj.pbUid = TE.state._nextUid++;
    }
    return obj.pbUid;
  };

  TE.getObjectByUid = function (uid) {
    const c = TE.state.canvas;
    uid = Number(uid);
    if (!c || !uid) return null;
    return c.getObjects().find(o => Number(o.pbUid) === uid) || null;
  };

  TE.getUserLayerObjects = function () {
    const c = TE.state && TE.state.canvas;
    if (!c) return [];
    return c.getObjects().filter(o => !(o && (o.pbIsBorderOverlay || o.pbNoExport)));
  };
})();
