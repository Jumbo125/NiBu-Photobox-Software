// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/** preview.js — Live-Preview (CameraBridge/IFrame) + Overlay/Stream Umschaltung */
(function ($) {
  "use strict";
  window.PB = window.PB || {};
  const PB = window.PB;

  PB.preview = (function () {
    const CAMERA_IFRAME_URL = "tools/camerabridge/stream.html";

    // kleine Helper-Übersetzung (falls pbT mal nicht geladen ist)
    function tr(key, fallback) {
      return typeof pbT === "function" ? pbT(key, fallback) : fallback;
    }

    const els = {
      mediaWrap: null,
      overlayWrap: null,
      liveFrame: null,
      hint: null,
      bgVideo: null,
      bgStatic: null
    };

    const state = {
      view: "static", // 'static' | 'video'
      fps: null,
      fpsPollTimer: null,
      settingIframeSrc: false,
      initialViewApplied: false
    };

    // -------------------------------------------------------------
    // DOM Cache
    // -------------------------------------------------------------
    function cacheEls() {
      els.mediaWrap = document.getElementById("previewMediaWrap");
      els.overlayWrap = document.getElementById("previewOverlayWrap");
      els.liveFrame = document.getElementById("liveFrame");
      els.hint = document.getElementById("bgVideoHint");
      els.bgVideo = document.getElementById("bgVideo");
      els.bgStatic = document.getElementById("bgStaticImg");
    }

    // -------------------------------------------------------------
    // UI Helpers
    // -------------------------------------------------------------
    function setHint(text) {
      if (!els.hint) return;
      if (!text) {
        els.hint.classList.add("d-none");
        els.hint.textContent = "";
        return;
      }
      els.hint.textContent = String(text);
      els.hint.classList.remove("d-none");
    }

    function showStatic() {
      state.view = "static";

      // Overlay bleibt sichtbar
      els.overlayWrap?.classList.remove("d-none");

      // Stream/Video aus
      els.mediaWrap?.classList.add("d-none");
      els.liveFrame?.classList.add("d-none");
      els.bgVideo?.classList.add("d-none");

      // Bild an
      els.bgStatic?.classList.remove("d-none");

      stopFpsPoll();
      setCurrentFpsUi("");
    }

    function showVideo() {
      state.view = "video";

      // Overlay bleibt sichtbar
      els.overlayWrap?.classList.remove("d-none");

      // Bild aus
      els.bgStatic?.classList.add("d-none");

      // Stream/Video an
      els.bgVideo?.classList.remove("d-none");
      els.mediaWrap?.classList.remove("d-none");
      els.liveFrame?.classList.remove("d-none");
    }

    // Backwards-kompatible Namen
    function showOverlay() {
      showStatic();
    }
    function showStream() {
      showVideo();
    }

    function isStreamVisible() {
      return state.view === "video";
    }

    function applyInitialViewFromConfig(force = false) {
      if (state.initialViewApplied && !force) return;

      const always = readBool(
        PB._getDeep?.(window.PB_CONFIG, "camera.camera_settings.liveview_always_active")
      );

      if (always) showVideo();
      else showStatic();

      state.initialViewApplied = true;
    }

    // -------------------------------------------------------------
    // Utils
    // -------------------------------------------------------------
    function readBool(v) {
      if (v === true) return true;
      if (v === false) return false;
      return ["1", "true", "yes", "y", "on"].includes(String(v ?? "").trim().toLowerCase());
    }

    function withQuery(url, params) {
      const u = new URL(String(url), window.location.href);
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== "") {
          u.searchParams.set(k, String(v));
        }
      });
      return u.toString();
    }

    // -------------------------------------------------------------
    // IFRAME SRC (SAFE + GUARDED)
    // -------------------------------------------------------------
    function setIframeSrcGuarded(frame, url) {
      if (!frame) return;
      if (state.settingIframeSrc) return;

      let current = "";
      try {
        current = frame.src ? new URL(frame.src, location.href).toString() : "";
      } catch {
        current = frame.src || "";
      }
      if (current === url) return;

      state.settingIframeSrc = true;
      try {
        frame.src = "about:blank";
        requestAnimationFrame(() => {
          frame.src = url;
        });
      } finally {
        setTimeout(() => {
          state.settingIframeSrc = false;
        }, 0);
      }
    }

    // -------------------------------------------------------------
    // IFRAME LOAD → STATUS PUSH
    // -------------------------------------------------------------
    function attachIframeLoadHandler(frame) {
      if (!frame || frame._pbLoadBound) return;
      frame._pbLoadBound = true;

      frame.addEventListener("load", () => {
        const h = PB._bridgeLastHealth;
        if (h) {
          frame.contentWindow?.updateStatus?.(h);
        }
      });
    }

    // -------------------------------------------------------------
    // FPS UI
    // -------------------------------------------------------------
    function setCurrentFpsUi(val) {
      const el = document.getElementById("current_fps");
      if (!el) return;
      el.textContent = val == null ? "" : String(val);
    }

    function stopFpsPoll() {
      if (state.fpsPollTimer) {
        clearTimeout(state.fpsPollTimer);
        state.fpsPollTimer = null;
      }
    }

    function scheduleFpsPollIfRunning() {
      stopFpsPoll();

      const tick = async () => {
        if (!state.fpsPollTimer) return;
        if (!isStreamVisible()) {
          stopFpsPoll();
          setCurrentFpsUi("");
          return;
        }

        const running = !!PB.bridge?.isStreaming?.();
        if (!running) {
          stopFpsPoll();
          setCurrentFpsUi("");
          return;
        }

        try {
          const res = await PB.bridge.getLiveviewFps();
          const n = Number(res?.fps);
          setCurrentFpsUi(Number.isFinite(n) ? n : "");
        } catch {
          setCurrentFpsUi("");
        }

        state.fpsPollTimer = setTimeout(tick, 10000);
      };

      state.fpsPollTimer = setTimeout(tick, 0);
    }

    // -------------------------------------------------------------
    // CAMERA / IFRAME START
    // -------------------------------------------------------------
    function startCamera() {
      if (!els.liveFrame) return false;

      attachIframeLoadHandler(els.liveFrame);

      setHint(tr("preview.hint.starting_camera_preview", "Starting camera preview…"));
      els.liveFrame.classList.remove("d-none");

      const base = els.liveFrame.dataset.baseUrl || CAMERA_IFRAME_URL;
      els.liveFrame.dataset.baseUrl = base;

      const camera = PB._getDeep?.(window.PB_CONFIG, "camera.camera_settings") || {};
      const debugModeVal = PB._getDeep?.(window.PB_CONFIG, "general.system.debugMode");
      const portVal = PB._getDeep?.(window.PB_CONFIG, "cameraBridgeServer.Bridge.Port");

      const params = {
        preview_mirror: readBool(camera.preview_mirror) ? "1" : "0",
        full_img: readBool(camera.fullImg) ? "1" : "0",
        debug_mode: readBool(debugModeVal) ? "1" : "0"
      };

      if (portVal != null && String(portVal).trim() !== "") {
        params.port = String(portVal).trim();
      }

      if (state.fps != null) params.fps = state.fps;

      const desired = withQuery(base, params);
      setIframeSrcGuarded(els.liveFrame, desired);

      setHint("");
      return true;
    }

    async function ensureRunning() {
      cacheEls();

      // Wenn "static" aktiv: kein Kamera-Start erzwingen
      if (!isStreamVisible()) return true;

      const ok = startCamera();
      if (ok) scheduleFpsPollIfRunning();
      return ok;
    }

    async function setSource(_kind, opts) {
      opts = opts || {};
      cacheEls();

      if (opts.fps != null) {
        const n = Number(opts.fps);
        state.fps = Number.isFinite(n) ? n : null;
      }

      await ensureRunning();
      return true;
    }

    async function toggleView() {
      cacheEls();

      if (isStreamVisible()) {
        showStatic();
        return;
      }

      showVideo();
      await ensureRunning();
      scheduleFpsPollIfRunning();
    }

    // -------------------------------------------------------------
    // PUBLIC API
    // -------------------------------------------------------------
    return {
      cacheEls,
      setSource,
      toggleView,
      showOverlay,
      showStream,
      ensureRunning,
      isStreamVisible,
      applyInitialViewFromConfig
    };
  })();

  // -------------------------------------------------------------
  // STATUS → IFRAME PUSH (laufend)
  // -------------------------------------------------------------
  $(document).on("pb:bridgeHealth.preview", function (_, health) {
    const frame = document.getElementById("liveFrame");
    frame?.contentWindow?.updateStatus?.(health);
  });
})(jQuery);
