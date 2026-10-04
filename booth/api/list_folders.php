<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
//
// api/list_folders.php — Listet Unterordner + Bilddateien eines Verzeichnisses
//
// GET ?path=C:\...\booth\photos\EVENTS
// Response: { ok, path, folders:[{name,path}], files:[{name,path,rel}] }

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');

$boothRoot = realpath(__DIR__ . '/..');
$photosRoot = $boothRoot . DIRECTORY_SEPARATOR . 'photos';

// Erlaubter Basis-Pfad: nur innerhalb booth/photos erlaubt
function resolveAndValidate(string $requested, string $allowedBase): string|false {
    $real = realpath($requested);
    if ($real === false) {
        // Ordner existiert noch nicht — prüfe den Parent
        $parent = realpath(dirname($requested));
        if ($parent === false) return false;
        $real = $parent . DIRECTORY_SEPARATOR . basename($requested);
    }
    $allowedReal = realpath($allowedBase);
    if ($allowedReal === false) return false;
    // Sicherstellen dass der Pfad innerhalb des erlaubten Basis-Verzeichnisses liegt
    $realNorm    = rtrim(str_replace('/', DIRECTORY_SEPARATOR, $real), DIRECTORY_SEPARATOR);
    $allowedNorm = rtrim(str_replace('/', DIRECTORY_SEPARATOR, $allowedReal), DIRECTORY_SEPARATOR);
    if (strpos($realNorm, $allowedNorm) !== 0) return false;
    return $realNorm;
}

$requestedPath = trim($_GET['path'] ?? '');
if ($requestedPath === '') {
    // Kein Pfad → booth/photos/EVENTS als Standard
    $requestedPath = $photosRoot . DIRECTORY_SEPARATOR . 'EVENTS';
}

$safePath = resolveAndValidate($requestedPath, $photosRoot);
if ($safePath === false) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'invalid_path', 'message' => 'Path is outside allowed directory or invalid.']);
    exit;
}

// Ordner existiert nicht → leeres Ergebnis
if (!is_dir($safePath)) {
    echo json_encode(['ok' => true, 'path' => $safePath, 'folders' => [], 'files' => []]);
    exit;
}

$imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif'];
$folders   = [];
$files     = [];

$items = @scandir($safePath);
if ($items === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'scandir_failed']);
    exit;
}

foreach ($items as $item) {
    if ($item === '.' || $item === '..') continue;
    $fullPath = $safePath . DIRECTORY_SEPARATOR . $item;

    if (is_dir($fullPath)) {
        // Anzahl Bilder im Unterordner zählen (nicht rekursiv — nur direkte Kinder)
        $subItems = @scandir($fullPath) ?: [];
        $imgCount = 0;
        foreach ($subItems as $sub) {
            if ($sub === '.' || $sub === '..') continue;
            $ext = strtolower(pathinfo($sub, PATHINFO_EXTENSION));
            if (in_array($ext, $imageExts)) $imgCount++;
            elseif (is_dir($fullPath . DIRECTORY_SEPARATOR . $sub)) $imgCount++; // Unterordner auch zählen
        }
        $folders[] = [
            'name'     => $item,
            'path'     => $fullPath,
            'children' => $imgCount,
        ];
    } else {
        $ext = strtolower(pathinfo($item, PATHINFO_EXTENSION));
        if (in_array($ext, $imageExts)) {
            $files[] = [
                'name' => $item,
                'path' => $fullPath,
            ];
        }
    }
}

// Alphabetisch sortieren
usort($folders, fn($a, $b) => strnatcasecmp($a['name'], $b['name']));
usort($files,   fn($a, $b) => strnatcasecmp($a['name'], $b['name']));

echo json_encode([
    'ok'      => true,
    'path'    => $safePath,
    'folders' => $folders,
    'files'   => $files,
]);
