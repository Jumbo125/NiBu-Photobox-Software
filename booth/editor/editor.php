<?php
// Cache-Buster (Dev): immer frisch
$assetVersion = time();
?><!doctype html>
<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright (c) 2026 Andreas Rottmann -->
<html lang="de">

<?php include __DIR__ . '/includes/head.php'; ?>

<body class="bg-dark text-light">
  <div class="d-flex flex-column vh-100">

    <?php include __DIR__ . '/includes/topbar.php'; ?>

    <?php include __DIR__ . '/includes/inspector.php'; ?>

    <?php include __DIR__ . '/includes/main.php'; ?>

    <?php include __DIR__ . '/includes/toast.php'; ?>

    <?php include __DIR__ . '/includes/modal_startwizard.php'; ?>

  </div>

  <?php include __DIR__ . '/includes/scripts.php'; ?>
</body>
</html>
