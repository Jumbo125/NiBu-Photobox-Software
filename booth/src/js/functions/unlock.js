// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/** unlock.js — System-Passwort + Numeric Keypad Binding */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  /**
   * Liest das System-Passwort aus der Konfiguration.
   * Nutzung: const pw = PB.getSystemPassword();
   */
  PB.getSystemPassword = function () {
    const pw = PB._getDeep(window.PB_CONFIG || {}, "general.system.password");
    return pw == null ? "" : String(pw);
  };

  /**
   * Bindet ein Numeric-Keypad an ein Passwort-Input (z.B. Exit-Fullscreen-Modal).
   *
   * opts:
   *  - modalSel:  Selector für Modal (default: #modalExitFullscreen)
   *  - inputSel:  Selector für Input (default: #exitFullscreenPassword)
   *  - keypadSel: Selector für Keypad-Container (default: #exitFullscreenKeypad)
   *  - errorSel:  Selector für Error-Container (default: #exitFullscreenError)
   */
  PB.bindNumericKeypad = function (opts) {
    opts = opts || {};

    const modalSel = opts.modalSel || "#modalExitFullscreen";
    const inputSel = opts.inputSel || "#exitFullscreenPassword";
    const keypadSel = opts.keypadSel || "#exitFullscreenKeypad";
    const errorSel = opts.errorSel || "#exitFullscreenError";

    // Alte Handler entfernen (wichtig bei Re-Init)
    $(document).off("click.pbKeypad", `${keypadSel} [data-keypad-digit]`);
    $(document).off("click.pbKeypad", `${keypadSel} [data-keypad-action]`);
    $(document).off("shown.bs.modal.pbKeypad", modalSel);

    // Digits
    $(document).on("click.pbKeypad", `${keypadSel} [data-keypad-digit]`, function (e) {
      e.preventDefault();

      const digit = String($(this).attr("data-keypad-digit") || "");
      $(errorSel).addClass("d-none");

      const $in = $(inputSel);
      $in.val(($in.val() || "") + digit).trigger("focus");
    });

    // Actions (back/clear)
    $(document).on("click.pbKeypad", `${keypadSel} [data-keypad-action]`, function (e) {
      e.preventDefault();

      const action = String($(this).attr("data-keypad-action") || "");
      $(errorSel).addClass("d-none");

      const $in = $(inputSel);
      const val = String($in.val() || "");

      if (action === "back") $in.val(val.slice(0, -1));
      if (action === "clear") $in.val("");

      $in.trigger("focus");
    });

    // Beim Öffnen des Modals zurücksetzen
    $(document).on("shown.bs.modal.pbKeypad", modalSel, function () {
      $(errorSel).addClass("d-none");
      $(inputSel).val("").trigger("focus");
    });
  };
})(jQuery);
