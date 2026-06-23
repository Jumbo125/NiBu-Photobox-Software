<?php
/**
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 *
 * python_server_restart.php (Name beibehalten für JS-Kompatibilität)
 *
 * Erwartet (Query-Params, auch bei POST):
 *   ?exe=...&script=...&port=8053[&force=1]
 *
 * Ablauf:
 *   1) Ping auf http://{Host}:{port}{PingPath}
 *   2) Wenn Ping OK:  ok=true, started=false, reason="already_running"
 *   3) Wenn Ping FAIL: startet das Python-Script asynchron (Windows/Linux)
 *   4) Optionaler Cooldown gegen Start-Spam (persistiert im Temp-State)
 *
 * Hinweis:
 *   "error"/"reason" Werte sind bewusst stabile Codes (für JS-Logik/Mapping),
 *   nicht direkt als UI-Text gedacht.
 *
 * Config:
 *   ../config/config/pythonServerStart_config.json
 */

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

ignore_user_abort(true);
set_time_limit(0);

function json_out(array $data, int $code = 200): void {
  http_response_code($code);
  echo json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

function read_json(string $path): array {
  if (!file_exists($path)) return [];
  $raw = @file_get_contents($path);
  if ($raw === false || trim($raw) === '') return [];
  $j = json_decode($raw, true);
  return is_array($j) ? $j : [];
}

function write_json_atomic(string $path, array $data): bool {
  $tmp = $path . '.tmp';
  $raw = json_encode($data, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
  if (@file_put_contents($tmp, $raw) === false) return false;
  return @rename($tmp, $path);
}

function now_ms(): int { return (int) floor(microtime(true) * 1000); }

function has_bad_chars(string $s): bool {
  return preg_match('/[\x00-\x1F\x7F&|<>`]/', $s) === 1;
}

function http_ping(string $url, int $timeoutMs): array {
  $t0 = microtime(true);
  $code = null; $err = null; $ok = false;

  if (function_exists('curl_init')) {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
      CURLOPT_RETURNTRANSFER => true,
      CURLOPT_NOBODY => true,
      CURLOPT_TIMEOUT_MS => $timeoutMs,
      CURLOPT_CONNECTTIMEOUT_MS => $timeoutMs,
    ]);
    curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    if (curl_errno($ch)) $err = curl_error($ch);
    curl_close($ch);
    $ok = ($code !== null && $code >= 200 && $code < 300);
  } else {
    $ctx = stream_context_create(['http' => ['method' => 'HEAD', 'timeout' => max(1, (int)ceil($timeoutMs / 1000))]]);
    $fp = @fopen($url, 'r', false, $ctx);
    if ($fp) { fclose($fp); $ok = true; }
    else { $err = 'fopen_failed'; }
  }

  $ms = (int) round((microtime(true) - $t0) * 1000);
  return ['ok' => $ok, 'code' => $code, 'err' => $err, 'ms' => $ms];
}

/**
 * Persistenter Temp-State pro (script,port), damit Cooldown über Requests hinweg gilt.
 */
function state_path_for(string $script, int $port): string {
  $key = hash('sha256', strtolower(trim($script)) . '|' . $port);
  return rtrim(sys_get_temp_dir(), "/\\") . DIRECTORY_SEPARATOR . "pb_pyserver_start_state_$key.json";
}

function state_load(string $path): array {
  $s = read_json($path);
  if (!$s) {
    $s = ['last_start_ms' => 0];
    write_json_atomic($path, $s);
  }
  return $s;
}

function in_cooldown(int $lastStartMs, int $cooldownMs): array {
  $age = now_ms() - $lastStartMs;
  $left = $cooldownMs - $age;
  return ['active' => ($lastStartMs > 0 && $left > 0), 'left_ms' => max(0, $left)];
}

function start_async(bool $isWindows, string $pythonExe, string $script, int $port): array {
  if ($isWindows) {
    $cmd = 'cmd /c start "" /B ' .
      escapeshellarg($pythonExe) . ' ' .
      escapeshellarg($script) . ' ' .
      escapeshellarg((string)$port);
    @pclose(@popen($cmd, 'r'));
    return ['ok' => true, 'cmd' => $cmd];
  }

  // Linux/macOS: pythonExe kann leer sein -> python3
  if ($pythonExe === '') $pythonExe = 'python3';
  $cmd = 'nohup ' . escapeshellarg($pythonExe) . ' ' .
    escapeshellarg($script) . ' ' .
    escapeshellarg((string)$port) .
    ' >/dev/null 2>&1 &';
  @exec($cmd);
  return ['ok' => true, 'cmd' => $cmd];
}

function ends_with(string $value, string $suffix): bool {
  if ($suffix === '') return true;
  return substr($value, -strlen($suffix)) === $suffix;
}

