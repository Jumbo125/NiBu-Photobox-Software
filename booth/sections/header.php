<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
//
// layout/header.php
?>

<div id="appHeader">
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark border-bottom border-secondary">
    <div class="container-fluid">
      <span class="navbar-brand mb-0 h1" data-lang-key="app.title">
        <?= t('app.title', 'Photobooth Control') ?>
      </span>

      <div id="active_event_header_info">
        <span class="navbar-brand mb-0 h1 active_event_title"></span>

        <span data-lang-key="overlay.active_event.printed.counter">
          <?= t('overlay.active_event.printed.counter', 'Printed Pictures') ?>
        </span>

        <span class="navbar-brand mb-0 h1 active_event_counter"></span>
      </div>

      <button
        id="btnUiReload"
        class="btn btn-warning btn rounded-circle d-inline-flex align-items-center justify-content-center pb-close-browser"
        title="<?= t('nav.browser_reload', 'Reload browser') ?>"
        data-force="1"
        aria-label="<?= t('nav.browser_reload', 'Reload browser') ?>"
        data-action="closeBrowser"
      >
        <i class="bi bi-arrow-clockwise"></i>
      </button>

      &nbsp;&nbsp;

      <button
        type="button"
        class="btn btn-danger btn rounded-circle d-inline-flex align-items-center justify-content-center pb-close-browser"
        title="<?= t('nav.browser_close', 'Close browser') ?>"
        data-force="1"
        aria-label="<?= t('nav.browser_close', 'Close browser') ?>"
        data-action="closeBrowser"
      >
        <i class="bi bi-x-lg"></i>
      </button>

      &nbsp;&nbsp;

      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          data-bs-toggle="modal"
          data-bs-target="#modalSettings"
        >
          <i class="bi bi-gear"></i>
          <span data-lang-key="nav.general_settings">
            <?= t('nav.general_settings', 'General Settings') ?>
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          data-bs-toggle="modal"
          data-bs-target="#modalTemplateEditor"
        >
          <i class="bi bi-palette"></i>
          <span data-lang-key="nav.template_editor">
            <?= t('nav.template_editor', 'Template Editor') ?>
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          data-bs-toggle="modal"
          data-bs-target="#modalActiveEvent"
        >
          <i class="bi bi-easel"></i>
          <span data-lang-key="nav.active_event">
            <?= t('nav.active_event', 'Active Event') ?>
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnCameraSettings"
          data-bs-toggle="modal"
          data-bs-target="#modalCameraSettings"
        >
          <i class="bi bi-camera"></i>
          <span data-lang-key="nav.camera_settings">
            <?= t('nav.camera_settings', 'Camera Settings') ?>
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnSelectDevice"
          data-bs-toggle="modal"
          data-bs-target="#modalSelectDevice"
        >
          <i class="bi bi-camera-fill"></i>
          <span data-lang-key="nav.select_device">
            <?= t('nav.select_device', 'Select Camera') ?>
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnFullscreen"
        >
          <i class="bi bi-arrows-fullscreen"></i>
          <span data-lang-key="nav.fullscreen">
            <?= t('nav.fullscreen', 'Fullscreen') ?>
          </span>
        </button>
      </div>
    </div>
  </nav>
</div>
