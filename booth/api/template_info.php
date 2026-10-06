<?php
require __DIR__ . '/cors.php';
// booth/api/template_info.php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

function out($arr) {
  echo json_encode($arr);
  exit;
}

/**
 * Resolve the currently active template.xml.
 *
 * The active template now always lives in a numbered slot folder
 * (booth/activeTemplate/<n>/template.xml) — both the ZIP upload
 * (set_Active_template.php) and the editor's "Set Active" action
 * (template_set_active.php) create slot 1/ even for a single template.
 *
 * capture_bindings.js reads the same config value (general.activeTemplate.path)
 * to build the path it actually uses for rendering, so we mirror that here
 * to guarantee this preview check and the real capture agree on which
 * template is active.
 */
$boothRoot = realpath(__DIR__ . '/..') ?: dirname(__DIR__);
$base = $boothRoot . DIRECTORY_SEPARATOR . 'activeTemplate';

$tplFile = false;

$cfgPath = $boothRoot . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config.json';
if (is_file($cfgPath)) {
  $cfgRaw = @file_get_contents($cfgPath);
  $cfg = $cfgRaw !== false ? json_decode($cfgRaw, true) : null;
  $configuredPath = is_array($cfg) ? ($cfg['activeTemplate']['path'] ?? null) : null;

  if (is_string($configuredPath) && $configuredPath !== '') {
    $candidate = rtrim($configuredPath, "\\/") . DIRECTORY_SEPARATOR . 'template.xml';
    if (is_file($candidate)) {
      $tplFile = realpath($candidate);
    }
  }
}

// Fallback: no (valid) configured path yet — use the lowest numbered slot,
// then the legacy flat layout, so the preview still works right after a
// fresh upload before config.json has been patched with a slot path.
if ($tplFile === false) {
  $slotNums = [];
  foreach (@scandir($base) ?: [] as $entry) {
    if (preg_match('/^[0-9]+$/', $entry) && is_dir($base . DIRECTORY_SEPARATOR . $entry)) {
      $slotNums[] = (int)$entry;
    }
  }
  sort($slotNums);

  foreach ($slotNums as $n) {
    $candidate = $base . DIRECTORY_SEPARATOR . $n . DIRECTORY_SEPARATOR . 'template.xml';
    if (is_file($candidate)) {
      $tplFile = realpath($candidate);
      break;
    }
  }

  if ($tplFile === false) {
    $flat = $base . DIRECTORY_SEPARATOR . 'template.xml';
    if (is_file($flat)) {
      $tplFile = realpath($flat);
    }
  }
}

if (!$tplFile || !is_file($tplFile)) {
  out([
    'ok' => false,
    'code' => 'TEMPLATE_XML_MISSING',
    'photo_count' => 0
  ]);
}

libxml_use_internal_errors(true);
$xml = simplexml_load_file($tplFile, 'SimpleXMLElement', LIBXML_NONET);

if ($xml === false) {
  $errs = libxml_get_errors();
  libxml_clear_errors();

  out([
    'ok' => false,
    'code' => 'TEMPLATE_XML_INVALID',
    'photo_count' => 0,
    // optional: nur für Debug-Overlay / Logs
    'debug' => [
      'xml_errors' => array_map(function ($e) {
        return trim($e->message) . ' (line ' . $e->line . ')';
      }, $errs)
    ]
  ]);
}

$nodes = $xml->xpath('//layer[@type="photo"]');
$count = is_array($nodes) ? count($nodes) : 0;

if ($count <= 0) {
  out([
    'ok' => false,
    'code' => 'TEMPLATE_NO_PHOTO_LAYERS',
    'photo_count' => 0
  ]);
}

out([
  'ok' => true,
  'code' => 'OK',
  'photo_count' => $count,
  'template' => [
    'width' => (int)($xml['width'] ?? 0),
    'height' => (int)($xml['height'] ?? 0),
    'greenwall' => (int)($xml['greenwall'] ?? 0),
  ]
]);
