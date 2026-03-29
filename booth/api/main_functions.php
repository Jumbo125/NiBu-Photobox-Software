<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * Lädt Konfiguration und Sprachdatei und stellt t() bereit.
 * - config/config.json wird mit Defaults gemerged
 * - lang/lang_{en|de}.json wird geladen (Fallback auf EN)
 */

$defaultConfig = [
    'language' => 'en',
    'ui' => [
        'main_background_color' => '#ff00009c',
    ],
];

// Config laden + mergen
$configFile = __DIR__ . '/config/config.json';
$config = $defaultConfig;

if (is_file($configFile)) {
    $json = file_get_contents($configFile);
    $data = json_decode($json, true);
    if (is_array($data)) {
        $config = array_replace_recursive($config, $data);
    }
}

// Sprache bestimmen + absichern
$allowedLanguages = ['en', 'de'];
$langCode = (string)($config['language'] ?? 'en');
if (!in_array($langCode, $allowedLanguages, true)) {
    $langCode = 'en';
}

// Sprachdatei laden (Fallback auf EN)
$langFile = __DIR__ . '/lang/lang_' . $langCode . '.json';
if (!is_file($langFile)) {
    $langCode = 'en';
    $langFile = __DIR__ . '/lang/lang_en.json';
}

$lang = [];
if (is_file($langFile)) {
    $json = file_get_contents($langFile);
    $data = json_decode($json, true);
    if (is_array($data)) {
        $lang = $data;
    }
}

// Übersetzung holen (HTML-escaped)
if (!function_exists('t')) {
    function t(string $key, string $fallback = ''): string
    {
        global $lang;
        $value = $lang[$key] ?? $fallback;
        return htmlspecialchars((string)$value, ENT_QUOTES, 'UTF-8');
    }
}
