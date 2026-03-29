<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
?>

<div id="loadingOverlay" class="loading-overlay" aria-live="polite" aria-busy="true">
  <div class="loading-card">
    <div class="spinner" aria-hidden="true"></div>

    <div class="loading-title">
      <?= t('overlay.preloader_title', 'Loading configuration...') ?>
    </div>
  </div>
</div>
