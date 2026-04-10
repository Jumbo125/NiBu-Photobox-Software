// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/** printer_Settings.js (nutzt pb_python_server.js)
 *  - erfordert PB.pythonSvc (ensureReady, callWithRestart, fetch) im Echtbetrieb
 *  - nutzt Config: general.printer.printerName
 *  - Debug-Modus: const printer_debug = true; simuliert alle Printer-Requests
 */
(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  // =============================================================
  // Hardcoded debug switch
  // =============================================================
  const printer_debug = false;
  PB.printer_debug = printer_debug;

  // DevTools-Test:
  // console.log('printer_debug =', PB.printer_debug);

  // =============================================================
  // Helper
  // =============================================================
  const getDeep = (obj, path, fallback) => {
    if (!obj || !path) return fallback;
    const parts = String(path).split('.');
    let cur = obj;

    for (const part of parts) {
      if (cur == null || typeof cur !== 'object' || !(part in cur)) return fallback;
      cur = cur[part];
    }

    return cur == null ? fallback : cur;
  };

  function toBool(v) {
    if (v === true) return true;
    if (v === false) return false;
    return ['1', 'true', 'yes', 'y', 'on'].includes(String(v ?? '').trim().toLowerCase());
  }

  const tr = (key, def, vars) => {
    let s = def;

    if (typeof window.pbT === 'function') s = window.pbT(key, def);
    else if (PB.t) s = PB.t(key, def);

    if (vars && s) {
      s = String(s).replace(/\{(\w+)\}/g, (_, k) =>
        Object.prototype.hasOwnProperty.call(vars, k) ? String(vars[k]) : `{${k}}`
      );
    }

    return s;
  };

  const showToast = (msg, type) => {
    if (typeof window.showMsg === 'function') return window.showMsg(msg, type);
    if (PB.showMsg) return PB.showMsg(msg, type);
  };

  const hasPythonSvc = !!(
    PB.pythonSvc &&
    typeof PB.pythonSvc.callWithRestart === 'function' &&
    typeof PB.pythonSvc.fetch === 'function'
  );

  // Guard: nie doppelt binden
  if (PB._printerSettingsBound) return;
  PB._printerSettingsBound = true;

  // Im Echtbetrieb ist pb_python_server.js Pflicht, im Debug-Modus nicht.
  if (!hasPythonSvc && !printer_debug) {
    console.error(
      '[printer_Settings]',
      tr(
        'overlay.printer_settings.err.pythonSvc_missing',
        'PB.pythonSvc is missing. pb_python_server.js must be loaded before printer_Settings.js.'
      )
    );
    return;
  }

  if (!hasPythonSvc && printer_debug) {
    console.warn('[printer_Settings] printer_debug=true -> running with mocked printer responses.');
  }

  // =============================================================
  // Mock state + mock API (only used when printer_debug === true)
  // =============================================================
  // DevTools-Test:
  // console.log(PB._mockPrinterState);
  // PB._mockPrinterState.dnp['Remaining prints'] = 9;
  // PB._mockPrinterState.dnp.status = 'Printing';
  // console.log(PB._mockPrinterState.dnp);
  PB._mockPrinterState = PB._mockPrinterState || {
    printers: ['DNP QW410 (MOCK)', 'DNP DS620A (MOCK)', 'Canon Selphy (MOCK)'],
    defaultPrinter: 'DNP QW410 (MOCK)',
    dnp: {
      message: 'succes',
      Printermodel: 'QW410',
      status: 'Idle',
      'Remaining prints': 15,
      Media: '6x4',
      'Free buffer': 1
    }
  };

  PB._mockPrinterApi = async function (path, options = {}) {
    if (!printer_debug) return null;

    const state = PB._mockPrinterState;
    const body = options?.body;
    const params = body instanceof URLSearchParams
      ? body
      : new URLSearchParams(typeof body === 'string' ? body : '');

    switch (String(path || '')) {
      case '/printers':
        return {
          ok: true,
          printers: Array.isArray(state.printers) ? state.printers.slice() : [],
          defaultPrinter: String(state.defaultPrinter || '')
        };

      case '/printers/dialog':
        return {
          ok: true,
          message: 'Printer dialog opened (mock)',
          printer: String(params.get('printer') || state.defaultPrinter || '')
        };

      case '/printers/default': {
        const nextPrinter = String(params.get('printer') || '').trim();
        if (nextPrinter) {
          state.defaultPrinter = nextPrinter;
          window.PB_CONFIG = window.PB_CONFIG || {};
          window.PB_CONFIG.general = window.PB_CONFIG.general || {};
          window.PB_CONFIG.general.printer = window.PB_CONFIG.general.printer || {};
          window.PB_CONFIG.general.printer.printerName = nextPrinter;
        }
        return {
          ok: true,
          message: 'Default printer set (mock)',
          defaultPrinter: String(state.defaultPrinter || '')
        };
      }

      case '/dnp/info':
        return { ...state.dnp };

      default:
        return {
          ok: false,
          error: 'mock_endpoint_not_found',
          message: `No mock available for ${path}`
        };
    }
  };

  PB._callPrinterApi = async function (path, options = {}) {
    if (printer_debug) {
      return PB._mockPrinterApi(path, options);
    }

    if (!hasPythonSvc) {
      return {
        ok: false,
        error: 'pythonSvc_missing',
        message: tr(
          'overlay.printer_settings.err.pythonSvc_missing',
          'PB.pythonSvc is missing. pb_python_server.js must be loaded before printer_Settings.js.'
        )
      };
    }

    return PB.pythonSvc.callWithRestart(
      () => PB.pythonSvc.fetch(path, options),
      { port: options?.port }
    );
  };

  // =============================================================
  // Printer list
  // =============================================================
  // DevTools-Test:
  // await PB.reloadPrinterList();
  // $('#pbPrinterSelect').val('DNP DS620A (MOCK)');
  // console.log($('#pbPrinterSelect').val());
  PB.reloadPrinterList = async function () {
    const $sel = $('#pbPrinterSelect');
    const $alert = $('#printerSettingsAlert');
    const $btn = $('#btnReloadPrinters');
    const $spinWrap = $('#pbPrintersSpinnerWrap');

    if ($btn.data('labelDefault') == null) $btn.data('labelDefault', $btn.text());
    const btnDefaultLabel = $btn.data('labelDefault');

    const setLoading = (on) => {
      $spinWrap.toggleClass('d-none', !on);

      if (on) {
        $btn.prop('disabled', true).text(tr('overlay.printer_settings.btn.loading', 'Loading…'));

        $sel
          .prop('disabled', true)
          .empty()
          .append(
            $('<option>').text(
              tr('overlay.printer_settings.printer.placeholder', 'Loading printers…')
            )
          );

        $alert.addClass('d-none').removeClass('alert-success alert-danger').text('');
      } else {
        $btn.prop('disabled', false).text(btnDefaultLabel);
        $sel.prop('disabled', false);
      }
    };

    setLoading(true);

    try {
      const res = await PB._callPrinterApi('/printers', { timeoutMs: 8000 });

      if (!res?.ok) {
        throw new Error(
          res?.error || tr('overlay.printer_settings.err.invalid_response', 'Invalid response')
        );
      }

      const printers = Array.isArray(res.printers) ? res.printers : [];
      const def = String(res.defaultPrinter || '');

      const saved =
        getDeep(window.PB_CONFIG, 'general.printer.printerName', '') ||
        getDeep(window.PB_CONFIG, 'printer.printerName', '');

      const preferred = saved || def || (printers[0] || '');

      $sel.empty();

      if (!printers.length) {
        $sel.append(
          $('<option>').text(tr('overlay.printer_settings.printer.none', 'No printers found'))
        );
      } else {
        const defSuffix = tr('overlay.printer_settings.printer.default_suffix', ' (Default)');

        printers
          .slice()
          .sort((a, b) => {
            a = String(a);
            b = String(b);
            if (a === def) return -1;
            if (b === def) return 1;
            return a.localeCompare(b);
          })
          .forEach((name) => {
            name = String(name);
            $sel.append(
              $('<option>')
                .val(name)
                .text(name === def ? `${name}${defSuffix}` : name)
                .prop('selected', name === preferred)
            );
          });
      }

      $alert
        .removeClass('d-none alert-danger')
        .addClass('alert-success')
        .text(tr('overlay.printer_settings.msg.list_updated', 'Printer list updated.'));

      $(document).trigger('pb:printersLoaded', [def, printers]);
    } catch (e) {
      $sel
        .empty()
        .append(
          $('<option>').text(tr('overlay.printer_settings.err.load_failed', 'Error loading printers'))
        );

      $alert
        .removeClass('d-none alert-success')
        .addClass('alert-danger')
        .text(tr('common.error_prefix', 'Error: ') + (e?.message || String(e)));
    } finally {
      setLoading(false);
    }
  };

  // Bindings
  $(document).on('click', '#btnReloadPrinters', PB.reloadPrinterList);
  $('#modalPrinterSettings').on('shown.bs.modal', PB.reloadPrinterList);

  // =============================================================
  // OPEN PRINTER SETTINGS (dialog)
  // =============================================================
  // DevTools-Test:
  // await PB._callPrinterApi('/printers/dialog', {
  //   method: 'POST',
  //   body: new URLSearchParams({ printer: 'DNP QW410 (MOCK)', kind: 'preferences' })
  // });
  $(document).on('click', '#btnOpenPrinterSettings', async function () {
    const $btn = $(this);
    const oldText = $btn.text();

    const printer = String($('#pbPrinterSelect').val() || '').trim();
    if (!printer) {
      return showToast(
        tr('general.settings.no_printer_selected', 'No printer selected'),
        'warning'
      );
    }

    $btn.prop('disabled', true).text(tr('common.opening_short', 'Opening…'));

    try {
      const body = new URLSearchParams({ printer, kind: 'preferences' });

      const res = await PB._callPrinterApi('/printers/dialog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        timeoutMs: 8000
      });

      if (!res?.ok) {
        throw new Error(
          res?.error || tr('general.settings.printer_open_failed', 'Failed to open printer dialog')
        );
      }

      showToast(tr('general.settings.printer_opened', 'Printer settings opened'), 'success');
    } catch (e) {
      const detail = e?.message || String(e);
      showToast(
        tr(
          'general.settings.printer_open_failed_detail',
          'Failed to open printer dialog: {detail}',
          { detail }
        ),
        'danger'
      );
    } finally {
      $btn.prop('disabled', false).text(oldText);
    }
  });

  // =============================================================
  // SET DEFAULT PRINTER
  // =============================================================
  // DevTools-Test:
  // await PB._callPrinterApi('/printers/default', {
  //   method: 'POST',
  //   body: new URLSearchParams({ printer: 'DNP DS620A (MOCK)' })
  // });
  // console.log(PB._mockPrinterState.defaultPrinter);
  $(document).on('click', '#btnSetDefaultPrinter', async function () {
    const $btn = $(this);
    const oldText = $btn.text();

    const printer = String($('#pbPrinterSelect').val() || '').trim();
    if (!printer) {
      return showToast(
        tr('general.settings.no_printer_selected', 'No printer selected'),
        'warning'
      );
    }

    $btn
      .prop('disabled', true)
      .text(tr('general.settings.working', 'Please wait…'));

    try {
      const body = new URLSearchParams({ printer });

      const res = await PB._callPrinterApi('/printers/default', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        timeoutMs: 8000
      });

      if (!res?.ok) {
        throw new Error(
          res?.error || tr('general.settings.set_default_failed', 'Could not set default printer')
        );
      }

      showToast(tr('general.settings.set_default_ok', 'Set as default printer'), 'success');

      if (typeof PB.reloadPrinterList === 'function') {
        await PB.reloadPrinterList();
      }
    } catch (e) {
      showToast(
        tr('common.error_prefix', 'Error: ') + (e?.message || String(e)),
        'danger'
      );
    } finally {
      $btn.prop('disabled', false).text(oldText);
    }
  });

  /**
   * Synchronisiert den initialen DNP-Paper-Status.
   * ------------------------------------------------------------
   * Verhalten:
   * - Liest den Feature-Flag `general.printer.dnpPaperStatusQuery`
   * - setzt/entfernt die body-Klasse `dnp`
   * - führt bei aktivem Flag automatisch eine Initialabfrage aus
   * - schreibt die Werte über PB._getDnpPaperState() nach window.PB_CONFIG.general.dnp.*
   * - übernimmt "remainingPrints" direkt ins UI über $('.paper_remaining_value').html(...)
   * - triggert optionale Events für weitere Module/UI
   */
  // DevTools-Test:
  // window.PB_CONFIG = window.PB_CONFIG || {};
  // window.PB_CONFIG.general = window.PB_CONFIG.general || {};
  // window.PB_CONFIG.general.printer = window.PB_CONFIG.general.printer || {};
  // window.PB_CONFIG.general.printer.dnpPaperStatusQuery = true;
  // await PB.syncDnpPaperStatusQuery();
  // console.log(window.PB_CONFIG.general.dnp);
  PB.renderDnpStateFromConfig = function () {
    const dnp = getDeep(window.PB_CONFIG, 'general.dnp', {}) || {};
    const remainingPrints = dnp.remainingPrints;
    const noDnp =
      dnp.noDnp === true ||
      String(dnp.message || '').trim().toLowerCase() === 'kein drucker gefunden';

    const text = noDnp
      ? (typeof window.pbT === 'function'
          ? window.pbT('printer.dnp.paper_remaining.no_dnp', 'No DNP')
          : PB.t
            ? PB.t('printer.dnp.paper_remaining.no_dnp', 'No DNP')
            : 'No DNP')
      : remainingPrints == null
        ? ''
        : tr(
            'printer.dnp.paper_remaining.value',
            '{value}',
            { value: remainingPrints }
          );

    $('span.paper_remaining_value, .paper_remaining_value').text(text);

    return text;
  };

  PB._applyDnpPaperStateToConfig = function (data) {
    const raw = data?.raw ?? data ?? {};
    const info = raw?.info ?? {};
    const detected = raw?.detected ?? {};

    window.PB_CONFIG = window.PB_CONFIG || {};
    window.PB_CONFIG.general = window.PB_CONFIG.general || {};
    window.PB_CONFIG.general.dnp = window.PB_CONFIG.general.dnp || {};

    const message =
      data?.message ??
      raw?.message ??
      '';

    const noDnp = String(message).trim().toLowerCase() === 'kein drucker gefunden';

    Object.assign(window.PB_CONFIG.general.dnp, {
      message,
      noDnp,
      printerModel:
        data?.printerModel ??
        data?.Printermodel ??
        raw?.printerModel ??
        raw?.Printermodel ??
        info?.Printermodel ??
        detected?.Printermodel ??
        '',
      status:
        data?.status ??
        raw?.status ??
        info?.status ??
        '',
      remainingPrints:
        noDnp
          ? null
          : data?.remainingPrints ??
            data?.['Remaining prints'] ??
            raw?.remainingPrints ??
            raw?.['Remaining prints'] ??
            info?.remainingPrints ??
            info?.['Remaining prints'] ??
            null,
      media:
        data?.media ??
        data?.Media ??
        raw?.media ??
        raw?.Media ??
        info?.media ??
        info?.Media ??
        '',
      freeBuffer:
        data?.freeBuffer ??
        data?.['Free buffer'] ??
        raw?.freeBuffer ??
        raw?.['Free buffer'] ??
        info?.freeBuffer ??
        info?.['Free buffer'] ??
        null,
      updatedAt: new Date().toISOString(),
      raw: raw
    });

    return window.PB_CONFIG.general.dnp;
  };

  PB.syncDnpPaperStatusQuery = async function (opts = {}) {
    const enabled = toBool(getDeep(window.PB_CONFIG, 'general.printer.dnpPaperStatusQuery', false));
    const isInitial = opts?.initial === true;

    document.body.classList.toggle('dnp', enabled);

    (PB._dbg || console.log)(
      tr(
        'printer.dnp_paper_status_query.check',
        '[printer] dnpPaperStatusQuery ='
      ),
      enabled
    );

    if (!enabled) {
      return {
        ok: false,
        error: 'dnp_status_query_disabled',
        message: tr(
          'printer.dnp_paper_status_query.disabled',
          'DNP paper status query disabled'
        )
      };
    }

    if (isInitial && PB._dnpPaperStatusInitialDone) {
      return {
        ok: true,
        skipped: true,
        reason: 'initial_already_done',
        dnp: getDeep(window.PB_CONFIG, 'general.dnp', {}) || {}
      };
    }

    if (PB._dnpPaperStatusQueryBusy) {
      return {
        ok: false,
        skipped: true,
        error: 'dnp_status_query_busy',
        message: tr(
          'printer.dnp_paper_status_query.busy',
          'DNP paper status query already running'
        )
      };
    }

    PB._dnpPaperStatusQueryBusy = true;

    try {
      $(document).trigger('pb:printer:dnpPaperStatusQuery', [opts]);

      const res = await PB._getDnpPaperState(opts);

      if (!res?.ok && res?.error === 'timer_too_short') {
        (PB._dbg || console.log)(
          tr(
            'printer.dnp_paper_status_query.deferred',
            '[printer] DNP paper status query skipped: timer too short'
          ),
          res
        );

        $(document).trigger('pb:dnp:stateDeferred', [res]);
        return res;
      }

      if (!res?.ok) {
        throw new Error(
          res?.message ||
          res?.error ||
          tr(
            'printer.dnp_paper_status_query.failed',
            'Failed to load DNP paper status'
          )
        );
      }

      if (isInitial) PB._dnpPaperStatusInitialDone = true;

      if (typeof PB.renderDnpStateFromConfig === 'function') {
        PB.renderDnpStateFromConfig();
      }

      $(document).trigger('pb:dnp:stateLoaded', [res]);
      return res;
    } catch (e) {
      console.warn(
        tr(
          'printer.dnp_paper_status_query.failed',
          '[printer] DNP paper status query failed'
        ),
        e
      );

      $(document).trigger('pb:dnp:stateError', [e]);
      return {
        ok: false,
        error: 'dnp_state_sync_failed',
        message: e?.message || String(e)
      };
    } finally {
      PB._dnpPaperStatusQueryBusy = false;
    }
  };

  /**
   * PB._getDnpPaperState
   * ------------------------------------------------------------
   * Lädt den aktuellen DNP-Status über den Python-Service-Endpunkt:
   *
   *   GET /dnp/info
   *
   * Erwartete Server-Antwort (flach):
   * {
   *   "message": "succes",
   *   "Printermodel": "QW410",
   *   "status": "Idle",
   *   "Remaining prints": 15,
   *   "Media": "6x4",
   *   "Free buffer": 1
   * }
   *
   * Rückgabe:
   * - Erfolg: { ok: true, dnp: window.PB_CONFIG.general.dnp, raw: data }
   * - Fehler: { ok: false, error: '...', message: '...' }
   */
  // DevTools-Test:
  // await PB._getDnpPaperState();
  // console.log(window.PB_CONFIG.general.dnp);
  // console.log($('.paper_remaining_value').html());
  PB._getDnpPaperState = async function (opts = {}) {
    if (printer_debug) {
      const data = await PB._mockPrinterApi('/dnp/info');
      const dnp = PB._applyDnpPaperStateToConfig(data || {});
      return {
        ok: true,
        dnp,
        raw: data || {}
      };
    }

    try {
      const res = await PB._callPrinterApi('/dnp/info', {
        method: 'GET',
        headers: { Accept: 'application/json' },
        timeoutMs: Math.max(1000, Number(opts.timeoutMs || 10000)),
        port: opts.port
      });

      if (!res || res.ok === false) {
        return {
          ok: false,
          error: res?.error || 'dnp_info_failed',
          message: res?.message || 'Failed to load DNP info',
          retry_after_sec: res?.retry_after_sec,
          min_interval_sec: res?.min_interval_sec,
          elapsed_sec: res?.elapsed_sec,
          keepPreviousUi: true,
          raw: res
        };
      }

      const dnp = PB._applyDnpPaperStateToConfig(res);
      return {
        ok: true,
        dnp,
        raw: res
      };
    } catch (e) {
      return {
        ok: false,
        error: 'dnp_info_request_failed',
        message: e?.message || String(e),
        keepPreviousUi: true
      };
    }
  };

})(jQuery);
