<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
//
// Scans booth/activeTemplate/ and reports available template slots.
// - Single-template layout: activeTemplate/template.xml directly  -> 1 slot
// - Multi-template layout:  activeTemplate/1/template.xml, /2/, ... -> N slots
//
// Read-only, live filesystem scan — no persisted list to keep in sync.
// See .claude/ACTIVE_TEMPLATE.md for the overall mechanism.

require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function json_out(array $arr, int $code = 200): void {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

try {
  $boothRoot = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..');
  if ($boothRoot === false) {
    $boothRoot = dirname(__DIR__);
  }

  $base = $boothRoot . DIRECTORY_SEPARATOR . 'activeTemplate';

  if (!is_dir($base)) {
    json_out(['ok' => true, 'multiSlot' => false, 'templates' => []]);
  }

  // Multi-slot layout: numbered subfolders (1, 2, 3, ...) each with their
  // own template.xml.
  $slotDirs = [];
  foreach (scandir($base) as $entry) {
    if ($entry === '.' || $entry === '..') continue;
    $full = $base . DIRECTORY_SEPARATOR . $entry;
    if (is_dir($full) && preg_match('/^[0-9]+$/', $entry)) {
      $slotDirs[(int)$entry] = $full;
    }
  }

  $templates = [];

  if (count($slotDirs)) {
    ksort($slotDirs);
    foreach ($slotDirs as $slot => $dir) {
      $xmlPath = $dir . DIRECTORY_SEPARATOR . 'template.xml';
      if (!is_file($xmlPath)) continue;

      $previewPath = $dir . DIRECTORY_SEPARATOR . 'preview.jpg';
      $templates[] = [
        'slot' => $slot,
        'label' => (string)$slot,
        'hasPreview' => is_file($previewPath),
        'previewUrl' => is_file($previewPath)
          ? 'activeTemplate/' . $slot . '/preview.jpg?_=' . filemtime($previewPath)
          : null,
      ];
    }

    json_out([
      'ok' => true,
      'multiSlot' => true,
      'templateCount' => count($templates),
      'templates' => $templates,
    ]);
  }

  // Single-template legacy layout: template.xml directly under activeTemplate/.
  $xmlPath = $base . DIRECTORY_SEPARATOR . 'template.xml';
  if (is_file($xmlPath)) {
    $previewPath = $base . DIRECTORY_SEPARATOR . 'preview.jpg';
    $templates[] = [
      'slot' => 1,
      'label' => '1',
      'hasPreview' => is_file($previewPath),
      'previewUrl' => is_file($previewPath)
        ? 'activeTemplate/preview.jpg?_=' . filemtime($previewPath)
        : null,
    ];
  }

  json_out([
    'ok' => true,
    'multiSlot' => false,
    'templateCount' => count($templates),
    'templates' => $templates,
  ]);
} catch (Throwable $e) {
  json_out([
    'ok' => false,
    'error' => 'unexpected',
    'detail' => $e->getMessage(),
  ], 500);
}
