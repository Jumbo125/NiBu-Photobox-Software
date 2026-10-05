<?php
header('Content-Type: text/plain; charset=utf-8');

echo 'PHP_BINARY=' . PHP_BINARY . PHP_EOL;
echo 'Loaded php.ini=' . var_export(php_ini_loaded_file(), true) . PHP_EOL;
echo 'Scanned ini=' . var_export(php_ini_scanned_files(), true) . PHP_EOL;