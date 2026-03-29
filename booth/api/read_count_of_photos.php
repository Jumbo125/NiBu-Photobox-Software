<?php
// booth/api/read_count_of_photos.php
require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

function respond(int $code, array $payload) {
  http_response_code($code);
  echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
  exit;
}

$boothDir = dirname(__DIR__); // .../booth
$xmlPath  = $boothDir . DIRECTORY_SEPARATOR . 'activeTemplate' . DIRECTORY_SEPARATOR . 'template.xml';

if (!file_exists($xmlPath)) {
  respond(404, ['ok' => false, 'error' => 'template.xml nicht gefunden', 'path' => $xmlPath]);
}

libxml_use_internal_errors(true);
$xmlStr = file_get_contents($xmlPath);
if ($xmlStr === false || trim($xmlStr) === '') {
  respond(500, ['ok' => false, 'error' => 'template.xml konnte nicht gelesen werden']);
}

$xml = simplexml_load_string($xmlStr);
if (!$xml) {
  $errs = array_map(fn($e) => trim($e->message), libxml_get_errors());
  libxml_clear_errors();
  respond(400, ['ok' => false, 'error' => 'template.xml ist kein gültiges XML', 'details' => $errs]);
}

// 1) Element <anzahl_an_foto>4</anzahl_an_foto>
$nodes = $xml->xpath('//*[local-name()="anzahl_an_foto"]');
if (is_array($nodes) && count($nodes) > 0) {
  $val = trim((string)$nodes[0]);
  $count = (int)$val;
  if ($count > 0) respond(200, ['ok' => true, 'count' => $count, 'source' => 'element']);
}

// 2) Attribut anzahl_an_foto="4"
$attr = $xml->xpath('//@anzahl_an_foto');
if (is_array($attr) && count($attr) > 0) {
  $val = trim((string)$attr[0]);
  $count = (int)$val;
  if ($count > 0) respond(200, ['ok' => true, 'count' => $count, 'source' => 'attribute']);
}

respond(422, ['ok' => false, 'error' => 'anzahl_an_foto nicht gefunden oder ungültig']);
