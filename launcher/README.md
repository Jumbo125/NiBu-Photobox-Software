# NiBu Photobooth Launcher + Watchdog – Ablauf & Dateien

Diese README beschreibt den **kompletten Install-/Start-/Watchdog-Ablauf** des NiBu Photobooth Launchers unter Windows inkl. Port-Handling, Default-Config-Kopie und Status-Checks.

---

## 1) Verzeichnisstruktur (relevant)

```
Photobox\
  launcher.exe
  launcher\
    install.bat
    uninstall.bat
    start.bat
    stop.bat
    unblock.bat
    firewall_install.bat
    firewall_uninstall.bat
    task_install.bat
    task_uninstall.bat
    task_start.bat
    task_stop.bat
    check_install.bat
    check_firewall.bat
    check_task.bat
    ops_manifest.json
    caddy_php_port.json
    port_Settings.json
    install_port.txt
    copy_original_config.bat
    copy_original_config.ps1
    defaultConfig\
      booth\...
  booth\
    config\config\...
    tools\camerabridge\...
    tools\python_portable\...
  logs\
```

> **BaseDir** bedeutet: `Photobox\` (Ordner oberhalb von `launcher\`), also dort wo `launcher.exe` liegt.

---

## 2) Port-Dateien (Single Source)

### 2.1 `launcher\install_port.txt` (von der UI geschrieben)
Wird beim **Full Install** in der Advanced UI erzeugt:

**Format (KEY=VALUE):**
```
CADDY_PORT=8050
PHP_PORT=8051
BRIDGE_PORT=8052
PY_PORT=8053
```

Diese Datei ist die **Übergabe vom UI → install.bat**.

### 2.2 `launcher\caddy_php_port.json` (Caddy/PHP Ports)
Wird von `install.bat` erzeugt:

```json
{ "caddy_port": 8050, "php_port": 8051 }
```

Diese Datei ist die **Single Source** für Caddy/PHP Ports.

### 2.3 `launcher\port_Settings.json` (Bridge/Python Ports)
Wird von `install.bat` oder von `copy_original_config.ps1` gelesen/erstellt.

Empfohlenes Format:

```json
{ "bridge_port": 8052, "python_port": 8053 }
```

**Wichtig:** Bridge/Python Ports werden später **in Ziel-JSONs gepatcht** (nicht in den Default-Dateien).

---

## 3) DefaultConfig-Kopie & Patch (wichtigster Teil)

### Ziel
- **Default-Configs** liegen unter `launcher\defaultConfig\...` (portable, ohne feste Benutzer-Pfade).
- Beim Install werden diese Defaults nach `booth\...` kopiert.
- Danach werden **nur die Ziel-Dateien** gepatcht:
  - `__BASE_DIR__` Platzhalter wird ersetzt
  - Ports (Bridge/Python) werden gesetzt

### Platzhalter für absolute Pfade: `__BASE_DIR__`
In Default-JSONs dürfen keine PC-spezifischen Pfade stehen. Stattdessen:

Beispiel:
```json
"pythonExe": "__BASE_DIR__\\booth\\tools\\python_portable\\python.exe"
```

Beim Install wird `__BASE_DIR__` ersetzt durch den aktuellen `Photobox\` Pfad.

---

## 4) `ops_manifest.json` – Quelle für Kopie & Firewall-Checks

### `configs`
Liste der zu kopierenden Dateien:

- `src` = Default-Datei unter `launcher\defaultConfig\...`
- `dst` = Ziel-Datei unter `booth\...`

Beispiel:
```json
"configs": [
  { "src": "launcher\\defaultConfig\\booth\\config\\config\\config.json",
    "dst": "booth\\config\\config\\config.json" }
]
```

### `firewallRules`
Wird von `check_firewall.bat` verwendet (und kann auch als Grundlage für `firewall_install.bat` dienen).

Beispiel:
```json
"firewallRules": [
  { "name": "Caddy",  "portSource": "caddy_php_port.json:caddy_port", "ruleTemplate": "NiBu Photobooth Caddy ({port})" }
]
```

---

## 5) Install-Ablauf (Full Install)

### 5.1 Advanced UI (Full Install)
1. Benutzer gibt Ports ein (Caddy, PHP, Bridge/API, Python).
2. UI schreibt `launcher\install_port.txt`.
3. UI ruft `launcher\install.bat /nopause`.

### 5.2 `launcher\install.bat`
Reihenfolge (empfohlen):
1. **Ports einlesen** aus `install_port.txt` (falls nicht vorhanden → Defaults).
2. **port-Dateien schreiben**
   - `caddy_php_port.json`
   - `port_Settings.json`
3. **Default-Configs ausrollen**
   - `copy_original_config.bat /nopause`
4. **Unblock**
   - `unblock.bat /nopause`
5. **Firewall**
   - `firewall_install.bat /nopause`
6. **Task Scheduler**
   - `task_install.bat /nopause`

> Optional kann `install.bat` am Ende zusätzlich `task_start.bat` ausführen, um den Watchdog sofort zu starten.

---

## 6) `copy_original_config` (Default-Kopie + Patch)

### 6.1 `copy_original_config.bat`
Wrapper, ruft `copy_original_config.ps1` mit BaseDir/LauncherDir auf.

### 6.2 `copy_original_config.ps1` macht:
1. `ops_manifest.json` laden
2. Alle `configs[].src → configs[].dst` **überschreiben** (Copy-Item -Force)
3. In allen kopierten Ziel-Dateien:
   - `__BASE_DIR__` ersetzen (nur in Ziel-Dateien)
4. Ports patchen (nur Ziel):
   - `booth\tools\camerabridge\APIServer\ApiServer_settings.json` → `Bridge.Port = bridge_port`
   - `booth\tools\python_portable\server_config.json` → `port = bridge_port` und `Python_ServerPort = python_port`

---

## 7) Start/Stop-Ablauf

### 7.1 `start.bat`
- startet Komponenten (Caddy/PHP/Bridge/Python) wenn sie nicht laufen
- kann optional `/clean` nutzen (dann vorher stop)
- Ports kommen aus:
  - Caddy/PHP: `launcher\caddy_php_port.json`
  - Bridge: `booth\tools\camerabridge\APIServer\ApiServer_settings.json`
  - Python: `booth\tools\python_portable\server_config.json`

### 7.2 `stop.bat`
- beendet Caddy, PHP, Bridge, Worker (optional), Python (python_server.py Prozess)
- optional Port-Checks (LISTENING) nach dem Stop

---

## 8) Watchdog (Task Scheduler)

### Ziel
Der Watchdog läuft headless als:
```
launcher.exe --watchdog
```

Er startet das Backend und überwacht Healthchecks. Bei Fehlern führt er Restart aus.

### Task-Steuerung
- `task_install.bat` → Task anlegen (Autostart via Boot/Logon Trigger)
- `task_uninstall.bat` → Task löschen
- `task_start.bat` → Task **enable + run** (startet sofort, bleibt im Scheduler)
- `task_stop.bat` → Task **end + disable** (stoppt sofort, bleibt im Scheduler)

**Wichtig:** `task_stop.bat` löscht den Task NICHT, es stoppt/deaktiviert nur.

---

## 9) Status-Checks (Advanced UI Grid)

### 9.1 Install-Check (`check_install.bat`)
Definiert **installiert** als:  
Alle Dateien aus `ops_manifest.json -> configs[].dst` existieren.

- ExitCode `0` → installiert
- ExitCode `1` → nicht installiert
- ExitCode `2+` → Fehler

### 9.2 Firewall-Check (`check_firewall.bat`)
- liest `firewallRules` aus `ops_manifest.json`
- ermittelt Ports via `portSource`
- prüft Rule-Existenz (`netsh ... show rule`)
- gibt JSON zurück:
```json
{ "allOk": true, "ports": [ { "name": "Caddy", "port": 8050, "freigegeben": true } ] }
```

### 9.3 Task-Check (`check_task.bat`)
Empfehlung: Ausgabe als JSON (damit Advanced UI „RUNNING/READY/DISABLED“ anzeigen kann):
```json
{ "installed": true, "enabled": true, "running": false, "taskName": "NiBu Photobooth Watchdog" }
```

---

## 10) Typische Stolperfallen

- **Stop ohne Watchdog Stop:** Backend wird sofort wieder gestartet → daher UI-Buttons für Watchdog Start/Stop.
- **Hardcodierte Pfade in DefaultConfig:** vermeiden → `__BASE_DIR__` nutzen und per PS patchen.
- **Ports nicht konsistent:** sicherstellen, dass `install.bat` die Port-Dateien schreibt, bevor Start/Firewall laufen.
- **DefaultConfig überschreiben:** Install rollt Defaults neu aus → danach werden Ports & BaseDir gepatcht (Ziel bleibt lauffähig).

---

## 11) Kurzer TL;DR Ablauf

1. Advanced UI Full Install → Ports eingeben  
2. UI schreibt `install_port.txt`  
3. `install.bat`:
   - Port-Dateien schreiben (`caddy_php_port.json`, `port_Settings.json`)
   - `copy_original_config.bat` (copy + `__BASE_DIR__` replace + Port patch)
   - unblock + firewall + task install
4. Watchdog Task starten (`task_start.bat`)  
5. Watchdog überwacht & restarts bei Fehlern

