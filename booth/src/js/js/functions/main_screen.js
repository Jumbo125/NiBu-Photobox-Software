// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/** main_screen.js — UI: applyUiFromConfig + Fullscreen CSS-Modus */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  /**
   * Wendet UI-relevante Config (z.B. Background) auf die Seite an.
   * Handhabung: PB.applyUiFromConfig(window.PB_CONFIG);
   */
  PB.applyUiFromConfig = PB.applyUiFromConfig || function (cfg) {
    const src = cfg || window.PB_CONFIG || {};
    const bg = PB._getDeep(src, 'general.ui.main_background_color');

    if (bg) {
      const body = document.querySelector('body');
      const app = document.querySelector('#appMain');
      if (body) body.style.setProperty('background-color', bg, 'important');
      if (app) app.style.setProperty('background-color', bg, 'important');
    }

    // bgStaticImg ebenfalls direkt anwenden (nach Save sofort sichtbar)
    const bgPath = PB._getDeep(src, 'general.ui.bgStaticImg') || '';
    if (typeof PB.applyBgStaticImg === 'function') {
      PB.applyBgStaticImg(bgPath);
    } else {
      // fallback, falls Funktion noch nicht geladen ist
      const wrap = document.getElementById('bgStaticImg');
      if (wrap) wrap.innerHTML = '';
    }
  };

  /**
   * Prüft, ob die UI im 'pb-fullscreen' CSS-Modus ist (kein echtes Browser-Fullscreen).
   */
  PB.isFullscreen = PB.isFullscreen || function () {
    return $('body').hasClass('pb-fullscreen');
  };

})(jQuery);
