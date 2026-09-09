<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
?>

<div id="pb-connection-panel" class="pb-connection-panel">
  <div class="pb-connection-row">
    <span class="pb-connection-device" data-lang-key="overlay.connection_info.connected_device">
      <?= t('overlay.connection_info.connected_device', 'Connected Device:') ?>
    </span>
    <span id="pb-connection-device_model"></span>
  <div class="pb-connection-row">
    <span class="pb-connection-label" data-lang-key="externalPc.label">
      <?= t('externalPc.label', 'External PC:') ?>
    </span>

    <span
      id="pb-externalpc-status"
      class="badge bg-secondary"
      data-lang-key="externalPc.badge.unknown"
    >
      <?= t('externalPc.badge.unknown', 'unknown') ?>
    </span>
  </div>

  <div class="pb-connection-row">
    <span class="pb-connection-label" data-lang-key="externalPc.tof.label">
      <?= t('externalPc.tof.label', 'ToF:') ?>
    </span>

    <span
      id="pb-tof-status"
      class="badge bg-secondary"
      data-lang-key="externalPc.tof.disabled"
    >
      <?= t('externalPc.tof.disabled', 'disabled') ?>
    </span>
  </div>

  <div class="pb-connection-row">
    <span class="pb-connection-label" data-lang-key="externalPc.credit.label">
      <?= t('externalPc.credit.label', 'Credit:') ?>
    </span>

    <span
      id="pb-credit-balance"
      class="badge bg-secondary"
      data-lang-key="externalPc.credit.unknown"
    >
      <?= t('externalPc.credit.unknown', '—') ?>
    </span>
  </div>

  <div class="pb-connection-row">
    <span class="pb-connection-label" data-lang-key="overlay.connection_info.bridge_label">
      <?= t('overlay.connection_info.bridge_label', 'CameraBridge:') ?>
    </span>

    <span
      id="pb-bridge-status"
      class="badge bg-secondary"
      data-lang-key="bridge.badge.unknown"
    >
      <?= t('bridge.badge.unknown', 'unknown') ?>
    </span>

    <button
      type="button"
      class="btn btn-sm btn-outline-light pb-bridge-start"
      data-bridge="camera"
      title="<?= t('overlay.connection_info_start_btn', 'Start CameraBridge') ?>"
    >
      <span data-lang-key="overlay.connection_info_start_btn">
        <?= t('overlay.connection_info_start_btn', 'Start CameraBridge') ?>
      </span>
    </button>

    <button
      type="button"
      class="btn btn-sm btn-outline-danger pb-bridge-stop"
      data-bridge="camera"
      title="<?= t('overlay.connection_info_stop_btn', 'Stop CameraBridge') ?>"
    >
      <span data-lang-key="overlay.connection_info_stop_btn">
        <?= t('overlay.connection_info_stop_btn', 'Stop CameraBridge') ?>
      </span>
    </button>
  </div>
</div>
