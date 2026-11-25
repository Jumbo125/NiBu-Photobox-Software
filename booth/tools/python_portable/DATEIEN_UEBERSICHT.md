# Übersicht: `booth/tools/python_portable/`

Diese Datei beschreibt für jede Python-/JSON-Datei in diesem Ordner, **was sie macht** und **was sie enthält**. Ziel ist ein schneller Überblick ohne den Code selbst lesen zu müssen.

---

## `python_server.py`

**Zentraler lokaler HTTP-Tool-Server** (Windows + Linux), der als Brücke zwischen der Web-UI (Browser/Caddy) und dem lokalen PC fungiert. Läuft auf `127.0.0.1:8053` (Port per CLI-Argument überschreibbar).

- Lädt beim Start `server_config.json` (AuthKey, Pfade, Zusatzkonfiguration) und prüft per Port-Check, ob bereits eine Instanz läuft (one-instance-safe, beendet sich sonst selbst).
- Zentrales rotierendes Logging (`logs/python_server.log`), inkl. Maskierung von Secrets (API-Keys etc.) in Logzeilen.
- Importiert alle anderen Module dieses Ordners optional/defensiv (Fehler werden geloggt, Server startet trotzdem, einzelne Endpunkte liefern dann einen Fehler).
- Definiert einen `BaseHTTPRequestHandler` mit `do_GET`/`do_POST`, der u. a. folgende Endpunkte bereitstellt:
  - **Allgemein:** `/`, `/ping`, `/runtime` (Debug-Infos: PID, CWD, Importfehler, Debug-Flags).
  - **Dateiauswahl:** `/pick` (Datei-/Ordner-Dialog via `filepicker_core.py`), `/pickUpload` (Dialog + Kopieren in `<caddyWebroot>/uploads[/subdir]`, nutzt teils `upload_core.py`-Logik direkt inline).
  - **Ordner/Browser:** `/openfolder` (öffnet Ordner im Explorer/Finder via `open_folder.py`), `/closebrowser` (Key-geschützt, killt den anfragenden Browser-Prozess via `close_browser.py`).
  - **Drucker:** `/printers`, `/printers/default`, `/printers/dialog`, `/print/default` (Key-geschützt, druckt + erhöht `print_counter` in einer Event-Datei) — nutzt `printer_core.py`.
  - **DNP-Fotodrucker:** `/dnp/info` (bewusst ohne API-Key, da nur lokal erreichbar) — detect + status/Verbrauchsmaterial über `main_dnp.py`/`common_dnp.py`/`windows_dnp.py`, inkl. Rate-Limiting (`min_interval_sec`).
  - **Service-Wrapper:** `/service/status`, `/service/start`, `/service/stop`, `/service/restart` (Key-geschützt) — delegiert an `service_core.py` (z. B. für eine CameraBridge-`Server.exe`).
  - **Autostart/Task-Planer:** `/autostart/status|enable|disable`, `/task_planer_service/status|enable|disable` — OS-abhängiges Dispatching an `autostart_win.py`/`autostart_linux.py` bzw. `task_planer_service_win.py`/`systemmd_linux.py`.
  - **Renderer/Collage:** `/greenwall/profile` (lokal, ohne Key, erzeugt Referenzprofil via `greenwall_profile.py`), `/render/collage` (Key-geschützt, direkter Payload-Render via `render_core.py`), `/render_from_session` bzw. `/render/fromSession` (Key-geschützt, Session-basiert).
  - **Preview:** `/preview/session` (Key-geschützt) liefert das gerenderte Bild binär aus, wenn `session.json` → `render.return_image == true`.
  - **Pi Pico / ToF / Münzprüfer:** `/pico/status`, `/credit/status`, `/pi_pico/list_identify`, `/pi_pico/check_identify`, `/pi_pico/tof/status`, `/pi_pico/coin/status` (+ POST-Varianten `enable/disable`, nicht alle hier im Ausschnitt gezeigt) — nutzt `pi_pico_core.py`, `identify_external_pc_core.py`, `credit_core.py`.
  - **Photo-Explorer:** `/photos/list` (listet Bilder rekursiv in einem Ordner), `/photos/file` (liefert einzelnes Bild binär, mit Path-Traversal-Schutz).
  - **Server-Steuerung:** `/shutdown` (Key-geschützt, beendet den Python-Server selbst).
