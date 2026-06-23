// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ===========================================================
 * booth/js/capture_api.js
 * -----------------------------------------------------------
 * Rolle im Gesamtsystem:
 *  - Diese Datei ist die technische API-Schicht für den Capture-Flow.
 *  - Sie kapselt alle Aufrufe, die aus dem UI-/Flow-Code heraus an
 *    externe Dienste gehen.
 *
 * Architektur im Hintergrund:
 *  - Kamera-/LiveView-/Capture-Aufrufe gehen über PB.bridge an den
 *    ApiServer und von dort weiter an den Bridge Worker.
 *  - Der Worker serialisiert kritische Kamera-Operationen und kümmert sich
 *    um kameraabhängige Details wie LiveView-Stop/Restart, Busy-Retries,
 *    temporäre Settings und Dateitransfer.
 *  - Rendern und Drucken laufen nicht über den CameraBridge-Worker, sondern
 *    separat über den Python-Service.
 *
 * Zuständigkeiten dieser Datei:
 *  - Browserseitige Requests zentral ausführen
 *  - Parameter normalisieren
 *  - Timeouts / Abort / Cancel einheitlich behandeln
 *  - Antworten aus Bridge und Python-Service in ein brauchbares Format
 *    für capture_flow.js überführen
 *
 * Wichtig für andere Entwickler:
 *  - capture_flow.js soll möglichst wenig HTTP-/Bridge-Details kennen.
 *  - Fehlerformate der externen Dienste werden hier vereinheitlicht.
 *  - Wenn sich API-Endpunkte oder Request-Parameter ändern, ist diese
 *    Datei der erste Ort für Anpassungen.
 * =========================================================== */
