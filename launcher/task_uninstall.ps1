param(
  [Parameter(Mandatory = $true)]
  [string]$TaskNameFile               # launcher\watchdog_taskname.txt
)

$ErrorActionPreference = 'Stop'

# ---------------- helpers ----------------

function Write-JsonAndExit([hashtable]$obj, [int]$code) {
  try {
    [Console]::Out.WriteLine(
      ([pscustomobject]$obj | ConvertTo-Json -Compress -Depth 10)
    )
  } catch {
    [Console]::Out.WriteLine(
      '{"allOk":false,"error":"json serialization failed"}'
    )
  }
  exit $code
}

function Add-Step($steps, [string]$name, [bool]$ok, [string]$msg = "") {
  $steps.Add([pscustomobject]@{
    step = $name
    ok   = $ok
    msg  = $msg
  }) | Out-Null
}

# ---------------- main ----------------

try {
  Import-Module ScheduledTasks -ErrorAction Stop

  # --- Read TaskName ---
  if (-not (Test-Path -LiteralPath $TaskNameFile)) {
    Write-JsonAndExit @{
      allOk = $false
      error = "watchdog_taskname.txt missing"
      path  = $TaskNameFile
    } 2
  }

  $raw = (Get-Content -LiteralPath $TaskNameFile -Raw).Trim()
  if ([string]::IsNullOrWhiteSpace($raw)) {
    Write-JsonAndExit @{
      allOk = $false
      error = "TaskName leer in watchdog_taskname.txt"
    } 2
  }

  # --- Split TaskPath / TaskName ---
  $taskPath = "\"
  $taskNameOnly = $raw.TrimStart("\")

  if ($raw.StartsWith("\")) {
    $idx = $raw.LastIndexOf("\")
    if ($idx -gt 0) {
      $taskPath     = $raw.Substring(0, $idx + 1)
      $taskNameOnly = $raw.Substring($idx + 1)
    }
  }

  $steps = New-Object 'System.Collections.Generic.List[object]'
  Add-Step $steps "taskName" $true "$taskPath$taskNameOnly"

  # --- Exists? ---
  $exists = $true
  try {
    $null = Get-ScheduledTask `
      -TaskName $taskNameOnly `
      -TaskPath $taskPath `
      -ErrorAction Stop
    Add-Step $steps "query" $true ""
  } catch {
    $exists = $false
    Add-Step $steps "query" $false "task not found"
  }

  if (-not $exists) {
    Add-Step $steps "verify" $true "task not present / nothing to remove"
    Write-JsonAndExit @{
      allOk    = $true
      task     = $raw
      taskName = $taskNameOnly
      taskPath = $taskPath
      removed  = $false
      steps    = $steps
    } 0
  }

  # --- Disable (best effort) ---
  try {
    Disable-ScheduledTask `
      -TaskName $taskNameOnly `
      -TaskPath $taskPath `
      -ErrorAction Stop | Out-Null
    Add-Step $steps "disable" $true ""
  } catch {
    Add-Step $steps "disable" $false $_.Exception.Message
  }

  # --- Stop (best effort) ---
  try {
    Stop-ScheduledTask `
      -TaskName $taskNameOnly `
      -TaskPath $taskPath `
      -ErrorAction Stop
    Add-Step $steps "stop" $true ""
  } catch {
    Add-Step $steps "stop" $false $_.Exception.Message
  }

  # --- Unregister ---
  try {
    Unregister-ScheduledTask `
      -TaskName $taskNameOnly `
      -TaskPath $taskPath `
      -Confirm:$false `
      -ErrorAction Stop
    Add-Step $steps "unregister" $true ""
  } catch {
    Add-Step $steps "unregister" $false $_.Exception.Message
    Write-JsonAndExit @{
      allOk    = $false
      error    = "Unregister-ScheduledTask failed"
      task     = $raw
      taskName = $taskNameOnly
      taskPath = $taskPath
      steps    = $steps
    } 4
  }

  # --- Verify ---
  $stillThere = $false
  try {
    $null = Get-ScheduledTask `
      -TaskName $taskNameOnly `
      -TaskPath $taskPath `
      -ErrorAction Stop
    $stillThere = $true
  } catch {}

  if ($stillThere) {
    Add-Step $steps "verify" $false "Task still exists"
    Write-JsonAndExit @{
      allOk    = $false
      error    = "Verify failed"
      task     = $raw
      taskName = $taskNameOnly
      taskPath = $taskPath
      steps    = $steps
    } 5
  }

  Add-Step $steps "verify" $true ""

  # --- Final JSON ---
  Write-JsonAndExit @{
    allOk    = $true
    task     = $raw
    taskName = $taskNameOnly
    taskPath = $taskPath
    steps    = $steps
  } 0
}
catch {
  Write-JsonAndExit @{
    allOk = $false
    error = $_.Exception.Message
  } 2
}
