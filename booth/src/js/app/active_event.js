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

  /**
   * Befüllt #activeTemplatePreviewWrap mit einem klickbaren Thumbnail pro
   * aktuell aktivem Template-Slot (activeTemplate/<n>/preview.jpg).
   * Liest ausschließlich aus PB_CONFIG.activeTemplates, das bereits von
   * template_selector.js geladen wird (kein zusätzlicher Request hier).
   * Klick auf ein Thumbnail öffnet erneut die Dateiauswahl
   * (#eventTemplateZip), um dieses Template zu ersetzen.
   */
  function _renderActiveTemplatePreviews() {
    const $wrap = $('#activeTemplatePreviewWrap');
    if (!$wrap.length) return;

    const info = (window.PB_CONFIG && window.PB_CONFIG.activeTemplates) || {};
    const templates = Array.isArray(info.templates) ? info.templates : [];

    $wrap.empty();

    templates.forEach((tpl) => {
      if (!tpl.hasPreview) return; // noch kein preview.jpg im Template vorhanden

      const $thumb = $('<img>')
        .attr('src', tpl.previewUrl)
        .attr('alt', tpl.label || ('#' + tpl.slot))
        .attr('title', PB.t ? PB.t('overlay.active_event.template.preview_zoom', 'Vorschau vergrößern') : 'Vorschau vergrößern')
        .attr('draggable', 'false')
        .css({
          width: '90px',
          height: '120px',
          objectFit: 'cover',
          borderRadius: '0.5rem',
          cursor: 'zoom-in',
          border: '2px solid rgba(255,255,255,0.25)'
        })
        .on('click', function () {
          _openTemplatePreviewLightbox(tpl.previewUrl, tpl.label || ('#' + tpl.slot));
        });

      $wrap.append($thumb);
    });
  }

  /**
   * Zeigt preview.jpg eines Templates als großes Overlay an (reine
   * Sichtkontrolle, kein Datei-Dialog). Schließt bei Klick auf Overlay
   * oder Escape.
   */
  function _openTemplatePreviewLightbox(src, label) {
    $('#activeTemplatePreviewLightbox').remove();

    const $overlay = $('<div>')
      .attr('id', 'activeTemplatePreviewLightbox')
      .css({
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'rgba(0,0,0,0.85)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50070,
        cursor: 'zoom-out'
      })
      .on('click', function () {
        $(this).remove();
      });

    const $img = $('<img>')
      .attr('src', src)
      .attr('alt', label)
      .css({
        maxWidth: '90vw',
        maxHeight: '90vh',
        borderRadius: '0.5rem',
        boxShadow: '0 0 2rem rgba(0,0,0,0.6)'
      });

    $overlay.append($img).appendTo('body');

    $(document).one('keydown.activeTemplatePreviewLightbox', function (ev) {
      if (ev.key === 'Escape') $('#activeTemplatePreviewLightbox').remove();
    });
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
      // Stets frisch vom Server laden: zeigt zuverlässig das/die aktuell
      // aktive(n) Template(s) an, unabhängig davon, ob PB_CONFIG.activeTemplates
      // schon zuvor (z.B. durch den Startbildschirm) befüllt wurde.
      if (PB.templateSelector && typeof PB.templateSelector.refresh === 'function') {
        PB.templateSelector.refresh().done(_renderActiveTemplatePreviews);
      } else {
        _renderActiveTemplatePreviews();
      }
    });
    // Auch nach dem JSON-Laden (configLoaded event)
    $(document).on('pb:configLoaded', function (e, cfg, key) {
      if (key === 'activeEvent') _updateStoragePath();
    });

    // Nach jedem erfolgreichen Template-Upload: Vorschau sofort aktualisieren.
    $(document).on('pb:activeTemplatesLoaded', function () {
      _renderActiveTemplatePreviews();
    });

    // Sobald Datei(en) gewählt werden: sofort hochladen + installieren,
    // ohne auf den Speichern-Button zu warten. Der Speichern-Button bleibt
    // für die übrigen Formularfelder (Eventname, Pfad, Drucklimits, ...)
    // weiterhin nötig; sein ZIP-Upload-Versuch läuft danach ins Leere, da
    // der Input hier bereits geleert wird.
    $(document).on('change', '#eventTemplateZip', function () {
      const $modal = $(this).closest('#modalActiveEvent');
      if (!$modal.length || typeof PB.uploadActiveEventTemplateZip !== 'function') return;

      PB.uploadActiveEventTemplateZip($modal)
        .done(function (res) {
          if (res && res.skipped) return;
          PB.templateSelector?.refresh().done(_renderActiveTemplatePreviews);
        });
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
