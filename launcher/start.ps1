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

$BaseDir = ([System.IO.Path]::GetFullPath($BaseDir) -replace '[\\/ ]+$', '')
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

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

function Set-PortIfValid {
    param(
        [AllowNull()]$Value,
        [ref]$Target
    )

    if ($null -eq $Value) { return }

    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) { return }

    $parsed = 0
    if ([int]::TryParse($text.Trim(), [ref]$parsed)) {
        if ($parsed -ge 1 -and $parsed -le 65535) {
            $Target.Value = $parsed
        }
    }
}

function Get-JsonPropertyValue {
    param(
        [Parameter(Mandatory)]$Object,
        [Parameter(Mandatory)][string[]]$Names
    )

    foreach ($name in $Names) {
        if ($null -eq $Object) { break }

        $prop = $Object.PSObject.Properties[$name]
        if ($null -ne $prop) {
            return $prop.Value
        }
    }

    return $null
}

function Load-Ports {
    param(
        [Parameter(Mandatory)][string]$LauncherDir,
        [Parameter(Mandatory)][string]$BaseDir
    )

    $ports = [ordered]@{
        CaddyPort  = 8050
        PhpPort    = 8051
        BridgePort = 8052
        PyPort     = 8053
    }

    $caddyPhpJsonPath = Join-Path $LauncherDir 'caddy_php_port.json'
    $apiSettingsPath  = Join-Path $BaseDir 'booth\tools\camerabridge\APIServer\ApiServer_settings.json'
    $serverConfigPath = Join-Path $BaseDir 'booth\tools\python_portable\server_config.json'

    if (Test-Path -LiteralPath $caddyPhpJsonPath) {
        try {
            $cp = Get-Content -Raw -LiteralPath $caddyPhpJsonPath | ConvertFrom-Json
            Set-PortIfValid -Value (Get-JsonPropertyValue -Object $cp -Names @('CADDY_PORT','caddy_port','caddyPort')) -Target ([ref]$ports.CaddyPort)
            Set-PortIfValid -Value (Get-JsonPropertyValue -Object $cp -Names @('PHP_PORT','php_port','phpPort')) -Target ([ref]$ports.PhpPort)
        }
        catch {
            Write-Warning "caddy_php_port.json konnte nicht gelesen werden: $($_.Exception.Message)"
        }
    }
    else {
        Write-Warning "caddy_php_port.json nicht gefunden: $caddyPhpJsonPath"
    }

    if (Test-Path -LiteralPath $apiSettingsPath) {
        try {
            $api = Get-Content -Raw -LiteralPath $apiSettingsPath | ConvertFrom-Json

$bridge = Get-JsonPropertyValue -Object $api -Names @('Port','port')
if ($null -eq $bridge) {
    $bridgeObj = Get-JsonPropertyValue -Object $api -Names @('Bridge')
    $bridge = Get-JsonPropertyValue -Object $bridgeObj -Names @('Port','port')
}

Set-PortIfValid -Value $bridge -Target ([ref]$ports.BridgePort)
        }
        catch {
            Write-Warning "ApiServer_settings.json konnte nicht gelesen werden: $($_.Exception.Message)"
        }
    }
    else {
        Write-Warning "ApiServer_settings.json nicht gefunden: $apiSettingsPath"
    }

    if (Test-Path -LiteralPath $serverConfigPath) {
        try {
            $server = Get-Content -Raw -LiteralPath $serverConfigPath | ConvertFrom-Json
            $serverBridge = Get-JsonPropertyValue -Object $server -Names @('port','Port')
            $serverPy     = Get-JsonPropertyValue -Object $server -Names @('Python_ServerPort','python_server_port','pythonServerPort','PY_PORT','py_port','pyPort')

            if ($null -ne $serverBridge) {
                $tmpBridge = $ports.BridgePort
                Set-PortIfValid -Value $serverBridge -Target ([ref]$tmpBridge)
                if ($tmpBridge -ne $ports.BridgePort) {
                    Write-Warning "server_config.json.port ($tmpBridge) weicht von ApiServer_settings.json Bridge.Port ($($ports.BridgePort)) ab. ApiServer_settings.json bleibt maßgeblich."
                }
            }

            Set-PortIfValid -Value $serverPy -Target ([ref]$ports.PyPort)
        }
        catch {
            Write-Warning "server_config.json konnte nicht gelesen werden: $($_.Exception.Message)"
        }
    }
    else {
        Write-Warning "server_config.json nicht gefunden: $serverConfigPath"
    }

    return [pscustomobject]$ports
}

$IsAdmin = Test-IsAdmin

Write-Host "=== NiBu Backend START (PS1) ==="
Write-Host "BaseDir: $BaseDir"
Write-Host "Flags: Clean=$Clean Web=$Web NoPause=$NoPause Kiosk=$Kiosk"
Write-Host "Admin: $IsAdmin"

