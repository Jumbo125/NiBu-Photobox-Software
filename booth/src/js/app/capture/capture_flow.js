// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * booth/js/capture_flow.js — Capture-Flow / Orchestrierung der Fotoserie
 * ---------------------------------------------------------------------
 * Rolle im Gesamtsystem:
 *   - Diese Datei ist die fachliche Ablaufsteuerung der kompletten Serie.
 *   - Hier wird entschieden, WANN Countdown, Capture, Rendern und Drucken
 *     passieren und welche UI dabei sichtbar ist.
 *
 * Architektur im Hintergrund:
 *   Browser / JS
 *     -> PB.bridge (Browser-Bridge)
 *     -> ApiServer
 *     -> Bridge Worker
 *     -> Kamera-SDK
 *
 * Wichtige Konsequenz daraus:
 *   - Diese Datei steuert den Ablauf, aber sie steuert NICHT direkt die
 *     Kamera-Hardware.
 *   - Ein einzelner Shot wird backendseitig als eigene Operation behandelt.
 *   - LiveView stoppen/starten, temporäre Kamera-Settings und serielle
 *     Kamera-Zugriffe werden im Worker abgesichert.
 *   - Rendern und Drucken laufen separat über den Python-Service.
 *
 * Grobe Reihenfolge:
 *   1) Start prüfen und Session aufbauen
 *   2) Preview vorbereiten / LiveView warm machen
 *   3) Countdown und Capture pro Slot
 *   4) session.json nach wichtigen Schritten aktualisieren
 *   5) Nach dem letzten Bild Rendern starten
 *   6) Optional automatisch drucken
 *   7) Finish-UI zeigen und Preview zurücksetzen
 *
 * Abgrenzung:
 *   - Technische API-Aufrufe liegen in capture_api.js
 *   - DOM-Startbindung liegt in capture_bindings.js
 *   - Diese Datei soll hauptsächlich Ablauf, Status und UX steuern
 *   - Backend/C# übernimmt die eigentliche Kamera-Transaktion
 */

