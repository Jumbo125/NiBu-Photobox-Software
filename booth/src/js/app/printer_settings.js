// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/** printer_Settings.js (nutzt pb_python_server.js)
 *  - erfordert PB.pythonSvc (ensureReady, callWithRestart, fetch)
 *  - nutzt Config: general.printer.printerName
 */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  // i18n Helper: pbT(key, default) bevorzugt, sonst PB.t(key, default), sonst default
  // Zusätzlich: einfache {var}-Interpolation (z.B. {detail})
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

  // Guard: nie doppelt binden
  if (PB._printerSettingsBound) return;
  PB._printerSettingsBound = true;

  // Abhängigkeit: pb_python_server.js
  if (
    !PB.pythonSvc ||
    typeof PB.pythonSvc.callWithRestart !== 'function' ||
    typeof PB.pythonSvc.fetch !== 'function'
  ) {
    console.error(
      '[printer_Settings]',
      tr(
        'overlay.printer_settings.err.pythonSvc_missing',
        'PB.pythonSvc is missing. pb_python_server.js must be loaded before printer_Settings.js.'
      )
    );
    return;
  }

  // =============================================================
  // Printer list
  // =============================================================
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
      const res = await PB.pythonSvc.callWithRestart(() =>
        PB.pythonSvc.fetch('/printers', { timeoutMs: 8000 })
      );

      if (!res?.ok) {
        throw new Error(res?.error || tr('overlay.printer_settings.err.invalid_response', 'Invalid response'));
      }

      const printers = Array.isArray(res.printers) ? res.printers : [];
      const def = String(res.defaultPrinter || '');

      const saved =
        PB._getDeep(window.PB_CONFIG, 'general.printer.printerName', '') ||
        PB._getDeep(window.PB_CONFIG, 'printer.printerName', '');

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
      const body = new URLSearchParams({ printer, kind: 'preferences' }); // preferences|properties|overview

      const res = await PB.pythonSvc.callWithRestart(() =>
        PB.pythonSvc.fetch('/printers/dialog', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          timeoutMs: 8000
        })
      );

      if (!res?.ok) {
        throw new Error(res?.error || tr('general.settings.printer_open_failed', 'Failed to open printer dialog'));
      }

      showToast(tr('general.settings.printer_opened', 'Printer settings opened'), 'success');
    } catch (e) {
      const detail = e?.message || String(e);
      showToast(
        tr('general.settings.printer_open_failed_detail', 'Failed to open printer dialog: {detail}', { detail }),
        'danger'
      );
    } finally {
      $btn.prop('disabled', false).text(oldText);
    }
  });

  // =============================================================
  // SET DEFAULT PRINTER
  // =============================================================
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

      const res = await PB.pythonSvc.callWithRestart(() =>
        PB.pythonSvc.fetch('/printers/default', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
          timeoutMs: 8000
        })
      );

      if (!res?.ok) {
        throw new Error(res?.error || tr('general.settings.set_default_failed', 'Could not set default printer'));
      }

      showToast(tr('general.settings.set_default_ok', 'Set as default printer'), 'success');

      if (typeof PB.reloadPrinterList === 'function') {
        PB.reloadPrinterList();
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
})(jQuery);
