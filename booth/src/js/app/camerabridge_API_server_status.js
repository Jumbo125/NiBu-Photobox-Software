// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

(function ($) {
  "use strict";
  window.PB = window.PB || {};
  const PB = window.PB;

  /**
   * Prüft, ob der CameraBridge/API-Server erreichbar ist (GET /api/status)
   * und aktualisiert Badge + Toast (reines Status/Anzeige-Script).
   *
   * Public API:
   *   PB.startBridgePolling();
   *   PB.stopBridgePolling();
   *   PB.check_cameraBridge_connection(); // einzelner Check (jQuery XHR Promise)
   */

  // --- Polling State ---
  PB._bridgePollTimer = PB._bridgePollTimer || null;
  PB._bridgePolling = PB._bridgePolling || false;

  PB._bridgePollBaseDelay = PB._bridgePollBaseDelay || 5000; // 5s normal
  PB._bridgePollDelay = PB._bridgePollDelay || PB._bridgePollBaseDelay;

  PB._bridgePollFailCount = PB._bridgePollFailCount || 0;
  PB._bridgePollMaxDelay = PB._bridgePollMaxDelay || 300000; // max 5 min
  PB._bridgePollBackoff = PB._bridgePollBackoff || 1.8;
  PB._bridgePollMaxFails = PB._bridgePollMaxFails || 10;

  // --- Request State (gegen parallele Checks) ---
  PB._bridgeCheckInFlight = PB._bridgeCheckInFlight || false;
  PB._bridgeCheckXhr = PB._bridgeCheckXhr || null;
  PB._bridgeLastHealth = PB._bridgeLastHealth || null;

  // --- Debug Helpers ---
  PB._bridgeFmtDelay = function (ms) {
    // Debug-Ausgabe (keine UI-Texte)
    if (ms >= 60000) return (ms / 60000).toFixed(2) + " min";
    return (ms / 1000).toFixed(1) + " s";
  };
  PB._bridgeLastLoggedDelay = PB._bridgeLastLoggedDelay || null;

  PB._bridgeJitter = function (ms) {
    // verhindert starren Takt (kleiner Random-Faktor)
    return Math.round(ms * (0.8 + Math.random() * 0.4)); // +/- 20%
  };

  PB._bridgeScheduleNext = function () {
    if (!PB._bridgePolling) return;

    if (PB._bridgePollTimer) clearTimeout(PB._bridgePollTimer);
    const planned = PB._bridgeJitter(PB._bridgePollDelay);

    // Debug: nur loggen, wenn sich Delay ändert (sonst Spam)
    if (PB._bridgeLastLoggedDelay !== PB._bridgePollDelay) {
      PB._bridgeLastLoggedDelay = PB._bridgePollDelay;
      PB._dbg &&
        PB._dbg(
          "[check bridge] next in",
          PB._bridgeFmtDelay(PB._bridgePollDelay),
          "(jittered=" +
            PB._bridgeFmtDelay(planned) +
            ", fails=" +
            PB._bridgePollFailCount +
            ")"
        );
    }

    PB._bridgePollTimer = setTimeout(PB._bridgePollTick, planned);
  };

  PB._bridgePollTick = function () {
    if (!PB._bridgePolling) return;

    PB._dbg &&
      PB._dbg(
        "[check bridge] start",
        "fails=" + PB._bridgePollFailCount,
        "delay=" + PB._bridgeFmtDelay(PB._bridgePollDelay),
        "time=" + new Date().toISOString()
      );

    const req = PB.check_cameraBridge_connection();

    // Erfolgreich => zurück auf normal (5s)
    req.done(function (s) {
      PB._dbg &&
        PB._dbg(
          "[check bridge] OK",
          "liveViewRunning=" + (s && s.liveViewRunning),
          "streamClients=" + (s && s.streamClients),
          "framesActive=" + (s && s.framesActive),
          "frameAgeMs=" + (s && s.frameAgeMs)
        );

      const before = PB._bridgePollDelay;
      PB._bridgePollFailCount = 0;
      PB._bridgePollDelay = PB._bridgePollBaseDelay;

      if (before !== PB._bridgePollDelay) {
        PB._dbg &&
          PB._dbg(
            "[check bridge] reset delay ->",
            PB._bridgeFmtDelay(PB._bridgePollDelay)
          );
        PB._bridgeLastLoggedDelay = null; // damit "next in" wieder erscheint
      }
    });

    // Fehler => exponentieller Backoff bis max 5 Minuten
    req.fail(function (xhr, statusText, errThrown) {
      const errMsg =
        errThrown && errThrown.message
          ? errThrown.message
          : String(statusText || "network error");
      PB._dbg && PB._dbg("[check bridge] FAIL", errMsg);

      PB._bridgePollFailCount = Math.min(
        PB._bridgePollFailCount + 1,
        PB._bridgePollMaxFails
      );

      const next = Math.round(
        PB._bridgePollBaseDelay *
          Math.pow(PB._bridgePollBackoff, PB._bridgePollFailCount)
      );
      const capped = Math.min(next, PB._bridgePollMaxDelay);

      const before = PB._bridgePollDelay;
      PB._bridgePollDelay = capped;

      if (before !== PB._bridgePollDelay) {
        PB._dbg &&
          PB._dbg(
            "[check bridge] backoff ->",
            PB._bridgeFmtDelay(PB._bridgePollDelay),
            "(fails=" + PB._bridgePollFailCount + ")"
          );
        PB._bridgeLastLoggedDelay = null; // damit "next in" wieder erscheint
      }
    });

    // Nächster Poll erst, wenn dieser fertig ist
    req.always(function () {
      PB._dbg && PB._dbg("[check bridge] done (schedule next)");
      PB._bridgeScheduleNext();
    });
  };

  PB.startBridgePolling = function () {
    if (PB._bridgePolling) return;

    PB._bridgePolling = true;
    PB._bridgePollFailCount = 0;
    PB._bridgePollDelay = PB._bridgePollBaseDelay;
    PB._bridgeLastLoggedDelay = null;

    PB._dbg &&
      PB._dbg(
        "[check bridge] polling START",
        "base=" + PB._bridgeFmtDelay(PB._bridgePollBaseDelay),
        "max=" + PB._bridgeFmtDelay(PB._bridgePollMaxDelay)
      );

    // sofortiger Check
    PB._bridgePollTick();
  };

  PB.stopBridgePolling = function () {
    PB._dbg && PB._dbg("[check bridge] polling STOP");

    PB._bridgePolling = false;
    if (PB._bridgePollTimer) clearTimeout(PB._bridgePollTimer);

    PB._bridgePollTimer = null;
    PB._bridgePollFailCount = 0;
    PB._bridgePollDelay = PB._bridgePollBaseDelay;
    PB._bridgeLastLoggedDelay = null;
  };

  PB.check_cameraBridge_connection = function () {
    // Fallback, falls PB.t noch nicht injected wurde
    const t =
      PB && typeof PB.t === "function"
        ? PB.t
        : function (key, fallback) {
            return fallback || key;
          };

    // verhindert parallele Requests
    if (PB._bridgeCheckInFlight && PB._bridgeCheckXhr) return PB._bridgeCheckXhr;

    PB._bridgeCheckInFlight = true;

    const $badge = $("#pb-bridge-status");
    const $toastText = $("#pbConnectionToastText");
    const $device = $("#pb-connection-device_model");
const setDevice = (html) => {
  if (!$device.length) return;
  if (PB._bridgeLastDevice === html) return;

  PB._bridgeLastDevice = html;
  $device.html(html);
};

const refreshDeviceFromConfig = () => {
  const model =
    PB._getDeep?.(window.PB_CONFIG, "general.camera.selected_camera.model") || "";

  // sicherheitshalber escapen, auch wenn der Wert aus deiner Config kommt
  const safeModel = $("<div>").text(model).html();

  if (model) {
    setDevice(`
      <span class="alert alert-success d-inline-flex align-items-center gap-2 py-1 px-2 mb-0">
        <i class="bi bi-camera-fill" aria-hidden="true"></i>
        <b>${safeModel}</b>
      </span>
    `);
  } else {
    setDevice(`
      <span class="alert alert-danger d-inline-flex align-items-center gap-2 py-1 px-2 mb-0">
        <i class="bi bi-x-octagon-fill" aria-hidden="true"></i>
        <b>${pbT("overlay.connection_info.connected_device_err", "No camera selected")}</b>
      </span>
    `);
  }
};


    // --- UI: während CHECK sperren ---
    const $startBtns = $(".pb-bridge-start");
    $startBtns
      .filter(":not(:disabled)")
      .addClass("pb-disabled-by-check")
      .prop("disabled", true)
      .addClass("disabled");

    // Spinner im Badge nur zeigen wenn Status noch unbekannt oder offline
    // (verhindert unnötiges Flackern wenn Bridge bereits als Online bekannt ist)
    if ($badge.length && !PB._bridgeLastHealth?.webserverReachable) {
      const currentText = $badge.text().trim();
      const label = currentText || t("bridge.badge.checking", "Checking...");
      $badge
        .empty()
        .append(
          $('<i class="bi bi-arrow-repeat pb-spin me-1" aria-hidden="true"></i>')
        )
        .append(document.createTextNode(label));
    }

    // -------------------------
    // Guarded UI helper (reduziert DOM-Updates)
    // -------------------------
    PB._bridgeLastBadge = PB._bridgeLastBadge || { cls: null, text: null };
    PB._bridgeLastToast = PB._bridgeLastToast || null;
    PB._bridgeOfflineShown = PB._bridgeOfflineShown || false;

    const setBadge = (clsAdd, text) => {
      if (!$badge.length) return;
      const last = PB._bridgeLastBadge;
      if (last.cls === clsAdd && last.text === text) return;

      last.cls = clsAdd;
      last.text = text;

      $badge
        .removeClass("bg-success bg-danger bg-warning bg-info bg-secondary")
        .addClass(clsAdd)
        .text(text);
    };

    const setToast = (text) => {
      if (!$toastText.length) return;
      if (PB._bridgeLastToast === text) return;
      PB._bridgeLastToast = text;
      $toastText.text(text);
    };

    // -------------------------
    // Base URL
    // -------------------------
    const Bridge = PB._getDeep?.(window.PB_CONFIG, "cameraBridgeServer.Bridge") || {};

    const Port = parseInt(Bridge.Port, 10);
    const Host = String(Bridge.Host || Bridge.IP || Bridge.Address || "127.0.0.1").trim();

    const Proto =
      Bridge.Https === true || String(Bridge.Protocol || "").toLowerCase() === "https"
        ? "https"
        : "http";

    const RawBase = (Bridge.BaseUrl || Bridge.URL || Bridge.Url || "").trim();

    let baseUrl;
    if (RawBase) {
      baseUrl = RawBase.replace(/\/+$/, "") + "/";
    } else {
      const portFinal = Number.isFinite(Port) && Port > 0 ? Port : 8052;
      baseUrl = `${Proto}://${Host}:${portFinal}/`;
    }

    const statusUrl = baseUrl + "api/status";

    // -------------------------
    // AJAX
    // -------------------------
    PB._bridgeCheckXhr = $.ajax({
      url: statusUrl,
      method: "GET",
      timeout: 3000,
      cache: true,
      dataType: "json",
    })
      .done(function (s) {
        const health = {
          exeRunning: true,
          webserverReachable: true,

          liveViewRunning: !!s?.liveViewRunning,
          streamClients: typeof s?.streamClients === "number" ? s.streamClients : 0,
          mjpegStreamRunning: !!(s?.streamRunning || (s?.streamClients ?? 0) > 0),
          framesActive: !!s?.framesActive,
          framesReceiving: !!s?.streamSendingFrames,

          frameAgeMs: typeof s?.frameAgeMs === "number" ? s.frameAgeMs : null,
          selected: s?.selected || s?.model || null,

          baseUrl,
          statusUrl,
          rawStatus: s,
        };

        //show selected device
        refreshDeviceFromConfig();
        const last = PB._bridgeLastHealth;
        PB._bridgeLastHealth = health;

        // -------- UI State --------
        let badgeCls = "bg-info";
        let badgeText = t("bridge.badge.ready", "Ready");
        let toast = t("bridge.toast.reachable", "CameraBridge reachable ✅");

        if (health.framesReceiving) {
          badgeCls = "bg-success";
          badgeText = t("bridge.badge.active", "Active");
          toast =
            t("bridge.toast.frames_sending", "✅ 1–4 OK: Stream is sending frames") +
            (health.selected ? " (" + health.selected + ")" : "");
          PB.toggleCameraBridgeOfflineHint?.(false);
          PB._bridgeOfflineShown = false;
        } else if (health.mjpegStreamRunning && !health.framesActive) {
          badgeCls = "bg-warning";
          badgeText = t("bridge.badge.stream_empty", "Stream empty");
        } else if (!health.liveViewRunning) {
          badgeCls = "bg-info";
          badgeText = t("bridge.badge.idle", "Idle");
        }

        setBadge(badgeCls, badgeText);
        setToast(toast);

        // -------- Event NUR bei Änderung --------
        const changed =
          !last ||
          last.webserverReachable !== health.webserverReachable ||
          last.liveViewRunning !== health.liveViewRunning ||
          last.mjpegStreamRunning !== health.mjpegStreamRunning ||
          last.framesActive !== health.framesActive ||
          last.framesReceiving !== health.framesReceiving;

        if (changed) {
          $(document).trigger("pb:bridgeHealth", [health]);
        }
      })
      .fail(function (xhr, statusText, errThrown) {
        setBadge("bg-danger", t("bridge.badge.offline", "Offline"));
        setToast(t("bridge.toast.offline", "CameraBridge is not running ❌"));
        //show selected device
        refreshDeviceFromConfig();
        // statusText aus jQuery in "sprechbar" übersetzen (user-facing Detail)
        const statusDetailMap = {
          timeout: t("bridge.err.timeout", "Request timed out"),
          abort: t("bridge.err.aborted", "Request aborted"),
          parsererror: t("bridge.err.bad_response", "Invalid server response"),
          error: t("bridge.err.network_error", "Network error"),
        };

        const fallbackDetail =
          statusDetailMap[statusText] || t("bridge.err.offline", "Offline");

        const detail =
          errThrown && errThrown.message ? errThrown.message : String(fallbackDetail);

        PB._bridgeLastHealth = {
          exeRunning: false,
          webserverReachable: false,
          mjpegStreamRunning: false,
          framesReceiving: false,
          detail,
        };

        if (!PB._bridgeOfflineShown) {
          PB._bridgeOfflineShown = true;
          // 2. Parameter ist ein Status-Code (intern) -> nicht übersetzen
          PB.toggleCameraBridgeOfflineHint?.(true, "offline", detail);
        }
      })
      .always(function () {
        PB._bridgeCheckInFlight = false;
        PB._bridgeCheckXhr = null;

        const $btns = $(".pb-bridge-start.pb-disabled-by-check");
        if ($btns.length) {
          $btns.prop("disabled", false).removeClass("disabled pb-disabled-by-check");
        }
      });

    return PB._bridgeCheckXhr;
  };

  PB.bridgePollResetAndNow = function (reason) {
    reason = reason || "manual";

    PB._dbg &&
      PB._dbg(
        "[check bridge] KICK reset+now",
        "reason=" + reason,
        "wasDelay=" + PB._bridgeFmtDelay(PB._bridgePollDelay),
        "wasFails=" + PB._bridgePollFailCount
      );

    // Backoff zurücksetzen
    PB._bridgePollFailCount = 0;
    PB._bridgePollDelay = PB._bridgePollBaseDelay;
    PB._bridgeLastLoggedDelay = null;

    // Polling ggf. starten
    if (!PB._bridgePolling) {
      PB.startBridgePolling(); // macht sofort _bridgePollTick()
      return;
    }

    // Nächsten geplanten Tick abbrechen und sofort prüfen
    if (PB._bridgePollTimer) clearTimeout(PB._bridgePollTimer);
    PB._bridgePollTimer = null;

    PB._bridgePollTick();
  };
})(jQuery);
