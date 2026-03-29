// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * windows_picker_bindings.js — File/Folder Picker Bindings
 * Nutzt PB.pythonSvc (aus pb_python_server.js)
 * → übernimmt nur UI-Logik, kein Restart/Fallback mehr hier
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

  // Safety check
  if (!PB.pythonSvc || typeof PB.pythonSvc.pick !== "function") {
    console.error(
      t(
        "windows.picker.bindings.err.missing_service",
        "[windows_picker_bindings] PB.pythonSvc missing. pb_python_server.js must be loaded first."
      )
    );
    return;
  }

  // -------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------
  function getInitialPath($btn, $input) {
    const targetSel = $btn.attr("data-target");
    const lsKey = "pb_last_dir_" + targetSel;
    const current = String($input.val() || "").trim();
    const lastDir = String(localStorage.getItem(lsKey) || "").trim();
    const hintBtn = String($btn.attr("data-initial") || "").trim();
    const hintInp = String($input.attr("data-initial") || "").trim();
    return hintBtn || hintInp || current || lastDir || "";
  }

  async function handlePick($btn, mode, opts = {}) {
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

      // last folder
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
    const base =
      window.PB && PB.pythonSvc && typeof PB.pythonSvc.baseUrl === "function"
        ? PB.pythonSvc.baseUrl(PB.pythonSvc.port)
        : "http://127.0.0.1:8053";

    const q = new URLSearchParams();
    if (opt.title) q.set("title", opt.title);
    if (opt.path) q.set("path", opt.path);
    if (opt.filter) q.set("filter", opt.filter);
    if (opt.subdir) q.set("subdir", opt.subdir);
    if (opt.prefix != null) q.set("prefix", opt.prefix); // prefix darf leer sein
    if (opt.overwrite != null) q.set("overwrite", opt.overwrite);

    const url = `${base}/pickUpload?${q.toString()}`;

    // optional: API Key Header (wenn pythonSvc das anbietet)
    const headers = {};
    if (window.PB && PB.pythonSvc && typeof PB.pythonSvc.authHeaders === "function") {
      Object.assign(headers, PB.pythonSvc.authHeaders());
    }

    const r = await fetch(url, { cache: "no-store", headers });
    const j = await r.json();

    // Events (für UI)
    $(document).trigger("pb:upload:result", [j, $btn]);

    if (!j.ok) {
      $(document).trigger("pb:upload:cancel", [j, $btn]);
      return j;
    }

    // optional: target schreiben (z.B. hidden input)
    if (opt.target) {
      const $t = $(opt.target);
      if ($t.length) $t.val(j.saved_url || j.saved_rel || "");
    }

    // optional: Button-data setzen
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

      // activeEvent: Pfad aus PB_CONFIG bauen
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
        // Standard: data-path bevorzugen, sonst target als input-id
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

    // File picker
    $(document).on("click", ".pb-pick-file", async function (e) {
      e.preventDefault();
      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;
      $btn.data("pbBusy", true);

      await handlePick($btn, "file", {
        title: $btn.attr("data-title"),
        filter: $btn.attr("data-filter")
      });

      $btn.data("pbBusy", false);
    });

    // Folder picker
    $(document).on("click", ".pb-pick-folder", async function (e) {
      e.preventDefault();
      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;
      $btn.data("pbBusy", true);

      await handlePick($btn, "folder", {
        title: $btn.attr("data-title")
      });

      $btn.data("pbBusy", false);
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
          overwrite: $btn.attr("data-overwrite"), // "1"/"0"/"true"/"false"
          target: $btn.attr("data-target") // selector für input/hidden
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

    // Close Browser (Kiosk / Python closeBrowser)
    $(document).on("click", ".pb-close-browser", async function (e) {
      e.preventDefault();

      const $btn = $(this);
      if ($btn.prop("disabled") || $btn.data("pbBusy")) return;

      $btn.data("pbBusy", true).prop("disabled", true);

      // Status-Modal anzeigen
      const modal = PB.showBusyModal("modalCloseBrowser");

      try {
        const base =
          window.PB && PB.pythonSvc && typeof PB.pythonSvc.baseUrl === "function"
            ? PB.pythonSvc.baseUrl(PB.pythonSvc.port)
            : "http://127.0.0.1:8053";

        const server = PB._getDeep(window.PB_CONFIG, "pythonServer");
        const key = server?.AuthKey;
        if (!key) {
          throw new Error(
            t("windows.picker.closebrowser.err.missing_api_key", "API key missing")
          );
        }

        const res = await fetch(`${base}/closebrowser`, {
          method: "POST",
          headers: { "X-Api-Key": key },
          cache: "no-store"
        });

        const json = await res.json().catch(() => ({}));
        if (!json || json.ok !== true) {
          throw new Error(json?.error || json?.detail || t("windows.picker.closebrowser.err.failed", "closeBrowser failed"));
        }

        // Ab hier stirbt der Browser → Modal verschwindet automatisch
        $(document).trigger("pb:browser:closed", [json]);
      } catch (err) {
        console.error("[pb-close-browser]", err);

        // Fehler → Modal schließen
        modal?.hide?.();

        alert(
          t("windows.picker.closebrowser.alert.failed", "Browser could not be closed:\n{msg}", {
            msg: err?.message || String(err)
          })
        );
      } finally {
        $btn.data("pbBusy", false).prop("disabled", false);
      }
    });
  };

  // Optional: direkt beim Laden aktivieren
  $(PB.initWindowsPickerBindings);
})(jQuery);