(function () {
  "use strict";

  // Namespace sicherstellen
  window.PB = window.PB || {};
  const PB = window.PB;

  // -----------------------------------------------------------
  // i18n Helper (pbT Shim)
  // -----------------------------------------------------------
  const tr = (key, fallback) => {
    const fn =
      typeof window !== "undefined" && typeof window.pbT === "function"
        ? window.pbT
        : typeof pbT === "function"
          ? pbT
          : null;

    return fn ? fn(key, fallback) : fallback;
  };

  const trf = (key, fallback, vars) => {
    let s = tr(key, fallback);
    if (vars && typeof s === "string") {
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
    (PB.bridgeBaseUrl ? PB.bridgeBaseUrl() : "http://127.0.0.1:8052");

  // Python Tool Server Base
  PB.PYTHON_BASE =
    PB.PYTHON_BASE ||
    (PB.pythonSvc && PB.pythonSvc.baseUrl
      ? PB.pythonSvc.baseUrl()
      : "http://127.0.0.1:8053");

  // Python API-Key aus Config lesen (falls vorhanden)
  try {
    const root =
      typeof PB._cfgRoot === "function"
        ? PB._cfgRoot()
        : window.PB_CONFIG || {};

    PB.PYTHON_API_KEY =
      PB.PYTHON_API_KEY ||
      String(PB._getDeep?.(root, "pythonServer.AuthKey") || "").trim();
  } catch (_) {
    PB.PYTHON_API_KEY = PB.PYTHON_API_KEY || "";
  }

  // Capture-Dateinamen-Präfix (z. B. Photo_1.jpg)
  PB.CAPTURE_TMP_Prefix = PB.CAPTURE_TMP_Prefix || "Photo_";

  // Default Capture Root (kommt vom Worker)
  PB.ensureCaptureTmpDir =
    PB.ensureCaptureTmpDir ||
    function () {
      if (PB.CAPTURE_TMP_DIR) return PB.CAPTURE_TMP_DIR;

      const captureRoot =
        PB._getDeep(
          window.PB_CONFIG,
          "cameraBridgeWorker.defaultCaptureFolder",
        ) ?? "";

      if (!captureRoot) {
        console.warn(
          "[capture]",
          tr(
            "capture.ensure_tmp_dir.warn.capture_root_missing",
            "captureRoot missing in configuration",
          ),
        );
        return "";
      }

      if (!PB.joinAndNormalizePath || PB.CAPTURE_TMP_DIR_Prefix == null) {
        console.warn(
          "[capture]",
          tr(
            "capture.ensure_tmp_dir.warn.join_and_normalize_missing",
            "joinAndNormalizePath missing — cannot build temp capture dir",
          ),
        );
        return "";
      }

      PB.CAPTURE_TMP_DIR = PB.joinAndNormalizePath(
        captureRoot,
        PB.CAPTURE_TMP_DIR_Prefix,
      );

      console.log("[capture] CAPTURE_TMP_DIR =", PB.CAPTURE_TMP_DIR);
      return PB.CAPTURE_TMP_DIR;
    };

  /* ===========================================================
   * HILFSFUNKTIONEN
   * ===========================================================
   * Diese Helfer halten technische Details aus den eigentlichen API-
   * Methoden heraus. Hier werden z. B. Zahlen aus der Config gelesen,
   * Timeouts vereinheitlicht und Fehlerobjekte in ein konsistentes Format
   * gebracht.
   */
  function readNumberConfig(paths, fallback) {
    const list = Array.isArray(paths) ? paths : [paths];

    for (const path of list) {
      const raw = PB._getDeep?.(window.PB_CONFIG, path);
      if (raw == null || String(raw).trim() === "") continue;

      const n = Number(String(raw).trim().replace(",", "."));
      if (Number.isFinite(n) && n >= 0) return Math.round(n);
    }

    return fallback;
  }

  function buildOpError(code, message, detail) {
    const err = new Error(message || code || "Operation failed.");
    err.code = code || "operation_failed";
    if (detail != null) err.detail = detail;
    return err;
  }

  function normalizeTimeoutMs(value, fallback) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return Math.round(n);
    return Math.round(fallback);
  }

  // Jeder laufende Fetch mit AbortController wird hier registriert,
  // damit der Capture-Flow bei "Abbrechen" zentral alle relevanten
  // Render-/Print-Requests beenden kann.
  function registerAbortController(controller) {
    if (!controller) return () => {};

    PB.captureApi = PB.captureApi || {};
    PB.captureApi._activeAbortControllers =
      PB.captureApi._activeAbortControllers || new Set();

    PB.captureApi._activeAbortControllers.add(controller);
    return () => {
      try {
        PB.captureApi._activeAbortControllers.delete(controller);
      } catch (_) {}
    };
  }

  // Verknüpft das Flow-interne Cancel-Signal mit einem konkreten
  // AbortController. So kann capture_flow.js einen laufenden Request
  // abbrechen, ohne die Fetch-Logik selbst kennen zu müssen.
  function bindCancelSignal(controller, cancelSignal) {
    if (
      !controller ||
      !cancelSignal ||
      typeof cancelSignal.onCancel !== "function"
    ) {
      return () => {};
    }

    if (cancelSignal.cancelled) {
      try {
        controller.abort(cancelSignal.reason || "flow_cancelled");
      } catch (_) {}
      return () => {};
    }

    return cancelSignal.onCancel((reason) => {
      try {
        controller.abort(reason || "flow_cancelled");
      } catch (_) {}
    });
  }

  function createCancelPromise(cancelSignal) {
    if (!cancelSignal || typeof cancelSignal.onCancel !== "function")
      return null;

    if (cancelSignal.cancelled) {
      return Promise.reject(
        cancelSignal.reason ||
          buildOpError(
            "flow_cancelled",
            tr("capture.flow.err.cancelled", "Capture flow cancelled."),
          ),
      );
    }

    return new Promise((_, reject) => {
      const off = cancelSignal.onCancel((reason) => {
        try {
          off && off();
        } catch (_) {}

        reject(
          reason instanceof Error
            ? reason
            : buildOpError(
                "flow_cancelled",
                tr("capture.flow.err.cancelled", "Capture flow cancelled."),
              ),
        );
      });
    });
  }

  // Führt eine Operation gegen Timeout und optionales Cancel-Signal aus.
  // Das wird bewusst als generischer Wrapper gebaut, damit Capture,
  // Rendern und Drucken dasselbe Verhalten haben.
  function raceWithGuards(promise, opts) {
    const timeoutMs = normalizeTimeoutMs(opts?.timeoutMs, 0);
    const races = [Promise.resolve(promise)];

    if (timeoutMs > 0) {
      races.push(
        new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              buildOpError(
                opts?.timeoutCode || "timeout",
                opts?.timeoutMessage ||
                  tr("capture.err.timeout", "Operation timed out."),
                { timeoutMs },
              ),
            );
          }, timeoutMs);
        }),
      );
    }

    const cancelPromise = createCancelPromise(opts?.cancelSignal);
    if (cancelPromise) races.push(cancelPromise);

    return Promise.race(races);
  }

  function getCaptureTimeoutMs(overrideMs) {
    return normalizeTimeoutMs(
      overrideMs,
      readNumberConfig(
        [
          "general.capture.capture_timeout_ms",
          "general.capture.capture_timeout",
        ],
        25000,
      ),
    );
  }

  function getRenderTimeoutMs(overrideMs) {
    return normalizeTimeoutMs(
      overrideMs,
      readNumberConfig(
        ["general.capture.render_timeout_ms", "general.capture.render_timeout"],
        120000,
      ),
    );
  }

  function getPrintTimeoutMs(overrideMs) {
    return normalizeTimeoutMs(
      overrideMs,
      readNumberConfig(
        ["general.print.print_timeout_ms", "general.print.print_timeout"],
        45000,
      ),
    );
  }

  /* ===========================================================
   * HILFSFUNKTION: Response vereinheitlichen
   * =========================================================== */
  function normalizeOk(res) {
    if (!res) {
      return {
        ok: false,
        error: "no_response",
        message: tr("capture.err.no_response", "No response from service."),
      };
    }
    if (res.ok === true) return res;
    if (res.success === true) return Object.assign({ ok: true }, res);
    return Object.assign({ ok: false }, res);
  }

  /* ===========================================================
   * CAPTURE API (öffentliche JS-Schnittstelle)
   * ===========================================================
   * Ab hier liegen die Methoden, die der restliche Booth-Code direkt
   * verwenden darf. Alles darunter ist bewusst als öffentliche Fassade
   * gedacht, damit andere Dateien keine Bridge-/Fetch-Details duplizieren.
   */
  PB.captureApi = PB.captureApi || {};

  // Bricht alle aktuell registrierten Render-/Print-Requests ab.
  // Das ist kein globaler Kamera-Stopp, sondern eine gezielte Hilfe für
  // laufende Netzwerkoperationen innerhalb des Flows.
  PB.captureApi._captureBlocked = false;

  PB.captureApi.abortActiveOperations = function (reason) {
    // Neue Capture-Requests blockieren — verhindert dass earlyTask-Captures
    // nach dem Abbruch noch an den Worker geschickt werden und die Kamera
    // mehrfach auslöst.
    PB.captureApi._captureBlocked = true;

    const ctrls = Array.from(PB.captureApi._activeAbortControllers || []);
    ctrls.forEach((controller) => {
      try {
        controller.abort(reason || "flow_cancelled");
      } catch (_) {}
    });

    return { ok: true, aborted: ctrls.length };
  };

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
          "capture.bridge.err.method_not_available",
          "CameraBridge method not available: {method}.",
          { method: "liveviewStart" },
        ),
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
          "capture.bridge.err.method_not_available",
          "CameraBridge method not available: {method}.",
          { method: "liveviewStop" },
        ),
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
          "capture.bridge.err.method_not_available",
          "CameraBridge method not available: {method}.",
          { method: "liveviewSetFps" },
        ),
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
          "capture.bridge.err.method_not_available",
          "CameraBridge method not available: {method}.",
          { method: "getSettings" },
        ),
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
          "capture.bridge.err.method_not_available",
          "CameraBridge method not available: {method}.",
          { method: "setSettings" },
        ),
      );
    }

    return normalizeOk(await PB.bridge.setSettings(settings || {}));
  };

  /* -----------------------------------------------------------
 * CAMERA PREFLIGHT
 * ----------------------------------------------------------- */
