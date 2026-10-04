// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * UI Reload Timer — Photobox WebUI
 * Lädt die WebUI in festen Abständen neu, um Browser-Zustand
 * (Memory, hängende Timer/Requests, DOM-Reste) regelmäßig
 * aufzuräumen. Kein Fehler-Erkennungsmechanismus — die
 * CameraBridge (eigener Prozess) ist davon nicht betroffen,
 * ein Reload betrifft ausschließlich die Web-Oberfläche.
 *
 * Config: general.system.ui_watchdog_minutes
 *   0   → deaktiviert
 *   >0  → Minuten zwischen zwei Reloads
 *
 * Läuft während eines aktiven Captures nicht an — wird in dem
 * Fall verschoben und direkt nach Capture-Ende nachgeholt.
 *
 * Der Zeitpunkt des letzten Reloads wird in sessionStorage
 * gehalten, damit das Intervall über einen Reload hinweg
 * korrekt weiterzählt (nicht bei jedem Reload neu bei 0 startet).
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
  const intervalMin = Number(sys.ui_watchdog_minutes) || 0;

  if (intervalMin <= 0) {
    console.info(t("ui.watchdog.log.disabled", "[UI Reload Timer] disabled (ui_watchdog_minutes = 0)"));
    return;
  }

  const INTERVAL_MS = intervalMin * 60 * 1000;
  const CHECK_INTERVAL_MS = 60 * 1000; // fix: 1 Minute
  const STOP_TIMEOUT_MS = 4000;
  const STOP_SETTLE_MS = 150;
  const STORAGE_KEY = "pb_uiReloadTimer_lastReloadTs";

  function getLastReloadTs() {
    const raw = Number(sessionStorage.getItem(STORAGE_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : null;
  }

  function setLastReloadTs(ts) {
    sessionStorage.setItem(STORAGE_KEY, String(ts));
  }

  // Erster Start in dieser Browser-Session: Referenzzeitpunkt setzen
  if (getLastReloadTs() === null) {
    setLastReloadTs(Date.now());
  }

  console.info(
    t(
      "ui.watchdog.log.enabled",
      "[UI Reload Timer] enabled: reload every {min} min",
      { min: intervalMin }
    )
  );

  async function stopBeforeReload() {
    if (typeof PB.stopLiveviewForUiAction === "function") {
      return PB.stopLiveviewForUiAction("ui-reload-timer", {
        timeoutMs: STOP_TIMEOUT_MS,
        waitAfterMs: STOP_SETTLE_MS,
        blankPreview: true
      });
    }

    const stopFn =
      (PB.captureApi && typeof PB.captureApi.liveviewStop === "function" && PB.captureApi.liveviewStop.bind(PB.captureApi)) ||
      (PB.bridge && typeof PB.bridge.liveviewStop === "function" && PB.bridge.liveviewStop.bind(PB.bridge));

    $(document).trigger("pb:before-browser-reload", [
      { reason: "ui-reload-timer", via: "ui-reload-timer", hasStopApi: !!stopFn }
    ]);

    if (!stopFn) return { ok: false, skipped: true, reason: "ui-reload-timer", hasStopApi: false };

    try {
      return await Promise.race([
        Promise.resolve(stopFn()),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error(`LiveView stop timeout after ${STOP_TIMEOUT_MS}ms`)), STOP_TIMEOUT_MS)
        )
      ]);
    } catch (err) {
      console.warn("[UI Reload Timer] liveview stop before reload failed:", err);
      return { ok: false, reason: "ui-reload-timer", error: err };
    }
  }

  function doReload() {
    if (window.__pbReloading) return;
    window.__pbReloading = true;

    console.warn(
      t(
        "ui.watchdog.log.interval_reload",
        "[UI Reload Timer] {min} min erreicht – Seite wird neu geladen",
        { min: intervalMin }
      )
    );

    (async () => {
      try {
        await stopBeforeReload();
      } finally {
        setLastReloadTs(Date.now());
        location.reload();
      }
    })();
  }

  setInterval(() => {
    if (window.__pbReloading) return;

    // Während eines aktiven Captures nie reloaden — beim nächsten
    // Check (spätestens nach Capture-Ende) wird es nachgeholt.
    if (PB.captureFlow?.isRunning?.()) return;

    const lastReloadTs = getLastReloadTs() ?? Date.now();
    if (Date.now() - lastReloadTs < INTERVAL_MS) return;

    doReload();
  }, CHECK_INTERVAL_MS);
})(jQuery);
