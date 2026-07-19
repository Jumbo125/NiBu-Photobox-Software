// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * pb_bridge_services.js
 * ---------------------------------------------------------------------------
 * Orchestrator zwischen:
 *  - Python Tool-Server (PB.pythonSvc)
 *  - CameraBridge API-Server (Kestrel, PB.bridge)
 *
 * Aufgaben:
 *  - ensureBridgeRunning(): prüft Kestrel -> sonst starte über Python /service/start
 *  - restartBridge(), stopBridge()
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

  PB.bridgeServices = PB.bridgeServices || {};
  const S = PB.bridgeServices;

  const sleep = (ms) =>
    typeof PB.sleep === "function" ? PB.sleep(ms) : new Promise((r) => setTimeout(r, ms));

  function maybeShowMsg(msg, type) {
    if (typeof PB.showMsg === "function" && msg) PB.showMsg(String(msg), type || "info");
  }

  // -------------------------------------------------------------
  // Config helpers
  // -------------------------------------------------------------
  S.getBridgeExePath = function () {
    const cfg = PB._getDeep(window.PB_CONFIG, "cameraBridgeServer.Server") || {};
    return String(cfg.ExePath || "").trim();
  };

  S.getPythonServiceApiKey = function () {
    const cfg = PB._getDeep(window.PB_CONFIG, "pythonServer") || {};
    return String(cfg.AuthKey || "").trim();
  };

  // -------------------------------------------------------------
  // wait helper
  // -------------------------------------------------------------
  S.waitFor = async function (fn, timeoutMs, stepMs) {
    const deadline = Date.now() + (Number(timeoutMs) || 15000);
    const step = Math.max(150, Number(stepMs) || 350);
    while (Date.now() < deadline) {
      try {
        if (await fn()) return true;
      } catch (_) {}
      await sleep(step);
    }
    return false;
  };

  // -------------------------------------------------------------
  // ensure Python running
  // -------------------------------------------------------------
  S.ensurePythonReady = async function (opts = {}) {
    const maxWaitMs = Number(opts.maxWaitMs || 15000);

    if (!PB.pythonSvc) {
      throw new Error(
        t("bridge.services.err.missing_pythonSvc", "PB.pythonSvc is missing")
      );
    }

    if (await PB.pythonSvc.ping()) return true;

    maybeShowMsg(
      t(
        "bridge.services.msg.python_unreachable_starting",
        "Python server not reachable – starting it now…"
      ),
      "warning"
    );

    try {
      await PB.pythonSvc.ensureReady();
    } catch (e) {
      console.warn(e);
    }

    const ok = await S.waitFor(() => PB.pythonSvc.ping(), maxWaitMs, 300);
    if (ok) maybeShowMsg(t("bridge.services.msg.python_running", "Python server is running ✅"));
    return ok;
  };

  // -------------------------------------------------------------
  // High-level orchestrations
  // -------------------------------------------------------------
