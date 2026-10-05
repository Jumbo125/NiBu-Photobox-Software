<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* =========================
 * i18n helper (optional)
 * ========================= */
function pb_t(string $key, string $fallback): string {
  if (function_exists('t')) {
    try {
      return (string) t($key, $fallback);
    } catch (Throwable $e) {
      return $fallback;
    }
  }
  return $fallback;
}

// booth/api/r_w_config.php
// GET  => read
// POST => write (MERGE patch into existing)
// Response includes: requested + resolved absolute path

/* =========================
 * Robust JSON helpers
 * ========================= */

function pb_strip_utf8_bom(string $s): string {
  // UTF-8 BOM: EF BB BF
  if (substr($s, 0, 3) === "\xEF\xBB\xBF") return substr($s, 3);
  return $s;
}

function pb_sanitize_string(string $s): string {
  // Entfernt "harte" Control-Chars (behalten: TAB \x09, LF \x0A, CR \x0D)
  // Wichtig: ohne /u, damit auch bei kaputten Bytes nichts explodiert.
  $s2 = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $s);
  return ($s2 === null) ? '' : $s2;
}

function pb_sanitize_value($v) {
  if (is_string($v)) return pb_sanitize_string($v);

  if (is_float($v)) {
    // json_encode kann bei NAN/INF fehlschlagen
    if (is_nan($v) || is_infinite($v)) return null;
    return $v;
  }

  if (is_array($v)) {
    $out = [];
    foreach ($v as $k => $val) {
      // Keys ebenfalls säubern (falls mal Copy/Paste Mist drin ist)
      $kk = is_string($k) ? pb_sanitize_string($k) : $k;
      $out[$kk] = pb_sanitize_value($val);
    }
    return $out;
  }

  return $v;
}

function pb_json_encode_safe($data, bool $pretty = true): string {
  $flags = JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE;
  if ($pretty) $flags |= JSON_PRETTY_PRINT;
  if (defined('JSON_INVALID_UTF8_SUBSTITUTE')) $flags |= JSON_INVALID_UTF8_SUBSTITUTE;

  if (defined('JSON_THROW_ON_ERROR')) {
    return json_encode($data, $flags | JSON_THROW_ON_ERROR);
  }

  $json = json_encode($data, $flags);
  if ($json === false) {
    throw new RuntimeException(
      pb_t('api.rw_config.warn.json_encode_failed_prefix', 'json_encode failed: ') . json_last_error_msg()
    );
  }
  return $json;
}

function pb_json_decode_safe(string $raw, ?string &$err = null): ?array {
  $raw = pb_strip_utf8_bom($raw);

  // 1) normal versuchen
  try {
    if (defined('JSON_THROW_ON_ERROR')) {
      $val = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    } else {
      $val = json_decode($raw, true);
      if (json_last_error() !== JSON_ERROR_NONE) {
        throw new RuntimeException(json_last_error_msg());
      }
    }
    return is_array($val) ? $val : [];
  } catch (Throwable $e) {
    // 2) Recovery: Control-Chars raus, nochmal versuchen
    $recovered = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $raw);
    if ($recovered === null) {
      $err = pb_t(
        'api.rw_config.warn.json_decode_recovery_failed_prefix',
        'json_decode failed (and recovery failed): '
      ) . $e->getMessage();
      return null;
    }

    try {
      if (defined('JSON_THROW_ON_ERROR')) {
        $val2 = json_decode($recovered, true, 512, JSON_THROW_ON_ERROR);
      } else {
        $val2 = json_decode($recovered, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
          throw new RuntimeException(json_last_error_msg());
        }
      }
      $err = pb_t(
        'api.rw_config.info.json_recovered_stripping_control_chars',
        'JSON recovered by stripping control characters'
      );
      return is_array($val2) ? $val2 : [];
    } catch (Throwable $e2) {
      $err = pb_t('api.rw_config.warn.json_decode_failed_prefix', 'json_decode failed: ') . $e2->getMessage();
      return null;
    }
  }
}

