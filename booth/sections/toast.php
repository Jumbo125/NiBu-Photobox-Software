<!--
SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
-->

<!-- Toast (unten rechts) -->
<div class="toast-container position-fixed bottom-0 end-0 p-3 pb-toast-z">
  <div
    id="pbConnectionToast"
    class="toast align-items-center text-bg-dark border-0"
    role="alert"
    aria-live="polite"
    aria-atomic="true"
    data-bs-autohide="false"
  >
    <div class="d-flex">
      <div class="toast-body">
        <span id="pbConnectionToastText" data-role="pb-conn-text" data-lang-key="bridge.toast.waiting">
          <?= t('bridge.toast.waiting', 'Waiting for CameraBridge…') ?>
        </span>
      </div>

      <button
        type="button"
        class="btn-close btn-close-white me-2 m-auto"
        data-bs-dismiss="toast"
        data-lang-key="form.close"
        aria-label="<?= t('form.close', 'Close') ?>"
      ></button>
    </div>
  </div>
</div>
