<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

// sections/unlock_screen.php
?>
<div class="modal fade"
     id="modalExitFullscreen"
     tabindex="-1"
     aria-labelledby="modalExitFullscreenLabel"
     aria-hidden="true">

  <div class="modal-dialog modal-sm modal-dialog-centered">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <h5 class="modal-title"
            id="modalExitFullscreenLabel"
            data-lang-key="overlay.exit_fullscreen.title">
          <?= t('overlay.exit_fullscreen.title', 'Exit fullscreen') ?>
        </h5>

        <button type="button"
                class="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="<?= t('form.close', 'Close') ?>"></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-2" data-lang-key="overlay.exit_fullscreen.text">
          <?= t('overlay.exit_fullscreen.text', 'Enter admin password to exit kiosk mode.') ?>
        </p>

        <input type="password"
               class="form-control form-control-sm"
               id="exitFullscreenPassword"
               autocomplete="off"
               inputmode="numeric"
               placeholder="<?= t('overlay.exit_fullscreen.placeholder', 'Password') ?>">

        <div class="pb-keypad mt-3" id="exitFullscreenKeypad">
          <div class="row g-2">
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="1">1</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="2">2</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="3">3</button></div>

            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="4">4</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="5">5</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="6">6</button></div>

            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="7">7</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="8">8</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="9">9</button></div>

            <div class="col-4">
              <button type="button" class="btn btn-outline-warning w-100 pb-key" data-keypad-action="clear">
                <span data-lang-key="overlay.exit_fullscreen.keypad.clear">
                  <?= t('overlay.exit_fullscreen.keypad.clear', 'C') ?>
                </span>
              </button>
            </div>

            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="0">0</button></div>

            <div class="col-4">
              <button type="button" class="btn btn-outline-danger w-100 pb-key" data-keypad-action="back">
                <span data-lang-key="overlay.exit_fullscreen.keypad.back">
                  <?= t('overlay.exit_fullscreen.keypad.back', '⌫') ?>
                </span>
              </button>
            </div>
          </div>
        </div>

        <div id="exitFullscreenError"
             class="text-danger small mt-2 d-none"
             data-lang-key="overlay.exit_fullscreen.error">
          <?= t('overlay.exit_fullscreen.error', 'Wrong password.') ?>
        </div>
      </div>

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel"><?= t('form.cancel', 'Cancel') ?></span>
        </button>

        <button type="button" class="btn btn-danger btn-sm" id="btnExitFullscreenConfirm">
          <span data-lang-key="overlay.exit_fullscreen.confirm"><?= t('overlay.exit_fullscreen.confirm', 'Exit') ?></span>
        </button>
      </div>

    </div>
  </div>
</div>
