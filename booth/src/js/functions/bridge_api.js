// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ===========================================================
 * bridge_api.js — Gemeinsamer JSON-Client über PB.API_ROUTES + PB.apiUrl()
 *  Bridge-API:  http://<host>:<httpPort>/api/...
 *  PHP:         http://<host>:<phpPort>/api/...  (fallback)
 *
 *  Public (wenn Bridge.AuthKey gesetzt):
 *    GET /, GET /api/status, GET {MjpegPath}, GET /favicon.ico, OPTIONS *
 *
 *  Auth (für alle anderen):
 *    X-Api-Key: <key>   oder   Authorization: Bearer <key>
 * =========================================================== */
(function () {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  // -----------------------------------------------------------
  // i18n helper (pbT fallback + simple {var} formatter)
  // -----------------------------------------------------------
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

  // -----------------------------------------------------------
  // Routes (Defaults)
  // -----------------------------------------------------------
  PB.API_ROUTES = PB.API_ROUTES || {};

  PB.API_ROUTES.bridge_refresh        = PB.API_ROUTES.bridge_refresh        || 'api/refresh';
  PB.API_ROUTES.bridge_cameras        = PB.API_ROUTES.bridge_cameras        || 'api/cameras';
  PB.API_ROUTES.bridge_select         = PB.API_ROUTES.bridge_select         || 'api/select';
  PB.API_ROUTES.bridge_capture        = PB.API_ROUTES.bridge_capture        || 'api/capture';
  PB.API_ROUTES.bridge_photo_count    = PB.API_ROUTES.bridge_photo_count    || 'api/photo-count';
  PB.API_ROUTES.bridge_status         = PB.API_ROUTES.bridge_status         || 'api/status';
  PB.API_ROUTES.bridge_watchdog       = PB.API_ROUTES.bridge_watchdog       || 'api/watchdog';

  // LiveView + Settings
  PB.API_ROUTES.bridge_liveview_start = PB.API_ROUTES.bridge_liveview_start || 'api/liveview/start';
  PB.API_ROUTES.bridge_liveview_stop  = PB.API_ROUTES.bridge_liveview_stop  || 'api/liveview/stop';
  PB.API_ROUTES.bridge_liveview_fps   = PB.API_ROUTES.bridge_liveview_fps   || 'api/liveview/fps';
  PB.API_ROUTES.bridge_settings       = PB.API_ROUTES.bridge_settings       || 'api/settings';

  // -----------------------------------------------------------
  // Config helpers (Bridge)
  // -----------------------------------------------------------
  function cfgBridge() {
    // cameraBridgeServer.Bridge (Kestrel)
    const b = window.PB_CONFIG?.cameraBridgeServer?.Bridge;
    if (b && typeof b === 'object') {
      let host = String(b.BindAddress || '127.0.0.1').trim();
      const h = host.toLowerCase();
      if (!host || h === '0.0.0.0' || h === '::') host = '127.0.0.1';

      return {
        protocol: window.location.protocol || 'http:',
        host,
        httpPort: b.Port ?? 8052,
        auth_key: b.AuthKey ?? ''
      };
    }

    // legacy: cameraBrdige / cameraBridge (Typo absichtlich)
    const c = (window.PB_CONFIG && (window.PB_CONFIG.cameraBrdige || window.PB_CONFIG.cameraBridge)) || {};
    return c || {};
  }

  function getBridgePort() {
    const c = cfgBridge();
    const p = parseInt(c.httpPort, 10);
    return Number.isFinite(p) && p > 0 ? p : 8052;
  }

  function getApiKey() {
    const c = cfgBridge();
    return (c.auth_key || c.authKey || '').toString().trim();
  }

  function apiHost() {
    const c = cfgBridge();
    return (c.host || '127.0.0.1').toString();
  }

  function apiProto() {
    const c = cfgBridge();
    const p = (c.protocol || window.location.protocol || 'http:').toString();
    return p.endsWith(':') ? p : (p + ':');
  }

  // Back-compat (falls irgendwo noch genutzt)
  PB.getBridgeApiKey = PB.getBridgeApiKey || function () {
    return getApiKey();
  };

  // Optional: steuert ob zusätzlich Bearer gesendet wird
  PB.BRIDGE_AUTH_ADD_BEARER = (PB.BRIDGE_AUTH_ADD_BEARER !== undefined) ? PB.BRIDGE_AUTH_ADD_BEARER : false;

  function markOffline(err) {
    try {
      if (err && !err.code) err.code = 'CAMERABRIDGE_OFFLINE';
    } catch (_) {}
    return err;
  }

  async function safeFetch(url, opts) {
    try {
      return await fetch(url, opts);
    } catch (err) {
      throw markOffline(err);
    }
  }

  async function readJsonOrRaw(res) {
    const txt = await res.text();
    if (!res.ok) {
      throw new Error(
        trf('bridge_api.err.http', 'HTTP {status} - {detail}', { status: res.status, detail: txt })
      );
    }
    if (!txt) return null;
    try { return JSON.parse(txt); } catch (_) { return { ok: true, raw: txt }; }
  }

  function urlFor(routeKey, opts) {
    opts = opts || {};

    // bevorzugt: zentraler Resolver
    if (typeof PB.apiUrl === 'function') {
      return PB.apiUrl(routeKey, opts);
    }

    const path = PB.API_ROUTES[routeKey];
    if (!path) {
      throw new Error(
        trf('bridge_api.err.missing_route', '[bridge_api] Missing route: {routeKey}', { routeKey: String(routeKey) })
      );
    }

    // PHP fallback: non-bridge endpoints
    const basePhp = (window.location.origin || 'http://127.0.0.1:8050') + '/api/';

    // Bridge-API base — via Caddy-Proxy um CORS zu vermeiden
    const baseApi = (typeof PB.bridgeBaseUrl === 'function' ? PB.bridgeBaseUrl() : `${apiProto()}//${apiHost()}:${getBridgePort()}`) + '/';

    const useApi = /^api\//i.test(String(path));
    const base = useApi ? baseApi : basePhp;

    const qs = Object.assign({}, opts.qs || {});
    if (opts.cacheBust) qs._ = Date.now();

    const query = Object.keys(qs).length ? ('?' + new URLSearchParams(qs).toString()) : '';
    return base + String(path).replace(/^\/+/, '') + query;
  }

  function isPublicPath(pathnameLower) {
    // Public laut deiner Info (bei AuthKey gesetzt)
    if (pathnameLower === '/' || pathnameLower === '') return true;
    if (pathnameLower === '/api/status') return true;
    if (pathnameLower === '/favicon.ico') return true;

    // MJPEG (meist /live.mjpg o.ä.) ist public, aber i.d.R. nicht via fetch.
    if (pathnameLower.endsWith('.mjpg')) return true;

    return false;
  }

  function addAuthHeaderIfNeeded(headers, urlOrPath) {
    const key = getApiKey();
    if (!key) return headers;

    const apply = () => {
      if (!headers['X-Api-Key']) headers['X-Api-Key'] = key;

      // optional zusätzlich Bearer
      if (PB.BRIDGE_AUTH_ADD_BEARER) {
        if (!headers['Authorization'] && !headers['authorization']) {
          headers['Authorization'] = 'Bearer ' + key;
        }
      }
    };

    // Wenn URL bekannt ist
    try {
      const u = new URL(urlOrPath, window.location.origin);
      const p = (u.pathname || '').toLowerCase();

      // /api/... direkt oder /camerapi/api/... via Caddy-Proxy
      const apiPath = p.startsWith('/camerapi/') ? p.slice('/camerapi'.length) : p;
      if (apiPath.startsWith('/api/') && !isPublicPath(apiPath)) apply();
      return headers;
    } catch (_) {}

    // fallback: wenn nur path übergeben wurde
    const s = String(urlOrPath || '').toLowerCase();
    if (s.startsWith('api/') || s.startsWith('/api/') || s.includes('/camerapi/api/')) {
      if (!s.includes('api/status')) apply();
    }
    return headers;
  }

  // Back-compat helper: PB.bridgeAuthHeaders(extra, urlOrPath)
  PB.bridgeAuthHeaders = PB.bridgeAuthHeaders || function (extra = {}, urlOrPath = 'api/') {
    const h = Object.assign({}, extra);
    addAuthHeaderIfNeeded(h, urlOrPath);
    return h;
  };

  function addKeyQueryIfPresent(qs) {
    // Watchdog unterstützt key=... im Querystring (optional zusätzlich zu Headern)
    const key = getApiKey();
    if (!key) return qs;
    if (!Object.prototype.hasOwnProperty.call(qs, 'key')) qs.key = key;
    return qs;
  }

  async function getRoute(routeKey, opts) {
    const url = urlFor(routeKey, opts);
    const headers = { 'Accept': 'application/json' };
    addAuthHeaderIfNeeded(headers, url);

    const res = await safeFetch(url, { method: 'GET', headers, cache: 'no-store' });
    return readJsonOrRaw(res);
  }

  async function postRoute(routeKey, bodyObj, opts) {
    opts = opts || {};
    const url = urlFor(routeKey, opts);

    const headers = Object.assign({ 'Accept': 'application/json' }, opts.headers || {});
    addAuthHeaderIfNeeded(headers, url);

    const req = { method: 'POST', headers, cache: 'no-store' };

    if (bodyObj !== null && bodyObj !== undefined) {
      req.headers['Content-Type'] = 'application/json; charset=UTF-8';
      req.body = JSON.stringify(bodyObj);
    }

    const res = await safeFetch(url, req);
    return readJsonOrRaw(res);
  }

    async function postRouteBlob(routeKey, bodyObj, opts) {
    opts = opts || {};
    const url = urlFor(routeKey, opts);

    // für JPEG bewusst "image/*" akzeptieren (Server liefert image/jpeg)
    const headers = Object.assign({ 'Accept': 'image/jpeg' }, opts.headers || {});
    addAuthHeaderIfNeeded(headers, url);

    const req = { method: 'POST', headers, cache: 'no-store' };

    if (bodyObj !== null && bodyObj !== undefined) {
      req.headers['Content-Type'] = 'application/json; charset=UTF-8';
      req.body = JSON.stringify(bodyObj);
    }

    const res = await safeFetch(url, req);

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      throw new Error(
        trf('bridge_api.err.http', 'HTTP {status} - {detail}', { status: res.status, detail: txt })
      );
    }

    const blob = await res.blob();
    return { ok: true, blob, objectUrl: URL.createObjectURL(blob) };
  }


  // -----------------------------------------------------------
  // Public API
  // -----------------------------------------------------------
  PB.bridge = PB.bridge || {};

  Object.defineProperty(PB.bridge, 'base', {
    get: () => {
      try { return new URL(urlFor('bridge_status')).origin; }
      catch (_) { return typeof PB.bridgeBaseUrl === 'function' ? PB.bridgeBaseUrl() : `${apiProto()}//${apiHost()}:${getBridgePort()}`; }
    }
  });

  PB.bridge.refresh = async function () {
    return postRoute('bridge_refresh', null);
  };

  PB.bridge.cameras = async function () {
    return getRoute('bridge_cameras');
  };

  PB.bridge.list = async function () {
    return PB.bridge.cameras();
  };

  PB.bridge.select = async function (id) {
    return postRoute('bridge_select', null, { qs: { id: String(id) } });
  };

  PB.bridge.selectBySerial = async function (serial) {
    const s = String(serial || '').trim();
    if (!s) throw new Error(tr('bridge_api.err.select_by_serial_empty', 'selectBySerial: serial is empty'));

    // 1) direkter Serial-Call (wenn die Bridge das unterstützt)
    try {
      return await postRoute('bridge_select', null, { qs: { serial: s } });
    } catch (e1) {
      // 2) fallback: list -> match -> select(id)
      const list = await PB.bridge.cameras();
      const cams = Array.isArray(list) ? list : (list && (list.cameras || list.devices)) || [];
      const wanted = s.toLowerCase();

      const pickSerial = (d) => {
        const v = d?.Serial ?? d?.serial ?? d?.serialNumber ?? d?.sn ?? d?.sno ?? d?.deviceSerial;
        return v == null ? '' : String(v).trim();
      };
      const pickId = (d) => d?.Id ?? d?.id ?? d?.deviceId ?? d?.uid ?? d?.cameraId ?? '';

      let match = null;
      for (const d of cams) {
        const ser = pickSerial(d);
        if (ser && ser.toLowerCase() === wanted) { match = d; break; }
      }
      if (!match) throw e1;

      const id = pickId(match);
      if (!id) throw new Error(tr('bridge_api.err.select_by_serial_no_id', 'selectBySerial: match found but no id field'));
      return PB.bridge.select(id);
    }
  };

  PB.bridge.capture = async function (payload, options) {
    const p = Object.assign({}, payload || {});
    const opts = options || {};
    const qs = Object.assign({}, opts.qs || {});

    const flag =
      opts.startLiveViewAfterCapture ??
      p.startLiveViewAfterCapture;

    if (flag !== undefined && flag !== null) {
      qs.startLiveViewAfterCapture = flag ? 'true' : 'false';
    }

    delete p.startLiveViewAfterCapture;

    return postRoute('bridge_capture', p, { qs });
  };

    PB.bridge.captureJpeg = async function (payload) {
    const p = Object.assign({}, payload || {}, { mode: 'jpeg' });
    return postRouteBlob('bridge_capture', p);
  };

  PB.bridge.photoCount = async function () {
    try {
      const j = await getRoute('bridge_photo_count');
      if (j && j.ok && Number.isFinite(j.count) && j.count > 0) return j.count;
    } catch (_) {}
    return 1;
  };

  // LiveView
  PB.bridge.liveviewStart = async function () {
    return postRoute('bridge_liveview_start', null);
  };

  PB.bridge.liveviewStop = async function () {
    return postRoute('bridge_liveview_stop', null);
  };

  PB.bridge.liveviewSetFps = async function (fps) {
    const n = Number(fps);
    if (!Number.isFinite(n) || n <= 0) return { ok: true, skipped: true };
    const v = Math.max(1, Math.min(60, Math.round(n)));
    return postRoute('bridge_liveview_fps', null, { qs: { fps: String(v) } });
  };

  // Settings
  PB.bridge.getSettings = async function () {
    return getRoute('bridge_settings', { cacheBust: true });
  };

  PB.bridge.setSettings = async function (settings) {
    const s = settings || {};
    const payload = {};
    if (s.iso != null) payload.iso = String(s.iso);
    if (s.shutter != null) payload.shutter = String(s.shutter);
    if (s.whiteBalance != null) payload.whiteBalance = String(s.whiteBalance);
    return postRoute('bridge_settings', payload);
  };

  // Watchdog
  PB.bridge.watchdogStatus = async function () {
    const qs = addKeyQueryIfPresent({});
    return getRoute('bridge_watchdog', { qs });
  };

  PB.bridge.watchdogEnable = async function (enabled) {
    const en = enabled ? 1 : 0;
    const qs = addKeyQueryIfPresent({ enabled: String(en) });
    return postRoute('bridge_watchdog', null, { qs });
  };

  PB.bridge.watchdogOn = async function () {
    return PB.bridge.watchdogEnable(true);
  };

  PB.bridge.watchdogOff = async function () {
    return PB.bridge.watchdogEnable(false);
  };

  PB.bridge.status = async function () {
    // public endpoint -> getRoute skippt auth automatisch
    return getRoute('bridge_status', { cacheBust: true });
  };

  PB.bridge.ping = function () {
    const h = PB._bridgeLastHealth;
    return !!(h && h.webserverReachable === true);
  };

  PB.bridge.waitOnline = async function (opts) {
    opts = opts || {};
    const timeoutMs = Number(opts.timeoutMs || 15000);
    const stepMs = Math.max(150, Number(opts.stepMs || 400));

    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (await PB.bridge.ping()) return true;
      await (PB.sleep ? PB.sleep(stepMs) : new Promise(r => setTimeout(r, stepMs)));
    }
    return false;
  };

  // -----------------------------------------------------------
  // Convenience: "läuft Stream/Frames?" + "Current FPS"
  // -----------------------------------------------------------
  PB.bridge.isStreaming = function () {
    const h = PB._bridgeLastHealth;
    if (!h) return false;

    return (
      h.webserverReachable === true &&
      (h.liveViewRunning === true || h.mjpegStreamRunning === true) &&
      (h.framesActive === true || h.framesReceiving === true)
    );
  };

  // Current FPS lesen (auth endpoint) – nutzt automatisch X-Api-Key / Bearer
  PB.bridge.getLiveviewFps = async function () {
    return getRoute('bridge_liveview_fps', { cacheBust: true });
  };

  // Niemand außer camerabirdge_API_server_Status.js darf /api/status auslösen – auch nicht aus Versehen.
  PB.bridge.status = async function () {
    console.warn(tr('bridge_api.warn.status_forbidden_ui', '[bridge.status] Forbidden in UI – use PB._bridgeLastHealth'));
    throw new Error(tr('bridge_api.err.status_disabled_ui', 'bridge.status disabled in UI'));
  };

})();
