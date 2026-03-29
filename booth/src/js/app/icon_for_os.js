// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

// OS-Icon neben dem Select synchron halten

(function ($) {
  'use strict';

  function iconClassForOs(osVal) {
    switch ((osVal || '').toLowerCase()) {
      case 'mac':   return 'bi bi-apple';
      case 'linux': return 'bi bi-ubuntu';
      default:      return 'bi bi-windows';
    }
  }

  function updateOsIcon() {
    const v = $('#settingOS').val();
    $('#settingOSIcon').attr('class', iconClassForOs(v));
  }

  $(function () {
    // initial (falls Config schon ins Form geschrieben wurde: einfach nachziehen)
    updateOsIcon();

    // bei Änderung
    $(document)
      .off('change.pbOsSelect', '#settingOS')
      .on('change.pbOsSelect', '#settingOS', updateOsIcon);

    // optional: wenn du irgendwo nach Config-Load Form-Felder befüllst,
    // kannst du danach einfach triggern oder Events abfangen:
    $(document)
      .off('pb:configLoaded.pbOsIcon pb:allConfigsLoaded.pbOsIcon')
      .on('pb:configLoaded.pbOsIcon pb:allConfigsLoaded.pbOsIcon', function () {
        updateOsIcon();
      });
  });


  // key for cameraBridge
    function toBase64Url(bytes) {
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }

    function generateKey(byteLen) {
      byteLen = byteLen || 32; // 32 bytes => ~43 chars base64url
      const bytes = new Uint8Array(byteLen);

      if (window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(bytes);
      } else {
        // fallback (less strong, but ok for legacy browsers)
        for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
      }

      return toBase64Url(bytes);
    }

    $(".KeyGen").on("click", function () {
      const key = generateKey(32);
      const id = $(this).attr("data-key-for");
      $(id).val(key).trigger("change").trigger("input");
    });

})(window.jQuery);
