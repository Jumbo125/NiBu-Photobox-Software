<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

// sections/general_settings.php
?>

<div class="modal fade"
  id="modalSettings"
  tabindex="-1"
  aria-labelledby="modalSettingsLabel"
  aria-hidden="true">

  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <i class="bi bi-gear fs-3"
          data-bs-toggle="tooltip"
          data-bs-trigger="hover click"
          data-bs-placement="top"
          title="<?= t('overlay.settings.tooltip.config_path', 'config/config.json') ?>"></i>&nbsp;

        <h5 class="modal-title"
          id="modalSettingsLabel"
          data-lang-key="overlay.settings.title">
          <?= t('overlay.settings.title', 'General Settings') ?>
        </h5>

        <button type="button"
          class="btn btn-outline-success"
          data-bs-toggle="modal"
          data-bs-target="#modalPrinterSettings">
          <i class="bi bi-printer"></i>
          <span data-lang-key="overlay.settings.printer">
            <?= t('overlay.settings.printer', 'Open Printer Settings') ?>
          </span>
        </button>

        <i class="bi bi-distribute-horizontal" style="margin-left: 1rem;margin-right: 1rem;"></i>

        <button type="button"
          class="btn btn-outline-warning"
          data-bs-toggle="modal"
          data-bs-target="#modalRenderSettings">
          <i class="bi bi-card-image"></i>
          <span data-lang-key="overlay.settings.render">
            <?= t('overlay.settings.render', '(Advanced) Open Image Render Settings') ?>
          </span>
        </button>

        <i class="bi bi-distribute-horizontal" style="margin-left: 1rem;margin-right: 1rem;"></i>

        <button type="button"
          class="btn btn-outline-warning"
          data-bs-toggle="modal"
          data-bs-target="#modalCameraBridgeSettings">
          <i class="bi bi-plugin"></i>
          <span data-lang-key="overlay.settings.cameraBridgeSetup">
            <?= t('overlay.settings.cameraBridgeSetup', '(Advanced) Open Camera Bridge Setup') ?>
          </span>
        </button>

        <button type="button"
          class="btn-close btn-close-white"
          data-bs-dismiss="modal"
          aria-label="<?= t('form.close', 'Close') ?>"></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-3" data-lang-key="overlay.settings.description">
          <?= t('overlay.settings.description', 'Configure global options of the photobooth.') ?>
        </p>

        <form id="formGeneralSettings" class="small" data-json-file="config/config.json">

          <!-- Betriebssystem -->
          <div class="mb-3">
            <label for="settingOS" class="form-label" data-lang-key="overlay.settings.os.label">
              <?= t('overlay.settings.os.label', 'Operating System') ?>
            </label>

            <div class="input-group input-group-sm">
              <span class="input-group-text">
                <i id="settingOSIcon" class="bi bi-windows" aria-hidden="true"></i>
              </span>

              <select id="settingOS"
                class="form-select form-select-sm"
                data-json-group="system"
                data-json-parm="os"
                data-default-value="windows">
                <option value="windows" data-lang-key="overlay.settings.os.option_windows">
                  <?= t('overlay.settings.os.option_windows', 'Windows') ?>
                </option>
                <option value="linux" data-lang-key="overlay.settings.os.option_linux">
                  <?= t('overlay.settings.os.option_linux', 'Linux') ?>
                </option>
                <option value="mac" data-lang-key="overlay.settings.os.option_mac">
                  <?= t('overlay.settings.os.option_mac', 'macOS') ?>
                </option>
              </select>
            </div>

            <div class="form-text text-secondary" data-lang-key="overlay.settings.os.help">
              <?= t('overlay.settings.os.help', 'This setting will be saved to config JSON.') ?>
            </div>
          </div>

          <!-- Sprache -->
          <div class="mb-3">
            <label for="settingLanguage" class="form-label" data-lang-key="overlay.settings.language.label">
              <?= t('overlay.settings.language.label', 'Language') ?>
            </label>

            <select id="settingLanguage"
              class="form-select form-select-sm"
              data-json-parm="language"
              data-default-value="en">
              <option value="en" data-lang-key="overlay.settings.language.option_en">
                <?= t('overlay.settings.language.option_en', '🇬🇧 English') ?>
              </option>
              <option value="de" data-lang-key="overlay.settings.language.option_de">
                <?= t('overlay.settings.language.option_de', '🇩🇪 Deutsch') ?>
              </option>
            </select>

            <div class="form-text text-secondary" data-lang-key="overlay.settings.language.help">
              <?= t('overlay.settings.language.help', 'This setting will be saved to config JSON.') ?>
            </div>
          </div>

          <hr class="border-secondary">

          <div class="accordion accordion-flush" id="accordionGeneralSettingsForm1">

            <!-- UI / Layout -->
            <div class="accordion-item bg-dark text-light border border-secondary">
              <h2 class="accordion-header" id="accUiHead">
                <button class="accordion-button collapsed bg-dark text-warning"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#accUiBody"
                  aria-expanded="false"
                  aria-controls="accUiBody">
                  <span class="text-uppercase" data-lang-key="overlay.settings.ui.title">
                    <?= t('overlay.settings.ui.title', 'User Interface') ?>
                  </span>
                </button>
              </h2>

              <div id="accUiBody"
                class="accordion-collapse collapse"
                aria-labelledby="accUiHead"
                data-bs-parent="#accordionGeneralSettingsForm1">
                <div class="accordion-body pt-2 bg-dark text-light">

                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label for="settingBgColor" class="form-label" data-lang-key="overlay.settings.ui.bgcolor.label">
                        <?= t('overlay.settings.ui.bgcolor.label', 'Background Color') ?>
                      </label>
                      <input type="color"
                        id="settingBgColor"
                        class="form-control form-control-color"
                        value="#000000"
                        data-json-group="ui"
                        data-json-parm="main_background_color"
                        data-json-type="color"
                        data-default-value="#000000">
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingTheme" class="form-label" data-lang-key="overlay.settings.ui.theme.label">
                        <?= t('overlay.settings.ui.theme.label', 'Theme Style') ?>
                      </label>
                      <select id="settingTheme"
                        class="form-select form-select-sm"
                        data-json-group="ui"
                        data-json-parm="theme"
                        data-default-value="dark">
                        <option value="dark" selected data-lang-key="overlay.settings.ui.theme.option_dark">
                          <?= t('overlay.settings.ui.theme.option_dark', 'Dark') ?>
                        </option>
                        <option value="light" data-lang-key="overlay.settings.ui.theme.option_light">
                          <?= t('overlay.settings.ui.theme.option_light', 'Light') ?>
                        </option>
                      </select>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label for="bgStaticImgChoose" class="form-label" data-lang-key="overlay.settings.bgStaticImgChoose.label">
                      <?= t('overlay.settings.bgStaticImgChoose.label', 'Background Image') ?>
                    </label>

                    <div class="input-group input-group-sm">
                      <input class="form-control" type="text"
                        id="bgStaticImgChoose"
                        placeholder="<?= t('overlay.settings.bgStaticImgChoose.placeholder', 'uploads/bgImage.jpg') ?>"
                        data-json-group="ui"
                        data-json-parm="bgStaticImg"
                        data-default-value="<?= t('overlay.settings.bgStaticImgChoose.placeholder', 'uploads/bgImage.jpg') ?>">

                      <button class="pb-upload btn btn-outline-warning"
                        data-filter="Images|*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.gif|All|*.*"
                        data-subdir=""
                        data-prefix=""
                        data-overwrite="0"
                        data-target="#bgStaticImgChoose">
                        <span data-lang-key="form.pick_file_upload">
                          <?= t('form.pick_file_upload', 'Pick file to Upload') ?>
                        </span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <!-- Aufnahme / Countdown -->
            <div class="accordion-item bg-dark text-light border border-secondary">
              <h2 class="accordion-header" id="accCaptureHead">
                <button class="accordion-button collapsed bg-dark text-warning"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#accCaptureBody"
                  aria-expanded="false"
                  aria-controls="accCaptureBody">
                  <span class="text-uppercase" data-lang-key="overlay.settings.capture.title">
                    <?= t('overlay.settings.capture.title', 'Capture Settings') ?>
                  </span>
                </button>
              </h2>

              <div id="accCaptureBody"
                class="accordion-collapse collapse"
                aria-labelledby="accCaptureHead"
                data-bs-parent="#accordionGeneralSettingsForm1">
                <div class="accordion-body pt-2 bg-dark text-light">

                  <div class="row">
                    <div class="col-md-12 mb-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox"
                          id="settingPrepareOverlayEnabled"
                          checked
                          data-json-group="capture"
                          data-json-parm="prepare_overlay_enabled"
                          data-default-value="true">
                        <label class="form-check-label"
                          for="settingPrepareOverlayEnabled"
                          data-lang-key="overlay.settings.capture.prepare_overlay_enabled">
                          <?= t('overlay.settings.capture.prepare_overlay_enabled', 'Show prepare screen before countdown') ?>
                        </label>
                      </div>
                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.prepare_overlay_enabled_help">
                        <?= t('overlay.settings.capture.prepare_overlay_enabled_help', 'Shows a friendly prepare screen while the camera preview becomes ready. The countdown still starts as soon as the preview image is available.') ?>
                      </div>
                    </div>

                    <div class="col-md-4 mb-3">
                      <label for="settingCounterFirst" class="form-label" data-lang-key="overlay.settings.capture.counter_first">
                        <?= t('overlay.settings.capture.counter_first', 'Countdown before first photo (s)') ?>
                      </label>
                      <input type="number" min="1" max="20" step="1"
                        id="settingCounterFirst"
                        class="form-control form-control-sm"
                        value="3"
                        data-json-group="capture"
                        data-json-parm="counter_first_image"
                        data-json-type="int"
                        data-default-value="3">
                    </div>

                    <div class="col-md-4 mb-3">
                      <label for="settingCounterBetween" class="form-label" data-lang-key="overlay.settings.capture.counter_between">
                        <?= t('overlay.settings.capture.counter_between', 'Seconds between photos') ?>
                      </label>
                      <input type="number" min="1" max="20" step="1"
                        id="settingCounterBetween"
                        class="form-control form-control-sm"
                        value="5"
                        data-json-group="capture"
                        data-json-parm="counter_between_each_photo"
                        data-json-type="int"
                        data-default-value="5">
                    </div>

                    <div class="col-md-4 mb-3">
                      <label for="settingCounterUntilCapture"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.counter_until_capture">
                        <?= t('overlay.settings.capture.counter_until_capture', 'Seconds until capture') ?>
                      </label>

                      <input type="number"
                        min="1"
                        max="20"
                        step="1"
                        id="settingCounterUntilCapture"
                        class="form-control form-control-sm"
                        value="3"
                        data-json-group="capture"
                        data-json-parm="counter_until_capture"
                        data-json-type="int"
                        data-default-value="3">
                    </div>

                    <div class="col-md-4 mb-3">
                      <label for="settingCounterAfter" class="form-label" data-lang-key="overlay.settings.capture.counter_after">
                        <?= t('overlay.settings.capture.counter_after', 'Delay after series (s)') ?>
                      </label>
                      <input type="number" min="1" max="20" step="1"
                        id="settingCounterAfter"
                        class="form-control form-control-sm"
                        value="5"
                        data-json-group="capture"
                        data-json-parm="counter_after_finish_serie"
                        data-json-type="int"
                        data-default-value="5">
                    </div>
                

                  <div class="col-md-4 mb-3">
                      <label for="settingCounterPreviewImg" class="form-label" data-lang-key="overlay.settings.capture.preview_img_time">
                        <?= t('overlay.settings.capture.preview_img_time', 'Time for Show each finish photo') ?>
                      </label>
                      <input type="number" min="1" max="20" step="1"
                        id="settingCounterPreviewImg"
                        class="form-control form-control-sm"
                        value="1"
                        data-json-group="capture"
                        data-json-parm="preview_img_time"
                        data-json-type="int"
                        data-default-value="1">
                    </div>
                  </div>

                  <!-- Texte während capture -->
                  <div class="row">

                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCaptureStarting"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_starting">
                        <?= t('overlay.settings.capture.text_starting', 'Text: Starting') ?>
                      </label>

                      <input type="text"
                        id="settingTxtCaptureStarting"
                        class="form-control form-control-sm"
                        value="<?= t('capture.defaults.text_starting', 'Starting…') ?>"
                        data-json-group="capture"
                        data-json-parm="text_starting"
                        data-json-type="string"
                        data-default-value="<?= t('capture.defaults.text_starting', 'Starting…') ?>">
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCaptureNextPhoto"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_next_photo">
                        <?= t('overlay.settings.capture.text_next_photo', 'Next photo') ?>
                      </label>

                      <input type="text"
                        id="settingTxtCaptureNextPhoto"
                        class="form-control form-control-sm"
                        value="<?= t('capture.defaults.text_next_photo', 'Next photo…') ?>"
                        data-json-group="capture"
                        data-json-parm="text_next_photo"
                        data-json-type="string"
                        data-default-value="<?= t('capture.defaults.text_next_photo', 'Next photo…') ?>">
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCaptureProcessing"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_processing">
                        <?= t('overlay.settings.capture.text_processing', 'Processing') ?>
                      </label>

                      <input type="text"
                        id="settingTxtCaptureProcessing"
                        class="form-control form-control-sm"
                        value="<?= t('capture.defaults.text_processing', 'Images are being processed…') ?>"
                        data-json-group="capture"
                        data-json-parm="text_processing"
                        data-json-type="string"
                        data-default-value="<?= t('capture.defaults.text_processing', 'Images are being processed…') ?>">
                    </div>

                    <div class="mb-3">
                      <label for="settingTxtCaptureHoldStill"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_hold_still">
                        <?= t('overlay.settings.capture.text_hold_still', 'Hold still (during capture)') ?>
                      </label>

                      <input type="text"
                        id="settingTxtCaptureHoldStill"
                        class="form-control form-control-sm"
                        value="<?= t('capture.defaults.text_hold_still', 'Photo {slot}/{target} – hold still…') ?>"
                        data-json-group="capture"
                        data-json-parm="text_hold_still"
                        data-json-type="string"
                        data-default-value="<?= t('capture.defaults.text_hold_still', 'Photo {slot}/{target} – hold still…') ?>">

                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.text_hold_still_help">
                        <?= t(
                          'overlay.settings.capture.text_hold_still_help',
                          'You can use variables: {slot} (current photo number) and {target} (total photos). Example: "Photo {slot}/{target} – hold still…"'
                        ) ?>
                      </div>
                    </div>

                    <!-- Hold still, trigger -->
                     <div class="mb-3">
  <label for="settingTxtCaptureTriggering"
    class="form-label"
    data-lang-key="overlay.settings.capture.text_triggering">
    <?= t('overlay.settings.capture.text_triggering', 'Trigger text (while camera is taking the photo)') ?>
  </label>

  <textarea
    id="settingTxtCaptureTriggering"
    class="form-control form-control-sm"
    rows="2"
    data-json-group="capture"
    data-json-parm="text_triggering"
    data-json-type="string"
    data-default-value="<?= t('capture.defaults.text_triggering', "The camera is taking the photo…\nplease do not move.") ?>"><?= t('capture.defaults.text_triggering', "The camera is taking the photo…\nplease do not move.") ?></textarea>

  <div class="form-text text-secondary"
    data-lang-key="overlay.settings.capture.text_triggering_help">
    <?= t(
      'overlay.settings.capture.text_triggering_help',
      'Text shown after the countdown while the camera is still taking the photo.'
    ) ?>
  </div>
