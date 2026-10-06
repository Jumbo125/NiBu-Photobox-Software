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
   * Wartet kurz, bis die Kamera-LiveView tatsächlich läuft (oder maximal
   * WAIT_MS ms vergangen sind), bevor der Capture-Start ausgelöst wird.
   * Reiner Komfort-Puffer für den Fall "Besucher klickt sofort nach dem
   * Öffnen der Seite auf eine Kachel, Kamera läuft noch hoch" — löst NICHTS
   * an capture_flow.js' eigener, robusterer Readiness-Prüfung, reduziert nur
   * die Chance, dass deren kürzerer (Nicht-Erstlauf-)Timeout zuschlägt.
   */
  function _waitForLiveviewThenStart() {
    const WAIT_MS = 3000;
    const POLL_MS = 150;
    const deadline = Date.now() + WAIT_MS;

    function tick() {
      if (PB._bridgeLastHealth?.liveViewRunning || Date.now() >= deadline) {
        $('#start-area').trigger('click');
        return;
      }
      setTimeout(tick, POLL_MS);
    }

    tick();
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

    // activeTemplate.path zeigt immer auf .../activeTemplate[/n] (n = Zahl),
    // da der Server inzwischen für jedes Template ausnahmslos einen
    // nummerierten Unterordner anlegt (set_Active_template.php,
    // template_set_active.php). Letztes Segment abschneiden, falls
    // numerisch, und den neu gewählten Slot anhängen.
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
    // #templateSelectArea liegt INNERHALB von #start-area, dessen
    // document-delegierter Klick-Handler (capture_bindings.js) bei jedem
    // Klick den Capture-Flow startet. Solange die Auswahl sichtbar ist,
    // MUSS der Besucher erst ein Template wählen — ein Klick daneben
    // (z.B. auf Titel/Hintergrund der Auswahl-Section) darf also nicht
    // zum Start durchsickern.
    //
    // Wichtig: direkt auf dem Element binden (nicht document-delegiert wie
    // sonst in dieser Datei) — bei zwei document-delegierten Handlern
    // entscheidet die Bindungsreihenfolge, nicht die DOM-Tiefe, daher würde
    // stopPropagation() in einem document-Handler hier NICHT zuverlässig
    // vor capture_bindings.js feuern. Ein direkt gebundener Handler läuft
    // beim Bubbling immer vor jedem document-delegierten Handler.
    // capture_bindings.js bleibt dadurch unverändert.
    $area().on('click', function (ev) {
      if ($(this).hasClass('d-none')) return; // ausgeblendet -> kein Eingriff nötig
      // Klick auf eine Kachel selbst NICHT stoppen — dessen eigener
      // (document-delegierter) Handler unten soll weiterhin greifen und die
      // Auswahl treffen. Nur Klicks daneben (Titel, Hintergrund der Section)
      // sollen nicht zum Capture-Start durchsickern.
      if ($(ev.target).closest('.template-select-tile').length) return;
      ev.stopPropagation();
    });

    $(document).on('click keydown', '.template-select-tile', function (ev) {
      if (ev.type === 'keydown' && ev.key !== 'Enter' && ev.key !== ' ') return;
      ev.preventDefault();
      ev.stopPropagation(); // nicht zusätzlich den Capture-Start in capture_bindings.js auslösen

      const slot = $(this).attr('data-slot');
      if (!slot) return;

      $('.template-select-tile').removeClass('is-selecting');
      $(this).addClass('is-selecting');

      applySelection(slot)
        .done(() => {
          // Die Auswahl-Section bleibt immer sichtbar (kein "Touch to
          // start" darunter, solange mehrere Templates aktiv sind) — ein
          // Klick auf die Kachel muss also sowohl auswählen als auch
          // direkt den Capture-Flow starten. #start-area selbst (und
          // damit capture_bindings.js) bleibt unverändert; wir lösen hier
          // nur dessen bestehenden, document-delegierten Klick-Handler
          // erneut aus, nachdem der neue Pfad in PB_CONFIG steht.
          //
          // Anders als beim bisherigen "Touch to start"-Screen stand der
          // Besucher hier nicht schon eine Weile auf dem Bildschirm,
          // während die Kamera-LiveView im Hintergrund hochfährt — ohne
          // kurze Wartezeit schlägt capture_flow.js' eigener
          // LiveView-Readiness-Check (preparePreviewForSeries) regelmäßig
          // mit Timeout fehl. Kurz auf PB._bridgeLastHealth.liveViewRunning
          // pollen (max. 3s), statt capture_flow.js selbst anzufassen.
          _waitForLiveviewThenStart();
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

    // Capture-Flow mit Fehler abgebrochen: eigenes Event, wird NICHT
    // zusätzlich zu pb:captureFlowDone gefeuert (siehe capture_flow.js) —
    // ohne diesen Listener bliebe die Auswahl-Section nach einem Fehler
    // fälschlich ausgeblendet, obwohl #start-area wieder sichtbar wird.
    $(document).on('pb:captureFlowError', function () {
      PB.templateSelector.showIfNeeded();
    });
  }

  $(initBindings);
})(jQuery);
