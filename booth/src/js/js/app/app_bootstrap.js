/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 * ============================================================================
 * app_bootstrap.js — Bootstrap/Startup (Configs laden, UI anwenden, Sprache, Device-Init)
 *
 * Lädt beim Start alle Konfigdateien (PB.loadAllConfigs, falls vorhanden),
 * setzt Sprache aus general.language und feuert pb:configLoaded, sobald alles da ist.
 * ============================================================================
 */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  // i18n helper (fallback, falls pbT noch nicht verfügbar ist)
  const tr = (key, fallback) =>
    typeof pbT === "function" ? pbT(key, fallback) : fallback;

  // Default: welche Datei soll als "Hauptconfig" geladen werden? (Fallback/Kompatibilität)
  PB.MAIN_CONFIG_FILE = PB.MAIN_CONFIG_FILE || "config/config.json";

  /**
   * Setzt die aktuelle Sprache anhand general.language oder Fallback.
   */
  function syncLanguageFromConfig() {
    const lang = String(
      PB._getDeep?.(window.PB_CONFIG, "general.language") ?? "",
    ).trim();
    PB.currentLanguageCode = lang || PB.currentLanguageCode || "en";
  }

  /**
   * Globales Modal-"show" Hook, um Labels nachzuladen (i18n).
   */
  function bindAutoApplyLanguageOnModals() {
    $(document).on("show.bs.modal", ".modal", function () {
      if (typeof PB.applyLanguage === "function") PB.applyLanguage();
    });
  }

  /**
   * Bootstrap/Startup ausführen:
   * - Configs laden
   * - UI anwenden
   * - Sprache laden/anwenden
   * - Device-Init
   */
  PB.initBootstrap =
    PB.initBootstrap ||
    async function () {
      // 1) Alle Configs laden (Top-Layer Store)
      try {
        if (typeof PB.loadAllConfigs === "function") {
          await PB.loadAllConfigs();
        } else if (typeof PB.loadConfigFileIntoGlobal === "function") {
          // Fallback: alte Methode (nur 1 Datei)
          await new Promise((resolve) =>
            PB.loadConfigFileIntoGlobal(PB.MAIN_CONFIG_FILE).always(resolve),
          );
        } else {
          window.PB_CONFIG = window.PB_CONFIG || {
            general: {},
            render: {},
            camera: {},
            activeEvent: {},
          };
        }
      } catch (e) {
        console.warn(
          tr("bootstrap.config.load_failed", "Config load failed:"),
          e,
        );
        window.PB_CONFIG = window.PB_CONFIG || {
          general: {},
          render: {},
          camera: {},
          activeEvent: {},
        };
      }

      // window.PB_CONFIG ist ab hier befüllt
      (PB._dbg || console.log)(
        tr(
          "bootstrap.config.loaded_trigger",
          "[Config] loaded → trigger pb:configLoaded",
        ),
        PB._getDeep?.(window.PB_CONFIG, "general.system.fullscreen"),
      );

      // informiert alle Module (z. B. fullscreen, preview, etc.)
      $(document).trigger("pb:configLoaded", [window.PB_CONFIG]);

      // 2) UI aus Config anwenden (Background etc.)
      if (typeof PB.applyUiFromConfig === "function") {
        try {
          PB.applyUiFromConfig();
        } catch (e) {
          console.warn(e);
        }
      }

      (PB._dbg || console.log)(
        tr(
          "bootstrap.config.fullscreen_value",
          "[Config] general.system.fullscreen =",
        ),
        PB._getDeep?.(window.PB_CONFIG, "general.system.fullscreen"),
        JSON.stringify(window.PB_CONFIG?.general || {}),
      );

      // 2b) UI-Fullscreen (CSS) initialisieren + Buttons binden
      if (typeof PB.initUiFullscreenBindings === "function") {
        try {
          PB.initUiFullscreenBindings();
        } catch (e) {
          console.warn(e);
        }
      } else if (typeof PB.updateFullscreenState === "function") {
        try {
          PB.updateFullscreenState();
        } catch (e) {
          console.warn(e);
        }
      }

      // 3) Sprache setzen + laden
      syncLanguageFromConfig();
      bindAutoApplyLanguageOnModals();

      if (typeof PB.loadLanguage === "function") {
        try {
          PB.loadLanguage(PB.currentLanguageCode);
        } catch (e) {
          console.warn(e);
        }
      } else if (typeof PB.applyLanguage === "function") {
        PB.applyLanguage();
      }

      // 4) Device-Selection / Bridge init (wenn vorhanden)
      if (typeof PB.initUnifiedDeviceSelection === "function") {
        try {
          PB.initUnifiedDeviceSelection();
        } catch (e) {
          console.warn(e);
        }
      }
      if (
        PB.devices &&
        typeof PB.devices.refreshUnifiedDeviceDropdown === "function"
      ) {
        try {
          PB.devices.refreshUnifiedDeviceDropdown();
        } catch (e) {
          console.warn(e);
        }
      }

      // 5) Active Event UI einmal setzen
      if (typeof PB.updateActiveEventUI === "function") {
        try {
          PB.updateActiveEventUI();
        } catch (e) {
          console.warn(e);
        }
      }

      // 6) Auto-Restore: gespeicherte Kamera selektieren + optional Liveview warmup
      if (typeof PB.restoreSavedCameraAndLiveviewFromConfig === "function") {
        try {
          await PB.restoreSavedCameraAndLiveviewFromConfig();
        } catch (e) {
          console.warn(e);
        }
      }

      // 7) Printer: DNP Paper Status nach DOM-ready genau einmal laden
      if (typeof PB.syncDnpPaperStatusQuery === "function") {
        try {
          await PB.syncDnpPaperStatusQuery({ initial: true });
        } catch (e) {
          console.warn(e);
        }
      }

      // 8) DNP-Werte erst nach dem Initial-Load explizit ins DOM rendern
      if (typeof PB.renderDnpStateFromConfig === "function") {
        try {
          PB.renderDnpStateFromConfig();
        } catch (e) {
          console.warn(e);
        }
      }

      // 9) Echten OS-Status für Autostart + Task-Planer/systemd mit config.json synchronisieren
      if (typeof PB.syncSystemServiceStatusFromPython === "function") {
        try {
          await PB.syncSystemServiceStatusFromPython();
        } catch (e) {
          console.warn(e);
        }
      }
    };

  // Active Event UI: aktuellen Eventnamen + Druckzähler anzeigen
  PB.updateActiveEventUI = function () {
    try {
      const ev =
        PB._getDeep(window.PB_CONFIG, "activeEvent.active_event") || {};
      const name = ev.eventName || "";
      const count = ev.print_counter != null ? ev.print_counter : "";

      $(".active_event_title").html(name);
      $(".active_event_counter").html(count !== "" ? `(${count})` : "");
    } catch (e) {
      console.warn(
        tr(
          "bootstrap.active_event.update_failed",
          "[updateActiveEventUI] failed:",
        ),
        e,
      );
    }
  };

  // Preview Video toggle
  const toBool = (v) => {
    if (v === true || v === 1) return true;
    if (v === false || v === 0 || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === "true" || s === "1" || s === "yes" || s === "on";
  };


  PB.applyPreviewMirror = function (enabled) {
    document.body.classList.toggle("pb-preview-mirrored", !!enabled);

    // Optional: zusätzlich direkt am Element (falls CSS überschrieben wird)
    const lf = document.getElementById("liveFrame");
    if (lf) lf.style.transform = enabled ? "scaleX(-1)" : "";
  };

  PB.initIframeMirrorWatcher = function () {
    const lf = document.getElementById("liveFrame");
    if (!lf) return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === "attributes" && m.attributeName === "src") {
          console.debug(
            tr(
              "bootstrap.liveframe.src_changed_apply_mirror",
              "[PB] liveFrame src changed → apply mirror",
            ),
          );
          PB.applyPreviewMirror?.(lf.dataset.mirror === "1");
        }
      }
    });

    observer.observe(lf, { attributes: true });
  };

  PB.syncPreviewMirrorFromConfig = function () {
    const cfgVal = window.PB_CONFIG?.camera?.camera_settings?.preview_mirror;
    const enabled = toBool(cfgVal);

    // Checkbox UI setzen
    const cb = document.getElementById("cameraPreviewMirror");
    if (cb) cb.checked = enabled;

    // Preview anwenden
    PB.applyPreviewMirror(enabled);

    const msg = tr(
      "preview_mirror.sync_from_config",
      "[preview_mirror] sync from config =",
    );
    if (typeof PB._dbg === "function") PB._dbg(`${msg} ${enabled}`);
    else console.log(msg, enabled);
  };

  PB.initPreviewMirrorBindings =
    PB.initPreviewMirrorBindings ||
    function () {
      const cb = document.getElementById("cameraPreviewMirror");
      if (!cb) return;

      if (cb.dataset.pbMirrorBound === "1") return;
      cb.dataset.pbMirrorBound = "1";

      cb.addEventListener("change", function () {
        const enabled = !!cb.checked;

        PB.applyPreviewMirror(enabled);

        window.PB_CONFIG = window.PB_CONFIG || {};
        window.PB_CONFIG.camera = window.PB_CONFIG.camera || {};
        window.PB_CONFIG.camera.camera_settings =
          window.PB_CONFIG.camera.camera_settings || {};
        window.PB_CONFIG.camera.camera_settings.preview_mirror = enabled;

        const msg = tr("preview_mirror.changed", "[preview_mirror] changed =");
        (PB._dbg || console.log)(msg, enabled);
      });
    };

  // ========================================
  // Statisches Bild laden (togglebar mit Livevideo)
  // ========================================
  // Rendert/aktualisiert das <img> in #bgStaticImg
  PB.applyBgStaticImg = function (path) {
    const wrap = document.getElementById("bgStaticImg");
    if (!wrap) return;

    const p = String(path ?? "").trim();

    if (!p) {
      wrap.innerHTML = "";
      return;
    }

    let img = wrap.querySelector('img[data-role="bgStaticImg"]');
    if (!img) {
      img = document.createElement("img");
      img.dataset.role = "bgStaticImg";
      img.alt = "";
      img.draggable = false;
      wrap.innerHTML = "";
      wrap.appendChild(img);
    }

    if (img.getAttribute("src") !== p) img.src = p;
  };

  // 1) Sync/Init: aus PB_CONFIG lesen und anwenden
  PB.syncBgStaticImgFromConfig = function () {
    const bgPath = String(
      PB._getDeep?.(window.PB_CONFIG, "general.system.ui.bgStaticImg") ?? "",
    ).trim();
    PB.applyBgStaticImg(bgPath);

    (PB._dbg || console.log)(
      tr("bg_static_img.sync_from_config", "[bgStaticImg] sync from config ="),
      bgPath || tr("common.empty", "(empty)"),
    );
  };

  // 2) Bind: Input im Settings-Modal live anwenden + PB_CONFIG aktuell halten
  PB.initBgStaticImgBindings =
    PB.initBgStaticImgBindings ||
    function () {
      const input = document.getElementById("uiBgStaticImg");
      if (!input) return;

      if (input.dataset.pbBgStaticImgBound === "1") return;
      input.dataset.pbBgStaticImgBound = "1";

      const handler = () => {
        const path = String(input.value ?? "").trim();

        // sofort anwenden
        PB.applyBgStaticImg(path);

        // PB_CONFIG aktualisieren
        window.PB_CONFIG = window.PB_CONFIG || {};
        window.PB_CONFIG.general = window.PB_CONFIG.general || {};
        window.PB_CONFIG.general.system = window.PB_CONFIG.general.system || {};
        window.PB_CONFIG.general.system.ui =
          window.PB_CONFIG.general.system.ui || {};
        window.PB_CONFIG.general.system.ui.bgStaticImg = path;

        (PB._dbg || console.log)(
          tr("bg_static_img.changed", "[bgStaticImg] changed ="),
          path || tr("common.empty", "(empty)"),
        );
      };

      input.addEventListener("input", handler); // live während Tippen
      input.addEventListener("change", handler); // fallback
    };


  // 9) System-Service Status aus Python mit general.system.* synchronisieren
  //    Quelle der Wahrheit ist hier der echte OS-Zustand der Python-Endpunkte.
  PB.syncSystemServiceStatusFromPython = PB.syncSystemServiceStatusFromPython || async function () {
    const boolOrNull = (value) => {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (["1", "true", "yes", "y", "on", "enabled", "installed", "active"].includes(v)) return true;
        if (["0", "false", "no", "n", "off", "disabled", "missing", "inactive"].includes(v)) return false;
      }
      return null;
    };

    const extractEnabled = (json) => {
      if (!json || typeof json !== "object") return null;
      const candidates = [
        json.enabled,
        json.installed,
        json.active,
        json.is_enabled,
        json.isEnabled,
        json.status && json.status.enabled,
        json.status && json.status.installed,
        json.result && json.result.enabled,
        json.result && json.result.installed,
      ];
      for (const c of candidates) {
        const b = boolOrNull(c);
        if (b !== null) return b;
      }
      return null;
    };

    const getPort = () => {
      try {
        if (PB.pythonUi && typeof PB.pythonUi.getPort === "function") {
          return PB.pythonUi.getPort();
        }
      } catch (_) {}

      const el = document.getElementById("settingPythonPort");
      const fromInput = parseInt(String(el?.value ?? ""), 10);
      if (Number.isFinite(fromInput) && fromInput > 0) return fromInput;

      const candidates = [
        PB._getDeep?.(window.PB_CONFIG, "general.Python_ServerPort"),
        PB._getDeep?.(window.PB_CONFIG, "general.pythonServer.port"),
        PB._getDeep?.(window.PB_CONFIG, "pythonServer.Python_ServerPort"),
        PB._getDeep?.(window.PB_CONFIG, "pythonServer.port"),
      ];

      for (const c of candidates) {
        const n = parseInt(String(c ?? ""), 10);
        if (Number.isFinite(n) && n > 0) return n;
      }

      return 8053;
    };

    const fetchStatus = async (endpoint) => {
      const port = getPort();
      const url = `http://127.0.0.1:${port}${endpoint}`;
      const res = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json || json.ok === false) {
        throw new Error(json?.message || json?.error || `status_failed:${endpoint}`);
      }
      return json;
    };

    const setCheckboxIfPresent = (id, enabled) => {
      const el = document.getElementById(id);
      if (!el || typeof enabled !== "boolean") return;
      el.checked = enabled;
    };

    const currentAuto = boolOrNull(PB._getDeep?.(window.PB_CONFIG, "general.system.autostart"));
    const currentTask = boolOrNull(PB._getDeep?.(window.PB_CONFIG, "general.system.task_planer_service"));

    let autostartEnabled = null;
    let taskPlanerEnabled = null;

    try {
      const [autostartStatus, taskPlanerStatus] = await Promise.allSettled([
        fetchStatus("/autostart/status"),
        fetchStatus("/task_planer_service/status"),
      ]);

      if (autostartStatus.status === "fulfilled") {
        autostartEnabled = extractEnabled(autostartStatus.value);
      } else {
        console.warn("[SystemStatusSync] /autostart/status failed:", autostartStatus.reason);
      }

      if (taskPlanerStatus.status === "fulfilled") {
        taskPlanerEnabled = extractEnabled(taskPlanerStatus.value);
      } else {
        console.warn("[SystemStatusSync] /task_planer_service/status failed:", taskPlanerStatus.reason);
      }
    } catch (e) {
      console.warn("[SystemStatusSync] failed:", e);
      return { ok: false, error: "status_fetch_failed", details: e };
    }

    const systemPatch = {};

    if (typeof autostartEnabled === "boolean" && currentAuto !== autostartEnabled) {
      systemPatch.autostart = autostartEnabled;
    }

    if (typeof taskPlanerEnabled === "boolean" && currentTask !== taskPlanerEnabled) {
      systemPatch.task_planer_service = taskPlanerEnabled;
    }

    // UI sofort an den echten Status anpassen, auch wenn kein Speichern nötig ist.
    setCheckboxIfPresent("settingAutostartEnabled", autostartEnabled);
    setCheckboxIfPresent("settingTaskPlanerServiceEnabled", taskPlanerEnabled);

    if (!Object.keys(systemPatch).length) {
      return {
        ok: true,
        changed: false,
        autostart: autostartEnabled,
        task_planer_service: taskPlanerEnabled,
      };
    }

    window.PB_CONFIG = window.PB_CONFIG || {};
    window.PB_CONFIG.general = window.PB_CONFIG.general || {};
    window.PB_CONFIG.general.system = window.PB_CONFIG.general.system || {};
    Object.assign(window.PB_CONFIG.general.system, systemPatch);

    // Falls das Settings-Formular bereits im DOM ist, dessen Werte ebenfalls synchron halten.
    const form = document.getElementById("formGeneralSettings");
    if (form) {
      if ("autostart" in systemPatch) setCheckboxIfPresent("settingAutostartEnabled", systemPatch.autostart);
      if ("task_planer_service" in systemPatch) setCheckboxIfPresent("settingTaskPlanerServiceEnabled", systemPatch.task_planer_service);
    }

    if (typeof PB.configFileSet !== "function") {
      console.warn("[SystemStatusSync] PB.configFileSet missing; updated PB_CONFIG only", systemPatch);
      return {
        ok: false,
        changed: true,
        saved: false,
        error: "configFileSet_missing",
        patch: { system: systemPatch },
      };
    }

    try {
      await new Promise((resolve, reject) => {
        const req = PB.configFileSet(PB.MAIN_CONFIG_FILE || "config/config.json", {
          system: systemPatch,
        });

        if (req && typeof req.done === "function") {
          req.done((res) => {
            if (res && res.ok === false) reject(res);
            else resolve(res);
          }).fail(reject);
          return;
        }

        Promise.resolve(req).then(resolve).catch(reject);
      });

      $(document).trigger("pb:configLoaded", [window.PB_CONFIG, "general", window.PB_CONFIG.general]);

      if (typeof showMsg === "function") {
        showMsg(
          tr(
            "system.status_sync.saved",
            "Systemstatus wurde mit der Konfiguration synchronisiert.",
          ),
          "success",
        );
      }

      return {
        ok: true,
        changed: true,
        saved: true,
        patch: { system: systemPatch },
      };
    } catch (e) {
      console.warn("[SystemStatusSync] config save failed:", e);
      if (typeof showMsg === "function") {
        showMsg(
          tr(
            "system.status_sync.save_failed",
            "Systemstatus konnte nicht in der Konfiguration gespeichert werden.",
          ),
          "danger",
        );
      }
      return {
        ok: false,
        changed: true,
        saved: false,
        error: "config_save_failed",
        details: e,
        patch: { system: systemPatch },
      };
    }
  };


  // Bootstrap nach DOM-ready genau einmal starten
  PB.startBootstrapOnce =
    PB.startBootstrapOnce ||
    async function () {
      if (PB._bootstrapStartPromise) return PB._bootstrapStartPromise;

      PB._bootstrapStartPromise = (async () => {
        try {
          await PB.initBootstrap();
        } catch (e) {
          console.warn(e);
          throw e;
        }
      })();

      return PB._bootstrapStartPromise;
    };

  $(async function () {
    try {
      await PB.startBootstrapOnce();
    } catch (e) {
      console.warn(e);
    }
  });

})(jQuery);
