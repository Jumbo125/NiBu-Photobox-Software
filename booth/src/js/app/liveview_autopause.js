// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ===========================================================
 * liveview_autopause.js
 * -----------------------------------------------------------
 * Stoppt den LiveView automatisch nach X Minuten Inaktivität
 * (kein Capture). Schützt die Kamera bei langen Events vor
 * Überhitzung und dem Nikon-Hardware-Autostop.
 *
 * Config: camera.camera_settings.liveview_auto_pause_minutes
 *   0 = deaktiviert (default)
 *   >0 = Minuten bis Auto-Pause
 *
 * Der Timer wird zurückgesetzt bei:
 *   - pb:captureSessionStarted (Capture beginnt)
 *   - pb:captureFlowDone       (Capture abgeschlossen)
 *   - pb:allConfigsLoaded      (Programmstart)
 *   - manuellem Aufruf von PB.liveviewAutopause.reset()
 *
 * Beim Capture-Start (preparePreviewForSeries) wird LiveView
 * ohnehin neu gestartet — kein spezieller Restart nötig.
 * =========================================================== */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  let _timer = null;

  function getConfigMinutes() {
    const raw = PB._getDeep?.(
      window.PB_CONFIG,
      "camera.camera_settings.liveview_auto_pause_minutes"
    );
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function isAlwaysActive() {
    return PB.readBool?.(
      PB._getDeep?.(window.PB_CONFIG, "camera.camera_settings.liveview_always_active")
    );
  }

  function cancel() {
    if (_timer) {
      clearTimeout(_timer);
      _timer = null;
    }
  }

  function pause() {
    cancel();

    // Nur pausieren wenn liveview_always_active aktiv ist
    // (sonst läuft LiveView ohnehin nicht dauerhaft)
    if (!isAlwaysActive()) return;

    // Nicht eingreifen wenn Capture läuft
    if (PB.captureFlow?.isRunning?.()) return;

    PB.captureApi?.liveviewStop?.().catch(() => {});
    PB.preview?.showOverlay?.();

    // _liveviewWarm zurücksetzen damit beim nächsten Capture
    // der erste-Start-Pfad (Bridge-Poll etc.) wieder greift
    PB.captureFlow._liveviewWarm = false;

    console.log("[liveview_autopause] LiveView pausiert nach Inaktivität.");
  }

  function reset() {
    cancel();

    const minutes = getConfigMinutes();
    if (minutes <= 0) return;
    if (!isAlwaysActive()) return;

    _timer = setTimeout(pause, minutes * 60 * 1000);
  }

  PB.liveviewAutopause = { reset, cancel };

  // Timer bei Programmstart starten
  $(document).on("pb:allConfigsLoaded.autopause", function () {
    reset();
  });

  // Nach jedem Capture zurücksetzen
  $(document).on("pb:captureFlowDone.autopause", function () {
    reset();
  });

  // Während Capture läuft: Timer pausieren (kein vorzeitiges Stoppen)
  $(document).on("pb:captureSessionStarted.autopause", function () {
    cancel();
  });

  // Fallback: Config bereits geladen
  if (window.PB._configsLoaded) {
    reset();
  }
})(jQuery);
