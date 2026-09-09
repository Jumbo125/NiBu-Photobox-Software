param(
    [Parameter(Mandatory = $true)]
    [string]$TaskName
)

$ErrorActionPreference = 'SilentlyContinue'
Import-Module ScheduledTasks -ErrorAction SilentlyContinue

$task = Get-ScheduledTask -ErrorAction SilentlyContinue |
    Where-Object { ($_.TaskPath + $_.TaskName) -ieq $TaskName -or $_.TaskName -ieq $TaskName.TrimStart('\') } |
    Select-Object -First 1

if ($task) {
    [Console]::Out.WriteLine([string]$task.State)
} else {
    [Console]::Out.WriteLine('UNKNOWN')
}