# ============================================================
# CLEAN/WEB nur erhöht starten, damit stop.bat laufende Admin-
# Prozesse zuverlässig beenden kann.
# ============================================================
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
# DEFAULT / KONFIGURIERTE PORTS
# ============================================================
$LoadedPorts = Load-Ports -LauncherDir $ScriptDir -BaseDir $BaseDir
$CaddyPort   = [int]$LoadedPorts.CaddyPort
$PhpPort     = [int]$LoadedPorts.PhpPort
$BridgePort  = [int]$LoadedPorts.BridgePort
$PyPort      = [int]$LoadedPorts.PyPort

Write-Host "Ports: Caddy=$CaddyPort PHP=$PhpPort Bridge=$BridgePort Python=$PyPort"

# ============================================================
# STOP-LOGIK
# ============================================================
$StopBat = Join-Path $ScriptDir 'stop.bat'
if (($Clean -or $Web) -and -not (Test-Path -LiteralPath $StopBat)) {
    throw "stop.bat nicht gefunden: $StopBat"
}

if ($Clean) {
    Write-Host '--- CLEAN: stoppe ALLES ---'
    & $StopBat /nopause
    $stopExitCode = $LASTEXITCODE
    if ($stopExitCode -ne 0) {
        throw "stop.bat /nopause fehlgeschlagen (ExitCode=$stopExitCode). Start wird abgebrochen, um Port-/Prozesskonflikte zu vermeiden."
    }
}
elseif ($Web) {
    Write-Host '--- WEB: stoppe nur Caddy + PHP ---'
    & $StopBat /web /nopause
    $stopExitCode = $LASTEXITCODE
    if ($stopExitCode -ne 0) {
        throw "stop.bat /web /nopause fehlgeschlagen (ExitCode=$stopExitCode). Start wird abgebrochen, um Port-/Prozesskonflikte zu vermeiden."
    }
}

# ============================================================
# EXECUTABLE PATHS
# ============================================================
$CaddyExe  = Join-Path $BaseDir 'caddy_windows_amd64.exe'
$CaddyFile = Join-Path $BaseDir 'Caddy\Caddyfile'

$PhpExe    = Join-Path $BaseDir 'php\php-cgi.exe'
$PhpIni    = Join-Path $BaseDir 'php\php.ini'

$BridgeExe = Join-Path $BaseDir 'booth\tools\camerabridge\APIServer\Photobox.Bridge.ApiServer.exe'
$PyExe     = Join-Path $BaseDir 'booth\tools\python_portable\python.exe'
$PyServer  = Join-Path $BaseDir 'booth\tools\python_portable\python_server.py'

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
        return '"' + ($Value -replace '"', '\\"') + '"'
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
$env:CADDY_DATA_DIR   = Join-Path $BaseDir 'Caddy\data'
$env:CADDY_CONFIG_DIR = Join-Path $BaseDir 'Caddy\config'
$env:XDG_CACHE_HOME   = Join-Path $BaseDir 'Caddy\cache'

# PHP hart auf lokale Installation festnageln
$env:PHPRC            = Split-Path $PhpIni
$env:PHP_INI_SCAN_DIR = ''
$env:PHP_FCGI_MAX_REQUESTS = '0'

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
$ProjectLogDir = Join-Path $BaseDir 'logs'
New-Item -ItemType Directory -Force -Path $ProjectLogDir | Out-Null

# ============================================================
# START-MODUS INFO
# ============================================================
if ($Clean) {
    Write-Host '[MODE] CLEAN'
}
elseif ($Web) {
    Write-Host '[MODE] WEB'
}
else {
    Write-Host '[MODE] NORMAL'
}

# ============================================================
# CADDY VALIDATE + START
# ============================================================
$CaddyArgs = @(
    'run',
    '--config', $CaddyFile,
    '--adapter', 'caddyfile'
)

Write-Host '[CHECK] Caddyfile validate'
& $CaddyExe validate --config $CaddyFile --adapter caddyfile
if ($LASTEXITCODE -ne 0) {
    throw 'Caddyfile ist ungültig (validate fehlgeschlagen).'
}

Start-Once `
    -Exe $CaddyExe `
    -Args $CaddyArgs `
    -WorkDir $BaseDir

Start-Sleep -Seconds 2

# ============================================================
# PHP START (mit bereinigtem PATH nur für php-cgi.exe)
# ============================================================
$PhpArgs = @(
    '-c', $PhpIni,
    '-b', "127.0.0.1:$PhpPort"
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
        'PATH'             = $CleanPhpPath
        'PHPRC'            = (Split-Path $PhpIni)
        'PHP_INI_SCAN_DIR' = ''
    } `
    -EnvironmentRemove @('PHP')

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
        Write-Warning 'Python oder python_server.py nicht gefunden.'
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
            '--kiosk', $url,
            '--edge-kiosk-type=fullscreen',
            '--no-first-run'
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
Write-Host '=== START fertig ==='
Write-Host "Caddy : http://127.0.0.1:$CaddyPort/"
Write-Host "PHP   : 127.0.0.1:$PhpPort"
Write-Host "Bridge: 127.0.0.1:$BridgePort"
Write-Host "PyAPI : 127.0.0.1:$PyPort"

if (-not $NoPause) {
    Read-Host 'Taste drücken...'
}

exit 0
