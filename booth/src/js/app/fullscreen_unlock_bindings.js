// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  // Außerhalb der Funktion — überlebt mehrfache Aufrufe von initUiFullscreenBindings
  let _fsInitDone = false;

  PB.initUiFullscreenBindings =
    PB.initUiFullscreenBindings ||
    function () {
      const dbg = PB._dbg || console.log;

      dbg('[UI-FS] init bindings');

      // Beim allerersten Aufruf: Fullscreen aus Config anwenden
      if (!_fsInitDone) {
        PB.applyFullscreenFromConfig?.(window.PB_CONFIG);
      }

      // Listener nur einmal binden (off+on ist idempotent)
      $(document)
        .off('pb:configLoaded.uiFs')
        .on('pb:configLoaded.uiFs', function (e, cfg, key) {
          // Nur beim ersten Load oder wenn general-Config explizit gespeichert wurde
          if (_fsInitDone && key !== 'general') return;
          _fsInitDone = true;
          dbg('[UI-FS] configLoaded event, key=', key);
          PB.applyFullscreenFromConfig?.(cfg);
        });

      // Button: UI-Fullscreen toggeln (delegated)
      $(document)
        .off('click.uiFs', '#btnFullscreen')
        .on('click.uiFs', '#btnFullscreen', function (e) {
          e.preventDefault();
          e.stopPropagation();
          dbg('[UI-FS] btnFullscreen click');
          PB.toggleFullscreen?.();
        });

      // Exit-Fullscreen Modal
      let exitFsModal = null;

      function openExitFullscreenModal() {
        const modalEl = document.getElementById('modalExitFullscreen');
        if (!modalEl || !window.bootstrap?.Modal) return;

        exitFsModal = bootstrap.Modal.getOrCreateInstance(modalEl, {
          backdrop: 'static',
          keyboard: false
        });

        $('#exitFullscreenPassword').val('');
        $('#exitFullscreenError').addClass('d-none');
        $('#exitFullscreenPassword').removeClass('is-invalid');

        exitFsModal.show();
      }

      function confirmExitFullscreen() {
        const entered = String($('#exitFullscreenPassword').val() || '').trim();
        const correct =
          typeof PB.getSystemPassword === 'function' ? PB.getSystemPassword() : '';
        const allowed = correct === '' ? true : entered === correct;

        if (allowed) {
          $('#exitFullscreenError').addClass('d-none');
          $('#exitFullscreenPassword').removeClass('is-invalid');
          exitFsModal?.hide();

          // Nur UI zurückstellen (kein echtes Browser-Fullscreen)
          PB.setFullscreenUI?.(false);
          dbg('[UI-FS] exited');
          return;
        }

        $('#exitFullscreenError').removeClass('d-none');
        $('#exitFullscreenPassword')
          .addClass('is-invalid')
          .val('')
          .trigger('focus');
      }

      $(document)
        .off('click.uiFsExit', '#btnExitFullscreen')
        .on('click.uiFsExit', '#btnExitFullscreen', function (e) {
          e.preventDefault();
          e.stopPropagation();
          dbg('[UI-FS] btnExitFullscreen click');
          openExitFullscreenModal();
        });

      $(document)
        .off('click.uiFsExitOk', '#btnExitFullscreenConfirm')
        .on('click.uiFsExitOk', '#btnExitFullscreenConfirm', function (e) {
          e.preventDefault();
          e.stopPropagation();
          confirmExitFullscreen();
        });

      $(document)
        .off('keydown.uiFsExit', '#exitFullscreenPassword')
        .on('keydown.uiFsExit', '#exitFullscreenPassword', function (e) {
          if (e.key === 'Enter') {
            e.preventDefault();
            confirmExitFullscreen();
          }
        });

      $(document)
        .off('keydown.uiFsEscOpen')
        .on('keydown.uiFsEscOpen', function (e) {
          if (e.key === 'Escape' && PB.isFullscreen?.()) {
            e.preventDefault();
            openExitFullscreenModal();
          }
        });

      document
        .getElementById('modalExitFullscreen')
        ?.addEventListener('hidden.bs.modal', function () {
          $('#exitFullscreenPassword').val('').removeClass('is-invalid');
          $('#exitFullscreenError').addClass('d-none');
        });
    };
})(jQuery);
