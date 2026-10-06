<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');

/**
 * Translation wrapper for API responses.
 * If a global t() exists, it will be used. Otherwise the fallback is returned.
 */
function tr(string $key, string $fallback): string {
  return function_exists('t') ? t($key, $fallback) : $fallback;
}

function json_out(array $arr, int $code = 200): void {
  http_response_code($code);
  echo json_encode($arr, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

function rrmdir_contents(string $dir): void {
  if (!is_dir($dir)) return;
  $items = @scandir($dir);
  if (!$items) return;

  foreach ($items as $item) {
    if ($item === '.' || $item === '..') continue;
    $path = $dir . DIRECTORY_SEPARATOR . $item;

    if (is_dir($path)) {
      rrmdir_contents($path);
      @rmdir($path);
    } else {
      @unlink($path);
    }
  }
}

/**
 * Normalize a zip entry path to a safe relative path (no absolute, no .. traversal).
 * Returns null if the entry is unsafe.
 */
function normalize_zip_entry(string $name): ?string {
  $name = str_replace('\\', '/', $name);
  $name = ltrim($name, '/');

  // Block Windows drive paths or weird schemes
  if (preg_match('~^[A-Za-z]:~', $name)) return null;
  if ($name === '' || $name === '.') return null;

  $parts = explode('/', $name);
  $safe = [];

  foreach ($parts as $p) {
    if ($p === '' || $p === '.') continue;

    if ($p === '..') {
      if (count($safe) === 0) return null;
      array_pop($safe);
      continue;
    }

    // Block control chars
    if (preg_match('~[\x00-\x1F\x7F]~', $p)) return null;

    $safe[] = $p;
  }

  if (count($safe) === 0) return null;
  return implode(DIRECTORY_SEPARATOR, $safe);
}

/**
 * Find template.xml inside $dir, even if nested under a single root folder.
 */
function find_template_xml(string $dir): ?string {
  if (!is_dir($dir)) return null;
  $it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
  );
  foreach ($it as $file) {
    /** @var SplFileInfo $file */
    if (strtolower($file->getFilename()) === 'template.xml') {
      return $file->getPathname();
    }
  }
  return null;
}

/**
 * If target folder contains a single root directory, flatten it:
 * move its contents up into $target and remove that root directory.
 */
function flatten_single_root_folder(string $target): void {
  if (!is_dir($target)) return;

  $items = array_values(array_filter(scandir($target), function($x) {
    return $x !== '.' && $x !== '..';
  }));

  if (count($items) !== 1) return;

  $only = $target . DIRECTORY_SEPARATOR . $items[0];
  if (!is_dir($only)) return;

  $inner = array_values(array_filter(scandir($only), function($x) {
    return $x !== '.' && $x !== '..';
  }));

  foreach ($inner as $x) {
    @rename($only . DIRECTORY_SEPARATOR . $x, $target . DIRECTORY_SEPARATOR . $x);
  }

  rrmdir_contents($only);
  @rmdir($only);
}

/**
 * Normalizes PHP's $_FILES['zip'] into a flat list of single-file arrays,
 * regardless of whether the frontend sent "zip" (single <input>) or
 * "zip[]" (multiple <input multiple>, PHP groups it under the same key
 * with array-valued name/type/tmp_name/error/size).
 */
function normalize_files_array(array $f): array {
  if (!is_array($f['name'] ?? null)) {
    // Single file, already flat.
    return [$f];
  }

  $out = [];
  $count = count($f['name']);
  for ($i = 0; $i < $count; $i++) {
    $out[] = [
      'name'     => $f['name'][$i]     ?? '',
      'type'     => $f['type'][$i]     ?? '',
      'tmp_name' => $f['tmp_name'][$i] ?? '',
      'error'    => $f['error'][$i]    ?? UPLOAD_ERR_NO_FILE,
      'size'     => $f['size'][$i]     ?? 0,
    ];
  }
  return $out;
}

/**
 * Extracts one already-opened+validated ZipArchive into $destSlotDir.
 * Returns [extractedFiles, createdDirs, skipped] on success; throws on hard failure.
 */
function extract_zip_to_slot(ZipArchive $zip, string $destSlotDir): array {
  $createdDirs = 0;
  $extractedFiles = 0;
  $skipped = 0;

  for ($i = 0; $i < $zip->numFiles; $i++) {
    $st = $zip->statIndex($i);
    $entryRaw = (string)($st['name'] ?? '');
    if ($entryRaw === '') { $skipped++; continue; }

    // PHP 7 compatible dir detection (no str_ends_with)
    $isDir = (substr($entryRaw, -1) === '/' || substr($entryRaw, -1) === '\\');

    $entryRel = normalize_zip_entry($entryRaw);
    if ($entryRel === null) { $skipped++; continue; }

    $destPath = $destSlotDir . DIRECTORY_SEPARATOR . $entryRel;

    if ($isDir) {
      if (!is_dir($destPath)) {
        if (@mkdir($destPath, 0777, true) || is_dir($destPath)) {
          $createdDirs++;
        } else {
          $skipped++;
        }
      }
      continue;
    }

    $destDir = dirname($destPath);
    if (!is_dir($destDir)) {
      if (!@mkdir($destDir, 0777, true) && !is_dir($destDir)) {
        $skipped++;
        continue;
      }
    }

    $in = $zip->getStream($entryRaw);
    if (!$in) { $skipped++; continue; }

    $out = @fopen($destPath, 'wb');
    if (!$out) {
      @fclose($in);
      $skipped++;
      continue;
    }

    while (!feof($in)) {
      $buf = fread($in, 1024 * 1024);
      if ($buf === false) break;
      fwrite($out, $buf);
    }

    fclose($out);
    fclose($in);

    $extractedFiles++;
  }

  return [$extractedFiles, $createdDirs, $skipped];
}

/**
 * Writes active_event_config.json: active_event.templateCount = $count.
 * Preserves all other existing keys. Best-effort — upload already succeeded
 * on disk at this point, so a config-write failure is reported but not fatal
 * to the overall response.
 */
function write_template_count(string $boothRoot, int $count): bool {
  $cfgPath = $boothRoot . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'active_event_config.json';

  $data = [];
  if (is_file($cfgPath)) {
    $raw = @file_get_contents($cfgPath);
    if ($raw !== false) {
      $decoded = json_decode($raw, true);
      if (is_array($decoded)) $data = $decoded;
    }
  }

  if (!isset($data['active_event']) || !is_array($data['active_event'])) {
    $data['active_event'] = [];
  }
  $data['active_event']['templateCount'] = $count;

  $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if ($json === false) return false;

  $tmp = $cfgPath . '.tmp';
  if (@file_put_contents($tmp, $json) === false) return false;
  if (!@rename($tmp, $cfgPath)) {
    @unlink($tmp);
    return false;
  }
  return true;
}

try {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.post_required',
      'error' => tr('api.upload.err.post_required', 'POST required'),
    ], 405);
  }

  // Accept both "zip" (legacy single <input>) and "zip[]" (multiple).
  $filesRaw = $_FILES['zip'] ?? null;
  if ($filesRaw === null) {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.no_file_uploaded',
      'error' => tr('api.upload.err.no_file_uploaded', 'No file uploaded (field name must be "zip" or "zip[]")'),
    ], 400);
  }

  $uploads = normalize_files_array($filesRaw);
  // Drop empty slots PHP sometimes includes for "multiple" inputs with
  // nothing selected in a given slot.
  $uploads = array_values(array_filter($uploads, function ($f) {
    return ($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_NO_FILE || !empty($f['name']);
  }));

  if (!count($uploads)) {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.no_file_uploaded',
      'error' => tr('api.upload.err.no_file_uploaded', 'No file uploaded (field name must be "zip" or "zip[]")'),
    ], 400);
  }

  // Validate every file up-front (name, upload status, tmp file) before
  // touching the filesystem at all — all-or-nothing.
  foreach ($uploads as $idx => $f) {
    if (($f['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
      json_out([
        'ok' => false,
        'error_key' => 'api.upload.err.upload_error',
        'error' => tr('api.upload.err.upload_error', 'Upload error') . " (file #" . ($idx + 1) . ")",
        'upload_error' => $f['error'] ?? null,
      ], 400);
    }

    $origName = (string)($f['name'] ?? '');
    if (!preg_match('/\.zip$/i', $origName)) {
      json_out([
        'ok' => false,
        'error_key' => 'api.upload.err.file_must_be_zip',
        'error' => tr('api.upload.err.file_must_be_zip', 'File must be a .zip') . " ('" . $origName . "')",
      ], 400);
    }

    $tmpPath = (string)($f['tmp_name'] ?? '');
    if ($tmpPath === '' || !is_file($tmpPath)) {
      json_out([
        'ok' => false,
        'error_key' => 'api.upload.err.tmp_missing',
        'error' => tr('api.upload.err.tmp_missing', 'Temporary upload file missing'),
      ], 500);
    }
  }

  // booth root is one up from booth/api/
  $boothRoot = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..');
  if ($boothRoot === false) {
    $boothRoot = dirname(__DIR__);
  }

  // Target folder: booth/activeTemplate
  // Structure (always slotted, regardless of upload count):
  //   booth/activeTemplate/1/template.xml, /2/, ...
  // A single ZIP still gets its own numbered slot (1/) instead of being
  // extracted flat — this keeps exactly one on-disk layout for the whole
  // app (list_active_templates.php, capture path resolution, the editor's
  // "Set Active" action) instead of two special-cased layouts.
  $target = $boothRoot . DIRECTORY_SEPARATOR . 'activeTemplate';
  $multiSlot = true;

  if (!is_dir($target)) {
    if (!@mkdir($target, 0777, true) && !is_dir($target)) {
      json_out([
        'ok' => false,
        'error_key' => 'api.upload.err.cannot_create_target',
        'error' => tr('api.upload.err.cannot_create_target', 'Cannot create target folder'),
        'target' => $target,
      ], 500);
    }
  }

  // Open + validate every ZIP (must contain template.xml) before clearing
  // anything on disk — all-or-nothing, no partial/corrupt state possible.
  $zips = [];
  $templateXmlEntriesBySlot = [];

  foreach ($uploads as $idx => $f) {
    $zip = new ZipArchive();
    $openRes = $zip->open((string)$f['tmp_name']);
    if ($openRes !== true) {
      foreach ($zips as $z) { $z->close(); }
      json_out([
        'ok' => false,
        'error_key' => 'api.upload.err.cannot_open_zip',
        'error' => tr('api.upload.err.cannot_open_zip', 'Cannot open ZIP') . " ('" . $f['name'] . "')",
        'code' => $openRes,
      ], 400);
    }

    $hasTemplateXml = false;
    $templateXmlEntries = [];
    for ($i = 0; $i < $zip->numFiles; $i++) {
      $st = $zip->statIndex($i);
      $entry = (string)($st['name'] ?? '');
      if ($entry === '') continue;
      if (preg_match('~(^|/|\\\\)template\.xml$~i', $entry)) {
        $hasTemplateXml = true;
        $templateXmlEntries[] = $entry;
      }
    }

    if (!$hasTemplateXml) {
      $zip->close();
      foreach ($zips as $z) { $z->close(); }
      json_out([
        'ok' => false,
        'error_key' => 'api.upload.err.template_xml_missing',
        'error' => tr('api.upload.err.template_xml_missing', 'ZIP does not contain template.xml') . " ('" . $f['name'] . "')",
      ], 400);
    }

    $zips[] = $zip;
    $templateXmlEntriesBySlot[$idx] = $templateXmlEntries;
  }

  // All ZIPs validated — now safe to clear the whole target folder once.
  rrmdir_contents($target);

  $slots = [];
  $totalExtracted = 0;
  $totalCreatedDirs = 0;
  $totalSkipped = 0;

  foreach ($zips as $idx => $zip) {
    $slotDir = $multiSlot
      ? $target . DIRECTORY_SEPARATOR . (string)($idx + 1)
      : $target;

    if (!is_dir($slotDir)) {
      @mkdir($slotDir, 0777, true);
    }

    [$extractedFiles, $createdDirs, $skipped] = extract_zip_to_slot($zip, $slotDir);
    $zip->close();

    // If this ZIP had a single enclosing root folder, flatten it.
    flatten_single_root_folder($slotDir);

    $templateXmlPath = find_template_xml($slotDir);
    if ($templateXmlPath === null) {
      json_out([
        'ok' => false,
        'error_key' => 'api.upload.err.template_xml_not_found_after_extract',
        'error' => tr('api.upload.err.template_xml_not_found_after_extract', 'template.xml not found after extraction') . " (slot " . ($idx + 1) . ")",
      ], 400);
    }

    $slots[] = [
      'slot' => $idx + 1,
      'name' => $uploads[$idx]['name'],
      'target' => $slotDir,
      'templateXmlPath' => $templateXmlPath,
      'templateXmlEntries' => $templateXmlEntriesBySlot[$idx],
      'extractedFiles' => $extractedFiles,
      'createdDirs' => $createdDirs,
      'skippedEntries' => $skipped,
    ];

    $totalExtracted += $extractedFiles;
    $totalCreatedDirs += $createdDirs;
    $totalSkipped += $skipped;
  }

  $templateCount = count($slots);
  $configWritten = write_template_count($boothRoot, $templateCount);

  json_out([
    'ok' => true,
    'target' => $target,
    'templateCount' => $templateCount,
    'multiSlot' => $multiSlot,
    'slots' => $slots,
    'configWritten' => $configWritten,
    // Backward-compat top-level fields (legacy single-template consumers)
    'templateXmlEntries' => $slots[0]['templateXmlEntries'] ?? [],
    'templateXmlPath' => $slots[0]['templateXmlPath'] ?? null,
    'extractedFiles' => $totalExtracted,
    'createdDirs' => $totalCreatedDirs,
    'skippedEntries' => $totalSkipped,
  ]);
} catch (Throwable $e) {
  json_out([
    'ok' => false,
    'error_key' => 'api.upload.err.unexpected',
    'error' => tr('api.upload.err.unexpected', 'Unexpected error'),
    'detail' => $e->getMessage(),
  ], 500);
}
