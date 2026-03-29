<# 
  reset_windows_1-4.ps1
  Macht die Änderungen aus disable_windows_1-4.ps1 rückgängig (Standard / nicht konfiguriert):
   1) Lock Screen Policy zurücksetzen        -> NoLockScreen löschen
   2) Consumer Features Policy zurücksetzen  -> DisableWindowsConsumerFeatures löschen
   3) Toast-Benachrichtigungen User zurück   -> ToastEnabled löschen (HKCU)
   4) Toast-Policy zurücksetzen              -> NoToastApplicationNotification löschen

  Hinweis:
   - Für 1,2,4 brauchst du Admin-Rechte.
   - Punkt 3 (HKCU) wirkt nur für den Benutzer, unter dem das Script läuft.
   - Wenn Domain/MDM/GPO etwas erzwingt, können Werte nachher wieder gesetzt werden.
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

function Remove-Value([string]$path, [string]$name) {
  if (Test-Path -LiteralPath $path) {
    $has = Get-ItemProperty -LiteralPath $path -Name $name -ErrorAction SilentlyContinue
    if ($null -ne $has) {
      Remove-ItemProperty -LiteralPath $path -Name $name -ErrorAction Stop
      return $true
    }
  }
  return $false
}

function Cleanup-EmptyKey([string]$path) {
  if (-not (Test-Path -LiteralPath $path)) { return }

  # Wenn keine Werte und keine Subkeys -> Key entfernen
  $item = Get-Item -LiteralPath $path -ErrorAction SilentlyContinue
  if ($null -eq $item) { return }

  $valueNames = @()
  try { $valueNames = $item.Property } catch { $valueNames = @() }

  $subKeys = @()
  try { $subKeys = Get-ChildItem -LiteralPath $path -ErrorAction SilentlyContinue } catch { $subKeys = @() }

  if (($valueNames.Count -eq 0) -and ($subKeys.Count -eq 0)) {
    Remove-Item -LiteralPath $path -Force -ErrorAction SilentlyContinue
  }
}

Write-Host "=== Windows Tweaks Reset 1-4 (Registry) ==="
Write-Host "User: $env:USERNAME"
Write-Host "Admin: $(Test-IsAdmin)"
Write-Host ""

$admin = Test-IsAdmin
$hadErrors = $false

# -------------------- 1) Lock Screen Policy zurücksetzen --------------------
try {
  if ($admin) {
    $k1 = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\Personalization"
    $changed = Remove-Value $k1 "NoLockScreen"
    if ($changed) {
      Write-Host "[1] OK   NoLockScreen entfernt ($k1)"
    } else {
      Write-Host "[1] OK   NoLockScreen nicht vorhanden ($k1)"
    }
    Cleanup-EmptyKey $k1
  } else {
    Write-Host "[1] SKIP (kein Admin) -> braucht HKLM Policy Key"
  }
} catch {
  $hadErrors = $true
  Write-Host "[1] FAIL $($_.Exception.Message)"
}

# -------------------- 2) Consumer Features Policy zurücksetzen --------------------
try {
  if ($admin) {
    $k2 = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CloudContent"
    $changed = Remove-Value $k2 "DisableWindowsConsumerFeatures"
    if ($changed) {
      Write-Host "[2] OK   DisableWindowsConsumerFeatures entfernt ($k2)"
    } else {
      Write-Host "[2] OK   DisableWindowsConsumerFeatures nicht vorhanden ($k2)"
    }
    Cleanup-EmptyKey $k2
  } else {
    Write-Host "[2] SKIP (kein Admin) -> braucht HKLM Policy Key"
  }
} catch {
  $hadErrors = $true
  Write-Host "[2] FAIL $($_.Exception.Message)"
}

# -------------------- 3) Toasts User zurücksetzen (HKCU) --------------------
try {
  $k3 = "HKCU:\Software\Microsoft\Windows\CurrentVersion\PushNotifications"
  $changed = Remove-Value $k3 "ToastEnabled"
  if ($changed) {
    Write-Host "[3] OK   ToastEnabled entfernt ($k3)  (nur aktueller Benutzer)"
  } else {
    Write-Host "[3] OK   ToastEnabled nicht vorhanden ($k3)  (nur aktueller Benutzer)"
  }
  Cleanup-EmptyKey $k3
} catch {
  $hadErrors = $true
  Write-Host "[3] FAIL $($_.Exception.Message)"
}

# -------------------- 4) Toasts Policy zurücksetzen (HKLM) --------------------
try {
  if ($admin) {
    $k4 = "HKLM:\SOFTWARE\Policies\Microsoft\Windows\CurrentVersion\PushNotifications"
    $changed = Remove-Value $k4 "NoToastApplicationNotification"
    if ($changed) {
      Write-Host "[4] OK   NoToastApplicationNotification entfernt ($k4)"
    } else {
      Write-Host "[4] OK   NoToastApplicationNotification nicht vorhanden ($k4)"
    }
    Cleanup-EmptyKey $k4
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
