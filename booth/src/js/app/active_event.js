/* SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
 */

/**
 * active_event.js — Active Event UI bindings (optional)
 *
 * Kapselt die UI-Bindings für das "Active Event"-Modal:
 * - Open-Button: #btnActiveEvent oder [data-pb-action="open-active-event"]
 * - Modal:       #modalActiveEvent (Bootstrap Modal)
 *
 * Hinweis: JSON↔Form-Binding erfolgt in modal_config_bindings.js (data-json-file am Form).
 */


(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  /**
   * Zweck: Öffnet das Active-Event Modal, falls vorhanden.
   * Handhabung: PB.openActiveEventModal();
   */
  PB.openActiveEventModal = PB.openActiveEventModal || function () {
    const el = document.getElementById('modalActiveEvent');
    if (!el) return;

    // Bootstrap 5: new bootstrap.Modal(el).show()
    if (window.bootstrap && typeof window.bootstrap.Modal === 'function') {
      try { (new window.bootstrap.Modal(el)).show(); } catch (e) { console.warn(e); }
      return;
    }
    // Fallback: via jQuery trigger (Bootstrap 4)
    try { $(el).modal('show'); } catch (e) { /* ignore */ }
  };

  /**
   * Zweck: Bindings für Active-Event UI.
   * Handhabung: Einmal beim Start: PB.initActiveEventBindings()
   */
  /**
   * Berechnet den automatischen Speicherpfad aus booth/photos/EVENTS/<eventname>
   * und aktualisiert das hidden Input + das Display-Feld.
   */
  function _updateStoragePath() {
    const $hidden  = $('#eventStoragePath');
    const $display = $('#eventStoragePathDisplay');
    if (!$hidden.length) return;

    const photosBase = String($hidden.attr('data-photos-base') || '').trim();
    if (!photosBase) return;

    const rawName = String($('#eventNamse').val() || '').trim();
    const sep     = photosBase.includes('\\') ? '\\' : '/';

    let fullPath;
    if (rawName) {
      const safeName = rawName.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').replace(/\.+$/, '').trim();
      fullPath = [photosBase, safeName].join(sep);
    } else {
      fullPath = photosBase;
    }

    $hidden.val(fullPath);
    $display.val(fullPath);
  }

  PB.initActiveEventBindings = PB.initActiveEventBindings || function () {
    $(document).on('click', '#btnActiveEvent, [data-pb-action="open-active-event"]', function (ev) {
      ev.preventDefault();
      PB.openActiveEventModal();
    });

    // Pfad automatisch aktualisieren wenn Eventname getippt wird
    $(document).on('input change', '#eventNamse', function () {
      _updateStoragePath();
    });

    // Pfad beim Öffnen des Modals aktualisieren (JSON wurde gerade geladen)
    $(document).on('shown.bs.modal', '#modalActiveEvent', function () {
      _updateStoragePath();
    });
    // Auch nach dem JSON-Laden (configLoaded event)
    $(document).on('pb:configLoaded', function (e, cfg, key) {
      if (key === 'activeEvent') _updateStoragePath();
    });

    $(document).on('click', '#btnNewEvent', function (ev) {
      ev.preventDefault();
      PB.newEventWizard();
    });

    // Eigener Foto-Explorer (Kiosk-kompatibler Ersatz für Windows Explorer)
    $(document).on('click', '#btnOpenPhotoExplorer', function (ev) {
      ev.preventDefault();
      if (PB.photoExplorer && typeof PB.photoExplorer.open === 'function') {
        PB.photoExplorer.open();
      }
    });
  };

  /**
   * Führt den "Neues Event"-Wizard via JS prompt() durch.
   * Fragt: Eventname → Max. Ausdrucke → Bestätigung → setzt Felder + Druckzähler auf 0.
   */
  PB.newEventWizard = function () {
    const t = (key, fallback) => (PB.t ? PB.t(key, fallback) : fallback);

    // 1. Eventname
    const nameRaw = window.prompt(
      t('overlay.active_event.new_event.prompt.event_name',
        'Event name:\n(Used as folder name – no special characters like \\ / : * ? " < > |)')
    );
    if (nameRaw === null) return;
    const name = nameRaw.trim();
    if (!name) {
      window.alert(t('overlay.active_event.new_event.err.name_empty', 'No event name entered. Aborted.'));
      return;
    }

    // 2. Max. Ausdrucke
    const maxRaw = window.prompt(
      t('overlay.active_event.new_event.prompt.max_prints', 'Maximum number of prints:\n(0 = unlimited)'),
      '0'
    );
    if (maxRaw === null) return;
    const maxVal = parseInt(maxRaw.trim(), 10);
    if (isNaN(maxVal) || maxVal < 0) {
      window.alert(t('overlay.active_event.new_event.err.max_invalid', 'Invalid number. Please enter a number. Aborted.'));
      return;
    }

    // 3. Bestätigung
    const confirmMsg = t('overlay.active_event.new_event.confirm',
      'A new event will be created:\n\nEvent name: {name}\nMax. prints: {max}\nPrint counter will be reset to 0.\n\nContinue?')
      .replace('{name}', name)
      .replace('{max}', maxVal);
    if (!window.confirm(confirmMsg)) return;

    // 4. Felder setzen
    const $eventName = $('#eventNamse');
    const $maxPrints = $('#eventMaxPrints');
    const $printCounter = $('#eventPrintCounter');

    if ($eventName.length)    $eventName.val(name).trigger('change');
    if ($maxPrints.length)    $maxPrints.val(maxVal).trigger('change');
    if ($printCounter.length) $printCounter.val(0).trigger('change');

    window.alert(
      t('overlay.active_event.new_event.success', 'New event "{name}" saved.')
        .replace('{name}', name)
    );
  };
})(jQuery);
