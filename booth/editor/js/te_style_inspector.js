/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/* global $, bootstrap */
(function () {
  'use strict';

  if (window.__TE_STYLE_UI_LOADED) return;
  window.__TE_STYLE_UI_LOADED = true;

  function createStyleModule(TE) {
    const shadowPresets = {
      '1': { x: 0, y: 6,  blur: 18, spread: 0 },
      '2': { x: 0, y: 2,  blur: 8,  spread: 0 },
      '3': { x: 0, y: 12, blur: 28, spread: 0 },
      '4': { x: 0, y: 0,  blur: 0,  spread: 6 }
    };

    function applyStyleFromUI() {
      if (!TE.state || !TE.state.canvas) return;
      if (typeof TE.applyStyleInspectorToSelected !== 'function') return;

      TE.state.suppressInspector = true;
      TE.applyStyleInspectorToSelected();
      TE.state.suppressInspector = false;
    }

    // UI state is rendered by TE.syncStyleInspectorFromSelected()
    const $borderWrap = $('#borderAccordionWrap');
    const $shadowWrap = $('#shadowControlsWrap');

    const borderCollapseEl = document.getElementById('collapseBorderAdv');
    const shadowCollapseEl = document.getElementById('collapseShadowAdv');

    const borderCollapse = borderCollapseEl
      ? bootstrap.Collapse.getOrCreateInstance(borderCollapseEl, { toggle: false })
      : null;

    const shadowCollapse = shadowCollapseEl
      ? bootstrap.Collapse.getOrCreateInstance(shadowCollapseEl, { toggle: false })
      : null;

    function syncStyleUiVisibility(opts) {
      opts = opts || {};

      const radiusOn = $('#chkRadius').prop('checked');
      $('#inRadiusPx').prop('disabled', !radiusOn);

      const borderOn = $('#chkBorder').prop('checked');
      if ($borderWrap.length) $borderWrap.toggleClass('d-none', !borderOn);
      $('#borderColor, #borderStyle, #borderWidth').prop('disabled', !borderOn);
      if (borderCollapse) {
        if (!borderOn) borderCollapse.hide();
        else if (opts.openBorder) borderCollapse.show();
      }

      const shadowOn = $('#chkShadow').prop('checked');
      if ($shadowWrap.length) $shadowWrap.toggleClass('d-none', !shadowOn);

      $('#shadowPreset, #shadowColor, #shadowOffsetX, #shadowOffsetY, #shadowBlur, #shadowSpread')
        .prop('disabled', !shadowOn);

      if (shadowCollapse) {
        if (!shadowOn) shadowCollapse.hide();
        else if (opts.openShadow) shadowCollapse.show();
      }
    }

    function bindEvents() {
      // initial
      syncStyleUiVisibility();

      // Toggles
      $('#chkRadius').on('change', function () {
        syncStyleUiVisibility();
        applyStyleFromUI();
      });

      $('#chkBorder').on('change', function () {
        syncStyleUiVisibility({ openBorder: this.checked });
        applyStyleFromUI();
      });

      $('#chkShadow').on('change', function () {
        syncStyleUiVisibility();
        applyStyleFromUI();
      });

      // Inputs
      ['inRadiusPx', 'borderColor', 'borderStyle', 'borderWidth', 'shadowColor']
        .forEach(function (id) {
          $('#' + id).on('change input', function () {
            applyStyleFromUI();
          });
        });

      // Bulk guard: preset should not apply multiple times
      let bulkShadowUpdate = false;
      function applyStyleFromUI_guarded() {
        if (bulkShadowUpdate) return;
        applyStyleFromUI();
      }

      // Range + number sync (triggers apply)
      bindRangeNumber('shadowOffsetX', 'shadowOffsetXNum', applyStyleFromUI_guarded);
      bindRangeNumber('shadowOffsetY', 'shadowOffsetYNum', applyStyleFromUI_guarded);
      bindRangeNumber('shadowBlur',    'shadowBlurNum',    applyStyleFromUI_guarded);
      bindRangeNumber('shadowSpread',  'shadowSpreadNum',  applyStyleFromUI_guarded);

      // If user adjusts shadow values manually -> preset becomes custom
      function forceShadowCustomIfUserChanged(e) {
        const isTrusted = !!(e && e.originalEvent && e.originalEvent.isTrusted);
        if (!isTrusted) return;
        $('#shadowPreset').val('custom');
      }
      $('#shadowOffsetX, #shadowOffsetY, #shadowBlur, #shadowSpread')
        .on('input change', forceShadowCustomIfUserChanged);

      // Shadow preset
      $('#shadowPreset').on('change', function () {
        const v = String($(this).val() || '1');
        $(this).val(v);
        const p = shadowPresets[v] || shadowPresets['1'];

        // When user selects a preset, enable shadow automatically (UX)
        if (!$('#chkShadow').prop('checked')) {
          $('#chkShadow').prop('checked', true);
          syncStyleUiVisibility();
        }

        bulkShadowUpdate = true;

        // Set ranges only (numbers are synced by bindRangeNumber)
        $('#shadowOffsetX').val(p.x).trigger('input');
        $('#shadowOffsetY').val(p.y).trigger('input');
        $('#shadowBlur').val(p.blur).trigger('input');
        $('#shadowSpread').val(p.spread).trigger('input');

        bulkShadowUpdate = false;

        // Apply once
        applyStyleFromUI();
      });

      // Patch: when selection changes from canvas -> wrappers reflect state
      if (typeof TE.syncStyleInspectorFromSelected === 'function' && !TE.__wrapSyncStylePatched) {
        TE.__wrapSyncStylePatched = true;
        const _orig = TE.syncStyleInspectorFromSelected;
        TE.syncStyleInspectorFromSelected = function () {
          const r = _orig.apply(this, arguments);
          syncStyleUiVisibility();
          return r;
        };
      }
    }

    function init() { bindEvents(); }

    return { init, syncStyleUiVisibility };
  }

  $(function () {
    const TE = window.TE;
    if (!TE) return;
    if (!window.bootstrap) return;

    window.TE_STYLE_UI = createStyleModule(TE);
    window.TE_STYLE_UI.init();
  });

  function bindRangeNumber(rangeId, numId, onChange) {
    const $r = $('#' + rangeId);
    const $n = $('#' + numId);
    if (!$r.length || !$n.length) return;

    const min = Number($r.attr('min'));
    const max = Number($r.attr('max'));

    function clamp(v) {
      v = Number(v);
      if (!Number.isFinite(v)) v = Number($r.val());
      if (Number.isFinite(min)) v = Math.max(min, v);
      if (Number.isFinite(max)) v = Math.min(max, v);
      return v;
    }

    function syncFromRange() {
      $n.val($r.val());
    }

    function syncFromNumber() {
      const v = clamp($n.val());
      $n.val(v);
      $r.val(v);
    }

    syncFromRange();

    $r.on('input change', function () {
      syncFromRange();
      if (onChange) onChange();
    });

    $n.on('input change', function () {
      syncFromNumber();
      if (onChange) onChange();
    });
  }

})();
