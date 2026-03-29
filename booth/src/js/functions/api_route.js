// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

(function () {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  PB.API_BASE = PB.API_BASE || 'api/';
  PB.API_FALLBACK_OS = PB.API_FALLBACK_OS || 'windows';

  // ------------------------------------------------------------
  // i18n helper (pbT fallback + simple {var} formatter)
  // ------------------------------------------------------------
  function tr(key, fallback) {
    try {
      return (typeof pbT === 'function') ? pbT(key, fallback) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function fmt(str, vars) {
    if (!str || !vars) return str;
    return String(str).replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
  }

  function trf(key, fallback, vars) {
    return fmt(tr(key, fallback), vars);
  }

  // ------------------------------------------------------------
  // Config helpers (PB_CONFIG / PB_Config)
  // ------------------------------------------------------------
  PB._cfgRoot = PB._cfgRoot || function () {
    return window.PB_CONFIG || window.PB_Config || {};
  };

  PB._getIntCfg = PB._getIntCfg || function (path, fallback) {
    try {
      const v = PB._getDeep(PB._cfgRoot(), path);
      const n = parseInt(v, 10);
      return Number.isFinite(n) && n > 0 ? n : fallback;
    } catch (_) {
      return fallback;
    }
  };

  PB.getApiHost = PB.getApiHost || function () {
    const h = String(PB._getDeep(PB._cfgRoot(), 'general.system.host') || '').trim();
    return (h || window.location.hostname || '127.0.0.1');
  };

  PB.getBridgePort = PB.getBridgePort || function () {
    const p1 = PB._getIntCfg('cameraBridgeServer.Bridge.Port', 0);
    if (p1) return p1;

    const p2 = PB._getIntCfg('cameraBridgeServer.bridge.port', 0);
    if (p2) return p2;

    return 8052;
  };

  PB.getPhpPort = PB.getPhpPort || function () {
    return PB._getIntCfg('general.web.port', 8050);
  };

  PB.bridgeBaseUrl = PB.bridgeBaseUrl || function () {
    return `http://${PB.getApiHost()}:${PB.getBridgePort()}`;
  };

  PB.phpBaseUrl = PB.phpBaseUrl || function () {
    const base = String(PB.API_BASE || 'api/').replace(/^\/+/, '');
    const base2 = base.endsWith('/') ? base : (base + '/');
    return `http://${PB.getApiHost()}:${PB.getPhpPort()}/${base2}`;
  };

  // ------------------------------------------------------------
  // OS detection
  // ------------------------------------------------------------
  PB.getCurrentOS = PB.getCurrentOS || function () {
    try {
      const os = String(PB._getDeep(window.PB_CONFIG, 'general.system.os') || '').toLowerCase();
      if (['windows', 'linux', 'mac'].includes(os)) return os;
    } catch (_) {}
    return PB.API_FALLBACK_OS;
  };

  // ------------------------------------------------------------
  // API ROUTES (merge) — ergänzt fehlende Keys, überschreibt nichts
  // ------------------------------------------------------------
  PB.API_ROUTES = PB.API_ROUTES || {};
  const DEFAULT_API_ROUTES = {
    // Python-Service / OS-Bridge
    python_server_restart: { windows: 'python_server_restart.php', linux: 'python_server_restart.php', mac: 'python_server_restart.php' },
    select_folder:         { windows: 'python_server_restart.php', linux: 'python_server_restart.php', mac: 'python_server_restart.php' },

    // Bridge process control (PHP)
    bridge_API_SERVER_start: { windows: 'camerabridge_API_SERVER_start.php', linux: 'camerabridge_API_SERVER_start.php', mac: 'camerabridge_API_SERVER_start.php' },
    bridge_API_SERVER_stop:  { windows: 'camerabridge_API_SERVER_stop.php',  linux: 'camerabridge_API_SERVER_stop.php',  mac: 'camerabridge_API_SERVER_stop.php' },

    // Bridge API (8052)
    bridge_status:         { windows: 'api/status',         linux: 'api/status',         mac: 'api/status' },
    bridge_ping:           { windows: 'api/ping',           linux: 'api/ping',           mac: 'api/ping' },
    bridge_shutdown:       { windows: 'api/shutdown',       linux: 'api/shutdown',       mac: 'api/shutdown' },

    bridge_liveview_start: { windows: 'api/liveview/start', linux: 'api/liveview/start', mac: 'api/liveview/start' },
    bridge_liveview_stop:  { windows: 'api/liveview/stop',  linux: 'api/liveview/stop',  mac: 'api/liveview/stop' },
    bridge_liveview_fps:   { windows: 'api/liveview/fps',   linux: 'api/liveview/fps',   mac: 'api/liveview/fps' },

    bridge_capture_start:  { windows: 'api/capture/start',  linux: 'api/capture/start',  mac: 'api/capture/start' },
    bridge_capture_status: { windows: 'api/capture/status', linux: 'api/capture/status', mac: 'api/capture/status' },
    bridge_capture_abort:  { windows: 'api/capture/abort',  linux: 'api/capture/abort',  mac: 'api/capture/abort' },

    bridge_config:         { windows: 'api/config',         linux: 'api/config',         mac: 'api/config' },
    bridge_info:           { windows: 'api/info',           linux: 'api/info',           mac: 'api/info' },
    bridge_devices:        { windows: 'api/devices',        linux: 'api/devices',        mac: 'api/devices' }
  };

  for (const key in DEFAULT_API_ROUTES) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_API_ROUTES, key)) continue;
    if (PB.API_ROUTES[key] == null) PB.API_ROUTES[key] = DEFAULT_API_ROUTES[key];
  }

  /**
   * PB.apiUrl(key, [opts])
   * - Pfade mit "api/" → Bridge-Server (8052)
   * - alles andere → PHP/Webserver (8050 + API_BASE)
   * opts: { cacheBust:true, qs:{...} }
   */
  PB.apiUrl = PB.apiUrl || function (key, opts) {
    opts = opts || {};
    const os = PB.getCurrentOS();
    const entry = PB.API_ROUTES[key];

    if (!entry) {
      throw new Error(trf('api_url.err.unknown_route_key', 'Unknown API route key: {key}', { key: String(key) }));
    }

    const path = (typeof entry === 'string') ? entry : (entry[os] || entry.windows || '');
    if (!path) {
      throw new Error(trf('api_url.err.missing_path_for_key', 'Missing path for route key: {key}', { key: String(key) }));
    }

    const basePhp = PB.phpBaseUrl();              // z.B. http://host:8050/api/
    const baseApi = PB.bridgeBaseUrl() + '/';     // z.B. http://host:8052/

    const useApi = /^api\//i.test(path);
    const base = useApi ? baseApi : basePhp;

    const qs = Object.assign({}, opts.qs || {});
    if (opts.cacheBust) qs._ = Date.now();

    const query = Object.keys(qs).length ? ('?' + new URLSearchParams(qs).toString()) : '';
    return base + path.replace(/^\/+/, '') + query;
  };

})();
