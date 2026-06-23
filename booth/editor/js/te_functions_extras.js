/*
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */

/* global fabric, $, bootstrap, DOMParser, XMLSerializer */
window.TE = window.TE || {};

(function () {
  'use strict';

  const TE = window.TE;

  // i18n helpers:
  // - bevorzugt globales pbT(key, fallback)
  // - fallback auf TE.t(key, fallback) (JSON dict)
  // - fallback auf "fallback" selbst
  const pbT = function (key, fallback) {
    if (typeof window.pbT === 'function') return window.pbT(key, fallback);
    if (typeof TE.t === 'function') return TE.t(key, fallback);
    return (fallback != null) ? String(fallback) : String(key);
  };

  const fmt = function (key, fallback, vars) {
    let s = pbT(key, fallback);
    if (vars && typeof vars === 'object') {
      Object.keys(vars).forEach((k) => {
        const re = new RegExp('\\{' + k + '\\}', 'g');
        s = s.replace(re, String(vars[k]));
      });
    }
    return s;
  };

  // ---------------------------
  // Projekte / XML Tools
  // ---------------------------
  TE.rewriteXmlAssetPaths = function (xmlText, baseUrl) {
    if (!baseUrl) return xmlText;

    try {
      const doc = new DOMParser().parseFromString(xmlText, 'application/xml');

      const nodes = doc.querySelectorAll('[src],[href],[path]');
      nodes.forEach((el) => {
        ['src', 'href', 'path'].forEach((attr) => {
          if (!el.hasAttribute(attr)) return;
          const v = (el.getAttribute(attr) || '').trim();
          if (!v) return;

          if (/^(https?:)?\/\//i.test(v) || v.startsWith('data:') || v.startsWith('/')) return;

          el.setAttribute(attr, baseUrl + v);
        });
      });

      return new XMLSerializer().serializeToString(doc);
    } catch (e) {
      return xmlText;
    }
  };

  TE.escapeHtml = TE.escapeHtml || function (s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  };

  TE.apiListProjects = function () {
    return $.getJSON('../api/template_editor_list_projects.php');
  };

  TE.uiRefreshProjects = function () {
    const $sel = $('#teProjectSelect');
    const $hint = $('#teProjectHint');
    const $btnOpen = $('#teBtnOpenProject');

    $sel.html('<option value="">' + TE.escapeHtml(pbT('te.projects.select.loading', '— Lade Projekte… —')) + '</option>');
    $hint.text('');
    $btnOpen.prop('disabled', true);

    return TE.apiListProjects()
      .done(function (res) {
        if (!res || !res.ok) {
          $sel.html('<option value="">' + TE.escapeHtml(pbT('te.projects.select.load_error', '— Fehler beim Laden —')) + '</option>');
          return;
        }

        TE.state = TE.state || {};
        TE.state.projects = Array.isArray(res.projects) ? res.projects : [];
        TE.state.projectNameSet = new Set(
          TE.state.projects
            .map(p => String(p && p.name ? p.name : '').trim().toLowerCase())
            .filter(Boolean)
        );

        if (!res.projects || res.projects.length === 0) {
          $sel.html('<option value="">' + TE.escapeHtml(pbT('te.projects.select.none_found', '— Keine Projekte gefunden —')) + '</option>');
          $hint.text(pbT('te.projects.hint.no_xml', 'Es wurde kein Ordner mit XML gefunden.'));
          return;
        }

        const opts = ['<option value="">' + TE.escapeHtml(pbT('te.projects.select.prompt', '— Bitte wählen —')) + '</option>'];
        res.projects.forEach(function (p) {
          const projectName = p.name;
          const xmlUrl = p.xml;
          const baseUrl = '/templates/' + projectName + '/';

          const label = fmt(
            'te.projects.option.label',
            '{name} ({modified})',
            { name: projectName, modified: p.modified }
          );

          opts.push(
            '<option value="' + TE.escapeHtml(projectName) + '" ' +
              'data-xml-url="' + TE.escapeHtml(xmlUrl) + '" ' +
              'data-base-url="' + TE.escapeHtml(baseUrl) + '">' +
              TE.escapeHtml(label) +
            '</option>'
          );
        });

        $sel.html(opts.join(''));
      })
      .fail(function () {
        $sel.html('<option value="">' + TE.escapeHtml(pbT('te.projects.select.load_error', '— Fehler beim Laden —')) + '</option>');
      });
  };

  // ---------------------------
  // Import from template.xml (String oder XMLDocument)
  // ---------------------------
  TE.importFromXmlText = async function (xmlInput, options) {
    options = options || {};

    let xmlStr = '';
    try {
      if (xmlInput && typeof xmlInput === 'object' && (xmlInput.nodeType || xmlInput.documentElement)) {
        xmlStr = new XMLSerializer().serializeToString(xmlInput);
      } else {
        xmlStr = String(xmlInput || '');
      }
    } catch (e) {
      xmlStr = String(xmlInput || '');
    }

    xmlStr = xmlStr.replace(/^\uFEFF/, '');

    const doc = new DOMParser().parseFromString(xmlStr, 'application/xml');
    const perr = doc.querySelector('parsererror');
    if (perr) {
      console.error(pbT('te.xml.parse_error.console', 'XML Parse-Fehler:'), perr.textContent);
      TE.toast && TE.toast(pbT('te.xml.invalid.toast', 'Ungültige XML-Datei (Parse-Fehler)'));
      return;
    }

    const root = doc.querySelector('template');
    if (!root) {
      console.error(pbT('te.xml.template_missing.console', 'Kein <template> gefunden.'));
      TE.toast && TE.toast(pbT('te.xml.template_missing.toast', 'Ungültige XML-Datei (template-Tag fehlt)'));
      return;
    }

    const w = Number(root.getAttribute('width') || 0) || 1800;
    const h = Number(root.getAttribute('height') || 0) || 1200;

    const gwAttr = String(root.getAttribute('greenwall') || '');
    const greenwall = (gwAttr === '1' || gwAttr.toLowerCase() === 'true');

    const xmlName = root.getAttribute('name') || root.getAttribute('templateName') || '';
    // xmlName wird nur für das Anzeige-Input-Feld verwendet; für Pfade zählt options.templateName
    const name = options.templateName || TE.activeProject || xmlName || 'projekt';
    const displayName = options.displayName || xmlName || name;

    if (!TE.state || !TE.state.canvas) {
      TE.initEditor({
        templateName: name,
        width: w,
        height: h,
        displayName: displayName,
        baseUrl: options.baseUrl || (name === 'activeTemplate' ? '/activeTemplate/' : `/templates/${name}/`)
      });
      TE.state.greenwall = !!greenwall;
      TE.syncGreenwallUiFromState && TE.syncGreenwallUiFromState();
      TE.cacheGreenwallUi && TE.cacheGreenwallUi();
      TE.detectGreenwallAsset && TE.detectGreenwallAsset({ activateIfFound: TE.state.greenwall });
    } else {
      TE.state.templateName = name;
      TE.state.width = w;
      TE.state.height = h;
      TE.state.baseUrl = options.baseUrl || (name === 'activeTemplate' ? '/activeTemplate/' : `/templates/${name}/`);
      TE.state.greenwall = !!greenwall;

      if (typeof TE.updateTemplateInfo === 'function') {
        TE.updateTemplateInfo(displayName, w, h);
      }

      TE.cacheGreenwallUi && TE.cacheGreenwallUi();
      TE.syncGreenwallUiFromState && TE.syncGreenwallUiFromState();
      TE.detectGreenwallAsset && TE.detectGreenwallAsset({ activateIfFound: TE.state.greenwall });

      const c0 = TE.state.canvas;
      c0.clear();
      c0.setWidth(w);
      c0.setHeight(h);
      c0.backgroundColor = '#fff';
      c0.requestRenderAll();
    }

    const c = TE.state.canvas;
    let maxPhoto = 0;

    const toNum = (v, d) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : d;
    };

    const layerNodes = Array.from(doc.querySelectorAll('layer'))
      .map((el, i) => ({ el, z: toNum(el.getAttribute('z'), i + 1) }))
      .sort((a, b) => a.z - b.z);

    const pending = [];

    const basePath = String(options.basePath || '').replace(/\/+$/, '');
    const resolveSrc = (src) => {
      src = String(src || '');
      if (!src) return src;
      if (/^(https?:)?\/\//i.test(src) || src.startsWith('/')) return src;
      return basePath ? (basePath + '/' + src) : src;
    };

    for (const { el } of layerNodes) {
      const type = (el.getAttribute('type') || 'item').toLowerCase();
      const x = toNum(el.getAttribute('x'), 0);
      const y = toNum(el.getAttribute('y'), 0);
      const w2 = toNum(el.getAttribute('w'), 100);
      const h2 = toNum(el.getAttribute('h'), 100);
      const rot = toNum(el.getAttribute('rotation'), 0);

      const id = toNum(el.getAttribute('id'), 0);
      const styleLy = {};
      if (el.hasAttribute('radius')) styleLy.radius = toNum(el.getAttribute('radius'), 0);
      if (el.hasAttribute('border')) styleLy.border = toNum(el.getAttribute('border'), 0);
      if (el.hasAttribute('border_color')) styleLy.border_color = String(el.getAttribute('border_color') || '');
      if (el.hasAttribute('border_style')) styleLy.border_style = String(el.getAttribute('border_style') || '');
      if (el.hasAttribute('border_width')) styleLy.border_width = toNum(el.getAttribute('border_width'), 0);
      if (el.hasAttribute('shadow')) styleLy.shadow = toNum(el.getAttribute('shadow'), 0);
      if (el.hasAttribute('shadow_preset')) styleLy.shadow_preset = String(el.getAttribute('shadow_preset') || '');
      if (el.hasAttribute('shadow_color')) styleLy.shadow_color = String(el.getAttribute('shadow_color') || '');
      if (el.hasAttribute('shadow_x')) styleLy.shadow_x = toNum(el.getAttribute('shadow_x'), 0);
      if (el.hasAttribute('shadow_y')) styleLy.shadow_y = toNum(el.getAttribute('shadow_y'), 0);
      if (el.hasAttribute('shadow_blur')) styleLy.shadow_blur = toNum(el.getAttribute('shadow_blur'), 0);
      if (el.hasAttribute('shadow_spread')) styleLy.shadow_spread = toNum(el.getAttribute('shadow_spread'), 0);

      if (type === 'photo') {
        const idx = toNum(el.getAttribute('index'), 0);
        if (idx > maxPhoto) maxPhoto = idx;

        const rect = new fabric.Rect({
          left: 0,
          top: 0,
          width: 420,
          height: 280,
          fill: TE.pbPaletteFill ? TE.pbPaletteFill(idx) : 'rgba(255,255,255,1)',
          stroke: '#111',
          strokeDashArray: [10, 8],
          strokeWidth: 4,
          originX: 'left',
          originY: 'top'
        });

        const txt = new fabric.Text(fmt('te.layer.photo.placeholder', 'FOTO {idx}', { idx }), {
          left: 16,
          top: 16,
          fontSize: 34,
          fill: '#111',
          fontFamily: 'Arial',
          originX: 'left',
          originY: 'top'
        });

        const g = new fabric.Group([rect, txt], {
          left: x,
          top: y,
          angle: rot,
          originX: 'left',
          originY: 'top'
        });

        g.pbType = 'photo';
        g.pbIndex = idx;
        TE.ensureUid(g, id);

        if (w2) TE.scaleObjectToWidth(g, w2);
        if (h2) TE.scaleObjectToHeight(g, h2);

        c.add(g);

        if (typeof TE.applySerializedStyleToObject === 'function') {
          TE.applySerializedStyleToObject(g, styleLy);
        }
        continue;
      }

      if (type === 'image') {
        const src = String(el.getAttribute('src') || '');
        const nameAttr = String(el.getAttribute('name') || pbT('te.layer.image.default_name', 'BILD'));

        const p = (async () => {
          const url = resolveSrc(src);
          const obj = await TE.addImageFromServer(url, src, nameAttr);
          if (!obj) return;

          TE.ensureUid(obj, id);
          obj.set({
            left: x,
            top: y,
            angle: rot,
            originX: 'left',
            originY: 'top'
          });

          if (w2) TE.scaleObjectToWidth(obj, w2);
          if (h2) TE.scaleObjectToHeight(obj, h2);

          if (typeof TE.applySerializedStyleToObject === 'function') {
            TE.applySerializedStyleToObject(obj, styleLy);
          }

          obj.setCoords();
        })().catch((err) => {
          console.warn(fmt('te.image.add_timeout.warn', 'Bild konnte nicht hinzugefügt werden: {src}', { src }), err);
        });

        pending.push(p);
        continue;
      }

      // generisches "item"
      const rect = new fabric.Rect({
        left: x,
        top: y,
        width: w2,
        height: h2,
        fill: 'rgba(0,0,0,0)',
        stroke: '#777',
        strokeDashArray: [4, 4],
        strokeWidth: 2,
        originX: 'left',
        originY: 'top'
      });

      const itemName = String(el.getAttribute('name') || pbT('te.layer.item.default_name', 'ELEMENT'));

      const txt = new fabric.Text(itemName, {
        left: 10,
        top: 10,
        fontSize: 18,
        fill: '#444',
        fontFamily: 'Arial',
        originX: 'left',
        originY: 'top'
      });

      const g = new fabric.Group([rect, txt], {
        left: x,
        top: y,
        angle: rot,
        originX: 'left',
        originY: 'top'
      });

      g.pbType = 'item';
      g.pbName = itemName;
      TE.ensureUid(g, id);
      if (typeof TE.applySerializedStyleToObject === 'function') {
        TE.applySerializedStyleToObject(g, styleLy);
      }
      c.add(g);
    }

    if (pending.length) await Promise.all(pending);

    const orderedIds = layerNodes
      .map(({ el }) => toNum(el.getAttribute('id'), 0))
      .filter(Boolean);

    orderedIds.forEach((layerId, targetIndex) => {
      const obj = TE.getObjectByUid(layerId);
      if (obj) TE._moveToIndex(c, obj, targetIndex);
    });

    TE.state.photoCounter = Math.max(TE.state.photoCounter || 0, maxPhoto);

    if (typeof TE.fixAllPhotoPlaceholderRender === 'function') {
      TE.fixAllPhotoPlaceholderRender();
    }

    c.requestRenderAll();

    if (typeof TE.refreshLayers === 'function') TE.refreshLayers();
    if (typeof TE.setSelected === 'function') TE.setSelected(null);

    requestAnimationFrame(() => {
      if (typeof TE.fitCanvasToFrame === 'function') TE.fitCanvasToFrame();
    });

    TE.toast && TE.toast(fmt('te.project.loaded.toast', 'Projekt geladen: {name}', { name }));
    return { ok: true, templateName: name };
  };

  // ---------------------------
  // Tab helper
  // ---------------------------
  TE.setTab = function (name, $tabs, $panels) {
    $tabs.each(function () {
      $(this).toggleClass('active', $(this).data('tab') === name);
    });

    $panels.each(function () {
      $(this).toggleClass('d-none', $(this).data('panel') !== name);
    });

    if (name === 'projects' && typeof TE.loadProjectList === 'function') {
      TE.loadProjectList();
    }
  };

  // ---------------------------
  // i18n + Config
  // ---------------------------
  TE.i18n = TE.i18n || { lang: 'de', dict: {}, ready: false };

  TE.t = function (key, fallback) {
    const d = (TE.i18n && TE.i18n.dict) ? TE.i18n.dict : null;
    if (d && Object.prototype.hasOwnProperty.call(d, key)) return d[key];
    return (fallback != null) ? String(fallback) : String(key);
  };

  TE._fetchJson = async function (url) {
    const r = await fetch(url, { cache: 'no-store' });
    const txt = await r.text();
    let data = null;
    try { data = txt ? JSON.parse(txt) : null; } catch (e) {}

    if (!r.ok) {
      const fallback = fmt('net.err.http_status', 'HTTP {status}', { status: r.status });
      const msg = (data && data.error) ? data.error : (txt || fallback);
      throw new Error(msg);
    }
    return data;
  };

  TE.applyI18n = function (rootEl) {
    const root = rootEl || document;

    // Support für serverseitige Templates: data-lang-key="some.key"
    root.querySelectorAll('[data-lang-key]').forEach((el) => {
      if (
        el.hasAttribute('data-i18n') ||
        el.hasAttribute('data-i18n-html') ||
        el.hasAttribute('data-i18n-title') ||
        el.hasAttribute('data-i18n-placeholder') ||
        el.hasAttribute('data-i18n-aria-label')
      ) return;

      const key = el.getAttribute('data-lang-key');
      if (!key) return;
      el.textContent = TE.t(key, el.textContent);
    });

    root.querySelectorAll('[data-i18n]').forEach((el) => {
      const key = el.getAttribute('data-i18n');
      if (!key) return;
      el.textContent = TE.t(key, el.textContent);
    });

    root.querySelectorAll('[data-i18n-html]').forEach((el) => {
      const key = el.getAttribute('data-i18n-html');
      if (!key) return;
      el.innerHTML = TE.t(key, el.innerHTML);
    });

    root.querySelectorAll('[data-i18n-title]').forEach((el) => {
      const key = el.getAttribute('data-i18n-title');
      if (!key) return;
      const cur = el.getAttribute('title') || '';
      el.setAttribute('title', TE.t(key, cur));
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
      const key = el.getAttribute('data-i18n-placeholder');
      if (!key) return;
      const cur = el.getAttribute('placeholder') || '';
      el.setAttribute('placeholder', TE.t(key, cur));
    });

    root.querySelectorAll('[data-i18n-aria-label]').forEach((el) => {
      const key = el.getAttribute('data-i18n-aria-label');
      if (!key) return;
      const cur = el.getAttribute('aria-label') || '';
      el.setAttribute('aria-label', TE.t(key, cur));
    });
  };

  TE.loadLang = async function (lang) {
    const l = String(lang || '').toLowerCase().trim() || 'de';
    const url = `editor_lang/lang_${l}.json?v=${Date.now()}`;

    const dict = await TE._fetchJson(url);
    if (!dict || typeof dict !== 'object') throw new Error(pbT('te.i18n.lang_json_invalid', 'Lang JSON ungültig'));

    TE.i18n.lang = l;
    TE.i18n.dict = dict;
    TE.i18n.ready = true;

    if (document && document.documentElement) {
      document.documentElement.setAttribute('lang', l);
    }

    TE.applyI18n(document);
    TE._markLangDropdown && TE._markLangDropdown(l);

    return l;
  };

  TE.apiLoadConfig = async function () {
    return TE._fetchJson(`/api/template_editor_lade_config.php?v=${Date.now()}`);
  };

  TE.apiSaveConfig = async function (cfg) {
    return TE.postJson('/api/template_editor_save_config.php', cfg || {});
  };

  TE.loadConfig = async function () {
    TE.state = TE.state || {};
    TE.state.config = TE.state.config || {};

    const res = await TE.apiLoadConfig();
    if (!res || !res.ok) throw new Error((res && res.error) ? res.error : pbT('te.config.load_failed', 'Config laden fehlgeschlagen'));

    const cfg = (res.config && typeof res.config === 'object') ? res.config : {};
    TE.state.config = Object.assign({}, TE.state.config, cfg);
    return TE.state.config;
  };

  TE.saveConfig = async function (partial) {
    TE.state = TE.state || {};
    TE.state.config = TE.state.config || {};

    const nextCfg = Object.assign({}, TE.state.config, (partial || {}));
    const res = await TE.apiSaveConfig(nextCfg);
    if (!res || !res.ok) throw new Error((res && res.error) ? res.error : pbT('te.config.save_failed', 'Config speichern fehlgeschlagen'));

    TE.state.config = (res.config && typeof res.config === 'object') ? res.config : nextCfg;
    return TE.state.config;
  };

  TE._markLangDropdown = function (lang) {
    try {
      const btn = document.getElementById('teLangBtn');
      if (btn) btn.setAttribute('data-current-lang', lang);

      document.querySelectorAll('.dropdown-item[data-lang]').forEach((el) => {
        el.classList.toggle('active', String(el.getAttribute('data-lang')) === String(lang));
      });
    } catch (e) {}
  };

  TE.setLang = async function (lang, opts) {
    const o = Object.assign({ persist: true }, (opts || {}));
    const l = String(lang || '').toLowerCase().trim() || 'de';

    await TE.loadLang(l);

    if (o.persist) {
      try {
        await TE.saveConfig({ lang: l });
      } catch (e) {
        console.warn(e);
      }
    }
    return l;
  };

  TE.initI18n = async function () {
    let lang = (document && document.documentElement && document.documentElement.getAttribute('lang')) || 'de';

    try {
      const cfg = await TE.loadConfig();
      if (cfg && cfg.lang) lang = cfg.lang;
    } catch (e) {
      console.warn(e);
    }

    try {
      await TE.loadLang(lang);
    } catch (e) {
      console.warn(e);
    }

    return TE.i18n.lang;
  };

  // ---------------------------
  // GREENWALL
  // ---------------------------
  TE.GREENWALL_BASENAME = '___greenwall';
  TE.GREENWALL_EXTS = ['png', 'jpg', 'jpeg'];

  TE.cacheGreenwallUi = function () {
    TE.ui = TE.ui || {};
    TE.ui.$chkGreenwall = $('#chkGreenwall');
    TE.ui.$greenwallInfo = $('#greenwallInfo');

    if (!TE.ui.greenwallEmptyText && TE.ui.$greenwallInfo.length) {
      TE.ui.greenwallEmptyText = TE.ui.$greenwallInfo.text();
    }
  };

  TE.setGreenwallInfoText = function (t) {
    const $info = (TE.ui && TE.ui.$greenwallInfo) ? TE.ui.$greenwallInfo : $('#greenwallInfo');
    if (!$info.length) return;

    const emptyText = (TE.ui && TE.ui.greenwallEmptyText) ? TE.ui.greenwallEmptyText : $info.text();
    $info.text(t || emptyText || '');
  };

  TE.syncGreenwallUiFromState = function () {
    const $chk = (TE.ui && TE.ui.$chkGreenwall) ? TE.ui.$chkGreenwall : $('#chkGreenwall');
    if ($chk.length) $chk.prop('checked', !!(TE.state && TE.state.greenwall));

    const nm = (TE.state && (TE.state.greenwallName || (TE.state.greenwallAsset && TE.state.greenwallAsset.name))) || '';
    TE.setGreenwallInfoText(nm);
  };

  TE._canLoadImage = async function (url) {
    const u = url + (url.includes('?') ? '&' : '?') + 't=' + Date.now();

    try {
      let r = await fetch(u, { method: 'HEAD', cache: 'no-store' });
      if (r.ok) return true;

      if (r.status === 405 || r.status === 403) {
        r = await fetch(u, { method: 'GET', cache: 'no-store' });
        return r.ok;
      }
      return false;
    } catch (e) {
      return false;
    }
  };

  TE.detectGreenwallAsset = async function (opts) {
    const o = Object.assign({ activateIfFound: false }, (opts || {}));
    if (!TE.state || !TE.state.baseUrl) return false;

    for (const ext of TE.GREENWALL_EXTS) {
      const rel = `assets/${TE.GREENWALL_BASENAME}.${ext}`;
      const url = TE.state.baseUrl + rel;

      const ok = await TE._canLoadImage(url);
      if (ok) {
        const name = `${TE.GREENWALL_BASENAME}.${ext}`;

        TE.state.greenwallAsset = { name, relPath: rel, url };
        TE.state.greenwallName = name;
        TE.state.greenwallSrc = rel;

        if (o.activateIfFound && TE.state.greenwall) TE.state.greenwall = true;

        TE.syncGreenwallUiFromState && TE.syncGreenwallUiFromState();
        TE.applyGreenwall && TE.applyGreenwall();
        return true;
      }
    }

    TE.state.greenwallAsset = null;
    TE.state.greenwallName = '';
    TE.state.greenwallSrc = '';

    TE.syncGreenwallUiFromState && TE.syncGreenwallUiFromState();
    TE.applyGreenwall && TE.applyGreenwall();
    return false;
  };

  TE._setCanvasBackground = function (canvas, img) {
    if (!canvas) return;

    if (typeof canvas.setBackgroundImage === 'function') {
      canvas.setBackgroundImage(
        img || null,
        (typeof canvas.requestRenderAll === 'function'
          ? canvas.requestRenderAll.bind(canvas)
          : canvas.renderAll.bind(canvas))
      );
      return;
    }

    canvas.backgroundImage = img || null;
    if (typeof canvas.requestRenderAll === 'function') canvas.requestRenderAll();
    else if (typeof canvas.renderAll === 'function') canvas.renderAll();
  };

  TE.applyGreenwall = function () {
    const c = TE.state && TE.state.canvas;
    if (!c) return;

    if (!TE.state.greenwall || !TE.state.greenwallSrc) {
      TE._setCanvasBackground(c, null);
      return;
    }

    const url =
      (TE.state.greenwallAsset && TE.state.greenwallAsset.url)
        ? TE.state.greenwallAsset.url
        : ((TE.state.baseUrl || '') + TE.state.greenwallSrc);

    const load = (typeof TE._fabricLoadImage === 'function')
      ? TE._fabricLoadImage(url, { crossOrigin: 'anonymous' })
      : new Promise((resolve, reject) => {
          fabric.Image.fromURL(
            url,
            (img) => (img ? resolve(img) : reject(new Error(pbT('te.greenwall.img_null', 'img null')))),
            { crossOrigin: 'anonymous' }
          );
        });

    load.then((img) => {
      const W = Number(TE.state.width || c.getWidth?.() || c.width || 1);
      const H = Number(TE.state.height || c.getHeight?.() || c.height || 1);

      img.set({
        originX: 'left',
        originY: 'top',
        left: 0,
        top: 0,
        scaleX: W / (img.width || 1),
        scaleY: H / (img.height || 1)
      });

      TE._setCanvasBackground(c, img);
    }).catch(() => {
      TE._setCanvasBackground(c, null);
    });
  };

  // ---------------------------
  // Exists check (API)
  // ---------------------------
  TE.apiProjectExists = function (name) {
    const dfd = $.Deferred();
    const n = String(name || '').trim().toLowerCase();
    if (!n) return dfd.resolve(false).promise();

    if (typeof TE.apiListProjects !== 'function') {
      return dfd.reject(new Error(pbT('te.api.list_projects_missing', 'TE.apiListProjects fehlt'))).promise();
    }

    TE.apiListProjects()
      .done(function (res) {
        const projects = (res && res.ok && Array.isArray(res.projects)) ? res.projects : [];
        const exists = projects.some(p => String(p && p.name ? p.name : '').trim().toLowerCase() === n);

        TE.state = TE.state || {};
        TE.state.projects = projects;
        TE.state.projectNameSet = new Set(
          projects.map(p => String(p.name || '').trim().toLowerCase()).filter(Boolean)
        );

        dfd.resolve(exists);
      })
      .fail(function () {
        dfd.reject(new Error(pbT('te.api.list_projects_failed', 'apiListProjects fehlgeschlagen')));
      });

    return dfd.promise();
  };

  // ---------------------------
  // PHOTO Renumber (gapless)
  // ---------------------------
  TE._getFirstTextInGroup = function (g) {
    if (!g) return null;
    const arr = Array.isArray(g._objects) ? g._objects : [];
    for (const o of arr) {
      if (o && typeof o.text === 'string') return o;
    }
    return null;
  };

  TE._setPhotoIndex = function (g, newIdx) {
    if (!g) return;

    g.pbIndex = Number(newIdx) || 0;

    const tObj = TE._getFirstTextInGroup(g);
    if (tObj) {
      tObj.set('text', fmt('te.layer.photo.placeholder', 'FOTO {idx}', { idx: g.pbIndex }));
      tObj.dirty = true;
    }

    if (typeof g._calcBounds === 'function') g._calcBounds();
    if (typeof g._updateObjectsCoords === 'function') g._updateObjectsCoords();
    if (typeof g.setCoords === 'function') g.setCoords();
  };

  TE.renumberPhotoPlaceholders = function () {
    const c = TE.state.canvas;
    if (!c) return 0;

    const photos = c.getObjects().filter(o => (o && o.pbType) === 'photo');

    photos.sort((a, b) => {
      const ai = Number(a.pbIndex || 0);
      const bi = Number(b.pbIndex || 0);
      return ai - bi;
    });

    let idx = 1;
    for (const p of photos) TE._setPhotoIndex(p, idx++);

    TE.state.photoCounter = photos.length;

    c.requestRenderAll();
    if (typeof TE.refreshLayers === 'function') TE.refreshLayers();
    if (TE.state.selected && TE.state.selected.pbType === 'photo' && typeof TE.syncInspectorFromSelected === 'function') {
      TE.syncInspectorFromSelected();
    }

    return photos.length;
  };
})();
