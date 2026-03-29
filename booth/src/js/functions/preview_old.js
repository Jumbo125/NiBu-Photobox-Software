/** preview.js — Live-Preview (CameraBridge/IFrame) + Overlay/Stream Umschaltung
 *
 * Vereinfachung:
 *  - KEIN Webcam/MediaStream mehr.
 *  - Auch eine Webcam wird über die CameraBridge als "Camera" selektiert.
 *  - Preview läuft ausschließlich über <iframe id="liveFrame">.
 */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  PB.preview = (function () {
    const CAMERA_IFRAME_URL = 'tools/camerabridge/stream.html';

    const els = {
      mediaWrap: null,
      overlayWrap: null,
      liveFrame: null,
      hint: null
    };

    const state = {
      view: 'overlay', // 'overlay' | 'stream'
      fps: null
    };

    function cacheEls() {
      els.mediaWrap = document.getElementById('previewMediaWrap');
      els.overlayWrap = document.getElementById('previewOverlayWrap');
      els.liveFrame = document.getElementById('liveFrame');
      els.hint = document.getElementById('bgVideoHint');
    }

    function setHint(text) {
      if (!els.hint) return;
      if (!text) {
        els.hint.classList.add('d-none');
        els.hint.textContent = '';
        return;
      }
      els.hint.textContent = String(text);
      els.hint.classList.remove('d-none');
    }

    function showOverlay() {
      state.view = 'overlay';
      if (els.overlayWrap) els.overlayWrap.classList.remove('d-none');
      if (els.mediaWrap) els.mediaWrap.classList.add('d-none');
    }

    function showStream() {
      state.view = 'stream';
      // if (els.overlayWrap) els.overlayWrap.classList.add('d-none');
      if (els.mediaWrap) els.mediaWrap.classList.remove('d-none');
    }

    function isStreamVisible() {
      return state.view === 'stream';
    }

    function withQuery(url, params) {
      const u = new URL(String(url || ''), window.location.href);
      Object.entries(params || {}).forEach(([k, v]) => {
        if (v === undefined || v === null || v === '') return;
        u.searchParams.set(k, String(v));
      });
      return u.toString();
    }

    function startCamera() {
      if (!els.liveFrame) return false;

      setHint('Starte Kamera Preview…');

      els.liveFrame.classList.remove('d-none');

      // base merken (ohne query)
      const base = els.liveFrame.dataset.baseUrl || CAMERA_IFRAME_URL;
      els.liveFrame.dataset.baseUrl = base;

      // mirror aus PB_CONFIG lesen (robust)
      const general = PB._getDeep(window.PB_CONFIG, 'general.system');
      const debugmode = general.debugMode;
      const camera = PB._getDeep(window.PB_CONFIG, 'camera.camera_settings');
      const cameraBridgeServer =  PB._getDeep(window.PB_CONFIG, 'cameraBridgeServer.Bridge');
      const port = cameraBridgeServer.Port; 
      const mirror = camera.preview_mirror;
      const full_img = camera.fullImg;

    

      // Query-Params bauen / überschreiben
      const params = {
        preview_mirror: mirror ? '1' : '0',
        full_img: full_img ? '1' : '0',
        debug_mode: debugmode ? '1' : '0',
      };

      // Port nur setzen, wenn vorhanden (stream.html fällt sonst auf 8052 zurück)
      if (port != null && String(port).trim() !== '') params.port = String(port).trim();

      if (state.fps != null) params.fps = state.fps;

      // Optional: Api-Key als Query weiterreichen (nur nötig, wenn stream.html das so erwartet)
      //const key = (typeof PB.getBridgeApiKey === 'function') ? String(PB.getBridgeApiKey() || '').trim() : '';
      //if (key) params.apiKey = key;

      const desired = withQuery(base, params);


      // compare normalized absolute urls
      let current = '';
      try { current = els.liveFrame.src ? new URL(els.liveFrame.src, window.location.href).toString() : ''; }
      catch (_) { current = els.liveFrame.src || ''; }

      if (!current || current !== desired) {
        els.liveFrame.src = desired;
      }

      setHint('');
      return true;
    }

    async function ensureRunning() {
      cacheEls();
      return startCamera();
    }

    /**
     * Quelle setzen (vereinfacht):
     * - kind wird ignoriert (immer "camera"/iframe)
     * - opts.fps (optional) -> wird als ?fps=... angehängt
     */
    async function setSource(_kind, opts) {
      opts = opts || {};
      cacheEls();

      if (opts.fps != null && opts.fps !== '') {
        const n = Number(opts.fps);
        state.fps = Number.isFinite(n) ? n : null;
      }

      // bewusst auch im Overlay starten (warmup), damit Toggle sofort Bild zeigt
      await ensureRunning();
      return true;
    }

    async function toggleView() {
      cacheEls();

      if (isStreamVisible()) {
        showOverlay();
        return;
      }

      showStream();
      await ensureRunning();
    }

    return {
      cacheEls,
      setSource,
      toggleView,
      showOverlay,
      showStream,
      ensureRunning,
      isStreamVisible
    };
  })();

  // --- kleine Helpers ---
  function isVisible(el) {
    return !!el && !el.classList.contains('d-none');
  }

  // Bridge Status lesen (liefert u.a. LiveViewRunning)
  PB.apiGetBridgeStatus = PB.apiGetBridgeStatus || async function () {
    const url = PB.apiUrl ? PB.apiUrl('bridge_status') : `${PB.API_BASE}/api/status`;
    const res = await fetch(url, {
      method: 'GET',
      headers: PB.bridgeAuthHeaders?.({ Accept: 'application/json' })
    });
    if (!res.ok) throw new Error(`GET /api/status failed: HTTP ${res.status}`);
    return res.json();
  };

  PB.apiLiveviewStart = PB.apiLiveviewStart || async function () {
    const url = PB.apiUrl ? PB.apiUrl('bridge_liveview_start') : `${PB.API_BASE}/api/liveview/start`;
    const res = await fetch(url, {
      method: 'POST',
      headers: PB.bridgeAuthHeaders?.()
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`POST /api/liveview/start failed: HTTP ${res.status} - ${txt}`);
    return true;
  };

  PB.apiLiveviewStop = PB.apiLiveviewStop || async function () {
    const url = PB.apiUrl ? PB.apiUrl('bridge_liveview_stop') : `${PB.API_BASE}/api/liveview/stop`;
    const res = await fetch(url, {
      method: 'POST',
      headers: PB.bridgeAuthHeaders?.()
    });
    const txt = await res.text();
    if (!res.ok) throw new Error(`POST /api/liveview/stop failed: HTTP ${res.status} - ${txt}`);
    return true;
  };

  // Button nur anzeigen, wenn LiveView (iframe) sichtbar ist
  PB.syncLiveviewToggleButtonVisibility = PB.syncLiveviewToggleButtonVisibility || function () {
    const wrap = document.getElementById('previewMediaWrap');
    const frame = document.getElementById('liveFrame');
    const btn = document.getElementById('btnLiveviewToggle');
    if (!btn) return;

    const show = isVisible(wrap) && isVisible(frame);
    btn.classList.toggle('d-none', !show);
  };

  // Text/State updaten
  async function updateButtonLabel() {
    const btn = document.getElementById('btnLiveviewToggle');
    if (!btn || btn.classList.contains('d-none')) return;

    try {
      const st = await PB.apiGetBridgeStatus();
      const on = !!st.LiveViewRunning; // kommt aus /api/status
      btn.textContent = on ? 'LiveView aus' : 'LiveView an';
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    } catch (e) {
      console.warn('[LiveViewToggle] status failed:', e);
    }
  }

  // Toggle Click
  function bindToggle() {
    const btn = document.getElementById('btnLiveviewToggle');
    if (!btn) return;

    btn.addEventListener('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();

      btn.disabled = true;
      try {
        const st = await PB.apiGetBridgeStatus();
        const on = !!st.LiveViewRunning;

        if (on) await PB.apiLiveviewStop();
        else await PB.apiLiveviewStart();

        await updateButtonLabel();
      } catch (err) {
        console.warn('[LiveViewToggle] toggle failed:', err);
        // optional: PB.showMsg?.('LiveView Toggle fehlgeschlagen');
      } finally {
        btn.disabled = false;
      }
    });
  }

  // Automatisch reagieren, wenn wrap/frame per class d-none ein/aus geschaltet werden
  function installVisibilityObserver() {
    const wrap = document.getElementById('previewMediaWrap');
    const frame = document.getElementById('liveFrame');
    if (!wrap || !frame) return;

    const obs = new MutationObserver(async function () {
      PB.syncLiveviewToggleButtonVisibility();
      await updateButtonLabel();
    });

    obs.observe(wrap, { attributes: true, attributeFilter: ['class'] });
    obs.observe(frame, { attributes: true, attributeFilter: ['class'] });

    // initial
    PB.syncLiveviewToggleButtonVisibility();
    updateButtonLabel();
  }

  // Init
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      bindToggle();
      installVisibilityObserver();
    }, { once: true });
  } else {
    bindToggle();
    installVisibilityObserver();
  }

})(jQuery);
