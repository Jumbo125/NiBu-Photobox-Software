<?php
require __DIR__ . '/cors.php';
// booth/api/template_info.php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, no-cache, must-revalidate');

function out($arr) {
  echo json_encode($arr);
  exit;
}

$tplFile = realpath(__DIR__ . '/../activeTemplate/template.xml');

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
