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

  let lastHealthyTs = Date.now();

  console.info(
    t(
      "ui.watchdog.log.enabled",
      "[UI Watchdog] enabled: timeout = {min} min, check every = {sec}s",
      { min: timeoutMin, sec: CHECK_EVERY_SEC }
    )
  );

  // Lebenszeichen aus Bridge-Status
  $(document).on("pb:bridgeHealth.watchdog", function (_, h) {
    if (h?.framesActive === true) lastHealthyTs = Date.now();
  });

  setInterval(() => {
    if (Date.now() - lastHealthyTs > MAX_STALL_MS) {
      if (window.__pbReloading) return;
      window.__pbReloading = true;

      console.warn(
        t(
          "ui.watchdog.log.stalled_reload",
          "[UI Watchdog] stalled for {min} minutes – reloading page",
          { min: timeoutMin }
        )
      );

      location.reload();
    }
  }, CHECK_INTERVAL_MS);
})(jQuery);
