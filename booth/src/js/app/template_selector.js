/* SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann */

/**
 * template_selector.js — Template-Auswahl auf dem Startbildschirm
 *
 * Zweck: Besteht mehr als ein aktives Template (siehe
 * .claude/ACTIVE_TEMPLATE.md — booth/activeTemplate/1/, /2/, ...), zeigt
 * diese Section dem Besucher eine Kachel-Auswahl, BEVOR der normale
 * Start-Bildschirm ("Touch to start") sichtbar wird.
 *
 * Wichtig — bewusst isoliert vom Capture-Flow:
 * - Liegt als #templateSelectArea INNERHALB von #start-area (main.php),
 *   als oberste Ebene (CSS: position:absolute, inset:0, höherer z-index).
 * - #start-area selbst wird weiterhin unverändert von capture_flow.js über
 *   PB.captureFlow.ui.setStartAreaVisible(true/false) ein-/ausgeblendet —
 *   an dieser Funktion wird NICHTS geändert.
 * - Nach Auswahl wird NUR config/config.json: activeTemplate.path auf den
 *   gewählten Unterordner gepatcht (generischer Merge-Endpoint
 *   api/r_w_config.php). capture_bindings.js liest diesen Wert beim
 *   Start-Klick unverändert aus PB_CONFIG.general.activeTemplate.path.
 * - Die Auswahl selbst ist rein clientseitig/flüchtig: kein "letzte Wahl"
 *   wird dauerhaft gespeichert. Ein Reload zeigt wieder die Kachel-Auswahl.
 */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  const ENDPOINT_LIST = 'api/list_active_templates.php';
  const CONFIG_FILE_GENERAL = (PB.CONFIG_PATHS && PB.CONFIG_PATHS.general) || 'config/config/config.json';

  let _templates = [];
  let _selectedSlot = null;

  function t(key, fallback) {
    return PB.t ? PB.t(key, fallback) : fallback;
  }

  function $area() {
    return $('#templateSelectArea');
  }

  function $grid() {
    return $('#templateSelectGrid');
  }

  /**
   * Baut die Kachel-Liste aus den zuletzt geladenen Templates.
   */
  function renderTiles() {
    const $g = $grid();
    $g.empty();

    _templates.forEach((tpl) => {
      const $tile = $('<div>')
        .addClass('template-select-tile')
        .attr('data-slot', tpl.slot)
        .attr('tabindex', '0')
        .attr('role', 'button');

      const $img = $('<img>')
        .attr('alt', t('screen.template_select.preview_alt', 'Template preview'))
        .attr('src', tpl.previewUrl || '');

      if (!tpl.hasPreview) {
        // Kein preview.jpg vorhanden -> Platzhalter, kein kaputtes <img>.
        $img.attr('src', '').css('visibility', 'hidden');
      }

      const $label = $('<div>')
        .addClass('template-select-label')
        .text(tpl.label || ('#' + tpl.slot));

      $tile.append($img, $label);
      $g.append($tile);
    });
  }

  /**
   * Zeigt die Auswahl-Section an (innerhalb von #start-area).
   */
  function showSelector() {
    _selectedSlot = null;
    $area().removeClass('d-none');
  }

  /**
   * Blendet die Auswahl-Section wieder aus — darunter wird der normale
   * Start-Inhalt ("Touch to start") sichtbar.
   */
  function hideSelector() {
    $area().addClass('d-none');
  }

  /**
   * Patcht NUR config.json: activeTemplate.path auf den gewählten
   * Unterordner. Löst capture_bindings.js NICHT aus — der Wert wird erst
   * beim nächsten Start-Klick gelesen (gen.activeTemplate.path).
   */
  function applySelection(slot) {
    const base = String(PB._getDeep(window.PB_CONFIG, 'general.activeTemplate.path') || '').trim();
    if (!base) {
      console.warn('[templateSelector] activeTemplate.path missing in PB_CONFIG.general');
      return $.Deferred().reject('missing_base_path').promise();
    }

    const sep = base.includes('\\') ? '\\' : '/';
    const trimmedBase = base.replace(/[\\/]+$/, '');

    // Wurzel-Ordnername von activeTemplate.path ohne Zahl-Unterordner
    // ermitteln: der Pfad zeigt bereits auf .../activeTemplate[/n], wir
    // normalisieren ihn auf .../activeTemplate und hängen den neuen Slot an.
    const parts = trimmedBase.split(/[\\/]/);
    const last = parts[parts.length - 1];
    const isNumericLast = /^[0-9]+$/.test(last);
    const rootParts = isNumericLast ? parts.slice(0, -1) : parts;
    const newPath = rootParts.join(sep) + sep + slot + sep;

    return PB.configFileSet(CONFIG_FILE_GENERAL, { activeTemplate: { path: newPath } })
      .done(() => {
        PB._setDeep(window.PB_CONFIG, 'general.activeTemplate.path', newPath);
        _selectedSlot = slot;
      });
  }

  /**
   * Lädt die verfügbaren Template-Slots vom Server und entscheidet, ob die
   * Auswahl-Section überhaupt eingeblendet werden muss.
   * Schreibt das Ergebnis zusätzlich nach PB_CONFIG, damit andere Teile der
   * App (z.B. das "Aktives Event"-Settings-Modal für die Vorschau) nicht
   * erneut den Server fragen müssen.
   */
  PB.templateSelector = PB.templateSelector || {};

  PB.templateSelector.refresh = function () {
    return PB.getJson(ENDPOINT_LIST + '?_=' + Date.now())
      .done((res) => {
        if (!res || !res.ok) return;

        _templates = Array.isArray(res.templates) ? res.templates : [];

        // Für andere Module zugänglich machen (z.B. active_event_settings
        // Thumbnail-Vorschau), ohne erneuten Request.
        window.PB_CONFIG = window.PB_CONFIG || {};
        window.PB_CONFIG.activeTemplates = {
          multiSlot: !!res.multiSlot,
          templateCount: res.templateCount || _templates.length,
          templates: _templates,
        };

        $(document).trigger('pb:activeTemplatesLoaded', [window.PB_CONFIG.activeTemplates]);
      })
      .fail((err) => {
        console.warn('[templateSelector] refresh failed', err);
      });
  };

  PB.templateSelector.hasMultiple = function () {
    const n = PB._getDeep(window.PB_CONFIG, 'activeTemplates.templateCount');
    return Number(n || 0) > 1;
  };

  /**
   * Zeigt die Auswahl nur, wenn mehr als 1 Template verfügbar ist.
   * Bei genau 1 Template bleibt die Section d-none, Start-Bildschirm zeigt
   * sich sofort normal — kein zusätzlicher Klick für den Normalfall.
   */
  PB.templateSelector.showIfNeeded = function () {
    if (PB.templateSelector.hasMultiple()) {
      renderTiles();
      showSelector();
    } else {
      hideSelector();
    }
  };

  PB.templateSelector.getSelectedSlot = function () {
    return _selectedSlot;
  };

  function initBindings() {
    $(document).on('click keydown', '.template-select-tile', function (ev) {
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();

      const slot = $(this).attr('data-slot');
      if (!slot) return;

      $('.template-select-tile').removeClass('is-selecting');
      $(this).addClass('is-selecting');

      applySelection(slot)
        .done(() => {
          hideSelector();
        })
        .fail(() => {
          PB.showMsg?.(
            t('screen.template_select.err.apply_failed', 'Could not select this template. Please try again.'),
            'danger'
          );
          $(this).removeClass('is-selecting');
        });
    });

    // Initial laden, sobald Configs verfügbar sind.
    $(document).on('pb:allConfigsLoaded', function () {
      PB.templateSelector.refresh().always(() => {
        PB.templateSelector.showIfNeeded();
      });
    });

    // Nach jedem ZIP-Upload im Active-Event-Modal (set_Active_template.php
    // liefert ggf. eine neue templateCount) direkt neu bewerten.
    $(document).on('pb:activeTemplatesLoaded', function () {
      PB.templateSelector.showIfNeeded();
    });

    // Capture-Flow komplett abgeschlossen (Erfolg/Fehler/Abbruch — dieses
    // Event feuert capture_flow.js bereits unverändert ganz am Ende, siehe
    // .claude/ACTIVE_TEMPLATE.md). #start-area wird von capture_flow.js
    // selbst wieder sichtbar geschaltet; wir setzen hier nur erneut die
    // Auswahl-Ebene davor, falls weiterhin mehrere Templates zur Wahl
    // stehen — ohne irgendetwas an capture_flow.js zu ändern.
    $(document).on('pb:captureFlowDone', function () {
      PB.templateSelector.showIfNeeded();
    });
  }

  $(initBindings);
})(jQuery);
