// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * config_io.js — Lesen/Schreiben von JSON-Dateien über r_w_config.php
 *
 * Kapselt ausschließlich File-IO (Config/JSON-Dateien) über einen serverseitigen Endpoint,
 * da Browser nicht direkt auf das lokale Dateisystem zugreifen dürfen.
 */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  // Endpoint (lokal in diesem Modul)
  const php_r_w_config =
    (PB.ENDPOINTS && PB.ENDPOINTS.config_rw)
      ? PB.ENDPOINTS.config_rw
      : 'api/r_w_config.php';

  /**
   * Liest eine JSON-Datei über api/r_w_config.php (GET).
   */
  PB.configFileGet = PB.configFileGet || function (fileRel) {
    return $.ajax({
      url: php_r_w_config,
      method: 'GET',
      dataType: 'json',
      cache: false,
      // Cache-Buster, falls Browser/Proxy GET cached
      data: { file: fileRel, _: Date.now() }
    });
  };

  /**
   * Schreibt/Patcht eine JSON-Datei über api/r_w_config.php (POST).
   */
  PB.configFileSet = PB.configFileSet || function (fileRel, patchObj) {
    // Erwartet: r_w_config.php akzeptiert ?file=... und JSON Body als Patch/Replace
    return PB.postJson(
      php_r_w_config + '?file=' + encodeURIComponent(fileRel),
      patchObj
    );
  };

  /**
   * Lädt eine JSON-Datei und schreibt sie nach window.PB_CONFIG.
   */
  PB.loadConfigFileIntoGlobal = PB.loadConfigFileIntoGlobal || function (fileRel) {
    return PB.configFileGet(fileRel).done(function (res) {
      if (res && res.ok) {
        window.PB_CONFIG = res.data || {};
      }
    });
  };

  /**
   * Normalisiert Worker-Args:
   * - entfernt vorhandenes --log aus Args
   * - hängt optional Worker.LogFile als --log=... an
   */
  PB.pbNormalizeWorkerArgs = PB.pbNormalizeWorkerArgs || function (cfg) {
    cfg = cfg || {};
    cfg.Worker = cfg.Worker || {};

    const rawArgs = String(cfg.Worker.Args || '').trim();
    const logFile = String(cfg.Worker.LogFile || '').trim();

    // 1) vorhandenes --log=... aus Args entfernen (damit es nie doppelt wird)
    const cleanedArgs = rawArgs
      .replace(/(^|\s)--log(=|\s+)(?:"[^"]*"|'[^']*'|\S+)/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // 2) optional neu anhängen
    let finalArgs = cleanedArgs;
    if (logFile) {
      const needsQuotes = /[\s"]/g.test(logFile);
      const quoted = needsQuotes ? `"${logFile.replace(/"/g, '\\"')}"` : logFile;
      finalArgs = (finalArgs + ` --log=${quoted}`).trim();
    }

    cfg.Worker.Args = finalArgs;
    return cfg;
  };

  /**
   * Split "--log=..." aus Worker.Args raus und schreibe es nach Worker.LogFile (für UI).
   */
  PB.pbSplitWorkerArgs = PB.pbSplitWorkerArgs || function (cfg) {
    cfg = cfg || {};
    cfg.Worker = (cfg.Worker && typeof cfg.Worker === 'object') ? cfg.Worker : {};
    const w = cfg.Worker;

    const rawArgs = String(w.Args || '').trim();
    const existingLog = String(w.LogFile || '').trim();

    // finde erstes --log=... oder --log "..."
    let foundLog = '';
    const m = rawArgs.match(/(?:^|\s)--log(?:=|\s+)(?:"([^"]*)"|'([^']*)'|(\S+))/);
    if (m) foundLog = String(m[1] || m[2] || m[3] || '').trim();

    // entferne alle --log... Vorkommen aus Args
    const cleaned = rawArgs
      .replace(/(^|\s)--log(?:=|\s+)(?:"[^"]*"|'[^']*'|\S+)/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    w.Args = cleaned;

    // nur setzen, wenn UI LogFile noch leer ist
    if (!existingLog && foundLog) {
      w.LogFile = foundLog;
    }

    return cfg;
  };

})(jQuery);
