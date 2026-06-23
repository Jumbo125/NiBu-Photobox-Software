<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
?>

<div class="modal fade" id="modalCameraBridgeSettings" tabindex="-1" aria-labelledby="modalCameraBridgeSettingsLabel" aria-hidden="true">
  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <h5 class="modal-title" id="modalCameraBridgeSettingsLabel" data-lang-key="overlay.camerabridge_settings.title">
          <?= t('overlay.camerabridge_settings.title', 'CameraBridge Settings') ?>
        </h5>

        <button
          type="button"
          class="btn-close btn-close-white"
          data-bs-dismiss="modal"
          aria-label="<?= t('form.close', 'Close') ?>"
        ></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-3" data-lang-key="overlay.camerabridge_settings.description">
          <?= t('overlay.camerabridge_settings.description', 'Configure API server and worker settings for the CameraBridge service.') ?>
        </p>

        <!-- API Server Config -->
        <?php include 'cameraBrige_API_Server_settings.php'; ?>

        <hr class="border-secondary my-3">

        <!-- Worker App Settings -->
        <?php include 'cameraBrige_Worker_settings.php'; ?>
      </div>

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel"><?= t('form.cancel', 'Cancel') ?></span>
        </button>

        <button type="button" class="btn btn-primary btn-sm pb-save-config" data-multiple-form="1">
          <span data-lang-key="form.save"><?= t('form.save', 'Save') ?></span>
        </button>
      </div>

    </div>
  </div>
</div>
