param(
    [Parameter(Mandatory = $true)]
    [string]$BaseDir,

    [switch]$Web,
    [switch]$NoPause
)

$ErrorActionPreference = 'Stop'

$BaseDir = ([System.IO.Path]::GetFullPath($BaseDir) -replace '[\\/ ]+$', '')
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "DEBUG: Web=$Web NoPause=$NoPause"
Write-Host "=== NiBu Backend STOP ==="
Write-Host "BaseDir: $BaseDir"
Write-Host "Mode: $(if ($Web) { 'WEB (nur PHP + Caddy)' } else { 'FULL' })"

try {
    $identity  = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    $IsAdmin   = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}
catch {
    $IsAdmin = $false
}

Write-Host "Admin : $IsAdmin"

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

# ============================================================
# EXECUTABLE PATHS
# ============================================================
$CaddyExe  = Join-Path $BaseDir "caddy_windows_amd64.exe"

$PhpExe    = Join-Path $BaseDir "php\php-cgi.exe"
$PhpCliExe = Join-Path $BaseDir "php\php.exe"

$BridgeExe = Join-Path $BaseDir "booth\tools\camerabridge\APIServer\Photobox.Bridge.ApiServer.exe"
$PyExe     = Join-Path $BaseDir "booth\tools\python_portable\python.exe"
$PyServer  = Join-Path $BaseDir "booth\tools\python_portable\python_server.py"

$DevDir       = Join-Path $BaseDir "DEV"
$ProcDumpDir  = Join-Path $DevDir "ProcDump"
$ProcDumpExes = @(
    (Join-Path $ProcDumpDir "procdump.exe"),
    (Join-Path $ProcDumpDir "procdump64.exe"),
    (Join-Path $ProcDumpDir "procdump64a.exe")
)

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

function Stop-ProcessesByExactPath {
    param(
        [Parameter(Mandatory)]
        [string]$Label,

        [Parameter(Mandatory)]
        [string[]]$ExePaths
    )

    Write-Host $Label

    $foundAny = $false

    foreach ($exe in $ExePaths) {
        $procs = @(Get-ProcessByExactPath -ExePath $exe)

        foreach ($p in $procs) {
            $foundAny = $true
            try {
                Write-Host ("    STOP PID={0} NAME={1} PATH={2}" -f $p.Id, $p.ProcessName, $p.Path)
                Stop-Process -Id $p.Id -Force -ErrorAction Stop
            }
            catch {
                Write-Warning ("    Konnte PID {0} nicht stoppen: {1}" -f $p.Id, $_.Exception.Message)
            }
        }
    }

    if (-not $foundAny) {
        Write-Host "    nichts gefunden"
    }
}

function Stop-ProcessesByName {
    param(
        [Parameter(Mandatory)]
        [string]$Label,

        [Parameter(Mandatory)]
        [string[]]$Names
    )

    Write-Host $Label

    $procs = @(Get-Process -Name $Names -ErrorAction SilentlyContinue)
    if (-not $procs -or $procs.Count -eq 0) {
        Write-Host "    nichts gefunden"
        return
    }

    foreach ($p in $procs) {
        try {
            $pathText = ''
            try { if ($p.Path) { $pathText = " PATH=$($p.Path)" } } catch {}
            Write-Host ("    STOP PID={0} NAME={1}{2}" -f $p.Id, $p.ProcessName, $pathText)
            Stop-Process -Id $p.Id -Force -ErrorAction Stop
        }
        catch {
            Write-Warning ("    Konnte PID {0} nicht stoppen: {1}" -f $p.Id, $_.Exception.Message)
        }
    }
}

function Stop-ProcessByPorts {
    param(
        [Parameter(Mandatory)]
        [string]$Label,

        [Parameter(Mandatory)]
        [int[]]$Ports
    )

    Write-Host $Label

    $TargetProcIds = @()
    foreach ($port in $Ports) {
        try {
            $hits = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty OwningProcess -Unique)
            if ($hits) {
                $TargetProcIds += $hits
            }
        }
        catch {
        }
    }

    $TargetProcIds = @($TargetProcIds | Where-Object { $_ } | Sort-Object -Unique)

    if (-not $TargetProcIds -or $TargetProcIds.Count -eq 0) {
        Write-Host "    nichts gefunden"
        return
    }

    foreach ($TargetProcId in $TargetProcIds) {
        try {
            $p = Get-Process -Id $TargetProcId -ErrorAction SilentlyContinue
            if ($p) {
                $pathText = ''
                try { if ($p.Path) { $pathText = " PATH=$($p.Path)" } } catch {}
                Write-Host ("    STOP PID={0} NAME={1}{2}" -f $p.Id, $p.ProcessName, $pathText)
            }
            else {
                Write-Host ("    STOP PID={0}" -f $TargetProcId)
            }
            Stop-Process -Id $TargetProcId -Force -ErrorAction Stop
        }
        catch {
            Write-Warning ("    Konnte PID {0} nicht stoppen: {1}" -f $TargetProcId, $_.Exception.Message)
        }
    }
}