</div>


<hr/>
                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCapturePrinting"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_printing">
                        <?= t('overlay.settings.capture.text_printing', 'Printing') ?>
                      </label>

                      <input type="text"
                        id="settingTxtCapturePrinting"
                        class="form-control form-control-sm"
                        value="<?= t('capture.defaults.text_printing', 'Picture is printing…') ?>"
                        data-json-group="capture"
                        data-json-parm="text_printing"
                        data-json-type="string"
                        data-default-value="<?= t('capture.defaults.text_printing', 'Picture is printing…') ?>">
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCaptureDone"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_done">
                        <?= t('overlay.settings.capture.text_done', 'Done') ?>
                      </label>

                      <input type="text"
                        id="settingTxtCaptureDone"
                        class="form-control form-control-sm"
                        value="<?= t('capture.defaults.text_done', 'Done!') ?>"
                        data-json-group="capture"
                        data-json-parm="text_done"
                        data-json-type="string"
                        data-default-value="<?= t('capture.defaults.text_done', 'Done!') ?>">
                    </div>

                  </div>
<hr />
                  <!-- Capture: Finish Image Preview -->
                  <div class="row">

                    <div class="col-md-6 mb-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox"
                          id="settingShowFinishImage"
                          checked
                          data-json-group="capture"
                          data-json-parm="show_finish_image"
                          data-default-value="true">
                        <label class="form-check-label"
                          for="settingShowFinishImage"
                          data-lang-key="overlay.settings.capture.show_finish_image">
                          <?= t('overlay.settings.capture.show_finish_image', 'Show final image after capture flow') ?>
                        </label>
                      </div>
                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.show_finish_image_help">
                        <?= t('overlay.settings.capture.show_finish_image_help', 'Display the final image to the user after the capture flow completes.') ?>
                      </div>
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingShowFinishImageSeconds"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.show_finish_image_seconds">
                        <?= t('overlay.settings.capture.show_finish_image_seconds', 'Final image display duration (seconds)') ?>
                      </label>

                      <input type="number"
                        min="1"
                        max="60"
                        step="1"
                        id="settingShowFinishImageSeconds"
                        class="form-control form-control-sm"
                        value="5"
                        data-json-group="capture"
                        data-json-parm="show_finish_image_seconds"
                        data-json-type="int"
                        data-default-value="5">

                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.show_finish_image_seconds_help">
                        <?= t('overlay.settings.capture.show_finish_image_seconds_help', 'How long the final image should stay visible before returning to the start screen. (0 = disabled)') ?>
                      </div>
                    </div>
  <hr/>
                    <!-- Faster Capture effekt -->
                      <div class="col-md-6 mb-3">
                      <label for="settingFastCaptureEffect"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.settingFastCaptureEffect">
                        <?= t('overlay.settings.capture.settingFastCaptureEffect', 'Faster Capture (taking photo) than Countdown (ms)') ?>
                      </label>

                      <input type="number"
                        min="1"
                        max="60"
                        step="1"
                        id="settingFastCaptureEffect"
                        class="form-control form-control-sm"
                        value="500"
                        data-json-group="capture"
                        data-json-parm="setting_fast_capture_effect"
                        data-json-type="int"
                        data-default-value="500">

                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.settingFastCaptureEffect_help">
                        <?= t('overlay.settings.capture.settingFastCaptureEffect_help', 'On some devices, taking a photo takes a long time. Simulate a faster capture process by triggering the capture before the visible countdown has finished. (0 = disabled)') ?>
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <!-- Druck -->
            <div class="accordion-item bg-dark text-light border border-secondary">
              <h2 class="accordion-header" id="accPrintHead">
                <button class="accordion-button collapsed bg-dark text-warning"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#accPrintBody"
                  aria-expanded="false"
                  aria-controls="accPrintBody">
                  <span class="text-uppercase" data-lang-key="overlay.settings.print.title">
                    <?= t('overlay.settings.print.title', 'Printing') ?>
                  </span>
                </button>
              </h2>

              <div id="accPrintBody"
                class="accordion-collapse collapse"
                aria-labelledby="accPrintHead"
                data-bs-parent="#accordionGeneralSettingsForm1">
                <div class="accordion-body pt-2 bg-dark text-light">

                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox"
                      id="settingAutoPrint" checked
                      data-json-group="print"
                      data-json-parm="print_automatically_when_finish"
                      data-default-value="true">
                    <label class="form-check-label" for="settingAutoPrint" data-lang-key="overlay.settings.print.auto">
                      <?= t('overlay.settings.print.auto', 'Print automatically after series') ?>
                    </label>
                  </div>

                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox"
                      id="settingPrintSilent" checked
                      data-json-group="print"
                      data-json-parm="silent"
                      data-default-value="true">
                    <label class="form-check-label" for="settingPrintSilent" data-lang-key="overlay.settings.print.silent">
                      <?= t('overlay.settings.print.silent', 'Silent print (no dialog window)') ?>
                    </label>
                  </div>

                </div>
              </div>
            </div>

            <!-- System -->
            <div class="accordion-item bg-dark text-light border border-secondary">
              <h2 class="accordion-header" id="accSystemHead">
                <button class="accordion-button collapsed bg-dark text-warning"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#accSystemBody"
                  aria-expanded="false"
                  aria-controls="accSystemBody">
                  <span class="text-uppercase" data-lang-key="overlay.settings.system.title">
                    <?= t('overlay.settings.system.title', 'System') ?>
                  </span>
                </button>
              </h2>

