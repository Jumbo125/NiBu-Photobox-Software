/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 * ============================================================================
 * app_bootstrap.js — Bootstrap/Startup (Configs laden, UI anwenden, Sprache, Device-Init)
 *
 * Lädt beim Start alle Konfigdateien (PB.loadAllConfigs, falls vorhanden),
 * setzt Sprache aus general.language und feuert pb:configLoaded, sobald alles da ist.
 * ============================================================================
 */
(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  // i18n helper (fallback, falls pbT noch nicht verfügbar ist)
  const tr = (key, fallback) => (typeof pbT === 'function' ? pbT(key, fallback) : fallback);

  // Default: welche Datei soll als "Hauptconfig" geladen werden? (Fallback/Kompatibilität)
  PB.MAIN_CONFIG_FILE = PB.MAIN_CONFIG_FILE || 'config/config.json';

  /**
   * Setzt die aktuelle Sprache anhand general.language oder Fallback.
   */
  function syncLanguageFromConfig() {
    const lang = String(PB._getDeep?.(window.PB_CONFIG, 'general.language') ?? '').trim();
    PB.currentLanguageCode = lang || PB.currentLanguageCode || 'en';
  }

  /**
   * Globales Modal-"show" Hook, um Labels nachzuladen (i18n).
   */
  function bindAutoApplyLanguageOnModals() {
    $(document).on('show.bs.modal', '.modal', function () {
      if (typeof PB.applyLanguage === 'function') PB.applyLanguage();
    });
  }

  /**
   * Bootstrap/Startup ausführen:
   * - Configs laden
   * - UI anwenden
   * - Sprache laden/anwenden
   * - Device-Init
   */
  PB.initBootstrap =
    PB.initBootstrap ||
    async function () {
      // 1) Alle Configs laden (Top-Layer Store)
      try {
        if (typeof PB.loadAllConfigs === 'function') {
          await PB.loadAllConfigs();
        } else if (typeof PB.loadConfigFileIntoGlobal === 'function') {
          // Fallback: alte Methode (nur 1 Datei)
          await new Promise((resolve) =>
            PB.loadConfigFileIntoGlobal(PB.MAIN_CONFIG_FILE).always(resolve)
          );
        } else {
          window.PB_CONFIG = window.PB_CONFIG || { general: {}, render: {}, camera: {}, activeEvent: {} };
        }
      } catch (e) {
        console.warn(tr('bootstrap.config.load_failed', 'Config load failed:'), e);
        window.PB_CONFIG = window.PB_CONFIG || { general: {}, render: {}, camera: {}, activeEvent: {} };
      }

      // window.PB_CONFIG ist ab hier befüllt
      (PB._dbg || console.log)(
        tr('bootstrap.config.loaded_trigger', '[Config] loaded → trigger pb:configLoaded'),
        PB._getDeep?.(window.PB_CONFIG, 'general.system.fullscreen')
      );

      // informiert alle Module (z. B. fullscreen, preview, etc.)
      $(document).trigger('pb:configLoaded', [window.PB_CONFIG]);

      // 2) UI aus Config anwenden (Background etc.)
      if (typeof PB.applyUiFromConfig === 'function') {
        try {
          PB.applyUiFromConfig();
        } catch (e) {
          console.warn(e);
        }
      }

      (PB._dbg || console.log)(
        tr('bootstrap.config.fullscreen_value', '[Config] general.system.fullscreen ='),
        PB._getDeep?.(window.PB_CONFIG, 'general.system.fullscreen'),
        JSON.stringify(window.PB_CONFIG?.general || {})
      );

      // 2b) UI-Fullscreen (CSS) initialisieren + Buttons binden
      if (typeof PB.initUiFullscreenBindings === 'function') {
        try {
          PB.initUiFullscreenBindings();
        } catch (e) {
          console.warn(e);
        }
      } else if (typeof PB.updateFullscreenState === 'function') {
        try {
          PB.updateFullscreenState();
        } catch (e) {
          console.warn(e);
        }
      }

      // 3) Sprache setzen + laden
      syncLanguageFromConfig();
      bindAutoApplyLanguageOnModals();

      if (typeof PB.loadLanguage === 'function') {
        try {
          PB.loadLanguage(PB.currentLanguageCode);
        } catch (e) {
          console.warn(e);
        }
      } else if (typeof PB.applyLanguage === 'function') {
        PB.applyLanguage();
      }

      // 4) Device-Selection / Bridge init (wenn vorhanden)
      if (typeof PB.initUnifiedDeviceSelection === 'function') {
        try {
          PB.initUnifiedDeviceSelection();
        } catch (e) {
          console.warn(e);
        }
      }
      if (PB.devices && typeof PB.devices.refreshUnifiedDeviceDropdown === 'function') {
        try {
          PB.devices.refreshUnifiedDeviceDropdown();
        } catch (e) {
          console.warn(e);
        }
      }

      // 5) Active Event UI einmal setzen
      if (typeof PB.updateActiveEventUI === 'function') {
        try {
          PB.updateActiveEventUI();
        } catch (e) {
          console.warn(e);
        }
      }

      // 6) Auto-Restore: gespeicherte Kamera selektieren + optional Liveview warmup
      if (typeof PB.restoreSavedCameraAndLiveviewFromConfig === 'function') {
        try {
          await PB.restoreSavedCameraAndLiveviewFromConfig();
        } catch (e) {
          console.warn(e);
        }
      }
    };

  // Active Event UI: aktuellen Eventnamen + Druckzähler anzeigen
  PB.updateActiveEventUI = function () {
    try {
      const ev = PB._getDeep(window.PB_CONFIG, 'activeEvent.active_event') || {};
      const name = ev.eventName || '';
      const count = ev.print_counter != null ? ev.print_counter : '';

      $('.active_event_title').html(name);
      $('.active_event_counter').html(count !== '' ? `(${count})` : '');
    } catch (e) {
      console.warn(tr('bootstrap.active_event.update_failed', '[updateActiveEventUI] failed:'), e);
    }
  };

  // Preview Video toggle
  const toBool = (v) => {
    if (v === true || v === 1) return true;
    if (v === false || v === 0 || v == null) return false;
    const s = String(v).trim().toLowerCase();
    return s === 'true' || s === '1' || s === 'yes' || s === 'on';
  };

  PB.applyPreviewMirror = function (enabled) {
    document.body.classList.toggle('pb-preview-mirrored', !!enabled);

    // Optional: zusätzlich direkt am Element (falls CSS überschrieben wird)
    const lf = document.getElementById('liveFrame');
    if (lf) lf.style.transform = enabled ? 'scaleX(-1)' : '';
  };

  PB.initIframeMirrorWatcher = function () {
    const lf = document.getElementById('liveFrame');
    if (!lf) return;

    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'src') {
          console.debug(
            tr('bootstrap.liveframe.src_changed_apply_mirror', '[PB] liveFrame src changed → apply mirror')
          );
          PB.applyPreviewMirror?.(lf.dataset.mirror === '1');
        }
      }
    });

    observer.observe(lf, { attributes: true });
  };

  PB.syncPreviewMirrorFromConfig = function () {
    const cfgVal = window.PB_CONFIG?.camera?.camera_settings?.preview_mirror;
    const enabled = toBool(cfgVal);

    // Checkbox UI setzen
    const cb = document.getElementById('cameraPreviewMirror');
    if (cb) cb.checked = enabled;

    // Preview anwenden
    PB.applyPreviewMirror(enabled);

    const msg = tr('preview_mirror.sync_from_config', '[preview_mirror] sync from config =');
    if (typeof PB._dbg === 'function') PB._dbg(`${msg} ${enabled}`);
    else console.log(msg, enabled);
  };

  PB.initPreviewMirrorBindings =
    PB.initPreviewMirrorBindings ||
    function () {
      const cb = document.getElementById('cameraPreviewMirror');
      if (!cb) return;

      if (cb.dataset.pbMirrorBound === '1') return;
      cb.dataset.pbMirrorBound = '1';

      cb.addEventListener('change', function () {
        const enabled = !!cb.checked;

        PB.applyPreviewMirror(enabled);

        window.PB_CONFIG = window.PB_CONFIG || {};
        window.PB_CONFIG.camera = window.PB_CONFIG.camera || {};
        window.PB_CONFIG.camera.camera_settings = window.PB_CONFIG.camera.camera_settings || {};
        window.PB_CONFIG.camera.camera_settings.preview_mirror = enabled;

        const msg = tr('preview_mirror.changed', '[preview_mirror] changed =');
        (PB._dbg || console.log)(msg, enabled);
      });
    };

  // ========================================
  // Statisches Bild laden (togglebar mit Livevideo)
  // ========================================
  // Rendert/aktualisiert das <img> in #bgStaticImg
  PB.applyBgStaticImg = function (path) {
    const wrap = document.getElementById('bgStaticImg');
    if (!wrap) return;

    const p = String(path ?? '').trim();

    if (!p) {
      wrap.innerHTML = '';
      return;
    }

    let img = wrap.querySelector('img[data-role="bgStaticImg"]');
    if (!img) {
      img = document.createElement('img');
      img.dataset.role = 'bgStaticImg';
      img.alt = '';
      img.draggable = false;
      wrap.innerHTML = '';
      wrap.appendChild(img);
    }

    if (img.getAttribute('src') !== p) img.src = p;
  };

  // 1) Sync/Init: aus PB_CONFIG lesen und anwenden
  PB.syncBgStaticImgFromConfig = function () {
    const bgPath = String(PB._getDeep?.(window.PB_CONFIG, 'general.system.ui.bgStaticImg') ?? '').trim();
    PB.applyBgStaticImg(bgPath);

    (PB._dbg || console.log)(
      tr('bg_static_img.sync_from_config', '[bgStaticImg] sync from config ='),
      bgPath || tr('common.empty', '(empty)')
    );
  };

  // 2) Bind: Input im Settings-Modal live anwenden + PB_CONFIG aktuell halten
  PB.initBgStaticImgBindings =
    PB.initBgStaticImgBindings ||
    function () {
      const input = document.getElementById('uiBgStaticImg');
      if (!input) return;

      if (input.dataset.pbBgStaticImgBound === '1') return;
      input.dataset.pbBgStaticImgBound = '1';

      const handler = () => {
        const path = String(input.value ?? '').trim();

        // sofort anwenden
        PB.applyBgStaticImg(path);

        // PB_CONFIG aktualisieren
        window.PB_CONFIG = window.PB_CONFIG || {};
        window.PB_CONFIG.general = window.PB_CONFIG.general || {};
        window.PB_CONFIG.general.system = window.PB_CONFIG.general.system || {};
        window.PB_CONFIG.general.system.ui = window.PB_CONFIG.general.system.ui || {};
        window.PB_CONFIG.general.system.ui.bgStaticImg = path;

        (PB._dbg || console.log)(
          tr('bg_static_img.changed', '[bgStaticImg] changed ='),
          path || tr('common.empty', '(empty)')
        );
      };

      input.addEventListener('input', handler); // live während Tippen
      input.addEventListener('change', handler); // fallback
    };
})(jQuery);
