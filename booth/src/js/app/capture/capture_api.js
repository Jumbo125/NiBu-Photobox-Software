// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ===========================================================
 * booth/js/capture_api.js
 * -----------------------------------------------------------
 * Zweck:
 *  - Zentrale JS-API für Kamera-Capture & LiveView (Wrapper/Shim)
 *  - Delegiert Kamera-Aktionen an:
 *      → PB.bridge (CameraBridge API-Server)
 *      → PB.pythonSvc (Rendering / Tools)
 * =========================================================== */
(function () {
  'use strict';

  // Namespace sicherstellen
  window.PB = window.PB || {};
  const PB = window.PB;

  // -----------------------------------------------------------
  // i18n Helper (pbT Shim)
  // -----------------------------------------------------------
  const tr = (key, fallback) => {
    const fn =
      (typeof window !== 'undefined' && typeof window.pbT === 'function')
        ? window.pbT
        : (typeof pbT === 'function' ? pbT : null);

    return fn ? fn(key, fallback) : fallback;
  };

  const trf = (key, fallback, vars) => {
    let s = tr(key, fallback);
    if (vars && typeof s === 'string') {
      for (const k in vars) {
        s = s.split(`{${k}}`).join(String(vars[k]));
      }
    }
    return s;
  };

  /* ===========================================================
   * BASIS-URLS & KONFIGURATION
   * =========================================================== */

  // CameraBridge HTTP Base (normalerweise ApiServer.exe)
  PB.BRIDGE_BASE =
    PB.BRIDGE_BASE ||
    (PB.bridgeBaseUrl ? PB.bridgeBaseUrl() : 'http://127.0.0.1:8052');

  // Python Tool Server Base
  PB.PYTHON_BASE =
    PB.PYTHON_BASE ||
    (PB.pythonSvc && PB.pythonSvc.baseUrl
      ? PB.pythonSvc.baseUrl()
      : 'http://127.0.0.1:8053');

  // Python API-Key aus Config lesen (falls vorhanden)
  try {
    const root =
      typeof PB._cfgRoot === 'function'
        ? PB._cfgRoot()
        : (window.PB_CONFIG || {});

    PB.PYTHON_API_KEY =
      PB.PYTHON_API_KEY ||
      String(PB._getDeep?.(root, 'pythonServer.AuthKey') || '').trim();
  } catch (_) {
    PB.PYTHON_API_KEY = PB.PYTHON_API_KEY || '';
  }

  // Capture-Dateinamen-Präfix (z. B. Photo_1.jpg)
  PB.CAPTURE_TMP_Prefix = PB.CAPTURE_TMP_Prefix || 'Photo_';

  // Default Capture Root (kommt vom Worker)
  PB.ensureCaptureTmpDir =
    PB.ensureCaptureTmpDir ||
    function () {
      if (PB.CAPTURE_TMP_DIR) return PB.CAPTURE_TMP_DIR;

      const captureRoot =
        PB._getDeep(window.PB_CONFIG, 'cameraBridgeWorker.defaultCaptureFolder') ??
        '';

      if (!captureRoot) {
        console.warn(
          '[capture]',
          tr(
            'capture.ensure_tmp_dir.warn.capture_root_missing',
            'captureRoot missing in configuration'
          )
        );
        return '';
      }

      if (!PB.joinAndNormalizePath || PB.CAPTURE_TMP_DIR_Prefix == null) {
        console.warn(
          '[capture]',
          tr(
            'capture.ensure_tmp_dir.warn.join_and_normalize_missing',
            'joinAndNormalizePath missing — cannot build temp capture dir'
          )
        );
        return '';
      }

      PB.CAPTURE_TMP_DIR = PB.joinAndNormalizePath(
        captureRoot,
        PB.CAPTURE_TMP_DIR_Prefix
      );

      console.log('[capture] CAPTURE_TMP_DIR =', PB.CAPTURE_TMP_DIR);
      return PB.CAPTURE_TMP_DIR;
    };

  /* ===========================================================
   * HILFSFUNKTION: Response vereinheitlichen
   * =========================================================== */
  function normalizeOk(res) {
    if (!res) {
      return {
        ok: false,
        error: 'no_response',
        message: tr('capture.err.no_response', 'No response from service.')
      };
    }
    if (res.ok === true) return res;
    if (res.success === true) return Object.assign({ ok: true }, res);
    return Object.assign({ ok: false }, res);
  }

  /* ===========================================================
   * CAPTURE API (öffentliche JS-Schnittstelle)
   * =========================================================== */
  PB.captureApi = PB.captureApi || {};

  /* -----------------------------------------------------------
   * STATUS
   * ----------------------------------------------------------- */
  PB.captureApi.status = async function () {
    const h = PB._bridgeLastHealth;
    if (!h) return false;

    return (
      h.webserverReachable === true &&
      (h.liveViewRunning === true || h.mjpegStreamRunning === true) &&
      (h.framesActive === true || h.framesReceiving === true)
    );
  };

  /* -----------------------------------------------------------
   * LIVEVIEW START
   * ----------------------------------------------------------- */
  PB.captureApi.liveviewStart = async function () {
    if (!PB.bridge?.liveviewStart) {
      throw new Error(
        trf(
          'capture.bridge.err.method_not_available',
          'CameraBridge method not available: {method}.',
          { method: 'liveviewStart' }
        )
      );
    }

    return normalizeOk(await PB.bridge.liveviewStart());
  };

  /* -----------------------------------------------------------
   * LIVEVIEW STOP
   * ----------------------------------------------------------- */
  PB.captureApi.liveviewStop = async function () {
    if (!PB.bridge?.liveviewStop) {
      throw new Error(
        trf(
          'capture.bridge.err.method_not_available',
          'CameraBridge method not available: {method}.',
          { method: 'liveviewStop' }
        )
      );
    }

    return normalizeOk(await PB.bridge.liveviewStop());
  };

  /* -----------------------------------------------------------
   * LIVEVIEW FPS SETZEN
   * ----------------------------------------------------------- */
  PB.captureApi.setLiveviewFps = async function (fps) {
    if (!PB.bridge?.liveviewSetFps) {
      throw new Error(
        trf(
          'capture.bridge.err.method_not_available',
          'CameraBridge method not available: {method}.',
          { method: 'liveviewSetFps' }
        )
      );
    }

    return normalizeOk(await PB.bridge.liveviewSetFps(fps));
  };

  /* -----------------------------------------------------------
   * KAMERA-SETTINGS LESEN
   * ----------------------------------------------------------- */
  PB.captureApi.getSettings = async function () {
    if (!PB.bridge?.getSettings) {
      throw new Error(
        trf(
          'capture.bridge.err.method_not_available',
          'CameraBridge method not available: {method}.',
          { method: 'getSettings' }
        )
      );
    }

    return normalizeOk(await PB.bridge.getSettings());
  };

  /* -----------------------------------------------------------
   * KAMERA-SETTINGS SETZEN
   * ----------------------------------------------------------- */
  PB.captureApi.setSettings = async function (settings) {
    if (!PB.bridge?.setSettings) {
      throw new Error(
        trf(
          'capture.bridge.err.method_not_available',
          'CameraBridge method not available: {method}.',
          { method: 'setSettings' }
        )
      );
    }

    return normalizeOk(await PB.bridge.setSettings(settings || {}));
  };

  /* ===========================================================
   * CAPTURE (hier wird das Foto ausgelöst)
   * =========================================================== */
  PB.captureApi.captureOnce = async function (opts) {
    if (!PB.bridge?.capture) {
      throw new Error(
        trf(
          'capture.bridge.err.method_not_available',
          'CameraBridge method not available: {method}.',
          { method: 'capture' }
        )
      );
    }

    const o = opts || {};

    // Slot validieren (1..N)
    const slot = Number(o.slot || 0);
    if (!Number.isFinite(slot) || slot <= 0) {
      throw new Error(
        tr(
          'capture.capture_once.err.invalid_slot',
          'Invalid capture slot.'
        )
      );
    }

    // Dateiname bestimmen
    const prefix = String(PB.CAPTURE_TMP_Prefix || 'Photo_');

    // Zielordner bestimmen
    const dir =
      o.path && String(o.path).trim() !== ''
        ? String(o.path).trim()
        : String(PB.CAPTURE_TMP_DIR || '').trim();

    if (!dir) {
      throw new Error(
        tr(
          'capture.capture_once.err.missing_target_directory',
          'Missing target directory for capture.'
        )
      );
    }

    const ext = (o.ext || 'jpg').replace(/^\./, '');
    const fileName = `${prefix}${slot}.${ext}`;

    // vollständigen Dateipfad bauen
    const fullPath = PB.joinAndNormalizePath
      ? PB.joinAndNormalizePath(dir, fileName)
      : dir.replace(/[\/\\]+$/, '') + '\\' + fileName;

    const payload = {
      mode: 'file',
      overwrite: true,
      path: fullPath
    };

    if (o.startLiveViewAfterCapture != null) {
      payload.startLiveViewAfterCapture = !!o.startLiveViewAfterCapture;
    }

    // Optionale Shot-spezifische Settings
if (o.applySettings === true) {
  payload.applySettings = true;
  payload.resetAfterShoot = true;

  const iso = (o.iso != null)
    ? String(o.iso).trim()
    : (PB._readStringFromConfig?.(['camera.camera_settings.iso'], '') || '').trim();

  const shutter = (o.shutter != null)
    ? String(o.shutter).trim()
    : (PB._readStringFromConfig?.(['camera.camera_settings.shutter'], '') || '').trim();

  const wb = (o.wb != null)
    ? String(o.wb).trim()
    : (PB._readStringFromConfig?.(['camera.camera_settings.wb'], '') || '').trim();

  // Aperture (f-stop)
  const aperture = (o.aperture != null)
    ? String(o.aperture).trim()
    : (PB._readStringFromConfig?.(['camera.camera_settings.aperture'], '') || '').trim();

  //  Exposure compensation (float; 0 ist gültig!)
  // akzeptiere o.exposure ODER o.exposureCompensation
  const exposureRaw = (o.exposure != null)
    ? o.exposure
    : (o.exposureCompensation != null ? o.exposureCompensation
      : (PB._readStringFromConfig?.(['camera.camera_settings.exposure'], '') || '').trim());

  // exposureRaw kann number oder string sein
  let exposure;
  if (exposureRaw != null && String(exposureRaw).trim() !== '') {
    const n = Number(String(exposureRaw).trim().replace(',', '.'));
    if (!Number.isNaN(n)) exposure = n;
  }

  if (iso) payload.iso = iso;
  if (shutter) payload.shutter = shutter;
  if (wb) payload.whiteBalance = wb;      // API-Feldname
  if (aperture) payload.aperture = aperture;

  // nur mitsenden wenn parsebar (inkl. 0)
  if (typeof exposure === 'number') payload.exposure = exposure;
}



    const res = await PB.bridge.capture(payload);
    return normalizeOk(res);
  };

  /* -----------------------------------------------------------
   * AUF LIVEVIEW-FRAMES WARTEN
   * ----------------------------------------------------------- */
  PB.captureApi.waitForFrames = async function (timeoutMs) {
    const t0 = Date.now();

    while (Date.now() - t0 < timeoutMs) {
      const h = PB._bridgeLastHealth;

      // Cold-Start-Bypass
      if (!h) {
        return { ok: true, coldStart: true };
      }

      const ok =
        h.webserverReachable === true &&
        (h.liveViewRunning === true || h.mjpegStreamRunning === true) &&
        (h.framesActive === true || h.framesReceiving === true);

      if (ok) {
        return { ok: true, health: h };
      }

      await PB.sleep(120);
    }

    return {
      ok: false,
      error: 'frames_timeout',
      message: tr(
        'capture.wait_for_frames.err.timeout',
        'Timed out waiting for live-view frames.'
      )
    };
  };

  /* ===========================================================
   * PYTHON RENDERING STARTEN
   * =========================================================== */
  /**
   * Startet das Rendering basierend auf session.json
   * Erwartet: payload.captureFolderHint → Ordner mit session.json
   */
  PB.captureApi.runPython = async function (payload) {
    const sessionFolder =
      String(payload?.captureFolderHint || PB.CAPTURE_TMP_DIR || '').trim();

    if (!sessionFolder) {
      return {
        ok: false,
        error: 'missing_captureFolderHint',
        message: tr(
          'python.render.err.missing_capture_folder_hint',
          'Missing session folder (captureFolderHint).'
        )
      };
    }

    const py_config = PB._getDeep?.(window.PB_CONFIG, 'pythonServer') || {};
    const PYTHON_API_KEY = py_config.AuthKey;

    const base = String(PB.PYTHON_BASE || '').replace(/\/+$/g, '');
    const url = base + '/render_from_session';

    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': PYTHON_API_KEY
    };

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({ session_folder: sessionFolder })
      });
    } catch (e) {
      return {
        ok: false,
        error: 'python_unreachable',
        message: tr('python.err.unreachable', 'Python server is unreachable.'),
        detail: String(e)
      };
    }

    let json = {};
    try {
      json = await response.json();
    } catch (_) {}

    if (!response.ok) {
      return Object.assign(
        {
          ok: false,
          http: response.status,
          error: 'render_request_failed',
          message: tr(
            'python.render.err.request_failed',
            'Render request failed.'
          )
        },
        json
      );
    }

    // Preview-URL (binär fürs <img>); Query ist für <img> am einfachsten.
    const previewUrl =
      base +
      '/preview/session?api_key=' +
      encodeURIComponent(PYTHON_API_KEY) +
      '&session_folder=' +
      encodeURIComponent(sessionFolder) +
      '&v=' +
      Date.now();

    json.preview_url = previewUrl;
    return json;
  };

  /* ===========================================================
   * CAPTURE FLOW UTILS
   * =========================================================== */
  PB.captureFlow = PB.captureFlow || {};
  PB.captureFlow.utils = PB.captureFlow.utils || {};

  // Warten bis LiveView wieder Frames liefert
  PB.captureFlow.utils.waitForLiveviewRecovery = async function (opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs ?? 2500;
    const pollMs = opts.pollMs ?? 150;
    const t0 = Date.now();

    while (Date.now() - t0 < timeoutMs) {
      try {
        const r = await PB.captureApi.waitForFrames(400);
        if (r?.ok === true) return true;
      } catch (_) {}

      await PB.sleep(pollMs);
    }

    console.warn(
      '[PB.captureFlow]',
      tr(
        'capture.flow.warn.liveview_recovery_timeout',
        'LiveView recovery timeout.'
      )
    );
    return false;
  };

  /* ===========================================================
   * PREVIEW SICHER STARTEN
   * =========================================================== */
  PB.ensurePreviewReady = async function (opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs ?? 3000;

    // LiveView sofort starten (idempotent)
    PB.captureApi?.liveviewStart?.().catch(() => {});

    // nur ein schneller Check, kein langes Warten
    const r = await PB.captureApi.waitForFrames(400);
    if (r?.ok === true) return true;

    console.warn(
      '[PB.ensurePreviewReady]',
      tr(
        'capture.preview.warn.non_blocking_continue',
        'Preview not ready yet — continuing without blocking.'
      )
    );
    return true;
  };

  /* ===========================================================
   * SHUTTER-ANIMATION (UI ONLY)
   * =========================================================== */
