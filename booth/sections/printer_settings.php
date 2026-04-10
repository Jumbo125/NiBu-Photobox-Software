<?php
/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */
?>
<div class="modal fade" id="modalPrinterSettings" tabindex="-1" aria-labelledby="modalPrinterSettingsLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-centered">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <h5 class="modal-title" id="modalPrinterSettingsLabel" data-lang-key="overlay.printer_settings.title">
          <?= t('overlay.printer_settings.title', 'Printer Settings') ?>
        </h5>

        &nbsp;
        <i
          class="bi bi-gear fs-3"
          data-bs-toggle="tooltip"
          data-bs-trigger="hover click"
          data-bs-placement="top"
          title="<?= t('overlay.printer_settings.config.tooltip', 'config/config.json') ?>"
        ></i>

        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="<?= t('form.close', 'Close') ?>"></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-3" data-lang-key="overlay.printer_settings.description">
          <?= t('overlay.printer_settings.description', 'Select a printer, configure copies, and optionally open the Windows printer preferences.') ?>
        </p>

        <div id="printerSettingsAlert" class="alert alert-secondary small d-none mb-3" role="alert"></div>

        <form id="formPrinterSettings" class="small" data-json-file="config/config.json">

          <h6 class="mt-2 mb-2" data-lang-key="overlay.printer_settings.printer.section">
            <?= t('overlay.printer_settings.printer.section', 'Printer') ?>
          </h6>

          <div class="mb-3">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                id="pbDnpPaperStatus"
                data-json-group="printer"
                data-json-parm="dnpPaperStatusQuery"
                data-default-value="false"
              />

              <label
                class="form-check-label"
                for="pbDnpPaperStatus"
                data-lang-key="overlay.printer_settings.dnp_paper_status.label"
              >
                <?= t('overlay.printer_settings.dnp_paper_status.label', 'DNP Drucker vorhanden. Papierstatus abfrage') ?>
              </label>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.printer_settings.dnp_paper_status.hint">
              <?= t('overlay.printer_settings.dnp_paper_status.hint', 'Aktiviert die Papierstatus-Abfrage, wenn ein DNP-Drucker vorhanden ist.') ?>
            </div>
          </div>

          <div class="mb-3">
            <label for="pbPrinterSelect" class="form-label" data-lang-key="overlay.printer_settings.printer.label">
              <?= t('overlay.printer_settings.printer.label', 'Windows printer') ?>
            </label>

            <div class="input-group input-group-sm">
              <select
                id="pbPrinterSelect"
                class="form-select bg-dark text-light border-secondary"
                data-json-group="printer"
                data-json-parm="printerName"
                data-default-value=""
              >
                <option value="" selected>
                  <?= t('overlay.printer_settings.printer.placeholder', 'Loading printers…') ?>
                </option>
              </select>

              <span
                id="pbPrintersSpinnerWrap"
                class="input-group-text bg-dark border-secondary d-none"
                aria-label="<?= t('overlay.printer_settings.printer.placeholder', 'Loading printers…') ?>"
                title="<?= t('overlay.printer_settings.printer.placeholder', 'Loading printers…') ?>"
              >
                <span class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true"></span>
              </span>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.printer_settings.printer.hint">
              <?= t('overlay.printer_settings.printer.hint', 'The list is provided by the local API (PowerShell).') ?>
            </div>
          </div>

          <h6 class="mt-3 mb-2" data-lang-key="overlay.printer_settings.copies.section">
            <?= t('overlay.printer_settings.copies.section', 'Copies') ?>
          </h6>

          <div class="mb-3">
            <label for="pbPrinterCopies" class="form-label" data-lang-key="overlay.printer_settings.copies.label">
              <?= t('overlay.printer_settings.copies.label', 'Number of copies') ?>
            </label>

            <input
              type="number"
              inputmode="numeric"
              min="1"
              max="20"
              step="1"
              id="pbPrinterCopies"
              class="form-control form-control-sm bg-dark text-light border-secondary"
              value="1"
              data-json-group="printer"
              data-json-parm="printerCount"
              data-default-value="1"
            />

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.printer_settings.copies.hint">
              <?= t('overlay.printer_settings.copies.hint', 'This value is saved and used for automatic printing.') ?>
            </div>
          </div>

          <h6 class="mt-3 mb-2" data-lang-key="overlay.printer_settings.actions.section">
            <?= t('overlay.printer_settings.actions.section', 'Actions') ?>
          </h6>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <button type="button" id="btnReloadPrinters" class="btn btn-outline-light btn-sm" data-lang-key="overlay.printer_settings.actions.reload">
              <?= t('overlay.printer_settings.actions.reload', 'Reload list') ?>
            </button>

            <button type="button" id="btnOpenPrinterSettings" class="btn btn-outline-warning btn-sm" data-lang-key="overlay.printer_settings.actions.open_settings">
              <?= t('overlay.printer_settings.actions.open_settings', 'Open printer preferences') ?>
            </button>

            <button type="button" id="btnSetDefaultPrinter" class="btn btn-outline-info btn-sm" data-lang-key="overlay.printer_settings.actions.set_default">
              <?= t('overlay.printer_settings.actions.set_default', 'Set as default printer') ?>
            </button>
          </div>

          <hr class="border-secondary my-3">

          <div class="small text-secondary" data-lang-key="overlay.printer_settings.note">
            <?= t('overlay.printer_settings.note', 'Note: Opening the Windows dialog does not print. It is only for configuring the printer.') ?>
          </div>

        </form>
      </div>

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel"><?= t('form.cancel', 'Cancel') ?></span>
        </button>

        <button type="button" class="btn btn-primary btn-sm pb-save-config" data-json-file="config/print_config.json">
          <span data-lang-key="form.save"><?= t('form.save', 'Save') ?></span>
        </button>
      </div>

    </div>
  </div>
</div>