<div id="accSystemBody"
  class="accordion-collapse collapse"
  aria-labelledby="accSystemHead"
  data-bs-parent="#accordionGeneralSettingsForm1">
  <div class="accordion-body pt-2 bg-dark text-light">

    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="settingFullscreen" checked
        data-json-group="system"
        data-json-parm="fullscreen"
        data-default-value="true">
      <label class="form-check-label" for="settingFullscreen" data-lang-key="overlay.settings.system.fullscreen">
        <?= t('overlay.settings.system.fullscreen', 'Start in fullscreen / kiosk mode') ?>
      </label>
    </div>

    <div class="mb-2">
      <label for="settingUiBrowserWatchdogInterval"
        class="form-label"
        data-lang-key="overlay.settings.system.ui_browser_watchdog_interval">
        <?= t('overlay.settings.system.ui_browser_watchdog_interval', 'UI browser watchdog check interval (minutes)') ?>
      </label>

      <input type="number"
        min="1"
        max="60"
        step="1"
        id="settingUiBrowserWatchdogInterval"
        class="form-control form-control-sm"
        value="5"
        data-json-group="system"
        data-json-parm="ui_watchdog_minutes"
        data-json-type="int"
        data-default-value="5">
    </div>
<br/>
    <!-- Autostart enable/disable -->
    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="settingAutostartEnabled"
        data-python-toggle="autostart"
        data-enable-endpoint="/autostart/enable"
        data-disable-endpoint="/autostart/disable"
        data-json-group="system" 
        data-json-parm="autostart"
        >
      <label class="form-check-label" for="settingAutostartEnabled"
        data-lang-key="overlay.settings.system.autostart">
        <?= t('overlay.settings.system.autostart', 'Autostart aktivieren/deaktivieren') ?>
      </label>
    </div>

    <div class="form-text mb-3"
      data-lang-key="overlay.settings.system.autostart_help">
      <?= t('overlay.settings.system.autostart_help', 'Startet die Anwendung automatisch nach dem Windows-Start.') ?>
    </div>

    <!-- Task Planer / systemd watchdog enable/disable -->
    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="settingTaskPlanerServiceEnabled"
        data-python-toggle="task_planer_service"
        data-enable-endpoint="/task_planer_service/enable"
        data-disable-endpoint="/task_planer_service/disable"
        data-json-group="system" 
        data-json-parm="task_planer_service">
      <label class="form-check-label" for="settingTaskPlanerServiceEnabled"
        data-lang-key="overlay.settings.system.task_planer_service">
        <?= t('overlay.settings.system.task_planer_service', 'Task-Planer Win / systemd Linux aktivieren/deaktivieren') ?>
      </label>
    </div>

    <div class="form-text mb-3"
      data-lang-key="overlay.settings.system.task_planer_service_help">
      <?= t('overlay.settings.system.task_planer_service_help', 'Aktiviert die Überwachung des gesamten Programms. Dadurch können alle benötigten Programme kontrolliert und bei Bedarf automatisch neu gestartet werden.') ?>
    </div>

    <div class="form-text" data-lang-key="overlay.settings.system.debug_help">
      <?= t('overlay.settings.system.debug_help', 'Enable or disable Debug-Console at the bottom') ?>
    </div>

    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="debugMode" checked
        data-json-group="system"
        data-json-parm="debugMode"
        data-default-value="true">
      <label class="form-check-label" for="debugMode" data-lang-key="overlay.settings.system.debug">
        <?= t('overlay.settings.system.debug', 'Enable/Disable Debug-Mode') ?>
      </label>
    </div>

    <!-- Admin Password -->
    <div class="mb-2">
      <label class="form-label" for="settingPassword" data-lang-key="overlay.settings.system.password">
        <?= t('overlay.settings.system.password', 'Admin password') ?>
      </label>

      <div class="input-group">
        <input class="form-control" type="password"
          id="settingPassword"
          placeholder="••••••••"
          autocomplete="new-password"
          data-json-group="system"
          data-json-parm="password"
          data-default-value="">
        <button class="btn btn-outline-secondary"
          type="button"
          id="btnTogglePassword"
          aria-label="<?= t('overlay.settings.system.password.toggle_aria', 'Show/Hide password') ?>">👁️</button>
      </div>
    </div>

  </div>