(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  // Ensure namespaces exist early
  PB.captureFlow = PB.captureFlow || {};
  PB.captureFlow.utils = PB.captureFlow.utils || {};
  PB.captureFlow.ui = PB.captureFlow.ui || {};

  PB.sleep = PB.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));
  PB.showMsg = PB.showMsg || ((msg) => alert(msg));

  // i18n helper
  const pbT = (key, fallback) => (PB.t ? PB.t(key, fallback) : fallback);

  // simple {var} formatter (for messages like "{current}/{max}")
  const fmt = (str, vars) =>
    String(str || "").replace(/\{(\w+)\}/g, (_, k) =>
      vars && vars[k] != null ? String(vars[k]) : `{${k}}`,
    );

  PB.captureFlow.beforeCapture =
    PB.captureFlow.beforeCapture ||
    async function ({ slot, total, phase }) {
      // default: do nothing
      // phase: 'first' | 'between'
    };

  // -----------------------------------------------------------------------
  // CSS once: Buttons während Capture-Flow hart verstecken
  // -----------------------------------------------------------------------
  function ensureCaptureFlowCss() {
    if (document.getElementById("pb-capture-flow-style")) return;

    const style = document.createElement("style");
    style.id = "pb-capture-flow-style";
    style.textContent = `
body.pb-capture-running #btnTogglePreview,
body.pb-capture-running #btnLiveviewToggle {
  display: none !important;
}
`;
    document.head.appendChild(style);
  }

  ensureCaptureFlowCss();

  // -----------------------------------------------------------------------
  // UX: Pre-Capture Pause (nach Countdown, vor Capture)
  // -----------------------------------------------------------------------
  async function runBeforeCaptureHook(slot, total, phase, delaySeconds) {
    guardCancelled();

    const sec = Number(delaySeconds);

    if (typeof PB.captureFlow.beforeCapture === "function") {
      try {
        await PB.captureFlow.beforeCapture({
          slot,
          total,
          phase,
          delaySeconds: sec,
        });
      } catch (e) {
        console.warn("[beforeCapture] error", e);
      }
    }
  }

  async function preCapturePause(slot, total, phase, delaySeconds) {
    guardCancelled();

    const sec = Number(delaySeconds);
    const ms = Number.isFinite(sec) && sec > 0 ? Math.round(sec * 1000) : 0;

    await runBeforeCaptureHook(slot, total, phase, delaySeconds);

    if (ms > 0) {
      await PB.sleep(ms);
    }
  }

  // -----------------------------------------------------------------------
  // Snapshot Writer (PHP endpoint)
  // ---------------------------------------------------------
  // session.json ist das zentrale Übergabeobjekt zwischen Flow,
  // Rendern und Debugging. Deshalb wird an kritischen Stellen nicht nur
  // im Speicher gearbeitet, sondern der Stand aktiv weggeschrieben.
  // -----------------------------------------------------------------------
  PB.writeSessionSnapshot =
    PB.writeSessionSnapshot ||
    async function (folder, sessionObj) {
      const payload = {
        folder: String(folder || "").trim(),
        session: sessionObj || {},
      };

      if (typeof PB.postJson === "function") {
        return PB.postJson("api/session_snapshot.php", payload);
      }

      const r = await fetch("api/session_snapshot.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      let j = {};
      try {
        j = await r.json();
      } catch (_) {}
      if (!r.ok) return Object.assign({ ok: false, http: r.status }, j);
      return j;
    };

  // -----------------------------------------------------------------------
  // Fixed UI Helper
  // ---------------------------------------------------------
  // Kapselt die Overlay-/Layer-Steuerung für den Capture-Flow.
  // Andere Teile des Flows sollen nur noch sagen "zeige Zustand X" und
  // nicht jedes Mal selbst DOM-Details kennen müssen.
  // -----------------------------------------------------------------------
  PB.captureUI =
    PB.captureUI ||
    (function () {
      const ids = [
        "Capture_countdown",
        "Capture_working_trigger",
        "Capture_working_capture",
        "Capture_working_render",
        "Capture_working_abort",
        "Capture_error",
        "Capture_finish",
        "Capture_finish_with_img",
        "Capture_preview_between_shots",
      ];
      const $layers = ids.map((id) => $("#" + id));

      function hideAll() {
        $layers.forEach(($el) => $el.addClass("d-none"));
      }

      function show(id, opts) {
        opts = opts || {};
        hideAll();

        const $root = $("#" + id);
        if (!$root.length) return null;

        const $text = $root.find('[data-role="text"]').first();
        if ($text.length) {
          if (opts.html != null) $text.html(String(opts.html));
          else if (opts.text != null) $text.text(String(opts.text));
          else $text.text("");
        }

        const $counter = $root.find('[data-role="counter"]').first();
        if ($counter.length) {
          if (opts.counter != null) $counter.text(String(opts.counter));
          else $counter.text("");
        }

        const $img = $root.find('[data-role="image"]').first();
        if ($img.length) {
          const src = opts.imgSrc != null ? String(opts.imgSrc) : "";
          if (src) {
            $img.attr("src", src).removeClass("d-none");
          } else {
            $img.attr("src", "").addClass("d-none");
          }
        }

        const $cancel = $root.find('[data-role="cancel"]').first();
        if ($cancel.length) {
          $cancel.off("click.pbCaptureUI");
          if (typeof opts.onCancel === "function") {
            $cancel.on("click.pbCaptureUI", function (e) {
              e.preventDefault();
              e.stopPropagation();
              opts.onCancel();
            });
          }
        }

        const $close = $root.find('[data-role="close"]').first();
        if ($close.length) {
          $close.off("click.pbCaptureUI");
          if (typeof opts.onClose === "function") {
            $close.on("click.pbCaptureUI", function (e) {
              e.preventDefault();
              e.stopPropagation();
              opts.onClose();
            });
          }
        }

        $root.removeClass("d-none");
        return $root;
      }

      return { show, hideAll };
    })();

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------
  PB.sanitizeWinFolderName =
    PB.sanitizeWinFolderName ||
    function (name) {
      name = String(name || "").trim();
      name = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, "_");
      name = name.replace(/[ .]+$/g, "");
      return name || "Event";
    };

  PB.buildEventPath =
    PB.buildEventPath ||
    function (basePath, eventName) {
      const safe = PB.sanitizeWinFolderName(eventName);
      const p = String(basePath || "").replace(/[\/\\]+$/g, "");
      return p + "\\EVENTS\\" + safe;
    };

  function storeLastSessionData(renderRes) {
    const lastSession = {};

    const imagePath = renderRes?.output_path || renderRes?.outputPath || null;
    const previewUrl = renderRes?.preview_url || renderRes?.previewUrl || null;

    if (imagePath) lastSession.output_path = imagePath;
    if (previewUrl) lastSession.preview_url = previewUrl;

    window.PB_CONFIG = window.PB_CONFIG || {};
    window.PB_CONFIG.lastSession = lastSession;

    return window.PB_CONFIG.lastSession;
  }

  function getRequiredPrintCount() {
    const raw = PB._getDeep?.(
      window.PB_CONFIG,
      "activeEvent.active_event.multiple_print",
    );

    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  function getCachedRemainingPrintCount() {
    const raw = PB._getDeep?.(window.PB_CONFIG, "general.dnp.remainingPrints");
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }

  // Prüft den zuletzt bekannten Papierstand ohne neuen API-Aufruf.
  // Diese Funktion wird als schneller Vorab-Check verwendet, bevor später
  // der echte DNP-Status geprüft wird.
  function getCachedPaperShortageResult(requiredCountOverride) {
    const remainingPrints = getCachedRemainingPrintCount();
    const override = parseInt(requiredCountOverride, 10);
    const requiredPrintCount =
      Number.isFinite(override) && override > 0
        ? override
        : getRequiredPrintCount();

    if (
      !Number.isFinite(remainingPrints) ||
      !Number.isFinite(requiredPrintCount) ||
      requiredPrintCount <= 0
    ) {
      return null;
    }

    if (remainingPrints < requiredPrintCount) {
      return {
        ok: false,
        error: "paper_not_enough",
        message: fmt(
          pbT(
            "capture.flow.err.paper_not_enough",
            "Printing is not possible. Only {remaining} prints are remaining, but {required} are required.",
          ),
          {
            remaining: remainingPrints,
            required: requiredPrintCount,
          },
        ),
        remainingPrints,
        requiredPrintCount,
        usedCachedRemainingPrints: true,
      };
    }

    return {
      ok: true,
      remainingPrints,
      requiredPrintCount,
      usedCachedRemainingPrints: true,
    };
  }


  // Zentrale Papierprüfung vor jedem Druck.
  // Bevorzugt den aktuellen API-Wert, fällt bei 429 / timer_too_short aber
  // kontrolliert auf den gecachten Wert zurück.
  async function checkPaperBeforePrint(requiredCountOverride) {
    const dnpRes =
      typeof PB._getDnpPaperState === "function"
        ? await PB._getDnpPaperState()
        : { ok: false, error: "dnp_state_function_missing" };

    const apiRemainingPrints = parseInt(
      dnpRes?.dnp?.remainingPrints ?? dnpRes?.raw?.["Remaining prints"],
      10,
    );
    const cachedRemainingPrints = parseInt(
      PB._getDeep?.(window.PB_CONFIG, "general.dnp.remainingPrints"),
      10,
    );

    const statusCode = Number(
      dnpRes?.status ?? dnpRes?.http ?? dnpRes?.httpStatus ?? dnpRes?.response?.status,
    );
    const errorCode = String(dnpRes?.error || "").toLowerCase();
    const isTooManyRequests =
      statusCode === 429 ||
      errorCode === "timer_too_short" ||
      errorCode === "too_many_requests";

    const remainingPrints = Number.isFinite(apiRemainingPrints)
      ? apiRemainingPrints
      : isTooManyRequests && Number.isFinite(cachedRemainingPrints)
        ? cachedRemainingPrints
        : NaN;

    const override = parseInt(requiredCountOverride, 10);
    const requiredPrintCount =
      Number.isFinite(override) && override > 0
        ? override
        : getRequiredPrintCount();

    if (!dnpRes?.ok && !(isTooManyRequests && Number.isFinite(cachedRemainingPrints))) {
      return {
        ok: false,
        error: "paper_status_unavailable",
        message: pbT(
          "capture.flow.err.paper_status_unavailable",
          "Printing is not possible. Paper status could not be determined.",
        ),
        response: dnpRes,
      };
    }

    if (Number.isFinite(remainingPrints) && remainingPrints <= 0) {
      return {
        ok: false,
        error: "paper_empty",
        message: pbT(
          "capture.flow.err.paper_empty",
          "Printing is not possible. The paper is empty.",
        ),
        remainingPrints,
        response: dnpRes,
      };
    }

    if (
      Number.isFinite(remainingPrints) &&
      Number.isFinite(requiredPrintCount) &&
      requiredPrintCount > 0 &&
      remainingPrints < requiredPrintCount
    ) {
      return {
        ok: false,
        error: "paper_not_enough",
        message: fmt(
          pbT(
            "capture.flow.err.paper_not_enough",
            "Printing is not possible. Only {remaining} prints are remaining, but {required} are required.",
          ),
          {
            remaining: remainingPrints,
            required: requiredPrintCount,
          },
        ),
        remainingPrints,
        requiredPrintCount,
        response: dnpRes,
      };
    }

    return {
      ok: true,
      remainingPrints: Number.isFinite(remainingPrints) ? remainingPrints : null,
      requiredPrintCount:
        Number.isFinite(requiredPrintCount) ? requiredPrintCount : null,
      usedCachedRemainingPrints:
        !Number.isFinite(apiRemainingPrints) &&
        isTooManyRequests &&
        Number.isFinite(cachedRemainingPrints),
      response: dnpRes,
    };
  }

  function isPaperEmptyError(res) {
    const error = String(res?.error || "").toLowerCase();
    const message = String(res?.message || "").toLowerCase();

    return (
      error === "paper_empty" ||
      error === "paper_not_enough" ||
      error === "no_paper" ||
      error === "out_of_paper" ||
      message.includes("no paper") ||
      message.includes("paper empty") ||
      message.includes("out of paper") ||
      message.includes("not enough paper")
    );
  }

  async function showCaptureErrorMessage(text) {
    const msg =
      String(text || "").trim() ||
      pbT(
        "capture.flow.err.paper_empty",
        "Printing is not possible. The paper is empty.",
      );

    return new Promise((resolve) => {
      PB.captureUI.show("Capture_error", {
        text: msg,
        onClose: () => {
          PB.captureUI.hideAll();
          resolve({ ok: true });
        },
      });
    });
  }

  // Reprint-Funktion für das zuletzt gerenderte Ergebnis.
  // Bewusst getrennt vom eigentlichen Serienablauf, damit Reprint später
  // auch separat vom UI ausgelöst werden kann.
  PB.printLastSession =
    PB.printLastSession ||
    async function () {
      if (PB._reprintBusy) {
        return { ok: false, error: "reprint_busy" };
      }

      PB._reprintBusy = true;

      try {
        if (!PB.captureApi || typeof PB.captureApi.printDefault !== "function") {
          return {
            ok: false,
            error: "print_api_missing",
            message: pbT(
              "capture.flow.err.print_api_missing",
              "Print API is not available.",
            ),
          };
        }

        const allowReprint = PB.readBool(
          PB._getDeep(window.PB_CONFIG, "activeEvent.active_event.allow_reprint"),
        );

        if (!allowReprint) {
          return {
            ok: false,
            error: "reprint_not_allowed",
            message: pbT(
              "capture.flow.err.reprint_not_allowed",
              "Reprint is not allowed for this event.",
            ),
          };
        }

        const last = window.PB_CONFIG?.lastSession || {};
        const imagePath = last.output_path || last.outputPath || null;
        const eventConfigPath =
          String(
            PB._getDeep(
              window.PB_CONFIG,
              "activeEvent.active_event.config_path",
              "",
            ) || "",
          )
            .trim()
            .replace(/[\/\\]+$/g, "") || null;
        const printerName =
          String(
            PB._getDeep(window.PB_CONFIG, "general.printer.printerName") || "",
          ).trim() || null;

        if (!imagePath || !eventConfigPath) {
          return {
            ok: false,
            error: "last_session_missing",
            message: pbT(
              "capture.flow.err.last_session_missing",
              "No previous session is available for reprint.",
            ),
          };
        }

        const paperCheck = await checkPaperBeforePrint(1);
        if (!paperCheck.ok) {
          return paperCheck;
        }

        const printPayload = {
          image_path: imagePath,
          event_file: eventConfigPath,
          copies: 1,
        };

        if (printerName) {
          printPayload.printerName = printerName;
        }

        return PB.captureApi.printDefault(printPayload);
      } catch (e) {
        return {
          ok: false,
          error: "reprint_failed",
          message: e?.message || String(e),
        };
      } finally {
        PB._reprintBusy = false;
      }
    };

  $(document)
    .off("click.pbReprint", "#print_again")
    .on("click.pbReprint", "#print_again", async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const $btn = $(this);
      const oldDisabled = $btn.prop("disabled");
      $btn.prop("disabled", true);

      try {
        const res = await PB.printLastSession();

        if (!res?.ok) {
          PB.captureUI.show("Capture_error", {
            text:
              res?.message ||
              pbT("capture.flow.err.reprint_failed", "Reprint failed."),
            onClose: () => PB.captureUI.hideAll(),
          });
        }
      } finally {
        $btn.prop("disabled", oldDisabled);
      }
    });

  async function ensureViewStreamVisible(wantStream) {
    if (
      !PB.preview ||
      typeof PB.preview.isStreamVisible !== "function" ||
      typeof PB.preview.toggleView !== "function"
    ) {
      return;
    }

    const isOn = !!PB.preview.isStreamVisible();
    if (wantStream && !isOn) await PB.preview.toggleView();
    if (!wantStream && isOn) await PB.preview.toggleView();
  }

  async function ensurePreviewRunning() {
    if (PB.preview && typeof PB.preview.ensureRunning === "function") {
      await PB.preview.ensureRunning();
    }
  }

  async function showFinishWithOptionalImage({
    text,
    imgUrl,
    closeAfterSeconds,
  }) {
    const secRaw = Number(closeAfterSeconds);
    const timeoutMs =
      Number.isFinite(secRaw) && secRaw > 0 ? Math.round(secRaw * 1000) : 0;

    return new Promise((resolve) => {
      let done = false;
      let t = null;
      let i = null;

      const finish = (why) => {
        if (done) return;
        done = true;
        if (t) clearTimeout(t);
        if (i) clearInterval(i);
        PB.captureUI.hideAll();
        resolve({ ok: true, why });
      };

      PB.captureUI.show("Capture_finish_with_img", {
        text: text || "",
        imgSrc: imgUrl || "",
        onClose: () => finish("close"),
      });

      if (timeoutMs > 0) t = setTimeout(() => finish("timeout"), timeoutMs);

      i = setInterval(() => {
        if (cancelled) finish("cancel");
      }, 150);
    });
  }

  async function showPreviewBetweenShotsImage({
    imgUrl,
    closeAfterSeconds,
  }) {
    const secRaw = Number(closeAfterSeconds);
    const timeoutMs =
      Number.isFinite(secRaw) && secRaw > 0 ? Math.round(secRaw * 1000) : 0;

    return new Promise((resolve) => {
      let done = false;
      let t = null;
      let i = null;

      const finish = (why) => {
        if (done) return;
        done = true;
        if (t) clearTimeout(t);
        if (i) clearInterval(i);
        PB.captureUI.hideAll();
        resolve({ ok: true, why });
      };

      PB.captureUI.show("Capture_preview_between_shots", {
        imgSrc: imgUrl || "",
      });

      if (timeoutMs > 0) t = setTimeout(() => finish("timeout"), timeoutMs);

      i = setInterval(() => {
        if (cancelled) finish("cancel");
      }, 150);
    });
  }

  function getPreviewImgTimeSeconds() {
    const raw = PB._getDeep?.(window.PB_CONFIG, "general.capture.preview_img_time");

    if (raw == null || String(raw).trim() === "") return 1;

    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) return 1;
    if (n === 0) return 0;

    return n > 0 ? n : 1;
  }

  function getFasterCaptureEffectMs() {
    const raw = PB._getDeep?.(
      window.PB_CONFIG,
      "general.capture.setting_faster_capture_effect",
    );

    if (raw == null || String(raw).trim() === "") return 500;

    const n = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(n)) return 500;

    return Math.max(0, Math.round(n));
  }

  function captureFileToPreviewUrl(filePath) {
    const p = String(filePath || "").replace(/\\/g, "/");
    const marker = "/.ACTIVE_SESSION_TMP/TMP_BILDER/";
    const idx = p.lastIndexOf(marker);
    if (idx < 0) return null;

    return p.slice(idx) + "?v=" + Date.now();
  }

  async function waitUntilImageLoads(url, timeoutMs) {
    const ms = Number(timeoutMs);
    const effectiveTimeout = Number.isFinite(ms) && ms > 0 ? ms : 1200;

    return new Promise((resolve) => {
      const img = new Image();
      let done = false;

      const finish = (ok) => {
        if (done) return;
        done = true;
        resolve(!!ok);
      };

      const t = setTimeout(() => finish(false), effectiveTimeout);

      img.onload = () => {
        clearTimeout(t);
        finish(true);
      };

      img.onerror = () => {
        clearTimeout(t);
        finish(false);
      };

      img.src = String(url || "");
    });
  }

  async function waitForUiPaint() {
    await new Promise((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(resolve)),
    );
  }

  function createTrackedPromise(promise) {
    const tracked = {
      status: "pending",
      value: undefined,
      error: undefined,
      promise: Promise.resolve(promise)
        .then((value) => {
          tracked.status = "fulfilled";
          tracked.value = value;
          return value;
        })
        .catch((error) => {
          tracked.status = "rejected";
          tracked.error = error;
          throw error;
        }),
    };

    return tracked;
  }

  // -----------------------------------------------------------------------
  // Flow State
  // ---------------------------------------------------------
  // running/cancelled/currentRun bilden den minimalen Laufzeitzustand des
  // aktuellen Flows. Damit werden Doppelstarts, Cancel und das Verteilen
  // des Cancel-Signals auf Unteroperationen gesteuert.
  // -----------------------------------------------------------------------
  let running = false;
  let cancelled = false;
  let currentRun = null;

  function createCancelledError() {
    const e = new Error("__CANCELLED__");
    e.__cancelled = true;
    e.code = "flow_cancelled";
    return e;
  }

  // Erzeugt ein simples Cancel-Signal-Objekt für genau einen Flow-Lauf.
  // Unterfunktionen können sich darauf registrieren, ohne globale Variablen
  // oder DOM-Events direkt beobachten zu müssen.
  function createRunContext() {
    const listeners = new Set();

    return {
      cancelled: false,
      reason: null,
      onCancel(fn) {
        if (typeof fn !== "function") return () => {};

        if (this.cancelled) {
          fn(this.reason || createCancelledError());
          return () => {};
        }

        listeners.add(fn);
        return () => listeners.delete(fn);
      },
      cancel() {
        if (this.cancelled) return;

        this.cancelled = true;
        this.reason = this.reason || createCancelledError();

        listeners.forEach((fn) => {
          try {
            fn(this.reason);
          } catch (_) {}
        });

        listeners.clear();
      },
    };
  }

  function getActiveCancelSignal() {
    return currentRun || null;
  }

  PB.captureFlow.isRunning = PB.captureFlow.isRunning || (() => running);

  // Cancel auf Flow-Ebene:
  // - stoppt weitere Schritte des Serienablaufs
  // - bricht laufende Render-/Print-Requests im Browser aktiv ab
  // - ein bereits gestarteter Einzel-Capture im Worker läuft dabei in der
  //   Regel kontrolliert zu Ende, weil jeder Shot backendseitig separat
  //   ausgeführt wird
  PB.captureFlow.cancel =
    PB.captureFlow.cancel ||
    async function () {
      if (!running) return;
      cancelled = true;

      if (currentRun) {
        currentRun.cancel();
      }

      if (PB.captureApi?.abortActiveOperations) {
        PB.captureApi.abortActiveOperations("flow_cancelled");
      }

      PB.captureUI.show("Capture_working_abort");
      await PB.sleep(300);

      await restorePreviewAfterFlow();
      PB.captureFlow.ui.setStartAreaVisible(true);
      PB.captureFlow.ui.setCaptureButtonsVisible(true);

      PB.captureUI.hideAll();
      running = false;
      currentRun = null;
    };

  function guardCancelled() {
    if (!cancelled) return;
    throw createCancelledError();
  }

  // -----------------------------------------------------------------------
  // Utils (ensure exists)
  // -----------------------------------------------------------------------
  PB.captureFlow.utils.waitForPreviewFramePaint =
    PB.captureFlow.utils.waitForPreviewFramePaint ||
    async function ({
      timeoutMs = 2500,
      intervalMs = 50,
      iframeId = "liveFrame",
      imgSelector = "img#lv, img#mjpg, img#stream, img",
    } = {}) {
      const t0 = Date.now();
      const sleep = PB.sleep || ((ms) => new Promise((r) => setTimeout(r, ms)));

      const nextPaint = () =>
        new Promise((r) =>
          requestAnimationFrame(() => requestAnimationFrame(r)),
        );

      while (Date.now() - t0 < timeoutMs) {
        const frame = document.getElementById(iframeId);
        if (frame) {
          try {
            const doc = frame.contentDocument || frame.contentWindow?.document;
            const img = doc?.querySelector(imgSelector) || null;

            if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
              await nextPaint();
              return { ok: true };
            }
          } catch (_) {}
        }
        await sleep(intervalMs);
      }

      await nextPaint();
      return { ok: false, reason: "timeout" };
    };

  async function waitForPreviewReady(timeoutMs, settleMs) {
    guardCancelled();

    const visible =
      !PB.preview ||
      typeof PB.preview.isStreamVisible !== "function" ||
      PB.preview.isStreamVisible() === true;

    if (!visible) {
      return { ok: false, reason: "preview_hidden" };
    }

    const vis = await PB.captureFlow.utils
      .waitForPreviewFramePaint({ timeoutMs: timeoutMs || 1200 })
      .catch(() => ({ ok: false }));

    if (vis?.ok) {
      await PB.sleep(Number(settleMs || 200));
      return { ok: true };
    }

    await PB.sleep(120);
    return vis || { ok: false };
  }

  // -----------------------------------------------------------------------
  // UI: Start-Area (Startscreen) ein-/ausblenden
  // -----------------------------------------------------------------------
  PB.captureFlow.ui.setStartAreaVisible =
    PB.captureFlow.ui.setStartAreaVisible ||
    function (visible) {
      const el = document.getElementById("start-area");
      if (!el) return;
      if (visible) el.classList.remove("d-none");
      else el.classList.add("d-none");
    };

  // -----------------------------------------------------------------------
  // UI: Buttons bei Capture-Start ausblenden
  // -----------------------------------------------------------------------
  PB.captureFlow.ui.setCaptureButtonsVisible = function (visible) {
    const ids = ["btnTogglePreview", "btnLiveviewToggle"];

    document.body.classList.toggle("pb-capture-running", !visible);

    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.toggle("d-none", !visible);
    });
  };

  // -----------------------------------------------------------------------
  // UX: Pre-Countdown Orientierung
  // -----------------------------------------------------------------------
  async function preCountdownPause() {
    guardCancelled();
    await PB.sleep(800);
  }

  // -----------------------------------------------------------------------
  // Countdown (User-Zeit)
  // -----------------------------------------------------------------------
  // Universeller Countdown für erstes Bild und Zwischenbilder.
  // Unterstützt optional einen "frühen" Trigger, damit der eigentliche
  // Capture-Aufruf kurz vor Ende des Countdowns schon anlaufen kann.
  async function flowCountdown(seconds, phase, options) {
    let n = Number(seconds || 0);
    if (!Number.isFinite(n) || n < 0) n = 0;

    const opts = options || {};
    const onEarlyTrigger =
      typeof opts.onEarlyTrigger === "function" ? opts.onEarlyTrigger : null;
    const fasterEffectMs = Math.max(
      0,
      Number.isFinite(Number(opts.earlyTriggerMs))
        ? Math.round(Number(opts.earlyTriggerMs))
        : getFasterCaptureEffectMs(),
    );

    let earlyTask = null;
    let earlyTriggered = false;

    const totalMs = Math.max(0, n * 1000);
    const earlyOffsetMs = Math.min(fasterEffectMs, totalMs);
    const earlyAtMs = Math.max(0, totalMs - earlyOffsetMs);

    const start_text =
      PB._getDeep(PB_CONFIG, "general.capture.text_starting") ||
      pbT("capture.flow.text.starting", "Starting…");

    const between_text =
      PB._getDeep(PB_CONFIG, "general.capture.text_next_photo") ||
      pbT("capture.flow.text.next_photo", "Next photo…");

    const title =
      phase === "first" ? start_text : phase === "between" ? between_text : "";

    for (let s = n; s >= 1; s--) {
      guardCancelled();

      PB.captureUI.show("Capture_countdown", {
        text: title,
        counter: s,
        onCancel: () => PB.captureFlow.cancel(),
      });

      $(document).trigger("pb:captureCountdown", [
        { sec: s, phase: phase || "" },
      ]);

      const elapsedBeforeThisSecond = (n - s) * 1000;
      const elapsedAfterThisSecond = elapsedBeforeThisSecond + 1000;
      const shouldTriggerInThisSecond =
        !earlyTriggered &&
        onEarlyTrigger &&
        earlyOffsetMs > 0 &&
        earlyAtMs >= elapsedBeforeThisSecond &&
        earlyAtMs < elapsedAfterThisSecond;

      if (shouldTriggerInThisSecond) {
        const waitBeforeTriggerMs = Math.max(
          0,
          earlyAtMs - elapsedBeforeThisSecond,
        );
        const waitAfterTriggerMs = Math.max(0, 1000 - waitBeforeTriggerMs);

        if (waitBeforeTriggerMs > 0) {
          await PB.sleep(waitBeforeTriggerMs);
        }

        earlyTask = createTrackedPromise(onEarlyTrigger());
        earlyTask.promise.catch(() => {});
        earlyTriggered = true;

        if (waitAfterTriggerMs > 0) {
          await PB.sleep(waitAfterTriggerMs);
        }
      } else {
        await PB.sleep(1000);
      }
    }

    if (!earlyTriggered && onEarlyTrigger && earlyOffsetMs > 0) {
      earlyTask = createTrackedPromise(onEarlyTrigger());
      earlyTask.promise.catch(() => {});
    }

    PB.captureUI.hideAll();
    return { earlyTask };
  }

  // -----------------------------------------------------------------------
  // Preview Prepare / Restore (LiveView nur an den Flow-Grenzen)
  // -----------------------------------------------------------------------
  // Bereitet LiveView/Preview direkt vor dem Serienstart vor.
  // Wichtig: "API sagt ok" bedeutet noch nicht automatisch, dass im Browser
  // schon echte Frames sichtbar sind. Deshalb wird hier sowohl backendseitig
  // auf Frames als auch frontendseitig auf ein tatsächlich gemaltes Bild
  // gewartet.
  //
  // Der erste Start ist absichtlich toleranter, weil Kaltstarts mehr Zeit
  // brauchen als spätere Wiederanläufe innerhalb derselben Sitzung.
  async function preparePreviewForSeries() {
  const isFirstLiveviewWarmup = PB.captureFlow._liveviewWarm !== true;

  // Beim ersten Start deutlich großzügiger sein
  const frameTimeout = isFirstLiveviewWarmup ? 12000 : 5000;
  const previewTimeout = isFirstLiveviewWarmup ? 8000 : 4000;
  const previewSettleMs = isFirstLiveviewWarmup ? 600 : 350;
  const startPauseMs = isFirstLiveviewWarmup ? 1000 : 350;

  async function bootOnce() {
    await ensureViewStreamVisible(true).catch(() => {});
    await ensurePreviewRunning().catch(() => {});

    const startRes = await PB.captureApi.liveviewStart().catch((error) => ({
      ok: false,
      error,
    }));

    if (!startRes || startRes.ok !== true) {
      throw (
        startRes?.error ||
        new Error("LiveView could not be started before capture flow.")
      );
    }

    // Wichtig: API kann schon ok sein, obwohl im Browser noch keine echten Frames da sind
    await PB.sleep(startPauseMs);

    const framesRes =
      typeof PB.captureApi.waitForFrames === "function"
        ? await PB.captureApi.waitForFrames(frameTimeout).catch((error) => ({
            ok: false,
            error,
          }))
        : { ok: true, skipped: true };

    if (!framesRes || framesRes.ok !== true) {
      const err =
        framesRes?.error ||
        new Error(
          `Timed out waiting for live-view frames before capture flow. timeout=${frameTimeout}ms`,
        );
      err.code = err.code || "frames_time_out";
      throw err;
    }

    const previewReady = await waitForPreviewReady(
      previewTimeout,
      previewSettleMs,
    ).catch((error) => ({
      ok: false,
      error,
    }));

    if (!previewReady || previewReady.ok !== true) {
      throw (
        previewReady?.error ||
        new Error(
          `LiveView preview was not ready before capture flow. timeout=${previewTimeout}ms`,
        )
      );
    }

    PB.captureFlow._liveviewWarm = true;
    return { ok: true };
  }

  try {
    return await bootOnce();
  } catch (firstErr) {
    console.warn(
      "[captureFlow] preparePreviewForSeries first attempt failed, retrying once...",
      firstErr,
    );

    // Einmal sauber resetten und neu probieren
    await PB.captureApi.liveviewStop?.().catch(() => {});
    await PB.sleep(700);

    try {
      return await bootOnce();
    } catch (secondErr) {
      console.error(
        "[captureFlow] preparePreviewForSeries failed after retry",
        secondErr,
      );
      throw secondErr;
    }
  }
}
  async function restorePreviewAfterFlow() {
    const wasStream = PB.captureFlow._previewWasStream === true;

    if (wasStream) {
      await PB.captureApi.liveviewStart().catch(() => {});
      await ensureViewStreamVisible(true).catch(() => {});
    } else {
      await PB.captureApi.liveviewStop().catch(() => {});
      await ensureViewStreamVisible(false).catch(() => {});
    }
  }

  // -----------------------------------------------------------------------
  // Snapshot helper
  // -----------------------------------------------------------------------
  async function snapshotWrite(session) {
    const folder = String(
      session?.captureFolderHint || PB.CAPTURE_TMP_DIR || "",
    ).trim();
    if (!folder) return { ok: false, error: "missing_captureFolderHint" };

    session.updatedAt = new Date().toISOString();

    return PB.writeSessionSnapshot(folder, session).catch((err) => {
      console.warn("[snapshot] write failed:", err?.message || err);
      return { ok: false, error: "snapshot_write_failed" };
    });
  }

  async function requireSnapshotWrite(session, code, fallbackMessage) {
    const res = await snapshotWrite(session);

    if (res?.ok) return res;

    const err = new Error(
      fallbackMessage ||
        pbT(
          "capture.flow.err.snapshot_write_failed",
          "Session snapshot could not be written.",
        ),
    );
    err.code = code || "snapshot_write_failed";
    err.detail = res;
    throw err;
  }

  // -----------------------------------------------------------------------
  // Fehler-Code Helper
  // -----------------------------------------------------------------------
  function getCaptureErrorText(err) {
    const raw = err?.message || String(err || "");

    let obj = null;

    if (err && typeof err === "object") {
      obj = err;
    }

    if (
      !obj ||
      (!obj.errorCode && !obj.code && !obj.detail && !obj.errorMessage)
    ) {
      const jsonMatch = raw.match(/\{[\s\S]*\}$/);
      if (jsonMatch) {
        try {
          obj = JSON.parse(jsonMatch[0]);
        } catch (_) {}
      }
    }

    let code = obj?.errorCode || obj?.code || null;

    const codeAliasMap = {
      camera_unable_to_focus: "cannot_focus",
      device_busy_camera: "device_busy",
      capture_timeout: "timeout",
    };

    if (code && codeAliasMap[code]) {
      code = codeAliasMap[code];
    }

    if (code) {
      const key = "bridge.error." + String(code).trim();
      const translated = pbT(key, "__MISSING__");

      if (translated !== "__MISSING__") {
        return translated;
      }

      return String(code);
    }

    if (obj?.detail) {
      return String(obj.detail);
    }

    if (obj?.errorMessage) {
      return String(obj.errorMessage);
    }

    const status =
      obj?.status ||
      err?.status ||
      err?.httpStatus ||
      err?.response?.status ||
      err?.xhr?.status ||
      null;

    if (status && /^4\d\d$/.test(String(status))) {
      return `HTTP ${status}`;
    }

    const httpMatch = raw.match(/\b(4\d\d)\b/);
    if (httpMatch) {
      return `HTTP ${httpMatch[1]}`;
    }

    return raw || "Unknown error";
  }

  // -----------------------------------------------------------------------
  // Main Start
  // ---------------------------------------------------------
  // Herzstück des fachlichen Flows. Ab hier wird aus den vorbereiteten
  // Startdaten ein kompletter Lauf von Capture bis optionalem Druck.
  //
  // Vereinfacht gesagt macht diese Funktion Folgendes:
  //   - Session initialisieren
  //   - Preview/LiveView vor dem ersten Bild sicher bereitstellen
  //   - für jeden Fotoslot einen eigenen Capture auslösen
  //   - nach jedem relevanten Schritt session.json schreiben
  //   - nach dem letzten Bild Rendern und optional Drucken
  //   - danach Finish-UI zeigen und den Startzustand wiederherstellen
  //
  // Jeder einzelne Shot ist dabei ein eigener Backend-Aufruf. Diese Datei
  // orchestriert also die Serie, während der Worker die eigentliche Kamera-
  // Operation seriell und kameraspezifisch ausführt.
  // -----------------------------------------------------------------------
  PB.captureFlow.start = async function (required, photoTarget) {
    if (running) return;

    if (!PB.captureApi) {
      throw new Error(
        pbT(
          "capture.flow.err.capture_api_missing",
          "PB.captureApi is missing (load capture_api.js).",
        ),
      );
    }

    const r = required || {};
    PB.captureFlow._lastRequired = r;

    const target = Number(photoTarget || 0);
    if (!Number.isFinite(target) || target <= 0) {
      PB.showMsg(
        pbT(
          "capture.flow.err.invalid_photo_target",
          "Invalid photo count (photoTarget).",
        ),
        "warning",
      );
      return null;
    }

    const CFG = window.PB_CONFIG || {};

    const maxPrintsRaw = PB._getDeep(
      CFG,
      "activeEvent.active_event.max_prints",
    );
    const curPrintsRaw = PB._getDeep(
      CFG,
      "activeEvent.active_event.print_counter",
    );

    let max_prints = parseInt(maxPrintsRaw ?? 0, 10);
    let current_prints = parseInt(curPrintsRaw ?? 0, 10);

    if (!Number.isFinite(max_prints) || max_prints < 0) max_prints = 0;
    if (!Number.isFinite(current_prints) || current_prints < 0)
      current_prints = 0;

    if (max_prints > 0 && current_prints >= max_prints) {
      const msg = fmt(
        pbT(
          "capture.flow.err.max_prints_reached",
          "Maximum reached ({current}/{max}).",
        ),
        { current: current_prints, max: max_prints },
      );

      PB.captureUI.show("Capture_error", {
        text: msg,
        onClose: () => PB.captureUI.hideAll(),
      });
      return null;
    }

    running = true;
    cancelled = false;
    currentRun = createRunContext();

    PB.captureFlow._previewWasStream =
      PB.preview && typeof PB.preview.isStreamVisible === "function"
        ? PB.preview.isStreamVisible() === true
        : false;

    PB.captureFlow.ui.setStartAreaVisible(false);
    PB.captureFlow.ui.setCaptureButtonsVisible(false);

    const filePrefix = String(PB.CAPTURE_TMP_Prefix || "Photo_");
    const nowIso = () => new Date().toISOString();

    // session ist das zentrale Laufzeitobjekt dieser Serie.
    // Es dient gleichzeitig als Debug-/Statusobjekt und als Grundlage für
    // session.json, die später vom Python-Renderpfad gelesen wird.
    const session = {
      id: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),

      status: "INIT",
      progress: { done: 0, total: target },

      eventPath: PB.buildEventPath(r.path, r.eventName),

      photoTarget: target,
      expectedFiles: Array.from(
        { length: target },
        (_, i) => `${filePrefix}${i + 1}`,
      ),
      photos: [],

      render: {
        template: r.activeTemplateXml,
        output_collage: PB.buildEventPath(r.path, r.eventName) + "\\finals",
        output_originals:
          PB.buildEventPath(r.path, r.eventName) + "\\originals",
        prefix: "collage_",
        ext: "jpg",
        render_config: r.renderConfig,
        render_config_inline: null,
        return_image: r.show_finish_image,
      },

      error: null,

      schemaVersion: 1,
      startedAt: nowIso(),
      eventName: r.eventName,
      basePath: r.path,

      captureFolderHint: String(PB.CAPTURE_TMP_DIR || "").trim(),

      print: {
        multiplePrint: r.multiplePrint,
        printCounter: r.printCounter,
        autoPrint: r.autoPrint,
        silentPrint: r.silentPrint,
        printerCount: r.printerCount,
      },

      camera: {
        useSettings: !!r.useSettings,
        iso: r.iso,
        shutter: r.shutter,
        wb: r.wb,
      },
    };

    let renderRes;
    let pendingPaperEmptyMessage = null;

    try {
      $(document).trigger("pb:captureSessionStarted", [session]);
      await requireSnapshotWrite(session, "snapshot_init_failed");

      // Preview möglichst vor dem ersten Countdown in einen stabilen
      // Zustand bringen, damit der Benutzer nicht in einen "kalten" Start
      // fotografiert.
      await preparePreviewForSeries();

      await preCountdownPause();
      const fasterCaptureEffectMs = getFasterCaptureEffectMs();
      const firstCapturePayload = {
        slot: 1,
        applySettings: !!r.useSettings,
        resetAfterShoot: target <= 1,
        iso: r.iso,
        shutter: r.shutter,
        wb: r.wb,
        aperture: r.aperture,
        exposure: r.exposure,
        startLiveViewAfterCapture: true,
        cancelSignal: getActiveCancelSignal(),
      };
      const firstCountdownRes = await flowCountdown(r.counter_first_image, "first", {
        earlyTriggerMs: fasterCaptureEffectMs,
        onEarlyTrigger:
          fasterCaptureEffectMs > 0
            ? async () => {
                await runBeforeCaptureHook(1, target, "first", r.counter_pre_capture);
                return PB.captureApi.captureOnce(firstCapturePayload);
              }
            : null,
      });

      session.status = "CAPTURING";
      await requireSnapshotWrite(session, "snapshot_capture_start_failed");

      // Hauptschleife der Serie: pro Slot wird ein Bild aufgenommen,
      // der Session-Stand aktualisiert und optional ein Zwischenbild im UI
      // gezeigt.
      for (let slot = 1; slot <= target; slot++) {
        guardCancelled();

        let earlyCaptureTask = slot === 1 ? firstCountdownRes?.earlyTask || null : null;

        const capturePayload = {
          slot,
          applySettings: !!r.useSettings,
          resetAfterShoot: slot >= target,
          iso: r.iso,
          shutter: r.shutter,
          wb: r.wb,
          aperture: r.aperture,
          exposure: r.exposure,
          cancelSignal: getActiveCancelSignal(),
        };

        if (slot > 1) {
          await preCountdownPause();
          const betweenCountdownRes = await flowCountdown(
            r.counter_between_each_photo,
            "between",
            {
              earlyTriggerMs: fasterCaptureEffectMs,
              onEarlyTrigger:
                fasterCaptureEffectMs > 0
                  ? async () => {
                      await runBeforeCaptureHook(
                        slot,
                        target,
                        "between",
                        r.counter_pre_capture,
                      );
                      return PB.captureApi.captureOnce(capturePayload);
                    }
                  : null,
            },
          );
          earlyCaptureTask = betweenCountdownRes?.earlyTask || null;
        }

        const triggerText =
          PB._getDeep(CFG, "general.capture.text_triggering") ||
          pbT(
            "capture.working.trigger.text",
            "The camera is taking the photo… please do not move.",
          );

        PB.captureUI.show("Capture_working_trigger", {
          text: triggerText,
          onCancel: () => PB.captureFlow.cancel(),
        });

        await waitForUiPaint();
        PB.shutter.playIn(document, "#Capture_working_trigger");

        let capRes;

        if (earlyCaptureTask) {
          capRes = await earlyCaptureTask.promise;
        } else {
          await preCapturePause(
            slot,
            target,
            slot === 1 ? "first" : "between",
            r.counter_pre_capture,
          );

          capRes = await PB.captureApi.captureOnce(capturePayload);
        }

        if (!capRes || capRes.ok !== true) {
          if (capRes?.error) throw capRes.error;
          throw new Error("Capture failed.");
        }

        const file = capRes.file || capRes.path || capRes.filename || null;
        const expectedName = `${filePrefix}${slot}`;

        session.photos.push({ slot, expectedName, file, ts: Date.now() });
        session.progress = { done: session.photos.length, total: target };
        await snapshotWrite(session);

        $(document).trigger("pb:captureSlotDone", [
          { slot, expectedName, file, session, capRes },
        ]);

        const shotPreviewUrl = captureFileToPreviewUrl(file);
        const previewImgTime = getPreviewImgTimeSeconds();

        // Zwischenlogik:
        //  - Vorletzte/zwischenliegende Bilder können kurz gezeigt werden.
        //  - Beim letzten Bild wird parallel bereits das Rendering gestartet,
        //    um gefühlte Wartezeit zu verkürzen.
        if (slot < target && shotPreviewUrl && previewImgTime > 0) {
          await waitUntilImageLoads(shotPreviewUrl, 1200).catch(() => false);
          await showPreviewBetweenShotsImage({
            imgUrl: shotPreviewUrl,
            closeAfterSeconds: previewImgTime,
          });
        } else if (slot === target && shotPreviewUrl && previewImgTime > 0) {
          session.status = "CAPTURE_DONE";
          await requireSnapshotWrite(session, "snapshot_capture_done_failed");

          session.status = "RENDERING";
          await requireSnapshotWrite(session, "snapshot_render_start_failed");

          const renderPayload = {
            captureFolderHint: session.captureFolderHint,
            cancelSignal: getActiveCancelSignal(),
          };
          const trackedRender = createTrackedPromise(
            PB.captureApi.runPython(renderPayload),
          );

          await waitUntilImageLoads(shotPreviewUrl, 1200).catch(() => false);
          await showPreviewBetweenShotsImage({
            imgUrl: shotPreviewUrl,
            closeAfterSeconds: previewImgTime,
          });

          const processingText =
            PB._getDeep(CFG, "general.capture.text_processing") ||
            pbT("capture.flow.text.processing", "Processing…");

          PB.captureUI.show("Capture_working_capture", {
            text: processingText,
            onCancel: () => PB.captureFlow.cancel(),
          });

          await waitForUiPaint();
          PB.shutter.playIn(document, "#Capture_working_capture");

          if (trackedRender.status === "fulfilled") {
            renderRes = trackedRender.value;
          } else if (trackedRender.status === "rejected") {
            throw trackedRender.error;
          } else {
            PB.captureUI.show("Capture_working_render", {
              text: processingText,
            });

            renderRes = await trackedRender.promise;
          }
        } else {
          PB.captureUI.hideAll();
        }
      }

      if (typeof renderRes === "undefined") {
        session.status = "CAPTURE_DONE";
        await requireSnapshotWrite(session, "snapshot_capture_done_failed");

        const working_text =
          PB._getDeep(CFG, "general.capture.text_processing") ||
          pbT("capture.flow.text.processing", "Processing…");

        PB.captureUI.show("Capture_working_render", { text: working_text });

        session.status = "RENDERING";
        await requireSnapshotWrite(session, "snapshot_render_start_failed");

        const renderPayload = {
          captureFolderHint: session.captureFolderHint,
          cancelSignal: getActiveCancelSignal(),
        };
        renderRes = await PB.captureApi.runPython(renderPayload);
      }

      if (renderRes?.error === "flow_cancelled") {
        throw createCancelledError();
      }

      if (!renderRes || renderRes.ok !== true) {
        throw new Error(
          renderRes?.error ||
            pbT("capture.flow.err.render_failed", "Render failed."),
        );
      }

      storeLastSessionData(renderRes, session, CFG);

      session.status = "RENDER_DONE";
      session.renderResult = renderRes;
      await requireSnapshotWrite(session, "snapshot_render_done_failed");

      const cachedPaperCheck = getCachedPaperShortageResult();
      if (!cachedPaperCheck?.ok && isPaperEmptyError(cachedPaperCheck)) {
        pendingPaperEmptyMessage = cachedPaperCheck.message;
      }

      /*  ####################
          Auto Print
          ###################
          Der Druck ist bewusst NACH dem erfolgreichen Rendern angeordnet.
          Dadurch bleibt die Verantwortung sauber getrennt:
          - Kamera-Serie zuerst vollständig abschließen
          - danach gerendertes Ergebnis verwenden
          - erst dann an den Python-Druckpfad übergeben

          Dabei gilt:
          - Auto-Print nutzt multiple_print aus dem Event
          - Reprint ist separat und nutzt immer 1 Kopie
          - die Papierprüfung muss immer zur echten Kopienzahl passen
      */
      const auto_print = PB.readBool(
        PB._getDeep(CFG, "general.print.print_automatically_when_finish"),
      );
      const requestedCopies = getRequiredPrintCount() || 1;
      let finalStatus = "DONE";

      if (auto_print) {
        const activeEventConfig = String(
          PB._getDeep(CFG, "activeEvent.active_event.config_path") || "",
        )
          .trim()
          .replace(/[\/\\]+$/g, "");

        const eventConfigPath = activeEventConfig || null;

        const printerName =
          String(PB._getDeep(CFG, "general.printer.printerName") || "").trim() ||
          null;

        const imagePath =
          renderRes?.output_path || renderRes?.outputPath || null;

        if (imagePath && eventConfigPath) {
          try {
            const paperCheck = await checkPaperBeforePrint();

            if (!paperCheck.ok) {
              session.print = session.print || {};
              session.print.autoPrint = true;
              session.print.event_file = eventConfigPath;
              session.print.image_path = imagePath;
              session.print.copies = requestedCopies;
              session.print.autoPrintSkipped = true;
              session.print.autoPrintSkipReason = paperCheck.error;
              session.print.remainingPrints = paperCheck.remainingPrints ?? null;
              session.print.autoPrintResult = paperCheck.response || paperCheck;
              finalStatus = "DONE_WITH_PRINT_WARNING";
              await requireSnapshotWrite(session, "snapshot_print_skip_failed");

              if (isPaperEmptyError(paperCheck)) {
                pendingPaperEmptyMessage =
                  paperCheck.message ||
                  pbT(
                    "capture.flow.err.paper_empty",
                    "Printing is not possible. The paper is empty.",
                  );
              }

              console.warn("[captureFlow] autoPrint skipped:", paperCheck.error);
            } else {
              session.status = "PRINTING";
              await requireSnapshotWrite(session, "snapshot_print_start_failed");

              const printPayload = {
                image_path: imagePath,
                event_file: eventConfigPath,
                copies: requestedCopies,
                cancelSignal: getActiveCancelSignal(),
              };

              if (printerName) {
                printPayload.printerName = printerName;
              }

              const printRes = await PB.captureApi.printDefault(printPayload);

              if (printRes?.error === "flow_cancelled") {
                throw createCancelledError();
              }

              session.print = session.print || {};
              session.print.autoPrint = true;
              session.print.event_file = eventConfigPath;
              session.print.image_path = imagePath;
              session.print.copies = requestedCopies;
              session.print.remainingPrints = paperCheck.remainingPrints;
              session.print.autoPrintResult = printRes;

              if (!printRes || printRes.ok !== true) {
                finalStatus = "DONE_WITH_PRINT_WARNING";

                if (isPaperEmptyError(printRes)) {
                  pendingPaperEmptyMessage =
                    printRes?.message ||
                    pbT(
                      "capture.flow.err.paper_empty",
                      "Printing is not possible. The paper is empty.",
                    );
                }

                console.warn("[captureFlow] autoPrint failed:", printRes);
              }

              await requireSnapshotWrite(session, "snapshot_print_result_failed");
            }
          } catch (e) {
            if (e?.__cancelled || e?.message === "__CANCELLED__") {
              throw e;
            }

            console.warn("[captureFlow] autoPrint error:", e);
            session.print = session.print || {};
            session.print.autoPrint = true;
            session.print.autoPrintError = String(e?.message || e);
            finalStatus = "DONE_WITH_PRINT_WARNING";
            await requireSnapshotWrite(session, "snapshot_print_error_failed");
          }
        }
      }

      // Erst ganz am Ende wird der finale Status gesetzt.
      // So vermeiden wir, dass der Flow schon als "DONE" gilt, obwohl
      // z. B. gerade noch gedruckt oder ein Print-Warning verarbeitet wird.
      session.status = finalStatus;
      await requireSnapshotWrite(session, "snapshot_done_failed");

      // Externes Event für andere UI-/App-Teile erst auslösen, wenn der
      // komplette Ablauf wirklich fertig bewertet wurde.
      $(document).trigger("pb:captureFlowDone", [
        { session, python: renderRes },
      ]);

      const finish_text =
        PB._getDeep(CFG, "general.capture.text_done") ||
        pbT("capture.flow.text.done", "Done!");

      const show_finish_image = PB.readBool(
        PB._getDeep(CFG, "general.capture.show_finish_image"),
      );
      const close_after_seconds = PB._getDeep(
        CFG,
        "general.capture.show_finish_image_seconds",
      );
      const allow_reprint = PB.readBool(
        PB._getDeep(CFG, "activeEvent.active_event.allow_reprint"),
      );

      const finishImageSecondsNum = Number(
        String(close_after_seconds ?? "").replace(",", "."),
      );
      const isFinishImageTimeoutZero =
        Number.isFinite(finishImageSecondsNum) && finishImageSecondsNum === 0;
      const canShowFinishImage =
        show_finish_image && (allow_reprint || !isFinishImageTimeoutZero);

      const previewUrl =
        renderRes?.preview_url || renderRes?.previewUrl || null;

      $("#Capture_finish_with_img").css(
        "display",
        canShowFinishImage ? "block" : "none",
      );
      $("#print_again").css("display", allow_reprint ? "block" : "none");

      if (canShowFinishImage) {
        await showFinishWithOptionalImage({
          text: finish_text,
          imgUrl: previewUrl,
          closeAfterSeconds: close_after_seconds,
        });
      } else {
        PB.captureUI.show("Capture_finish", { text: finish_text });
        await PB.sleep(800);
        PB.captureUI.hideAll();
      }

      if (pendingPaperEmptyMessage) {
        await showCaptureErrorMessage(pendingPaperEmptyMessage);
      }

      await restorePreviewAfterFlow();
      PB.captureFlow.ui.setStartAreaVisible(true);
      PB.captureFlow.ui.setCaptureButtonsVisible(true);

      PB.captureUI.hideAll();
      running = false;
      currentRun = null;

      return { ok: true, session, python: renderRes };
    } catch (err) {
      const isCancel =
        err && (err.__cancelled || err.message === "__CANCELLED__");
      if (isCancel) {
        await restorePreviewAfterFlow();
        PB.captureFlow.ui.setStartAreaVisible(true);
        PB.captureFlow.ui.setCaptureButtonsVisible(true);

        PB.captureUI.hideAll();
        running = false;
        currentRun = null;
        return null;
      }

      console.error("[captureFlow] error:", err);
      $(document).trigger("pb:captureFlowError", [{ error: err, session }]);

      session.status = "ERROR";
      session.error = {
        code: "FLOW_ERROR",
        message: getCaptureErrorText(err),
      };
      await snapshotWrite(session);

      await restorePreviewAfterFlow();
      PB.captureFlow.ui.setStartAreaVisible(true);
      PB.captureFlow.ui.setCaptureButtonsVisible(true);

      PB.captureUI.show("Capture_error", {
        text: session.error.message,
        onClose: () => PB.captureUI.hideAll(),
      });

      running = false;
      currentRun = null;
      throw err;
    }
  };
})(jQuery);
