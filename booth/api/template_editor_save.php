<?php
require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

function fail($msg, $code=400) {
  http_response_code($code);
  echo json_encode(['ok'=>false, 'error'=>$msg], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

function sanitizeName($s) {
  $s = strtolower(trim((string)$s));
  $s = preg_replace('/\s+/', '_', $s);
  $s = preg_replace('/[^a-z0-9_-]/', '', $s);
  return $s;
}

function resolveTemplatePaths($name, $booth) {
  if ($name === 'activetemplate') {
    return [
      'dir' => $booth . DIRECTORY_SEPARATOR . 'activeTemplate',
      'url' => '/activeTemplate'
    ];
  }

  return [
    'dir' => $booth . DIRECTORY_SEPARATOR . 'templates' . DIRECTORY_SEPARATOR . $name,
    'url' => '/templates/' . $name
  ];
}

/**
 * Macht src immer "relativ", damit Import/Export stabil bleibt.
 * - entfernt domain
 * - entfernt /templates/<irgendwas>/
 * - entfernt führende slashes
 */
function normalizeAssetSrc($src) {
  $src = trim((string)$src);
  if ($src === '') return '';

  // absolute URL -> nur Path
  $src = preg_replace('#^https?://[^/]+#i', '', $src);

  // /templates/<name>/... -> ...
  $src = preg_replace('#^/templates/[^/]+/#i', '', $src);

  // /activeTemplate/... -> ...
  $src = preg_replace('#^/activeTemplate/#i', '', $src);

  // führende / entfernen
  $src = ltrim($src, '/');

  return $src;
}

function normBorderStyle($s) {
  $s = strtolower(trim((string)$s));
  // Pillow-freundlich
  if (in_array($s, ['solid','dashed','dotted'], true)) return $s;
  return 'solid';
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) fail('Invalid JSON');

$name = sanitizeName($data['templateName'] ?? '');
$w = (int)($data['width'] ?? 0);
$h = (int)($data['height'] ?? 0);

$settings = $data['settings'] ?? [];
$greenwall = !empty($settings['greenwall']) || !empty($data['greenwall']);
$layers = $data['layers'] ?? [];

if (!$name) fail('templateName fehlt');
if ($w < 100 || $h < 100) fail('Ungültige Templategröße');
if (!is_array($layers)) fail('layers muss array sein');

$booth = dirname(__DIR__);
$resolved = resolveTemplatePaths($name, $booth);
$tplDir = $resolved['dir'];
$assetsDir = $tplDir . DIRECTORY_SEPARATOR . 'assets';

if (!is_dir($assetsDir) && !mkdir($assetsDir, 0777, true)) {
  fail('Kann templates dir nicht anlegen', 500);
}

$dom = new DOMDocument('1.0', 'UTF-8');
$dom->formatOutput = true;

$root = $dom->createElement('template');
$root->setAttribute('name', $name);
$root->setAttribute('width', (string)$w);
$root->setAttribute('height', (string)$h);
$root->setAttribute('greenwall', $greenwall ? '1' : '0');
$dom->appendChild($root);

$z = 0;
foreach ($layers as $ly) {
  if (!is_array($ly)) continue;
  $z++;

  $el = $dom->createElement('layer');

  $type = (string)($ly['type'] ?? 'item');
  $el->setAttribute('type', $type);

  // NEW: stabile id
  $id = (int)($ly['id'] ?? 0);
  if ($id > 0) $el->setAttribute('id', (string)$id);

  $el->setAttribute('x', (string)((int)($ly['x'] ?? 0)));
  $el->setAttribute('y', (string)((int)($ly['y'] ?? 0)));
  $el->setAttribute('w', (string)((int)($ly['w'] ?? 0)));
  $el->setAttribute('h', (string)((int)($ly['h'] ?? 0)));
  $el->setAttribute('rotation', (string)((int)($ly['rotation'] ?? 0)));
  $el->setAttribute('z', (string)$z);

  // NEW: Styles (immer schreiben -> später Python Render safe)
  $radius       = (int)($ly['radius'] ?? 0);
  $border       = (int)($ly['border'] ?? 0);
  $borderColor  = (string)($ly['border_color'] ?? '#000000');
  $borderStyle  = normBorderStyle($ly['border_style'] ?? 'solid');
  $borderWidth  = (int)($ly['border_width'] ?? 0);

  $shadow       = (int)($ly['shadow'] ?? 0);
  $shadowPreset = (string)($ly['shadow_preset'] ?? '1');
  $shadowColor  = (string)($ly['shadow_color'] ?? 'rgba(0,0,0,0.35)');
  $shadowX      = (int)($ly['shadow_x'] ?? 0);
  $shadowY      = (int)($ly['shadow_y'] ?? 6);
  $shadowBlur   = (int)($ly['shadow_blur'] ?? 18);
  $shadowSpread = (int)($ly['shadow_spread'] ?? 0);

  $el->setAttribute('radius', (string)$radius);
  $el->setAttribute('border', (string)$border);
  $el->setAttribute('border_color', $borderColor);
  $el->setAttribute('border_style', $borderStyle);
  $el->setAttribute('border_width', (string)$borderWidth);

  $el->setAttribute('shadow', (string)$shadow);
  $el->setAttribute('shadow_preset', $shadowPreset);
  $el->setAttribute('shadow_color', $shadowColor);
  $el->setAttribute('shadow_x', (string)$shadowX);
  $el->setAttribute('shadow_y', (string)$shadowY);
  $el->setAttribute('shadow_blur', (string)$shadowBlur);
  $el->setAttribute('shadow_spread', (string)$shadowSpread);

  if ($type === 'photo') {
    $el->setAttribute('index', (string)((int)($ly['index'] ?? 0)));
  } elseif ($type === 'image') {
    // ✅ CRITICAL: src immer relativ speichern
    $src = normalizeAssetSrc((string)($ly['src'] ?? ''));
    $el->setAttribute('src', $src);
    $el->setAttribute('name', (string)($ly['name'] ?? 'IMAGE'));
  } else {
    $el->setAttribute('name', (string)($ly['name'] ?? 'ITEM'));
  }

  $root->appendChild($el);
}

$xmlPath = $tplDir . DIRECTORY_SEPARATOR . 'template.xml';
if ($dom->save($xmlPath) === false) fail('Kann template.xml nicht schreiben', 500);

echo json_encode([
  'ok' => true,
  'templateName' => $name,
  'path' => $resolved['url'] . '/template.xml'
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
