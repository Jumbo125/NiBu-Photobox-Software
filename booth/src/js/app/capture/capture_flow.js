// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * booth/js/capture_flow.js — vereinfachter Capture-Flow
 * ----------------------------------------------------
 * Ziel dieser Version:
 *   - JS macht primär UX / Countdown / Overlay / session.json
 *   - C# / Backend macht die Kamera-Transaktion
 *   - JS startet/stellt LiveView nur an den Flow-Grenzen wieder her
 *   - Zwischen den Shots wird LiveView nicht mehr aktiv von JS hin- und hergeschaltet
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
  // -----------------------------------------------------------------------
  let running = false;
  let cancelled = false;

  PB.captureFlow.isRunning = PB.captureFlow.isRunning || (() => running);

  PB.captureFlow.cancel =
    PB.captureFlow.cancel ||
    async function () {
      if (!running) return;
      cancelled = true;

      PB.captureUI.show("Capture_working_abort");
      await PB.sleep(300);

      await restorePreviewAfterFlow();
      PB.captureFlow.ui.setStartAreaVisible(true);
      PB.captureFlow.ui.setCaptureButtonsVisible(true);

      PB.captureUI.hideAll();
      running = false;
    };

  function guardCancelled() {
    if (!cancelled) return;
    const e = new Error("__CANCELLED__");
    e.__cancelled = true;
    throw e;
  }

  // -----------------------------------------------------------------------
  // Utils (ensure exists)
  // -----------------------------------------------------------------------
  PB.captureFlow.utils.waitForPreviewFramePaint =
    PB.captureFlow.utils.waitForPreviewFramePaint ||
    async function ({
      timeoutMs = 900,
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
  async function preparePreviewForSeries() {
    await ensureViewStreamVisible(true).catch(() => {});
    await ensurePreviewRunning().catch(() => {});

    // LiveView nur einmal sauber vor dem Capture-Flow starten.
    const startRes = await PB.captureApi.liveviewStart().catch((error) => ({
      ok: false,
      error,
    }));
    if (!startRes || startRes.ok !== true) {
      throw startRes?.error || new Error("LiveView could not be started before capture flow.");
    }

    const framesRes =
      typeof PB.captureApi.waitForFrames === "function"
        ? await PB.captureApi.waitForFrames(5000).catch((error) => ({
            ok: false,
            error,
          }))
        : { ok: true, skipped: true };

    if (!framesRes || framesRes.ok !== true) {
      throw (
        framesRes?.error ||
        new Error("Timed out waiting for live-view frames before capture flow.")
      );
    }

    const previewReady = await waitForPreviewReady(4000, 350).catch((error) => ({
      ok: false,
      error,
    }));

    if (!previewReady || previewReady.ok !== true) {
      throw (
        previewReady?.error ||
        new Error("LiveView preview was not ready before capture flow.")
      );
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

    return PB.writeSessionSnapshot(folder, session).catch((err) => {
      console.warn("[snapshot] write failed:", err?.message || err);
      return { ok: false, error: "snapshot_write_failed" };
    });
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

    PB.captureFlow._previewWasStream =
      PB.preview && typeof PB.preview.isStreamVisible === "function"
        ? PB.preview.isStreamVisible() === true
        : false;

    PB.captureFlow.ui.setStartAreaVisible(false);
    PB.captureFlow.ui.setCaptureButtonsVisible(false);

    const filePrefix = String(PB.CAPTURE_TMP_Prefix || "Photo_");
    const nowIso = () => new Date().toISOString();

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

    try {
      $(document).trigger("pb:captureSessionStarted", [session]);
      await snapshotWrite(session);

      await preparePreviewForSeries();

      await preCountdownPause();
      const fasterCaptureEffectMs = getFasterCaptureEffectMs();
      const firstCapturePayload = {
        slot: 1,
        applySettings: !!r.useSettings,
        iso: r.iso,
        shutter: r.shutter,
        wb: r.wb,
        aperture: r.aperture,
        exposure: r.exposure,
        startLiveViewAfterCapture: true,
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
      await snapshotWrite(session);

      for (let slot = 1; slot <= target; slot++) {
        guardCancelled();

        let earlyCaptureTask = slot === 1 ? firstCountdownRes?.earlyTask || null : null;

        const capturePayload = {
          slot,
          applySettings: !!r.useSettings,
          iso: r.iso,
          shutter: r.shutter,
          wb: r.wb,
          aperture: r.aperture,
          exposure: r.exposure,
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

        if (slot < target && shotPreviewUrl && previewImgTime > 0) {
          await waitUntilImageLoads(shotPreviewUrl, 1200).catch(() => false);
          await showPreviewBetweenShotsImage({
            imgUrl: shotPreviewUrl,
            closeAfterSeconds: previewImgTime,
          });
        } else if (slot === target && shotPreviewUrl && previewImgTime > 0) {
          session.status = "CAPTURE_DONE";
          await snapshotWrite(session);

          session.status = "RENDERING";
          await snapshotWrite(session);

          const renderPayload = { captureFolderHint: session.captureFolderHint };
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
        await snapshotWrite(session);

        const working_text =
          PB._getDeep(CFG, "general.capture.text_processing") ||
          pbT("capture.flow.text.processing", "Processing…");

        PB.captureUI.show("Capture_working_render", { text: working_text });

        session.status = "RENDERING";
        await snapshotWrite(session);

        const renderPayload = { captureFolderHint: session.captureFolderHint };
        renderRes = await PB.captureApi.runPython(renderPayload);
      }

      if (!renderRes || renderRes.ok !== true) {
        throw new Error(
          renderRes?.error ||
            pbT("capture.flow.err.render_failed", "Render failed."),
        );
      }

      session.status = "DONE";
      session.renderResult = renderRes;
      await snapshotWrite(session);

      $(document).trigger("pb:captureFlowDone", [
        { session, python: renderRes },
      ]);

      const auto_print = !!PB._getDeep(
        CFG,
        "general.print.print_automatically_when_finish",
      );
      if (auto_print) {
        const activeEventConfig = String(
          PB._getDeep(CFG, "activeEvent.active_event.config_path") || "",
        )
          .trim()
          .replace(/[\/\\]+$/g, "");

        const eventFile = activeEventConfig || null;

        const copiesRaw =
          PB._getDeep(CFG, "general.print.copies") ??
          PB._getDeep(session, "print.printerCount") ??
          1;

        let copies = parseInt(copiesRaw, 10);
        if (!Number.isFinite(copies) || copies < 1) copies = 1;
        if (copies > 20) copies = 20;

        const printerName =
          String(PB._getDeep(CFG, "general.printer.printerName") || "").trim() ||
          null;
        const imagePath = renderRes.output_path || null;

        if (imagePath && eventFile) {
          try {
            session.status = "PRINTING";
            await snapshotWrite(session);

            const printRes = await PB.captureApi.printDefault({
              image_path: imagePath,
              event_file: eventFile,
              copies,
              printerName,
            });

            session.print = session.print || {};
            session.print.autoPrint = true;
            session.print.copies = copies;
            session.print.event_file = eventFile;
            session.print.image_path = imagePath;
            session.print.autoPrintResult = printRes;
            await snapshotWrite(session);

            if (!printRes || printRes.ok !== true) {
              console.warn("[captureFlow] autoPrint failed:", printRes);
            }
          } catch (e) {
            console.warn("[captureFlow] autoPrint error:", e);
            session.print = session.print || {};
            session.print.autoPrint = true;
            session.print.autoPrintError = String(e?.message || e);
            await snapshotWrite(session);
          }
        }
      }

      const finish_text =
        PB._getDeep(CFG, "general.capture.text_done") ||
        pbT("capture.flow.text.done", "Done!");

      const show_finish_image = !!PB._getDeep(
        CFG,
        "general.capture.show_finish_image",
      );
      const close_after_seconds = PB._getDeep(
        CFG,
        "general.capture.show_finish_image_seconds",
      );

      const previewUrl =
        renderRes?.preview_url || renderRes?.previewUrl || null;

      if (show_finish_image) {
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

      await restorePreviewAfterFlow();
      PB.captureFlow.ui.setStartAreaVisible(true);
      PB.captureFlow.ui.setCaptureButtonsVisible(true);

      PB.captureUI.hideAll();
      running = false;

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
      throw err;
    }
  };
})(jQuery);
