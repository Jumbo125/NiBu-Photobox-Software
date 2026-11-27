// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * pb_python_server.js
 * ---------------------------------------------------------------------------
 * Verwaltet Verbindung zum lokalen Python-Tool-Server (python_server.py)
 *
 * Robustere Version:
 *  - ping(): prüft, ob Server erreichbar ist
 *  - startViaWatchdog(): startet/restartet Server über den separaten
 *    watchdog_server.py Begleitprozess (siehe booth/tools/python_portable/
 *    watchdog_server.py). Port wird dynamisch über /runtime erfragt, nicht
 *    hartkodiert, da Ports zentral in server_config.json gepflegt werden.
 *  - ensureReady(): ping -> ggf. Start via Watchdog -> waitReady
 *  - fetch(): JSON-Fetch gegen Python-Endpunkte
 *  - callWithRestart(): Restart nur bei echten Transport-/Serverfehlern
 *  - parallele Restarts/ensureReady-Aufrufe werden gebündelt
 */

(function () {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  const pbT =
    PB.pbT ||
    window.pbT ||
    PB.t ||
    function (k, fb) {
      return fb || k;
    };

  const pbFmt = (str, vars) => {
    if (!str || !vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (m, p) =>
      vars[p] == null ? m : String(vars[p]),
    );
  };

  const pbTf = (key, fallback, vars) => pbFmt(pbT(key, fallback), vars);

  PB._getDeep =
    PB._getDeep ||
    function (obj, path, defVal) {
      try {
        return (
          String(path)
            .split(".")
            .reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), obj) ??
          defVal
        );
      } catch (_) {
        return defVal;
      }
    };

  PB.sleep = PB.sleep || ((ms) => new Promise((res) => setTimeout(res, ms)));

  PB.pythonSvc = PB.pythonSvc || {};
  const SVC = PB.pythonSvc;

  SVC.port = SVC.port || 8053;
  SVC.baseUrl = (port = SVC.port) => `http://127.0.0.1:${Number(port) || 8053}`;

  // Watchdog-Port NICHT hartkodiert -- kommt dynamisch aus /runtime am
  // Haupt-Server (der ihn wiederum aus server_config.json liest, Key
  // "WatchdogPort"). Einmal pro Seitenaufruf aufgelöst und gecacht.
  let _watchdogPortPromise = null;
  SVC.getWatchdogPort = function (mainPort = SVC.port) {
    if (_watchdogPortPromise) return _watchdogPortPromise;

    _watchdogPortPromise = (async () => {
      try {
        const r = await fetch(SVC.baseUrl(mainPort) + "/runtime", { cache: "no-store" });
        if (r.ok) {
          const j = await r.json();
          const p = Number(j?.watchdog_port);
          if (p > 0) return p;
        }
      } catch (_) {
        // fällt auf Default zurück
      }
      return 8054;
    })();

    return _watchdogPortPromise;
  };
  SVC.watchdogBaseUrl = async (mainPort = SVC.port) =>
    `http://127.0.0.1:${await SVC.getWatchdogPort(mainPort)}`;

  let lastPingState = null;
  let ensureReadyPromise = null;
  let restartPromise = null;
  let lastRestartTs = 0;

  SVC.restartCooldownMs = 2500;
  SVC.defaultPingTimeoutMs = 2500;
  SVC.defaultWaitReadyMs = 25000;
  SVC.defaultWaitStepMs = 350;
  SVC.defaultStablePingCount = 2;

  function nowMs() {
    return Date.now();
  }

  function buildHttpError(r, json, text) {
    const msg = json?.error || json?.message || text || `HTTP ${r.status}`;
    const err = new Error(msg);
    err.name = "HttpError";
    err.isHttpError = true;
    err.httpStatus = Number(r.status || 0);
    err.responseJson = json;
    err.responseText = text;
    err.isRetryable =
      r.status === 408 ||
      r.status === 425 ||
      r.status === 429 ||
      r.status === 500 ||
      r.status === 502 ||
      r.status === 503 ||
      r.status === 504;
    return err;
  }

  function isLikelyNetworkError(err) {
    const msg = String(err?.message || "");
    return (
      err?.name === "AbortError" ||
      /failed to fetch/i.test(msg) ||
      /network/i.test(msg) ||
      /load failed/i.test(msg) ||
      /fetch failed/i.test(msg) ||
      /connection/i.test(msg) ||
      /timeout/i.test(msg)
    );
  }

  SVC.isRetryableError = function (err) {
    if (!err) return false;
    if (err?.isHttpError) return !!err.isRetryable;
    return isLikelyNetworkError(err);
  };

  SVC.ping = async function (port = SVC.port, timeoutMs = SVC.defaultPingTimeoutMs) {
    const ui = window.PB?.pythonUi;
    const url = SVC.baseUrl(port);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), Number(timeoutMs) || 2500);

    try {
      const r = await fetch(url + "/ping", {
        cache: "no-store",
        signal: ctrl.signal,
      });

      const ok = !!r.ok;

      if (lastPingState !== ok) {
        if (ok) {
          ui?.setMsg?.(
            pbTf("python_svc.ui.reachable", "✅ Python service reachable @ {url}", {
              url,
            }),
            false,
          );
        } else {
          ui?.setMsg?.(
            pbTf(
              "python_svc.ui.not_reachable",
              "⚠️ Python service not reachable @ {url}",
              { url },
            ),
            true,
          );
        }
        lastPingState = ok;
      }

      return ok;
    } catch (_) {
      if (lastPingState !== false) {
        ui?.setMsg?.(
          pbTf(
            "python_svc.ui.connect_failed",
            "⚠️ Connection to Python service failed ({url}).",
            { url },
          ),
          true,
        );
        lastPingState = false;
      }
      return false;
    } finally {
      clearTimeout(timer);
    }
  };

  SVC.waitReady = async function (
    port = SVC.port,
    maxMs = SVC.defaultWaitReadyMs,
    step = SVC.defaultWaitStepMs,
    stableCount = SVC.defaultStablePingCount,
  ) {
    const deadline = nowMs() + (Number(maxMs) || 25000);
    let consecutiveOk = 0;

    while (nowMs() < deadline) {
      const ok = await SVC.ping(port);

      if (ok) {
        consecutiveOk += 1;
        if (consecutiveOk >= Math.max(1, Number(stableCount) || 1)) {
          return true;
        }
      } else {
        consecutiveOk = 0;
      }

      await PB.sleep(Number(step) || 350);
    }

    return false;
  };

  /**
   * Startet/stellt sicher, dass der Haupt-Server läuft -- über den separaten
   * watchdog_server.py Begleitprozess (siehe booth/tools/python_portable/
   * watchdog_server.py). Der Watchdog läuft unabhängig vom Haupt-Server und
   * übersteht dessen Abstürze; er ist der einzige Weg, einen komplett toten
   * Haupt-Server aus dem Browser heraus wiederzubeleben (ohne PHP, OS-unabhängig).
   *
   * AuthKey ist derselbe wie für den Haupt-Server (window.PB_CONFIG.pythonServer.AuthKey),
   * server_config.json ist für beide Prozesse die gemeinsame Quelle.
   */
  SVC.startViaWatchdog = async function (opts = {}) {
    const cfgNow = window.PB_CONFIG || {};
    const pythonPort = PB._getDeep(cfgNow, "pythonServer", {}) || {};
    const port = Number(opts.port ?? pythonPort.Port ?? SVC.port ?? 8053) || 8053;
    const apiKey = String(opts.apiKey ?? pythonPort.AuthKey ?? "").trim();

    try {
      const watchdogUrl = await SVC.watchdogBaseUrl(port);
      const r = await fetch(watchdogUrl + "/start", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: apiKey }),
      });
      return r.ok;
    } catch (e) {
      console.warn(
        pbT(
          "python_svc.warn.start_via_watchdog_failed",
          "[pythonSvc] startViaWatchdog failed (watchdog_server.py nicht erreichbar?):",
        ),
        e,
      );
      return false;
    }
  };

  SVC.restartOnce = async function (opts = {}) {
    if (restartPromise) return restartPromise;

    restartPromise = (async () => {
      const port = Number(opts.port ?? SVC.port) || 8053;
      const sinceLast = nowMs() - lastRestartTs;

      if (sinceLast < SVC.restartCooldownMs) {
        await PB.sleep(SVC.restartCooldownMs - sinceLast);
      }

      lastRestartTs = nowMs();

      console.warn(
        pbT(
          "python_svc.warn.restart_begin",
          "[pythonSvc] restarting Python service…",
        ),
      );

      const started = await SVC.startViaWatchdog(opts);
      if (!started) {
        throw new Error(
          pbT(
            "python_svc.err.restart_start_failed",
            "Python restart endpoint could not be called.",
          ),
        );
      }

      const ready = await SVC.waitReady(
        port,
        Number(opts.maxWaitMs || SVC.defaultWaitReadyMs),
        Number(opts.waitStepMs || SVC.defaultWaitStepMs),
        Number(opts.stablePingCount || SVC.defaultStablePingCount),
      );

      if (!ready) {
        throw new Error(
          pbT(
            "python_svc.err.restart_not_ready",
            "Python service did not become ready after restart.",
          ),
        );
      }

      return true;
    })();

    try {
      return await restartPromise;
    } finally {
      restartPromise = null;
    }
  };

  SVC.ensureReady = async function (opts = {}) {
    if (ensureReadyPromise) return ensureReadyPromise;

    ensureReadyPromise = (async () => {
      const port = Number(opts.port ?? SVC.port) || 8053;

      if (await SVC.ping(port)) return true;

      await SVC.restartOnce({
        ...opts,
        port,
      });

      const ok = await SVC.waitReady(
        port,
        Number(opts.maxWaitMs || SVC.defaultWaitReadyMs),
        Number(opts.waitStepMs || SVC.defaultWaitStepMs),
        Number(opts.stablePingCount || SVC.defaultStablePingCount),
      );

      if (!ok) {
        throw new Error(
          pbT("python_svc.err.not_reachable", "Python service not reachable"),
        );
      }

      return true;
    })();

    try {
      return await ensureReadyPromise;
    } finally {
      ensureReadyPromise = null;
    }
  };

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
        signal: ctrl.signal,
      });

      const text = await r.text();
      let json = null;

      try {
        json = text ? JSON.parse(text) : null;
      } catch (_) {}

      if (!r.ok) {
        throw buildHttpError(r, json, text);
      }

      return json;
    } finally {
      clearTimeout(timer);
    }
  };

  SVC.callWithRestart = async function (fn, opts = {}) {
    const port = Number(opts.port ?? SVC.port) || 8053;

    await SVC.ensureReady({ ...opts, port });

    try {
      return await fn();
    } catch (e) {
      const retryable = SVC.isRetryableError(e);
      const serverAlive = await SVC.ping(port).catch(() => false);

      if (!retryable && serverAlive) {
        throw e;
      }

      console.warn(
        pbT(
          "python_svc.warn.call_restart_first_failed",
          "[pythonSvc] first call failed, restarting once…",
        ),
        e,
      );

      await SVC.restartOnce({
        ...opts,
        port,
      });

      return await fn();
    }
  };

  SVC.pick = async function ({
    mode = "file",
    title = "",
    initial = "",
    filter = "",
  } = {}) {
    const qs = new URLSearchParams({
      mode,
      title,
      path: initial,
      filter,
    });

    const path = "/pick?" + qs.toString();

    return await SVC.callWithRestart(async () => {
      const json = await SVC.fetch(path, { timeoutMs: 600000 });
      return json && json.ok ? String(json.path || "") : "";
    });
  };
})();
