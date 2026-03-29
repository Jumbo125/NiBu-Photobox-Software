param(
    [Parameter(Mandatory = $true)]
    [string]$BaseDir,

    [switch]$Clean,
    [switch]$Web,
    [switch]$NoPause,
    [switch]$Kiosk
)

# ============================================================
# BASIS
# ============================================================
$ErrorActionPreference = 'Stop'

$BaseDir   = ([System.IO.Path]::GetFullPath($BaseDir) -replace '[\\/ ]+$', '')
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Write-PortWarning {
    param([string]$Message)
    Write-Warning $Message
}

function Read-JsonFirst {
    param(
        [string[]]$Paths,
        [string]$Label = 'JSON'
    )

    foreach ($path in $Paths) {
        if ([string]::IsNullOrWhiteSpace($path)) { continue }
        if (-not (Test-Path -LiteralPath $path)) { continue }

        try {
            $raw = Get-Content -Raw -LiteralPath $path
            if ([string]::IsNullOrWhiteSpace($raw)) { continue }
            return (ConvertFrom-Json -InputObject $raw)
        }
        catch {
            Write-PortWarning "$Label konnte nicht gelesen werden: $path ($($_.Exception.Message))"
        }
    }

    return $null
}

function Get-FirstValue {
    param(
        $Object,
        [string[]]$Paths
    )

    foreach ($path in $Paths) {
        $cur = $Object
        $ok = $true

        foreach ($seg in ($path -split '\.')) {
            if ($null -eq $cur) { $ok = $false; break }

            $prop = $cur.PSObject.Properties | Where-Object { $_.Name -ieq $seg } | Select-Object -First 1
            if ($null -eq $prop) {
                $ok = $false
                break
            }

            $cur = $prop.Value
        }

        if ($ok -and $null -ne $cur) {
            $text = [string]$cur
            if (-not [string]::IsNullOrWhiteSpace($text)) {
                return $cur
            }
        }
    }

    return $null
}

function Get-PortOrNull {
    param($Value)

    if ($null -eq $Value) { return $null }

    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) { return $null }

    $parsed = 0
    if ([int]::TryParse($text.Trim(), [ref]$parsed)) {
        if ($parsed -ge 1 -and $parsed -le 65535) {
            return $parsed
        }
    }

    return $null
}

function Get-EffectivePorts {
    param(
        [Parameter(Mandatory)][string]$LauncherDir,
        [Parameter(Mandatory)][string]$BaseDir,
        [switch]$WarnOnMismatch
    )

    $ports = [ordered]@{
        CaddyPort  = 8050
        PhpPort    = 8051
        BridgePort = 8052
        PyPort     = 8053
    }

    $caddyJsonPath = Join-Path $LauncherDir 'caddy_php_port.json'
    $caddyJson = Read-JsonFirst -Paths @($caddyJsonPath) -Label 'caddy_php_port.json'
    if ($caddyJson) {
        $caddy = Get-PortOrNull (Get-FirstValue -Object $caddyJson -Paths @('CADDY_PORT', 'caddy_port', 'caddyPort'))
        if ($null -ne $caddy) { $ports.CaddyPort = $caddy }

        $php = Get-PortOrNull (Get-FirstValue -Object $caddyJson -Paths @('PHP_PORT', 'php_port', 'phpPort'))
        if ($null -ne $php) { $ports.PhpPort = $php }
    }

    $apiJsonPaths = @(
        (Join-Path $BaseDir 'booth\tools\camerabridge\APIServer\ApiServer_settings.json'),
        (Join-Path $LauncherDir 'defaultConfig\ApiServer_settings.json')
    )

    $serverJsonPaths = @(
        (Join-Path $BaseDir 'booth\tools\python_portable\server_config.json'),
        (Join-Path $LauncherDir 'defaultConfig\server_config.json')
    )

    $bridgeFromApi = $null
    $apiJson = Read-JsonFirst -Paths $apiJsonPaths -Label 'ApiServer_settings.json'
    if ($apiJson) {
        $bridgeFromApi = Get-PortOrNull (Get-FirstValue -Object $apiJson -Paths @('Bridge.Port', 'Port', 'port'))
        if ($null -ne $bridgeFromApi) {
            $ports.BridgePort = $bridgeFromApi
        }
    }

    $bridgeFromServer = $null
    $pyFromServer = $null
    $serverJson = Read-JsonFirst -Paths $serverJsonPaths -Label 'server_config.json'
    if ($serverJson) {
        $bridgeFromServer = Get-PortOrNull (Get-FirstValue -Object $serverJson -Paths @('port', 'Port'))
        $pyFromServer = Get-PortOrNull (Get-FirstValue -Object $serverJson -Paths @('Python_ServerPort', 'python_server_port', 'pythonServerPort', 'PY_PORT', 'py_port', 'pyPort', 'PythonPort', 'pythonPort'))

        if ($null -eq $bridgeFromApi -and $null -ne $bridgeFromServer) {
            $ports.BridgePort = $bridgeFromServer
        }

        if ($null -ne $pyFromServer) {
            $ports.PyPort = $pyFromServer
        }
    }

    if ($WarnOnMismatch -and $null -ne $bridgeFromApi -and $null -ne $bridgeFromServer -and $bridgeFromApi -ne $bridgeFromServer) {
        Write-PortWarning "server_config.json.port ($bridgeFromServer) weicht von ApiServer_settings.json Bridge.Port ($bridgeFromApi) ab. ApiServer_settings.json bleibt maßgeblich."
    }

    return [pscustomobject]$ports
}

