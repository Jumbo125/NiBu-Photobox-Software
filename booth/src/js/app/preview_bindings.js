// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ===========================================================
 * preview_bindings.js — UI-Bindings (LiveView nutzt PB.bridge.*)
 * =========================================================== */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  function updateToggleState() {
    const btn = document.getElementById('btnTogglePreview');
    if (!btn || !PB.preview || typeof PB.preview.isStreamVisible !== 'function') return;

    const isOn = !!PB.preview.isStreamVisible();
    btn.setAttribute('aria-pressed', isOn ? 'true' : 'false');
    btn.dataset.state = isOn ? 'stream' : 'overlay';

    const onIcon = btn.querySelector('.pb-icon-on');
    const offIcon = btn.querySelector('.pb-icon-off');
    if (onIcon) onIcon.classList.toggle('d-none', !isOn);
    if (offIcon) offIcon.classList.toggle('d-none', isOn);
  }

  function applyInitialBgFromConfig() {
    const always = readBool(PB._getDeep?.(window.PB_CONFIG, 'camera.camera_settings.liveview_always_active'));
    if (always) showVideo();
    else showStatic();
  }

  PB.initPreviewBindings = PB.initPreviewBindings || function () {
    if (!PB.preview) return;

    if (typeof PB.preview.cacheEls === 'function') PB.preview.cacheEls();

    const btn = document.getElementById('btnTogglePreview');
    if (btn) {
      btn.addEventListener('click', async function (ev) {
        ev.preventDefault();
        try {
          if (typeof PB.preview.toggleView === 'function') await PB.preview.toggleView();
        } catch (e) {
          console.warn(pbT('preview.toggle_view.warn_failed', 'preview.toggleView failed:'), e);
        } finally {
          updateToggleState();
        }
      });
    }

    const wrap = document.getElementById('previewMediaWrap') || document.getElementById('previewArea');
    if (wrap) {
      wrap.addEventListener(
        'pointerdown',
        function () {
          if (PB.preview && typeof PB.preview.ensureRunning === 'function') {
            PB.preview.ensureRunning().catch(function (e) {
              console.warn(e);
            });
          }
        },
        { passive: true }
      );
    }

    $(document)
      .off('pb:configLoaded.previewInit')
      .on('pb:configLoaded.previewInit', async function () {
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
  PB.initLiveviewToggleBindings = PB.initLiveviewToggleBindings || function () {
    if (PB.__liveviewToggleBound) return;
    PB.__liveviewToggleBound = true;

    const SEL_WRAP = 'previewMediaWrap';
    const SEL_FRAME = 'liveFrame';
    const SEL_BTN = 'btnLiveviewToggle';

    function el(id) {
      return document.getElementById(id);
    }
    function isShown(e) {
      return !!e && !e.classList.contains('d-none');
    }

    function getIdleFpsFromConfig() {
      const raw = PB._getDeep?.(window.PB_CONFIG, 'camera.camera_settings.liveview_fps_idle');
      const n = Number(raw);
      if (!Number.isFinite(n)) return null;
      return Math.max(1, Math.min(60, Math.trunc(n)));
    }

    function setBtnIcon(state /* 'on'|'off'|'busy' */) {
      const btn = el(SEL_BTN);
      if (!btn) return;
      const ico = btn.querySelector('i');
      if (!ico) return;

      ico.className = 'bi';

      if (state === 'busy') {
        ico.classList.add('bi-arrow-repeat');
        btn.disabled = true;
        btn.title = pbT('liveview.toggle.title.busy', 'LiveView…');
        return;
      }

      btn.disabled = false;

      if (state === 'on') {
        ico.classList.add('bi-camera-video-off');
        btn.setAttribute('aria-pressed', 'true');
        btn.dataset.live = 'on';
        btn.title = pbT('liveview.toggle.title.turn_off', 'Turn off LiveView');
      } else {
        ico.classList.add('bi-camera-video');
        btn.setAttribute('aria-pressed', 'false');
        btn.dataset.live = 'off';
        btn.title = pbT('liveview.toggle.title.turn_on', 'Turn on LiveView');
      }
    }

    function readLiveviewFromPoll() {
      const h = PB._bridgeLastHealth || null;
      const v = h?.LiveViewRunning ?? h?.liveViewRunning ?? h?.liveview_running ?? null;
      if (v === null) return null;
      return !!v;
    }

    function getLiveApi() {
      if (PB.bridge?.liveviewStart && PB.bridge?.liveviewStop && PB.bridge?.liveviewSetFps) {
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
          fps: (v) => (PB.captureApi.setLiveviewFps ? PB.captureApi.setLiveviewFps(v) : Promise.resolve()),
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
      btn.classList.toggle('d-none', !show);
    }

    function refreshState() {
      const btn = el(SEL_BTN);
      if (!btn || btn.classList.contains('d-none')) return;

      const isOn = readLiveviewFromPoll();
      if (isOn === null) {
        setBtnIcon('off');
        return;
      }
      setBtnIcon(isOn ? 'on' : 'off');
    }

    function bindClick() {
      const btn = el(SEL_BTN);
      if (!btn) return;

      btn.addEventListener('click', async (ev) => {
        ev.preventDefault();
        ev.stopPropagation();

        const api = getLiveApi();
        if (!api) {
          console.warn(
            pbT('liveview.toggle.warn_no_api', '[liveview_toggle] No liveview API available (PB.bridge missing?)')
          );
          return;
        }

        try {
          setBtnIcon('busy');

          let isOn = btn.dataset.live === 'on';
          const polled = readLiveviewFromPoll();
          if (polled !== null) isOn = polled;

          if (isOn) {
            await api.stop();
          } else {
            const fpsIdle = getIdleFpsFromConfig();
            if (fpsIdle != null) {
              await api.fps(fpsIdle);
              if (PB.sleep) await PB.sleep(60);
            }
            await api.start();
          }
        } catch (e) {
          console.warn(pbT('liveview.toggle.warn_toggle_failed', '[liveview_toggle] toggle failed:'), e);
        } finally {
          refreshState();
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

      obs.observe(wrap, { attributes: true, attributeFilter: ['class'] });
      obs.observe(frame, { attributes: true, attributeFilter: ['class'] });
    }

    syncButtonVisibility();
    bindClick();
    installObserver();
    refreshState();

    if (window.jQuery) {
      window.jQuery(document)
        .off('pb:configLoaded.liveviewToggle')
        .on('pb:configLoaded.liveviewToggle', function () {
          refreshState();
        });

      window.jQuery(document)
        .off('pb:bridgeHealth.liveviewToggle')
        .on('pb:bridgeHealth.liveviewToggle', function () {
          refreshState();
        });
    }
  };
})(jQuery);
