/* SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
 */

/* ============================================================================
 * camera_restore.js — Restore Kamera + Auto-LiveView + IFrame-Warmup
 *
 * Voraussetzungen:
 *  - Config Store: window.PB_CONFIG.general + window.PB_CONFIG.camera
 *  - LiveView Settings: window.PB_CONFIG.camera.camera_settings.liveview_always_active
 *                      window.PB_CONFIG.camera.camera_settings.liveview_fps_idle
 *  - Saved camera: window.PB_CONFIG.general.camera.selected_camera + general.camera.device
 *
 * Preview:
 *  - Iframe wird via PB.preview.ensureRunning()/setSource gestartet (preview.js)
 * ========================================================================== */
(function ($) {
  "use strict";
  window.PB = window.PB || {};
  const PB = window.PB;

  // i18n helper (Fallback bleibt lesbar, auch wenn pbT noch nicht verfügbar ist)
  const tr = (key, fallback) => (typeof window.pbT === "function" ? window.pbT(key, fallback) : fallback);

  const RETRY_MAX = 10;
  const RETRY_DELAY_MS = 180;

  let busy = false;
  let done = false;
  let retryCount = 0;

  const s = (v) => String(v ?? "").trim();
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? n : fallback;
  };

  function storeReady() {
    const g = PB._getDeep?.(window.PB_CONFIG, "general");
    const cs = PB._getDeep?.(window.PB_CONFIG, "camera.camera_settings");
    console.log("key" + Object.keys(g).length);
     console.log("key" + Object.keys(cs).length);
    return !!g && Object.keys(g).length > 0 && !!cs && Object.keys(cs).length > 0;
  }

  function scheduleRetry(reason) {
    if (done) return false;
    retryCount++;
    if (retryCount > RETRY_MAX) {
      console.warn(tr("camera_restore.log.retry_limit_reached", "[camera_restore] retry limit reached:"), reason);
      if (typeof PB._dbg === "function") {
        PB._dbg(tr("camera_restore.log.retry_limit_reached", "[camera_restore] retry limit reached:"), reason);
      }
      return false;
    }

    console.log(tr("camera_restore.log.retry", "[camera_restore] retry"), `${retryCount}/${RETRY_MAX}`, "-", reason);
    if (typeof PB._dbg === "function") {
      PB._dbg(tr("camera_restore.log.retry", "[camera_restore] retry"), `${retryCount}/${RETRY_MAX}`, "-", reason);
    }

    setTimeout(() => {
      PB.restoreSavedCameraAndLiveviewFromConfig?.().catch(() => {});
    }, RETRY_DELAY_MS);
    return true;
  }

  function readSavedCamera() {
    return PB._getDeep?.(window.PB_CONFIG, "general.camera.selected_camera") || {};
  }

  function readPreferredId(saved) {
    return PB._getDeep?.(window.PB_CONFIG, "general.camera.device") || saved?.id || saved?.usb_id || "";
  }

  function cfgAlwaysActive() {
    return !!PB._getDeep?.(window.PB_CONFIG, "camera.camera_settings.liveview_always_active");
  }

  function cfgIdleFps() {
    const raw = PB._getDeep?.(window.PB_CONFIG, "camera.camera_settings.liveview_fps_idle");
    const fps = num(raw, null);
    if (fps == null) return null;
    return Math.max(1, Math.min(60, Math.trunc(fps)));
  }

  function syncToggleBtn(isOn) {
    const btn = document.getElementById("btnTogglePreview");
    if (!btn) return;
    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
    btn.dataset.state = isOn ? "stream" : "overlay";
    const onIcon = btn.querySelector(".pb-icon-on");
    const offIcon = btn.querySelector(".pb-icon-off");
    if (onIcon) onIcon.classList.toggle("d-none", !isOn);
    if (offIcon) offIcon.classList.toggle("d-none", isOn);
  }

  function parseOptionDevice(opt) {
    try {
      let raw = opt?.getAttribute("data-device") || opt?.dataset?.device || "";
      if (!raw) return null;
      if (raw.includes("&quot;")) raw = raw.replace(/&quot;/g, '"');
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function readSelectedFromSelect(selectId = "settingDeviceSelected") {
    const sel = document.getElementById(selectId);
    if (!sel) return { id: "", name: "", serial: "" };

    const id = s(sel.value);
    const opt = sel.selectedOptions?.[0] || null;
    const name = opt ? s(opt.textContent) : id;

    const d = parseOptionDevice(opt);
    const serial = d ? s(d.Serial ?? d.serial ?? "") : "";

    return { id, name, serial };
  }

  async function selectOnBridge(serial, id) {
    if (serial && typeof PB.apiSelectCameraBySerial === "function") {
      return PB.apiSelectCameraBySerial(serial);
    }
    if (!serial && id && typeof PB.apiSelectCameraById === "function") {
      return PB.apiSelectCameraById(id);
    }
    return null;
  }

  async function warmupAndShowStreamIfAlwaysActive() {
    if (!cfgAlwaysActive()) return true; // nichts zu tun

    const fpsIdle = cfgIdleFps();

    // DOM muss da sein
    const lf = document.getElementById("liveFrame");
    const mw = document.getElementById("previewMediaWrap") || document.getElementById("previewArea");
    const ow = document.getElementById("previewOverlayWrap");
    if (!lf || !mw || !ow) return false; // -> retry

    // Preview-Modul muss verfügbar sein, sonst kann der iframe nicht zuverlässig gestartet werden
    if (!PB.preview || typeof PB.preview.ensureRunning !== "function") return false; // -> retry

    try {
      // Iframe "warm" starten (setzt src inkl. fps query)
      if (typeof PB.preview.setSource === "function") {
        await PB.preview.setSource("camera", fpsIdle != null ? { fps: fpsIdle } : {});
      } else {
        await PB.preview.ensureRunning();
      }

      // Sichtbar schalten
      if (typeof PB.preview.isStreamVisible === "function") {
        const isOn = !!PB.preview.isStreamVisible();
        if (!isOn && typeof PB.preview.toggleView === "function") {
          await PB.preview.toggleView();
        } else if (!isOn && typeof PB.preview.showStream === "function") {
          PB.preview.showStream();
        }
      } else if (typeof PB.preview.showStream === "function") {
        PB.preview.showStream();
      }

      syncToggleBtn(true);

      // Optional: Liveview-Toggle-Button-Sichtbarkeit synchronisieren (falls genutzt)
      PB.syncLiveviewToggleButtonVisibility?.();

      return true;
    } catch (e) {
      console.warn(tr("camera_restore.warn.warmup_failed", "[camera_restore] warmup failed:"), e);
      if (typeof PB._dbg === "function") PB._dbg(tr("camera_restore.warn.warmup_failed", "[camera_restore] warmup failed:"), e);

      // Bei Fehlern nicht die App killen – ein Retry ist hier sinnvoll
      return false;
    }
  }

  PB.restoreSavedCameraAndLiveviewFromConfig =
    PB.restoreSavedCameraAndLiveviewFromConfig ||
    async function () {
      if (done || busy) return false;
      busy = true;

      try {
        if (!storeReady()) {
          scheduleRetry(
            tr(
              "camera_restore.retry_reason.config_not_ready",
              "PB_CONFIG not ready (general + camera.camera_settings)"
            )
          );
          return false;
        }
        else{
       console.info(pbT("camera.settings.info.loaded", "Camera settings were loaded."));
        }

        // Device select muss da sein
        const selEl = document.getElementById("settingDeviceSelected");
        if (!selEl) {
          scheduleRetry(tr("camera_restore.retry_reason.select_missing", "settingDeviceSelected missing"));
          return false;
        }

        // 1) Device-Liste refreshen (damit Optionen existieren)
        if (typeof PB.refreshUnifiedDeviceSelection === "function") {
          try {
            await PB.refreshUnifiedDeviceSelection();
          } catch (e) {
            console.warn(e);
            if (typeof PB._dbg === "function") PB._dbg(e);
          }
        }

        // 2) UI anhand Config vorselektieren
        try {
          PB.applySelectedCameraFromConfig?.(window.PB_CONFIG);
          PB.writeSelectedDeviceToHiddenInputs?.();
        } catch (e) {
          console.warn(
            tr(
              "camera_restore.warn.apply_selected_camera_failed",
              "[camera_restore] applySelectedCameraFromConfig failed:"
            ),
            e
          );
          if (typeof PB._dbg === "function") {
            PB._dbg(
              tr(
                "camera_restore.warn.apply_selected_camera_failed",
                "[camera_restore] applySelectedCameraFromConfig failed:"
              ),
              e
            );
          }
        }

        // 3) Serial/Id bestimmen:
        //    - bevorzugt aus aktuell selektierter Option (data-device Serial)
        //    - fallback aus gespeicherter Config
        const saved = readSavedCamera();
        const fromUI = readSelectedFromSelect("settingDeviceSelected");

        const serial = fromUI.serial || s(saved.serial);
        const id = fromUI.id || s(readPreferredId(saved));

        // 4) Bridge selektieren (Serial bevorzugt)
        if (serial || id) {
          try {
            await selectOnBridge(serial, id);
          } catch (e) {
            console.warn(tr("camera_restore.warn.bridge_select_failed", "[camera_restore] bridge select failed:"), e);
            if (typeof PB._dbg === "function") {
              PB._dbg(tr("camera_restore.warn.bridge_select_failed", "[camera_restore] bridge select failed:"), e);
            }
          }
        }

        // 5) LiveView ggf. starten (always_active -> fps_idle)
        await PB.autoStartLiveviewAfterSelectFromConfig?.();

        // 6) Warmup: iframe wirklich starten + stream sichtbar machen
        const warmOk = await warmupAndShowStreamIfAlwaysActive();
        if (!warmOk) {
          scheduleRetry(tr("camera_restore.retry_reason.warmup_not_ready", "warmup not ready (preview/DOM/bridge)"));
          return false;
        }

        done = true;
        return true;
      } finally {
        busy = false;
      }
    };

  /* // ------------------------------------------------------------------
  // Trigger
  // ------------------------------------------------------------------
  // Loader feuert pb:allConfigsLoaded (pb_core.js).
  $(document)
    .off("pb:allConfigsLoaded.pbCameraRestore")
    .on("pb:allConfigsLoaded.pbCameraRestore", function () {
      PB.restoreSavedCameraAndLiveviewFromConfig?.().catch((e) => {
        console.warn(e);
        if (typeof PB._dbg === "function") PB._dbg(e);
      });
    });

  // Modal-Loader feuert pb:configLoaded (falls genutzt)
  $(document)
    .off("pb:configLoaded.pbCameraRestore")
    .on("pb:configLoaded.pbCameraRestore", function () {
      PB.restoreSavedCameraAndLiveviewFromConfig?.().catch((e) => {
        console.warn(e);
        if (typeof PB._dbg === "function") PB._dbg(e);
      });
    });

  // Fallback: nächster Tick
  setTimeout(function () {
    PB.restoreSavedCameraAndLiveviewFromConfig?.().catch((e) => {
      console.warn(e);
      if (typeof PB._dbg === "function") PB._dbg(e);
    });
  }, 0);  
  // Fallback: wenn Config schon geladen ist -> sofort, sonst einmal auf allConfigsLoaded warten
(function triggerRestoreWhenReady() {
  const run = () => {
    PB.restoreSavedCameraAndLiveviewFromConfig?.().catch((e) => {
      console.warn(e);
      if (typeof PB._dbg === "function") PB._dbg(e);
    });
  };

  // Falls das Script erst nach dem Config-Load geladen wurde
  if (storeReady()) {
    run();
    return;
  }

  // Sonst warten, bis alle Configs da sind (nur einmal!)
  $(document).one("pb:allConfigsLoaded.pbCameraRestoreFallback", run);
})(); */

})(jQuery);