function pb_rotate_backups(string $absPath, int $keep = 3): void {
  $bak = $absPath . '.bak';
  for ($i = $keep - 1; $i >= 1; $i--) {
    $src = $bak . '.' . $i;
    $dst = $bak . '.' . ($i + 1);
    if (is_file($src)) @rename($src, $dst);
  }
  if (is_file($bak)) @rename($bak, $bak . '.1');
}

/* =========================
 * Polyfills (für ältere PHP)
 * ========================= */
if (!function_exists('str_contains')) {
  function str_contains(string $haystack, string $needle): bool {
    return $needle === '' || strpos($haystack, $needle) !== false;
  }
}
if (!function_exists('str_starts_with')) {
  function str_starts_with(string $haystack, string $needle): bool {
    return $needle === '' || strncmp($haystack, $needle, strlen($needle)) === 0;
  }
}

/* =========
 * JSON Exit
 * ========= */
function pb_json(array $data, int $status = 200): void {
  if (!headers_sent()) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
  }
  echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

/* ==========
 * Path utils
 * ========== */
function pb_is_windows(): bool { return DIRECTORY_SEPARATOR === '\\'; }

function pb_starts_with_ci(string $haystack, string $needle): bool {
  if ($needle === '') return true;
  if (pb_is_windows()) {
    $haystack = strtolower($haystack);
    $needle   = strtolower($needle);
  }
  return strncmp($haystack, $needle, strlen($needle)) === 0;
}

function pb_ends_with_ci(string $haystack, string $needle): bool {
  if ($needle === '') return true;
  if (pb_is_windows()) {
    $haystack = strtolower($haystack);
    $needle   = strtolower($needle);
  }
  $len = strlen($needle);
  return $len === 0 ? true : substr($haystack, -$len) === $needle;
}

function pb_config_dir(): string {
  // booth/api -> booth/config
  return dirname(__DIR__) . DIRECTORY_SEPARATOR . 'config';
}

function pb_normalize_path(string $path): string {
  $path = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $path);

  $prefix = '';
  if (preg_match('/^[A-Za-z]:\\\\/', $path)) {
    $prefix = substr($path, 0, 3); // "C:\"
    $path = substr($path, 3);
  } elseif (str_starts_with($path, DIRECTORY_SEPARATOR)) {
    $prefix = DIRECTORY_SEPARATOR;
    $path = ltrim($path, DIRECTORY_SEPARATOR);
  }

  $parts = array_values(array_filter(
    explode(DIRECTORY_SEPARATOR, $path),
    fn($p) => $p !== '' && $p !== '.'
  ));

  $stack = [];
  foreach ($parts as $p) {
    if ($p === '..') {
      if (!empty($stack)) array_pop($stack);
      continue;
    }
    $stack[] = $p;
  }

  return $prefix . implode(DIRECTORY_SEPARATOR, $stack);
}

function pb_normalize_relpath(string $rel, bool $allowParent = false): string {
  $rel = str_replace('\\', '/', trim($rel));

  // absolute/drive blocken
  if ($rel === '' || $rel[0] === '/' || preg_match('/^[a-zA-Z]:\//', $rel)) {
    pb_json([
      'ok' => false,
      'error_key' => 'api.rw_config.err.invalid_file_path',
      'error' => pb_t('api.rw_config.err.invalid_file_path', 'Invalid file path'),
    ], 400);
  }

  $parts = array_values(array_filter(explode('/', $rel), 'strlen'));
  $safeParts = [];

  foreach ($parts as $p) {
    if ($p === '.') continue;

    if ($p === '..') {
      if (!$allowParent) {
        array_pop($safeParts);
        continue;
      }
      // allowParent: führende .. behalten
      if (!empty($safeParts) && end($safeParts) !== '..') array_pop($safeParts);
      else $safeParts[] = '..';
      continue;
    }

    // Segment validieren
    if (!preg_match('/^[a-zA-Z0-9._-]+$/', $p)) {
      pb_json([
        'ok' => false,
        'error_key' => 'api.rw_config.err.invalid_path_segment',
        'error' => pb_t('api.rw_config.err.invalid_path_segment', 'Invalid path segment'),
      ], 400);
    }
    $safeParts[] = $p;
  }

  $norm = implode('/', $safeParts);

  if (!pb_ends_with_ci($norm, '.json')) {
    pb_json([
      'ok' => false,
      'error_key' => 'api.rw_config.err.only_json_files_allowed',
      'error' => pb_t('api.rw_config.err.only_json_files_allowed', 'Only .json files allowed'),
    ], 400);
  }

  return $norm;
}

