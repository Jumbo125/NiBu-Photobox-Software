<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
?>

<form id="formCameraBridgeWorkerAppSettings" class="small"
      data-json-file="../tools/camerabridge/Worker/appsettings.json">

  <h5 class="mt-2 mb-2 text-center" data-lang-key="overlay.camerabridge_settings.capture.section">
    <?= t('overlay.camerabridge_settings.capture.section', 'Capture settings') ?>
  </h5>
  &nbsp;

  <!-- Settings file path tooltip -->
  <i class="bi bi-gear fs-3"
     data-bs-toggle="tooltip"
     data-bs-placement="top"
     data-bs-trigger="hover click"
     title="../tools/camerabridge/Worker/appsettings.json"></i>

  <h6 class="mt-3 mb-2" data-lang-key="overlay.camerabridge_settings.liveview.section">
    <?= t('overlay.camerabridge_settings.liveview.section', 'Live View') ?>
  </h6>

  <div class="mb-3">
    <label for="pbBridgeLiveViewFps" class="form-label" data-lang-key="overlay.camerabridge_settings.liveview_fps.label">
      <?= t('overlay.camerabridge_settings.liveview_fps.label', 'Live view FPS') ?>
    </label>

    <input
      type="number"
      inputmode="numeric"
      min="1"
      max="60"
      step="1"
      id="pbBridgeLiveViewFps"
      class="form-control form-control-sm bg-dark text-light border-secondary"
      value="20"
      data-json-parm="liveViewFps"
      data-default-value="20"
    />

    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.liveview_fps.hint">
      <?= t('overlay.camerabridge_settings.liveview_fps.hint', 'Frames per second for MJPEG live view. Lower values reduce CPU/USB load.') ?>
    </div>
  </div>

  <div class="mb-3">
    <label for="pbBridgeKeepAliveSeconds" class="form-label" data-lang-key="overlay.camerabridge_settings.keepalive_seconds.label">
      <?= t('overlay.camerabridge_settings.keepalive_seconds.label', 'Keep-alive seconds') ?>
    </label>

    <input
      type="number"
      inputmode="numeric"
      min="5"
      max="600"
      step="1"
      id="pbBridgeKeepAliveSeconds"
      class="form-control form-control-sm bg-dark text-light border-secondary"
      value="60"
      data-json-parm="keepAliveSeconds"
      data-default-value="60"
    />

    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.keepalive_seconds.hint">
      <?= t('overlay.camerabridge_settings.keepalive_seconds.hint', 'How long the worker stays active without requests before releasing resources.') ?>
    </div>
  </div>

  <h6 class="mt-3 mb-2" data-lang-key="overlay.camerabridge_settings.devices.section">
    <?= t('overlay.camerabridge_settings.devices.section', 'Device scan') ?>
  </h6>

  <div class="mb-3">
    <div class="form-check">
      <input
        class="form-check-input"
        type="checkbox"
        id="pbBridgeLoadWiaDevices"
        data-json-parm="loadWiaDevices"
        data-default-value="false"
      />
      <label class="form-check-label" for="pbBridgeLoadWiaDevices" data-lang-key="overlay.camerabridge_settings.load_wia_devices.label">
        <?= t('overlay.camerabridge_settings.load_wia_devices.label', 'Load WIA devices (Windows Imaging)') ?>
      </label>
    </div>

    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.load_wia_devices.hint">
      <?= t('overlay.camerabridge_settings.load_wia_devices.hint', 'Enable only if you need WIA device discovery. Leaving it off can speed up startup and reduce conflicts.') ?>
    </div>
  </div>

  <h6 class="mt-3 mb-2" data-lang-key="overlay.camerabridge_settings.storage.section">
    <?= t('overlay.camerabridge_settings.storage.section', 'Storage') ?>
  </h6>

  <div class="mb-3">
    <label for="pbBridgeDefaultCaptureFolder" class="form-label" data-lang-key="overlay.camerabridge_settings.capture_folder.label">
      <?= t('overlay.camerabridge_settings.capture_folder.label', 'Default capture folder') ?>
    </label>

    <div class="input-group input-group-sm">
      <input
        type="text"
        id="pbBridgeDefaultCaptureFolder"
        class="form-control form-control-sm bg-dark text-light border-secondary"
        placeholder="C:/Photobox/captures"
        data-json-parm="defaultCaptureFolder"
        data-default-value="C:/Photobox/captures"
      />

      <button type="button"
              class="btn btn-outline-warning pb-pick-folder"
              data-target="#pbBridgeDefaultCaptureFolder"
              data-title="<?= t('overlay.camerabridge_settings.capture_folder.pick_title', 'Select capture folder') ?>">
        <span data-lang-key="form.pick_folder">
          <?= t('form.pick_folder', 'Pick folder') ?>
        </span>
      </button>
    </div>

    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.capture_folder.hint">
      <?= t('overlay.camerabridge_settings.capture_folder.hint', 'Folder where captured originals are stored by default (must be writable).') ?>
    </div>
  </div>

  <hr class="border-secondary my-3">
  <div class="small text-secondary" data-lang-key="overlay.camerabridge_settings.note">
    <?= t('overlay.camerabridge_settings.note', 'Note: Some changes may require restarting the CameraBridge service to take effect.') ?>
  </div>
</form>
