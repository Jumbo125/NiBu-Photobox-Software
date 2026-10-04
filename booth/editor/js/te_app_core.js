// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* global $, bootstrap */
/**
 * Template Editor – Business Flow
 * - Wizard / Import-Export / Projekte / Buttons
 */
(function () {
  'use strict';

  if (window.__TE_APP_CORE_LOADED) return;
  window.__TE_APP_CORE_LOADED = true;

  $(function () {
    const TE = window.TE;

    // i18n helper: bevorzugt TE.t(), sonst pbT(), sonst fallback
    function tr(key, fallback) {
      try {
        if (TE && typeof TE.t === 'function') return TE.t(key, fallback);
        if (typeof window.pbT === 'function') return window.pbT(key, fallback);
      } catch (_) {}
      return fallback;
    }

    if (!TE) {
      alert(tr('template_editor.err.te_not_loaded', 'Template editor functions not loaded.'));
      return;
    }
    if (!window.bootstrap) {
      alert(tr('template_editor.err.bootstrap_not_loaded', 'Bootstrap not loaded.'));
      return;
    }

    function refreshInspectors() {
      try {
        if (typeof TE.syncInspectorFromSelected === 'function') TE.syncInspectorFromSelected();
        if (typeof TE.syncStyleInspectorFromSelected === 'function') TE.syncStyleInspectorFromSelected();
      } catch (_) {
        // Inspector-Refresh darf das UI nicht blockieren
      }
    }

    // Canvas Hooks: Selection/Modify -> Inspector automatisch refreshen (einmalig binden)
    (function bindCanvasInspectorHooks() {
      if (TE.__inspectorHooksBound) return;
      TE.__inspectorHooksBound = true;

      const tryBind = function () {
        const c = TE.state && TE.state.canvas;
        if (!c || !c.on) return false;

        const h = function () { refreshInspectors(); };

        c.on('selection:created', h);
        c.on('selection:updated', h);
        c.on('selection:cleared', h);
        c.on('object:modified', h);
        c.on('object:scaling', h);
        c.on('object:moving', h);
        return true;
      };

      // sofort + später noch einmal (nach TE.initEditor)
      tryBind();
      $(document).on('te:editorReady', function () {
        tryBind();
        refreshInspectors();
      });
    })();

    // i18n init
    if (typeof TE.initI18n === 'function') {
      TE.initI18n().catch(function (err) { console.warn(err); });
    }

    // Modal + Tabs
    const modalEl = document.getElementById('teModal');
    const bsModal = bootstrap.Modal.getOrCreateInstance(modalEl, {
      backdrop: 'static',
      keyboard: false
    });
    bsModal.show();

    const $tabs = $('#teTabs .nav-link');
    const $panels = $('.te-tabpanel');

    $tabs.on('click', function () {
      TE.setTab($(this).data('tab'), $tabs, $panels);
    });
    TE.setTab('new', $tabs, $panels);

    // Preset Size
    const $preset = $('#presetSize');
    const $inW = $('#newW');
    const $inH = $('#newH');

    function applyPreset(v) {
      if (!v || v === 'custom') return;
      const m = String(v).match(/^(\d+)x(\d+)$/);
      if (!m) return;
      $inW.val(m[1]);
      $inH.val(m[2]);
    }
    $preset.on('change', function () { applyPreset($preset.val()); });
    applyPreset($preset.val());

    // Wizard wieder öffnen
    $('#btnNew').on('click', function () {
      bsModal.show();
      TE.setTab('new', $tabs, $panels);
      setTimeout(function () { $('#newName').trigger('focus'); }, 150);
    });

    // Active Template Tab öffnen
    $('#btnactiveTemplate').on('click', function () {
      bsModal.show();
      TE.setTab('activetemplate', $tabs, $panels);
    });

    // Create New
    let starting = false;
    $('#btnCreateNew').on('click', function (e) {
      e.preventDefault();
      e.stopPropagation();

      if (starting) return;
      starting = true;

      const nameRaw = $('#newName').val();
      const name = (typeof TE.sanitizeNameClient === 'function')
        ? TE.sanitizeNameClient(nameRaw)
        : String(nameRaw || '').trim();

      const w = Number($inW.val());
      const h = Number($inH.val());

      if (!name) {
        starting = false;
        return TE.toast(tr('template_editor.toast.enter_template_name', 'Please enter a template name.'));
      }
      if (!Number.isFinite(w) || !Number.isFinite(h) || w < 100 || h < 100) {
        starting = false;
        return TE.toast(tr('template_editor.toast.invalid_size', 'Invalid size.'));
      }

      TE.apiProjectExists(name)
        .done(function (exists) {
          if (exists) {
            starting = false;
            TE.toast(tr(
              'template_editor.toast.template_exists',
              'This template already exists. Please choose another name.'
            ));
            return;
          }

          bsModal.hide();

          if (typeof TE.setActiveProject === 'function') {
            TE.setActiveProject(name);
          } else {
            TE.state.templateName = name;
            TE.activeProject = name;
          }

          TE.initEditor({ templateName: name, width: w, height: h });
          $(document).trigger('te:editorReady');

          TE.toast(tr('template_editor.toast.editor_started', 'Editor started.'));

          if (typeof TE.detectGreenwallAsset === 'function') {
            TE.detectGreenwallAsset({ activateIfFound: false }); // nur finden, nicht aktivieren
          }

          // Viewport reset
          setTimeout(function () {
            TE.state.viewPanX = 0;
            TE.state.viewPanY = 0;
            const frame = document.querySelector('.te-canvas-frame');
            if (frame) frame.style.transform = 'translate(0,0)';
          }, 0);

          starting = false;
        })
        .fail(function () {
          starting = false;
          TE.toast(tr(
            'template_editor.toast.check_exists_failed',
            "Couldn't check whether the template already exists (API error)."
          ));
        });
    });

    // Import Modal öffnen
    $('#btnImport').on('click', function () {
      bsModal.show();
      TE.setTab('import', $('[data-tab]'), $('[data-panel]'));
    });

    // Import ZIP
    $('#btnDoImport').on('click', async function (e) {
      e.preventDefault();
      e.stopPropagation();
      try {
        const f = $('#fileImportZip')[0].files[0];
        const data = await TE.importZip(f);
        bsModal.hide();

        if (data.templateName) {
          TE.activeProject = data.templateName;
          TE.state = TE.state || {};
          TE.state.templateName = data.templateName;
          const inp = document.getElementById('teTemplateNameInput');
          if (inp) inp.value = data.templateName;
        }

        TE.loadFromData(data);

        TE.toast(
          tr('template_editor.toast.import_ok_prefix', 'Import OK: ') + (data.templateName || '')
        );

        refreshInspectors();
      } catch (err) {
        TE.toast(String(err.message || err));
      }
    });

    // Add Photo
    $('#btnAddPhoto').on('click', function () {
      if (!TE.state || !TE.state.canvas) {
        return TE.toast(tr('template_editor.toast.start_template_first', 'Start a template first.'));
      }
      TE.addPhotoPlaceholder();
      refreshInspectors();
    });

    // Add Image (Upload)
    const $fileAddImage = $('#fileAddImage');
    $('#btnAddImage').on('click', function () {
      if (!TE.state || !TE.state.templateName) {
        return TE.toast(tr('template_editor.toast.start_template_first', 'Start a template first.'));
      }
      $fileAddImage.val('');
      $fileAddImage.trigger('click');
    });

    $fileAddImage.on('change', async function () {
      try {
        const file = $fileAddImage[0].files[0];
        if (!file) return;

        const fd = new FormData();
        fd.append('templateName', TE.state.templateName);
        fd.append('file', file);

        const res = await TE.uploadFile('/api/template_editor_upload_asset.php', fd);
        TE.addImageFromServer(res.url, res.relPath, res.name);

        TE.toast(tr('template_editor.toast.image_added', 'Image added.'));

        refreshInspectors();
      } catch (err) {
        TE.toast(String(err.message || err));
      }
    });

    // GREENWALL
    const $chkGreenwall = $('#chkGreenwall');
    const $btnGreenwallUpload = $('#btnGreenwallUpload');
    const $fileGreenwall = $('#fileGreenwall');

    if (typeof TE.cacheGreenwallUi === 'function') TE.cacheGreenwallUi();
    if (typeof TE.syncGreenwallUiFromState === 'function') TE.syncGreenwallUiFromState();

    $chkGreenwall.off('change.teGreenwall').on('change.teGreenwall', function () {
      if (!TE.state) return;
      TE.state.greenwall = !!this.checked;

      if (TE.state.greenwall && typeof TE.detectGreenwallAsset === 'function') {
        TE.detectGreenwallAsset({ activateIfFound: true });
      } else if (typeof TE.applyGreenwall === 'function') {
        TE.applyGreenwall();
      }
    });

    $btnGreenwallUpload.off('click.teGreenwall').on('click.teGreenwall', function () {
      if (!TE.state || !TE.state.templateName) {
        return TE.toast(tr('template_editor.toast.start_template_first', 'Start a template first.'));
      }
      $fileGreenwall.val('');
      $fileGreenwall.trigger('click');
    });

    $fileGreenwall.off('change.teGreenwall').on('change.teGreenwall', async function () {
      try {
        const file = $fileGreenwall[0].files[0];
        if (!file) return;
        if (!TE.state || !TE.state.templateName) {
          return TE.toast(tr('template_editor.toast.start_template_first', 'Start a template first.'));
        }

        const n = (file.name || '').toLowerCase();
        let ext = '';
        if (n.endsWith('.png')) ext = 'png';
        else if (n.endsWith('.jpg') || n.endsWith('.jpeg')) ext = 'jpg';
        else return TE.toast(tr('template_editor.toast.only_png_jpg_allowed', 'Only PNG or JPG allowed.'));

        const targetName = `___greenwall.${ext}`;

        const fd = new FormData();
        fd.append('templateName', TE.state.templateName);
        fd.append('file', file);
        fd.append('targetName', targetName);

        const res = await TE.uploadFile('/api/template_editor_upload_asset.php', fd);
        const saved = res.savedName || targetName;

        TE.state.greenwallAsset = { name: saved, relPath: res.relPath, url: res.url };
        TE.state.greenwallName = saved;
        TE.state.greenwallSrc = res.relPath;
        TE.state.greenwall = true;

        if (typeof TE.syncGreenwallUiFromState === 'function') TE.syncGreenwallUiFromState();
        if (typeof TE.applyGreenwall === 'function') TE.applyGreenwall();

        TE.toast(tr('template_editor.toast.greenwall_saved', 'Greenwall saved.'));
      } catch (err) {
        TE.toast(String(err.message || err));
      }
    });

    // Save / Export
    $('#btnSave').on('click', async function () {
      try {
        if (!TE.state || !TE.state.templateName) {
          return TE.toast(tr('template_editor.toast.no_active_template', 'No template active.'));
        }
        await TE.saveTemplate();
        TE.toast(tr('template_editor.toast.saved_template_xml', 'Saved (template.xml).'));
      } catch (err) {
        TE.toast(String(err.message || err));
      }
    });

    $('#btnExport').on('click', async function () {
      try {
        if (!TE.state || !TE.state.templateName) {
          return TE.toast(tr('template_editor.toast.no_active_template', 'No template active.'));
        }
        await TE.saveTemplate();
        await TE.exportZip();
        TE.toast(tr('template_editor.toast.export_started', 'ZIP export started.'));
      } catch (err) {
        TE.toast(String(err.message || err));
      }
    });

    $('#btnTestPrint').on('click', async function () {
      const $btn     = $('#btnTestPrint');
      const $spinner = $('#btnTestPrintSpinner');
      const $icon    = $('#btnTestPrintIcon');
      const $toast   = $('#testPrintToast');
      const $msg     = $('#testPrintToastMsg');

      if ($btn.prop('disabled')) return;
      $btn.prop('disabled', true);
      $spinner.removeClass('d-none');
      $icon.addClass('d-none');

      const showToast = (text, isError) => {
        $toast.removeClass('bg-success bg-danger text-white');
        $toast.addClass(isError ? 'bg-danger text-white' : 'bg-success text-white');
        $msg.text(text);
        const bsToast = bootstrap.Toast.getOrCreateInstance($toast[0], { delay: isError ? 6000 : 4000 });
        bsToast.show();
      };

      try {
        if (!TE.state || !TE.state.templateName) {
          return showToast(tr('template_editor.toast.no_active_template', 'No template active.'), true);
        }
        await TE.saveTemplate();

        const resp = await fetch('/api/test_print.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateName: TE.state.templateName }),
        });
        let result = {};
        try { result = await resp.json(); } catch (_) {}
        if (result && result.ok) {
          showToast(tr('te.testprint.success', 'Test-Druck gesendet!'), false);
        } else {
          const msg = result?.message || result?.error || tr('te.testprint.err.unknown', 'Unbekannter Fehler.');
          showToast(tr('te.testprint.err.failed', 'Test-Druck fehlgeschlagen: ') + msg, true);
        }
      } catch (err) {
        showToast(tr('te.testprint.err.exception', 'Fehler: ') + String(err?.message || err), true);
      } finally {
        $btn.prop('disabled', false);
        $spinner.addClass('d-none');
        $icon.removeClass('d-none');
      }
    });

    $('#btnSetActiveTemplate').on('click', async function () {
      const $btn     = $('#btnSetActiveTemplate');
      const $spinner = $('#btnSetActiveSpinner');
      const $icon    = $('#btnSetActiveIcon');

      if ($btn.prop('disabled')) return;

      const name = (TE.state && TE.state.templateName) || '';
      if (!name) {
        return TE.toast(tr('template_editor.toast.no_active_template', 'No template active.'));
      }

      const confirmMsg = tr(
        'te.setActive.confirm',
        'Soll "' + name + '" als aktives Template gesetzt werden?\nDas bisherige aktive Template wird überschrieben.'
      ).replace('{name}', name);

      if (!window.confirm(confirmMsg)) return;

      $btn.prop('disabled', true);
      $spinner.removeClass('d-none');
      $icon.addClass('d-none');

      try {
        await TE.saveTemplate();

        const resp = await fetch('/api/template_set_active.php', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ templateName: name }),
          cache: 'no-store'
        });
        let result = {};
        try { result = await resp.json(); } catch (_) {}

        if (result && result.ok) {
          TE.toast(tr('te.setActive.success', '"' + name + '" ist jetzt das aktive Template.').replace('{name}', name));
        } else {
          const msg = result?.error || tr('te.setActive.err.unknown', 'Unbekannter Fehler.');
          TE.toast(tr('te.setActive.err.failed', 'Fehler: ') + msg);
        }
      } catch (err) {
        TE.toast(tr('te.setActive.err.exception', 'Fehler: ') + String(err?.message || err));
      } finally {
        $btn.prop('disabled', false);
        $spinner.addClass('d-none');
        $icon.removeClass('d-none');
      }
    });

    // Z-order / Delete
    $('#btnBringFwd').on('click', function () { TE.bringForward(); });
    $('#btnSendBack').on('click', function () { TE.sendBackwards(); });
    $('#btnDelete').on('click', function () { TE.deleteSelected(); refreshInspectors(); });

    // Inspector -> apply
    ['inX', 'inY', 'inW', 'inH', 'inR'].forEach(function (id) {
      $('#' + id).on('change', function () {
        if (!TE.state || !TE.state.canvas) return;
        TE.state.suppressInspector = true;
        TE.applyInspectorToSelected(id);
        TE.state.suppressInspector = false;
        TE.syncInspectorFromSelected();
        refreshInspectors();
      });
    });

    if (typeof TE.initAspectLockBtn === 'function') TE.initAspectLockBtn();

    // Projekte: beim Modal anzeigen aktualisieren
    $(document).on('shown.bs.modal', '#teModal', function () {
      TE.uiRefreshProjects();
    });

    $(document).on('click', '#teBtnRefreshProjects', function () {
      TE.uiRefreshProjects();
    });

    $(document).on('change', '#teProjectSelect', function () {
      $('#teBtnOpenProject').prop('disabled', !$(this).val());
    });

    // Öffne Projekt
    $(document).on('click', '#teBtnOpenProject', async function () {
      const $opt = $('#teProjectSelect option:selected');
      const projectId = $('#teProjectSelect').val();
      const xmlUrl = $opt.attr('data-xml-url');
      const baseUrl = $opt.attr('data-base-url');

      if (!projectId || !xmlUrl) return;

      try {
        let xmlText = await $.ajax({
          url: xmlUrl,
          method: 'GET',
          dataType: 'text',
          cache: false
        });

        if (typeof TE.rewriteXmlAssetPaths === 'function') {
          xmlText = TE.rewriteXmlAssetPaths(xmlText, baseUrl);
        }

        TE.activeProject = projectId;
        TE.state = TE.state || {};
        TE.state.templateName = projectId;

        if (typeof TE.importFromXmlText !== 'function') {
          alert(tr(
            'template_editor.err.import_from_xml_missing',
            'TE.importFromXmlText is missing – please add the function.'
          ));
          return;
        }

        await TE.importFromXmlText(xmlText, {
          templateName: projectId,
          displayName: projectId,
          baseUrl: baseUrl,
          basePath: baseUrl.replace(/\/$/, '')
        });
        $(document).trigger('te:editorReady');

        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      } catch (e) {
        console.error(e);
        alert(tr('template_editor.err.project_xml_load_failed', 'Project XML could not be loaded.'));
      }
    });

    // Active Template laden (statische Pfade)
    $(document).on('click', '#btnLoadActiveTemplate', async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const projectId = 'activeTemplate';
      const xmlUrl = '/activeTemplate/template.xml';
      const baseUrl = '/activeTemplate/';

      try {
        let xmlText = await $.ajax({
          url: xmlUrl,
          method: 'GET',
          dataType: 'text',
          cache: false
        });

        if (typeof TE.rewriteXmlAssetPaths === 'function') {
          xmlText = TE.rewriteXmlAssetPaths(xmlText, baseUrl);
        }

        TE.activeProject = projectId;
        TE.state = TE.state || {};
        TE.state.templateName = projectId;

        if (typeof TE.importFromXmlText !== 'function') {
          alert(tr(
            'template_editor.err.import_from_xml_missing',
            'TE.importFromXmlText is missing – please add the function.'
          ));
          return;
        }

        await TE.importFromXmlText(xmlText, { templateName: projectId });
        $(document).trigger('te:editorReady');

        const modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();

        if (typeof TE.toast === 'function') {
          TE.toast(tr('template_editor.toast.active_template_loaded', 'Active template loaded.'));
        }
      } catch (err) {
        console.error(err);
        alert(tr(
          'template_editor.err.active_template_xml_load_failed',
          'ActiveTemplate XML could not be loaded.'
        ));
      }
    });

    // Template-Name Input: Änderungen sofort in TE.activeProject / TE.state.templateName übernehmen
    $(document).on('change blur', '#teTemplateNameInput', function () {
      const val = TE.sanitizeName ? TE.sanitizeName($(this).val()) : $(this).val().trim();
      if (!val) return;
      $(this).val(val);
      TE.activeProject = val;
      if (TE.state) TE.state.templateName = val;
    });

    // Language dropdown
    $(document).on('click', '.dropdown-item[data-lang]', async function (e) {
      e.preventDefault();
      e.stopPropagation();

      const lang = $(this).data('lang');
      if (!lang || typeof TE.setLang !== 'function') return;

      try {
        await TE.setLang(lang, { persist: true });
      } catch (err) {
        TE.toast(String(err.message || err));
      }
    });
  });
})();
