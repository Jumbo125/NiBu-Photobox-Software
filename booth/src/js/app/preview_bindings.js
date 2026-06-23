// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ===========================================================
 * preview_bindings.js — UI-Bindings (LiveView nutzt PB.bridge.*)
 * =========================================================== */
(function ($) {
  "use strict";
  window.PB = window.PB || {};
  const PB = window.PB;

  function updateToggleState() {
    const btn = document.getElementById("btnTogglePreview");
    if (!btn || !PB.preview || typeof PB.preview.isStreamVisible !== "function")
      return;

    const isOn = !!PB.preview.isStreamVisible();
    btn.setAttribute("aria-pressed", isOn ? "true" : "false");
    btn.dataset.state = isOn ? "stream" : "overlay";

    const onIcon = btn.querySelector(".pb-icon-on");
    const offIcon = btn.querySelector(".pb-icon-off");
    if (onIcon) onIcon.classList.toggle("d-none", !isOn);
    if (offIcon) offIcon.classList.toggle("d-none", isOn);
  }

  function applyInitialBgFromConfig() {
    const always = PB.readBool(
      PB._getDeep?.(
        window.PB_CONFIG,
        "camera.camera_settings.liveview_always_active",
      ),
    );
    if (always) showVideo();
    else showStatic();
  }

  PB.initPreviewBindings =
    PB.initPreviewBindings ||
    function () {
      if (!PB.preview) return;

      if (typeof PB.preview.cacheEls === "function") PB.preview.cacheEls();

      const btn = document.getElementById("btnTogglePreview");
      if (btn) {
        btn.addEventListener("click", async function (ev) {
          ev.preventDefault();
          try {
            if (typeof PB.preview.toggleView === "function")
              await PB.preview.toggleView();
          } catch (e) {
            console.warn(
              pbT(
                "preview.toggle_view.warn_failed",
                "preview.toggleView failed:",
              ),
              e,
            );
          } finally {
            updateToggleState();
          }
        });
      }

      const wrap =
        document.getElementById("previewMediaWrap") ||
        document.getElementById("previewArea");
      if (wrap) {
        wrap.addEventListener(
          "pointerdown",
          function () {
            if (PB.preview && typeof PB.preview.ensureRunning === "function") {
              PB.preview.ensureRunning().catch(function (e) {
                console.warn(e);
              });
            }
          },
          { passive: true },
        );
      }

      $(document)
        .off("pb:configLoaded.previewInit")
        .on("pb:configLoaded.previewInit", async function () {
          try {
            PB.preview?.cacheEls?.();
            // Optional: falls das Preview-Modul diesen Helper bereitstellt.
            PB.preview?._applyInitialBgFromConfig?.();
            await PB.preview?.ensureRunning?.();
          } catch (e) {
            console.warn(e);
          }
        });

      updateToggleState();
    };

  // ==========================================
  // TOGGLE LIVEVIEW ON/OFF with API (PB.bridge)
  // ==========================================
  PB.initLiveviewToggleBindings =
    PB.initLiveviewToggleBindings ||
    function () {
      if (PB.__liveviewToggleBound) return;
      PB.__liveviewToggleBound = true;

      const SEL_WRAP = "previewMediaWrap";
      const SEL_FRAME = "liveFrame";
      const SEL_BTN = "btnLiveviewToggle";
      let liveviewToggleBusy = false;

      function el(id) {
        return document.getElementById(id);
      }
      function isShown(e) {
        return !!e && !e.classList.contains("d-none");
      }

      function getIdleFpsFromConfig() {
        const raw = PB._getDeep?.(
          window.PB_CONFIG,
          "camera.camera_settings.liveview_fps_idle",
        );
        const n = Number(raw);
        if (!Number.isFinite(n)) return null;
        return Math.max(1, Math.min(60, Math.trunc(n)));
      }

      function setBtnIcon(state /* 'on'|'off'|'busy' */) {
        const btn = el(SEL_BTN);
        if (!btn) return;
        const ico = btn.querySelector("i");
        if (!ico) return;

        ico.className = "bi";

        if (state === "busy") {
          ico.classList.add("bi-arrow-repeat");
          btn.disabled = true;
          btn.title = pbT("liveview.toggle.title.busy", "LiveView…");
          return;
        }

        btn.disabled = false;

        if (state === "on") {
          ico.classList.add("bi-camera-video-off");
          btn.setAttribute("aria-pressed", "true");
          btn.dataset.live = "on";
          btn.title = pbT(
            "liveview.toggle.title.turn_off",
            "Turn off LiveView",
          );
        } else {
          ico.classList.add("bi-camera-video");
          btn.setAttribute("aria-pressed", "false");
          btn.dataset.live = "off";
          btn.title = pbT("liveview.toggle.title.turn_on", "Turn on LiveView");
        }
      }

      function readLiveviewFromPoll() {
        const h = PB._bridgeLastHealth || null;
        const v =
          h?.LiveViewRunning ??
          h?.liveViewRunning ??
          h?.liveview_running ??
          null;
        if (v === null) return null;
        return !!v;
      }

      function getLiveApi() {
        if (
          PB.bridge?.liveviewStart &&
          PB.bridge?.liveviewStop &&
          PB.bridge?.liveviewSetFps
        ) {
          return {
            start: () => PB.bridge.liveviewStart(),
            stop: () => PB.bridge.liveviewStop(),
            fps: (v) => PB.bridge.liveviewSetFps(v),
          };
        }
        // fallback (alte API)
        if (
          PB.captureApi?.liveviewStart &&
          PB.captureApi?.liveviewStop &&
          (PB.captureApi?.setLiveviewFps || PB.captureApi?.setLiveviewFps)
        ) {
          return {
            start: () => PB.captureApi.liveviewStart(),
            stop: () => PB.captureApi.liveviewStop(),
            fps: (v) =>
              PB.captureApi.setLiveviewFps
                ? PB.captureApi.setLiveviewFps(v)
                : Promise.resolve(),
          };
        }
        return null;
      }

      function syncButtonVisibility() {
        const wrap = el(SEL_WRAP);
        const frame = el(SEL_FRAME);
        const btn = el(SEL_BTN);
        if (!btn) return;

        const show = isShown(wrap) && isShown(frame);
        btn.classList.toggle("d-none", !show);
      }

      function refreshState(fallbackLiveState = null) {
        const btn = el(SEL_BTN);
        if (!btn || btn.classList.contains("d-none")) return;

        const isOn = readLiveviewFromPoll();

        if (isOn === null) {
          if (fallbackLiveState === true) {
            setBtnIcon("on");
            return;
          }

          if (fallbackLiveState === false) {
            setBtnIcon("off");
            return;
          }

          setBtnIcon(btn.dataset.live === "on" ? "on" : "off");
          return;
        }

        setBtnIcon(isOn ? "on" : "off");
      }

      function showLiveviewWaiting() {
        if (document.body.classList.contains("pb-capture-running")) return;

        const layer = el("Liveview_waiting_stream");
        if (!layer) return;

        // Andere Capture-Layer sicher schließen, damit nichts übereinander liegt.
        document.querySelectorAll(".pb-capture-layer").forEach((node) => {
          if (node.id !== "Liveview_waiting_stream") {
            node.classList.add("d-none");
          }
        });

        const title = layer.querySelector(
          '[data-lang-key="liveview.waiting.title"]',
        );
        if (title) {
          title.textContent = pbT("liveview.waiting.title", "Bitte warten");
        }

        const text = layer.querySelector('[data-role="text"]');
        if (text) {
          text.textContent = pbT(
            "liveview.waiting.text",
            "Der Livestream wird gestartet…",
          );
        }

        layer.classList.remove("d-none");
      }

      function hideLiveviewWaiting() {
        const layer = el("Liveview_waiting_stream");
        if (!layer) return;
        layer.classList.add("d-none");
      }

      async function waitForLiveviewFrame(timeoutMs = 8000) {
        if (
          PB.captureFlow &&
          PB.captureFlow.utils &&
          typeof PB.captureFlow.utils.waitForPreviewFramePaint === "function"
        ) {
          return PB.captureFlow.utils.waitForPreviewFramePaint({
            timeoutMs,
            intervalMs: 80,
            iframeId: SEL_FRAME,
            imgSelector: "img#lv, img#mjpg, img#stream, img",
          });
        }

        const sleep =
          PB.sleep ||
          ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));

        const nextPaint = () =>
          new Promise((resolve) =>
            requestAnimationFrame(() => requestAnimationFrame(resolve)),
          );

        const start = Date.now();

        while (Date.now() - start < timeoutMs) {
          const frame = el(SEL_FRAME);

          if (frame) {
            try {
              const doc =
                frame.contentDocument || frame.contentWindow?.document;
              const img = doc?.querySelector(
                "img#lv, img#mjpg, img#stream, img",
              );

              if (img && img.naturalWidth > 0 && img.naturalHeight > 0) {
                await nextPaint();
                return { ok: true };
              }
            } catch (_) {
              // Iframe ist eventuell noch nicht bereit oder nicht lesbar.
            }
          }

          await sleep(80);
        }

        await nextPaint();
        return { ok: false, reason: "timeout" };
      }

      function bindClick() {
        const btn = el(SEL_BTN);
        if (!btn) return;

        btn.addEventListener("click", async (ev) => {
          ev.preventDefault();
          ev.stopPropagation();

          if (document.body.classList.contains("pb-capture-running")) {
            return;
          }

          if (liveviewToggleBusy || btn.disabled) {
            return;
          }

          const api = getLiveApi();
          if (!api) {
            console.warn(
              pbT(
                "liveview.toggle.warn_no_api",
                "[liveview_toggle] Keine LiveView-API verfügbar.",
              ),
            );
            return;
          }

          liveviewToggleBusy = true;

          let fallbackLiveState = null;

          try {
            setBtnIcon("busy");

            let isOn = btn.dataset.live === "on";
            const polled = readLiveviewFromPoll();
            if (polled !== null) isOn = polled;

            if (isOn) {
              await api.stop();
              fallbackLiveState = false;
            } else {
              showLiveviewWaiting();

              const fpsIdle = getIdleFpsFromConfig();
              if (fpsIdle != null) {
                await api.fps(fpsIdle);
                if (PB.sleep) await PB.sleep(60);
              }

              await api.start();

              if (
                PB.preview &&
                typeof PB.preview.ensureRunning === "function"
              ) {
                await PB.preview.ensureRunning();
              }

              const frameRes = await waitForLiveviewFrame(8000);

              if (!frameRes?.ok) {
                console.warn(
                  pbT(
                    "liveview.toggle.warn_frames_timeout",
                    "[liveview_toggle] LiveView wurde gestartet, aber es wurden noch keine Frames sichtbar.",
                  ),
                  frameRes,
                );
              }

              // api.start() war erfolgreich. Auch wenn der Poll noch hängt,
              // soll der Button nicht sofort wieder auf OFF springen.
              fallbackLiveState = true;
            }
          } catch (e) {
            console.warn(
              pbT(
                "liveview.toggle.warn_toggle_failed",
                "[liveview_toggle] LiveView starten/stoppen fehlgeschlagen:",
              ),
              e,
            );
          } finally {
            hideLiveviewWaiting();
            liveviewToggleBusy = false;
            refreshState(fallbackLiveState);
          }
        });
      }

      function installObserver() {
        const wrap = el(SEL_WRAP);
        const frame = el(SEL_FRAME);
        if (!wrap || !frame) return;

        const obs = new MutationObserver(() => {
          syncButtonVisibility();
          refreshState();
        });

        obs.observe(wrap, { attributes: true, attributeFilter: ["class"] });
        obs.observe(frame, { attributes: true, attributeFilter: ["class"] });
      }

      syncButtonVisibility();
      bindClick();
      installObserver();
      refreshState();

      if (window.jQuery) {
        window
          .jQuery(document)
          .off("pb:configLoaded.liveviewToggle")
          .on("pb:configLoaded.liveviewToggle", function () {
            refreshState();
          });

        window
          .jQuery(document)
          .off("pb:bridgeHealth.liveviewToggle")
          .on("pb:bridgeHealth.liveviewToggle", function () {
            refreshState();
          });
      }
    };
})(jQuery);