- Enthält diverse interne Helper: JSON-Laden/Schreiben, Pfad-Sanitizing (Traversal-Schutz für `subdir`), API-Key-Validierung (`_auth_or_403`), Startup-Checks der wichtigsten JSON-Konfigdateien, sowie Debug-Schalter (`DEBUG_SKIP_*`), mit denen einzelne Aktionen gezielt deaktiviert werden können (z. B. zum Testen ohne echten Druck).
- Enthält mehrere globale Locks (`_RENDER_LOCK`, `_PRINT_LOCK`, `_DNP_LOCK`), um parallele Zugriffe auf Drucker/Renderer/DNP-Transport zu serialisieren.

---

## `server_config.json`

**Konfigurationsdatei für `python_server.py`** (liegt im selben Ordner). Enthält:
- `port` (Port der CameraBridge/ApiServer), `args` (Start-Argumente für den Service), `Python_ServerPort` (Port dieses Python-Servers).
- `AuthKey`: der API-Key, den alle geschützten Endpunkte verlangen (Header `X-Api-Key` oder Query/Body `api_key`).
- `caddyWebroot`: absoluter Pfad zum Webroot (für Uploads).
- `autostart.windows.shortcutPs1`: Pfad zum PowerShell-Skript, das den Autostart-Shortcut erzeugt.
- `task_planer_service.windows.launcherDir` / `task_planer_service.linux.startScript`: Pfade für die Task-Planer-/systemd-Watchdog-Integration.
- `external_pc`: Konfiguration für den Pi Pico (ToF-Sensor + Münzprüfer) — aktiviert/deaktiviert, serieller Port, Baudrate, Cooldowns, Distanzschwelle, Druckpreis in Euro.

---

## `credit_core.py`

**Guthaben-Domäne für den ST-001-Münzprüfer** (angebunden über einen Pi Pico). Kennt keine Serial-/Pico-Details, bekommt nur den bereits geparsten Münzwert (Cent) von `pi_pico_core.py` übergeben.

- Hält das aktuelle Guthaben im RAM (`threading.Lock`-geschützt) und persistiert es atomar (tempfile + `os.replace`) in `credit.json`.
- `load_credit()`: Lädt `credit.json` beim ersten Zugriff; legt die Datei bei Fehlen sofort mit `{"credit_cent": 0}` an.
- `get_credit_cent()`: liefert den aktuellen Saldo.
- `add_credit(amount_cent, ...)`: bucht eine Münze gut; lehnt eindeutig unplausible Werte ab (außerhalb 1–500 Cent); loggt unbekannte, aber plausible Nennwerte als Warnung, bucht sie aber trotzdem; schreibt jeden Vorgang zusätzlich in ein menschenlesbares Klartext-Log (`logs/coin_log.log`).
- `spend_credit(amount_cent, ...)`: zieht Guthaben ab (für den Druck-Flow); lehnt ab, wenn das Guthaben nicht ausreicht (kein negativer Saldo).
- Bekannte Münznennwerte: 10/20/50/100/200 Cent.

---

## `credit.json`

**Zustandsdatei** für `credit_core.py`. Enthält ausschließlich den aktuellen Saldo, z. B.:
```json
{ "credit_cent": 0 }
```
Kein Verlauf — der Verlauf liegt separat in `logs/coin_log.log`.

---

## `pi_pico_core.py`

**Liest Präsenz-Events und Münzwürfe von einem Pi Pico** über eine serielle USB-Verbindung (ToF-Sensor VL53L1X + ST-001-Münzprüfer).

- Protokoll (eine Zeile pro Event):
  - `DISTANCE:<mm>` (bevorzugt): rohe Distanz, Schwellenwert-Auswertung passiert serverseitig (`external_pc.distance_threshold_mm`), inkl. Flankenerkennung (nur Übergang "außerhalb" → "innerhalb" triggert).
  - `PRESENCE` (Altprotokoll): Pico hat selbst entschieden.
  - `COIN:<cent>`: Münzwert, wird an `credit_core.add_credit()` weitergereicht.