PB.captureApi.cameraPreflight = async function (opts) {
  opts = opts || {};
  const forcePoll = opts.forcePoll !== false;

  const t = (key, fallback) =>
    typeof PB.t === "function" ? PB.t(key, fallback) : fallback;

  const selectedModel = String(
    PB._getDeep?.(window.PB_CONFIG, "general.camera.selected_camera.model") || ""
  ).trim();

  const selectedFromDom = String(
    document.getElementById("settingDeviceSelected")?.value || ""
  ).trim();

  const deviceText = String(
    document.getElementById("pb-connection-device_model")?.innerText || ""
  )
    .trim()
    .toLowerCase();

  const uiSaysNoCamera =
    deviceText.includes("no camera selected") ||
    deviceText.includes("kein gerät") ||
    deviceText.includes("keine kamera") ||
    deviceText.includes("nicht verbunden");

  // Wenn die sichtbare UI sagt: keine Kamera, dann hart blockieren.
  if (uiSaysNoCamera) {
    return {
      ok: false,
      error: "no_camera_selected",
      message: t(
        "overlay.connection_info.connected_device_err",
        "No device connected."
      ),
      selectedModel,
      selectedFromDom,
      deviceText,
    };
  }

  // Wenn weder Config noch Dropdown eine Kamera kennen: blockieren.
  if (!selectedModel && !selectedFromDom) {
    return {
      ok: false,
      error: "no_camera_selected",
      message: t(
        "overlay.connection_info.connected_device_err",
        "No device connected."
      ),
      selectedModel,
      selectedFromDom,
      deviceText,
    };
  }

  // Aktuellen Bridge-Status holen.
  // Retry-Schleife: Falls der erste Poll ergibt dass die Bridge offline ist,
  // kann das ein veralteter Cache-Wert sein (Bridge war gerade am Starten).
  // Wir versuchen es bis zu 3x mit 600ms Pause dazwischen (~2s gesamt).
  const pollOnce = () =>
    new Promise((resolve) => {
      if (typeof PB.check_cameraBridge_connection !== "function") {
        resolve();
        return;
      }
      try {
        const req = PB.check_cameraBridge_connection();
        if (req && typeof req.done === "function") {
          req.done(() => resolve()).fail(() => resolve());
        } else {
          Promise.resolve(req).then(resolve).catch(resolve);
        }
      } catch (_) {
        resolve();
      }
    });

  if (forcePoll) {
    await pollOnce();

    // Wenn Bridge nach erstem Poll noch offline: 2 Retries mit 600ms Pause
    for (let retry = 0; retry < 2; retry++) {
      const hCheck = PB._bridgeLastHealth || null;
      if (hCheck && hCheck.webserverReachable === true) break;
      await new Promise((r) => setTimeout(r, 600));
      await pollOnce();
    }
  }

  const h = PB._bridgeLastHealth || null;

  if (!h || h.webserverReachable !== true) {
    return {
      ok: false,
      error: "camera_bridge_offline",
      message: t(
        "capture.flow.err.camera_bridge_offline",
        "CameraBridge is not reachable."
      ),
      selectedModel,
      selectedFromDom,
      deviceText,
      health: h,
    };
  }

  const bridgeSelected = String(h.selected || "").trim();

  // Wichtig:
  // Config/Dropdown allein reicht NICHT.
  // Die Bridge muss aktuell ein aktives/selektiertes Gerät melden.
  if (!bridgeSelected) {
    return {
      ok: false,
      error: "no_camera_active",
      message: t(
        "capture.flow.err.no_camera_active",
        "No active camera device was reported by CameraBridge."
      ),
      selectedModel,
      selectedFromDom,
      deviceText,
      health: h,
    };
  }

  return {
    ok: true,
    selectedModel,
    selectedFromDom,
    bridgeSelected,
    health: h,
  };
};

  /* ===========================================================
   * CAPTURE (hier wird das Foto ausgelöst)
   * ===========================================================
   * Wichtig:
   *  - Jeder Shot wird einzeln über die Bridge/API ausgelöst.
   *  - Diese Methode baut den Dateipfad für den Shot auf und reicht nur
   *    die nötigen Parameter an die Bridge weiter.
   *  - Optional können pro Shot Kamera-Settings mitgesendet werden.
   *  - Der Browser löst also nur den Shot an; die eigentliche Sequenz
   *    "Settings anwenden -> ggf. LiveView stoppen -> Capture -> Transfer ->
   *    Settings zurücksetzen -> LiveView wieder starten" wird backendseitig
   *    vom Worker abgewickelt.
   */
  PB.captureApi.captureOnce = async function (opts) {
    if (PB.captureApi._captureBlocked) {
      const err = new Error(tr("capture.err.blocked_after_abort", "Capture blocked after flow abort."));
      err.code = "capture_blocked";
      throw err;
    }

    if (!PB.bridge?.capture) {
      throw new Error(
        trf(
          "capture.bridge.err.method_not_available",
          "CameraBridge method not available: {method}.",
          { method: "capture" },
        ),
      );
    }

    const o = opts || {};

    // Slot validieren (1..N)
    const slot = Number(o.slot || 0);
    if (!Number.isFinite(slot) || slot <= 0) {
      throw new Error(
        tr("capture.capture_once.err.invalid_slot", "Invalid capture slot."),
      );
    }

    // Dateiname bestimmen
    const prefix = String(PB.CAPTURE_TMP_Prefix || "Photo_");

    // Zielordner bestimmen
    const dir =
      o.path && String(o.path).trim() !== ""
        ? String(o.path).trim()
        : String(PB.CAPTURE_TMP_DIR || "").trim();

    if (!dir) {
      throw new Error(
        tr(
          "capture.capture_once.err.missing_target_directory",
          "Missing target directory for capture.",
        ),
      );
    }

    const ext = (o.ext || "jpg").replace(/^\./, "");
    const fileName = `${prefix}${slot}.${ext}`;

    // vollständigen Dateipfad bauen
    const fullPath = PB.joinAndNormalizePath
      ? PB.joinAndNormalizePath(dir, fileName)
      : dir.replace(/[\/\\]+$/, "") + "\\" + fileName;

    // Das Bridge-Backend speichert direkt in eine Datei. Deshalb wird
    // hier schon der vollständige Zielpfad gebaut und nicht nur ein Slot.
    const payload = {
      mode: "file",
      overwrite: true,
      path: fullPath,
    };

    if (o.startLiveViewAfterCapture != null) {
      payload.startLiveViewAfterCapture = !!o.startLiveViewAfterCapture;
    }

    // Optionale Shot-spezifische Settings.
    // Diese Logik bleibt in der API-Datei, damit capture_flow.js nur noch
    // fachlich entscheidet, OB Settings verwendet werden sollen.
    if (o.applySettings === true) {
      payload.applySettings = true;
      payload.resetAfterShoot =
        o.resetAfterShoot != null ? !!o.resetAfterShoot : true;

      const iso =
        o.iso != null
          ? String(o.iso).trim()
          : (
              PB._readStringFromConfig?.(["camera.camera_settings.iso"], "") ||
              ""
            ).trim();

      const shutter =
        o.shutter != null
          ? String(o.shutter).trim()
          : (
              PB._readStringFromConfig?.(
                ["camera.camera_settings.shutter"],
                "",
              ) || ""
            ).trim();

      const wb =
        o.wb != null
          ? String(o.wb).trim()
          : (
              PB._readStringFromConfig?.(["camera.camera_settings.wb"], "") ||
              ""
            ).trim();

      // Aperture (f-stop)
      const aperture =
        o.aperture != null
          ? String(o.aperture).trim()
          : (
              PB._readStringFromConfig?.(
                ["camera.camera_settings.aperture"],
                "",
              ) || ""
            ).trim();

      //  Exposure compensation (float; 0 ist gültig!)
      // akzeptiere o.exposure ODER o.exposureCompensation
      const exposureRaw =
        o.exposure != null
          ? o.exposure
          : o.exposureCompensation != null
            ? o.exposureCompensation
            : (
                PB._readStringFromConfig?.(
                  ["camera.camera_settings.exposure"],
                  "",
                ) || ""
              ).trim();

      // exposureRaw kann number oder string sein
      let exposure;
      if (exposureRaw != null && String(exposureRaw).trim() !== "") {
        const n = Number(String(exposureRaw).trim().replace(",", "."));
        if (!Number.isNaN(n)) exposure = n;
      }

      if (iso) payload.iso = iso;
      if (shutter) payload.shutter = shutter;
      if (wb) payload.whiteBalance = wb; // API-Feldname
      if (aperture) payload.aperture = aperture;

      // nur mitsenden wenn parsebar (inkl. 0)
      if (typeof exposure === "number") payload.exposure = exposure;
    }

    // Der eigentliche Capture-Aufruf wird zusätzlich gegen Timeout und
    // Flow-Cancel abgesichert, damit der JS-Flow nicht endlos hängen bleibt.
    // Das ist bewusst nur ein browserseitiger Schutz. Ein bereits gestarteter
    // Einzel-Capture im Worker wird dabei nicht "halb" gestoppt, sondern der
    // Flow verhindert vor allem Hänger und weitere Folgeschritte.
    const capturePromise = Promise.resolve()
      .then(() => PB.bridge.capture(payload))
      .then((res) => normalizeOk(res));

    return raceWithGuards(capturePromise, {
      timeoutMs: getCaptureTimeoutMs(o.timeoutMs),
      timeoutCode: "capture_timeout",
      timeoutMessage: tr(
        "capture.capture_once.err.timeout",
        "Capture timed out.",
      ),
      cancelSignal: o.cancelSignal,
    });
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
        return {
          ok: false,
          error: "bridge_health_unknown",
          message: tr(
            "capture.wait_for_frames.err.health_unknown",
            "CameraBridge status is not available yet.",
          ),
        };
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
      error: "frames_timeout",
      message: tr(
        "capture.wait_for_frames.err.timeout",
        "Timed out waiting for live-view frames.",
      ),
    };
  };

  /* ===========================================================
   * PYTHON RENDERING STARTEN
   * ===========================================================
   * Das Rendering arbeitet auf Basis der zuvor geschriebenen session.json.
   * Der Capture-Flow muss deshalb vor diesem Aufruf sicherstellen, dass der
   * Session-Snapshot vollständig und aktuell ist.
   *
   * Wichtig zur Architektur:
   *   - Rendern hat nichts mit dem CameraBridge-Worker zu tun.
   *   - Ab hier wird der separate Python-Service angesprochen.
   */
  /**
   * Startet das Rendering basierend auf session.json
   * Erwartet: payload.captureFolderHint → Ordner mit session.json
   */
  // Startet das Rendering für eine komplette Session.
  // Rückgabeformat und Fehlerbehandlung werden hier vereinheitlicht,
  // damit der Flow nur noch auf ok/error prüfen muss.
  PB.captureApi.runPython = async function (payload) {
    const sessionFolder = String(
      payload?.captureFolderHint || PB.CAPTURE_TMP_DIR || "",
    ).trim();

    if (!sessionFolder) {
      return {
        ok: false,
        error: "missing_captureFolderHint",
        message: tr(
          "python.render.err.missing_capture_folder_hint",
          "Missing session folder (captureFolderHint).",
        ),
      };
    }

    const py_config = PB._getDeep?.(window.PB_CONFIG, "pythonServer") || {};
    const PYTHON_API_KEY = py_config.AuthKey;

    const base = String(PB.PYTHON_BASE || "").replace(/\/+$/g, "");
    const url = base + "/render_from_session";
    const timeoutMs = getRenderTimeoutMs(payload?.timeoutMs);

    const headers = {
      "Content-Type": "application/json",
      "X-Api-Key": PYTHON_API_KEY,
    };

    // Render-Request wird registriert, damit ein Flow-Abbruch aktiv auf
    // den laufenden Fetch durchschlägt.
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const unregisterController = registerAbortController(controller);
    const unbindCancel = bindCancelSignal(controller, payload?.cancelSignal);

    let response;
    try {
      response = await raceWithGuards(
        fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify({ session_folder: sessionFolder }),
          signal: controller ? controller.signal : undefined,
        }),
        {
          timeoutMs,
          timeoutCode: "render_timeout",
          timeoutMessage: tr("python.render.err.timeout", "Render timed out."),
          cancelSignal: payload?.cancelSignal,
        },
      );
    } catch (e) {
      unregisterController();
      unbindCancel();

      if (e?.name === "AbortError") {
        return {
          ok: false,
          error: payload?.cancelSignal?.cancelled
            ? "flow_cancelled"
            : "render_aborted",
          message: payload?.cancelSignal?.cancelled
            ? tr("capture.flow.err.cancelled", "Capture flow cancelled.")
            : tr("python.render.err.aborted", "Render was aborted."),
        };
      }

      if (e?.code === "render_timeout") {
        return {
          ok: false,
          error: "render_timeout",
          message: tr("python.render.err.timeout", "Render timed out."),
          detail: e?.detail || { timeoutMs },
        };
      }

      if (e?.code === "flow_cancelled") {
        return {
          ok: false,
          error: "flow_cancelled",
          message: tr("capture.flow.err.cancelled", "Capture flow cancelled."),
        };
      }

      return {
        ok: false,
        error: "python_unreachable",
        message: tr("python.err.unreachable", "Python server is unreachable."),
        detail: String(e),
      };
    } finally {
      unregisterController();
      unbindCancel();
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
          error: "render_request_failed",
          message: tr(
            "python.render.err.request_failed",
            "Render request failed.",
          ),
        },
        json,
      );
    }

    const previewUrl =
      base +
      "/preview/session?api_key=" +
      encodeURIComponent(PYTHON_API_KEY) +
      "&session_folder=" +
      encodeURIComponent(sessionFolder) +
      "&v=" +
      Date.now();

    json.preview_url = previewUrl;
    return json;
  };

  /* ===========================================================
   * CAPTURE FLOW UTILS
   * ===========================================================
   * Kleine Brückenfunktionen für capture_flow.js. Diese Methoden hängen
   * technisch an der API-Schicht, werden aber bewusst für den Flow als
   * Hilfsmittel bereitgestellt.
   */
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
      "[PB.captureFlow]",
      tr(
        "capture.flow.warn.liveview_recovery_timeout",
        "LiveView recovery timeout.",
      ),
    );
    return false;
  };

  /* ===========================================================
   * PREVIEW SICHER STARTEN
   * ===========================================================
   * Preview/LiveView soll für den Benutzer möglichst schnell wieder da
   * sein, darf den Flow aber nicht endlos blockieren. Deshalb wird hier
   * bewusst "best effort" gearbeitet.
   */
  PB.ensurePreviewReady = async function (opts) {
    opts = opts || {};
    const timeoutMs = opts.timeoutMs ?? 3000;

    // LiveView sofort starten (idempotent)
    PB.captureApi?.liveviewStart?.().catch(() => {});

    // nur ein schneller Check, kein langes Warten
    const r = await PB.captureApi.waitForFrames(400);
    if (r?.ok === true) return true;

    console.warn(
      "[PB.ensurePreviewReady]",
      tr(
        "capture.preview.warn.non_blocking_continue",
        "Preview not ready yet — continuing without blocking.",
      ),
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
   * ===========================================================
   * Standard-Druckpfad für fertig gerenderte Bilder. Auch hier werden
   * Timeouts, Abbruch und Antwort-Normalisierung zentral behandelt.
   *
   * Wichtig zur Architektur:
   *   - Gedruckt wird nicht aus der Kamera-Pipeline heraus.
   *   - Der Druck erhält nur das fertige Bild, die Event-Datei und die
   *     gewünschte Kopienzahl.
   *   - Dadurch bleibt die Trennung sauber: Kamera -> Rendern -> Drucken.
   */
  /**
   * Druckt ein Bild über /print/default
   * Erwartet:
   *   payload.image_path  → Pfad zum Bild (required)
   *   payload.event_file  → Pfad zur Event-Datei (required)
   *   payload.copies      → optional (default 1, max 20)
   *   payload.printerName → optional (Printername)
   */
  // Druckt eine fertige Datei über den Python-Service.
  // Der Capture-Flow übergibt hier nur noch fertige Daten wie Bildpfad,
  // Event-Datei und gewünschte Kopienzahl.
  PB.captureApi.printDefault = async function (payload) {
    const imagePath = String(payload?.image_path || "").trim();
    const eventFile = String(payload?.event_file || "").trim();
    const printerName =
      String(payload?.printerName || payload?.printer_name || "").trim() ||
      null;

    if (!imagePath) {
      return {
        ok: false,
        error: "missing_image_path",
        message: tr(
          "python.print.err.missing_image_path",
          "Missing image path.",
        ),
      };
    }
    if (!eventFile) {
      return {
        ok: false,
        error: "missing_event_file",
        message: tr(
          "python.print.err.missing_event_file",
          "Missing event file.",
        ),
      };
    }

    let copies = parseInt(payload?.copies ?? 1, 10);
    if (!Number.isFinite(copies) || copies < 1) copies = 1;
    if (copies > 20) copies = 20;

    const py_config = PB._getDeep?.(window.PB_CONFIG, "pythonServer") || {};
    const PYTHON_API_KEY = py_config.AuthKey;

    const base = String(PB.PYTHON_BASE || "").replace(/\/+$/g, "");
    const url = base + "/print/default";
    const timeoutMs = getPrintTimeoutMs(payload?.timeoutMs);

    const headers = {
      "Content-Type": "application/json",
      "X-Api-Key": PYTHON_API_KEY,
    };

    // Request-Body bewusst schlank halten: Der Python-Service soll genau
    // die finalen Druckdaten erhalten und nicht nochmals Flow-Logik kennen.
    const body = {
      image_path: imagePath,
      event_file: eventFile,
      copies: copies,
    };
    if (printerName) body.printerName = printerName;

    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const unregisterController = registerAbortController(controller);
    const unbindCancel = bindCancelSignal(controller, payload?.cancelSignal);

    let response;
    try {
      response = await raceWithGuards(
        fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller ? controller.signal : undefined,
        }),
        {
          timeoutMs,
          timeoutCode: "print_timeout",
          timeoutMessage: tr("python.print.err.timeout", "Print timed out."),
          cancelSignal: payload?.cancelSignal,
        },
      );
    } catch (e) {
      unregisterController();
      unbindCancel();

      if (e?.name === "AbortError") {
        return {
          ok: false,
          error: payload?.cancelSignal?.cancelled
            ? "flow_cancelled"
            : "print_aborted",
          message: payload?.cancelSignal?.cancelled
            ? tr("capture.flow.err.cancelled", "Capture flow cancelled.")
            : tr("python.print.err.aborted", "Print was aborted."),
        };
      }

      if (e?.code === "print_timeout") {
        return {
          ok: false,
          error: "print_timeout",
          message: tr("python.print.err.timeout", "Print timed out."),
          detail: e?.detail || { timeoutMs },
        };
      }

      if (e?.code === "flow_cancelled") {
        return {
          ok: false,
          error: "flow_cancelled",
          message: tr("capture.flow.err.cancelled", "Capture flow cancelled."),
        };
      }

      return {
        ok: false,
        error: "python_unreachable",
        message: tr("python.err.unreachable", "Python server is unreachable."),
        detail: String(e),
      };
    } finally {
      unregisterController();
      unbindCancel();
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
          error: "print_request_failed",
          message: tr(
            "python.print.err.request_failed",
            "Print request failed.",
          ),
        },
        json,
      );
    }

    try {
      const counterAfter = json?.counter_after;

      if (counterAfter != null) {
        window.PB_CONFIG = window.PB_CONFIG || {};
        window.PB_CONFIG.activeEvent = window.PB_CONFIG.activeEvent || {};
        window.PB_CONFIG.activeEvent.active_event =
          window.PB_CONFIG.activeEvent.active_event || {};

        const before = window.PB_CONFIG.activeEvent.active_event.print_counter;
        window.PB_CONFIG.activeEvent.active_event.print_counter = counterAfter;

        console.log("[printDefault] print_counter updated", {
          before,
          after: counterAfter,
        });

        $(document).trigger("pb:activeEventChanged", [
          {
            path: "activeEvent.active_event.print_counter",
            before,
            after: counterAfter,
            source: "printDefault",
          },
        ]);

        if (typeof PB.updateActiveEventUI === "function") {
          PB.updateActiveEventUI();
        }
      }
    } catch (e) {
      console.warn("[printDefault] updating UI/counter failed:", e);
    }

    return json;
  };
})();
