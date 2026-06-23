param(
    [Parameter(Mandatory = $true)]
    [string]$BaseDir,

    [switch]$NoPause
)

$Debug = $false

$ErrorActionPreference = 'Stop'

$BaseDir   = ([System.IO.Path]::GetFullPath($BaseDir) -replace '[\\/ ]+$', '')
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RunIdentity = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$RunSessionName = $env:SESSIONNAME
Write-Host "RunAs : $RunIdentity"
Write-Host "Session: $RunSessionName"

if ([string]::IsNullOrWhiteSpace($RunIdentity) -or $RunIdentity -ieq 'NT AUTHORITY\SYSTEM' -or $RunIdentity.Trim().EndsWith('$')) {
    Write-Warning "start_only_web.ps1 laeuft nicht im sichtbaren Benutzerkontext. GUI-Aktionen wie Druckerdialoge koennen so nicht angezeigt werden."
}

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

$LoadedPorts = Get-EffectivePorts -LauncherDir $ScriptDir -BaseDir $BaseDir -WarnOnMismatch
$CaddyPort   = [int]$LoadedPorts.CaddyPort
$PhpPort     = [int]$LoadedPorts.PhpPort
$BridgePort  = [int]$LoadedPorts.BridgePort
$PyPort      = [int]$LoadedPorts.PyPort

Write-Host "=== NiBu START WEB-ONLY (PS1) ==="
Write-Host "BaseDir: $BaseDir"
Write-Host "Flags: NoPause=$NoPause"
Write-Host "Debug: $Debug"
Write-Host "Ports: Caddy=$CaddyPort PHP=$PhpPort Bridge=$BridgePort Python=$PyPort"

$BackendWindowStyle = if ($Debug) { 'Normal' } else { 'Minimized' }
Write-Host "WindowStyle: $BackendWindowStyle"

$StopBat = Join-Path $ScriptDir 'stop.bat'
if (-not (Test-Path -LiteralPath $StopBat)) {
    throw "stop.bat nicht gefunden: $StopBat"
}

Write-Host "--- WEB-ONLY: stoppe nur Caddy + PHP ---"
& $StopBat /web /nopause
$stopExitCode = $LASTEXITCODE
if ($stopExitCode -ne 0) {
    throw "stop.bat /web /nopause fehlgeschlagen (ExitCode=$stopExitCode). Start wird abgebrochen."
}

$CaddyExe  = Join-Path $BaseDir 'caddy_windows_amd64.exe'
$Caddyfile = Join-Path $BaseDir 'Caddy\Caddyfile'
$PhpExe    = Join-Path $BaseDir 'php\php-cgi.exe'
$PhpIni    = Join-Path $BaseDir 'php\php.ini'

if (-not (Test-Path -LiteralPath $CaddyExe))   { throw "Caddy executable nicht gefunden: $CaddyExe" }
if (-not (Test-Path -LiteralPath $Caddyfile)) { throw "Caddyfile nicht gefunden: $Caddyfile" }
if (-not (Test-Path -LiteralPath $PhpExe))    { throw "PHP CGI executable nicht gefunden: $PhpExe" }
if (-not (Test-Path -LiteralPath $PhpIni))    { throw "php.ini nicht gefunden: $PhpIni" }

function Normalize-PathSafe {
    param(
        [Parameter(Mandatory)]
        [string]$Path
    )

    try { return [System.IO.Path]::GetFullPath($Path) }
    catch { return $Path }
}

function Get-ProcessByExactPath {
    param(
        [Parameter(Mandatory)]
        [string]$ExePath
    )

    if (-not (Test-Path -LiteralPath $ExePath)) { return @() }

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

function Start-Once {
    param(
        [Parameter(Mandatory)]
        [string]$Exe,

        [string[]]$Args,

        [string]$MatchName,

        [Parameter(Mandatory)]
        [string]$WorkDir,

        [ValidateSet('Normal','Hidden','Minimized','Maximized')]
        [string]$WindowStyle = 'Minimized'
    )

    if (-not (Test-Path -LiteralPath $Exe)) {
        Write-Warning "Executable nicht gefunden: $Exe"
        return
    }

    if ($MatchName) {
        $procName = [System.IO.Path]::GetFileNameWithoutExtension($MatchName)
        $running = Get-Process -Name $procName -ErrorAction SilentlyContinue
        if ($running) {
            Write-Host "[OK] $MatchName läuft bereits"
            return
        }
    }
    else {
        $already = @(Get-ProcessByExactPath -ExePath $Exe)
        if ($already.Count -gt 0) {
            Write-Host "[OK] Läuft bereits: $Exe"
            return
        }
    }

    Write-Host "[START] $Exe"
    if ($Args -and $Args.Count -gt 0) {
        Write-Host "        Args: $($Args -join ' ')"
        Start-Process -FilePath $Exe -ArgumentList $Args -WorkingDirectory $WorkDir -WindowStyle $WindowStyle
    }
    else {
        Start-Process -FilePath $Exe -WorkingDirectory $WorkDir -WindowStyle $WindowStyle
    }
}

$env:HOME        = $BaseDir
$env:CADDY_PORT  = [string]$CaddyPort
$env:PHP_PORT    = [string]$PhpPort
$env:BRIDGE_PORT = [string]$BridgePort
$env:PY_PORT     = [string]$PyPort

$env:CADDY_DATA_DIR   = Join-Path $BaseDir 'Caddy\data'
$env:CADDY_CONFIG_DIR = Join-Path $BaseDir 'Caddy\config'
$env:XDG_CACHE_HOME   = Join-Path $BaseDir 'Caddy\cache'
$env:CADDY_LOG_LEVEL  = 'DEBUG'

New-Item -ItemType Directory -Force -Path `
    $env:CADDY_DATA_DIR,
    $env:CADDY_CONFIG_DIR,
    $env:XDG_CACHE_HOME | Out-Null

Write-Host '[MODE] WEB-ONLY'

Start-Once `
    -Exe $CaddyExe `
    -Args @('run','--config',$Caddyfile,'--adapter','caddyfile') `
    -MatchName 'caddy_windows_amd64.exe' `
    -WorkDir $BaseDir `
    -WindowStyle $BackendWindowStyle

Start-Sleep -Seconds 2

$oldPath = $env:PATH
$oldPhprc = $env:PHPRC
$oldScan = $env:PHP_INI_SCAN_DIR

try {
    $cleanPhpPath = @(
        (Split-Path $PhpExe),
        "$env:SystemRoot\System32",
        "$env:SystemRoot"
    ) -join ';'

    $env:PATH = $cleanPhpPath
    $env:PHPRC = Split-Path $PhpIni
    $env:PHP_INI_SCAN_DIR = ''

    Write-Host "[PHP ENV] Clean PATH = $cleanPhpPath"

    Start-Once `
        -Exe $PhpExe `
        -Args @('-c',$PhpIni,'-b',"127.0.0.1:$PhpPort") `
        -MatchName 'php-cgi.exe' `
        -WorkDir (Split-Path $PhpExe) `
        -WindowStyle $BackendWindowStyle
}
finally {
    $env:PATH = $oldPath
    if ($null -ne $oldPhprc) { $env:PHPRC = $oldPhprc } else { Remove-Item Env:PHPRC -ErrorAction SilentlyContinue }
    if ($null -ne $oldScan) { $env:PHP_INI_SCAN_DIR = $oldScan } else { Remove-Item Env:PHP_INI_SCAN_DIR -ErrorAction SilentlyContinue }
}

Write-Host '[WEB-ONLY] done -> exit'

if (-not $NoPause) {
    Read-Host 'Taste drücken...'
}

exit 0
