$ErrorActionPreference = 'SilentlyContinue'

$scriptDir = $PSScriptRoot
$flagDir = Join-Path $scriptDir 'Watchdog_flags'
$stopFile = Join-Path $flagDir 'watchdog.stop'
$statusFile = Join-Path $flagDir 'last_action.txt'
$taskFile = Join-Path $scriptDir 'watchdog_taskname.txt'

New-Item -ItemType Directory -Path $flagDir -Force | Out-Null
Remove-Item -LiteralPath $stopFile -Force -ErrorAction SilentlyContinue

if (-not (Test-Path -LiteralPath $taskFile -PathType Leaf)) {
    Set-Content -LiteralPath $statusFile -Value 'TASKNAME_FILE_MISSING' -NoNewline
    exit 4
}

$taskName = (Get-Content -LiteralPath $taskFile -TotalCount 1).Trim()
if ([string]::IsNullOrWhiteSpace($taskName)) {
    Set-Content -LiteralPath $statusFile -Value 'TASKNAME_EMPTY' -NoNewline
    exit 5
}

& schtasks.exe /query /tn $taskName *> $null
if ($LASTEXITCODE -ne 0) {
    Set-Content -LiteralPath $statusFile -Value 'TASK_NOT_FOUND' -NoNewline
    exit 3
}

& schtasks.exe /run /tn $taskName *> $null
if ($LASTEXITCODE -ne 0) {
    Set-Content -LiteralPath $statusFile -Value 'START_FAILED' -NoNewline
    exit 2
}

Start-Sleep -Seconds 2

Import-Module ScheduledTasks -ErrorAction SilentlyContinue
$task = Get-ScheduledTask -ErrorAction SilentlyContinue |
    Where-Object { ($_.TaskPath + $_.TaskName) -ieq $taskName -or $_.TaskName -ieq $taskName.TrimStart('\') } |
    Select-Object -First 1

if ($task -and [string]$task.State -ieq 'Running') {
    Set-Content -LiteralPath $statusFile -Value 'STARTED' -NoNewline
    exit 0
}

Set-Content -LiteralPath $statusFile -Value 'START_TRIGGERED' -NoNewline
exit 1