/**
 * Resolve path:
 * - base = booth/config
 * - erlaubt "../" raus, aber nur bis Projekt-Root (eine Ebene über booth)
 * - WICHTIG: Kein automatisches Strippen von "config/" (damit nichts "umzieht").
 *   Stattdessen: wenn rel mit "config/" startet, wählen wir EXISTIERENDEN Kandidaten.
 */
function pb_resolve_config_path(string $rel): string {
  $dir = pb_config_dir();
  if (!is_dir($dir)) @mkdir($dir, 0775, true);

  $base = realpath($dir);
  if ($base === false) {
    pb_json([
      'ok' => false,
      'error_key' => 'api.rw_config.err.config_dir_not_available',
      'error' => pb_t('api.rw_config.err.config_dir_not_available', 'Config directory not available'),
    ], 500);
  }

  $allowOutside = str_contains($rel, '../') || str_contains($rel, '..\\');
  $rel = str_replace('\\', '/', $rel);
  $relNorm = pb_normalize_relpath($rel, $allowOutside);

  // Kandidat A: so wie angefordert (base + relNorm)
  $absA = pb_normalize_path($base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relNorm));

  // Kandidat B: falls rel "config/..." enthält, probieren wir alternativ ohne führendes "config/"
  $absB = null;
  if (str_starts_with($relNorm, 'config/')) {
    $relStripped = substr($relNorm, strlen('config/'));
    $absB = pb_normalize_path($base . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relStripped));
  }

  // Auswahl: existierender Pfad gewinnt (damit nichts "umzieht")
  $abs = $absA;
  if ($absB !== null) {
    if (is_file($absA) || is_dir(dirname($absA))) {
      $abs = $absA;
    } elseif (is_file($absB) || is_dir(dirname($absB))) {
      $abs = $absB;
    } else {
      $abs = $absA;
    }
  }

  // Zielordner anlegen
  $targetDir = dirname($abs);
  if (!is_dir($targetDir)) @mkdir($targetDir, 0775, true);

  $absDir = realpath($targetDir);
  if ($absDir === false) {
    pb_json([
      'ok' => false,
      'error_key' => 'api.rw_config.err.invalid_target_directory',
      'error' => pb_t('api.rw_config.err.invalid_target_directory', 'Invalid target directory'),
    ], 400);
  }

  if (!$allowOutside) {
    if (!pb_starts_with_ci($absDir, $base)) {
      pb_json([
        'ok' => false,
        'error_key' => 'api.rw_config.err.invalid_target_directory',
        'error' => pb_t('api.rw_config.err.invalid_target_directory', 'Invalid target directory'),
      ], 400);
    }
  } else {
    // base=.../booth/config -> booth=dirname(base) -> root=dirname(booth)
    $boothDir = realpath(dirname($base));
    $projectRoot = $boothDir ? realpath(dirname($boothDir)) : false;
    if ($projectRoot === false || !pb_starts_with_ci($absDir, $projectRoot)) {
      pb_json([
        'ok' => false,
        'error_key' => 'api.rw_config.err.invalid_target_directory_outside_project_root',
        'error' => pb_t(
          'api.rw_config.err.invalid_target_directory_outside_project_root',
          'Invalid target directory (outside project root)'
        ),
      ], 403);
    }
  }

  return $abs;
}

/* ==========
 * JSON IO
 * ========== */
