// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * windows_picker_bindings.js — File/Folder Picker Bindings + Host Window Actions
 * Nutzt PB.pythonSvc (aus pb_python_server.js)
 * → übernimmt UI-Logik inkl. sicherem LiveView-Stop vor Reload/Close
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

  window.PB = window.PB || {};
  const PB = window.PB;

  if (PB._pickerBindingsBound) return;
  PB._pickerBindingsBound = true;

  const LIVEVIEW_STOP_TIMEOUT_MS = 4000;
  const LIVEVIEW_STOP_SETTLE_MS = 150;

  function hasPickerService() {
    return !!(PB.pythonSvc && typeof PB.pythonSvc.pick === "function");
  }

  // Nur warnen, nicht die ganze Datei abbrechen:
  // Host-Buttons (close/minimize/restore/kiosk) sollen auch ohne pythonSvc funktionieren.
  if (!hasPickerService()) {
    console.warn(
      t(
        "windows.picker.bindings.warn.missing_service",
        "[windows_picker_bindings] PB.pythonSvc missing. Picker actions are disabled until pb_python_server.js is loaded."
      )
    );
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function withTimeout(promise, ms) {
    return Promise.race([
      Promise.resolve(promise),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error(`LiveView stop timeout after ${ms}ms`)), ms)
      )
    ]);
  }

  function getInitialPath($btn, $input) {
    const targetSel = $btn.attr("data-target");
    const lsKey = "pb_last_dir_" + targetSel;
    const current = String($input.val() || "").trim();
    const lastDir = String(localStorage.getItem(lsKey) || "").trim();
    const hintBtn = String($btn.attr("data-initial") || "").trim();
    const hintInp = String($input.attr("data-initial") || "").trim();
    return hintBtn || hintInp || current || lastDir || "";
  }

  function clearLivePreviewSources() {
    try {
      const frame = document.getElementById("liveFrame");
      if (frame && "src" in frame) {
        try {
          frame.dataset.pbLastSrc = frame.getAttribute("src") || frame.src || "";
        } catch (_) {}
        frame.setAttribute("src", "about:blank");
      }
    } catch (_) {}

    try {
      document
        .querySelectorAll("img#lv, img#mjpg, img#stream, img[data-mjpeg-stream='1']")
        .forEach((img) => {
          try {
            img.dataset.pbLastSrc = img.getAttribute("src") || img.src || "";
          } catch (_) {}
          img.removeAttribute("src");
          img.setAttribute("src", "about:blank");
        });
    } catch (_) {}
  }

  if (typeof PB.stopLiveviewForUiAction !== "function") {
    PB.stopLiveviewForUiAction = async function (reason, opts = {}) {
      const timeoutMs = Number(opts.timeoutMs) > 0 ? Number(opts.timeoutMs) : LIVEVIEW_STOP_TIMEOUT_MS;
      const waitAfterMs = Number(opts.waitAfterMs) >= 0 ? Number(opts.waitAfterMs) : LIVEVIEW_STOP_SETTLE_MS;
      const blankPreview = opts.blankPreview !== false;

      if (window.__pbStopLiveviewPromise) {
        return window.__pbStopLiveviewPromise;
      }

      const stopFn =
        (PB.captureApi && typeof PB.captureApi.liveviewStop === "function" && PB.captureApi.liveviewStop.bind(PB.captureApi)) ||
        (PB.bridge && typeof PB.bridge.liveviewStop === "function" && PB.bridge.liveviewStop.bind(PB.bridge)) ||
        null;

      window.__pbStopLiveviewPromise = (async () => {
        $(document).trigger("pb:before-liveview-stop", [
          { reason, via: "ui-action", hasStopApi: !!stopFn }
        ]);

        let result = { ok: true, skipped: !stopFn, reason };

        if (stopFn) {
          result = await withTimeout(stopFn(), timeoutMs).catch((error) => ({
            ok: false,
            reason,
            error
          }));
        }

        if (blankPreview) clearLivePreviewSources();
        if (waitAfterMs > 0) await sleep(waitAfterMs);

        $(document).trigger("pb:after-liveview-stop", [
          { reason, via: "ui-action", ok: result?.ok !== false, result }
        ]);

        return result;
      })();

      try {
        return await window.__pbStopLiveviewPromise;
      } finally {
        window.__pbStopLiveviewPromise = null;
      }
    };
  }

  function requireSystemPassword() {
    const configuredPassword = String(window.PB_CONFIG?.general?.system?.password ?? "");

    if (configuredPassword === "") return true;

    const enteredPassword = window.prompt(
      t("windows.picker.closebrowser.prompt.password", "Please enter password")
    );

    if (enteredPassword == null) return false;

    if (String(enteredPassword) !== configuredPassword) {
      throw new Error(t("windows.picker.closebrowser.err.invalid_password", "Wrong password"));
    }

    return true;
  }

  function runHostWindowAction(action, opts = {}) {
    const hostApp = window.hostApp || null;
    const eventName = opts.eventName || null;
    const eventData = opts.eventData || { ok: true, via: "hostApp", action };

    if (action === "reload") {
      if (eventName) $(document).trigger(eventName, [eventData]);
      location.reload();
      return true;
    }

    if (!hostApp) {
      throw new Error(
        t("windows.hostapp.err.unavailable", "Host application interface not available")
      );
    }

    switch (action) {
      case "close":
        if (typeof hostApp.exit === "function") {
          hostApp.exit();
        } else if (typeof hostApp.close === "function") {
          hostApp.close();
        } else {
          throw new Error(
            t("windows.hostapp.err.close_missing", "hostApp.close/exit not available")
          );
        }
        break;

      case "minimize":
        if (typeof hostApp.minimize !== "function") {
          throw new Error(
            t("windows.hostapp.err.minimize_missing", "hostApp.minimize not available")
          );
        }
        hostApp.minimize();
        break;

      case "kiosk-on":
        if (typeof hostApp.setKiosk === "function") {
          hostApp.setKiosk(true);
        } else if (typeof hostApp.maximize === "function") {
          hostApp.maximize();
        } else {
          throw new Error(
            t("windows.hostapp.err.kiosk_on_missing", "hostApp.setKiosk/maximize not available")
          );
        }
        break;

      case "kiosk-toggle":
        if (typeof hostApp.toggleKioskMode === "function") {
          hostApp.toggleKioskMode();
        } else if (typeof hostApp.setKiosk === "function") {
          const kioskAttr = String(document.body?.dataset?.pbKiosk || "").trim().toLowerCase();
          const isKiosk = ["1", "true", "yes", "y", "on"].includes(kioskAttr);
          hostApp.setKiosk(!isKiosk);
        } else {
          throw new Error(
            t(
              "windows.hostapp.err.kiosk_toggle_missing",
              "hostApp.toggleKioskMode/setKiosk not available"
            )
          );
        }
        break;

      case "kiosk-off":
        if (typeof hostApp.setKiosk === "function") {
          hostApp.setKiosk(false);
        } else if (typeof hostApp.restore === "function") {
          hostApp.restore();
        } else {
          throw new Error(
            t("windows.hostapp.err.kiosk_off_missing", "hostApp.setKiosk/restore not available")
          );
        }
        break;

      case "restore":
        if (typeof hostApp.restore !== "function") {
          throw new Error(
            t("windows.hostapp.err.restore_missing", "hostApp.restore not available")
          );
        }
        hostApp.restore();
        break;

      default:
        throw new Error(`Unsupported host action: ${action}`);
    }

    if (eventName) {
      $(document).trigger(eventName, [eventData]);
    }

    return true;
  }

  async function handlePick($btn, mode, opts = {}) {
    if (!hasPickerService()) {
      throw new Error(
        t(
          "windows.picker.bindings.err.missing_service",
          "PB.pythonSvc missing. pb_python_server.js must be loaded first."
        )
      );
    }

    const targetSel = $btn.attr("data-target");
    if (!targetSel) return;

    const $input = $(targetSel);
    if (!$input.length) return;

    const lsKey = "pb_last_dir_" + targetSel;

    const title =
      opts.title ||
      (mode === "file"
        ? t("windows.picker.title.file", "Select file")
        : t("windows.picker.title.folder", "Select folder"));

    const filter = opts.filter || t("windows.picker.filter.all", "All files (*.*)|*.*");
    const initial = getInitialPath($btn, $input);

    const oldHtml = $btn.html();
    const oldDisabled = $btn.prop("disabled");
    $btn.prop("disabled", true).html(t("windows.picker.btn.wait", "Please wait…"));

    try {
      const picked = await PB.pythonSvc.pick({ mode, title, filter, initial });
      if (!picked) return;

      $input.val(picked).trigger("change");

      if (mode === "file") {
        const dir = String(picked).replace(/[\\/][^\\/]*$/, "");
        if (dir) localStorage.setItem(lsKey, dir);
      } else {
        localStorage.setItem(lsKey, picked);
      }
    } catch (e) {
      console.error("[Picker]", e);
      alert(
        t("windows.picker.alert.failed", "Picker failed:\n{msg}", {
          msg: e?.message || String(e)
        })
      );
    } finally {
      $btn.html(oldHtml);
      $btn.prop("disabled", oldDisabled);
    }
  }

  async function handlePickUpload($btn, opt = {}) {
    if (!hasPickerService()) {
      throw new Error(
        t(
          "windows.picker.bindings.err.missing_service",
          "PB.pythonSvc missing. pb_python_server.js must be loaded first."
        )
      );
    }

    const base =
      window.PB && PB.pythonSvc && typeof PB.pythonSvc.baseUrl === "function"
        ? PB.pythonSvc.baseUrl(PB.pythonSvc.port)
        : "http://127.0.0.1:8053";

    const q = new URLSearchParams();
    if (opt.title) q.set("title", opt.title);
    if (opt.path) q.set("path", opt.path);
    if (opt.filter) q.set("filter", opt.filter);
    if (opt.subdir) q.set("subdir", opt.subdir);
    if (opt.prefix != null) q.set("prefix", opt.prefix);
    if (opt.overwrite != null) q.set("overwrite", opt.overwrite);

    const url = `${base}/pickUpload?${q.toString()}`;

    const headers = {};
    if (window.PB && PB.pythonSvc && typeof PB.pythonSvc.authHeaders === "function") {
      Object.assign(headers, PB.pythonSvc.authHeaders());
    }

    const r = await fetch(url, { cache: "no-store", headers });
    const j = await r.json();

    $(document).trigger("pb:upload:result", [j, $btn]);

    if (!j.ok) {
      $(document).trigger("pb:upload:cancel", [j, $btn]);
      return j;
    }

    if (opt.target) {
      const $t = $(opt.target);
      if ($t.length) $t.val(j.saved_url || j.saved_rel || "");
    }

    $btn.data("savedUrl", j.saved_url || "");
    $btn.data("savedRel", j.saved_rel || "");
    $btn.data("savedAbs", j.saved_abs || "");

    $(document).trigger("pb:upload:success", [j, $btn]);
    return j;
  }

  // -------------------------------------------------------------
  // UI Bindings
  // -------------------------------------------------------------
  PB.initWindowsPickerBindings = function () {
    function parseDataBool(v, defVal = false) {
      if (v == null) return defVal;
      const s = String(v).trim().toLowerCase();
      if (["1", "true", "yes", "y", "on"].includes(s)) return true;
      if (["0", "false", "no", "n", "off"].includes(s)) return false;
      return defVal;
    }

    function joinWinPath(...parts) {
      return parts
        .filter((p) => p != null && String(p).trim() !== "")
        .map((p) => String(p).trim().replace(/[\\/]+$/g, ""))
        .join("\\")
        .replace(/[\\/]+/g, "\\");
    }

    function sanitizeFolderName(name) {
      const s = String(name || "").trim();
      if (!s) return "";
      return s.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\.+$/g, "").trim();
    }

    function getToolBase() {
      return (window.PB_TOOL_SERVER_BASE || "http://127.0.0.1:8053").replace(/\/+$/g, "");
    }

    async function handleOpenFolder($btn) {
      const target = String($btn.attr("data-target") || "").trim();

      const createDir = parseDataBool($btn.attr("data-create_dir"), true);
      const cooldown = parseFloat($btn.attr("data-cooldown"));
      const cooldownSec = Number.isFinite(cooldown) ? cooldown : 2;

      let folderPath = "";

      if (target === "activeEvent") {
        const ae = (PB._getDeep && PB._getDeep(window.PB_CONFIG, "activeEvent.active_event")) || {};
        const base = String(ae.photo_storage_path || "").trim();
        const evName = sanitizeFolderName(ae.eventName || "");

        if (!base) {
          throw new Error(
            t(
              "windows.picker.openfolder.err.missing_storage_path",
              "PB_CONFIG.activeEvent.active_event.photo_storage_path is missing."
            )
          );
        }

        folderPath = evName ? joinWinPath(base, "EVENTS", evName) : joinWinPath(base, "EVENTS");
      } else {
        const dp = String($btn.attr("data-path") || "").trim();
        if (dp) {
          folderPath = dp;
        } else if (target) {
          const el = document.getElementById(target);
          if (el && "value" in el) folderPath = String(el.value || "").trim();
        }
      }

      if (!folderPath) {
        throw new Error(
          t(
            "windows.picker.openfolder.err.no_folder_path",
            "No folder path could be determined (empty)."
          )
        );
      }

      const baseUrl = getToolBase();
      const params = new URLSearchParams({
        path: folderPath,
        create: createDir ? "1" : "0",
        cooldown: String(cooldownSec)
      });

      const url = `${baseUrl}/openfolder?${params.toString()}`;
      const res = await fetch(url, { method: "GET" });
      const json = await res.json().catch(() => ({}));

      if (!json || json.ok !== true) {
        const msg =
          json && (json.detail || json.error)
            ? `${json.error || ""} ${json.detail || ""}`.trim()
            : t("windows.picker.openfolder.err.failed", "openfolder failed");
        throw new Error(msg);
      }

      return json;
    }

    async function handleReloadClick() {
      let modal = null;

      try {
        modal = PB.showBusyModal?.("modalReloadBrowser") || null;

        await PB.stopLiveviewForUiAction("browser-reload", {
          timeoutMs: LIVEVIEW_STOP_TIMEOUT_MS,
          waitAfterMs: LIVEVIEW_STOP_SETTLE_MS,
          blankPreview: true
        });

        runHostWindowAction("reload", {
          eventName: "pb:browser:reload",
          eventData: { ok: true, via: "location.reload", reason: "browser-reload" }
        });
      } catch (err) {
        console.error("[btnUiReload]", err);
        modal?.hide?.();
        alert(
          t("windows.picker.reload.alert.failed", "Browser could not be reloaded:\n{msg}", {
            msg: err?.message || String(err)
          })
        );
      }
    }

    async function handleCloseClick() {
      let modal = null;

      try {
        const ok = requireSystemPassword();
        if (!ok) return;

        await PB.stopLiveviewForUiAction("browser-close", {
          timeoutMs: LIVEVIEW_STOP_TIMEOUT_MS,
          waitAfterMs: LIVEVIEW_STOP_SETTLE_MS,
          blankPreview: true
        });

        runHostWindowAction("close", {
          eventName: "pb:browser:closed",
          eventData: { ok: true, via: "hostApp", reason: "browser-close" }
        });

        // Erfolgsmeldung erst anzeigen, wenn kein Host-Fehler geworfen wurde.
        modal = PB.showBusyModal?.("modalCloseBrowser") || null;
      } catch (err) {
        console.error("[pb-close-browser]", err);
        modal?.hide?.();
        alert(
          t("windows.picker.closebrowser.alert.failed", "Browser could not be closed:\n{msg}", {
            msg: err?.message || String(err)
          })
        );
      }
    }

    // File picker
    $(document).on("click", ".pb-pick-file", async function (e) {
      e.preventDefault();
      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;
      $btn.data("pbBusy", true);

      try {
        await handlePick($btn, "file", {
          title: $btn.attr("data-title"),
          filter: $btn.attr("data-filter")
        });
      } finally {
        $btn.data("pbBusy", false);
      }
    });

    // Folder picker
    $(document).on("click", ".pb-pick-folder", async function (e) {
      e.preventDefault();
      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;
      $btn.data("pbBusy", true);

      try {
        await handlePick($btn, "folder", {
          title: $btn.attr("data-title")
        });
      } finally {
        $btn.data("pbBusy", false);
      }
    });

    // Upload picker (copy to uploads)
    $(document).on("click", ".pb-upload", async function (e) {
      e.preventDefault();
      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;
      $btn.data("pbBusy", true);

      try {
        await handlePickUpload($btn, {
          title: $btn.attr("data-title"),
          path: $btn.attr("data-path"),
          filter: $btn.attr("data-filter"),
          subdir: $btn.attr("data-subdir"),
          prefix: $btn.attr("data-prefix"),
          overwrite: $btn.attr("data-overwrite"),
          target: $btn.attr("data-target")
        });
      } finally {
        $btn.data("pbBusy", false);
      }
    });

    // Open folder (Explorer)
    $(document).on("click", ".pb-open-folder", async function (e) {
      e.preventDefault();
      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;
      $btn.data("pbBusy", true);

      try {
        await handleOpenFolder($btn);
      } catch (err) {
        console.warn("[pb-open-folder]", err);
      } finally {
        $btn.data("pbBusy", false);
      }
    });

    // Browser reload with safe liveview stop
    $(document).on("click", ".btnUiReload, #btnUiReload", async function (e) {
      e.preventDefault();

      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;

      $btn.data("pbBusy", true).prop("disabled", true);

      try {
        await handleReloadClick();
      } finally {
        $btn.data("pbBusy", false).prop("disabled", false);
      }
    });

    // Close Browser (Host App)
    $(document).on("click", ".pb-close-browser", async function (e) {
      e.preventDefault();

      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;

      $btn.data("pbBusy", true).prop("disabled", true);

      try {
        await handleCloseClick();
      } finally {
        $btn.data("pbBusy", false).prop("disabled", false);
      }
    });

    // Kioskmodus aktivieren
    $(document).on("click", ".pb-enter-kiosk", function (e) {
      e.preventDefault();
      try {
        runHostWindowAction("kiosk-on", {
          eventName: "pb:browser:kiosk-on",
          eventData: { ok: true, via: "hostApp", action: "kiosk-on" }
        });
      } catch (err) {
        console.error("[pb-enter-kiosk]", err);
        alert(
          t("windows.picker.kiosk.alert.failed", "Kiosk mode could not be activated:\n{msg}", {
            msg: err?.message || String(err)
          })
        );
      }
    });

    // Kioskmodus toggeln
    $(document).on("click", ".pb-toggle-kiosk", function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();

      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;

      $btn.data("pbBusy", true).prop("disabled", true);

      try {
        runHostWindowAction("kiosk-toggle", {
          eventName: "pb:browser:kiosk-toggle",
          eventData: { ok: true, via: "hostApp", action: "kiosk-toggle" }
        });
      } catch (err) {
        console.error("[pb-toggle-kiosk]", err);
        alert(
          t("windows.picker.kiosk.alert.failed", "Kiosk mode could not be toggled:\n{msg}", {
            msg: err?.message || String(err)
          })
        );
      } finally {
        setTimeout(() => {
          $btn.data("pbBusy", false).prop("disabled", false);
        }, 300);
      }
    });

    // Kioskmodus verlassen
    $(document).on("click", ".pb-exit-kiosk", function (e) {
      e.preventDefault();
      try {
        runHostWindowAction("kiosk-off", {
          eventName: "pb:browser:kiosk-off",
          eventData: { ok: true, via: "hostApp", action: "kiosk-off" }
        });
      } catch (err) {
        console.error("[pb-exit-kiosk]", err);
        alert(
          t("windows.picker.restore.alert.failed", "Kiosk mode could not be left:\n{msg}", {
            msg: err?.message || String(err)
          })
        );
      }
    });

    // Fenster minimieren
    $(document).on("click", ".pb-minimize-browser", function (e) {
      e.preventDefault();
      try {
        runHostWindowAction("minimize", {
          eventName: "pb:browser:minimized",
          eventData: { ok: true, via: "hostApp", action: "minimize" }
        });
      } catch (err) {
        console.error("[pb-minimize-browser]", err);
        alert(
          t("windows.picker.minimize.alert.failed", "Browser could not be minimized:\n{msg}", {
            msg: err?.message || String(err)
          })
        );
      }
    });

    // Fenster normal anzeigen
    $(document).on("click", ".pb-restore-browser", function (e) {
      e.preventDefault();
      try {
        runHostWindowAction("restore", {
          eventName: "pb:browser:restored",
          eventData: { ok: true, via: "hostApp", action: "restore" }
        });
      } catch (err) {
        console.error("[pb-restore-browser]", err);
        alert(
          t("windows.picker.restore.alert.failed", "Browser could not be restored:\n{msg}", {
            msg: err?.message || String(err)
          })
        );
      }
    });
  };

  // Optional: direkt beim Laden aktivieren
  $(PB.initWindowsPickerBindings);
})(jQuery);
