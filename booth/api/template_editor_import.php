<?php
require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

function fail($msg, $code = 400) {
  http_response_code($code);
  echo json_encode(['ok' => false, 'error' => $msg], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

function sanitizeName($s) {
  $s = strtolower(trim((string)$s));
  $s = preg_replace('/\s+/', '_', $s);
  $s = preg_replace('/[^a-z0-9_-]/', '', $s);
  return $s;
}

function findFileRecursive($dir, $filename) {
  $it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS)
  );
  foreach ($it as $file) {
    /** @var SplFileInfo $file */
    if (strtolower($file->getFilename()) === strtolower($filename)) {
      return $file->getPathname();
    }
  }
  return null;
}

/**
 * src aus XML import-sicher machen:
 * - absolute URL -> nur Path
 * - /templates/<name>/... -> ...
 * - führende / entfernen
 */
function normalizeAssetSrc($src) {
  $src = trim((string)$src);
  if ($src === '') return '';

  // absolute URL -> path
  $src = preg_replace('#^https?://[^/]+#i', '', $src);

  // /templates/<name>/... -> ...
  $src = preg_replace('#^/templates/[^/]+/#i', '', $src);

  // leading slashes weg
  $src = ltrim($src, '/');

  return $src;
}

if (!isset($_FILES['zip']) || $_FILES['zip']['error'] !== UPLOAD_ERR_OK) {
  fail('ZIP Upload fehlgeschlagen');
}

$tmp = $_FILES['zip']['tmp_name'];
$orig = basename($_FILES['zip']['name']);
$base = sanitizeName(pathinfo($orig, PATHINFO_FILENAME));
if (!$base) $base = 'import_' . date('Ymd_His');

$booth = dirname(__DIR__);
$templatesDir = $booth . DIRECTORY_SEPARATOR . 'templates';

$tplName = $base;
$dest = $templatesDir . DIRECTORY_SEPARATOR . $tplName;
$i = 2;
while (is_dir($dest)) {
  $tplName = $base . '_' . $i;
  $dest = $templatesDir . DIRECTORY_SEPARATOR . $tplName;
  $i++;
}

if (!mkdir($dest, 0777, true)) fail('Kann Zielordner nicht anlegen', 500);

$zip = new ZipArchive();
if ($zip->open($tmp) !== true) fail('ZIP kann nicht geöffnet werden');

// ZipSlip check
for ($k = 0; $k < $zip->numFiles; $k++) {
  $n = $zip->getNameIndex($k);
  if (preg_match('#(^/|^[A-Za-z]:|\\x00|\\.\\.)#', $n)) {
    $zip->close();
    fail('Unsicherer ZIP Inhalt (Pfad)', 400);
  }
}

if (!$zip->extractTo($dest)) {
  $zip->close();
  fail('ZIP konnte nicht entpackt werden', 500);
}
$zip->close();

// template.xml finden (auch wenn ZIP einen Root-Ordner hat)
$xmlPath = $dest . DIRECTORY_SEPARATOR . 'template.xml';
if (!file_exists($xmlPath)) {
  $found = findFileRecursive($dest, 'template.xml');
  if (!$found) fail('template.xml nicht gefunden', 400);
  $xmlPath = $found;
}

// Falls template.xml in Unterordner liegt (ZIP Root-Ordner),
// wollen wir baseUrl trotzdem auf /templates/<tplName>/ lassen.
// Assets werden ohnehin unter /templates/<tplName>/... liegen, weil entpackt dorthin.

$dom = new DOMDocument();
$dom->preserveWhiteSpace = false;
$dom->formatOutput = false;
if (!$dom->load($xmlPath)) fail('Ungültige template.xml', 400);

$tpl = $dom->getElementsByTagName('template')->item(0);
if (!$tpl) fail('Ungültige template.xml', 400);

$width = (int)$tpl->getAttribute('width');
$height = (int)$tpl->getAttribute('height');

$gwAttr = (string)$tpl->getAttribute('greenwall');
$gwAttrLc = strtolower(trim($gwAttr));
$greenwall = ($gwAttr === '1' || $gwAttrLc === 'true');
$settings = ['greenwall' => $greenwall];

$layers = [];
$photoCounter = 0;

// z-order sorting support
$iOrder = 0;

foreach ($dom->getElementsByTagName('layer') as $ly) {
  /** @var DOMElement $ly */
  $iOrder++;
  $type = $ly->getAttribute('type') ?: 'item';

  $item = [
    '_z' => (int)($ly->hasAttribute('z') ? $ly->getAttribute('z') : 0),
    '_o' => $iOrder,

    // stable id (optional)
    'id' => (int)($ly->hasAttribute('id') ? $ly->getAttribute('id') : 0),

    'type' => $type,
    'x' => (int)$ly->getAttribute('x'),
    'y' => (int)$ly->getAttribute('y'),
    'w' => (int)$ly->getAttribute('w'),
    'h' => (int)$ly->getAttribute('h'),
    'rotation' => (int)$ly->getAttribute('rotation'),
  ];

  // Styles (only if present -> backward compatible)
  $styleAttrs = [
    'radius','border','border_color','border_style','border_width',
    'shadow','shadow_preset','shadow_color','shadow_x','shadow_y','shadow_blur','shadow_spread'
  ];

  foreach ($styleAttrs as $a) {
    if ($ly->hasAttribute($a)) {
      $val = $ly->getAttribute($a);
      if (in_array($a, ['radius','border','border_width','shadow','shadow_x','shadow_y','shadow_blur','shadow_spread'], true)) {
        $item[$a] = (int)$val;
      } else {
        $item[$a] = (string)$val;
      }
    }
  }

  if ($type === 'photo') {
    $item['index'] = (int)$ly->getAttribute('index');
    $photoCounter = max($photoCounter, $item['index']);
  } elseif ($type === 'image') {
    // ✅ CRITICAL: normalize src to relative, so baseUrl logic stays correct
    $rawSrc = $ly->getAttribute('src');
    $item['src'] = normalizeAssetSrc($rawSrc);
    $item['name'] = $ly->getAttribute('name') ?: 'IMAGE';
  } else {
    $item['name'] = $ly->getAttribute('name') ?: 'ITEM';
  }

  $layers[] = $item;
}

// Sort by z (bottom->top) if z exists
$hasZ = false;
foreach ($layers as $it) {
  if (!empty($it['_z'])) { $hasZ = true; break; }
}
if ($hasZ) {
  usort($layers, function ($a, $b) {
    $za = (int)($a['_z'] ?? 0);
    $zb = (int)($b['_z'] ?? 0);
    if ($za === $zb) return (int)($a['_o'] ?? 0) <=> (int)($b['_o'] ?? 0);
    return $za <=> $zb;
  });
}

// cleanup internal keys
foreach ($layers as &$it) { unset($it['_z'], $it['_o']); }
unset($it);

echo json_encode([
  'ok' => true,
  'templateName' => $tplName,
  'width' => $width,
  'height' => $height,
  'layers' => $layers,
  'photoCounter' => $photoCounter,
  'baseUrl' => '/templates/' . $tplName . '/',
  'settings' => $settings
], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
