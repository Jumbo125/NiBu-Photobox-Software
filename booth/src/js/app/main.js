// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ============================================================================
 * main.js — Single Entry Point (ersetzt app_init.js + app.js)
 * - genau EIN Startup-Pfad (kein doppeltes init)
 * - pb:configLoaded Listener VOR Bootstrap registrieren
 * - Reihenfolge: Listener → config-unabhängige Bindings → Bootstrap → restliche Bindings
 *
 * Hinweis:
 * preview_mirror Modul (PB.initPreviewMirrorBindings + PB.syncPreviewMirrorFromConfig)
 * muss VOR main.js geladen sein.
 * ========================================================================== */
(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  // Fallback: PB_CONFIG darf nie komplett fehlen
  window.PB_CONFIG = window.PB_CONFIG || {
    general: {},
    camera: { camera_settings: {} },
    render: {},
    activeEvent: {}
  };

  PB.CAPTURE_TMP_DIR_Prefix = '.ACTIVE_SESSION_TMP/TMP_BILDER/';
  PB.CAPTURE_TMP_Prefix = 'Photo_';

  const dbg = PB._dbg || console.log;

  // i18n Helper (Fallback wenn pbT nicht verfügbar ist)
  const T = (key, fallback) =>
    typeof window.pbT === 'function' ? window.pbT(key, fallback) : fallback;

  // Guard gegen Doppelstart (z.B. Script versehentlich 2x eingebunden)
  if (PB.__mainStarted) return;
  PB.__mainStarted = true;

   // -------------------------------------------------------------
// Utils
// -------------------------------------------------------------
PB.readBool = function (v) {
  if (v === true) return true;
  if (v === false) return false;
  return ["1", "true", "yes", "y", "on"].includes(
    String(v ?? "").trim().toLowerCase()
  );
};

  /**
   * Startet die App einmal sauber.
   */
  PB.initMain = async function () {
    dbg(T('main.log.initMain', '[main] initMain()'));

    // 1) Listener VOR Bootstrap registrieren
    $(document)
      .off('pb:configLoaded.main')
      .on('pb:configLoaded.main', function (_e, cfg) {
        dbg(T('main.log.configLoaded', '[main] pb:configLoaded received'), cfg);

        PB.startBridgePolling?.();
        PB.updateActiveEventUI?.();
      });

    $(document)
      .off('pb:allConfigsLoaded.main')
      .on('pb:allConfigsLoaded.main', function () {
        dbg(
          T(
            'main.log.allConfigsLoaded',
            '[main] pb:allConfigsLoaded → mirror + restore + liveview'
          )
        );

        PB.syncPreviewMirrorFromConfig?.();
        PB.initPreviewMirrorBindings?.();

        PB.syncBgStaticImgFromConfig?.();
        PB.initBgStaticImgBindings?.();

        PB.restoreSavedCameraAndLiveviewFromConfig?.();
      });

    // 2) Bindings, die ohne Config auskommen
    PB.initLiveviewToggleBindings?.();
    PB.initUiFullscreenBindings?.();
    PB.initModalConfigBindings?.();

    PB.bindNumericKeypad?.({
      modalSel: '#modalExitFullscreen',
      inputSel: '#exitFullscreenPassword',
      keypadSel: '#exitFullscreenKeypad',
      errorSel: '#exitFullscreenError'
    });

    PB.initDebugModeBindings?.();

    // 3) Bootstrap (lädt Configs + triggert pb:configLoaded / pb:allConfigsLoaded)
    if (typeof PB.initBootstrap === 'function') {
      await PB.initBootstrap();
    } else {
      dbg(
        T(
          'main.warn.initBootstrap_missing',
          '[main] WARN: PB.initBootstrap is not a function'
        )
      );
      $(document).trigger('pb:configLoaded', [window.PB_CONFIG]);
      $(document).trigger('pb:allConfigsLoaded');
    }

    // 4) Restliche Module/Bindings (typisch: nutzen Config)
    PB.initPreviewBindings?.();
    PB.initActiveEventBindings?.();
    PB.initFullscreenUnlockBindings?.();
    PB.initWindowsPickerBindings?.();
    PB.initCaptureBindings?.();

    // Picker-Server optional vorwärmen (nicht awaiten, damit initMain nicht blockiert)
    PB.python_server_initial?.().catch(function (err) {
      console.warn(
        T('main.warn.picker_warmup_failed', '[main] picker warm-up failed:'),
        err
      );
    });

    dbg(T('main.log.done', '[main] initMain() done'));
  };

  // Kompatibilität (falls irgendwo noch PB.initApp() genutzt wird)
  PB.initApp = PB.initMain;

  // DOM ready -> Start
  $(function () {
    Promise.resolve(PB.initMain()).catch(function (err) {
      console.warn(
        T('main.warn.initMain_failed', '[main] initMain failed:'),
        err
      );
    });

    document.querySelectorAll('[data-bs-toggle="tooltip"]').forEach((el) => {
      new bootstrap.Tooltip(el);
    });
  });

  //Camera Restore wenn alle configs geladen sind
  function runAfterConfigs() {
  dbg(T('main.log.allConfigsLoaded', '[main] pb:allConfigsLoaded → mirror + restore + liveview'));

  PB.syncPreviewMirrorFromConfig?.();
  PB.initPreviewMirrorBindings?.();

  PB.syncBgStaticImgFromConfig?.();
  PB.initBgStaticImgBindings?.();

  PB.restoreSavedCameraAndLiveviewFromConfig?.().catch((e) => {
    console.warn(e);
    PB._dbg?.(e);
  });
}

// Event (für normalfall)
$(document)
  .off('pb:allConfigsLoaded.main')
  .on('pb:allConfigsLoaded.main', runAfterConfigs);

// Falls main.js erst NACH dem Load kommt:
if (PB._configsLoaded) {
  runAfterConfigs();
}

})(jQuery);
