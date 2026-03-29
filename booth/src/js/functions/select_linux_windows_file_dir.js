// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * Zweck: öffnet Ordner wählen oder Datei auswählen Dialog.
 * Muss über Python-Server erfolgen.
 * Bei fehlendem Response startet es den Py-Server neu (über PHP) und versucht 1x erneut.
 *
 * Erwartet:
 *  - cfg.general.python.Path  (Pfad zur portablen python.exe)
 *  - cfg.pythonServer.Python_ServerPort (oder .port) (Port für picker server)
 *
 * PHP Endpoint:
 *  POST /api/start_filepicker.php?exe=<python.exe>&port=<n>
 */
(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  // Übersetzer-Helper (Fallback wenn PB.t fehlt)
  const pbT = (key, fallback) => (PB.t ? PB.t(key, fallback) : fallback);

  const cfg = window.PB_CONFIG || {};

  const python = PB._getDeep(cfg, 'general.python', {}) || {};
  const python_server = PB._getDeep(cfg, 'pythonServer', {}) || {};

  // Pfad zur portablen python.exe (wird an PHP übergeben)
  PB.python_exe_path = String(python.Path || python.path || '').trim();

  // Port für den Python Picker Server
  PB.python_server_port = Number(
    python_server.Python_ServerPort ?? python_server.port ?? 8053
  );

  PB._pythonInitPromise = null;
  const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

  function fetchWithTimeout(url, opts = {}, timeoutMs = 1500) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(t));
  }

  PB.python_server_ping = async function () {
    try {
      const r = await fetchWithTimeout(
        `http://127.0.0.1:${PB.python_server_port}/ping`,
        { cache: 'no-store' },
        1200
      );
      return r.ok;
    } catch (_) {
      return false;
    }
  };

  PB.python_server_wait_ready = async function (maxTries = 30, delayMs = 200) {
    for (let i = 0; i < maxTries; i++) {
      if (await PB.python_server_ping()) return true;
      await sleep(delayMs);
    }
    return false;
  };

  PB.python_server_start_via_php = async function () {
    if (!PB.python_exe_path) {
      throw new Error(
        pbT(
          'overlay.picker.err.no_python_path',
          'Python path missing (cfg.general.python.Path).'
        )
      );
    }

    const url =
      `/api/start_filepicker.php?` +
      `exe=${encodeURIComponent(PB.python_exe_path)}` +
      `&port=${encodeURIComponent(PB.python_server_port)}`;

    const r = await fetch(url, { method: 'POST', cache: 'no-store' });
    return r.ok;
  };

  PB.python_server_initial = async function () {
    if (PB._pythonInitPromise) return PB._pythonInitPromise;

    PB._pythonInitPromise = (async () => {
      if (await PB.python_server_ping()) return true;

      await PB.python_server_start_via_php();

      const ok = await PB.python_server_wait_ready(40, 150);
      if (!ok) {
        throw new Error(
          pbT('overlay.picker.err.server_unreachable', 'Python picker server is not reachable.')
        );
      }
      return true;
    })();

    try {
      return await PB._pythonInitPromise;
    } finally {
      PB._pythonInitPromise = null;
    }
  };

  PB._python_pick = async function ({ mode, path = '', filter = '', title = '' }) {
    await PB.python_server_initial();

    const qs = new URLSearchParams();
    qs.set('mode', mode);
    if (path) qs.set('path', path);
    if (filter) qs.set('filter', filter);
    if (title) qs.set('title', title);

    const url = `http://127.0.0.1:${PB.python_server_port}/pick?${qs.toString()}`;

    // 1) try
    try {
      const r = await fetch(url, { cache: 'no-store' }); // Dialog kann dauern
      if (!r.ok) {
        throw new Error(pbT('overlay.picker.err.http_failed', 'Picker request failed.'));
      }
      const j = await r.json();
      return j && j.ok ? j.path : null;
    } catch (e) {
      // 2) restart + retry 1x
      await PB.python_server_start_via_php();
      const ok = await PB.python_server_wait_ready(40, 150);
      if (!ok) throw e;

      const r2 = await fetch(url, { cache: 'no-store' });
      if (!r2.ok) {
        throw new Error(
          pbT('overlay.picker.err.http_failed_retry', 'Picker request failed (retry).')
        );
      }
      const j2 = await r2.json();
      return j2 && j2.ok ? j2.path : null;
    }
  };

  PB.pickFolder = async function (defaultDir = '') {
    return PB._python_pick({
      mode: 'folder',
      path: defaultDir,
      title: pbT('form.pick_folder', 'Select folder')
    });
  };

  PB.pickFile = async function (
    filter = pbT('overlay.picker.filter.images_default', 'Images|*.jpg;*.png|All files|*.*'),
    defaultDir = ''
  ) {
    return PB._python_pick({
      mode: 'file',
      path: defaultDir,
      filter,
      title: pbT('form.pick_file', 'Select file')
    });
  };
})(jQuery);