- Bei erkannter Präsenz: HTTP-POST an die CameraBridge (`/api/liveview/start`), um das LiveView vorzuwärmen, bevor der Nutzer den Start-Button drückt. Bridge-URL/Port/AuthKey werden dynamisch aus `../camerabridge/APIServer/ApiServer_settings.json` gelesen.
- Cooldown-Logik verhindert zu häufiges Triggern; eigene (höhere) Cooldown-Zeit für das DISTANCE-Protokoll.
- Unterdrückt Trigger während eines laufenden Capture-Vorgangs (`set_capture_active`/`is_capture_active`, mit Sicherheitsnetz-Timeout `CAPTURE_ACTIVE_MAX_AGE_SEC`).
- Serieller Reader läuft in einem Background-Thread mit automatischem Reconnect (Backoff bei Verbindungsabbruch).
- Laufzeit-Flags `tof_enabled`/`coin_enabled` sind getrennt über die WebUI umschaltbar, ohne Server-Neustart (`set_tof_enabled`, `set_coin_enabled`).
- Pausier-/Resume-Mechanismus (`pause_listener`/`resume_listener`), damit `identify_external_pc_core.py` den seriellen Port exklusiv nutzen kann.
- Loggt jeden Trigger-Versuch in `logs/tof_trigger_log.log` (Klartext).
- `pyserial` ist optionaler Import — fehlt es, wird das Feature weich deaktiviert.

---

## `identify_external_pc_core.py`

**Identifiziert die serielle Schnittstelle eines angeschlossenen Pi Pico** ("Externer PC"-Bereich), für Windows (`COMx`) und Linux (`/dev/ttyACM*`/`/dev/ttyUSB*`).

- Getrennt von `pi_pico_core.py` (laufender Listener) — dient nur dem einmaligen/gelegentlichen Scannen.
- Sendet `ID?\n` an Kandidaten-Ports und erwartet die Antwort `ID:TOF_Muenzzaehler`.
- `list_identify()`: scannt alle (OS-gefilterten) seriellen Ports.
- `check_identify(port)`: prüft gezielt einen übergebenen Port.
- Pausiert währenddessen den Reader-Thread von `pi_pico_core.py` (`pause_listener`/`resume_listener`) für exklusiven Portzugriff.

---

## `filepicker_core.py`

**Plattformübergreifender nativer Datei-/Ordner-Auswahldialog** (Windows + Linux), per CLI aufrufbar.

