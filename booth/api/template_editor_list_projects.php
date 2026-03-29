<?php
require __DIR__ . '/cors.php';
header('Content-Type: application/json; charset=utf-8');

$root = dirname(__DIR__) . '/templates';
if (!is_dir($root)) {
  echo json_encode(['ok' => false, 'error' => 'Templates directory missing']);
  exit;
}

$dirs = scandir($root);
$projects = [];
foreach ($dirs as $d) {
  if ($d === '.' || $d === '..') continue;
  $path = $root . DIRECTORY_SEPARATOR . $d;
  if (!is_dir($path)) continue;
  $xml = $path . '/template.xml';
  if (!file_exists($xml)) continue;

  $mtime = filemtime($xml);
  $projects[] = [
    'name' => $d,
    'xml'  => '/templates/'.$d.'/template.xml',
    'modified' => date('Y-m-d H:i', $mtime),
  ];
}
usort($projects, fn($a,$b) => strcmp($b['modified'], $a['modified']));
echo json_encode(['ok'=>true, 'projects'=>$projects], JSON_UNESCAPED_SLASHES);
