// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/** edit_config.js — Form↔Config Binding + Patch Builder */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  /**
   * Liest den Wert eines Form-Elements typ-sicher (checkbox/radio/number) inkl. data-json-type.
   */
  PB._readFieldValue = PB._readFieldValue || function ($el) {
    const typeAttr = String($el.attr('type') || '').toLowerCase();
    const forced = String($el.data('jsonType') || '').toLowerCase();

    if (typeAttr === 'checkbox') return !!$el.prop('checked');

    if (typeAttr === 'radio') {
      if (!$el.prop('checked')) return undefined;
      return $el.val();
    }

    if (typeAttr === 'number') {
      const raw = String($el.val() || '').trim();
      if (raw === '') return '';
      if (forced === 'int') return parseInt(raw, 10);
      if (forced === 'float') return parseFloat(raw);

      const n = Number(raw);
      if (Number.isNaN(n)) return raw;

      const step = String($el.attr('step') || '');
      if (step === '1') return parseInt(raw, 10);
      return n;
    }

    const v = $el.val();

    if (forced === 'bool') {
      const s = String(v).toLowerCase();
      return (s === 'true' || s === '1' || s === 'on');
    }

    return v;
  };

  /**
   * Schreibt einen Wert in ein Form-Element typ-sicher (checkbox/radio/number).
   */
  PB._writeFieldValue = PB._writeFieldValue || function ($el, value) {
    const typeAttr = String($el.attr('type') || '').toLowerCase();

    if (typeAttr === 'checkbox') {
      $el.prop('checked', !!value);
      return;
    }

    if (typeAttr === 'radio') {
      const name = $el.attr('name');
      if (name) {
        $('input[type="radio"][name="' + name + '"][value="' + value + '"]').prop('checked', true);
      }
      return;
    }

    if (value === undefined) return;
    $el.val(value);
  };

  /**
   * Baut aus einem Formular ein Patch-Objekt anhand data-json-parm / data-json-path.
   */
  PB.formToPatch = PB.formToPatch || function ($form) {
    const patch = {};

    $form.find('[data-json-parm], [data-json-path]').each(function () {
      const $el = $(this);
      if ($el.data('jsonSkip')) return;

      const parm = $el.data('jsonParm');
      const path = $el.data('jsonPath');
      const group = $el.data('jsonGroup');

      const fullPath = path || ((group ? (group + '.') : '') + (parm || ''));
      if (!fullPath) return;

      const val = PB._readFieldValue($el);

      // Radio: nur schreiben, wenn checked (sonst undefined)
      if (String($el.attr('type') || '').toLowerCase() === 'radio' && val === undefined) return;

      PB._setDeep(patch, fullPath, val);
    });

    return patch;
  };

  /**
   * Befüllt Formfelder anhand eines Config-Objekts (data-json-parm / data-json-path).
   */
  PB.applyConfigToForm = PB.applyConfigToForm || function ($form, cfg) {
    // Wenn aus Versehen der Gesamt-Store übergeben wird und das Form eine Datei angibt,
    // automatisch den passenden Slice verwenden.
    if (cfg && cfg.general && cfg.camera && cfg.render) {
      const fileRel = $form.attr('data-json-file') || $form.attr('data-pb-json-file') || '';
      const key = (typeof PB.configKeyFromFile === 'function') ? PB.configKeyFromFile(fileRel) : 'general';
      cfg = cfg[key] || {};
    }

    $form.find('[data-json-parm], [data-json-path]').each(function () {
      const $el = $(this);
      if ($el.data('jsonSkip')) return;

      const parm = $el.data('jsonParm');
      const path = $el.data('jsonPath');
      const group = $el.data('jsonGroup');

      const fullPath = path || ((group ? (group + '.') : '') + (parm || ''));
      if (!fullPath) return;

      let current = PB._getDeep(cfg, fullPath);

      // Default-Value (wenn Config-Wert fehlt)
      if (current === undefined) {
        const def = $el.data('defaultValue');
        if (def !== undefined) {
          if (String($el.attr('type') || '').toLowerCase() === 'checkbox') {
            const s = String(def).toLowerCase();
            current = (s === 'true' || s === '1' || s === 'on');
          } else {
            current = def;
          }
        }
      }

      PB._writeFieldValue($el, current);
    });
  };

})(jQuery);
