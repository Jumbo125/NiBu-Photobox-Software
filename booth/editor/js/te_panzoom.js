/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/* global $, bootstrap */
(function () {
  'use strict';

  if (window.__TE_PANZOOM_LOADED) return;
  window.__TE_PANZOOM_LOADED = true;

  const clamp = (v, min, max) => Math.min(Math.max(v, min), max);

  function createPanZoomModule(TE) {
    // i18n helper
    const pbT = function (key, fallback) {
      if (typeof window.pbT === 'function') return window.pbT(key, fallback);
      if (typeof TE.t === 'function') return TE.t(key, fallback);
      return (fallback != null) ? String(fallback) : String(key);
    };

    function applyCssOnlyZoom(scale) {
      const c = TE.state && TE.state.canvas;
      if (!c || !TE.state.width || !TE.state.height) return;

      const s = clamp(Number(scale) || 1, 0.05, 6);
      TE.state.viewScale = s;

      const cssW = Math.max(1, Math.round(TE.state.width * s));
      const cssH = Math.max(1, Math.round(TE.state.height * s));

      c.setDimensions({ width: cssW, height: cssH }, { cssOnly: true });

      if (c.wrapperEl) $(c.wrapperEl).css({ width: cssW, height: cssH });
      if (c.lowerCanvasEl) $(c.lowerCanvasEl).css({ width: cssW, height: cssH });
      if (c.upperCanvasEl) $(c.upperCanvasEl).css({ width: cssW, height: cssH });

      const $lbl = $('#teScaleInfo');
      if ($lbl.length) $lbl.text(Math.round(s * 100) + '%');

      c.calcOffset();
      c.requestRenderAll();
    }

    function setZoom(scale, opts) {
      if (typeof TE.setZoomScale === 'function') {
        TE.setZoomScale(scale, opts || { fromFit: false, keepCenter: true });
      } else {
        applyCssOnlyZoom(scale);
      }
    }

    function zoomIn()  { setZoom((TE.state.viewScale || 1) * 1.1, { fromFit: false, keepCenter: true }); }
    function zoomOut() { setZoom((TE.state.viewScale || 1) / 1.1, { fromFit: false, keepCenter: true }); }

    function fitToScreen() {
      if (typeof TE.fitToScreen === 'function') return TE.fitToScreen();
      if (TE.state) TE.state.autoFit = true;
      if (typeof TE.fitCanvasToFrame === 'function') TE.fitCanvasToFrame();
    }

    function bindPanZoomToCanvas(canvas) {
      if (!canvas || canvas.__tePanZoomBound) return;
      canvas.__tePanZoomBound = true;

      const getScrollEl = () => (typeof TE.getScrollEl === 'function'
        ? TE.getScrollEl()
        : (document.querySelector('.te-canvas-wrap') ||
           document.querySelector('.te-canvas-scroll') ||
           document.querySelector('.te-canvas-frame')));

      const scrollEl = getScrollEl();
      const $scroll = scrollEl ? $(scrollEl) : $();

      let isPanning = false;
      let startX = 0, startY = 0;
      let startSL = 0, startST = 0;

      TE.state.viewPanX = TE.state.viewPanX || 0;
      TE.state.viewPanY = TE.state.viewPanY || 0;

      const contentW = () => Math.max(1, (TE.state.width || 1) * (TE.state.viewScale || 1));
      const contentH = () => Math.max(1, (TE.state.height || 1) * (TE.state.viewScale || 1));

      function canScroll() {
        if (!scrollEl) return false;
        return (scrollEl.scrollWidth > scrollEl.clientWidth) || (scrollEl.scrollHeight > scrollEl.clientHeight);
      }

      function applyPan(sl, st) {
        if (!scrollEl) return;

        const maxSL = Math.max(0, contentW() - scrollEl.clientWidth);
        const maxST = Math.max(0, contentH() - scrollEl.clientHeight);

        sl = clamp(sl, 0, maxSL);
        st = clamp(st, 0, maxST);

        if (canScroll()) {
          scrollEl.scrollLeft = sl;
          scrollEl.scrollTop = st;
        } else {
          TE.state.viewPanX = sl;
          TE.state.viewPanY = st;
          if (canvas.wrapperEl) {
            canvas.wrapperEl.style.transform = 'translate(' + (-sl) + 'px,' + (-st) + 'px)';
          }
          canvas.calcOffset();
        }
      }

      canvas.on('mouse:down', function (opt) {
        const e = opt && opt.e;
        if (!e) return;

        const isLeft = (e.button === 0) || (e.which === 1);
        const isMiddle = (e.button === 1) || (e.which === 2);
        const ctrlDrag = isLeft && (e.ctrlKey || e.metaKey);

        if (!isMiddle && !ctrlDrag) return;

        isPanning = true;
        startX = e.clientX;
        startY = e.clientY;

        if (scrollEl && canScroll()) {
          startSL = scrollEl.scrollLeft;
          startST = scrollEl.scrollTop;
        } else {
          startSL = TE.state.viewPanX || 0;
          startST = TE.state.viewPanY || 0;
        }

        canvas.discardActiveObject();
        canvas._currentTransform = null;
        canvas.selection = false;
        canvas.skipTargetFind = true;
        canvas.defaultCursor = 'grabbing';
        canvas.requestRenderAll();

        $scroll.addClass('te-is-panning');

        e.preventDefault();
        e.stopPropagation();
      });

      canvas.on('mouse:move', function (opt) {
        if (!isPanning) return;
        const e = opt && opt.e;
        if (!e) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        applyPan(startSL - dx, startST - dy);

        e.preventDefault();
        e.stopPropagation();
      });

      canvas.on('mouse:up', function () {
        if (!isPanning) return;
        isPanning = false;

        canvas.selection = true;
        canvas.skipTargetFind = false;
        canvas.defaultCursor = 'default';
        $scroll.removeClass('te-is-panning');
      });

      canvas.on('mouse:wheel', function (opt) {
        const e = opt && opt.e;
        if (!e) return;
        if (!(e.ctrlKey || e.metaKey)) return;

        e.preventDefault();
        e.stopPropagation();

        const factor = (e.deltaY > 0) ? (1 / 1.1) : 1.1;

        if (typeof TE.setZoomScale === 'function') {
          TE.setZoomScale((TE.state.viewScale || 1) * factor, { fromFit: false, keepCenter: true });
        } else {
          setZoom((TE.state.viewScale || 1) * factor, { fromFit: false, keepCenter: true });
        }

        if (!canScroll()) applyPan(TE.state.viewPanX || 0, TE.state.viewPanY || 0);
      });
    }

    function bindDblClickZoom(canvas) {
      if (!canvas || canvas.__teDblZoomBound) return;
      canvas.__teDblZoomBound = true;

      $(canvas.upperCanvasEl).off('dblclick.teZoom').on('dblclick.teZoom', function (e) {
        if (!TE.state || !TE.state.canvas) return;

        const s = TE.state.viewScale || 1;
        const isFitLike = (TE.state.autoFit === true) || (s < 0.999);

        if (isFitLike) {
          if (typeof TE.setZoomScale === 'function') {
            TE.setZoomScale(1, { fromFit: false, keepCenter: true });
          } else {
            TE.state.viewScale = 1;
            TE.fitCanvasToFrame && TE.fitCanvasToFrame();
          }
        } else {
          if (typeof TE.fitToScreen === 'function') TE.fitToScreen();
          else { TE.state.autoFit = true; TE.fitCanvasToFrame && TE.fitCanvasToFrame(); }
        }

        e.preventDefault();
      });
    }

    function bindZoomButtonsAndHotkeys() {
      $('#btnZoomIn, #teZoomIn').on('click', function () {
        if (!TE.state || !TE.state.canvas) return;
        if (typeof TE.zoomIn === 'function') TE.zoomIn();
        else zoomIn();
      });

      $('#btnZoomOut, #teZoomOut').on('click', function () {
        if (!TE.state || !TE.state.canvas) return;
        if (typeof TE.zoomOut === 'function') TE.zoomOut();
        else zoomOut();
      });

      $('#btnZoomFit').on('click', function () {
        if (!TE.state || !TE.state.canvas) return;
        fitToScreen();
      });

      $(document).on('keydown.teZoomKeys', function (e) {
        if (!TE.state || !TE.state.canvas) return;
        if (e.key === '0') return fitToScreen();
        if (e.key === '+' || e.key === '=') return zoomIn();
        if (e.key === '-') return zoomOut();
      });
    }

    function init() {
      bindZoomButtonsAndHotkeys();

      if (typeof TE.onEditorReady === 'function') {
        TE.onEditorReady(function (canvas) {
          bindPanZoomToCanvas(canvas);
          bindDblClickZoom(canvas);
        });
      }

      if (TE.state && TE.state.canvas) {
        bindPanZoomToCanvas(TE.state.canvas);
        bindDblClickZoom(TE.state.canvas);
      }
    }

    return { init, bindPanZoomToCanvas, bindDblClickZoom };
  }

  $(function () {
    const TE = window.TE;
    if (!TE) return;

    window.TE_PANZOOM = createPanZoomModule(TE);
    window.TE_PANZOOM.init();
  });
})();
