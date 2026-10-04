/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/**
 * camerabridgeserver.js
 * -----------------------------------------------------------------------------
 * UI-Bindings für Start/Stop/Restart des CameraBridge API-Servers.
 *
 * Ablauf:
 *  1) Ping Kestrel (/api/status) mit Bridge.AuthKey → bei Erfolg Status abrufen (mit Key).
 *  2) Wenn Kestrel down → Ping Python
 *     - Wenn Python down → starte Python via PB.pythonSvc.ensureReady() und warte max. 15s auf Ping.
 *     - Wenn Python ok → /service/start (mit general.python.AuthKey)
 *     - Danach max. 15s warten, bis Kestrel wieder pingbar ist.
 *
 * Voraussetzungen:
 *  - pb_python_server.js (PB.pythonSvc)
 *  - pb_bridge_services.js (PB.bridgeServices)
 */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  const pbT = (key, fallback) => (PB.t ? PB.t(key, fallback) : fallback);
  const LOG_PREFIX = "[camerabridgeserver]";

  // Guard: nicht doppelt binden
  if (PB._camerabridgeServerBound) return;
  PB._camerabridgeServerBound = true;

  // Bridge helper muss existieren
  if (!PB.bridgeServices) {
    console.error(
      `${LOG_PREFIX} ` +
        pbT(
          "bridge.console.bridgeServices_missing",
          "PB.bridgeServices is missing. pb_bridge_services.js must be loaded first."
        )
    );
    return;
  }

  if (typeof PB.bridgeServices.ensureBridgeRunning !== "function") {
    console.error(
      `${LOG_PREFIX} ` +
        pbT(
          "bridge.console.ensureBridgeRunning_missing",
          "ensureBridgeRunning is missing in PB.bridgeServices."
        )
    );
    return;
  }

  if (typeof PB.bridgeServices.restartBridge !== "function") {
    console.error(
      `${LOG_PREFIX} ` +
        pbT(
          "bridge.console.restartBridge_missing",
          "restartBridge is missing in PB.bridgeServices."
        )
    );
    return;
  }

  if (typeof PB.bridgeServices.stopBridge !== "function") {
    console.error(
      `${LOG_PREFIX} ` +
        pbT("bridge.console.stopBridge_missing", "stopBridge is missing in PB.bridgeServices.")
    );
    return;
  }

  // Python helper muss existieren (wird in PB.bridgeServices genutzt)
  if (!PB.pythonSvc || typeof PB.pythonSvc.fetch !== "function") {
    console.error(
      `${LOG_PREFIX} ` +
        pbT(
          "bridge.console.pythonSvc_missing",
          "PB.pythonSvc is missing. pb_python_server.js must be loaded first."
        )
    );
    return;
  }

  // -------------------------------------------------------------
  // UI helper: Button-Lock mit Token + Minimum Disable Zeit
  // -------------------------------------------------------------
  function lockButton($btn, busyLabel) {
    const oldHtml = $btn.html();

    const MIN_DISABLED_MS = 5000;
    const t0 = Date.now();
    const token = `${t0}_${Math.random().toString(16).slice(2)}`;

    $btn.data("pbBridgeStartToken", token);
    $btn.prop("disabled", true).addClass("disabled").html(busyLabel || pbT("common.ellipsis", "…"));

    return {
      oldHtml,
      token,
      t0,
      unlock: function (extraWaitMs, cb) {
        const elapsed = Date.now() - t0;
        const waitMs = Math.max(0, MIN_DISABLED_MS - elapsed);
        const extra = Number(extraWaitMs) || 0;

        setTimeout(function () {
          if ($btn.data("pbBridgeStartToken") !== token) return;
          $btn.prop("disabled", false).removeClass("disabled").html(oldHtml);
          if (typeof cb === "function") cb();
        }, waitMs + extra);
      },
    };
  }

  function refreshStatusSoon() {
    setTimeout(function () {
      if (typeof PB.check_cameraBridge_connection === "function") {
        PB.check_cameraBridge_connection();
      }
    }, 800);
  }

  // ===================================================================
  // START (.pb-bridge-start)
  // ===================================================================
  $(document)
    .off("click.pbBridgeStart", ".pb-bridge-start")
    .on("click.pbBridgeStart", ".pb-bridge-start", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const $btn = $(this);
      const lock = lockButton($btn, pbT("bridge.ui.starting", "Starting…"));

      let ok = false;

      try {
        // Ein Aufruf erledigt den kompletten Ablauf (ping kestrel -> ensure python -> service start -> wait kestrel)
        const res = await PB.bridgeServices.ensureBridgeRunning({ maxWaitMs: 15000, silent: false });
        ok = res === true || (res && res.ok === true);

        refreshStatusSoon();
      } catch (err) {
        console.warn("[ApiServerStart] Fehler:", err);
        PB.showMsg &&
          PB.showMsg(
            pbT("bridge.start.err.request_failed", "Bridge start failed: request could not be completed.") +
              (err && err.message ? "\n" + err.message : ""),
            "warning"
          );
      } finally {
        lock.unlock(3000, function () {
          if (ok && typeof PB.bridgePollResetAndNow === "function") {
            PB.bridgePollResetAndNow("bridge_API_SERVER_start_ok");
          } else if (ok && typeof PB.check_cameraBridge_connection === "function") {
            PB.check_cameraBridge_connection();
          }
        });
      }
    });

  // ===================================================================
  // RESTART (.pb-bridge-restart)
  // ===================================================================
  $(document)
    .off("click.pbBridgeRestart", ".pb-bridge-restart")
    .on("click.pbBridgeRestart", ".pb-bridge-restart", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const $btn = $(this);
      const lock = lockButton($btn, pbT("bridge.ui.restarting", "Restarting…"));

      let ok = false;

      try {
        const res = await PB.bridgeServices.restartBridge({ maxWaitMs: 15000, silent: false });
        ok = !!(res && res.ok);

        refreshStatusSoon();
      } catch (err) {
        console.warn("[ApiServerRestart] Fehler:", err);
        PB.showMsg &&
          PB.showMsg(
            pbT("bridge.restart.err.request_failed", "Bridge restart failed: request could not be completed.") +
              (err && err.message ? "\n" + err.message : ""),
            "warning"
          );
      } finally {
        lock.unlock(3500, function () {
          if (ok && typeof PB.bridgePollResetAndNow === "function") {
            PB.bridgePollResetAndNow("bridge_API_SERVER_restart_ok");
          } else if (ok && typeof PB.check_cameraBridge_connection === "function") {
            PB.check_cameraBridge_connection();
          }
        });
      }
    });

  // ===================================================================
  // STOP (.pb-bridge-stop)
  // ===================================================================
  $(document)
    .off("click.pbBridgeStop", ".pb-bridge-stop")
    .on("click.pbBridgeStop", ".pb-bridge-stop", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const $btn = $(this);
      const oldHtml = $btn.html();
      $btn
        .prop("disabled", true)
        .addClass("disabled")
        .html(pbT("bridge.ui.stopping", "Stopping…"));

      try {
        const res = await PB.bridgeServices.stopBridge({ maxWaitMs: 15000, silent: false });

        if (res && res.ok) {
          PB.showMsg && PB.showMsg(pbT("bridge.stop.ok.stopped", "Bridge stopped successfully."));
        } else {
          PB.showMsg &&
            PB.showMsg(
              pbT("bridge.stop.err.unknown", "Bridge stop requested, but server may still be running."),
              "warning"
            );
        }

        refreshStatusSoon();
      } catch (err) {
        console.warn("[ApiServerStop] Fehler:", err);
        PB.showMsg &&
          PB.showMsg(
            pbT("bridge.stop.err.request_failed", "Bridge stop failed: request could not be completed.") +
              (err && err.message ? "\n" + err.message : ""),
            "warning"
          );
      } finally {
        setTimeout(() => {
          $btn.prop("disabled", false).removeClass("disabled").html(oldHtml);
          if (typeof PB.check_cameraBridge_connection === "function") {
            PB.check_cameraBridge_connection();
          }
        }, 1000);
      }
    });
})(jQuery);
