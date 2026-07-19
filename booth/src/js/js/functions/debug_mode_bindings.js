// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  // Helper: lies debug-Flag aus Config
  function readDebugFlag(cfg) {
    const c = cfg || window.PB_CONFIG || {};
    return !!(c.general && c.general.system && c.general.system.debugMode);
  }

  // Helper: schreibe debug-Flag in Config
  function writeDebugFlag(on) {
    window.PB_CONFIG = window.PB_CONFIG || {};
    window.PB_CONFIG.general = window.PB_CONFIG.general || {};
    window.PB_CONFIG.general.system = window.PB_CONFIG.general.system || {};
    window.PB_CONFIG.general.system.debugMode = !!on;
  }

  $(function () {
    // 1) Sofort reagieren, wenn User Toggle klickt (ohne Save)
    $(document)
      .off('change.pbDebugToggle', '#debugMode')
      .on('change.pbDebugToggle', '#debugMode', function () {
        const on = !!$(this).prop('checked');

        // Overlay sofort ein/aus
        if (typeof PB.setDebugOverlayEnabled === 'function') {
          PB.setDebugOverlayEnabled(on);
        }

        // optional: in-memory Config sofort mitziehen
        writeDebugFlag(on);

        (PB._dbg || console.log)(
          pbT('debug_guard.log.toggle', '[debug_guard] toggle -> ') + on
        );
      });

    // 2) Wenn Config geladen/gespeichert wird: Toggle + Overlay synchronisieren
    $(document)
      .off('pb:configLoaded.pbDebugToggle')
      .on('pb:configLoaded.pbDebugToggle', function (e, cfg) {
        const on = readDebugFlag(cfg);
        $('#debugMode').prop('checked', on);

        if (typeof PB.setDebugOverlayEnabled === 'function') {
          PB.setDebugOverlayEnabled(on);
        }

        console.log(
          pbT('debug_guard.log.config_value', '[debug_guard] system.debugMode = ') + on
        );
      });

    // 3) Initial sync (falls PB_CONFIG schon da ist)
    const initial = readDebugFlag(window.PB_CONFIG);
    $('#debugMode').prop('checked', initial);

    if (typeof PB.setDebugOverlayEnabled === 'function') {
      PB.setDebugOverlayEnabled(initial);
    }
  });

})(window.jQuery);
