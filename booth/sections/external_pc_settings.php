<?php
/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */
?>
<div class="modal fade" id="modalExternalPcSettings" tabindex="-1" aria-labelledby="modalExternalPcSettingsLabel" aria-hidden="true" data-pb-parent-modal="#modalSettings">
  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <h5 class="modal-title" id="modalExternalPcSettingsLabel" data-lang-key="overlay.externalPc.title">
          <?= t('overlay.externalPc.title', 'External PC Settings') ?>
        </h5>

        &nbsp;
        <i
          class="bi bi-gear fs-3"
          data-bs-toggle="tooltip"
          data-bs-trigger="hover click"
          data-bs-placement="top"
          title="<?= t('overlay.externalPc.config.tooltip', 'tools/python_portable/server_config.json') ?>"
        ></i>

        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="<?= t('form.close', 'Close') ?>"></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-3" data-lang-key="overlay.externalPc.description">
          <?= t('overlay.externalPc.description', 'Identify the Pi Pico (ToF presence sensor / coin acceptor) serial interface.') ?>
        </p>

        <div id="externalPcSettingsAlert" class="alert alert-secondary small d-none mb-3" role="alert"></div>

        <form id="formExternalPcSettings" class="small" data-json-file="../tools/python_portable/server_config.json">

          <!-- Serial port (auto via "Search"/list_identify, or manual entry via toggle) -->
          <div class="mb-3">
            <label for="externalPcPort" class="form-label" data-lang-key="overlay.externalPc.port.label">
              <?= t('overlay.externalPc.port.label', 'Serial port') ?>
            </label>

            <div class="input-group input-group-sm">
              <input type="text"
                     id="externalPcPort"
                     class="form-control"
                     readonly
                     placeholder="<?= t('overlay.externalPc.port.placeholder', 'e.g. COM5 / /dev/ttyACM0') ?>"
                     data-json-group="external_pc"
                     data-json-parm="serial_port"
                     data-default-value="">

              <button type="button"
                      class="btn btn-outline-secondary"
                      id="btnExternalPcPortManual"
                      data-lang-key="overlay.externalPc.manual_btn"
                      title="<?= t('overlay.externalPc.manual_btn_title', 'Toggle manual entry') ?>"
                      aria-pressed="false">
                <i class="bi bi-pencil"></i>
              </button>

              <button type="button"
                      class="btn btn-outline-warning"
                      id="btnExternalPcIdentify"
                      data-lang-key="overlay.externalPc.identify_btn">
                <?= t('overlay.externalPc.identify_btn', 'Search') ?>
              </button>
            </div>

            <div class="form-text" data-lang-key="overlay.externalPc.port.help">
              <?= t('overlay.externalPc.port.help', 'Scans all serial ports for the Pi Pico and stores the found interface. Use the pencil icon to enter the port manually instead.') ?>
            </div>
          </div>

          <!-- Baudrate (editable, default 115200) -->
          <div class="mb-3">
            <label for="externalPcBaudrate" class="form-label" data-lang-key="overlay.externalPc.baudrate.label">
              <?= t('overlay.externalPc.baudrate.label', 'Baudrate') ?>
            </label>

            <input type="number"
                   id="externalPcBaudrate"
                   class="form-control form-control-sm"
                   min="1"
                   step="1"
                   value="115200"
                   data-json-group="external_pc"
                   data-json-parm="baudrate"
                   data-json-type="int"
                   data-default-value="115200">
          </div>

          <!-- ToF distance threshold (mm), server-side edge detection -->
          <div class="mb-3">
            <label for="externalPcDistanceThreshold" class="form-label" data-lang-key="overlay.externalPc.distanceThreshold.label">
              <?= t('overlay.externalPc.distanceThreshold.label', 'ToF distance threshold (mm)') ?>
            </label>

            <input type="number"
                   id="externalPcDistanceThreshold"
                   class="form-control form-control-sm"
                   min="0"
                   step="10"
                   value="800"
                   data-json-group="external_pc"
                   data-json-parm="distance_threshold_mm"
                   data-json-type="int"
                   data-default-value="800">

            <div class="form-text" data-lang-key="overlay.externalPc.distanceThreshold.help">
              <?= t('overlay.externalPc.distanceThreshold.help', 'A person closer than this distance (in mm) triggers the liveview warmup. Requires Pico firmware sending DISTANCE:<mm> lines.') ?>
            </div>
          </div>

          <!-- ToF distance cooldown (seconds), separate/higher than the plain PRESENCE cooldown -->
          <div class="mb-3">
            <label for="externalPcDistanceCooldown" class="form-label" data-lang-key="overlay.externalPc.distanceCooldown.label">
              <?= t('overlay.externalPc.distanceCooldown.label', 'ToF trigger cooldown (seconds)') ?>
            </label>

            <input type="number"
                   id="externalPcDistanceCooldown"
                   class="form-control form-control-sm"
                   min="0"
                   step="10"
                   value="180"
                   data-json-group="external_pc"
                   data-json-parm="distance_cooldown_sec"
                   data-json-type="int"
                   data-default-value="180">

            <div class="form-text" data-lang-key="overlay.externalPc.distanceCooldown.help">
              <?= t('overlay.externalPc.distanceCooldown.help', 'Minimum time between two liveview triggers from the distance sensor. Higher than the plain presence cooldown, since distance is reported continuously.') ?>
            </div>
          </div>

          <!-- Eigenständiger ToF-Laufzeit-Timer, übersteuert camera.camera_settings.liveview_max_runtime_minutes wenn ToF aktiv -->
          <div class="mb-3">
            <label for="externalPcTofMaxRuntimeMinutes" class="form-label" data-lang-key="overlay.externalPc.tofMaxRuntime.label">
              <?= t('overlay.externalPc.tofMaxRuntime.label', 'ToF liveview max runtime (minutes)') ?>
            </label>

            <div class="input-group input-group-sm">
              <input type="number"
                     id="externalPcTofMaxRuntimeMinutes"
                     class="form-control form-control-sm"
                     min="0"
                     step="1"
                     value="0"
                     placeholder="<?= t('overlay.externalPc.tofMaxRuntime.placeholder', '0 = off') ?>"
                     data-json-group="external_pc"
                     data-json-parm="tof_max_runtime_minutes"
                     data-json-type="int"
                     data-default-value="0">
            </div>

            <div class="form-text" data-lang-key="overlay.externalPc.tofMaxRuntime.help">
              <?= t('overlay.externalPc.tofMaxRuntime.help', 'Overrides camera max runtime while ToF is enabled — regardless of "always active liveview". 0 = use the camera setting instead.') ?>
            </div>
          </div>

          <!-- Print cost, only relevant while coin_enabled -->
          <div class="mb-3">
            <label for="externalPcPrintCostEuro" class="form-label" data-lang-key="overlay.externalPc.printCost.label">
              <?= t('overlay.externalPc.printCost.label', 'Print cost (EUR)') ?>
            </label>

            <div class="input-group input-group-sm">
              <span class="input-group-text">€</span>
              <input type="number"
                     id="externalPcPrintCostEuro"
                     class="form-control form-control-sm"
                     min="0"
                     step="0.10"
                     value="1.50"
                     data-json-group="external_pc"
                     data-json-parm="print_cost_euro"
                     data-json-type="float"
                     data-default-value="1.50">
            </div>

            <div class="form-text" data-lang-key="overlay.externalPc.printCost.help">
              <?= t('overlay.externalPc.printCost.help', 'Amount deducted from the coin balance per print. Only relevant while the coin counter is enabled — supports decimals (e.g. 0.10, 0.20, 0.50).') ?>
            </div>
          </div>

        </form>
      </div>

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel"><?= t('form.cancel', 'Cancel') ?></span>
        </button>

        <button type="button" class="btn btn-primary btn-sm pb-save-config">
          <span data-lang-key="form.save"><?= t('form.save', 'Save') ?></span>
        </button>
      </div>

    </div>
  </div>
</div>
