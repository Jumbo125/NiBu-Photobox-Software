<# 
  disable_windows_1-4.ps1
  Erledigt:
   1) Lock Screen deaktivieren (Policy)
   2) Microsoft Consumer Features deaktivieren (Policy)
   3) Toast-Benachrichtigungen aus (HKCU)
   4) Toast-Benachrichtigungen per Policy sperren (HKLM)

  Hinweis:
   - Für 1,2,4 brauchst du Admin-Rechte.
   - Punkt 3 (HKCU) wirkt nur für den Benutzer, unter dem das Script läuft.
#>

[CmdletBinding()]
param(
  [switch]$NoPause
)

$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
  $id = [Security.Principal.WindowsIdentity]::GetCurrent()
  $p  = New-Object Security.Principal.WindowsPrincipal($id)
  return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Ensure-Key([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) {
    New-Item -Path $path -Force | Out-Null
  }
}

function Set-Dword([string]$path, [string]$name, [int]$value) {
  Ensure-Key $path
  New-ItemProperty -Path $path -Name $name -PropertyType DWord -Value $value -Force | Out-Null
}

Write-Host "=== Windows Tweaks 1-4 (Registry) ==="
Write-Host "User: $env:USERNAME"
Write-Host "Admin: $(Test-IsAdmin)"
Write-Host ""

$admin = Test-IsAdmin
$hadErrors = $false

# -------------------- 1) Lock Screen deaktivieren --------------------
try {
  if ($admin) {
    $k1 = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization"
    Set-Dword $k1 "NoLockScreen" 1
    Write-Host "[1] OK   NoLockScreen=1 ($k1)"
  } else {
    Write-Host "[1] SKIP (kein Admin) -> braucht HKLM Policy Key"
  }
} catch {
  $hadErrors = $true
  Write-Host "[1] FAIL $($_.Exception.Message)"
}

# -------------------- 2) Consumer Features deaktivieren --------------------
try {
  if ($admin) {
    $k2 = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
    Set-Dword $k2 "DisableWindowsConsumerFeatures" 1
    Write-Host "[2] OK   DisableWindowsConsumerFeatures=1 ($k2)"
  } else {
    Write-Host "[2] SKIP (kein Admin) -> braucht HKLM Policy Key"
  }
} catch {
  $hadErrors = $true
  Write-Host "[2] FAIL $($_.Exception.Message)"
}

# -------------------- 3) Toasts aus (HKCU) --------------------
try {
  $k3 = "HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications"
  Set-Dword $k3 "ToastEnabled" 0
  Write-Host "[3] OK   ToastEnabled=0 ($k3)  (nur aktueller Benutzer)"
} catch {
  $hadErrors = $true
  Write-Host "[3] FAIL $($_.Exception.Message)"
}

# -------------------- 4) Toasts per Policy sperren (HKLM) --------------------
try {
  if ($admin) {
    $k4 = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CurrentVersion\PushNotifications"
    Set-Dword $k4 "NoToastApplicationNotification" 1
    Write-Host "[4] OK   NoToastApplicationNotification=1 ($k4)"
  } else {
    Write-Host "[4] SKIP (kein Admin) -> braucht HKLM Policy Key"
  }
} catch {
  $hadErrors = $true
  Write-Host "[4] FAIL $($_.Exception.Message)"
}

Write-Host ""
Write-Host "Fertig. Hinweis: Manche Policy-Änderungen greifen erst nach Ab-/Anmelden oder Neustart."

if (-not $NoPause) {
  Write-Host ""
  Read-Host "ENTER zum Schließen"
}

if ($hadErrors) { exit 1 } else { exit 0 }
