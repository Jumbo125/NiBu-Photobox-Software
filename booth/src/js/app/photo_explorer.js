// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * photo_explorer.js — Eigener Foto-Browser mit Ordner-Navigation
 *
 * Zeigt booth/photos/ als navigierbaren Verzeichnisbaum:
 *   - Breadcrumb-Pfadleiste
 *   - Unterordner als anklickbare Karten
 *   - Bilder im aktuellen Ordner als Thumbnails
 *   - Lightbox: Großansicht + Vor/Zurück + Drucken
 *
 * Python-Endpunkte (Port 8053):
 *   GET /photos/list          → { ok, photos:[{name,rel,folder,size,modified}] }
 *   GET /photos/file?rel=...  → Bild binär
 */
(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  if (PB.photoExplorer) return;

  // -----------------------------------------------------------------------
  // Konstanten
  // -----------------------------------------------------------------------
  const OVERLAY_ID = 'pbPhotoExplorer';
  const THUMB_SIZE = 180;
  const PY_BASE    = () => (window.PB_TOOL_SERVER_BASE || 'http://127.0.0.1:8053').replace(/\/+$/, '');

  const t = (key, fb) => typeof window.pbT === 'function' ? window.pbT(key, fb) : fb;

  /**
   * Liest den absoluten Event-Ordner-Pfad aus PB_CONFIG.
   * Struktur: photo_storage_path\EVENTS\eventName
   * Entspricht der Logik in windows_picker_bindings.js → handleOpenFolder("activeEvent").
   * Gibt leeren String zurück wenn nicht konfiguriert → Python fällt auf booth/photos/ zurück.
   */
  function _getEventBasePath() {
    const ae = (PB._getDeep && PB._getDeep(window.PB_CONFIG, 'activeEvent.active_event')) || {};
    // photo_storage_path enthält bereits den vollständigen Pfad (booth\photos\EVENTS\eventName)
    return String(ae.photo_storage_path || '').trim();
  }

  // -----------------------------------------------------------------------
  // CSS
  // -----------------------------------------------------------------------
  function _injectCss() {
    if (document.getElementById('pbPhotoExplorerCss')) return;
    const s = document.createElement('style');
    s.id = 'pbPhotoExplorerCss';
    s.textContent = `
#pbPhotoExplorer {
  position: fixed; inset: 0; z-index: 9990;
  background: #111; color: #eee;
  display: flex; flex-direction: column; font-family: inherit;
}
/* Header */
#pbPhotoExplorer .pbe-header {
  display: flex; align-items: center; gap: .6rem;
  padding: .55rem 1rem; background: #1a1a1a;
  border-bottom: 1px solid #333; flex-shrink: 0;
}
#pbPhotoExplorer .pbe-header h2 {
  margin: 0; font-size: 1.05rem; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
#pbPhotoExplorer .pbe-count { font-size: .82rem; color: #888; white-space: nowrap; }

/* Breadcrumb */
#pbPhotoExplorer .pbe-breadcrumb {
  display: flex; align-items: center; flex-wrap: wrap; gap: .2rem;
  padding: .45rem 1rem; background: #181818;
  border-bottom: 1px solid #2a2a2a; flex-shrink: 0;
  font-size: .85rem;
}
#pbPhotoExplorer .pbe-bc-item {
  cursor: pointer; color: #8ab4f8; padding: .1rem .3rem; border-radius: 3px;
}
#pbPhotoExplorer .pbe-bc-item:hover { background: #2a2a2a; }
#pbPhotoExplorer .pbe-bc-sep { color: #555; }
#pbPhotoExplorer .pbe-bc-current { color: #ccc; cursor: default; }

/* Grid */
#pbPhotoExplorer .pbe-grid-wrap {
  flex: 1; overflow-y: auto; padding: 1rem;
}
#pbPhotoExplorer .pbe-grid {
  display: flex; flex-wrap: wrap; gap: .75rem;
}

/* Ordner-Karte */
#pbPhotoExplorer .pbe-folder {
  width: ${THUMB_SIZE}px; cursor: pointer; border-radius: 6px;
  border: 2px solid #444; background: #1e2030; flex-shrink: 0;
  display: flex; flex-direction: column; align-items: center;
  justify-content: center; padding: .75rem .5rem; gap: .4rem;
  transition: border-color .15s;
}
#pbPhotoExplorer .pbe-folder:hover { border-color: #ffc107; }
#pbPhotoExplorer .pbe-folder i { font-size: 2.5rem; color: #ffc107; }
#pbPhotoExplorer .pbe-folder .pbe-folder-name {
  font-size: .72rem; text-align: center; color: #ccc;
  word-break: break-all; max-width: 100%;
}
#pbPhotoExplorer .pbe-folder .pbe-folder-count {
  font-size: .65rem; color: #777;
}

/* Bild-Karte */
#pbPhotoExplorer .pbe-thumb {
  width: ${THUMB_SIZE}px; cursor: pointer; border-radius: 6px;
  overflow: hidden; border: 2px solid transparent;
  background: #222; flex-shrink: 0; transition: border-color .15s;
}
#pbPhotoExplorer .pbe-thumb:hover { border-color: #0d6efd; }
#pbPhotoExplorer .pbe-thumb img {
  width: 100%; height: ${THUMB_SIZE}px; object-fit: cover; display: block;
}
#pbPhotoExplorer .pbe-thumb .pbe-thumb-name {
  font-size: .65rem; padding: .2rem .3rem;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: #aaa;
}

/* Status */
#pbPhotoExplorer .pbe-empty {
  color: #666; text-align: center; margin-top: 3rem; font-size: 1rem;
}
#pbPhotoExplorer .pbe-spinner {
  text-align: center; margin-top: 3rem; font-size: 1rem; color: #888;
}

/* Lightbox */
#pbPhotoExplorer .pbe-lightbox {
  position: absolute; inset: 0; background: rgba(0,0,0,.93);
  display: flex; flex-direction: column; z-index: 10;
}
#pbPhotoExplorer .pbe-lightbox-toolbar {
  display: flex; align-items: center; gap: .5rem;
  padding: .5rem .75rem; background: #1a1a1a; flex-shrink: 0; flex-wrap: wrap;
}
#pbPhotoExplorer .pbe-lightbox-title {
  flex: 1; font-size: .88rem; color: #ccc;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
#pbPhotoExplorer .pbe-lightbox-img-wrap {
  flex: 1; display: flex; align-items: center; justify-content: center;
  overflow: hidden; position: relative;
}
#pbPhotoExplorer .pbe-lightbox-img-wrap img {
  max-width: 100%; max-height: 100%; object-fit: contain;
}
#pbPhotoExplorer .pbe-lb-nav {
  position: absolute; top: 50%; transform: translateY(-50%);
  background: rgba(0,0,0,.5); border: none; color: #fff;
  font-size: 2rem; padding: .4rem .8rem; cursor: pointer; border-radius: 4px; line-height: 1;
}
#pbPhotoExplorer .pbe-lb-nav:hover { background: rgba(0,0,0,.85); }
#pbPhotoExplorer .pbe-lb-prev { left: .5rem; }
#pbPhotoExplorer .pbe-lb-next { right: .5rem; }

/* Print-Ergebnis Modal (innerhalb Lightbox) */
#pbPhotoExplorer .pbe-print-result-modal {
  position: absolute; inset: 0; z-index: 20;
  background: rgba(0,0,0,.75);
  display: flex; align-items: center; justify-content: center;
}
#pbPhotoExplorer .pbe-print-result-box {
  background: #1e1e2e; border-radius: 12px;
  border: 1px solid #444;
  padding: 2rem 2.5rem; text-align: center;
  min-width: 280px; max-width: 420px;
  display: flex; flex-direction: column; align-items: center; gap: .5rem;
}
#pbPhotoExplorer .pbe-print-result-icon { font-size: 3rem; line-height: 1; }
#pbPhotoExplorer .pbe-print-result-title { font-size: 1.15rem; font-weight: 600; margin-top: .25rem; }
#pbPhotoExplorer .pbe-print-result-text  { font-size: .9rem; color: #aaa; }
    `;
    document.head.appendChild(s);
  }

  // -----------------------------------------------------------------------
  // State
  // -----------------------------------------------------------------------
  let _allPhotos    = [];  // alle Fotos vom Server (flach, relativ zu booth/photos)
  let _curFolder    = '';  // aktuell angezeigter Ordner (relativ zu booth/photos)
  let _lbPhotos     = [];  // Fotos im aktuellen Ordner für Lightbox
  let _lbIndex      = -1;
  let _$overlay     = null;
  let _basePath     = '';  // booth\EVENTS — oberste Grenze, fix als base_path übergeben
  let _eventsBase   = '';  // absoluter Pfad zu booth\EVENTS

  // -----------------------------------------------------------------------
  // Verzeichnis-Baum Hilfsfunktionen
  // -----------------------------------------------------------------------

  /** Direkte Unterordner von `folder` aus `_allPhotos`. */
  function _subfolders(folder) {
    const prefix = folder ? folder + '/' : '';
    const seen   = new Set();
    _allPhotos.forEach(p => {
      if (!p.rel.startsWith(prefix)) return;
      const rest  = p.rel.slice(prefix.length);
      const slash = rest.indexOf('/');
      if (slash === -1) return;          // Datei direkt hier
      seen.add(rest.slice(0, slash));
    });
    return Array.from(seen).sort();
  }

  /** Dateien direkt in `folder` (nicht in Unterordnern). */
  function _filesInFolder(folder) {
    const prefix = folder ? folder + '/' : '';
    return _allPhotos.filter(p => {
      if (!p.rel.startsWith(prefix)) return false;
      const rest = p.rel.slice(prefix.length);
      return rest.indexOf('/') === -1;   // keine weiteren Slashes → direkte Datei
    });
  }

  /** Alle Bilder (auch in Unterordnern) eines Ordners – für Ordner-Zähler. */
  function _countInFolder(folder) {
    const prefix = folder ? folder + '/' : '';
    if (!prefix) return _allPhotos.length;
    return _allPhotos.filter(p => p.rel.startsWith(prefix)).length;
  }

  /** URL für ein Bild — base_path = aktuell aktiver Ordner. */
  function _photoUrl(rel) {
    const q = new URLSearchParams({ rel });
    if (_basePath) q.set('base_path', _basePath);
    return `${PY_BASE()}/photos/file?${q.toString()}`;
  }

  // -----------------------------------------------------------------------
  // HTML-Aufbau
  // -----------------------------------------------------------------------
  function _buildOverlay() {
    const html = `
<div id="${OVERLAY_ID}">
  <div class="pbe-header">
    <h2><i class="bi bi-images me-2"></i>${t('photo_explorer.title', 'Fotos')}</h2>
    <span class="pbe-count"></span>
    <button class="btn btn-sm btn-outline-secondary pbe-reload-btn" title="${t('photo_explorer.reload', 'Aktualisieren')}">
      <i class="bi bi-arrow-clockwise"></i>
    </button>
    <button class="btn btn-sm btn-outline-light pbe-close-btn">
      <i class="bi bi-x-lg me-1"></i>${t('photo_explorer.close', 'Schließen')}
    </button>
  </div>
  <div class="pbe-breadcrumb"></div>
  <div class="pbe-grid-wrap">
    <div class="pbe-grid"></div>
    <div class="pbe-spinner d-none"><i class="bi bi-hourglass-split me-2"></i>${t('photo_explorer.loading', 'Lade Fotos…')}</div>
    <div class="pbe-empty d-none"></div>
  </div>
</div>`;
    const $el = $(html);
    $('body').append($el);
    return $el;
  }

  function _buildLightbox($overlay) {
    const html = `
<div class="pbe-lightbox d-none">
  <div class="pbe-lightbox-toolbar">
    <button class="btn btn-sm btn-outline-secondary pbe-lb-back-btn">
      <i class="bi bi-grid me-1"></i>${t('photo_explorer.back', 'Zurück')}
    </button>
    <span class="pbe-lightbox-title"></span>
    <button class="btn btn-sm btn-outline-success pbe-lb-print-btn">
      <i class="bi bi-printer me-1"></i>${t('photo_explorer.print', 'Drucken')}
    </button>
    <button class="btn btn-sm btn-outline-light pbe-lb-close-btn">
      <i class="bi bi-x-lg"></i>
    </button>
  </div>
  <div class="pbe-lightbox-img-wrap">
    <button class="pbe-lb-nav pbe-lb-prev">&#8249;</button>
    <img src="" alt="" />
    <button class="pbe-lb-nav pbe-lb-next">&#8250;</button>
  </div>
  <div class="pbe-print-result-modal d-none">
    <div class="pbe-print-result-box">
      <div class="pbe-print-result-icon"></div>
      <div class="pbe-print-result-title"></div>
      <div class="pbe-print-result-text"></div>
      <button class="btn btn-light mt-3 pbe-print-result-close">
        ${t('common.ok', 'OK')}
      </button>
    </div>
  </div>
</div>`;
    const $lb = $(html);
    $overlay.append($lb);
    return $lb;
  }

  // -----------------------------------------------------------------------
  // Breadcrumb rendern
  // -----------------------------------------------------------------------
  function _renderBreadcrumb($overlay) {
    const $bc   = $overlay.find('.pbe-breadcrumb');
    const parts = _curFolder ? _curFolder.split('/') : [];
    let html    = '';

    // base_path = booth\EVENTS, _curFolder relativ dazu
    // _curFolder=''        → Alle Events (Root)
    // _curFolder='Hochzeit' → im Event
    // _curFolder='Hochzeit/Session1' → Unterordner

    if (_curFolder) {
      // Innerhalb eines Events: "Alle Events" als klickbarer Link
      html += `<span class="pbe-bc-item pbe-bc-all-events">`
            + `<i class="bi bi-grid me-1"></i>${t('photo_explorer.all_events', 'Alle Events')}</span>`;
      parts.forEach((part, i) => {
        const folderPath = parts.slice(0, i + 1).join('/');
        const isLast     = i === parts.length - 1;
        html += `<span class="pbe-bc-sep">/</span>`;
        html += isLast
          ? `<span class="pbe-bc-current">${_esc(part)}</span>`
          : `<span class="pbe-bc-item" data-folder="${_esc(folderPath)}">${_esc(part)}</span>`;
      });
    } else {
      // Root: "Alle Events" als aktiver Titel
      html += `<span class="pbe-bc-current">`
            + `<i class="bi bi-grid me-1"></i>${t('photo_explorer.all_events', 'Alle Events')}</span>`;
    }

    $bc.html(html);
  }

  function _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // -----------------------------------------------------------------------
  // Grid rendern (Ordner + Bilder des aktuellen Verzeichnisses)
  // -----------------------------------------------------------------------
  function _renderGrid($overlay) {
    const $grid  = $overlay.find('.pbe-grid');
    const $empty = $overlay.find('.pbe-empty');
    const $count = $overlay.find('.pbe-count');
    $grid.empty();
    $empty.addClass('d-none');

    const folders = _subfolders(_curFolder);
    const files   = _filesInFolder(_curFolder);

    _lbPhotos = files;   // Lightbox navigiert nur innerhalb aktueller Ebene
    _lbIndex  = -1;

    if (folders.length === 0 && files.length === 0) {
      $empty.removeClass('d-none').html(
        `<i class="bi bi-camera me-2"></i>${t('photo_explorer.empty', 'Keine Fotos vorhanden.')}`
      );
      $count.text('');
      return;
    }

    const totalFiles = _allPhotos.length;
    $count.text(`${totalFiles} ${t('photo_explorer.photos_count', 'Fotos gesamt')}`);

    // Ordner zuerst
    folders.forEach(name => {
      const fullPath = _curFolder ? `${_curFolder}/${name}` : name;
      const cnt      = _countInFolder(fullPath);
      const $card    = $(`
<div class="pbe-folder" data-folder="${_esc(fullPath)}">
  <i class="bi bi-folder2"></i>
  <div class="pbe-folder-name">${_esc(name)}</div>
  <div class="pbe-folder-count">${cnt} ${t('photo_explorer.items', 'Bilder')}</div>
</div>`);
      $grid.append($card);
    });

    // Dann Bilder
    files.forEach((photo, idx) => {
      const imgUrl = _photoUrl(photo.rel);
      const $thumb = $(`
<div class="pbe-thumb" data-file-idx="${idx}" title="${_esc(photo.name)}">
  <img src="${_esc(imgUrl)}" alt="${_esc(photo.name)}" loading="lazy" />
  <div class="pbe-thumb-name">${_esc(photo.name)}</div>
</div>`);
      $grid.append($thumb);
    });
  }

  // -----------------------------------------------------------------------
  // Ordner navigieren
  // -----------------------------------------------------------------------
  function _navigateTo($overlay, folder) {
    _curFolder = folder;
    _renderBreadcrumb($overlay);
    _renderGrid($overlay);
    $overlay.find('.pbe-grid-wrap').scrollTop(0);
  }

  // -----------------------------------------------------------------------
  // Daten laden
  // -----------------------------------------------------------------------
  async function _loadPhotos($overlay) {
    const $grid    = $overlay.find('.pbe-grid');
    const $spinner = $overlay.find('.pbe-spinner');
    const $empty   = $overlay.find('.pbe-empty');
    const $count   = $overlay.find('.pbe-count');

    $grid.empty();
    $spinner.removeClass('d-none');
    $empty.addClass('d-none');
    $count.text('');

    // Beim ersten Laden: _eventsBase und _basePath aus photo_storage_path ableiten
    // _eventsBase = booth\EVENTS  (oberste Grenze, für "Alle Events")
    // _basePath   = aktuell aktiver base_path für den Server (Event oder EVENTS)
    if (!_eventsBase) {
      const eventPath = _getEventBasePath(); // booth\EVENTS\EventName
      if (eventPath) {
        const sep   = eventPath.includes('\\') ? '\\' : '/';
        const idx   = eventPath.lastIndexOf(sep);
        _eventsBase = idx > 0 ? eventPath.slice(0, idx) : eventPath;
        // Beim Öffnen: direkt den Event-Ordner als base_path setzen
        _basePath   = eventPath;
        _curFolder  = '';
      }
    }

    try {
      const q   = _basePath ? `?base_path=${encodeURIComponent(_basePath)}` : '';
      const res = await fetch(`${PY_BASE()}/photos/list${q}`, { cache: 'no-store' });
      const json = await res.json();
      $spinner.addClass('d-none');

      // Header-Info: welches Verzeichnis wird angezeigt
      const dirLabel = json.photos_dir
        ? `<span class="pbe-basedir-label" title="${_esc(json.photos_dir)}">${_esc(_basePath || json.photos_dir)}</span>`
        : '';
      $overlay.find('.pbe-header h2').html(
        `<i class="bi bi-images me-2"></i>${t('photo_explorer.title', 'Fotos')} ${dirLabel}`
      );

      _allPhotos = Array.isArray(json.photos) ? json.photos : [];

      // Leer nur wenn wirklich gar nichts da ist — auch Unterordner zählen
      if (_allPhotos.length === 0 && _subfolders('').length === 0) {
        $empty.removeClass('d-none').html(
          `<i class="bi bi-camera me-2"></i>${t('photo_explorer.empty', 'Keine Fotos vorhanden.')}`
          + (json.photos_dir ? `<div class="small text-secondary mt-2">${_esc(json.photos_dir)}</div>` : '')
        );
        return;
      }

      _renderBreadcrumb($overlay);
      _renderGrid($overlay);

    } catch (err) {
      $spinner.addClass('d-none');
      $empty.removeClass('d-none').html(
        `<i class="bi bi-exclamation-triangle me-2"></i>${t('photo_explorer.load_error', 'Fehler beim Laden')}: ${_esc(err.message)}`
      );
      _allPhotos = [];
    }
  }

  // -----------------------------------------------------------------------
  // Lightbox
  // -----------------------------------------------------------------------
  function _openLightbox($lb, idx) {
    if (idx < 0 || idx >= _lbPhotos.length) return;
    _lbIndex = idx;
    const photo = _lbPhotos[idx];
    $lb.find('.pbe-lightbox-title').text(photo.rel);
    $lb.find('img').attr('src', _photoUrl(photo.rel));
    $lb.find('.pbe-print-ok, .pbe-print-err').addClass('d-none').text('');
    $lb.removeClass('d-none');
  }

  function _closeLightbox($lb) {
    $lb.addClass('d-none');
    $lb.find('img').attr('src', '');
    _lbIndex = -1;
  }

  function _navLightbox($lb, dir) {
    const next = _lbIndex + dir;
    if (next >= 0 && next < _lbPhotos.length) _openLightbox($lb, next);
  }

  // -----------------------------------------------------------------------
  // Drucken — Browser-nativer Druck via verstecktem iframe
  // -----------------------------------------------------------------------
  function _showPrintResult($lb, ok, title, text) {
    const $m = $lb.find('.pbe-print-result-modal');
    $m.find('.pbe-print-result-icon').html(ok
      ? '<i class="bi bi-check-circle-fill text-success"></i>'
      : '<i class="bi bi-x-circle-fill text-danger"></i>');
    $m.find('.pbe-print-result-title').text(title);
    $m.find('.pbe-print-result-text').text(text);
    $m.removeClass('d-none');
  }

  async function _printPhoto($lb, photo) {
    const $btn = $lb.find('.pbe-lb-print-btn');
    $btn.prop('disabled', true);

    try {
      // Absoluter Pfad: _basePath + rel (mit OS-Separator)
      const sep       = _basePath.includes('\\') ? '\\' : '/';
      const imagePath = _basePath + sep + photo.rel.replace(/\//g, sep);

      const eventFile = PB._getDeep
        ? (PB._getDeep(window.PB_CONFIG, 'activeEvent.active_event.config_path') || '')
        : '';

      if (!eventFile) throw new Error(t('photo_explorer.print_err_no_event', 'Keine Event-Konfiguration gefunden.'));

      const json = await PB.captureApi.printDefault({
        image_path: imagePath,
        event_file: eventFile,
        copies: 1,
      });

      if (json && json.ok) {
        _showPrintResult($lb, true,
          t('photo_explorer.print_ok_title', 'Druckauftrag gesendet'),
          t('photo_explorer.print_ok_text', 'Das Foto wurde erfolgreich an den Drucker übermittelt.')
        );
      } else {
        throw new Error(json?.message || json?.error || '?');
      }
    } catch (e) {
      _showPrintResult($lb, false,
        t('capture.error.printer.title', 'Druckerfehler'),
        e.message
      );
    } finally {
      $btn.prop('disabled', false);
    }
  }

  // -----------------------------------------------------------------------
  // Öffnen / Schließen
  // -----------------------------------------------------------------------
  function _close() {
    if (_$overlay) { _$overlay.remove(); _$overlay = null; }
    _allPhotos = []; _lbPhotos = []; _curFolder = ''; _lbIndex = -1; _basePath = ''; _eventsBase = '';
    $(document).off('keydown.pbPhotoExplorer');
  }

  async function _open() {
    if (_$overlay) _close();
    _injectCss();

    // ActiveEvent-Modal schließen (Foto-Explorer ersetzt dessen Hintergrund)
    const $activeEventModal = $('#modalActiveEvent');
    if ($activeEventModal.length && $activeEventModal.hasClass('show')) {
      if (window.bootstrap && window.bootstrap.Modal) {
        const bsModal = window.bootstrap.Modal.getInstance($activeEventModal[0]);
        if (bsModal) bsModal.hide();
      } else {
        try { $activeEventModal.modal('hide'); } catch (e) { /* ignore */ }
      }
    }

    const $overlay = _buildOverlay();
    const $lb      = _buildLightbox($overlay);
    _$overlay      = $overlay;

    // Schließen
    $overlay.on('click', '.pbe-close-btn, .pbe-lb-close-btn', _close);

    // Aktualisieren
    $overlay.on('click', '.pbe-reload-btn', () => _loadPhotos($overlay));

    // Breadcrumb Navigation
    $overlay.on('click', '.pbe-bc-item', function () {
      _navigateTo($overlay, $(this).data('folder'));
    });

    // "Alle Events" — wechselt base_path auf booth\EVENTS und lädt neu
    $overlay.on('click', '.pbe-bc-all-events', function () {
      _basePath  = _eventsBase;
      _curFolder = '';
      _loadPhotos($overlay);
    });

    // Ordner öffnen
    $overlay.on('click', '.pbe-folder', function () {
      _navigateTo($overlay, $(this).data('folder'));
    });

    // Bild öffnen → Lightbox
    $overlay.on('click', '.pbe-thumb', function () {
      _openLightbox($lb, parseInt($(this).attr('data-file-idx'), 10));
    });

    // Lightbox zurück
    $overlay.on('click', '.pbe-lb-back-btn', () => _closeLightbox($lb));

    // Print-Ergebnis Modal schließen
    $overlay.on('click', '.pbe-print-result-close', () => {
      $lb.find('.pbe-print-result-modal').addClass('d-none');
    });

    // Navigation
    $overlay.on('click', '.pbe-lb-prev', () => _navLightbox($lb, -1));
    $overlay.on('click', '.pbe-lb-next', () => _navLightbox($lb, +1));

    // Drucken
    $overlay.on('click', '.pbe-lb-print-btn', () => {
      if (_lbIndex >= 0 && _lbIndex < _lbPhotos.length) _printPhoto($lb, _lbPhotos[_lbIndex]);
    });

    // Tastatur
    $(document).on('keydown.pbPhotoExplorer', function (e) {
      if (!_$overlay) return;
      const inLb = !$lb.hasClass('d-none');
      if      (e.key === 'Escape'     )           { if (inLb) _closeLightbox($lb); else _close(); }
      else if (e.key === 'ArrowLeft'  && inLb)    { _navLightbox($lb, -1); }
      else if (e.key === 'ArrowRight' && inLb)    { _navLightbox($lb, +1); }
      else if (e.key === 'Backspace'  && !inLb) {
        if (_curFolder) {
          const up = _curFolder.includes('/')
            ? _curFolder.slice(0, _curFolder.lastIndexOf('/'))
            : '';
          _navigateTo($overlay, up);
        } else if (_basePath === _eventsBase) {
          // Auf "Alle Events" Ebene → nichts, das ist die oberste Grenze
        } else if (_curFolder === '' && _basePath !== _eventsBase) {
          // Im Event-Root → hoch zu "Alle Events"
          _basePath  = _eventsBase;
          _curFolder = '';
          _loadPhotos($overlay);
        }
      }
    });

    await _loadPhotos($overlay);
  }

  // -----------------------------------------------------------------------
  // Public API
  // -----------------------------------------------------------------------
  PB.photoExplorer = {
    open:   _open,
    close:  _close,
    isOpen: () => !!_$overlay,
  };

})(jQuery);