function pb_load_json_file(string $absPath, array &$meta = []): array {
  $meta = $meta ?: [];

  if (!is_file($absPath)) return [];

  $raw = @file_get_contents($absPath);
  if ($raw === false) {
    $meta['read_error'] = pb_t('api.rw_config.meta.read_file_get_contents_failed', 'file_get_contents failed');
    return [];
  }

  $rawTrim = trim($raw);
  if ($rawTrim === '') return [];

  $err = null;
  $data = pb_json_decode_safe($raw, $err);

  if ($data === null) {
    // wirklich kaputt => nicht still überschreiben, sondern markieren
    $meta['invalid_json'] = pb_t('api.rw_config.meta.invalid_json', 'Invalid JSON') . ($err ? (': ' . $err) : '');
    return [];
  }

  if ($err) {
    // recovered decode
    $meta['recovered'] = $err;
  }

  return $data;
}

function pb_save_json_file(string $absPath, array $data, array &$meta = []): bool {
  $dir = dirname($absPath);
  if (!is_dir($dir)) {
    if (!@mkdir($dir, 0775, true) && !is_dir($dir)) {
      $meta['mkdir_error'] = pb_t('api.rw_config.meta.mkdir_failed', 'Failed to create directory');
      return false;
    }
  }

  // Lock pro Datei
  $lockFp = @fopen($absPath . '.lock', 'c');
  if (!$lockFp) {
    $meta['lock_error'] = pb_t('api.rw_config.meta.lock_open_failed', 'Failed to open lock file');
    return false;
  }

  try {
    if (!flock($lockFp, LOCK_EX)) {
      $meta['lock_error'] = pb_t('api.rw_config.meta.lock_acquire_failed', 'Failed to acquire lock');
      return false;
    }

    // 1) sanitize (Strings + NAN/INF)
    $dataClean = pb_sanitize_value($data);

    // 2) encode (invalid UTF-8 wird substituiert statt fail)
    try {
      $json = pb_json_encode_safe($dataClean, true);
    } catch (Throwable $e) {
      $meta['encode_error'] = $e->getMessage();
      return false;
    }

    // 3) optionaler Roundtrip (stellt sicher, dass das JSON wirklich parsbar ist)
    $roundErr = null;
    if (pb_json_decode_safe($json, $roundErr) === null) {
      $meta['roundtrip_error'] = pb_t('api.rw_config.meta.roundtrip_decode_failed', 'Roundtrip JSON decode failed')
        . ($roundErr ? (': ' . $roundErr) : '');
      return false;
    }

    // 4) temp file im gleichen dir (wichtig für atomic rename)
    $tmp = @tempnam($dir, 'cfg_');
    if ($tmp === false) {
      $meta['tmp_error'] = pb_t('api.rw_config.meta.tempnam_failed', 'tempnam failed');
      return false;
    }

    $fp = @fopen($tmp, 'wb');
    if (!$fp) {
      @unlink($tmp);
      $meta['tmp_error'] = pb_t('api.rw_config.meta.tmp_fopen_failed', 'Failed to open temp file');
      return false;
    }

    $okWrite = true;
    $payload = $json . "\n";
    $len = strlen($payload);
    $w = @fwrite($fp, $payload);
    if ($w === false || $w < $len) $okWrite = false;

    @fflush($fp);
    @fclose($fp);

    if (!$okWrite) {
      @unlink($tmp);
      $meta['write_error'] = pb_t('api.rw_config.meta.short_write', 'Short write');
      return false;
    }

    // 5) Backup Rotation + atomic swap (Windows-safe)
    pb_rotate_backups($absPath, 4);

    $bak = $absPath . '.bak';
    $old = $absPath . '.old';

    if (is_file($old)) @unlink($old);

    if (is_file($absPath)) {
      if (!@rename($absPath, $old)) {
        @unlink($tmp);
        $meta['swap_error'] = pb_t('api.rw_config.meta.rename_current_failed', 'Failed to rename current file to .old');
        return false;
      }
    }

    if (!@rename($tmp, $absPath)) {
      if (is_file($old) && !is_file($absPath)) {
        @rename($old, $absPath);
      }
      @unlink($tmp);
      $meta['swap_error'] = pb_t('api.rw_config.meta.rename_tmp_failed', 'Failed to rename temp file to target');
      return false;
    }

    if (is_file($old)) {
      @rename($old, $bak);
    }

    $meta['backup'] = $bak;
    return true;

  } finally {
    flock($lockFp, LOCK_UN);
    fclose($lockFp);
  }
}

