/*
SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
*/

/**
 * modal_config_bindings.js — AutoLoad/Save für Config-Modale (JSON ↔ Form)
 *
 * Zweck:
 *   - Beim Öffnen eines Modals: JSON laden und in die Form schreiben.
 *   - Beim Speichern: Form in Patch-Objekt umwandeln und in JSON speichern.
 *
 * Voraussetzungen:
 *   - edit_config.js (PB.applyConfigToForm, PB.formToPatch)
 *   - config_io.js (PB.configFileGet, PB.configFileSet)
 *   - jQuery + Bootstrap Modal Events (shown.bs.modal)
 */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  /**
   * Zweck: Deep-Merge patchObj in target.
   * Handhabung: mergeInto(window.PB_CONFIG[key], patchObj)
   */
  function mergeInto(target, patchObj) {
    if (!target || typeof target !== 'object') return;
    if (!patchObj || typeof patchObj !== 'object') return;

    Object.keys(patchObj).forEach(function (k) {
      const v = patchObj[k];
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        if (!target[k] || typeof target[k] !== 'object' || Array.isArray(target[k])) target[k] = {};
        mergeInto(target[k], v);
      } else {
        target[k] = v;
      }
    });
  }

  /**
   * Zweck: Holt das "Config Object" aus API-Response (GET).
   * Handhabung: unterstützt {ok:true,data:{...}} oder direkt {...}
   */
  function unwrapConfig(res) {
    if (!res) return {};
    if (res.ok && typeof res.data === 'object') return res.data || {};
    if (typeof res === 'object') return res;
    return {};
  }

  /**
   * Zweck: "volle Config" aus POST Response erkennen (optional).
   * Manche Backends liefern {ok:true,data:{...}} (voll), andere nur {ok:true}.
   */
  function unwrapWriteFullConfig(res) {
    if (res && res.data && typeof res.data === 'object') return res.data;
    if (res && res.config && typeof res.config === 'object') return res.config;
    return null;
  }

  /**
   * Zweck: Findet die relevante Form in einem Modal (per data-json-file oder data-target-form).
   */
  function findFormInModal($modal, btnEl) {
    if (btnEl && btnEl.dataset && btnEl.dataset.targetForm) {
      const sel = btnEl.dataset.targetForm;
      const $f = $modal.find(sel);
      if ($f.length) return $f.first();
    }
    const $forms = $modal.find('form[data-json-file], form[data-pb-json-file]');
    if ($forms.length) return $forms.first();
    const $any = $modal.find('form');
    return $any.length ? $any.first() : $();
  }

  // ============================================================================
  // SPECIAL CASE: Select-Device Modal -> selected_camera Hidden Inputs syncen
  // ============================================================================

  function isSelectDeviceModal($modal) {
    const modalId = ($modal.attr('id') || '').trim();
    const ariaLbl = ($modal.attr('aria-labelledby') || '').trim();
    return (modalId === 'modalSelectDevice' || ariaLbl === 'modalSelectDeviceLabel');
  }

  function normalizeDeviceObj(dev, fallbackId) {
    return {
      usb_id: String(dev?.UsbId ?? dev?.usb_id ?? dev?.Id ?? dev?.id ?? fallbackId ?? ''),
      id: String(dev?.Id ?? dev?.id ?? fallbackId ?? ''),
      display_name: String(dev?.DisplayName ?? dev?.display_name ?? dev?.displayName ?? dev?.Name ?? ''),
      manufacturer: String(dev?.Manufacturer ?? dev?.manufacturer ?? ''),
      model: String(dev?.Model ?? dev?.model ?? ''),
      serial: String(dev?.Serial ?? dev?.serial ?? ''),
      port: String(dev?.Port ?? dev?.port ?? ''),
      is_connected: !!(dev?.IsConnected ?? dev?.is_connected ?? dev?.isConnected ?? false)
    };
  }

  function readSelectedCameraFromModal($modal) {
    // Select element: #settingDeviceSelected (oder legacy: #selCameraDevice)
    const $sel = $modal.find('#settingDeviceSelected, #selCameraDevice').first();
    if (!$sel.length) return { device: '', cam: null };

    const device = String($sel.val() ?? '').trim();
    const opt = $sel[0]?.selectedOptions?.[0];
    if (!opt) return { device, cam: null };

    // Option kann JSON als data-device / data-cam / data-camera enthalten
    const raw = opt.getAttribute('data-device')
      || opt.getAttribute('data-cam')
      || opt.getAttribute('data-camera')
      || '';

    if (!raw) return { device, cam: null };

    try {
      const devObj = JSON.parse(raw);
      return { device, cam: normalizeDeviceObj(devObj, device) };
    } catch (e) {
      console.warn('[SelectDevice] invalid JSON on selected <option>', e, raw);
      return { device, cam: null };
    }
  }

  function syncSelectDeviceHidden($modal) {
    // Nur wenn Hidden Inputs wirklich existieren (pbCam_* Felder)
    const hasAnyHidden =
      $modal.find('#pbCam_id, #pbCam_serial, #pbCam_display_name').length > 0;

    if (!hasAnyHidden) return;

    const { cam } = readSelectedCameraFromModal($modal);
    if (!cam) {
      // Wenn nix ausgewählt/parsebar -> leeren, damit nix "altes" gespeichert wird
      $modal.find('#pbCam_usb_id,#pbCam_id,#pbCam_display_name,#pbCam_manufacturer,#pbCam_model,#pbCam_serial,#pbCam_port,#pbCam_is_connected').val('');
      return;
    }

    $modal.find('#pbCam_usb_id').val(cam.usb_id);
    $modal.find('#pbCam_id').val(cam.id);
    $modal.find('#pbCam_display_name').val(cam.display_name);
    $modal.find('#pbCam_manufacturer').val(cam.manufacturer);
    $modal.find('#pbCam_model').val(cam.model);
    $modal.find('#pbCam_serial').val(cam.serial);
    $modal.find('#pbCam_port').val(cam.port);
    $modal.find('#pbCam_is_connected').val(cam.is_connected ? 'true' : 'false');

    (PB._dbg || console.log)('[SelectDevice] hidden synced', cam);
  }

  // ============================================================================
  // Loader
  // ============================================================================

  function loadFormFromJson($form) {
    const fileRel = $form.attr('data-json-file') || $form.attr('data-pb-json-file');
    if (!fileRel || typeof PB.configFileGet !== 'function' || typeof PB.applyConfigToForm !== 'function') return;

    const root = ($form.attr('data-json-root') || '').trim();

    PB.configFileGet(fileRel).done(function (res) {
      const cfg = unwrapConfig(res) || {};

      // Key aus Dateiname ableiten (z. B. camera, render, activeEvent, general)
      const key = (typeof PB.configKeyFromFile === 'function') ? PB.configKeyFromFile(fileRel) : 'general';

      // Initialisiere globale Struktur
      window.PB_CONFIG = window.PB_CONFIG || { general: {}, render: {}, camera: {}, activeEvent: {} };

      // korrektes Ersetzen ohne doppelte "general.general"
      if (key === 'general') {
        // "config.json" → direkt in PB_CONFIG.general schreiben (nicht nochmal verschachteln)
        window.PB_CONFIG.general = { ...cfg };
        console.log('[PB_CONFIG] general replaced ✔️', window.PB_CONFIG.general);
      } else {
        // andere JSONs → einfach ersetzen
        window.PB_CONFIG[key] = { ...cfg };
        console.log(`[PB_CONFIG] ${key} replaced ✔️`, window.PB_CONFIG[key]);
      }

      // Formular befüllen
      const data = root && typeof PB._getDeep === 'function'
        ? (PB._getDeep(cfg, root) || {})
        : cfg;

      // Worker.Args -> Worker.LogFile splitten (nur dieses Form)
      if (($form.attr('id') || '') === 'formCameraBridgeApiServerSettings') {
        try {
          if (typeof PB.pbSplitWorkerArgs === 'function') {
            PB.pbSplitWorkerArgs(data);
          }
        } catch (e) {
          console.warn('[LOAD] PB.pbSplitWorkerArgs failed:', e);
        }
      }

      PB.applyConfigToForm($form, data);
      if (typeof PB.applyLanguage === 'function') PB.applyLanguage();

      // Optional: Device-Hidden-Sync (falls SelectDevice-Modal)
      const $modal = $form.closest('.modal');
      if ($modal.length && isSelectDeviceModal($modal)) {
        syncSelectDeviceHidden($modal);
      }

      // Event auslösen
      $(document).trigger('pb:configLoaded', [window.PB_CONFIG, key, cfg]);

    }).fail(function (xhr) {
      console.warn('configFileGet failed:', fileRel, xhr && xhr.status);
    });
  }

  // ============================================================================
  // Saver
  // ============================================================================

  function saveFormToJson($form, btnEl, $modalOpt) {
    const fileRel = ($form.attr('data-json-file') || $form.attr('data-pb-json-file') || '').trim();

    const hasSet = (typeof PB.configFileSet === 'function');
    const hasF2P = (typeof PB.formToPatch === 'function');

    (PB._dbg || console.log)('[SAVE] fileRel=', fileRel, 'configFileSet=', typeof PB.configFileSet, 'formToPatch=', typeof PB.formToPatch);

    if (!fileRel) { (PB._dbg || console.log)('[SAVE] ABORT: no data-json-file on form'); return null; }
    if (!hasSet)  { (PB._dbg || console.log)('[SAVE] ABORT: PB.configFileSet missing'); return null; }
    if (!hasF2P)  { (PB._dbg || console.log)('[SAVE] ABORT: PB.formToPatch missing'); return null; }

    const root = ($form.attr('data-json-root') || '').trim();
    const $modal = ($modalOpt && $modalOpt.length) ? $modalOpt : $form.closest('.modal');

    // Select-Device: vor dem Patch nochmal Hidden syncen (failsafe)
    if ($modal.length && isSelectDeviceModal($modal)) {
      syncSelectDeviceHidden($modal);
    }

    // Patch erzeugen
    let patch = PB.formToPatch($form) || {};

    // Special case: CameraBridge ApiServer Settings -> Worker.Args + Worker.LogFile zusammenführen
    if (($form.attr('id') || '') === 'formCameraBridgeApiServerSettings') {
      try {
        patch = PB.pbNormalizeWorkerArgs(patch);
      } catch (e) {
        console.warn('[SAVE] pbNormalizeWorkerArgs failed:', e);
      }
    }

    // Select-Device: zusätzlich patch.camera.selected_camera injizieren (auch wenn Hidden mal fehlt)
    if ($modal.length && isSelectDeviceModal($modal)) {
      const { device, cam } = readSelectedCameraFromModal($modal);
      patch.camera = (patch.camera && typeof patch.camera === 'object') ? patch.camera : {};
      if (device) patch.camera.device = device;
      if (cam) patch.camera.selected_camera = cam;
    }

    // root handling
    let effectivePatch = patch;
    if (root && typeof PB._setDeep === 'function') {
      effectivePatch = {};
      PB._setDeep(effectivePatch, root, patch);
    }

    // Button nur im Single-Mode togglen (Multi-Mode macht das im Click-Handler)
    if (btnEl) btnEl.disabled = true;

    // Request speichern & returnen, damit Multi-Mode $.when warten kann
    const req = PB.configFileSet(fileRel, effectivePatch);

    req.done(function (res) {
      if (res && res.ok === false) {
        console.warn('configFileSet response not ok:', res);
      }

      // Lokales PB_CONFIG updaten (Backend kann volle Config liefern, sonst Patch mergen)
      const key = (typeof PB.configKeyFromFile === 'function') ? PB.configKeyFromFile(fileRel) : 'general';
      window.PB_CONFIG = window.PB_CONFIG || { general: {}, render: {}, camera: {}, activeEvent: {} };
      window.PB_CONFIG[key] = window.PB_CONFIG[key] || {};

      const fullCfg = unwrapWriteFullConfig(res);

      if (fullCfg && typeof fullCfg === 'object') {
        mergeInto(window.PB_CONFIG[key], fullCfg);
      } else {
        mergeInto(window.PB_CONFIG[key], effectivePatch);
      }

      // UI anwenden
      PB.applyUiFromConfig?.();

      // Sprache prüfen (meist in general.language)
      const lang = String(
        (PB._getDeep?.(window.PB_CONFIG, 'general.language') ?? window.PB_CONFIG?.language ?? '')
      ).trim();

      if (lang && lang !== PB.currentLanguageCode && typeof PB.loadLanguage === 'function') {
        PB.currentLanguageCode = lang;
        PB.loadLanguage(lang);
      }

      // Module informieren
      $(document).trigger('pb:configLoaded', [window.PB_CONFIG, key, window.PB_CONFIG[key]]);

      // Preview-Source ggf. neu setzen (z. B. wenn Mirror-Werte geändert wurden)
      PB.preview?.ensureRunning?.();

      // Modal nur im Single-Mode schließen.
      // Multi-Mode (btnEl=null) schließt am Ende der Click-Handler.
      if (btnEl) {
        const modalEl = $form.closest('.modal')[0];
        if (modalEl && window.bootstrap?.Modal) {
          bootstrap.Modal.getOrCreateInstance(modalEl).hide();
        }
      }

    }).fail(function (xhr) {
      console.warn('configFileSet failed:', fileRel, xhr && xhr.status);
    }).always(function () {
      // Button nur im Single-Mode wieder aktivieren
      if (btnEl) btnEl.disabled = false;
    });

    return req;
  }

  // ============================================================================
  // Init Bindings
  // ============================================================================

  PB.initModalConfigBindings = PB.initModalConfigBindings || function () {
    // Guard: niemals zweimal binden
    if (PB._modalCfgBound) return;
    PB._modalCfgBound = true;

    // AutoLoad wenn Modal angezeigt wird
    $(document)
      .off('shown.bs.modal.pbCfg', '.modal')
      .on('shown.bs.modal.pbCfg', '.modal', function () {
        const $modal = $(this);

        const $forms = $modal.find('form[data-json-file], form[data-pb-json-file]');
        if ($forms.length) {
          $forms.each(function () {
            const $form = $(this);
            const hasFile = $form.attr('data-json-file') || $form.attr('data-pb-json-file');
            if (hasFile) loadFormFromJson($form);
          });
        }

        // Select-Device: bei Modal open Hidden syncen
        if (isSelectDeviceModal($modal)) {
          syncSelectDeviceHidden($modal);
        }
      });

    // Select-Device: bei Dropdown-Change Hidden Inputs aktualisieren
    $(document)
      .off('change.pbSelectDeviceHidden', '#modalSelectDevice #settingDeviceSelected, #modalSelectDevice #selCameraDevice')
      .on('change.pbSelectDeviceHidden', '#modalSelectDevice #settingDeviceSelected, #modalSelectDevice #selCameraDevice', function () {
        const $modal = $(this).closest('.modal');
        if ($modal.length) syncSelectDeviceHidden($modal);
      });

    // Save-Button: innerhalb eines Modals
    $(document)
      .off('click.pbCfgSave', '.pb-save-config')
      .on('click.pbCfgSave', '.pb-save-config', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();

        const btnEl = this;
        const $modal = $(btnEl).closest('.modal');
        if (!$modal.length) return;

        const multiple =
          $(btnEl).attr('data-multiple-form') === '1' ||
          $(btnEl).attr('data-multiple-form') === 'true';

        // MULTI-MODE: mehrere Forms speichern
        if (multiple) {
          const $forms = $modal.find('form[data-json-file], form[data-pb-json-file]');
          if (!$forms.length) return;

          btnEl.disabled = true;
          const requests = [];

          $forms.each(function () {
            const $form = $(this);
            const req = saveFormToJson($form, null, $modal); // btnEl=null, sonst würde Modal schließen
            if (req && typeof req.then === 'function') requests.push(req);
          });

          $.when.apply($, requests)
            .done(function () {
              // nach allen Saves einmal Sprache/UI anwenden
              PB.applyUiFromConfig?.();
              PB.applyLanguage?.();

              // Modal am Ende schließen
              const modalEl = $modal[0];
              if (modalEl && window.bootstrap?.Modal) {
                bootstrap.Modal.getOrCreateInstance(modalEl).hide();
              }
            })
            .fail(function () {
              // mindestens ein Save ist fehlgeschlagen
              if (typeof showMsg === 'function') {
                const msg = (typeof pbT === 'function')
                  ? pbT(
                    'config.save.err.multi_failed',
                    'At least one configuration could not be saved. Note: If a JSON file is corrupt/invalid, it may have been backed up (see error message).'
                  )
                  : 'At least one configuration could not be saved. Note: If a JSON file is corrupt/invalid, it may have been backed up (see error message).';

                showMsg(msg, 'danger');
              }
            })
            .always(function () {
              btnEl.disabled = false;
            });

          return;
        }

        // NORMAL-MODE
        const $form = findFormInModal($modal, btnEl);
        if (!$form || !$form.length) return;

        const modalId = ($modal.attr('id') || '').trim();
        const ariaLbl = ($modal.attr('aria-labelledby') || '').trim();
        const isActiveEventModal =
          modalId === 'modalActiveEvent' ||
          modalId === 'modalActiveEventLabel' ||
          ariaLbl === 'modalActiveEventLabel';

        if (isActiveEventModal) {
          btnEl.disabled = true;

          PB.uploadActiveEventTemplateZip($modal)
            .done(function () {
              const req = saveFormToJson($form, btnEl, $modal);
              if (req && typeof req.always === 'function') req.always(() => (btnEl.disabled = false));
              PB.applyLanguage?.();
            })
            .fail(function () {
              btnEl.disabled = false;
              if (typeof showMsg === 'function') {
                const msg = (typeof pbT === 'function')
                  ? pbT('active_event.upload.err.failed', 'Active event template upload failed.')
                  : 'Active event template upload failed.';

                showMsg(msg, 'danger');
              }
            });

          return;
        }

        saveFormToJson($form, btnEl, $modal);
        PB.applyLanguage?.();
      });
  };

  // Alias/Kompatibilität (falls alte Module configFilePatch nutzen)
  PB.configFileSet = PB.configFileSet || function (fileRel, obj) {
    if (typeof PB.configFilePatch === 'function') return PB.configFilePatch(fileRel, obj);
    throw new Error('PB.configFileSet: neither configFileSet nor configFilePatch available');
  };

  PB.showBusyModal = function (id) {
    const el = document.getElementById(id);
    if (!el) return null;

    if (window.bootstrap?.Modal) {
      const m = bootstrap.Modal.getOrCreateInstance(el);
      m.show();
      return m;
    }

    if (window.jQuery) {
      $('#' + id).modal('show');
      return { hide: () => $('#' + id).modal('hide') };
    }

    return null;
  };

})(jQuery);
