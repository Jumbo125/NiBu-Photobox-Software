// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/** pb_core.js — Basismodul (Namespace, Endpoints, Ajax, Deep-Helpers, sleep, showMsg) */
(function ($) {
  "use strict";

  // Namespace + PB_CONFIG Default
  window.PB = window.PB || {};
  const PB = window.PB;

 

  window.PB_CONFIG = window.PB_CONFIG || {
    general: {},
    camera: { camera_settings: {} },
    render: {},
    activeEvent: {}
  };

  // i18n helper (funktioniert auch, wenn i18n.js noch nicht geladen ist)
  function t(key, fallback) {
    try {
      if (typeof PB.t === "function") return PB.t(key, fallback);
      if (typeof window.pbT === "function") return window.pbT(key, fallback);
    } catch (_) {}
    return fallback || key;
  }

  // ==========================================================
  /**
   * PB.ENDPOINTS
   * Zentrale Endpoint-Konstanten (können vor dem Laden anderer Module überschrieben werden).
   */
  PB.ENDPOINTS = PB.ENDPOINTS || {
    config_rw: "api/r_w_config.php",
    camera_config: "api/camera_config.php",
    control_device_list: "api/control_device_list.php",
    camera_iframe: "tools/camerabridge/stream.html",
    select_windows_file: "api/select_windows_file.php",
    select_windows_folder: "api/select_windows_folder.php",
    camera_bridge_php: "api/camerabridge.php",
    camera_api_php: "api/camera_api.php"
  };

  const php_r_w_config = PB.ENDPOINTS.config_rw;
  const camera_config = PB.ENDPOINTS.camera_config;
  // Fix/Compat: Tippfehler im Variablennamen abfangen
  const camera_cofig = camera_config;

  /**
   * Sendet ein Objekt als JSON per POST und erwartet JSON als Antwort.
   */
  PB.postJson =
    PB.postJson ||
    function (url, dataObj) {
      return $.ajax({
        url: url,
        method: "POST",
        data: JSON.stringify(dataObj),
        contentType: "application/json; charset=utf-8",
        dataType: "json",
        cache: false
      });
    };

  /**
   * Lädt JSON per GET (jQuery.getJSON Wrapper).
   */
  PB.getJson =
    PB.getJson ||
    function (url) {
      return $.getJSON(url);
    };

  /**
   * Promise-basierter Sleep/Delay Helper (ms).
   */
  PB.sleep = PB.sleep || ((ms) => new Promise((res) => setTimeout(res, ms)));

  /**
   * Toast/Message Helper (Bootstrap Toast, fallback alert).
   */
  window.showMsg =
    window.showMsg ||
    function (msg, type = "info") {
      const hasBootstrapToast = typeof bootstrap !== "undefined" && bootstrap?.Toast;

      // Fallback (kein Bootstrap Toast vorhanden)
      if (!hasBootstrapToast) {
        alert(String(msg));
        return;
      }

      // Toast-Container sicherstellen
      let container = document.getElementById("pbToastContainer");
      if (!container) {
        container = document.createElement("div");
        container.id = "pbToastContainer";
        container.className = "toast-container position-fixed bottom-0 end-0 p-3";
        document.body.appendChild(container);
      }

      // Toast erstellen
      const toastEl = document.createElement("div");
      toastEl.className = `toast align-items-center text-bg-${type} border-0 mb-2`;
      toastEl.role = "alert";
      toastEl.innerHTML = `
        <div class="d-flex">
          <div class="toast-body">${String(msg)}</div>
          <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
        </div>
      `;

      container.appendChild(toastEl);

      const toast = new bootstrap.Toast(toastEl, { delay: 3500 });
      toast.show();
      toastEl.addEventListener("hidden.bs.toast", () => toastEl.remove());
    };

  // Alias: PB.showMsg bleibt verfügbar
  PB.showMsg = PB.showMsg || window.showMsg;

  /**
   * Setzt einen Wert in einem Objekt über einen Dot-Path (z.B. 'camera.device.id').
   */
  PB._setDeep =
    PB._setDeep ||
    function (obj, path, value) {
      const parts = (path || "").split(".").filter(Boolean);
      if (!parts.length) return;

      let cur = obj;
      for (let i = 0; i < parts.length - 1; i++) {
        const k = parts[i];
        if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
        cur = cur[k];
      }
      cur[parts[parts.length - 1]] = value;
    };

  /**
   * Liest einen Wert aus einem Objekt über einen Dot-Path; liefert undefined falls nicht vorhanden.
   */
  PB._getDeep =
    PB._getDeep ||
    function (obj, path) {
      const parts = (path || "").split(".").filter(Boolean);
      let cur = obj;
      for (let i = 0; i < parts.length; i++) {
        if (cur == null) return undefined;
        cur = cur[parts[i]];
      }
      return cur;
    };

  // Datei-Pfade
  PB.CONFIG_PATHS = PB.CONFIG_PATHS || {
    general: "config/config/config.json",
    camera: "config/config/camera_config.json",
    render: "config/config/render_config.json",
    activeEvent: "config/config/active_event_config.json",
    cameraBridgeWorker: "tools/camerabridge/Worker/appsettings.json",
    cameraBridgeServer: "tools/camerabridge/APIServer/ApiServer_settings.json",
    pythonServer: "tools/python_portable/server_config.json"
  };

  // Lädt alle JSON-Configs parallel in PB_CONFIG
  // opts: true oder { silent:true } → ohne UI-Events laden
  PB.loadAllConfigs = async function (opts) {
    PB._configsLoaded = false;
    PB._configsLoadStarted = true;

    const silent = opts === true || (opts && opts.silent);

    window.PB_CONFIG = window.PB_CONFIG || {};

    if (!silent) {
      $(document).trigger("pb:configLoading");
    }

    const promises = Object.entries(PB.CONFIG_PATHS).map(([key, path]) => {
      const url = path + "?_=" + Date.now(); // Cache-Buster

      return PB.getJson(url)
        .then((cfg) => {
          window.PB_CONFIG[key] = cfg;
          return [key, cfg];
        })
        .catch((err) => {
          console.warn("Config load failed", key, err);
          window.PB_CONFIG[key] = window.PB_CONFIG[key] || {};
          return [key, null];
        });
    });

    const results = await Promise.all(promises);

    PB._configsLoaded = true;

    if (!silent) {
      $(document).trigger("pb:allConfigsLoaded", [window.PB_CONFIG, results]);
    }

    console.log(
      "[PB] All configs loaded" + (silent ? " (silent)" : ""),
      results.map((r) => r[0])
    );
    return window.PB_CONFIG;
  };

  PB.configKeyFromFile = function (fileRel) {
    const f = String(fileRel || "").toLowerCase().replace(/\\/g, "/");

    if (f.endsWith("/config.json")) return "general";
    if (f.includes("camera_config.json")) return "camera";
    if (f.includes("render_config.json")) return "render";
    if (f.includes("active_event_config.json")) return "activeEvent";

    if (f.includes("/worker/appsettings.json")) return "cameraBridgeWorker";
    if (
      f.includes("/apiserver/apiserversettings.json") ||
      f.includes("/apiserver/apiserver_settings.json") ||
      f.includes("apiserver_settings.json")
    )
      return "cameraBridgeServer";

    if (f.includes("/python_portable/server_config.json")) return "pythonServer";

    return "general";
  };

  /**
   * ZIP hochladen und serverseitig importieren.
   * Rückgabe: jQuery Promise (resolve mit response oder {skipped:true})
   */
  PB.uploadActiveEventTemplateZip = function ($modal) {
    const dfd = $.Deferred();

    try {
      if (!$modal || !$modal.length) {
        dfd.resolve({ skipped: true, reason: "no modal" });
        return dfd.promise();
      }

      const $inp = $modal.find("#eventTemplateZip");
      if (!$inp.length) {
        dfd.resolve({ skipped: true, reason: "no input" });
        return dfd.promise();
      }

      const fileEl = $inp[0];
      const file = fileEl && fileEl.files && fileEl.files[0] ? fileEl.files[0] : null;
      if (!file) {
        dfd.resolve({ skipped: true, reason: "no file selected" });
        return dfd.promise();
      }

      // optional überschreibbar per data-attrs
      const endpoint = String($inp.attr("data-pb-upload-endpoint") || "api/set_Active_template.php").trim();
      const field = String($inp.attr("data-pb-upload-field") || "zip").trim();

      const fd = new FormData();
      fd.append(field, file);

      (PB._dbg || console.log)("[ZIP] upload start ->", endpoint, "field=", field, "name=", file.name);

      $.ajax({
        url: endpoint,
        method: "POST",
        data: fd,
        processData: false,
        contentType: false,
        cache: false,
        timeout: 30000
      })
        .done(function (res) {
          if (res && res.ok) {
            PB.showMsg(t("zip.import.success", "Template imported ✅"), "success");
            try {
              $inp.val("");
            } catch (_) {}
            dfd.resolve(res);
          } else {
            const errText = res && res.error ? res.error : t("zip.import.failed", "ZIP import failed");
            PB.showMsg(t("zip.import.error_prefix", "Template ZIP error: ") + errText, "danger");
            dfd.reject(errText);
          }
        })
        .fail(function (xhr, status) {
          const st = status || t("zip.upload.request_failed", "request failed");
          const errText = t("zip.upload.error_prefix", "ZIP upload error: ") + st;
          (PB._dbg || console.warn)("[ZIP] ajax fail", status, xhr);
          PB.showMsg(errText, "danger");
          dfd.reject(errText);
        });

      return dfd.promise();
    } catch (e) {
      (PB._dbg || console.warn)("[ZIP] exception", e);
      PB.showMsg(t("zip.error_prefix", "ZIP error: ") + (e && e.message ? e.message : e), "danger");
      dfd.reject(e);
      return dfd.promise();
    }
  };

  // Prüft einen Windows-ORDNERNAMEN (ein Segment), nicht einen kompletten Pfad
  PB.checkWindowsFolderName = function (name) {
    if (name == null) return { ok: false, reason: t("eventName.empty", "Please enter a name.") };

    const s = String(name);
    if (s.length === 0) return { ok: false, reason: t("eventName.empty", "Please enter a name.") };

    // darf nicht mit Leerzeichen oder Punkt enden
    if (/[ .]$/.test(s)) {
      return { ok: false, reason: t("eventName.trailing", "Must not end with dot or space.") };
    }

    // keine "." oder ".."
    if (s === "." || s === "..") {
      return { ok: false, reason: t("eventName.dot", '"." and ".." are not allowed.') };
    }

    // verbotene Zeichen + Steuerzeichen
    if (/[\x00-\x1F<>:"/\\|?*]/.test(s)) {
      return { ok: false, reason: t("eventName.chars", 'Contains invalid characters (e.g. <>:"/\\\\|?*).') };
    }

    // Windows reservierte Device-Namen (auch mit Extension, z.B. "con.txt")
    const trimmed = s.replace(/[ .]+$/g, "");
    const upper = trimmed.toUpperCase();
    const base = upper.split(".")[0];

    const reserved = new Set([
      "CON", "PRN", "AUX", "NUL",
      "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8", "COM9",
      "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9"
    ]);

    if (reserved.has(base)) {
      return { ok: false, reason: t("eventName.reserved", "Reserved Windows name (e.g. CON, AUX, COM1…).") };
    }

    // optional: Längenlimit (NTFS max. 255 Zeichen je Segment)
    if (s.length > 80) {
      return { ok: false, reason: t("eventName.length", "Please shorten (max. 80 characters).") };
    }

    return { ok: true, reason: "" };
  };

  PB.applyEventNameValidationUI = function ($inp) {
    const res = PB.checkWindowsFolderName($inp.val());

    // Feedback Element sicherstellen
    let $fb = $inp.siblings(".pb-eventname-feedback");
    if (!$fb.length) {
      $fb = $('<div class="invalid-feedback pb-eventname-feedback"></div>');
      $inp.after($fb);
    }

    if (!res.ok) {
      $inp.addClass("is-invalid").removeClass("is-valid");
      $fb.text(res.reason).show();
    } else {
      $inp.removeClass("is-invalid").addClass("is-valid");
      $fb.text("").hide();
    }

    // Save im selben Modal deaktivieren
    const $modal = $inp.closest(".modal");
    const $btn = $modal.find(".pb-save-config");
    if ($btn.length) $btn.prop("disabled", !res.ok);

    return res.ok;
  };

  /**
   * PB.joinAndNormalizePath(root, sub)
   * String-Normalisierung für Pfad-Joins (Windows "\" vs. "/" sonst).
   */
  PB.joinAndNormalizePath =
    PB.joinAndNormalizePath ||
    function (root, sub) {
      const r = String(root || "").trim();
      const s = String(sub || "").trim();

      const isWin = /\\/.test(r) || /^[a-zA-Z]:/.test(r);
      const sep = isWin ? "\\" : "/";

      const joined = [r, s].filter(Boolean).join(sep);
      if (!joined) return "";

      return joined
        .replace(/[\\/]+/g, sep)
        .replace(new RegExp((sep === "\\" ? "\\\\" : sep) + "+$"), "");
    };
})(jQuery);
