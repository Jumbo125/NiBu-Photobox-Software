// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  PB.initUiFullscreenBindings =
    PB.initUiFullscreenBindings ||
    function () {
      const dbg = PB._dbg || console.log;

      // Debug-Ausgaben (nicht UI-relevant)
      dbg(
        '[UI-FS] funcs:',
        'apply=',
        typeof PB.applyFullscreenFromConfig,
        'set=',
        typeof PB.setFullscreenUI,
        'toggle=',
        typeof PB.toggleFullscreen
      );
      dbg('[UI-FS] init bindings');

      // Beim Start anwenden (falls config schon da ist)
      PB.applyFullscreenFromConfig?.(window.PB_CONFIG);

      // Falls config später geladen wird: Event abfangen
      $(document)
        .off('pb:configLoaded.uiFs')
        .on('pb:configLoaded.uiFs', function (e, cfg) {
          dbg('[UI-FS] configLoaded event');
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
        setTimeout(() => $('#exitFullscreenPassword').trigger('focus'), 150);
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

      document
        .getElementById('modalExitFullscreen')
        ?.addEventListener('hidden.bs.modal', function () {
          $('#exitFullscreenPassword').val('').removeClass('is-invalid');
          $('#exitFullscreenError').addClass('d-none');
        });
    };
})(jQuery);
