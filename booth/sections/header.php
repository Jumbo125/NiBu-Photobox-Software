<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->
<!--
layout/header.php
-->

<div id="appHeader">
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark border-bottom border-secondary">
    <div class="container-fluid">
      <span class="navbar-brand mb-0 h1" data-lang-key="app.title">
        Photobooth Control
      </span>

      <!-- ######### Aktive Event ################# -->
      <div id="active_event_header_info">
        <span class="navbar-brand mb-0 h1 active_event_title"></span>

        <span data-lang-key="overlay.active_event.printed.counter">
          Printed Pictures
        </span>

        <span class="navbar-brand mb-0 h1 active_event_counter"></span>
      </div>

    <!-- ######### DNP Drucker  ################# -->
      <div id="printer_paper_remaining">
    

        <span data-lang-key="overlay.printed.paper.remaining">
          Remaining Paper
        </span>

        <span class="navbar-brand mb-0 h1 paper_remaining_value"></span>
        <button
          type="button"
          id="btnDnpPaperRefresh"
          class="btn btn-outline-light btn-sm rounded-circle d-inline-flex align-items-center justify-content-center pb-dnp-refresh"
          title="Refresh printer info"
          aria-label="Refresh printer info"
        >
          <i class="bi bi-arrow-clockwise"></i>
        </button>
      </div>

<!-- ######### Buttons  ################# -->
      <button
  id="btnUiReload"
  class="btn btn-warning btn rounded-circle d-inline-flex align-items-center justify-content-center btnUiReload"
  title="Reload browser"
  data-force="1"
  aria-label="Reload browser"
>
  <i class="bi bi-arrow-clockwise"></i>
</button>

&nbsp;&nbsp;

<button
  type="button"
  class="btn btn-primary btn rounded-circle d-inline-flex align-items-center justify-content-center pb-toggle-kiosk"
  title="Toggle kiosk mode"
  aria-label="Toogle kiosk Mode"
>
  <i class="bi bi-fullscreen"></i>
</button>

&nbsp;&nbsp;

<button
  type="button"
  class="btn btn-danger btn rounded-circle d-inline-flex align-items-center justify-content-center pb-close-browser"
  title="Close browser"
  data-force="1"
  aria-label="Close browser"
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
          title="General Settings"
          aria-label="General Settings"
        >
          <i class="bi bi-gear"></i>
          <span data-lang-key="nav.general_settings">
            General Settings
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          data-bs-toggle="modal"
          data-bs-target="#modalTemplateEditor"
          title="Template Editor"
          aria-label="Template Editor"
        >
          <i class="bi bi-palette"></i>
          <span data-lang-key="nav.template_editor">
            Template Editor
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          data-bs-toggle="modal"
          data-bs-target="#modalActiveEvent"
          title="Active Event"
          aria-label="Active Event"
        >
          <i class="bi bi-easel"></i>
          <span data-lang-key="nav.active_event">
            Active Event
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnCameraSettings"
          data-bs-toggle="modal"
          data-bs-target="#modalCameraSettings"
          title="Camera Settings"
          aria-label="Camera Settings"
        >
          <i class="bi bi-camera"></i>
          <span data-lang-key="nav.camera_settings">
            Camera Settings
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnSelectDevice"
          data-bs-toggle="modal"
          data-bs-target="#modalSelectDevice"
          title="Select Camera"
          aria-label="Select Camera"
        >
          <i class="bi bi-camera-fill"></i>
          <span data-lang-key="nav.select_device">
            Select Camera
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnFullscreen"
          title="Fullscreen"
          aria-label="Fullscreen"
        >
          <i class="bi bi-arrows-fullscreen"></i>
          <span data-lang-key="nav.fullscreen">
            Fullscreen
          </span>
        </button>
      </div>
    </div>
  </nav>
</div>
