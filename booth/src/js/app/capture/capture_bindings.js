// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * capture_bindings.js — UI Bindings für Start der Foto-Serie
 *
 * Zweck:
 *   - Verbindet UI-Elemente (z.B. Startbereich/Button) mit PB.captureFlow.start(required, photoTarget)
 *
 * Erwartete Elemente:
 *   #start-area
 *   [data-pb-action="start"]
 */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  /**
   * Startet den Capture Flow (mit Parametern)
   */
  async function startCapture(required, photoTarget) {
    if (!PB.captureFlow || typeof PB.captureFlow.start !== 'function') return;
    try {
      await PB.captureFlow.start(required, photoTarget);
    } catch (e) {
      console.warn('captureFlow.start failed:', e);
    }
  }

  /**
   * Registriert UI-Handler für Capture Start.
   * Einmal beim Start: PB.initCaptureBindings()
   */
  PB.initCaptureBindings = PB.initCaptureBindings || function () {
    $(document)
      .off('click.pbCapture', '#start-area, [data-pb-action="start"]')
      .on('click.pbCapture', '#start-area, [data-pb-action="start"]', async function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        // i18n helper: PB.t(key, fallback) falls vorhanden, sonst fallback
        const pbT = (key, fallback) => (PB.t ? PB.t(key, fallback) : fallback);

        try {
          // Falls globale Config nicht vorhanden oder unvollständig → neu laden
          if (!window.PB_CONFIG || !PB_CONFIG.activeEvent || !PB_CONFIG.camera.camera_settings || !PB_CONFIG.general) {
            console.warn('[capture] PB_CONFIG missing or incomplete → reloading');
            await PB.loadAllConfigs({ silent: true });
          }

          const ae = PB._getDeep(PB_CONFIG, 'activeEvent.active_event');
          const cam = PB._getDeep(PB_CONFIG, 'camera.camera_settings');
          const gen = PB._getDeep(PB_CONFIG, 'general') || {};

          const required = {
            os: gen.system.os,
            eventName: ae?.eventName,
            path: ae?.photo_storage_path,
            multiplePrint: ae?.multiple_print,
            printCounter: ae?.print_counter,

            activeTemplatePath: gen.activeTemplate.path,
            activeTemplateXml: gen.activeTemplate.path + 'template.xml',

            renderConfig: gen.python.renderConfig,

            iso: cam?.iso,
            shutter: cam?.shutter,
            aperture: cam?.aperture,
            wb: cam?.wb,
            exposure: cam?.exposure,
            useSettings: cam?.use_settings_for_picture,

            liveview: cam?.liveview_always_active,
            liveview_fps_idle: cam?.liveview_fps_idle,
            liveview_fps_active: cam?.liveview_fps_active,
            liveview_always_active: cam?.liveview_always_active,

            autoPrint: gen.print.print_automatically_when_finish,
            silentPrint: gen.print.silent,
            printerCount: PB._getDeep(gen, 'printer.printerCount'),

            counter_after_finish_serie: gen.capture.counter_after_finish_serie,
            counter_between_each_photo: gen.capture.counter_between_each_photo,
            counter_pre_capture: gen.capture.counter_until_capture,
            counter_first_image: gen.capture.counter_first_image,
            show_finish_image: gen.capture.show_finish_image
          };

          console.log('[capture] Check variables:', required);

          // Validierung
          const missing = Object.entries(required)
            .filter(([k, v]) => v === undefined || v === null || v === '')
            .map(([k]) => k);

          if (missing.length) {
            const msg =
              pbT('capture.start.err.missing_config_values', 'Missing configuration values:') +
              '\n' +
              missing.join(', ');
            PB.showMsg && PB.showMsg(msg, 'warning');
            return;
          }

          // Template.xml info holen
          const templateErrorText = (code) => {
            switch (String(code || '')) {
              case 'TEMPLATE_XML_MISSING':
                return pbT('template.err.missing', 'Template file is missing (template.xml).');
              case 'TEMPLATE_XML_INVALID':
                return pbT('template.err.invalid_xml', 'Template is invalid (XML error).');
              case 'TEMPLATE_NO_PHOTO_LAYERS':
                return pbT('template.err.no_photos', 'Template contains no photo slots.');
              default:
                return pbT('template.err.unknown', 'Template error (unknown).');
            }
          };

          const tplUrl = 'api/template_info.php?_=' + Date.now();
          let tplInfo;

          try {
            tplInfo = await PB.getJson(tplUrl);
          } catch (e) {
            PB.showMsg && PB.showMsg(pbT('template.err.request_failed', 'Template info could not be loaded.'), 'warning');
            return;
          }

          if (!tplInfo || !tplInfo.ok || !tplInfo.photo_count) {
            PB.showMsg && PB.showMsg(templateErrorText(tplInfo?.code), 'warning');
            if (tplInfo?.debug) (PB._dbg || console.log)('[template] debug:', tplInfo.debug);
            return;
          }

          PB.capturePhotoTarget = Number(tplInfo.photo_count);
          console.log('[capture] photo slots from template.xml =', PB.capturePhotoTarget);

          // Capture starten
          console.log('[capture] All ok, starting capture…');
          PB.ensureCaptureTmpDir();
          await startCapture(required, PB.capturePhotoTarget);
        } catch (err) {
          console.error('[capture] Error while starting:', err);
          const msg =
            pbT('capture.start.err.failed', 'Error while starting:') +
            (err && err.message ? '\n' + err.message : '');
          PB.showMsg && PB.showMsg(msg, 'warning');
        }
      });
  };
})(jQuery);
