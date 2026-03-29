// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

(function ($) {
  'use strict';

  function setOverlay(on) {
    const el = document.getElementById('loadingOverlay');
    if (!el) return;

    if (on) {
      el.hidden = false;
      el.setAttribute('aria-busy', 'true');
    } else {
      el.hidden = true;
      el.setAttribute('aria-busy', 'false');
    }
  }

  $(function () {
    setOverlay(true);

    // Wenn Config-Laden startet
    $(document).on('pb:configLoading', function () {
      setOverlay(true);
    });

    // Wenn alle Configs geladen sind: aus
    $(document).on('pb:allConfigsLoaded pb:configLoaded', function () {
      setOverlay(false);
    });

    // Fail-safe: falls etwas schiefgeht, nach 30s ausblenden
    setTimeout(function () {
      setOverlay(false);
    }, 30000);
  });

})(window.jQuery);
