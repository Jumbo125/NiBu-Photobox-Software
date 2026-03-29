<?php
/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 */
?>

<!-- Capture UI Layers -->
<div id="Capture_countdown" class="pb-capture-layer d-none">
  <div class="pb-capture-box">
    <div class="pb-capture-counter" data-role="counter"></div>
    <div class="pb-capture-text" data-role="text"></div>

    <button type="button" class="btn btn-danger btn-lg mt-3" data-role="cancel" data-lang-key="form.cancel">
      <i class="bi bi-x-circle me-1"></i> <?= t('form.cancel', 'Cancel') ?>
    </button>
  </div>
</div>



<!-- Render / Print Working (Backend-Zeit) -->
<div id="Capture_working_render" class="pb-capture-layer d-none">
  <div class="pb-capture-box">
    <div class="spinner-border" role="status" aria-hidden="true"></div>

    <div class="pb-capture-text mt-3" data-role="text" data-lang-key="capture.working.render">
      <?= t('capture.working.render', 'Processing photos…') ?>
    </div>
  </div>
</div>

<!-- Abort / Transition Working -->
<div id="Capture_working_abort" class="pb-capture-layer d-none">
  <div class="pb-capture-box">
    <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>

    <div class="pb-capture-text mt-3" data-lang-key="capture.working.abort">
      <?= t('capture.working.abort', 'Cancelling…') ?>
    </div>
  </div>
</div>

<!-- Error State -->
<div id="Capture_error" class="pb-capture-layer d-none">
  <div class="pb-capture-box">
    <div class="pb-capture-title" data-lang-key="capture.error.title">
      <?= t('capture.error.title', 'Error') ?>
    </div>

    <div class="pb-capture-text mt-2" data-role="text"></div>

    <button type="button" class="btn btn-light btn-lg mt-3" data-role="close" data-lang-key="common.ok">
      <?= t('common.ok', 'OK') ?>
    </button>
  </div>
</div>

<!-- Finish State -->
<div id="Capture_finish" class="pb-capture-layer d-none">
  <div class="pb-capture-box">
    <div class="pb-capture-title" data-lang-key="capture.finish.title">
      <?= t('capture.finish.title', 'Done') ?>
    </div>
    <div class="pb-capture-text mt-2" data-role="text"></div>
  </div>
</div>

<!-- Finish State + Img -->
<div id="Capture_finish_with_img" class="pb-capture-layer d-none">
  <div class="pb-finish-img-box">
    <div class="pb-finish-img-left">
      <img data-role="image" class="pb-finish-img d-none" alt="<?= t('capture.preview.alt', 'Preview') ?>" />
    </div>

    <div class="pb-finish-img-right">
      <div class="pb-capture-title" data-lang-key="capture.finish.title">
        <?= t('capture.finish.title', 'Done') ?>
      </div>
      <div class="pb-capture-text mt-2" data-role="text"></div>

      <div class="mt-3">
        <button type="button" class="btn btn-primary btn-lg" data-role="close" data-lang-key="form.close">
          <?= t('form.close', 'Close') ?>
        </button>
      </div>
    </div>
  </div>
</div>

<!-- Preview Between Shots -->
<div id="Capture_preview_between_shots" class="pb-capture-layer d-none">
  <div class="pb-shot-preview-box">
    <div class="pb-shot-preview-frame">
      <img
        data-role="image"
        class="pb-shot-preview-img d-none"
        alt="<?= t('capture.preview.alt', 'Preview') ?>"
      />
    </div>
  </div>
</div>

<!-- Capture Working (Minimal / White) -->
 <!-- svg ist nur durch javascript animiert  die funciton PB.shutter.playIn,   el.classList.remove('is-playing'); -->
<div id="Capture_working_capture" class="pb-capture-layer d-none bg-white shutter">
  <div class="d-flex justify-content-center align-items-center working_capture" style="width:100vw; height:100vh;">
    <?php include 'loading_svg.svg'; ?>

    <div class="spinner-border text-dark" role="status">
      <span class="visually-hidden" data-lang-key="common.loading">
        <?= t('common.loading', 'Loading…') ?>
      </span>
    </div>
  </div>
</div>

<!-- Trigger / Still Hold Working -->
<div id="Capture_working_trigger" class="pb-capture-layer d-none shutter">
  <div class="pb-capture-box">
    <div id="Capture_working_trigger_loader_image">
      <img src="./src/img/trigger_wait.svg" alt="trigger_wait" style="height: 40vh; display: block; margin: 0 auto;">
    </div>

    

    <div class="spinner-border" role="status" aria-hidden="true"></div>

    <div class="pb-capture-title mt-3" data-lang-key="capture.working.trigger.title">
      <?= t('capture.working.trigger.title', 'Please hold still') ?>
    </div>
<div class="Capture_working_trigger_loader_image_svg justify-content-center align-items-center ">
      <?php include 'loading_svg.svg'; ?>
    </div>
    <div class="pb-capture-text mt-2" data-role="text" data-lang-key="capture.working.trigger.text">
      <?= t('capture.working.trigger.text', 'The camera is taking the photo… please do not move.') ?>
    </div>
  </div>
</div>