</div>
            </div>

          </div><!-- /accordion -->

          <?php
          $boothRoot = realpath(__DIR__ . '/..');

          $activeTemplatePath = rtrim($boothRoot, "\\/") . DIRECTORY_SEPARATOR . 'activeTemplate' . DIRECTORY_SEPARATOR;

          $renderConfigPath = rtrim($boothRoot, "\\/") . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'render_config.json';

          $activeTemplatePathOut = (DIRECTORY_SEPARATOR === '\\')
            ? str_replace('/', '\\', $activeTemplatePath)
            : $activeTemplatePath;

          $renderConfigPathOut = (DIRECTORY_SEPARATOR === '\\')
            ? str_replace('/', '\\', $renderConfigPath)
            : $renderConfigPath;
          ?>

          <div>
            <input type="hidden"
              id="settingActiveTemplate"
              class="form-control form-control-sm"
              value="<?= htmlspecialchars($activeTemplatePathOut, ENT_QUOTES) ?>"
              readonly
              data-json-group="activeTemplate"
              data-json-parm="path"
              data-json-type="string"
              data-default-value="<?= htmlspecialchars($activeTemplatePathOut, ENT_QUOTES) ?>">
          </div>

          <div>
            <input type="hidden"
              id="settingRenderConfig"
              class="form-control form-control-sm"
              value="<?= htmlspecialchars($renderConfigPathOut, ENT_QUOTES) ?>"
              readonly
              data-json-group="python"
              data-json-parm="renderConfig"
              data-json-type="string"
              data-default-value="<?= htmlspecialchars($renderConfigPathOut, ENT_QUOTES) ?>">
          </div>

        </form>

        <hr class="border-secondary">

        <div class="accordion" id="accordionThirdParty">
          <div class="accordion-item bg-dark text-warning border border-secondary">

            <h2 class="accordion-header" id="headingThirdPartyAdvanced">
              <button class="accordion-button collapsed bg-dark text-warning"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseThirdPartyAdvanced"
                aria-expanded="false"
                aria-controls="collapseThirdPartyAdvanced">
                <i class="bi bi-sliders me-2"></i>
                <span data-lang-key="overlay.settings.app.advanced.title">
                  <?= t('overlay.settings.app.advanced.title', 'Advanced setup (Python paths & ports)') ?>
                </span>
              </button>
            </h2>

            <div id="collapseThirdPartyAdvanced"
              class="accordion-collapse collapse"
              aria-labelledby="headingThirdPartyAdvanced"
              data-bs-parent="#accordionThirdParty">

              <div class="accordion-body">
                <?php include "general_settings_third_party.php"; ?>
                <?php include "general_settings_third_party_server.php"; ?>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /.modal-body -->

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel"><?= t('form.cancel', 'Cancel') ?></span>
        </button>

        <button type="button"
          class="btn btn-primary btn-sm pb-save-config"
          id="btnSaveGeneralSettings"
          data-multiple-form="1">
          <span data-lang-key="form.save"><?= t('form.save', 'Save') ?></span>
        </button>
      </div>

    </div>
  </div>
</div>
