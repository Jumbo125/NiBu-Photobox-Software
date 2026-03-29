/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/* global $, bootstrap */
(function () {
  'use strict';

  if (window.__TE_LAYERS_UI_LOADED) return;
  window.__TE_LAYERS_UI_LOADED = true;

  function createLayersModule(TE) {
    function bindLayerDelegation() {
      $('#layersList')
        .on('click', '.js-layer-select', function () {
          const uid = $(this).closest('.js-layer-row').data('uid');
          if (uid && typeof TE.selectByUid === 'function') TE.selectByUid(uid);
        })
        .on('click', '.js-layer-up', function (e) {
          e.preventDefault();
          e.stopPropagation();

          const uid = $(this).data('uid');
          if (uid && typeof TE.moveLayerByUid === 'function') TE.moveLayerByUid(uid, +1);
        })
        .on('click', '.js-layer-down', function (e) {
          e.preventDefault();
          e.stopPropagation();

          const uid = $(this).data('uid');
          if (uid && typeof TE.moveLayerByUid === 'function') TE.moveLayerByUid(uid, -1);
        });
    }

    function bindLayerDragDrop() {
      let dragUid = null;

      $('#layersList')
        .on('dragstart', '.js-layer-drag', function (e) {
          const $row = $(this).closest('.js-layer-row');
          dragUid = $row.data('uid');

          const dt = e.originalEvent && e.originalEvent.dataTransfer;
          if (dt) {
            dt.effectAllowed = 'move';
            dt.setData('text/plain', String(dragUid || ''));
          }

          $row.addClass('opacity-50');
        })
        .on('dragend', '.js-layer-drag', function () {
          $('#layersList .js-layer-row').removeClass('opacity-50 border border-secondary');
          dragUid = null;
        })
        .on('dragover', '.js-layer-row', function (e) {
          e.preventDefault();
          $(this).addClass('border border-secondary');

          const dt = e.originalEvent && e.originalEvent.dataTransfer;
          if (dt) dt.dropEffect = 'move';
        })
        .on('dragleave', '.js-layer-row', function () {
          $(this).removeClass('border border-secondary');
        })
        .on('drop', '.js-layer-row', function (e) {
          e.preventDefault();
          e.stopPropagation();

          const $target = $(this);
          const targetUid = $target.data('uid');

          const dt = e.originalEvent && e.originalEvent.dataTransfer;
          const fromUid = dragUid || (dt ? Number(dt.getData('text/plain')) : 0);

          if (!fromUid || fromUid === targetUid) return;

          const $fromRow = $('#layersList .js-layer-row').filter(function () {
            return Number($(this).data('uid')) === Number(fromUid);
          }).first();

          if (!$fromRow.length) return;

          const rect = this.getBoundingClientRect();
          const clientY = (e.originalEvent && e.originalEvent.clientY) || 0;
          const insertAfter = clientY > (rect.top + rect.height / 2);

          if (insertAfter) $fromRow.insertAfter($target);
          else $fromRow.insertBefore($target);

          const uidsTopFirst = $('#layersList .js-layer-row').map(function () {
            return $(this).data('uid');
          }).get();

          if (typeof TE.reorderLayersByDisplayOrder === 'function') {
            TE.reorderLayersByDisplayOrder(uidsTopFirst);
          }

          $('#layersList .js-layer-row').removeClass('border border-secondary opacity-50');
          dragUid = null;
        });
    }

    function init() {
      bindLayerDelegation();
      bindLayerDragDrop();
    }

    return { init };
  }

  $(function () {
    const TE = window.TE;
    if (!TE) return;

    window.TE_LAYERS_UI = createLayersModule(TE);
    window.TE_LAYERS_UI.init();
  });
})();
