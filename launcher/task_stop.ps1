$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = $PSScriptRoot
$flagDir = Join-Path $scriptDir 'Watchdog_flags'
$stopFile = Join-Path $flagDir 'watchdog.stop'
$statusFile = Join-Path $flagDir 'last_action.txt'
$taskFile = Join-Path $scriptDir 'watchdog_taskname.txt'

New-Item -ItemType Directory -Path $flagDir -Force | Out-Null
Set-Content -LiteralPath $stopFile -Value 'stop' -NoNewline

Start-Sleep -Seconds 2

if (-not (Test-Path -LiteralPath $taskFile -PathType Leaf)) {
    Set-Content -LiteralPath $statusFile -Value 'STOP_SIGNAL_WRITTEN' -NoNewline
    exit 0
}

$taskName = (Get-Content -LiteralPath $taskFile -TotalCount 1).Trim()
if ([string]::IsNullOrWhiteSpace($taskName)) {
    Set-Content -LiteralPath $statusFile -Value 'STOP_SIGNAL_WRITTEN' -NoNewline
    exit 0
}

Import-Module ScheduledTasks -ErrorAction SilentlyContinue
$task = Get-ScheduledTask -ErrorAction SilentlyContinue |
    Where-Object { ($_.TaskPath + $_.TaskName) -ieq $taskName -or $_.TaskName -ieq $taskName.TrimStart('\') } |
    Select-Object -First 1

if ($task -and [string]$task.State -ieq 'Running') {
    Set-Content -LiteralPath $statusFile -Value 'STOP_PENDING' -NoNewline
    exit 1
}

if (-not $task) {
    Set-Content -LiteralPath $statusFile -Value 'STOP_SIGNAL_WRITTEN' -NoNewline
    exit 0
}

Set-Content -LiteralPath $statusFile -Value 'STOPPED' -NoNewline
exit 0
