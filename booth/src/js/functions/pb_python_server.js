// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * pb_python_server.js
 * ---------------------------------------------------------------------------
 * Verwaltet Verbindung zum lokalen Python-Tool-Server (python_server.py)
 *
 * Features:
 *  - ping(): prüft, ob Server erreichbar ist
 *  - startViaPhp(): startet Server via PHP (Fallback)
 *  - ensureReady(): ping -> ggf. Start via PHP -> waitReady
 *  - fetch(): JSON-Fetch gegen Python-Endpunkte
 *  - callWithRestart(): führt Funktion aus, bei Fehler Restart+Retry
 *  - pick(): startet file/folder picker GUI über Python
 *
 * Erwartete Python-Endpunkte:
 *  - GET  /ping
 *  - GET  /pick?mode=file|folder...
 *  - POST /service/start|stop|restart
 */
(function () {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  // i18n (pbT fallback) + einfache {var}-Interpolation
  const pbT = PB.pbT || window.pbT || PB.t || function (k, fb) { return fb || k; };
  const pbFmt = (str, vars) => {
    if (!str || !vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (m, p) => (vars[p] == null ? m : String(vars[p])));
  };
  const pbTf = (key, fallback, vars) => pbFmt(pbT(key, fallback), vars);

  // -------------------------------------------------------------------------
  // Helper
  // -------------------------------------------------------------------------
  PB._getDeep = PB._getDeep || function (obj, path, defVal) {
    try {
      return String(path)
        .split(".")
        .reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj) ?? defVal;
    } catch (_) {
      return defVal;
    }
  };

  PB.sleep = PB.sleep || ((ms) => new Promise((res) => setTimeout(res, ms)));

  // -------------------------------------------------------------------------
  // Python Service API (PB.pythonSvc)
  // -------------------------------------------------------------------------
  PB.pythonSvc = PB.pythonSvc || {};
  const SVC = PB.pythonSvc;

  SVC.baseUrl = (port = SVC.port) => `http://127.0.0.1:${Number(port) || 8053}`;
  SVC.getStartEndpoint = () => "/api/python_server_restart.php";

  // -------------------------------------------------------------------------
  // Ping & Wait (Status-Tracking: Meldung nur bei Statusänderung)
  // -------------------------------------------------------------------------
  let lastPingState = null;

  SVC.ping = async function (port = SVC.port) {
    const ui = window.PB?.pythonUi;

    try {
      const url = SVC.baseUrl(port);
      const r = await fetch(url + "/ping", { cache: "no-store" });
      const ok = r.ok;

      if (lastPingState !== ok) {
        if (ok) {
          ui?.setMsg?.(
            pbTf("python_svc.ui.reachable", "✅ Python service reachable @ {url}", { url }),
            false
          );
        } else {
          ui?.setMsg?.(
            pbTf("python_svc.ui.not_reachable", "⚠️ Python service not reachable @ {url}", { url }),
            true
          );
        }
        lastPingState = ok;
      }

      return ok;
    } catch (_) {
      if (lastPingState !== false) {
        const url = SVC.baseUrl(port);
        ui?.setMsg?.(
          pbTf("python_svc.ui.connect_failed", "⚠️ Connection to Python service failed ({url}).", { url }),
          true
        );
        lastPingState = false;
      }
      return false;
    }
  };

  SVC.waitReady = async function (port = SVC.port, maxMs = 15000, step = 250) {
    const deadline = Date.now() + maxMs;
    while (Date.now() < deadline) {
      if (await SVC.ping(port)) return true;
      await PB.sleep(step);
    }
    return false;
  };

  // -------------------------------------------------------------------------
  // Start via PHP Endpoint
  // -------------------------------------------------------------------------
  SVC.startViaPhp = async function (opts = {}) {
    const cfgNow = window.PB_CONFIG || {};
    const pythonPort = PB._getDeep(cfgNow, "pythonServer", {}) || {};
    const pythonNow = PB._getDeep(cfgNow, "general.python", {}) || {};
    const appsNow = PB._getDeep(cfgNow, "general.app", {}) || {};

    const port = Number(opts.port ?? pythonPort.Port ?? 8053) || 8053;

    const exe = String(pythonNow.Path || "").trim();
    const script = String(appsNow.python_server || "").trim();

    if (!script) {
      console.error(
        pbT(
          "python_svc.err.missing_script_path",
          "[pythonSvc] Missing python_server.py path (general.app.python_server)."
        )
      );
      return false;
    }

    const qs = new URLSearchParams({ port });
    if (exe) qs.set("exe", exe);
    if (script) qs.set("script", script);

    const url = SVC.getStartEndpoint() + "?" + qs.toString();
    try {
      const r = await fetch(url, { method: "POST", cache: "no-store" });
      return r.ok;
    } catch (e) {
      console.warn(pbT("python_svc.warn.start_via_php_failed", "[pythonSvc] startViaPhp failed:"), e);
      return false;
    }
  };

  // -------------------------------------------------------------------------
  // ensureReady(): ping -> ggf. start -> wait
  // -------------------------------------------------------------------------
  SVC.ensureReady = async function (opts = {}) {
    const port = Number(opts.port) || 8053;

    if (await SVC.ping(port)) return true;
    await SVC.startViaPhp(opts);

    const ok = await SVC.waitReady(port, opts.maxWaitMs || 15000);
    if (!ok) throw new Error(pbT("python_svc.err.not_reachable", "Python service not reachable"));
    return true;
  };

  // -------------------------------------------------------------------------
  // JSON fetch helper
  // -------------------------------------------------------------------------
  SVC.fetch = async function (path, opts = {}) {
    const port = Number(opts.port ?? SVC.port) || 8053;
    const url = SVC.baseUrl(port) + String(path || "");
    const timeoutMs = Number(opts.timeoutMs || 8000);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const r = await fetch(url, {
        method: opts.method || "GET",
        headers: opts.headers || {},
        body: opts.body,
        cache: "no-store",
        signal: ctrl.signal
      });

      const text = await r.text();
      let json = null;
      try { json = text ? JSON.parse(text) : null; } catch (_) {}

      if (!r.ok) {
        const msg = json?.error || json?.message || text || `HTTP ${r.status}`;
        throw new Error(msg);
      }

      return json;
    } finally {
      clearTimeout(timer);
    }
  };

  // -------------------------------------------------------------------------
  // callWithRestart(): ensure -> run -> restart + retry once
  // -------------------------------------------------------------------------
  SVC.callWithRestart = async function (fn, opts = {}) {
    const port = Number(opts.port ?? SVC.port) || 8053;

    const ok = await SVC.ensureReady(opts);
    if (!ok) throw new Error(pbT("python_svc.err.not_reachable", "Python service not reachable"));

    try {
      return await fn();
    } catch (e) {
      console.warn(
        pbT(
          "python_svc.warn.call_restart_first_failed",
          "[pythonSvc] callWithRestart: first call failed, restarting…"
        )
      );
      await SVC.startViaPhp(opts);
      const ready = await SVC.waitReady(port, 10000);
      if (!ready) throw e;
      return await fn();
    }
  };

  // -------------------------------------------------------------------------
  // Picker convenience
  // -------------------------------------------------------------------------
  SVC.pick = async function ({ mode = "file", title = "", initial = "", filter = "" } = {}) {
    const qs = new URLSearchParams({ mode, title, path: initial, filter });
    const path = "/pick?" + qs.toString();

    return await SVC.callWithRestart(async () => {
      const json = await SVC.fetch(path, { timeoutMs: 600000 });
      return json && json.ok ? String(json.path || "") : "";
    });
  };
})();