function Stop-PythonServerByCommandLine {
    param(
        [Parameter(Mandatory)]
        [string]$ScriptPath
    )

    Write-Host "[6] Python Server (python_server.py)"

    $normalizedScript = (Normalize-PathSafe $ScriptPath).ToLowerInvariant()
    $normalizedScriptAlt = $normalizedScript -replace '\\', '/'

    $targets = @(
        Get-CimInstance Win32_Process -ErrorAction SilentlyContinue | Where-Object {
            if (-not $_.CommandLine) { return $false }

            $cmd = $_.CommandLine.ToLowerInvariant()
            $cmdAlt = $cmd -replace '\\', '/'

            ($cmd -like "*python_server.py*") -or
            ($cmd -like "*$normalizedScript*") -or
            ($cmdAlt -like "*$normalizedScriptAlt*")
        }
    )

    if (-not $targets -or $targets.Count -eq 0) {
        Write-Host "    nichts gefunden"
        return
    }

    foreach ($proc in $targets) {
        try {
            Write-Host ("    STOP PID={0} CMD={1}" -f $proc.ProcessId, $proc.CommandLine)
            Stop-Process -Id $proc.ProcessId -Force -ErrorAction Stop
        }
        catch {
            Write-Warning ("    Konnte PID {0} nicht stoppen: {1}" -f $proc.ProcessId, $_.Exception.Message)
        }
    }
}

function Show-PortStatus {
    param(
        [Parameter(Mandatory)]
        [int[]]$Ports
    )

    Write-Host "--- Ports pruefen ---"

    foreach ($port in $Ports) {
        $hits = @(Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue)
        if (-not $hits -or $hits.Count -eq 0) {
            Write-Host "Port $port ist frei"
            continue
        }

        foreach ($hit in $hits) {
            $OwningProcId = $hit.OwningProcess
            $line = "Port $port ist noch aktiv (PID=$OwningProcId)"

            try {
                $proc = Get-Process -Id $OwningProcId -ErrorAction SilentlyContinue
                if ($proc) {
                    $si = $null
                    try { $si = $proc.SessionId } catch {}

                    if ($si -ne $null) {
                        $line += " NAME=$($proc.ProcessName) SI=$si"
                    }
                    else {
                        $line += " NAME=$($proc.ProcessName)"
                    }
                }
            }
            catch {
            }

            Write-Warning $line
        }
    }
}

# ============================================================
# STOP LOGIK
# ============================================================
Stop-ProcessesByExactPath -Label "[1] ProcDump (DEV optional)" -ExePaths $ProcDumpExes

Stop-ProcessesByExactPath -Label "[2] Caddy (exakter Pfad)" -ExePaths @($CaddyExe)
Stop-ProcessByPorts      -Label "[3] Caddy (Port-Fallback)" -Ports @($CaddyPort)

Stop-ProcessesByExactPath -Label "[4] PHP (exakter Pfad)" -ExePaths @($PhpExe, $PhpCliExe)
Stop-ProcessByPorts       -Label "[5] PHP (Port-Fallback)" -Ports @($PhpPort)

if (-not $Web) {
    Stop-ProcessesByExactPath -Label "[6] Bridge (exakter Pfad)" -ExePaths @($BridgeExe)
    Stop-ProcessByPorts       -Label "[7] Bridge (Port-Fallback)" -Ports @($BridgePort)

    Stop-ProcessesByName      -Label "[8] Worker (Name-Fallback)" -Names @("CameraWorker", "worker")

    Stop-PythonServerByCommandLine -ScriptPath $PyServer
    Stop-ProcessByPorts            -Label "[9] Python (Port-Fallback)" -Ports @($PyPort)
}

Start-Sleep -Seconds 1

# ============================================================
# PORTS PRUEFEN
# ============================================================
Show-PortStatus -Ports @($CaddyPort, $PhpPort, $BridgePort, $PyPort)

if (-not $IsAdmin) {
    Write-Warning "Diese Stop-Instanz laeuft nicht als Administrator. Wenn noch Prozesse auf Session 0 / SYSTEM laufen, bitte stop.bat bzw. PowerShell einmal 'Als Administrator' starten oder ueber denselben Task-/SYSTEM-Kontext stoppen."
}

Write-Host "=== STOP fertig ==="
if (-not $NoPause) {
    Read-Host "Taste drücken..."
}

exit 0