S.ensureBridgeRunning = async function (opts = {}) {
  const maxWaitMs = Number(opts.maxWaitMs || 15000);
  const maxWaitSec = Math.max(1, Math.round(maxWaitMs / 1000));

  async function readBridgeStatus() {
    // Bevorzugt eigene Status-Funktion, falls vorhanden
    if (PB.bridge && typeof PB.bridge.status === "function") {
      try {
        return await PB.bridge.status();
      } catch (_) {
        return null;
      }
    }

    // Fallback: direkte Status-URL
    try {
      const baseUrl =
        PB.bridge?.baseUrl ||
        PB.bridge?.url ||
        window.PB_CONFIG?.cameraBridgeServer?.Url ||
        window.PB_CONFIG?.cameraBridgeServer?.url ||
        (typeof PB.bridgeBaseUrl === 'function' ? PB.bridgeBaseUrl() : "http://127.0.0.1:8052");

      const res = await fetch(String(baseUrl).replace(/\/+$/, "") + "/api/status", {
        method: "GET",
        cache: "no-store"
      });

      if (!res.ok) return null;
      return await res.json();
    } catch (_) {
      return null;
    }
  }

  // 1) Exakten Status prüfen: API erreichbar ist nicht dasselbe wie Worker erreichbar
  const bridgeStatus = await readBridgeStatus();

  if (bridgeStatus && bridgeStatus.httpRunning === true) {
    if (bridgeStatus.workerReachable === false) {
      maybeShowMsg(
        t(
          "bridge.services.msg.bridge_worker_unreachable",
          "CameraBridge API is running, but the worker is not responding: {error}",
          {
            error: bridgeStatus.workerLastError || "unknown error"
          }
        ),
        "warning"
      );

      // Wichtig:
      // Die API läuft bereits. Daher NICHT die EXE neu starten.
      return true;
    }

    maybeShowMsg(
      t(
        "bridge.services.msg.bridge_already_running",
        "CameraBridge is already running ✅"
      )
    );

    return true;
  }

  // 2) Fallback für alte PB.bridge.ping()-Logik
  // Nur verwenden, wenn /api/status nicht erreichbar/lesbar war.
  if (!bridgeStatus && await PB.bridge.ping()) {
    maybeShowMsg(
      t(
        "bridge.services.msg.bridge_already_running",
        "CameraBridge is already running ✅"
      )
    );

    return true;
  }

  // 3) Erst jetzt wirklich starten, weil die API nicht erreichbar ist
  maybeShowMsg(
    t(
      "bridge.services.msg.bridge_unreachable_starting",
      "CameraBridge API not reachable – starting via Python tool server…"
    )
  );

  const pyKey = S.getPythonServiceApiKey();
  if (!pyKey) {
    maybeShowMsg(
      t(
        "bridge.services.msg.abort_missing_api_key",
        "Aborted: Python api_key missing (pythonServer.AuthKey)."
      ),
      "warning"
    );
    return false;
  }

  const pyOk = await S.ensurePythonReady({ maxWaitMs });
  if (!pyOk) {
    maybeShowMsg(
      t(
        "bridge.services.msg.abort_python_not_started",
        "Aborted: CameraBridge is down and Python server could not be started."
      ),
      "warning"
    );
    return false;
  }

  const exePath = S.getBridgeExePath();
  if (!exePath) {
    maybeShowMsg(
      t(
        "bridge.services.msg.abort_missing_exe_path",
        "Aborted: EXE path missing (cameraBridgeServer.Server.ExePath)."
      ),
      "warning"
    );
    return false;
  }

  maybeShowMsg(
    t(
      "bridge.services.msg.bridge_starting",
      "Starting CameraBridge API server…"
    )
  );

  const res = await PB.pythonSvc.callWithRestart(async () => {
    return await PB.pythonSvc.fetch("/service/start", {
      method: "POST",
      timeoutMs: 15000,
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": pyKey
      },
      body: JSON.stringify({
        exe: exePath,
        api_key: pyKey
      })
    });
  });

  // 4) Nach Start wieder Status prüfen, nicht nur ping()
  const up = await PB.bridge.waitOnline({ timeoutMs: maxWaitMs });
  if (!up) {
    maybeShowMsg(
      t(
        "bridge.services.msg.abort_bridge_timeout",
        "Aborted: CameraBridge API could not be started (no status response within {sec}s).",
        { sec: maxWaitSec }
      ),
      "warning"
    );
    return false;
  }

  const finalStatus = await readBridgeStatus();

  if (finalStatus && finalStatus.httpRunning === true && finalStatus.workerReachable === false) {
    maybeShowMsg(
      t(
        "bridge.services.msg.bridge_worker_unreachable_after_start",
        "CameraBridge API is running, but the worker is still not responding: {error}",
        {
          error: finalStatus.workerLastError || "unknown error"
        }
      ),
      "warning"
    );

    return {
      ok: true,
      serviceResponse: res,
      bridgeStatus: finalStatus,
      workerReachable: false
    };
  }

  maybeShowMsg(
    t(
      "bridge.services.msg.bridge_running",
      "CameraBridge is running ✅"
    )
  );

  return {
    ok: true,
    serviceResponse: res,
    bridgeStatus: finalStatus || null
  };
};

  S.restartBridge = async function (opts = {}) {
    const maxWaitMs = Number(opts.maxWaitMs || 15000);
    const maxWaitSec = Math.max(1, Math.round(maxWaitMs / 1000));

    const pyKey = S.getPythonServiceApiKey();
    const exePath = S.getBridgeExePath();

    const pyOk = await S.ensurePythonReady({ maxWaitMs });
    if (!pyOk) return false;

    maybeShowMsg(t("bridge.services.msg.bridge_restarting", "Restarting CameraBridge…"));

    const res = await PB.pythonSvc.callWithRestart(async () => {
      return await PB.pythonSvc.fetch("/service/restart", {
        method: "POST",
        timeoutMs: 15000,
        headers: { "Content-Type": "application/json", "X-Api-Key": pyKey },
        body: JSON.stringify({ exe: exePath, api_key: pyKey })
      });
    });

    const upNow = await PB.bridge.waitOnline({ timeoutMs: maxWaitMs });
    maybeShowMsg(
      upNow
        ? t("bridge.services.msg.bridge_running", "CameraBridge is running ✅")
        : t(
            "bridge.services.msg.restart_timeout",
            "Restart requested (no ping within {sec}s).",
            { sec: maxWaitSec }
          ),
      upNow ? "info" : "warning"
    );

    return { ok: !!upNow, serviceResponse: res };
  };

  S.stopBridge = async function (opts = {}) {
    const maxWaitMs = Number(opts.maxWaitMs || 15000);

    const pyKey = S.getPythonServiceApiKey();
    const exePath = S.getBridgeExePath();

    const pyOk = await S.ensurePythonReady({ maxWaitMs });
    if (!pyOk) return false;

    maybeShowMsg(t("bridge.services.msg.bridge_stopping", "Stopping CameraBridge…"));

    const res = await PB.pythonSvc.callWithRestart(async () => {
      return await PB.pythonSvc.fetch("/service/stop", {
        method: "POST",
        timeoutMs: 15000,
        headers: { "Content-Type": "application/json", "X-Api-Key": pyKey },
        body: JSON.stringify({ exe: exePath, api_key: pyKey })
      });
    });

    const down = await S.waitFor(async () => !(await PB.bridge.ping()), maxWaitMs, 400);
    maybeShowMsg(
      down
        ? t("bridge.services.msg.bridge_stopped", "CameraBridge stopped ✅")
        : t(
            "bridge.services.msg.stop_timeout",
            "Stop requested (server is still responding)."
          ),
      down ? "info" : "warning"
    );

    return { ok: !!down, serviceResponse: res };
  };
})(jQuery);
