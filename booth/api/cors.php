<?php
# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';

// Erlaubte Hosts + Ports (Whitelist)
$allowed_origins = [
  'http://localhost:8050',
  'http://localhost:8051',
  'http://127.0.0.1:8050',
  'http://127.0.0.1:8051',
  'http://127.0.0.1:8052',
];

// Optional: erlaubt zusätzlich localhost/127.0.0.1 mit beliebigem Port
$is_allowed = in_array($origin, $allowed_origins, true)
  || (bool) preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);

// CORS nur setzen, wenn Origin vorhanden und erlaubt ist
if ($origin !== '' && $is_allowed) {
  header("Access-Control-Allow-Origin: $origin");
  header('Vary: Origin');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Access-Control-Max-Age: 86400');

// Preflight (OPTIONS) direkt beenden
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
  http_response_code(204);
  exit;
}