PB.shutter = PB.shutter || {};

PB.shutter.playIn = function (root = document, selector = null) {
  if (!selector) return false;

  const el = root.querySelector(selector);
  if (!el) return false;

  el.classList.remove("is-playing");
  void el.offsetWidth;
  el.classList.add("is-playing");
  return true;
};
  /* ===========================================================
   * PYTHON PRINT (default)
   * =========================================================== */
  /**
   * Druckt ein Bild über /print/default
   * Erwartet:
   *   payload.image_path  → Pfad zum Bild (required)
   *   payload.event_file  → Pfad zur Event-Datei (required)
   *   payload.copies      → optional (default 1, max 20)
   *   payload.printerName → optional (Printername)
   */
  PB.captureApi.printDefault = async function (payload) {
    const imagePath = String(payload?.image_path || '').trim();
    const eventFile = String(payload?.event_file || '').trim();
    const printerName =
      String(payload?.printerName || payload?.printer_name || '').trim() || null;

    if (!imagePath) {
      return {
        ok: false,
        error: 'missing_image_path',
        message: tr(
          'python.print.err.missing_image_path',
          'Missing image path.'
        )
      };
    }
    if (!eventFile) {
      return {
        ok: false,
        error: 'missing_event_file',
        message: tr(
          'python.print.err.missing_event_file',
          'Missing event file.'
        )
      };
    }

    // copies clamp 1..20 (Spec)
    let copies = parseInt(payload?.copies ?? 1, 10);
    if (!Number.isFinite(copies) || copies < 1) copies = 1;
    if (copies > 20) copies = 20;

    const py_config = PB._getDeep?.(window.PB_CONFIG, 'pythonServer') || {};
    const PYTHON_API_KEY = py_config.AuthKey;

    const base = String(PB.PYTHON_BASE || '').replace(/\/+$/g, '');
    const url = base + '/print/default';

    const headers = {
      'Content-Type': 'application/json',
      'X-Api-Key': PYTHON_API_KEY
    };

    // Body bauen + optional printerName
    const body = {
      image_path: imagePath,
      event_file: eventFile,
      copies: copies
    };
    if (printerName) body.printerName = printerName;

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body)
      });
    } catch (e) {
      return {
        ok: false,
        error: 'python_unreachable',
        message: tr('python.err.unreachable', 'Python server is unreachable.'),
        detail: String(e)
      };
    }

    let json = {};
    try {
      json = await response.json();
    } catch (_) {}

    if (!response.ok) {
      return Object.assign(
        {
          ok: false,
          http: response.status,
          error: 'print_request_failed',
          message: tr(
            'python.print.err.request_failed',
            'Print request failed.'
          )
        },
        json
      );
    }

    // UI / Config updaten, wenn Counter vom Server kommt
    try {
      const counterAfter = json?.counter_after;

      if (counterAfter != null) {
        window.PB_CONFIG = window.PB_CONFIG || {};
        window.PB_CONFIG.activeEvent = window.PB_CONFIG.activeEvent || {};
        window.PB_CONFIG.activeEvent.active_event =
          window.PB_CONFIG.activeEvent.active_event || {};

        const before = window.PB_CONFIG.activeEvent.active_event.print_counter;
        window.PB_CONFIG.activeEvent.active_event.print_counter = counterAfter;

        console.log('[printDefault] print_counter updated', {
          before,
          after: counterAfter
        });

        $(document).trigger('pb:activeEventChanged', [
          {
            path: 'activeEvent.active_event.print_counter',
            before,
            after: counterAfter,
            source: 'printDefault'
          }
        ]);

        if (typeof PB.updateActiveEventUI === 'function') {
          PB.updateActiveEventUI();
        }
      }
    } catch (e) {
      console.warn('[printDefault] updating UI/counter failed:', e);
    }

    return json;
  };
})();
