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

    // Erst ping
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

    // Dann /runtime für Details
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
  // Wire buttons + initial refresh
  // ------------------------------------------------------------
  UI.bind = () => {
    $("#btnPythonRefresh").off("click.pbPythonUI").on("click.pbPythonUI", UI.status);
    $("#btnPythonStart").off("click.pbPythonUI").on("click.pbPythonUI", UI.start);
    $("#btnPythonStop").off("click.pbPythonUI").on("click.pbPythonUI", UI.stop);
    $("#btnPythonRestart").off("click.pbPythonUI").on("click.pbPythonUI", UI.restart);

    UI.$elPort().off("change.pbPythonUI").on("change.pbPythonUI", () => setTimeout(UI.status, 150));

    // optional: Polling
    // setInterval(UI.status, 2500);

    UI.status();
  };

  $(UI.bind);
})(jQuery);