- Windows: nutzt die COM-Schnittstelle `IFileOpenDialog` direkt über `ctypes` (kein pywin32 nötig), inkl. GUID-Handling, Dateityp-Filter, Setzen des initialen Ordners.
- Linux: nutzt `zenity --file-selection` als GUI-Dialog.
- `sanitize_initial_path()`: validiert/korrigiert den übergebenen Startpfad (leer/ungültig → Default, relativ → relativ zum Skriptverzeichnis, nicht existent → Default).
- `get_default_start_dir()`: liefert `~/Pictures` falls vorhanden, sonst `C:\` (Windows) bzw. Home (Linux).
- CLI-Parameter: `--mode file|folder`, `--title`, `--path`, `--filter`. Gibt den gewählten Pfad auf stdout aus (leer bei Abbruch).

---

## `upload_core.py`

**Hilfsfunktionen für den `/pickUpload`-Flow** (wird aktuell teils auch inline in `python_server.py` dupliziert, aber als eigenständiges Modul mit High-Level-Funktion `pick_upload()` verfügbar).

- Liest `caddyWebroot` aus `server_config.json`.
- `sanitize_subdir()`: verhindert Path-Traversal in optionalen Unterordnern.
- `build_dest_filename()`: baut Zieldateinamen (`prefix_original.ext` oder nur `original.ext`).
- `resolve_dest_path()`: bei `overwrite=False` wird bei Namenskonflikt `_1`, `_2`, … angehängt; bei `overwrite=True` wird überschrieben.
- `copy_to_uploads()`: kopiert die Datei und gibt vollständige Metadaten zurück (Pfade, URL, MIME-Type, Größe, Zeitstempel).
- `normalize_filter()`: wandelt Windows-Style-Filter (`Images|*.png;*.jpg`) in Zenity-kompatible Filter für Linux um.
- `run_picker()`: startet `filepicker_core.py` als Subprozess und liest den gewählten Pfad.
- `pick_upload()`: kompletter Ablauf — Webroot ermitteln, Zielordner anlegen, Picker starten, Datei kopieren, Metadaten zurückgeben.

---

## `open_folder.py`

**Öffnet einen Ordner im nativen Dateimanager** (Explorer/Finder/xdg-open) und versucht optional, das Fenster in den Vordergrund zu holen.

- `normalize_dir_for_open()`: normalisiert den übergebenen Pfad (leer → Pictures/Home, relativ → relativ zu `base_dir`, Datei → Parent-Ordner).
- `open_folder_native()`: startet je nach OS `explorer` (Windows), `xdg-open` (Linux) oder `open` (macOS); optional `foreground=True` versucht per Low-Level-API (Windows: `user32`-Fensterenumeration + `AttachThreadInput`-Trick; Linux: `wmctrl`/`xdotool`; macOS: AppleScript) den Dateimanager in den Vordergrund zu bringen — ohne Garantie.
- `openfolder_endpoint()`: Komplettlogik für den HTTP-Endpunkt — Pfad normalisieren, Ordner bei Bedarf anlegen, Anti-Spam-Cooldown (Default 2s), dann öffnen.

---

## `close_browser.py`

**Beendet den Browser-Prozess, der eine bestimmte HTTP-Verbindung zum Server aufgebaut hat** (z. B. für einen "Schließen"-Button im Kiosk-Browser).

- Findet die Client-PID über die TCP-Verbindung (`client_port` ↔ `server_port`):
  - Windows: `netstat -ano` + `tasklist`/PowerShell-CIM für Prozessname und Parent-PID.
  - Linux: `ss -tnp` (bevorzugt) oder Fallback über `/proc/net/tcp` + `/proc/*/fd`-Scan (ohne `ss`/`lsof`).
- Sicherheitsprüfung: tötet standardmäßig nur erkannte Browser-Prozesse (Chrome, Edge, Firefox, Brave, Opera, Chromium) — außer `force=True` wird übergeben.
- Läuft die Parent-Prozesskette hoch (`_resolve_root_browser_pid`), um den Haupt-Browserprozess statt eines Child-Prozesses zu beenden.
- Verweigert, den eigenen Python-Server-Prozess zu beenden.
- Windows: `taskkill` (zuerst ohne `/F`, bei `force` mit `/F`). Linux/macOS: `SIGTERM`, bei Timeout Prozessgruppe, dann `SIGKILL` bei `force`.
- `close_browser_from_request()`: öffentliche Hauptfunktion, nimmt Client-IP/Port, Server-IP/Port, User-Agent (zur Browser-Erkennungs-Priorisierung) und `force`-Flag.

---

## `printer_core.py`

**Drucker-Hilfsfunktionen für die Photobooth** (Windows + Linux), unabhängig vom DNP-Fotodrucker-Protokoll (siehe `common_dnp.py` & Co. für DNP-spezifisches).

- Drucker-Liste/Default-Drucker:
  - Windows: bevorzugt `win32print` (falls pywin32 installiert), Fallback auf PowerShell/CIM (`Win32_Printer`).
  - Linux: CUPS-Tools (`lpstat -p`, `lpstat -d`, `lpoptions`).
- `set_default_printer()`: setzt Standarddrucker (Windows: `win32print.SetDefaultPrinter` oder `printui.dll`-Fallback; Linux: `lpoptions -d`).
- `open_printer_gui()`: öffnet die Windows-Druckereinstellungen (`ms-settings:printers`) oder druckerspezifische Dialoge (`printui.dll,PrintUIEntry`) bzw. unter Linux `system-config-printer`/GNOME/KDE-Tools/CUPS-Webinterface.
- `print_image()`: druckt ein Bild.
  - Windows: direktes GDI-Printing via `win32ui` + Pillow, ohne Dialog, proportionale Skalierung ("fit", kein Zuschneiden), mit automatischer Zentrierung auf die druckbare Fläche.
  - Linux: CUPS via `lp [-d printer] -n copies file`.
- `bump_print_counter()`: erhöht `active_event.print_counter` in einer Event-JSON-Datei, respektiert `max_prints` (0 = unbegrenzt); toleranter JSON-Parser als Fallback.
- `resolve_printer_name()`: case-/whitespace-tolerantes Auflösen eines angegebenen Druckernamens gegen die Liste installierter Drucker.
- Windows-spezifisch: `_windows_desktop_context()` erkennt, ob der Prozess in einer interaktiven Desktop-Session läuft (wichtig, da GUI-Dialoge sonst nicht sichtbar wären, z. B. bei Task-Scheduler-Start).

---

## DNP-Fotodrucker-Module (`common_dnp.py`, `main_dnp.py`, `windows_dnp.py`, `linux_dnp.py`)

Diese vier Dateien bilden zusammen die **DNP/Citizen-Fotodrucker-Integration** (Low-Level-USB-Kommunikation ohne Hersteller-DLL, direkt per Rohprotokoll).

### `common_dnp.py`
**Plattformunabhängige Basis**: DNP-Protokoll-Codec, Status-Parser, Datentypen.
- `DnpCommand`/`DnpCommands`: definiert die unterstützten Befehle (`STATUS`, `INFO/MQTY` (verbleibende Drucke), `INFO/MEDIA`, `INFO/FREE_PBUFFER`, `INFO/SERIAL_NUMBER`).
- `DnpPacketCodec`: kodiert Befehle ins Binärprotokoll (`ESC` + `P` + Arg1(6) + Arg2(16) + Längenfeld(8) + Payload) und dekodiert Antworten.
- `PrinterStatusKind` (Enum): Idle, Printing, Cooling, Cover Open, Paper/Ribbon End, Paper Jam, diverse Error-Zustände, Unit-Errors, Flash-Programming-Zustände.
- `DnpParsers`: parst Status-Antworten (inkl. CSP-Hex-Format), verbleibende Drucke, Medientyp, freien Puffer — jeweils mit Mapping-Tabellen von Rohcodes auf `PrinterStatusKind`.
- `DnpModelResolver`: erkennt Druckermodelle (DS620, QW410, CZ-01, generisches Muster) aus Freitext (Produktname, Gerätepfad etc.).
- `DnpProtocolClient`: High-Level-Client, der über ein `IDnpTransport` (Protocol) Status/verbleibende Drucke/Medientyp/freien Puffer abfragt (`probe()` holt alle vier auf einmal).
- `SimulationTransport`: liefert feste Fake-Antworten für Tests ohne echten Drucker.
- Hilfsfunktionen: `to_json()`, `format_status()`, `resolve_printer_model_from_windows_device_path()` (extrahiert VID/PID aus einem Windows-Gerätepfad).

### `windows_dnp.py`
**Windows-spezifische USB-Low-Level-Kommunikation** über `ctypes` + SetupAPI/CfgMgr32/Kernel32 (kein pywin32 nötig).
- `PAIR_TO_MODEL`: feste Tabelle bekannter VID:PID-Paare → Druckermodell (QW410, DS620, DS820, DS40, DS80, RX1, CX-02, CX-W, CZ-01 etc.).
- `WindowsUsbVidPidCatalog`: prüft, ob ein VID/PID-Paar ein bekannter DNP-Drucker ist, und löst das Modell auf.
- Enumeriert alle PnP-Geräte (`enumerate_devices`), findet das übergeordnete USB-Gerät (`USB\VID_...`) zu einem `USBPRINT\...`-Gerät, und findet darüber das passende Geräte-Interface (`resolve_device_path`).
- `try_find_usb_identity()`: sucht/bewertet (Scoring nach Namens-Übereinstimmung, Modell-Hinweis, Pfad-Muster) den besten passenden physischen DNP-USB-Drucker.
- `WindowsUsbPrinterTransport`: implementiert `IDnpTransport.query()` durch direktes `CreateFileW`/`WriteFile`/`ReadFile` auf den rohen USB-Gerätepfad, mit Timeout-Handling über einen Thread-Pool.
- `WindowsPrinterDetector.detect()`: kompletter Erkennungsablauf (USB-Identität finden → Gerätepfad auflösen → Modell/Hersteller bestimmen → `PrinterDetectionResult` zurückgeben).

### `linux_dnp.py`
**Linux-spezifische USB-Low-Level-Kommunikation** über `/dev/usb/lp*` bzw. `/dev/lp*` und `/sys/class/usb*`-Metadaten.
- `LinuxUsbDeviceInfo`/`LinuxUsbDeviceSelector`: Datenmodell + Parser für Selektor-Strings wie `usb:vid=1343,pid=000c,serial=...` oder `usb:...,bus=001,addr=003`.
- `LinuxUsbDeviceCatalog`: enumeriert Kandidaten-Gerätepfade, liest USB-Metadaten (Hersteller, Produkt, Seriennummer, Bus/Adresse) aus den `/sys`-Ancestor-Verzeichnissen.
- `LinuxUsbPrinterTransport`: implementiert `IDnpTransport.query()` durch direktes Schreiben/Lesen auf das Gerätefile (`open(..., "r+b", buffering=0)`), mit Timeout über Thread-Pool.
- `LinuxPrinterDetector.detect()`: Erkennungsablauf analog zu Windows, aber über die Linux-USB-Gerätekataloge.

### `main_dnp.py`
**CLI-Einstiegspunkt und Orchestrierung** für die DNP-Integration — wird auch von `python_server.py` als Bibliothek importiert.
- `CliOptions`: parst Kommandozeilen-Argumente (`detect`, `ports`, `info`, `probe`, `status`, `remaining`, `media`, `free-buffer` + diverse Optionen wie `--json`, `--simulate`, `--transport`, `--device`, `--printer`, `--model`, Timeouts).
- `detect_printer()`: wählt je nach `--transport`/OS den passenden Detector (`WindowsPrinterDetector`/`LinuxPrinterDetector`) oder liefert im `--simulate`-Modus feste Fake-Ergebnisse.
- `create_transport()`: erstellt den passenden `IDnpTransport` (Windows/Linux Raw-USB).
- `resolve_printer_model()`: versucht das Druckermodell aus verschiedenen Quellen zu bestimmen (Texthinweis, Windows-Gerätepfad, USB-Identität).
- `write_detect()`/`write_info()`/`write_value()`: formatieren die Ausgabe als Text oder JSON.
- `run()`: Hauptfunktion, die Argumente parst und den passenden Befehl ausführt; wird auch direkt aus `python_server.py` für den `/dnp/info`-Endpunkt importiert und wiederverwendet (`detect_printer`, `create_transport`, `resolve_printer_model`, `CliOptions`).

---

## `render_core.py`

**Zentraler Renderer-Modul für Fotobox-Collagen** (Template → fertiges Bild), das zentrale Herzstück der Bildverarbeitung.

Zwei Einstiegspunkte:
- `render_collage_api(payload, base_dir=...)`: direkter API-Weg — erwartet alle Pfade bereits im Payload (Template, Input-/Output-Ordner, Prefix, Dateiendung, optionale Render-Config).
- `render_from_session(session_folder, base_dir=...)`: Session-Weg für den normalen Capture-Flow — liest `session.json`, baut daraus intern ein Payload, schreibt Status/Ergebnis zurück in dieselbe `session.json`.

Wichtige Bestandteile:
- `DEFAULT_RENDER_CONFIG`: Default-Werte für Output (Format, JPEG-Qualität/DPI), Render-Modus (`stretch`/`cover`/`contain`), und Greenwall-Parameter (Diff-/Chroma-Key-Schwellen, Blur, Spill-Suppression etc.).
- `load_render_config()`: lädt `render_config.json` (Standard: `booth/config/config/render_config.json`), normalisiert Legacy-/Alias-Feldnamen und merged mit den Defaults.
- `parse_template_xml()`: parst `template.xml` — Canvas-Größe, Greenwall-Flags, Liste von `Layer`-Objekten (Typ `photo`/`image`, Position, Größe, Rotation, Z-Index, Rand/Schatten/Eckenradius-Styles).
- **Greenwall-Entfernung** (`remove_green_background`):
  - **Diff-Modus**: vergleicht das Foto pixelweise mit einem vorberechneten Referenzprofil (`.npy`/`.npz`, siehe `greenwall_profile.py` / `ReferenceProfile`-Klasse mit Caching nach Zielgröße).
  - **Chroma-Modus**: klassische Farbton-/Schwellwert-Heuristik (Grünanteil vs. Rot/Blau), falls kein Profil vorhanden ist oder explizit erzwungen.
  - `mode='auto'`: bevorzugt Diff, fällt sonst auf Chroma zurück.
  - Nachbearbeitung der Alpha-Maske: Blur, morphologisches "Close", Spill-Suppression (reduziert grünen Farbstich an Rändern).
- **Layer-Rendering** (`place_layer`, `resize_to_box`, `_apply_layer_styles`, `_compose_with_shadow`):
  - Resize-Modi `stretch`/`cover`/`contain` (mit Balkenfarbe).
  - Eckenradius (`_apply_radius_mask`), solider Rand (`_draw_solid_border`), Schlagschatten mit CSS-ähnlicher Kalibrierung (Blur-Faktor, Downscale für Performance, Spread).
  - Rotation nach Styling, Zentrierung anhand des visuellen Zentrums (`cx`/`cy` aus Fabric.js, Fallback auf `x+w/2`).
- `build_collage()`: der eigentliche Render-Lauf — lädt Fotos/Bilder pro Layer, wendet Greenwall ggf. an, komponiert alles auf die finale Canvas, speichert das Ergebnis (`out_ext`), kopiert Original-Fotos in einen separaten Ordner, schreibt ein detailliertes `render_time.log` (JSON-Lines mit Zeitstempeln pro Schritt) via `RenderProfiler`.
- `get_booth_root()`: findet das `booth/`-Wurzelverzeichnis relativ zur Datei (robust gegen abweichendes CWD).
- Umfangreiche Farbwert-Parser (`_parse_rgba` — akzeptiert `#RRGGBB(AA)`, `rgb()/rgba()`, Listen, benannte Farben, CSV-Strings).

---

## `greenwall_profile.py`

**Erzeugt Greenwall-Referenzprofile (`.npy`) aus vorhandenen Bilddateien**, getrennt vom HTTP-/Server-Code.

- Ein Greenwall-Profil ist ein vorberechnetes RGB-Array des *leeren* Hintergrunds in derselben Kamera-Perspektive wie spätere Capture-Bilder — wird von `render_core.py` im Diff-Modus zum schnellen Keying genutzt.
- `get_default_profile_dir()`: findet den Standard-Zielordner (`booth/config/greenwall_profiles/`), indem es nach einem Parent mit `config/`-Unterordner sucht.
- `create_greenwall_profile_from_path()`: öffnet das Quellbild (mit EXIF-Transpose), wandelt es in ein `uint8`-RGB-Array um, speichert es als `.npy` unter einem **festen, stabilen Dateinamen** (`greenwall_profile.npy`, wird immer überschrieben, damit UI/Render-Config einen stabilen Pfad referenzieren können).

---

## `credit_core.py` — siehe oben (bereits dokumentiert)

---

## `service_core.py`

**Start/Stop/Status/Restart für einen lokalen "Service"** (z. B. eine `ApiServer.exe`/CameraBridge-Server), mit einfacher API-Key-Absicherung.

- `load_server_config()`: lädt `server_config.json`.
- `validate_api_key()`: konstante-Zeit-Vergleich (`hmac.compare_digest`) des übergebenen Keys gegen `AuthKey`.
- `build_command()`: baut den Start-Befehl aus `exe_path` + Config (`Port`, `args`, mit `{port}`-Platzhalter-Ersetzung).
- `get_service_status()`: Windows — findet laufende Prozesse per Name über PowerShell/CIM (`Win32_Process`), Fallback `tasklist`; versucht zusätzlich Pfad-Abgleich. Linux/macOS: **nicht implementiert** (Platzhalter/TODO).
- `start_service()`: Windows — startet die Exe detached (kein Konsolenfenster, `DETACHED_PROCESS`), prüft vorher ob schon läuft. Linux/macOS: Platzhalter.
- `stop_service()`: Windows — `taskkill` auf gefundene PIDs (oder Fallback per Image-Name). Linux/macOS: Platzhalter.
- `restart_service()`: Stop + Start.

---

## Autostart- und Task-Planer-/Watchdog-Module

Diese vier Dateien verwalten den **automatischen Programmstart beim Hochfahren/Login**, getrennt in zwei unabhängige Mechanismen pro OS:

### `autostart_win.py`
**Windows-Implementierung des reinen Programm-Autostarts** (NibuBox-App startet automatisch beim Login — unabhängig vom Watchdog/Task-Planer).
- Ablauf bei `enable()`: führt `create_open_app_shortcut.ps1` aus → liest die dadurch erzeugte `NibuBox_Autostart.lnk` → kopiert sie in den Windows-Autostart-Ordner des aktuellen Users (`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`).
- Robuste Pfadauflösung für das PS1-Skript: Config (`server_config.json`) → Projekt-Default (`../../../launcher/...`) → mehrere feste Fallback-Kandidaten.
- Robuste PowerShell-Kommando-Auflösung: `powershell` → `powershell.exe` → `pwsh`/`pwsh.exe` → `shutil.which()` → feste absolute Pfade.
- `disable()`: löscht die `.lnk`-Datei aus dem Autostart-Ordner.
- `status()`: prüft Existenz von Quelle/Ziel/PS1 und liefert Debug-Infos.

### `autostart_linux.py`
**Platzhalter für den reinen Linux-Autostart** — aktuell **nicht implementiert** (`not_implemented_yet`). Alle drei Funktionen (`status`/`enable`/`disable`) geben bewusst einen Fehler mit Hinweis zurück, dass die systemd-Logik stattdessen in `systemmd_linux.py` liegt (bewusste Trennung von reinem App-Autostart und Watchdog-Service).

### `task_planer_service_win.py`
**Windows-Implementierung des NibuBox-Watchdog-Services über die Windows-Aufgabenplanung**.
- `enable()`: ruft `launcher/task_install.bat /nopause` auf.
- `disable()`: ruft `launcher/task_uninstall.bat /nopause` auf.
- `status()`: liest den Task-Namen aus `watchdog_taskname.txt` und prüft per `schtasks /Query` ob der Task existiert.
- Benötigt für `enable`/`disable` Admin-Rechte, da Scheduled Tasks als SYSTEM registriert werden.
- Robuste Auflösung des Launcher-Verzeichnisses über mehrere Kandidatenpfade, parsing von JSON-Ausgaben der BAT-Dateien (best effort, auch aus gemischtem Text extrahiert).

### `systemmd_linux.py`
**Linux-Implementierung des NibuBox-Watchdog-Services via `systemd --user`** — bewusst getrennt von `autostart_linux.py`.
- `enable()`: erzeugt eine systemd-User-Service-Datei (`~/.config/systemd/user/nibubox-watchdog.service`) mit `ExecStart=/bin/bash <start_script>`, `Restart=on-failure`; führt `systemctl --user daemon-reload` + `enable` aus.
- `disable()`: entfernt die Service-Datei, führt `systemctl --user disable` + `daemon-reload` aus.
- `status()`: prüft über `systemctl --user is-enabled` und Dateiexistenz.
- Sucht das Start-Skript (`kiosk_WaitAndStart.sh` o. Ä.) über Config oder feste Standard-Kandidatennamen.

---

## Zusammenfassung: Modul-Abhängigkeiten (vereinfacht)

```
python_server.py  (HTTP-Server, zentraler Einstiegspunkt)
 ├── filepicker_core.py       (Datei-/Ordnerdialog)
 ├── upload_core.py           (Upload-Logik, teils inline dupliziert)
 ├── open_folder.py           (Ordner öffnen)
 ├── close_browser.py         (Browser-Prozess killen)
 ├── printer_core.py          (generische Drucker: Liste/Default/Drucken)
 ├── render_core.py           (Collage-Rendering)
 │    └── greenwall_profile.py (Referenzprofil für Diff-Keying)
 ├── service_core.py          (externer Service start/stop/status)
 ├── autostart_win.py / autostart_linux.py        (App-Autostart)
 ├── task_planer_service_win.py / systemmd_linux.py (Watchdog-Service)
 ├── pi_pico_core.py           (ToF + Münzprüfer Listener)
 │    └── credit_core.py       (Guthaben-Persistenz)
 ├── identify_external_pc_core.py (Pico-Port-Identifikation)
 └── main_dnp.py                (DNP-Fotodrucker CLI/API)
      ├── common_dnp.py         (Protokoll/Codec/Status-Parser)
      ├── windows_dnp.py        (Windows Raw-USB)
      └── linux_dnp.py          (Linux Raw-USB)
```

Konfigurationsdateien:
- `server_config.json` — zentrale Server-Konfiguration (AuthKey, Pfade, Pico-Settings).
- `credit.json` — aktueller Guthaben-Saldo (Münzprüfer).
- `dnp_status_mapping.json` — Referenztabelle: DNP-Rohstatuscodes (dezimal/hex) → interne Enum-Namen/Kategorien (Dokumentations-/Mapping-Hilfsdatei, wird nicht direkt von obigem Code eingelesen, dient als Nachschlagewerk für die Statuscode-Bedeutung).
