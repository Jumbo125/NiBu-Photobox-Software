<?php
# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
#
# POST /api/test_print.php
# Proxy zum Python-Server /print/test.
# Liest AuthKey aus server_config.json und leitet den Request weiter.
# Kein Counter-Increment.

require __DIR__ . '/cors.php';

header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'method_not_allowed']);
    exit;
}

// server_config.json lesen
$serverCfgPath = realpath(__DIR__ . '/../tools/python_portable/server_config.json');
if (!$serverCfgPath || !is_file($serverCfgPath)) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'server_config_not_found']);
    exit;
}

$serverCfg = json_decode(file_get_contents($serverCfgPath), true);
$authKey    = trim($serverCfg['AuthKey'] ?? '');
$port       = (int) ($serverCfg['Port'] ?? 8053);
$host       = trim($serverCfg['Host'] ?? '127.0.0.1');
if (!$host) $host = '127.0.0.1';

// Optionaler printerName aus Request-Body
$body = json_decode(file_get_contents('php://input'), true) ?: [];
$pyPayload = [];
if (!empty($body['printerName'])) {
    $pyPayload['printerName'] = (string) $body['printerName'];
}

$pythonUrl = "http://{$host}:{$port}/print/test";

$ch = curl_init($pythonUrl);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => json_encode($pyPayload),
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        "X-Api-Key: {$authKey}",
    ],
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 90,
    CURLOPT_CONNECTTIMEOUT => 5,
]);

$raw      = curl_exec($ch);
$httpCode = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

if ($raw === false || $curlErr) {
    http_response_code(502);
    echo json_encode(['ok' => false, 'error' => 'python_unreachable', 'detail' => $curlErr]);
    exit;
}

http_response_code($httpCode ?: 502);
echo $raw;