/* ======================
 * Deep merge (PATCH)
 * ====================== */
function pb_is_assoc_array(array $arr): bool {
  if ($arr === []) return false;
  return array_keys($arr) !== range(0, count($arr) - 1);
}

function pb_deep_merge(array $base, array $patch): array {
  foreach ($patch as $k => $v) {
    if (is_array($v) && isset($base[$k]) && is_array($base[$k]) && pb_is_assoc_array($v) && pb_is_assoc_array($base[$k])) {
      $base[$k] = pb_deep_merge($base[$k], $v);
    } else {
      $base[$k] = $v;
    }
  }
  return $base;
}

/* ==========================
 * ENTRY: GET = READ, POST = WRITE
 * ========================== */
$file = $_GET['file'] ?? $_POST['file'] ?? '';
if ($file === '') {
  pb_json([
    'ok' => false,
    'error_key' => 'api.rw_config.err.missing_file_parameter',
    'error' => pb_t('api.rw_config.err.missing_file_parameter', 'Missing file parameter'),
  ], 400);
}

$abs = pb_resolve_config_path($file);
$method = strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');

// READ
if ($method === 'GET') {
  $data = pb_load_json_file($abs);
  pb_json([
    'ok'        => true,
    'mode'      => 'read',
    'requested' => $file,
    'resolved'  => $abs,
    'exists'    => is_file($abs),
    'data'      => $data,
  ]);
}

// WRITE (MERGE)
if ($method === 'POST') {
  $raw  = file_get_contents('php://input');
  $body = json_decode($raw, true);
  if (!is_array($body)) {
    pb_json([
      'ok' => false,
      'error_key' => 'api.rw_config.err.invalid_json_body',
      'error' => pb_t('api.rw_config.err.invalid_json_body', 'Invalid JSON body'),
    ], 400);
  }

  // akzeptiert entweder {data:{...}} oder direkt {...}
  $patch = $body['data'] ?? $body;
  if (!is_array($patch)) {
    pb_json([
      'ok' => false,
      'error_key' => 'api.rw_config.err.invalid_data_payload',
      'error' => pb_t('api.rw_config.err.invalid_data_payload', 'Invalid data payload'),
    ], 400);
  }

  $metaLoad = [];
  $existing = pb_load_json_file($abs, $metaLoad);

  // Wenn existing wirklich kaputt war: sichern und mit {} weiter
  $corruptBackup = null;
  if (!empty($metaLoad['invalid_json'])) {
    $ts = date('Ymd_His');
    $corruptBackup = $abs . ".corrupt_$ts.json";
    @copy($abs, $corruptBackup);
    $existing = [];
  }

  $merged = pb_deep_merge($existing, $patch);

  $metaSave = [];
  $ok = pb_save_json_file($abs, $merged, $metaSave);

  pb_json([
    'ok'            => $ok,
    'mode'          => 'write',
    'requested'     => $file,
    'resolved'      => $abs,
    'backup'        => $metaSave['backup'] ?? ($abs . '.bak'),
    'corruptBackup' => $corruptBackup,
    'warnings'      => array_values(array_filter([
      $metaLoad['recovered'] ?? null,
      $metaLoad['invalid_json'] ?? null,
      $metaSave['encode_error'] ?? null,
      $metaSave['roundtrip_error'] ?? null,
      $metaSave['swap_error'] ?? null,
      $metaSave['write_error'] ?? null,
    ])),
    // ✅ wichtig für dein JS unwrapConfig(res):
    'data'          => $merged,
  ], $ok ? 200 : 500);
}

pb_json([
  'ok' => false,
  'error_key' => 'api.rw_config.err.unsupported_method',
  'error' => pb_t('api.rw_config.err.unsupported_method', 'Unsupported method'),
], 405);
