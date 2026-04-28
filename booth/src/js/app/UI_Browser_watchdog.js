// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * UI Watchdog — Photobox WebUI
 * Überwacht die Lebendigkeit der WebUI und löst bei längerem Stillstand
 * einen einmaligen Seiten-Reload aus.
 *
 * Config: general.system.ui_watchdog_minutes
 *   0   → deaktiviert
 *   >0  → Minuten ohne Lebenszeichen bis Reload
 */

(function ($) {
  "use strict";

  // i18n helper (pbT) + einfache {var}-Ersetzung
  const t = (key, fallback, vars) => {
    const base = typeof window.pbT === "function" ? window.pbT(key, fallback) : fallback;
    if (!vars) return String(base ?? "");
    return String(base ?? "").replace(/\{(\w+)\}/g, (_, k) =>
      vars[k] === undefined || vars[k] === null ? `{${k}}` : String(vars[k])
    );
  };

  const PB = window.PB || {};

  const sys = PB._getDeep?.(window.PB_CONFIG, "general.system") || {};
  const timeoutMin = Number(sys.ui_watchdog_minutes) || 0;

  if (timeoutMin <= 0) {
    console.info(t("ui.watchdog.log.disabled", "[UI Watchdog] disabled (ui_watchdog_minutes = 0)"));
    return;
  }

  const MAX_STALL_MS = timeoutMin * 60 * 1000;
  const CHECK_INTERVAL_MS = 60 * 1000; // fix: 1 Minute
  const CHECK_EVERY_SEC = Math.round(CHECK_INTERVAL_MS / 1000);
  const STOP_TIMEOUT_MS = 4000;
  const STOP_SETTLE_MS = 150;

  let lastHealthyTs = Date.now();

  console.info(
    t(
      "ui.watchdog.log.enabled",
      "[UI Watchdog] enabled: timeout = {min} min, check every = {sec}s",
      { min: timeoutMin, sec: CHECK_EVERY_SEC }
    )
  );

  async function stopBeforeWatchdogReload() {
    if (typeof PB.stopLiveviewForUiAction === "function") {
      return PB.stopLiveviewForUiAction("watchdog-reload", {
        timeoutMs: STOP_TIMEOUT_MS,
        waitAfterMs: STOP_SETTLE_MS,
        blankPreview: true
      });
    }

    const stopFn =
      (PB.captureApi && typeof PB.captureApi.liveviewStop === "function" && PB.captureApi.liveviewStop.bind(PB.captureApi)) ||
      (PB.bridge && typeof PB.bridge.liveviewStop === "function" && PB.bridge.liveviewStop.bind(PB.bridge));

    $(document).trigger("pb:before-browser-reload", [
      { reason: "watchdog-reload", via: "watchdog", hasStopApi: !!stopFn }
    ]);

    if (!stopFn) return { ok: false, skipped: true, reason: "watchdog-reload", hasStopApi: false };

    try {
      return await Promise.race([
        Promise.resolve(stopFn()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`LiveView stop timeout after ${STOP_TIMEOUT_MS}ms`)), STOP_TIMEOUT_MS)
        )
      ]);
    } catch (err) {
      console.warn("[UI Watchdog] liveview stop before reload failed:", err);
      return { ok: false, reason: "watchdog-reload", error: err };
    }
  }

  // Lebenszeichen aus Bridge-Status
  $(document).on("pb:bridgeHealth.watchdog", function (_, h) {
    if (h?.framesActive === true) lastHealthyTs = Date.now();
  });

  setInterval(() => {
    if (Date.now() - lastHealthyTs <= MAX_STALL_MS) return;
    if (window.__pbReloading) return;
    window.__pbReloading = true;

    console.warn(
      t(
        "ui.watchdog.log.stalled_reload",
        "[UI Watchdog] stalled for {min} minutes – reloading page",
        { min: timeoutMin }
      )
    );

    (async () => {
      try {
        await stopBeforeWatchdogReload();
      } finally {
        location.reload();
      }
    })();
  }, CHECK_INTERVAL_MS);
})(jQuery);
