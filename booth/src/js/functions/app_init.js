// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
/* ============================================================================
 * app_init.js — Side-Effect Initialisierung (nur Bootstrap starten + weitere Bindings)
 *
 * Änderung:
 *  - Keine direkte Nutzung von window.PB_CONFIG vor dem Laden!
 *  - Startet nur PB.initBootstrap() bei DOM ready
 *  - Restliche Bindings bleiben wie gehabt
 * ========================================================================== */
(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  $(function () {
    (PB._dbg || console.log)('[app_init] dom ready -> initBootstrap()');

    // ✅ einzig verlässlicher Einstieg: lädt Configs + setzt Sprache + init devices
    if (typeof PB.initBootstrap === 'function') {
      PB.initBootstrap();
    }

    // Toggle LiveView on off on LiveView screen
    PB.initLiveviewToggleBindings?.();
    // UI/Modal-Bindings, die unabhängig vom Config-Load sein dürfen:
    PB.initUiFullscreenBindings?.();   // bindet Button + pb:configLoaded listener
    PB.initModalConfigBindings?.();

    //Damit select device, der device change gleich die infos ins config schreibt
    //PB.initSelectDeviceBindings?.();
    
    // Tastenkeys initialisieren
    PB.bindNumericKeypad?.({
      modalSel:  '#modalExitFullscreen',
      inputSel:  '#exitFullscreenPassword',
      keypadSel: '#exitFullscreenKeypad',
      errorSel:  '#exitFullscreenError'
    });

    // Debug-Mode Change initialisieren
    PB.initDebugModeBindings?.();
  });


})(jQuery);