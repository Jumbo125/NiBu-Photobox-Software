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

try {
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.post_required',
      'error' => tr('api.upload.err.post_required', 'POST required'),
    ], 405);
  }

  if (!isset($_FILES['zip'])) {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.no_file_uploaded',
      'error' => tr('api.upload.err.no_file_uploaded', 'No file uploaded (field name must be "zip")'),
    ], 400);
  }

  $f = $_FILES['zip'];

  if (!isset($f['error']) || $f['error'] !== UPLOAD_ERR_OK) {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.upload_error',
      'error' => tr('api.upload.err.upload_error', 'Upload error'),
      'upload_error' => $f['error'] ?? null,
    ], 400);
  }

  $origName = (string)($f['name'] ?? '');
  if (!preg_match('/\.zip$/i', $origName)) {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.file_must_be_zip',
      'error' => tr('api.upload.err.file_must_be_zip', 'File must be a .zip'),
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

  // booth root is one up from booth/api/
  $boothRoot = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..');
  if ($boothRoot === false) {
    $boothRoot = dirname(__DIR__);
  }

  // Target folder: booth/activeTemplate
  $target = $boothRoot . DIRECTORY_SEPARATOR . 'activeTemplate';

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

  $zip = new ZipArchive();
  $openRes = $zip->open($tmpPath);
  if ($openRes !== true) {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.cannot_open_zip',
      'error' => tr('api.upload.err.cannot_open_zip', 'Cannot open ZIP'),
      'code' => $openRes,
    ], 400);
  }

  // Validate: must contain template.xml (also if nested)
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
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.template_xml_missing',
      'error' => tr('api.upload.err.template_xml_missing', 'ZIP does not contain template.xml'),
    ], 400);
  }

  // Clear target folder contents (only after validation)
  rrmdir_contents($target);

  // Extract safely (no Zip Slip), preserve structure
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

    $destPath = $target . DIRECTORY_SEPARATOR . $entryRel;

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

    // Stream copy (avoids loading whole file into memory)
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

  $zip->close();

  // If ZIP had a single root folder, flatten it for consistent structure
  flatten_single_root_folder($target);

  // After extraction: ensure template.xml really exists in target
  $templateXmlPath = find_template_xml($target);
  if ($templateXmlPath === null) {
    json_out([
      'ok' => false,
      'error_key' => 'api.upload.err.template_xml_not_found_after_extract',
      'error' => tr('api.upload.err.template_xml_not_found_after_extract', 'template.xml not found after extraction'),
    ], 400);
  }

  json_out([
    'ok' => true,
    'target' => $target,
    'templateXmlEntries' => $templateXmlEntries,
    'templateXmlPath' => $templateXmlPath,
    'createdDirs' => $createdDirs,
    'extractedFiles' => $extractedFiles,
    'skippedEntries' => $skipped
  ]);
} catch (Throwable $e) {
  json_out([
    'ok' => false,
    'error_key' => 'api.upload.err.unexpected',
    'error' => tr('api.upload.err.unexpected', 'Unexpected error'),
    'detail' => $e->getMessage(),
  ], 500);
}
