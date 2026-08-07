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
 * Der Inaktivitäts-Zeitpunkt wird zurückgesetzt bei:
 *   - pb:captureSessionStarted (Capture beginnt)
 *   - pb:captureFlowDone       (Capture abgeschlossen)
 *   - pb:allConfigsLoaded      (Programmstart)
 *   - manuellem Aufruf von PB.liveviewAutopause.reset()
 *
 * Der Zeitpunkt wird in sessionStorage gehalten (nicht nur im
 * Skript-Speicher), damit ein zwischenzeitlicher Seiten-Reload
 * (z.B. durch den UI-Reload-Timer) die bereits verstrichene
 * Inaktivitätszeit nicht verwirft — sonst könnte ein kurzes
 * ui_watchdog_minutes ein längeres liveview_auto_pause_minutes
 * nie zum Zug kommen lassen.
 *
 * Beim Capture-Start (preparePreviewForSeries) wird LiveView
 * ohnehin neu gestartet — kein spezieller Restart nötig.
 *
 * -----------------------------------------------------------
 * Zusätzlich: liveviewMaxRuntime
 * -----------------------------------------------------------
 * Hartes Laufzeitlimit für LiveView, UNABHÄNGIG von
 * liveview_always_active. Schützt die Kamera auch dann, wenn
 * LiveView durch andere Wege dauerhaft läuft (z.B. manuell vom
 * User offen gelassen), ohne dass liveview_always_active gesetzt
 * ist — in dem Fall würde der Inaktivitäts-Pause oben nie
 * greifen.
 *
 * Config: camera.camera_settings.liveview_max_runtime_minutes
 *   0 = deaktiviert (default)
 *   >0 = Minuten Dauerbetrieb bis Zwangsstopp
 *
 * Der Timer startet, sobald pb:bridgeHealth liveViewRunning=true
 * meldet, und wird zurückgesetzt sobald LiveView stoppt. Während
 * eines Captures wird nie eingegriffen.
 * =========================================================== */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  const AUTOPAUSE_STORAGE_KEY = "pb_liveviewAutopause_inactiveSinceTs";
  const AUTOPAUSE_CHECK_INTERVAL_MS = 15 * 1000;

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

  function getInactiveSince() {
    const raw = Number(sessionStorage.getItem(AUTOPAUSE_STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }

  function markInactiveSince(ts) {
    sessionStorage.setItem(AUTOPAUSE_STORAGE_KEY, String(ts));
  }

  function clearInactiveSince() {
    sessionStorage.removeItem(AUTOPAUSE_STORAGE_KEY);
  }

  function cancel() {
    clearInactiveSince();
  }

  function pause() {
    clearInactiveSince();

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
    if (getConfigMinutes() <= 0 || !isAlwaysActive()) {
      clearInactiveSince();
      return;
    }

    markInactiveSince(Date.now());
  }

  PB.liveviewAutopause = { reset, cancel };

  // Inaktivitäts-Zeitpunkt bei Programmstart setzen
  $(document).on("pb:allConfigsLoaded.autopause", function () {
    reset();
  });

  // Nach jedem Capture zurücksetzen
  $(document).on("pb:captureFlowDone.autopause", function () {
    reset();
  });

  // Während Capture läuft: kein Auto-Pause-Zeitpunkt aktiv
  $(document).on("pb:captureSessionStarted.autopause", function () {
    cancel();
  });

  // Fallback: Config bereits geladen
  if (window.PB._configsLoaded) {
    reset();
  }

  setInterval(() => {
    const minutes = getConfigMinutes();
    if (minutes <= 0) return;
    if (!isAlwaysActive()) return;
    if (PB.captureFlow?.isRunning?.()) return;

    const inactiveSince = getInactiveSince();
    if (inactiveSince === null) return;

    if (Date.now() - inactiveSince >= minutes * 60 * 1000) {
      pause();
    }
  }, AUTOPAUSE_CHECK_INTERVAL_MS);

  /* ---------------------------------------------------------
   * liveviewMaxRuntime — hartes Laufzeitlimit, unabhängig von
   * liveview_always_active
   *
   * Der Startzeitpunkt der laufenden LiveView-Session wird in
   * sessionStorage gehalten (nicht nur im Skript-Speicher), damit
   * ein zwischenzeitlicher Seiten-Reload (z.B. durch den
   * UI-Reload-Timer) die bereits gelaufene Zeit nicht verwirft.
   * Ein setInterval prüft periodisch die tatsächlich verstrichene
   * Laufzeit statt sich auf einen einzelnen setTimeout zu verlassen.
   * --------------------------------------------------------- */
  const MAX_RUNTIME_STORAGE_KEY = "pb_liveviewMaxRuntime_startedAtTs";
  const MAX_RUNTIME_CHECK_INTERVAL_MS = 30 * 1000;

  let _liveviewCurrentlyRunning = false;

  function getMaxRuntimeMinutes() {
    const raw = PB._getDeep?.(
      window.PB_CONFIG,
      "camera.camera_settings.liveview_max_runtime_minutes"
    );
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  function getRuntimeStartedAt() {
    const raw = Number(sessionStorage.getItem(MAX_RUNTIME_STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }

  function markRuntimeStarted() {
    if (getRuntimeStartedAt() === null) {
      sessionStorage.setItem(MAX_RUNTIME_STORAGE_KEY, String(Date.now()));
    }
  }

  function clearRuntimeStarted() {
    sessionStorage.removeItem(MAX_RUNTIME_STORAGE_KEY);
  }

  function forceStopForMaxRuntime() {
    // Nicht eingreifen wenn Capture läuft — beim nächsten Check
    // erneut versuchen, der Startzeitpunkt bleibt dabei unverändert.
    if (PB.captureFlow?.isRunning?.()) return;

    clearRuntimeStarted();

    PB.captureApi?.liveviewStop?.().catch(() => {});
    PB.preview?.showOverlay?.();
    PB.captureFlow._liveviewWarm = false;

    console.log("[liveview_autopause] LiveView nach Laufzeitlimit zwangsweise gestoppt.");
  }

  $(document).on("pb:bridgeHealth.autopause-maxruntime", function (_, h) {
    const running = !!h?.liveViewRunning;

    if (running && !_liveviewCurrentlyRunning) {
      _liveviewCurrentlyRunning = true;
      markRuntimeStarted();
    } else if (!running && _liveviewCurrentlyRunning) {
      _liveviewCurrentlyRunning = false;
      clearRuntimeStarted();
    }
  });

  setInterval(() => {
    const minutes = getMaxRuntimeMinutes();
    if (minutes <= 0) return;
    if (!_liveviewCurrentlyRunning) return;

    const startedAt = getRuntimeStartedAt();
    if (startedAt === null) return;

    if (Date.now() - startedAt >= minutes * 60 * 1000) {
      forceStopForMaxRuntime();
    }
  }, MAX_RUNTIME_CHECK_INTERVAL_MS);
})(jQuery);
