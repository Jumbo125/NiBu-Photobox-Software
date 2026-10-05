<?php
/* SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann */
?>

<main id="appMain" class="pb-main flex-fill d-flex align-items-center justify-content-center p-3">

  <div id="bgStaticImg"></div>

  <div id="bgVideo" class="pb-bg pb-bg-video">
    <div id="previewMediaWrap" class="pb-preview-media d-none">
      <button
        id="btnLiveviewToggle"
        type="button"
        class="btn btn-sm btn-outline-info d-none"
        aria-pressed="false"
        title="<?= t('screen.main.liveview_toggle.title', 'Toggle LiveView') ?>"
        data-lang-key="screen.main.liveview_toggle.title"
      >
        <i class="bi bi-camera-video"></i>
      </button>

      <iframe
        id="liveFrame"
        class="d-none"
        title="<?= t('screen.main.live_frame.title', 'Camera stream') ?>"
        data-lang-key="screen.main.live_frame.title"
      ></iframe>
    </div>

    <div id="bgVideoHint" class="pb-video-hint d-none"></div>
  </div>

  <div id="debugCurrentFps">
    <p class="alert alert-warning">
      <span data-lang-key="screen.main.debug.current_fps">
        <?= t('screen.main.debug.current_fps', 'Current FPS:') ?>
      </span>
      <span id="current_fps"></span>
    </p>
  </div>

  <div id="previewOverlayWrap" class="pb-preview-overlay">
    <section id="start-area" class="start-area text-center">

      <!-- Template-Auswahl: liegt INNERHALB von start-area als oberste Ebene.
           Wird start-area durch den (unveränderten) Capture-Flow sichtbar
           geschaltet (setStartAreaVisible(true)), erscheint automatisch
           zuerst diese Auswahl, falls mehr als ein Template verfügbar ist.
           Standardmäßig d-none — PB.templateSelector blendet sie nur ein,
           wenn PB_CONFIG.activeEvent.active_event.templateCount > 1 ist.
           Siehe .claude/ACTIVE_TEMPLATE.md für den Gesamtzusammenhang. -->
      <section id="templateSelectArea" class="template-select-area d-none text-center">
        <h2 class="start-title" data-lang-key="screen.template_select.title">
          <?= t('screen.template_select.title', 'Choose your template') ?>
        </h2>
        <p class="start-subtitle" data-lang-key="screen.template_select.subtitle">
          <?= t('screen.template_select.subtitle', 'Tap a template to continue.') ?>
        </p>

        <div id="templateSelectGrid" class="template-select-grid"></div>
      </section>

      <h1 class="start-title" data-lang-key="screen.main_placeholder_title">
        <?= t('screen.main_placeholder_title', 'Touch to start') ?>
      </h1>
      <p class="start-subtitle" data-lang-key="screen.main_placeholder_text">
        <?= t('screen.main_placeholder_text', 'Tap the screen to begin the photo session.') ?>
      </p>
    </section>
  </div>

  <button
    id="btnTogglePreview"
    type="button"
    class="pb-toggle-preview btn btn-lg"
    >
    <i id="mediaIcon" class="bi bi-film">   <span aria-label="<?= t('screen.main.preview_toggle.aria_label', 'Toggle image/stream') ?>"
    data-lang-key="screen.main.preview_toggle.aria_label"
  ></span></i>
  </button>

  <?php include __DIR__ . '/capture_sections.php'; ?>
</main>

<button
  type="button"
  id="btnExitFullscreen"
  class="pb-exit-fullscreen"
>
  <i class="bi bi-lock-fill"></i> <span aria-label="<?= t('screen.main.exit_fullscreen.aria_label', 'Exit fullscreen') ?>"
  data-lang-key="screen.main.exit_fullscreen.aria_label"></span>
</button>

<div
  class="modal fade"
  id="modalCloseBrowser"
  tabindex="-1"
  aria-hidden="true"
  data-bs-backdrop="static"
  data-bs-keyboard="false"
>
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content text-center">
      <div class="modal-body py-4">
        <div class="spinner-border mb-3" role="status"></div>

        <h5 data-lang-key="modal.close_app.title">
          <?= t('modal.close_app.title', 'Closing application') ?>
        </h5>

        <p class="text-muted mb-0" data-lang-key="modal.close_app.wait">
          <?= t('modal.close_app.wait', 'Please wait…') ?>
        </p>
      </div>
    </div>
  </div>
</div>
