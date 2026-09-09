<?php
// SPDX-License-Identifier: Apache-2.0
// Copyright (c) 2026 Andreas Rottmann
//
// Copies a named template from booth/templates/<name>/ directly into booth/activeTemplate/.
// No ZIP round-trip needed — faster and avoids unnecessary downloads.

require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

function json_out(array $arr, int $code = 200): void {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function sanitizeName(string $s): string {
  $s = strtolower(trim($s));
  $s = preg_replace('/\s+/', '_', $s);
  $s = preg_replace('/[^a-z0-9_-]/', '', $s);
  return $s;
}

function rrmdir_contents(string $dir): void {
  if (!is_dir($dir)) return;
  $items = @scandir($dir);
  if (!$items) return;
  foreach ($items as $item) {
    if ($item === '.' || $item === '..') continue;
    $path = $dir . DIRECTORY_SEPARATOR . $item;
    if (is_dir($path)) { rrmdir_contents($path); @rmdir($path); }
    else @unlink($path);
  }
}

function rcopy(string $src, string $dst): void {
  if (!is_dir($dst)) mkdir($dst, 0777, true);
  $items = @scandir($src);
  if (!$items) return;
  foreach ($items as $item) {
    if ($item === '.' || $item === '..') continue;
    $s = $src . DIRECTORY_SEPARATOR . $item;
    $d = $dst . DIRECTORY_SEPARATOR . $item;
    if (is_dir($s)) rcopy($s, $d);
    else copy($s, $d);
  }
}

try {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out(['ok' => false, 'error' => 'POST required'], 405);
  }

  $raw  = file_get_contents('php://input');
  $data = json_decode($raw, true);
  if (!is_array($data)) json_out(['ok' => false, 'error' => 'Invalid JSON'], 400);

  $name = sanitizeName((string)($data['templateName'] ?? ''));
  if ($name === '') json_out(['ok' => false, 'error' => 'templateName fehlt'], 400);
  if ($name === 'activetemplate') json_out(['ok' => false, 'error' => 'Das aktive Template kann nicht sich selbst überschreiben'], 400);

  $boothRoot = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..') ?: dirname(__DIR__);
  $src       = $boothRoot . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . $name;
  $dst       = $boothRoot . DIRECTORY_SEPARATOR . 'activeTemplate';

  if (!is_dir($src)) json_out(['ok' => false, 'error' => "Template '$name' nicht gefunden"], 404);

  $xmlCheck = $src . DIRECTORY_SEPARATOR . 'template.xml';
  if (!file_exists($xmlCheck)) json_out(['ok' => false, 'error' => "template.xml fehlt in '$name'"], 400);

  rrmdir_contents($dst);
  rcopy($src, $dst);

  json_out(['ok' => true, 'templateName' => $name, 'target' => $dst]);

} catch (Throwable $e) {
  json_out(['ok' => false, 'error' => 'Unexpected error', 'detail' => $e->getMessage()], 500);
}
