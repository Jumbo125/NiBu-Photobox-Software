// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

(function () {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  // Schutz: Overlay nur einmal installieren
  if (PB.__debugOverlayInstalled) return;
  PB.__debugOverlayInstalled = true;

  // Default: true bis Config geladen ist (damit frühe Fehler sichtbar sind)
  let enabled = true;

  const OVERLAY_ID = 'pbDebugBox';
  const LEGACY_ID = 'pbDebug'; // Legacy-Element-ID (falls vorhanden)

  // i18n helper (pbT kann ggf. noch nicht geladen sein)
  function tr(key, fallback) {
    try {
      return (typeof pbT === 'function') ? pbT(key, fallback) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  /**
   * Liest debugMode aus der Config:
   * - neu: general.system.debugMode
   * - legacy: system.debugMode
   */
  function readDebugMode(cfg) {
    const c = cfg || window.PB_CONFIG || {};
    if (typeof PB._getDeep === 'function') {
      const vNew = PB._getDeep(c, 'general.system.debugMode');
      if (vNew !== undefined) return !!vNew;

      const vOld = PB._getDeep(c, 'system.debugMode');
      if (vOld !== undefined) return !!vOld;
    }
    return !!(c?.general?.system?.debugMode ?? c?.system?.debugMode);
  }

  /**
   * Sorgt dafür, dass es genau eine Overlay-Box gibt:
   * - reuse pbDebugBox, sonst legacy pbDebug, sonst neu erstellen
   */
  function ensureBox() {
    let box = document.getElementById(OVERLAY_ID) || document.getElementById(LEGACY_ID);

    if (!box) {
      box = document.createElement('pre');
      box.id = OVERLAY_ID;

      const mount = () => {
        if (!document.body) return;
        document.body.appendChild(box);
      };

      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', mount, { once: true });
      } else {
        mount();
      }
    } else {
      if (box.id !== OVERLAY_ID) box.id = OVERLAY_ID;
    }

    box.style.display = enabled ? 'block' : 'none';
    return box;
  }

  function setEnabled(on) {
    enabled = !!on;

    const box = document.getElementById(OVERLAY_ID);
    if (box) box.style.display = enabled ? 'block' : 'none';

    const body = document.body;
    if (body) body.classList.toggle('debug', enabled);
  }

  function fmt(a) {
    if (a instanceof Error) return a.stack || a.message;
    if (typeof a === 'string') return a;
    try {
      return JSON.stringify(a);
    } catch (_) {
      return String(a);
    }
  }

  function log(...args) {
    console.log(...args);

    if (!enabled) return;
    const box = ensureBox();
    box.textContent += args.map(fmt).join(' ') + '\n';
  }

  // Global error hooks bleiben immer aktiv
  window.addEventListener('error', (e) => {
    log(
      tr('debug_overlay.log.error_prefix', '[ERROR]'),
      e.message,
      e.filename + ':' + e.lineno + ':' + e.colno
    );
  });

  window.addEventListener('unhandledrejection', (e) => {
    log(
      tr('debug_overlay.log.promise_prefix', '[PROMISE]'),
      (e.reason instanceof Error)
        ? (e.reason.stack || e.reason.message)
        : e.reason
    );
  });

  // Public API
  PB._dbg = log;
  PB.setDebugOverlayEnabled = setEnabled;

  function applyFromConfig(cfg) {
    const on = readDebugMode(cfg);
    setEnabled(on);
    console.log(tr('debug_overlay.log.config_value', '[debug] general.system.debugMode = ') + on);
  }

  // Initialer Sync (falls PB_CONFIG schon existiert)
  const immediate = readDebugMode(window.PB_CONFIG);
  if (immediate !== undefined) setEnabled(immediate);

  // Event Listener (wenn jQuery benutzt wird)
  if (window.jQuery) {
    window.jQuery(document)
      .off('pb:configLoaded.debugOverlay')
      .on('pb:configLoaded.debugOverlay', function (e, cfg) {
        applyFromConfig(cfg || window.PB_CONFIG);
      });
  }

  log(tr('debug_overlay.log.installed_waiting', '[debug] overlay installed (waiting for config)'));
})();
