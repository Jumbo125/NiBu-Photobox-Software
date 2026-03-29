<?php
declare(strict_types=1);
require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

function respond(array $data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

$rootDir = dirname(__DIR__);               // .../<projectRoot>
$configFile = $rootDir . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config.json';

$default = [
  'lang' => 'de'
];

if (!is_file($configFile)) {
  respond(['ok' => true, 'exists' => false, 'config' => $default]);
}

$txt = @file_get_contents($configFile);
$j = json_decode($txt ?: '[]', true);
if (!is_array($j)) {
  // Datei existiert, aber kaputt -> Default zurückgeben
  respond(['ok' => true, 'exists' => true, 'config' => $default, 'warning' => 'config.json ist ungültig (JSON)']);
}

// sicherstellen, dass lang existiert
if (!isset($j['lang']) || !is_string($j['lang']) || $j['lang'] === '') {
  $j['lang'] = $default['lang'];
}

respond(['ok' => true, 'exists' => true, 'config' => $j]);