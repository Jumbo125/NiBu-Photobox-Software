// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * pb_python_ui_jquery.js
 * ---------------------------------------------------------------------------
 * jQuery-Variante des Python-UI Scripts.
 * Nutzt PB.pythonSvc (pb_python_server.js) und aktualisiert Status/Buttons.
 *
 * Erwartete Elemente:
 *   #settingPythonPort
 *   #pbPythonApiKey
 *   #pythonServerBar
 *   #pythonServerInfo
 *   #pythonServerMsg
 *   #btnPythonRefresh
 *   #btnPythonStart
 *   #btnPythonStop
 *   #btnPythonRestart
 *   #greenwallReferenceImagePath
 *   #renderGreenwallReferenceProfilePath
 *   #greenwallProfileGenerateStatus
 *   #btnGenerateGreenwallProfile
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

  const tr = (key, fallback) =>
    typeof window.pbT === "function" ? window.pbT(key, fallback) : fallback;

  window.PB = window.PB || {};
  const PB = window.PB;

  if (!PB.pythonSvc) {
    console.warn(
      t(
        "python.ui.warn.missing_service",
        "[pythonUi] PB.pythonSvc missing – pb_python_server.js not loaded?"
      )
    );
    return;
  }

  PB.pythonUi = PB.pythonUi || {};
  const UI = PB.pythonUi;
  const SVC = PB.pythonSvc;

  // Expose translator for other python-ui modules (optional)
  UI.t = t;

  // ------------------------------------------------------------
  // Helpers (Formfelder)
  // ------------------------------------------------------------
  UI.$elPort = () => $("#settingPythonPort");
  UI.$elKey = () => $("#pbPythonApiKey");

  UI.getPythonApiKey = () => {
    const py = PB._getDeep?.(window.PB_CONFIG, "pythonServer") || {};
    return String(py.AuthKey || "").trim();
  };

  UI.getPort = () => {
    const raw = UI.$elPort().val();
    const p = parseInt(String(raw ?? "8053"), 10);
    return Number.isFinite(p) && p > 0 ? p : 8053;
  };

  UI.authHeaders = () => {
    const h = { "Content-Type": "application/json" };
    const k = UI.getPythonApiKey();
    if (k) h["X-Api-Key"] = k;
    return h;
  };

  // ------------------------------------------------------------
  // UI Elements
  // ------------------------------------------------------------
  UI.$bar = () => $("#pythonServerBar");
  UI.$info = () => $("#pythonServerInfo");
  UI.$msg = () => $("#pythonServerMsg");

  UI.setMsg = (text, isError = false) => {
    const $el = UI.$msg();
    if (!$el.length) return;

    $el
      .text(text || "")
      .attr("class", "small mt-1 " + (isError ? "text-danger" : "text-success"));
  };

  UI.setState = (running, label) => {
    const $bar = UI.$bar();
    const $info = UI.$info();

    const barText = running
      ? t("python.ui.state.running", "running")
      : t("python.ui.state.stopped", "stopped");

    if ($bar.length) {
      $bar
        .css("width", running ? "100%" : "0%")
        .attr("class", "progress-bar " + (running ? "bg-success" : "bg-danger"))
        .text(barText);
    }

    if ($info.length) {
      const fallback = running
        ? t("python.ui.status.running", "Status: running")
        : t("python.ui.status.stopped", "Status: stopped");
      $info.text(label || fallback);
    }

    // Buttons
    $("#btnPythonStop").prop("disabled", !running);
    $("#btnPythonRestart").prop("disabled", !running);
  };

  // ------------------------------------------------------------
  // Status (nur bei Klick oder gezieltem Aufruf)
  // ------------------------------------------------------------
  UI.status = async () => {
    UI.setMsg("");

    const port = UI.getPort();
    SVC.port = port;

    const okPing = await SVC.ping(port);
    if (!okPing) {
      UI.setState(
        false,
        t(
          "python.ui.status.stopped_not_reachable",
          "Status: stopped / not reachable @ 127.0.0.1:{port}",
          { port }
        )
      );
      UI.setMsg(
        t(
          "python.ui.msg.service_unreachable",
          "⚠️ Python service not reachable (port {port}).",
          { port }
        ),
        true
      );
      return false;
    }

    try {
      const json = await SVC.fetch("/runtime", { port, timeoutMs: 1500 });
      if (json && json.ok) {
        UI.setState(
          true,
          t(
            "python.ui.status.running_pid",
            "Status: running (PID {pid}) @ {host}:{port}",
            { pid: json.pid, host: json.host, port: json.port }
          )
        );
        UI.setMsg(
          t(
            "python.ui.msg.service_reachable_pid",
            "✅ Python service reachable (PID {pid}).",
            { pid: json.pid }
          ),
          false
        );
        return true;
      }
    } catch (_) {
      // ping ok, runtime nicht -> trotzdem running
    }

    UI.setState(
      true,
      t(
        "python.ui.status.running_local",
        "Status: running @ 127.0.0.1:{port}",
        { port }
      )
    );
    UI.setMsg(t("python.ui.msg.service_reachable", "✅ Python service reachable."), false);
    return true;
  };

  // ------------------------------------------------------------
  // Start / Stop / Restart
  // ------------------------------------------------------------
  UI.start = async () => {
    UI.setMsg(t("python.ui.msg.starting", "Starting …"));

    const port = UI.getPort();
    try {
      const ok = await SVC.startViaPhp({ port });
      if (!ok) throw new Error("startViaPhp failed");

      await SVC.waitReady(port, 15000);
      UI.setMsg(t("python.ui.msg.start_triggered", "Start triggered."), false);
    } catch (e) {
      UI.setMsg(
        t(
          "python.ui.msg.start_failed",
          "Start failed (check PHP start endpoint or script path)."
        ),
        true
      );
    } finally {
      await UI.status();
    }
  };

  UI.stop = async () => {
    UI.setMsg(t("python.ui.msg.stopping", "Stopping …"));

    const port = UI.getPort();
    try {
      const body = JSON.stringify({ api_key: UI.getPythonApiKey() });
      await SVC.fetch("/shutdown", {
        port,
        method: "POST",
        headers: UI.authHeaders(),
        body,
        timeoutMs: 3000
      });

      UI.setMsg(t("python.ui.msg.stop_signal_sent", "Stop signal sent."), false);
    } catch (e) {
      console.warn(t("python.ui.warn.shutdown_error", "shutdown error:"), e);
      UI.setMsg(
        t(
          "python.ui.msg.shutdown_unconfirmed",
          "Shutdown request could not be confirmed (see console)."
        ),
        true
      );
    } finally {
      if (typeof PB.sleep === "function") await PB.sleep(400);
      else await new Promise((r) => setTimeout(r, 400));
      await UI.status();
    }
  };

  UI.restart = async () => {
    UI.setMsg(t("python.ui.msg.restarting", "Restarting …"));

    const port = UI.getPort();
    const isUp = await SVC.ping(port);
    if (isUp) await UI.stop();

    if (typeof PB.sleep === "function") await PB.sleep(500);
    else await new Promise((r) => setTimeout(r, 500));

    await UI.start();
  };

  // ------------------------------------------------------------
  // Greenwall Profile UI
  // ------------------------------------------------------------
  UI.$greenwallImagePath = () => $("#greenwallReferenceImagePath");
  UI.$greenwallProfilePath = () => $("#renderGreenwallReferenceProfilePath");
  UI.$greenwallStatus = () => $("#greenwallProfileGenerateStatus");
  UI.$greenwallGenerateBtn = () => $("#btnGenerateGreenwallProfile");

  UI.setGreenwallProfileStatus = (message, type) => {
    const $el = UI.$greenwallStatus();
    if (!$el.length) return;

    $el
      .text(message || "")
      .removeClass("text-muted text-success text-danger text-warning")
      .addClass(
        type === "success"
          ? "text-success"
          : type === "error"
            ? "text-danger"
            : type === "warning"
              ? "text-warning"
              : "text-muted"
      );
  };

  UI.extractProfilePath = (json) => {
    if (!json || typeof json !== "object") return "";

    return (
      json.profile_path ||
      json.reference_profile_path ||
      json.output_path ||
      json.path ||
      ""
    );
  };

  PB.generateGreenwallReferenceProfile = async function generateGreenwallReferenceProfile() {
    const $imagePathInput = UI.$greenwallImagePath();
    const $profilePathInput = UI.$greenwallProfilePath();

    if (!$imagePathInput.length || !$profilePathInput.length) {
      console.warn("[Greenwall] Required input fields not found.");
      return { ok: false, error: "missing_elements" };
    }

    const imagePath = $.trim(String($imagePathInput.val() || ""));
    if (!imagePath) {
      UI.setGreenwallProfileStatus(
        tr(
          "overlay.render_settings.greenwall.generate_profile.no_image_path",
          "Bitte zuerst ein Referenzbild auswählen."
        ),
        "warning"
      );
      return { ok: false, error: "missing_image_path" };
    }

    UI.setGreenwallProfileStatus(
      tr(
        "overlay.render_settings.greenwall.generate_profile.generating",
        "Referenzprofil wird generiert..."
      ),
      "default"
    );

    const port = UI.getPort();
    const url = `http://127.0.0.1:${port}/greenwall/profile`;

    try {
      const json = await $.ajax({
        url,
        method: "POST",
        contentType: "application/json",
        dataType: "json",
        data: JSON.stringify({
          path: imagePath
        }),
        timeout: 15000
      });

      const profilePath = UI.extractProfilePath(json);
      if (!profilePath) {
        UI.setGreenwallProfileStatus(
          tr(
            "overlay.render_settings.greenwall.generate_profile.no_profile_path",
            "Die API hat keinen Profilpfad zurückgegeben."
          ),
          "error"
        );
        return { ok: false, error: "missing_profile_path", response: json };
      }

      $profilePathInput
        .val(profilePath)
        .trigger("input")
        .trigger("change");

      UI.setGreenwallProfileStatus(
        tr(
          "overlay.render_settings.greenwall.generate_profile.success",
          "Referenzprofil erfolgreich generiert."
        ),
        "success"
      );

      return { ok: true, profile_path: profilePath, response: json };
    } catch (xhrOrError) {
      console.error("[Greenwall] Request failed:", xhrOrError);

      let message = tr(
        "overlay.render_settings.greenwall.generate_profile.server_unreachable",
        "Python-Server nicht erreichbar."
      );

      if (xhrOrError && xhrOrError.responseJSON) {
        message =
          xhrOrError.responseJSON.message ||
          xhrOrError.responseJSON.error ||
          message;
      }

      UI.setGreenwallProfileStatus(message, "error");

      return {
        ok: false,
        error: "network_or_http_error",
        status: xhrOrError?.status || 0,
        response: xhrOrError?.responseJSON || null,
        details: xhrOrError
      };
    }
  };

  PB.initGreenwallReferenceProfileUI = function initGreenwallReferenceProfileUI() {
    UI.$greenwallGenerateBtn()
      .off("click.pbGreenwallProfile")
      .on("click.pbGreenwallProfile", async function () {
        await PB.generateGreenwallReferenceProfile();
      });
  };

  // ------------------------------------------------------------
  // Autostart / Task-Planer-Systemd Toggles
  // ------------------------------------------------------------
  UI.$autostartToggle = () => $("#settingAutostartEnabled");
  UI.$taskPlanerServiceToggle = () => $("#settingTaskPlanerServiceEnabled");

  UI.systemToggleConfigs = {
    autostart: {
      name: "autostart",
      label: "Autostart",
      $el: UI.$autostartToggle,
      statusEndpoint: "/autostart/status",
      enableEndpoint: "/autostart/enable",
      disableEndpoint: "/autostart/disable",
      successEnableKey: "python.ui.autostart.enabled",
      successEnableFallback: "✅ Autostart aktiviert.",
      successDisableKey: "python.ui.autostart.disabled",
      successDisableFallback: "✅ Autostart deaktiviert.",
      failEnableKey: "python.ui.autostart.enable_failed",
      failEnableFallback: "Autostart konnte nicht aktiviert werden.",
      failDisableKey: "python.ui.autostart.disable_failed",
      failDisableFallback: "Autostart konnte nicht deaktiviert werden."
    },
    task_planer_service: {
      name: "task_planer_service",
      label: "Task-Planer/systemd",
      $el: UI.$taskPlanerServiceToggle,
      statusEndpoint: "/task_planer_service/status",
      enableEndpoint: "/task_planer_service/enable",
      disableEndpoint: "/task_planer_service/disable",
      successEnableKey: "python.ui.task_planer_service.enabled",
      successEnableFallback: "✅ Task-Planer/systemd-Überwachung aktiviert.",
      successDisableKey: "python.ui.task_planer_service.disabled",
      successDisableFallback: "✅ Task-Planer/systemd-Überwachung deaktiviert.",
      failEnableKey: "python.ui.task_planer_service.enable_failed",
      failEnableFallback: "Task-Planer/systemd-Überwachung konnte nicht aktiviert werden.",
      failDisableKey: "python.ui.task_planer_service.disable_failed",
      failDisableFallback: "Task-Planer/systemd-Überwachung konnte nicht deaktiviert werden."
    }
  };

  UI.noAuthJsonHeaders = () => ({ "Content-Type": "application/json" });

  UI.showEndpointMessage = (message, isError = false) => {
    UI.setMsg(message, isError);

    const id = "pbPythonEndpointToastContainer";
    let container = document.getElementById(id);
    if (!container) {
      container = document.createElement("div");
      container.id = id;
      container.className = "toast-container position-fixed bottom-0 end-0 p-3";
      container.style.zIndex = "1080";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = "toast align-items-center border-0 show " + (isError ? "text-bg-danger" : "text-bg-success");
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");
    toast.setAttribute("aria-atomic", "true");
    toast.innerHTML = `
      <div class="d-flex">
        <div class="toast-body"></div>
        <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button>
      </div>
    `;
    toast.querySelector(".toast-body").textContent = message || "";
    container.appendChild(toast);

    const removeToast = () => {
      try { toast.remove(); } catch (_) {}
    };

    const closeBtn = toast.querySelector("[data-bs-dismiss='toast']");
    if (closeBtn) closeBtn.addEventListener("click", removeToast, { once: true });

    if (window.bootstrap && typeof window.bootstrap.Toast === "function") {
      try {
        const bsToast = new window.bootstrap.Toast(toast, { delay: 4500, autohide: true });
        toast.addEventListener("hidden.bs.toast", removeToast, { once: true });
        bsToast.show();
        return;
      } catch (_) {
        // Fallback below
      }
    }

    window.setTimeout(removeToast, 4500);
  };

  UI.extractToggleEnabled = (json) => {
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
      json.result && json.result.installed
    ];

    for (const value of candidates) {
      if (typeof value === "boolean") return value;
      if (typeof value === "number") return value !== 0;
      if (typeof value === "string") {
        const v = value.trim().toLowerCase();
        if (["1", "true", "yes", "y", "on", "enabled", "installed", "active"].includes(v)) return true;
        if (["0", "false", "no", "n", "off", "disabled", "missing", "inactive"].includes(v)) return false;
      }
    }

    return null;
  };

  UI.fetchNoAuthEndpoint = async (endpoint, options = {}) => {
    const port = UI.getPort();
    return await SVC.fetch(endpoint, {
      port,
      method: options.method || "GET",
      headers: UI.noAuthJsonHeaders(),
      body: options.body,
      timeoutMs: options.timeoutMs || 15000
    });
  };

  UI.loadSystemToggleStatus = async (name) => {
    const cfg = UI.systemToggleConfigs[name];
    if (!cfg) return { ok: false, error: "unknown_toggle" };

    const $el = cfg.$el();
    if (!$el.length) return { ok: false, error: "missing_element" };

    try {
      const json = await UI.fetchNoAuthEndpoint(cfg.statusEndpoint, {
        method: "GET",
        timeoutMs: 5000
      });

      if (json && json.ok === false) {
        throw new Error(json.message || json.error || "status_failed");
      }

      const enabled = UI.extractToggleEnabled(json);
      if (enabled !== null) {
        $el.prop("checked", enabled);
      }

      $el.prop("disabled", false);
      return { ok: true, enabled, response: json };
    } catch (e) {
      console.warn(`[pythonUi] ${name} status failed:`, e);
      $el.prop("disabled", false);
      return { ok: false, error: "status_failed", details: e };
    }
  };

  UI.loadAllSystemToggleStatuses = async () => {
    await Promise.all([
      UI.loadSystemToggleStatus("autostart"),
      UI.loadSystemToggleStatus("task_planer_service")
    ]);
  };

  UI.applySystemToggle = async (name, desiredEnabled) => {
    const cfg = UI.systemToggleConfigs[name];
    if (!cfg) return { ok: false, error: "unknown_toggle" };

    const $el = cfg.$el();
    if (!$el.length) return { ok: false, error: "missing_element" };

    const oldChecked = !desiredEnabled;
    const endpoint = desiredEnabled ? cfg.enableEndpoint : cfg.disableEndpoint;

    $el.prop("disabled", true);
    UI.showEndpointMessage(
      desiredEnabled
        ? t("python.ui.system_toggle.enabling", "Aktiviere {name} …", { name: cfg.label })
        : t("python.ui.system_toggle.disabling", "Deaktiviere {name} …", { name: cfg.label }),
      false
    );

    try {
      const json = await UI.fetchNoAuthEndpoint(endpoint, {
        method: "POST",
        body: JSON.stringify({}),
        timeoutMs: 30000
      });

      if (!json || json.ok === false) {
        throw new Error((json && (json.message || json.error)) || "endpoint_failed");
      }

      const reportedEnabled = UI.extractToggleEnabled(json);
      const finalEnabled = reportedEnabled === null ? desiredEnabled : reportedEnabled;
      $el.prop("checked", finalEnabled);

      UI.showEndpointMessage(
        desiredEnabled
          ? t(cfg.successEnableKey, cfg.successEnableFallback)
          : t(cfg.successDisableKey, cfg.successDisableFallback),
        false
      );

      return { ok: true, enabled: finalEnabled, response: json };
    } catch (e) {
      console.error(`[pythonUi] ${name} toggle failed:`, e);
      $el.prop("checked", oldChecked);

      UI.showEndpointMessage(
        desiredEnabled
          ? t(cfg.failEnableKey, cfg.failEnableFallback)
          : t(cfg.failDisableKey, cfg.failDisableFallback),
        true
      );

      return { ok: false, error: "toggle_failed", details: e };
    } finally {
      $el.prop("disabled", false);
    }
  };

  PB.initSystemServiceToggleUI = function initSystemServiceToggleUI() {
    UI.$autostartToggle()
      .off("change.pbSystemToggle")
      .on("change.pbSystemToggle", async function () {
        await UI.applySystemToggle("autostart", this.checked);
      });

    UI.$taskPlanerServiceToggle()
      .off("change.pbSystemToggle")
      .on("change.pbSystemToggle", async function () {
        await UI.applySystemToggle("task_planer_service", this.checked);
      });

    UI.loadAllSystemToggleStatuses();
  };

  // ------------------------------------------------------------
  // Wire buttons + initial refresh
  // ------------------------------------------------------------
  UI.bind = () => {
    $("#btnPythonRefresh").off("click.pbPythonUI").on("click.pbPythonUI", UI.status);
    $("#btnPythonStart").off("click.pbPythonUI").on("click.pbPythonUI", UI.start);
    $("#btnPythonStop").off("click.pbPythonUI").on("click.pbPythonUI", UI.stop);
    $("#btnPythonRestart").off("click.pbPythonUI").on("click.pbPythonUI", UI.restart);

    UI.$elPort()
      .off("change.pbPythonUI")
      .on("change.pbPythonUI", () => setTimeout(UI.status, 150));

    PB.initGreenwallReferenceProfileUI();
    PB.initSystemServiceToggleUI();

    // optional: Polling
    // setInterval(UI.status, 2500);

    UI.status();
  };

  $(UI.bind);

})(jQuery);