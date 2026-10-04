<?php
require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

function fail($msg, $code=400) {
  http_response_code($code);
  echo json_encode(['ok'=>false, 'error'=>$msg], JSON_UNESCAPED_SLASHES);
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

$booth = dirname(__DIR__); // .../booth

$name = sanitizeName($_POST['templateName'] ?? '');
if (!$name) fail('templateName fehlt');

if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) {
  fail('Upload fehlgeschlagen');
}

$resolved = resolveTemplatePaths($name, $booth);
$dir = $resolved['dir'] . DIRECTORY_SEPARATOR . 'assets';
if (!is_dir($dir) && !mkdir($dir, 0777, true)) fail('Kann assets/ nicht anlegen', 500);

$tmp = $_FILES['file']['tmp_name'];
$orig = basename($_FILES['file']['name']);
$ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION));

$allowed = ['png','jpg','jpeg','webp'];
if (!in_array($ext, $allowed, true)) fail('Nur png/jpg/jpeg/webp erlaubt');

$targetName = isset($_POST['targetName']) ? basename((string)$_POST['targetName']) : '';
$fn = '';
$target = '';

if ($targetName !== '') {
  // Nur für Greenwall erlauben (stabiler Dateiname)
  if (!preg_match('/^___greenwall\.(png|jpg|jpeg)$/i', $targetName)) {
    fail('Ungültiger targetName');
  }

  // Wenn targetName gesetzt ist, muss Extension auch passen (Sicherheit/Logik)
  $tExt = strtolower(pathinfo($targetName, PATHINFO_EXTENSION));
  if (!in_array($tExt, ['png','jpg','jpeg'], true)) {
    fail('Ungültige Greenwall-Endung');
  }
  if ($tExt !== $ext) {
    // optional: du könntest hier auch erlauben und umbenennen,
    // aber sauberer ist: Upload-Extension muss zum targetName passen.
    fail('Dateiendung passt nicht zum targetName (z.B. png zu ___greenwall.png)');
  }

  $fn = strtolower($targetName);
  $target = $dir . DIRECTORY_SEPARATOR . $fn;

  // Andere Greenwall-Varianten löschen, damit nicht mehrere existieren
  $candidates = ['___greenwall.png', '___greenwall.jpg', '___greenwall.jpeg'];
  foreach ($candidates as $c) {
    $p = $dir . DIRECTORY_SEPARATOR . $c;
    if ($c !== $fn && file_exists($p)) {
      @unlink($p);
    }
  }

  // Überschreiben ist erlaubt: kein while(file_exists) hier
} else {
  // Standardverhalten: eindeutigen Namen generieren
  $base = preg_replace('/[^a-z0-9_-]/i', '_', pathinfo($orig, PATHINFO_FILENAME));
  if (!$base) $base = 'img';

  $fn = $base . '.' . $ext;
  $target = $dir . DIRECTORY_SEPARATOR . $fn;

  $i = 2;
  while (file_exists($target)) {
    $fn = $base . '_' . $i . '.' . $ext;
    $target = $dir . DIRECTORY_SEPARATOR . $fn;
    $i++;
  }
}

if (!move_uploaded_file($tmp, $target)) fail('Kann Datei nicht speichern', 500);

$relPath = 'assets/' . $fn;
$url = $resolved['url'] . '/' . $relPath;

echo json_encode([
  'ok' => true,
  // abwärtskompatibel: wie bisher Originalname
  'name' => $orig,
  // neu: tatsächlich gespeicherter Name (für Greenwall/Debug)
  'savedName' => $fn,
  'relPath' => $relPath,
  'url' => $url
], JSON_UNESCAPED_SLASHES);
