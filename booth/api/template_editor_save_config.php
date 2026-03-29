<?php
declare(strict_types=1);
require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

function respond(array $data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

function fail(string $msg, int $code = 400): void {
  respond(['ok' => false, 'error' => $msg], $code);
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  fail('Method not allowed', 405);
}

$raw = file_get_contents('php://input');
$in = json_decode($raw ?: '[]', true);

if (!is_array($in)) {
  fail('Ungültiges JSON');
}

$lang = isset($in['lang']) ? strtolower(trim((string)$in['lang'])) : null;
$allowedLangs = ['de', 'en'];

if ($lang === null || $lang === '') {
  fail('Feld "lang" fehlt');
}
if (!in_array($lang, $allowedLangs, true)) {
  fail('Ungültige Sprache. Erlaubt: de, en');
}

// Zielpfad: /config/config.json (Sibling zu /api)
$rootDir = dirname(__DIR__);               // .../<projectRoot>
$configDir = $rootDir . DIRECTORY_SEPARATOR . 'config';
$configFile = $configDir . DIRECTORY_SEPARATOR . 'config.json';

if (!is_dir($configDir)) {
  if (!mkdir($configDir, 0775, true) && !is_dir($configDir)) {
    fail('Konnte config-Ordner nicht erstellen', 500);
  }
}

// existierende Config laden (und mergen)
$current = [];
if (is_file($configFile)) {
  $txt = @file_get_contents($configFile);
  $j = json_decode($txt ?: '[]', true);
  if (is_array($j)) $current = $j;
}

$current['lang'] = $lang;
$current['updated_at'] = date('c');

$outJson = json_encode($current, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
if ($outJson === false) {
  fail('Konnte JSON nicht serialisieren', 500);
}

// atomar schreiben (tmp + rename)
$tmp = $configFile . '.tmp';
if (@file_put_contents($tmp, $outJson, LOCK_EX) === false) {
  fail('Konnte config.json nicht schreiben', 500);
}
if (!@rename($tmp, $configFile)) {
  @unlink($tmp);
  fail('Konnte config.json nicht finalisieren', 500);
}

respond(['ok' => true, 'config' => $current]);
