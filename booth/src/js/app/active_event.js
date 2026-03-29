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
  PB.initActiveEventBindings = PB.initActiveEventBindings || function () {
    $(document).on('click', '#btnActiveEvent, [data-pb-action="open-active-event"]', function (ev) {
      ev.preventDefault();
      PB.openActiveEventModal();
    });
  };
})(jQuery);
