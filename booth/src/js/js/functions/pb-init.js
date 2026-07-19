// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ============================================================================
 * pb_init.js — App-Init (OHNE eigenes Debug-Overlay)
 *
 * Zweck:
 *  - Startet Bootstrap (lädt Configs + setzt Sprache + init devices)
 *  - Verdrahtet DOM-ready Bindings, die unabhängig vom Config-Load sein dürfen
 *
 * Wichtig:
 *  - KEIN Debug-Overlay hier drin, damit es nicht doppelt kommt.
 *  - Debug-Overlay kommt ausschließlich aus debug.js
 * ========================================================================== */
(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  // i18n helper (funktioniert auch, wenn i18n noch nicht geladen ist)
  const pbT = PB.pbT || window.pbT || PB.t || function (k, fb) { return fb || k; };

  $(function () {
    (PB._dbg || console.log)(
      pbT('pb_init.log.dom_ready', '[pb_init] dom ready')
    );

    // Einziger Einstieg: lädt alle Configs (über PB.initBootstrap -> PB.loadAllConfigs)
    if (typeof PB.initBootstrap === 'function') {
      PB.initBootstrap();
    } else {
      console.warn(
        pbT('pb_init.warn.init_bootstrap_missing', '[pb_init] PB.initBootstrap missing')
      );
    }

    // Bindings, die unabhängig vom Config-Load gesetzt werden dürfen
    PB.initUiFullscreenBindings?.();   // sollte intern auf pb:configLoaded reagieren
    PB.initModalConfigBindings?.();    // Modal/Form wiring

    PB.bindNumericKeypad?.({
      modalSel:  '#modalExitFullscreen',
      inputSel:  '#exitFullscreenPassword',
      keypadSel: '#exitFullscreenKeypad',
      errorSel:  '#exitFullscreenError'
    });

    // Debug-Mode Toggle Bindings (Overlay selbst kommt aus debug.js)
    PB.initDebugModeBindings?.();
  });

})(window.jQuery);
