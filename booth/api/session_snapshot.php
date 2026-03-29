<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
//
// booth/api/session_snapshot.php
// Writes session.json atomically into a folder (captureFolderHint).
// Expects JSON: { "folder": "D:\\...\\capture", "session": { ... } }

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

function respond(int $httpCode, array $payload): void
{
  http_response_code($httpCode);
  echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

$raw  = file_get_contents('php://input') ?: '';
$data = json_decode($raw, true);

if (!is_array($data) || !isset($data['folder']) || !isset($data['session'])) {
  respond(400, ['ok' => false, 'error' => 'invalid_payload', 'need' => ['folder', 'session']]);
}

$folder  = rtrim((string)$data['folder'], "/\\");
$session = $data['session'];

if ($folder === '') {
  respond(400, ['ok' => false, 'error' => 'folder_empty']);
}

if (!is_array($session)) {
  // session must be an object/array in the incoming payload
  respond(400, ['ok' => false, 'error' => 'invalid_payload', 'need' => ['folder', 'session']]);
}

// Optional: restrict writes to a dedicated root folder.
// $allowedRoot = realpath(__DIR__ . '/../tmp/capture');
// $realFolder  = realpath($folder);
// if ($allowedRoot && $realFolder && strpos($realFolder, $allowedRoot) !== 0) {
//   respond(403, ['ok' => false, 'error' => 'forbidden_folder']);
// }

if (!is_dir($folder)) {
  @mkdir($folder, 0777, true);
}

$file = $folder . DIRECTORY_SEPARATOR . 'session.json';
$tmp  = $file . '.tmp';

// Set updatedAt (server time, UTC ISO 8601)
$session['updatedAt'] = gmdate('c');

$json = json_encode($session, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($json === false) {
  respond(500, ['ok' => false, 'error' => 'json_encode_failed']);
}

if (file_put_contents($tmp, $json) === false) {
  respond(500, ['ok' => false, 'error' => 'write_tmp_failed']);
}

// Atomic-ish replace (Windows: rename over existing may fail -> unlink first)
@unlink($file);
if (!rename($tmp, $file)) {
  respond(500, ['ok' => false, 'error' => 'rename_failed']);
}

respond(200, ['ok' => true, 'file' => $file]);
