<?php
require __DIR__ . '/cors.php';

function fail($msg, $code=400) {
  http_response_code($code);
  header('Content-Type: application/json; charset=utf-8');
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

$raw = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) fail('Invalid JSON');

$name = sanitizeName($data['templateName'] ?? '');
if (!$name) fail('templateName fehlt');

$booth = dirname(__DIR__);
$resolved = resolveTemplatePaths($name, $booth);
$tplDir = $resolved['dir'];
$xml = $tplDir . DIRECTORY_SEPARATOR . 'template.xml';

if (!is_dir($tplDir) || !is_file($xml)) fail('Template nicht gefunden', 404);

// temp zip
$tmpZip = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'template_' . $name . '_' . date('Ymd_His') . '.zip';

$zip = new ZipArchive();
if ($zip->open($tmpZip, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
  fail('Kann ZIP nicht erstellen', 500);
}

// alle files rekursiv, aber keine symlinks (Sicherheit)
$flags = FilesystemIterator::SKIP_DOTS;
$dirIt = new RecursiveDirectoryIterator($tplDir, $flags);
$rii = new RecursiveIteratorIterator($dirIt, RecursiveIteratorIterator::LEAVES_ONLY);

foreach ($rii as $file) {
  /** @var SplFileInfo $file */
  if (!$file->isFile()) continue;
  if ($file->isLink()) continue; // ✅ keine symlinks

  $path = $file->getPathname();
  $rel = substr($path, strlen($tplDir) + 1);

  // rel immer mit forward slashes (ZIP Standard)
  $rel = str_replace(DIRECTORY_SEPARATOR, '/', $rel);

  $zip->addFile($path, $rel);
}

$zip->close();

if (!is_file($tmpZip)) fail('ZIP nicht erstellt', 500);

// Output
header('Content-Type: application/zip');
header('Content-Disposition: attachment; filename="' . $name . '.zip"');
header('Content-Length: ' . filesize($tmpZip));
header('Cache-Control: no-store');

$fp = fopen($tmpZip, 'rb');
if ($fp === false) {
  @unlink($tmpZip);
  fail('ZIP konnte nicht gelesen werden', 500);
}
fpassthru($fp);
fclose($fp);

@unlink($tmpZip);
exit;