function process_context(): array {
  $user = getenv('USERNAME') ?: '';
  $session = getenv('SESSIONNAME') ?: '';
  return [
    'user' => $user,
    'userDomain' => getenv('USERDOMAIN') ?: '',
    'sessionName' => $session,
    'isInteractive' => ($session !== '' && !ends_with($user, '$')),
    'isMachineAccount' => ends_with($user, '$'),
  ];
}

// ------------------------------------------------------
// Config laden
// ------------------------------------------------------
$cfgPath = realpath(__DIR__ . DIRECTORY_SEPARATOR . '..' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'config' . DIRECTORY_SEPARATOR . 'pythonServerStart_config.json');
$cfg = $cfgPath ? read_json($cfgPath) : [];

$enabled = (bool)($cfg['Enabled'] ?? true);
$host = (string)($cfg['Host'] ?? '127.0.0.1');
$pingPath = (string)($cfg['PingPath'] ?? '/ping');
$pingTimeoutMs = (int)($cfg['PingTimeoutMs'] ?? 500);
$cooldownMs = (int)($cfg['StartCooldownMs'] ?? 0); // 0 = aus

if (!$enabled) {
  json_out(['ok' => true, 'enabled' => false, 'started' => false, 'reason' => 'disabled_by_config']);
}

// ------------------------------------------------------
// Inputs (von JS)
// ------------------------------------------------------
$isWindows  = (stripos(PHP_OS_FAMILY, 'Windows') !== false);
$pythonExe  = isset($_GET['exe'])    ? trim((string)$_GET['exe'])     : '';
$script     = isset($_GET['script']) ? trim((string)$_GET['script'])  : '';
$port       = isset($_GET['port'])   ? (int)$_GET['port']             : 8053;

$force = isset($_GET['force'])
  ? ((string)$_GET['force'] === '1' || strtolower((string)$_GET['force']) === 'true')
  : false;

if ($port < 1 || $port > 65535) json_out(['ok' => false, 'error' => 'invalid_port', 'port' => $port], 400);

foreach ([$pythonExe, $script] as $arg) {
  if ($arg !== '' && has_bad_chars($arg)) json_out(['ok' => false, 'error' => 'invalid_chars'], 400);
}

if ($script === '' || !file_exists($script)) {
  json_out(['ok' => false, 'error' => 'server_script_not_found', 'script' => $script], 400);
}

// Windows: pythonExe muss existieren; Linux/macOS: leer => python3; Windows-Pfad unter Linux/macOS ignorieren
if ($isWindows) {
  if ($pythonExe === '' || !file_exists($pythonExe)) json_out(['ok' => false, 'error' => 'python_exe_not_found', 'path' => $pythonExe], 400);
} else {
  $looksLikeWindowsPath = (strpos($pythonExe, '\\') !== false) || preg_match('/\.exe$/i', $pythonExe) || preg_match('/^[A-Za-z]:\\\\/', $pythonExe);
  if ($pythonExe === '' || $looksLikeWindowsPath) $pythonExe = 'python3';
  if ($pythonExe[0] === '/' && !file_exists($pythonExe)) json_out(['ok' => false, 'error' => 'python_exe_not_found', 'path' => $pythonExe], 400);
}

// ------------------------------------------------------
// Ensure-start: ping -> ggf starten (mit cooldown)
// ------------------------------------------------------
$pingUrl = 'http://' . $host . ':' . $port . $pingPath;
$ping = http_ping($pingUrl, $pingTimeoutMs);

if ($ping['ok']) {
  json_out([
    'ok' => true,
    'started' => false,
    'reason' => 'already_running',
    'ping' => $ping,
    'port' => $port,
    'phpContext' => process_context()
  ]);
}

// Cooldown state
$statePath = state_path_for($script, $port);
$state = state_load($statePath);
$cool = in_cooldown((int)($state['last_start_ms'] ?? 0), $cooldownMs);

if (!$force && $cooldownMs > 0 && $cool['active']) {
  json_out([
    'ok' => true,
    'started' => false,
    'reason' => 'cooldown',
    'cooldown' => $cool,
    'ping' => $ping,
    'port' => $port,
    'phpContext' => process_context()
  ]);
}

// Start async
$res = start_async($isWindows, $pythonExe, $script, $port);
$state['last_start_ms'] = now_ms();
write_json_atomic($statePath, $state);

json_out([
  'ok' => true,
  'started' => true,
  'cmd' => $res['cmd'],
  'pingBefore' => $ping,
  'port' => $port,
  'exe_in' => $pythonExe,
  'script' => $script,
  'phpContext' => process_context(),
  'cfg' => [
    'host' => $host,
    'pingPath' => $pingPath,
    'pingTimeoutMs' => $pingTimeoutMs,
    'cooldownMs' => $cooldownMs
  ]
]);