function Test-IsAdmin {
    try {
        $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
        $principal = New-Object Security.Principal.WindowsPrincipal($identity)
        return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
    catch {
        return $false
    }
}

$IsAdmin = Test-IsAdmin

Write-Host "=== NiBu Backend START DEV (PS1) ==="
Write-Host "BaseDir: $BaseDir"
Write-Host "Flags: Clean=$Clean Web=$Web NoPause=$NoPause Kiosk=$Kiosk"
Write-Host "Admin: $IsAdmin"

if (($Clean -or $Web) -and -not $IsAdmin) {
    Write-Host '[INFO] Clean/Web erkannt und aktueller Prozess ist nicht erhöht.'
    Write-Host '[INFO] Starte dieses Script einmalig mit Admin-Rechten neu, damit Stop zuverlässig funktioniert.'

    $argString = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -BaseDir `"$BaseDir`""
    if ($Clean)   { $argString += ' -Clean' }
    if ($Web)     { $argString += ' -Web' }
    if ($NoPause) { $argString += ' -NoPause' }
    if ($Kiosk)   { $argString += ' -Kiosk' }

    try {
        $proc = Start-Process -FilePath 'powershell.exe' -ArgumentList $argString -Verb RunAs -Wait -PassThru
        exit $proc.ExitCode
    }
    catch {
        throw 'Elevation abgebrochen oder fehlgeschlagen. Ohne Admin-Rechte kann -Clean laufende erhöhte Prozesse nicht zuverlässig stoppen.'
    }
}

# ============================================================
# STOP-LOGIK
# ============================================================
$StopBat = Join-Path $ScriptDir 'stop.bat'
if (($Clean -or $Web) -and -not (Test-Path -LiteralPath $StopBat)) {
    throw "stop.bat nicht gefunden: $StopBat"
}

if ($Clean) {
    Write-Host "--- CLEAN: stoppe ALLES ---"
    & $StopBat /nopause
    $stopExitCode = $LASTEXITCODE
    if ($stopExitCode -ne 0) {
        throw "stop.bat /nopause fehlgeschlagen (ExitCode=$stopExitCode). Start wird abgebrochen, um Port-/Prozesskonflikte zu vermeiden."
    }
}
elseif ($Web) {
    Write-Host "--- WEB: stoppe nur Caddy + PHP ---"
    & $StopBat /web /nopause
    $stopExitCode = $LASTEXITCODE
    if ($stopExitCode -ne 0) {
        throw "stop.bat /web /nopause fehlgeschlagen (ExitCode=$stopExitCode). Start wird abgebrochen, um Port-/Prozesskonflikte zu vermeiden."
    }
}

# ============================================================
# KONFIGURIERTE PORTS
# ============================================================
$LoadedPorts = Get-EffectivePorts -LauncherDir $ScriptDir -BaseDir $BaseDir -WarnOnMismatch
$CaddyPort   = [int]$LoadedPorts.CaddyPort
$PhpPort     = [int]$LoadedPorts.PhpPort
$BridgePort  = [int]$LoadedPorts.BridgePort
$PyPort      = [int]$LoadedPorts.PyPort

Write-Host "Ports: Caddy=$CaddyPort PHP=$PhpPort Bridge=$BridgePort Python=$PyPort"

# ============================================================
# EXECUTABLE PATHS
# ============================================================
$CaddyExe  = Join-Path $BaseDir "caddy_windows_amd64.exe"
$CaddyFile = Join-Path $BaseDir "Caddy\Caddyfile"

$PhpExe    = Join-Path $BaseDir "php\php-cgi.exe"
$PhpIni    = Join-Path $BaseDir "php\php.ini"

$BridgeExe = Join-Path $BaseDir "booth\tools\camerabridge\APIServer\Photobox.Bridge.ApiServer.exe"
$PyExe     = Join-Path $BaseDir "booth\tools\python_portable\python.exe"
$PyServer  = Join-Path $BaseDir "booth\tools\python_portable\python_server.py"

# --- harte Existenzprüfung ---
if (-not (Test-Path -LiteralPath $CaddyExe)) {
    throw "Caddy executable nicht gefunden: $CaddyExe"
}

if (-not (Test-Path -LiteralPath $CaddyFile)) {
    throw "Caddyfile nicht gefunden: $CaddyFile"
}

if (-not (Test-Path -LiteralPath $PhpExe)) {
    throw "PHP CGI executable nicht gefunden: $PhpExe"
}

if (-not (Test-Path -LiteralPath $PhpIni)) {
    throw "php.ini nicht gefunden: $PhpIni"
}

# ============================================================
# HILFSFUNKTIONEN
# ============================================================
function Normalize-PathSafe {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    try {
        return [System.IO.Path]::GetFullPath($Path)
    }
    catch {
        return $Path
    }
}

function Get-ProcessByExactPath {
    param(
        [Parameter(Mandatory)]
        [string]$ExePath
    )

    if (-not (Test-Path -LiteralPath $ExePath)) {
        return @()
    }

    $target = Normalize-PathSafe $ExePath

    Get-Process -ErrorAction SilentlyContinue | Where-Object {
        try {
            $_.Path -and ((Normalize-PathSafe $_.Path) -ieq $target)
        }
        catch {
            $false
        }
    }
}

function Quote-Arg {
    param(
        [AllowNull()]
        [string]$Value
    )

    if ($null -eq $Value) { return '""' }

    if ($Value -match '[\s"]') {
        return '"' + ($Value -replace '"', '\"') + '"'
    }

    return $Value
}

function Start-Once {
    param(
        [Parameter(Mandatory)]
        [string]$Exe,

        [string[]]$Args,

        [Parameter(Mandatory)]
        [string]$WorkDir
    )

    if (-not (Test-Path -LiteralPath $Exe)) {
        Write-Warning "Executable nicht gefunden: $Exe"
        return
    }

    $already = @(Get-ProcessByExactPath -ExePath $Exe)
    if ($already.Count -gt 0) {
        Write-Host "[OK] Läuft bereits: $Exe"
        return
    }

    Write-Host "[START] $Exe"

    if ($Args -and $Args.Count -gt 0) {
        Write-Host "        Args: $($Args -join ' ')"
        Start-Process `
            -FilePath $Exe `
            -ArgumentList $Args `
            -WorkingDirectory $WorkDir
    }
    else {
        Start-Process `
            -FilePath $Exe `
            -WorkingDirectory $WorkDir
    }
}

function Start-OnceWithEnvironment {
    param(
        [Parameter(Mandatory)]
        [string]$Exe,

        [string[]]$Args,

        [Parameter(Mandatory)]
        [string]$WorkDir,

        [hashtable]$EnvironmentOverrides,

        [string[]]$EnvironmentRemove
    )

    if (-not (Test-Path -LiteralPath $Exe)) {
        Write-Warning "Executable nicht gefunden: $Exe"
        return
    }

    $already = @(Get-ProcessByExactPath -ExePath $Exe)
    if ($already.Count -gt 0) {
        Write-Host "[OK] Läuft bereits: $Exe"
        return
    }

    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = $Exe
    $psi.WorkingDirectory = $WorkDir
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true

    if ($Args -and $Args.Count -gt 0) {
        $psi.Arguments = (($Args | ForEach-Object { Quote-Arg $_ }) -join ' ')
        Write-Host "[START] $Exe"
        Write-Host "        Args: $($Args -join ' ')"
    }
    else {
        Write-Host "[START] $Exe"
    }

    foreach ($entry in [System.Environment]::GetEnvironmentVariables().GetEnumerator()) {
        $psi.EnvironmentVariables[$entry.Key] = [string]$entry.Value
    }

    if ($EnvironmentOverrides) {
        foreach ($key in $EnvironmentOverrides.Keys) {
            $psi.EnvironmentVariables[$key] = [string]$EnvironmentOverrides[$key]
        }
    }

    if ($EnvironmentRemove) {
        foreach ($key in $EnvironmentRemove) {
            if ($psi.EnvironmentVariables.ContainsKey($key)) {
                $psi.EnvironmentVariables.Remove($key)
            }
        }
    }

    [void][System.Diagnostics.Process]::Start($psi)
}

# ============================================================
# ENVIRONMENT
# ============================================================
$env:CADDY_PORT  = $CaddyPort
$env:PHP_PORT    = $PhpPort
$env:BRIDGE_PORT = $BridgePort
$env:PY_PORT     = $PyPort

# Optional – alles im Projektordner halten
$env:HOME             = $BaseDir
$env:CADDY_DATA_DIR   = Join-Path $BaseDir "Caddy\data"
$env:CADDY_CONFIG_DIR = Join-Path $BaseDir "Caddy\config"
$env:XDG_CACHE_HOME   = Join-Path $BaseDir "Caddy\cache"

# PHP hart auf lokale Installation festnageln
$env:PHPRC            = Split-Path $PhpIni
$env:PHP_INI_SCAN_DIR = ""
$env:PHP_FCGI_MAX_REQUESTS = "0"

Write-Host "PHP EXE : $PhpExe"
Write-Host "PHP INI : $PhpIni"
Write-Host "PHPRC   : $env:PHPRC"
Write-Host "INI_SCAN: '$env:PHP_INI_SCAN_DIR'"

# Ordner sicherstellen
New-Item -ItemType Directory -Force -Path `
    $env:CADDY_DATA_DIR,
    $env:CADDY_CONFIG_DIR,
    $env:XDG_CACHE_HOME | Out-Null

# Optionaler Log-Ordner
$ProjectLogDir = Join-Path $BaseDir "logs"
New-Item -ItemType Directory -Force -Path $ProjectLogDir | Out-Null

# ============================================================
# START-MODUS INFO
# ============================================================
if ($Clean) {
    Write-Host "[MODE] CLEAN"
}
elseif ($Web) {
    Write-Host "[MODE] WEB"
}
else {
    Write-Host "[MODE] NORMAL"
}

# ============================================================
# CADDY VALIDATE + START
# ============================================================
$CaddyArgs = @(
    "run",
    "--config", $CaddyFile,
    "--adapter", "caddyfile"
)

Write-Host "[CHECK] Caddyfile validate"
& $CaddyExe validate --config $CaddyFile --adapter caddyfile
if ($LASTEXITCODE -ne 0) {
    throw "Caddyfile ist ungültig (validate fehlgeschlagen)."
}

Start-Once `
    -Exe $CaddyExe `
    -Args $CaddyArgs `
    -WorkDir $BaseDir

Start-Sleep -Seconds 2

# ============================================================
# PROC DUMP START (nur DEV, optional)
# ============================================================
$ProcDumpDir = Join-Path $BaseDir "DEV\ProcDump"
$DumpDir     = Join-Path $BaseDir "dumps"

$IsArm64 = ($env:PROCESSOR_ARCHITECTURE -eq "ARM64" -or $env:PROCESSOR_ARCHITEW6432 -eq "ARM64")

if ($IsArm64) {
    $ProcDumpCandidates = @("procdump64a.exe", "procdump64.exe", "procdump.exe")
}
else {
    $ProcDumpCandidates = @("procdump64.exe", "procdump.exe", "procdump64a.exe")
}

$ProcDumpExe = $null
foreach ($name in $ProcDumpCandidates) {
    $candidate = Join-Path $ProcDumpDir $name
    if (Test-Path -LiteralPath $candidate) {
        $ProcDumpExe = $candidate
        break
    }
}

New-Item -ItemType Directory -Force -Path $DumpDir | Out-Null

if ($ProcDumpExe) {
    Write-Host "[DUMP] ProcDump : $ProcDumpExe"
    Write-Host "[DUMP] DumpDir  : $DumpDir"

Start-Once `
    -Exe $ProcDumpExe `
    -Args @(
        "-accepteula",
        "-ma",
        "-e",
        "-t",
        "-w", "php-cgi.exe",
        $DumpDir
    ) `
    -WorkDir (Split-Path $ProcDumpExe)

    Start-Sleep -Milliseconds 500
}
else {
    Write-Warning "ProcDump nicht gefunden unter: $ProcDumpDir"
}

# ============================================================
# PHP START (mit bereinigtem PATH nur für php-cgi.exe)
# ============================================================
$PhpArgs = @(
    "-c", $PhpIni,
    "-b", "127.0.0.1:$PhpPort"
)

$PhpWorkDir = Split-Path $PhpExe

$CleanPhpPath = @(
    $PhpWorkDir,
    "$env:SystemRoot\System32",
    "$env:SystemRoot"
) -join ';'

Write-Host "[PHP ENV] Clean PATH = $CleanPhpPath"

Start-OnceWithEnvironment `
    -Exe $PhpExe `
    -Args $PhpArgs `
    -WorkDir $PhpWorkDir `
    -EnvironmentOverrides @{
        "PATH"             = $CleanPhpPath
        "PHPRC"            = (Split-Path $PhpIni)
        "PHP_INI_SCAN_DIR" = ""
    } `
    -EnvironmentRemove @("PHP")

Start-Sleep -Seconds 1

# ============================================================
# BRIDGE + PYTHON (nur wenn nicht WEB)
# ============================================================
if (-not $Web) {

    if (Test-Path -LiteralPath $BridgeExe) {
        Start-Once `
            -Exe $BridgeExe `
            -WorkDir (Split-Path $BridgeExe)
    }
    else {
        Write-Warning "Bridge executable nicht gefunden: $BridgeExe"
    }

    if ((Test-Path -LiteralPath $PyExe) -and (Test-Path -LiteralPath $PyServer)) {
        Start-Once `
            -Exe $PyExe `
            -Args @($PyServer) `
            -WorkDir (Split-Path $PyExe)
    }
    else {
        Write-Warning "Python oder python_server.py nicht gefunden."
        Write-Warning "PyExe: $PyExe"
        Write-Warning "PyServer: $PyServer"
    }
}

# ============================================================
# KIOSK
# ============================================================
if ($Kiosk) {
    $url = "http://127.0.0.1:$CaddyPort/"
    Write-Host "[KIOSK] $url"

    if (Get-Command msedge.exe -ErrorAction SilentlyContinue) {
        Start-Process msedge.exe @(
            "--kiosk", $url,
            "--edge-kiosk-type=fullscreen",
            "--no-first-run"
        )
    }
    elseif (Get-Command chrome.exe -ErrorAction SilentlyContinue) {
        Start-Process chrome.exe $url
    }
    else {
        Start-Process $url
    }
}

# ============================================================
# ABSCHLUSSINFO
# ============================================================
Write-Host "=== START fertig ==="
Write-Host "Caddy : http://127.0.0.1:$CaddyPort/"
Write-Host "PHP   : 127.0.0.1:$PhpPort"
Write-Host "Bridge: 127.0.0.1:$BridgePort"
Write-Host "PyAPI : 127.0.0.1:$PyPort"

if (-not $NoPause) {
    Read-Host "Taste drücken..."
}

exit 0
