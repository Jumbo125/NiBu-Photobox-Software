# GitHub Copilot Projektinfo – Photobooth / NiBu Box

> Zweck dieser Datei: GitHub Copilot soll beim Arbeiten am Repository den technischen Kontext, die wichtigsten Konventionen und die gefährlichen Stolperfallen der Photobooth-Software kennen.  
> Empfohlener Ablageort im Repository: `.github/copilot-instructions.md` oder alternativ `COPILOT_INFO.md`.

## 1. Projektüberblick

Dieses Projekt ist eine lokale Photobooth-/Fotobox-Umgebung für Windows-Kiosk-Betrieb. Es besteht aus einer Browser-UI, mehreren lokalen Diensten, einer CameraBridge für Kamera/LiveView/Capture, einem Python Tool-Server für Render-, Upload-, Service- und Druckfunktionen sowie einem NiBu Launcher für Installation, Start/Stop, Status und Wartung.

Typische Komponenten:

- **Browser UI / Web-App**: Kiosk-Oberfläche, Einstellungen, Capture-Flow, Template Editor.
- **Caddy**: lokaler Webserver / Reverse Proxy.
- **PHP**: Web-/Backend-Anteil der bestehenden Booth-App.
- **CameraBridge API-Server**: lokale HTTP/JSON-API für Kamera, LiveView, Capture und Worker-Kommunikation.
- **CameraBridge Worker**: tatsächliche Kamera-/digiCamControl-/Device-Anbindung.
- **Python Tool-Server**: lokale Hilfs-API für Rendering, Drucker, Filepicker, Uploads, Service-Steuerung und Browser-/Ordner-Aktionen.
- **Renderer (`render_core.py`)**: erzeugt die finale Collage aus Template-XML, Fotos und optional Greenwall.
- **NiBu Launcher**: Windows-Oberfläche zum Installieren, Starten, Stoppen, Überwachen und Diagnostizieren der Umgebung.

Standard-Ports im Projekt:

| Komponente | Standard-Port |
|---|---:|
| Caddy | `8050` |
| PHP | `8051` |
| Bridge API | `8052` |
| Python Tool-Server | `8053` |

Ports nur ändern, wenn ein Portkonflikt besteht, mehrere Instanzen parallel laufen sollen oder eine spezielle lokale Umgebung andere Ports verlangt.

## 2. High-Level-Architektur

```text
Browser UI (JS/jQuery)
  ├─ capture_bindings.js
  │   ├─ lädt Konfiguration
  │   ├─ ermittelt Template-Slots
  │   └─ startet den Capture-Flow
  ├─ capture_flow.js
  │   ├─ Countdown
  │   ├─ LiveView
  │   ├─ Capture-Loop
  │   ├─ Rendering
  │   └─ Finish-UI
  └─ capture_api.js
      └─ spricht CameraBridge per HTTP an

CameraBridge API-Server (.NET 8 Windows)
  ├─ HTTP/JSON-API
  ├─ MJPEG-LiveView-Stream
  ├─ Auth via Bridge.AuthKey
  ├─ Swagger/OpenAPI unter /docs bzw. /swagger
  └─ Named Pipe IPC zum Worker

CameraBridge Worker
  ├─ Kamera-/Device-Kommandos
  ├─ LiveView-Frames
  └─ Capture: speichert Photo_1.jpg, Photo_2.jpg, ...

Python Tool-Server
  ├─ /ping
  ├─ /render/collage
  ├─ /render/fromSession bzw. sessionbasiertes Rendering, falls implementiert
  ├─ /pickUpload
  ├─ /openFolder
  ├─ /printers/*
  ├─ /service/*
  └─ /closeBrowser

Renderer
  ├─ liest Template-XML
  ├─ lädt Photo-Layer und Assets
  ├─ skaliert Photo-Layer intern über render.photo_work_scale
  ├─ optional Greenwall: auto / diff / chroma
  ├─ schreibt finale Collage
  └─ kopiert Originale und optional Greenwall-Kopien
```

## 3. Zentrale Konfigurationsdateien

### `config/config.json`

Globale Booth-Einstellungen. Typische Gruppen:

- `system.*`: OS, Fullscreen/Kiosk, Debug, Admin-Passwort, Watchdog-Intervalle.
- `language`: UI-Sprache, meist `de` oder `en`.
- `ui.*`: Theme, Hintergrundfarbe, Hintergrundbild.
- `capture.*`: Countdown-Zeiten, Texte während Aufnahme, Finish-Preview.
- `print.*`: automatisches Drucken, silent print.
- `printer.*`: Druckername, Kopienanzahl.
- `camera.*`: Device-Auswahl und gespeicherte Device-Metadaten.
- `activeTemplate.path`: versteckter Pfad zum aktiven Template.

Beim Ändern der Settings immer die bestehenden JSON-Keys, `data-json-file`, `data-json-group` und `data-json-parm`-Zuordnungen erhalten.

### `config/active_event_config.json`

Aktives Event:

- `active_event.eventName`: Eventname.
- `active_event.photo_storage_path`: Foto-Speicherort.
- `active_event.max_prints`: Drucklimit, `0` bedeutet unbegrenzt.
- `active_event.print_counter`: bereits gedruckte Fotos.
- `active_event.allow_reprint`: Nachdruck erlauben.
- `active_event.multiple_print`: Kopien pro Druckvorgang.

Wichtig: Das Template-ZIP ist kein normales JSON-Feld. Es wird separat per Upload verarbeitet und in den Event-Template-Ordner entpackt.

Hinweis: Im HTML kann der Feldname `eventNamse` vorkommen. Nicht blind korrigieren, wenn bestehender Code davon abhängt. Entscheidend ist die JSON-Zuordnung auf `active_event.eventName`.

### `config/render_config.json`

Renderer- und Greenwall-Einstellungen:

- `render.resize_mode`: `cover`, `contain`, `stretch`.
- `render.contain_bg`: Hintergrundfarbe für `contain`.
- `render.photo_work_scale`: interne Arbeitsgröße für Photo-Layer, Standard ca. `1.5`.
- `output.format`: `jpg` oder `png`.
- `output.jpeg_quality`: Print meist `92–95`, Default etwa `94`.
- `output.jpeg_subsampling`: `0` = beste Farbkanten.
- `output.dpi`: nur Metadaten, z. B. `300` für Print.
- `greenwall.switch`: `auto`, `on`, `off`.
- `greenwall.mode`: `auto`, `diff`, `chroma`.
- `greenwall.write_mask_debug`: Debug-Masken schreiben.

### `../tools/python_portable/server_config.json`

Python Tool-Server-Konfiguration:

- `AuthKey`: Shared Secret für schreibende/geschützte Endpunkte.
- `Port`: Python-Port.
- `args`: Startparameter, `{port}` wird ersetzt.
- `caddyWebroot` oder Varianten wie `paths.caddyWebroot`, `caddy.webroot`, `webroot`: Ziel für Uploads.

### `tools/camerabridge/APIServer/ApiServer_settings.json`

CameraBridge API-Server-Konfiguration:

- `Bridge.BindAddress`: `127.0.0.1` für lokal, `0.0.0.0`/`+` für LAN/Tablet/Hotspot.
- `Bridge.Port`: meist `8052`.
- `Bridge.MjpegPath`: meist `/live.mjpg`.
- `Bridge.AuthKey`: API-Schlüssel. Leer bedeutet Auth deaktiviert.
- `Bridge.PipeName`: Named Pipe zum Worker.
- `Worker.ExePath`: Pfad zum Worker.
- `Worker.AutoStartOnBoot`: Worker beim API-Server-Start starten.
- `Worker.AutoStartWhenUnreachable`: Worker neu starten, wenn Health fehlschlägt.
- `Health.IntervalMs`, `Health.TimeoutMs`: Health-/Reconnect-Parameter.

## 4. Capture-Flow

Typischer Ablauf:

1. Startbild zeigt „Tap to start“.
2. CameraBridge-Status prüfen.
3. Aktives Event, Speicherpfad und Template prüfen.
4. Device auswählen; Preview und Capture verwenden dasselbe Device.
5. Optional Testfoto auslösen.
6. Capture-Flow starten.
7. Countdown und LiveView laufen.
8. Kamera speichert Fotos als `Photo_1.jpg`, `Photo_2.jpg`, ...
9. Rendering erzeugt die finale Collage.
10. Optional Auto-Print.
11. Finish-UI zeigt Ergebnis oder kehrt zum Startbild zurück.

Beim Arbeiten am Capture-Code:

- Keine parallelen Render-Requests auslösen.
- Capture-Dateinamen konsistent halten: `Photo_{index}.jpg` bzw. Extension beachten.
- Request an CameraBridge kann Dateinamen ohne Extension verwenden; gespeichert wird mit Extension.
- LiveView nach Capture ggf. wieder starten, falls der API-Endpunkt oder Body-Flag dies vorsieht.
- Fehlerzustände sichtbar machen, besonders CameraBridge offline, keine Devices, Capture timeout und Rendererfehler.

## 5. `session.json` als Snapshot

Für reproduzierbares Rendering und Recovery soll pro Fotosession ein `session.json`-Snapshot im Capture-Ordner gepflegt werden.

Vorteile:

- Python rendert deterministisch aus gespeichertem Zustand.
- Debugging und Re-Render sind möglich.
- Recovery nach JS-/Browser-Absturz ist einfacher.
- JS muss nicht alle Details live an Python senden.

Empfohlene Statuswerte:

```text
INIT
CAPTURING
CAPTURE_DONE
RENDERING
DONE
PRINTED
ERROR
```

Beim Capture-Flow `session.json` möglichst atomar schreiben und bei jedem Slot-/Statuswechsel aktualisieren.

Minimal sinnvolle Struktur:

```json
{
  "id": "s1736760000000_abcd1234",
  "createdAt": "2026-03-25T10:15:00Z",
  "updatedAt": "2026-03-25T10:15:09Z",
  "status": "CAPTURING",
  "progress": { "done": 1, "total": 4 },
  "eventName": "Demo Event",
  "basePath": "D:/Photos",
  "eventPath": "D:/Photos/EVENTS/Demo Event",
  "photoTarget": 4,
  "expectedFiles": ["Photo_1", "Photo_2", "Photo_3", "Photo_4"],
  "photos": [
    { "slot": 1, "expectedName": "Photo_1", "file": "D:/tmp/Photo_1.jpg", "ts": 1736760000001 }
  ],
  "render": {
    "template": "D:/booth/templates/active/template.xml",
    "output_collage": "D:/Photos/EVENTS/Demo Event/final",
    "output_originals": "D:/Photos/EVENTS/Demo Event/original_copies",
    "prefix": "collage_",
    "ext": ".jpg",
    "render_config": null,
    "render_config_inline": {
      "render": {
        "resize_mode": "cover",
        "contain_bg": "#000000",
        "photo_work_scale": 1.5
      },
      "greenwall": {
        "enabled": true,
        "mode": "auto"
      }
    }
  },
  "print": {
    "autoPrint": true,
    "printerCount": 1,
    "multiplePrint": true,
    "printCounter": 2
  },
  "error": null
}
```

`render.*` ist für `render_core.render_from_session()` maßgeblich. Print-Daten sind nicht direkt für den Renderer nötig, aber für spätere Printer-/Workflow-Worker sinnvoll.

## 6. Rendering-Regeln

Primärer Betriebsweg:

```http
POST /render/collage
```

Typische Payload:

```json
{
  "template": "booth/templates/active/template.xml",
  "input_dir": "booth/photos/original",
  "output_collage": "booth/photos/final",
  "output_originals": "booth/photos/original_copies",
  "prefix": "collage_",
  "ext": ".jpg",
  "render_config": null,
  "render_config_inline": {
    "render": {
      "resize_mode": "contain",
      "contain_bg": "#8c1212",
      "photo_work_scale": 1.5
    },
    "greenwall": {
      "enabled": true,
      "mode": "auto"
    }
  }
}
```

Alternative für Tests/CLI:

```python
from render_core import render_collage_api

result = render_collage_api({
    "template": "D:/booth/templates/active/template.xml",
    "input_dir": "D:/booth/photos/original",
    "output_collage": "D:/booth/photos/final",
    "output_originals": "D:/booth/photos/original_copies",
    "prefix": "collage_",
    "ext": ".jpg",
    "render_config_inline": {
        "render": {"photo_work_scale": 1.5}
    }
})
```

Wichtige Regeln:

- Rendering über den Server bevorzugen, weil dort API-Key-Schutz, Locking und einheitliche HTTP-Integration vorhanden sind.
- Der Output-Index wird aus dem Zielordner ermittelt: `prefix + 000001 + ext`.
- Renderer-Code ist ohne Lock nicht parallel-sicher. Mehrere gleichzeitige Render-Requests können doppelte Indizes oder Copy-Konflikte erzeugen.
- `render.photo_work_scale` wirkt auf alle Photo-Layer, auch ohne Greenwall.
- `photo_work_scale` skaliert nur herunter, niemals hoch.
- `photo_work_scale` wirkt vor Greenwall, Rotation, Shadow, Border und finalem Platzieren.
- Standardwert ca. `1.5`; für Speed `1.3–1.5`, für feinere Kanten `1.7–2.0`.
- Original-DSLR-Dateien bleiben als Quelldateien erhalten.

## 7. Greenwall / Greenscreen

Greenwall wird aktiv, wenn das Template dies erlaubt und die Config es einschaltet.

Aktivierungslogik:

- Template-Root enthält `greenwall="1"`.
- Config oder Inline-Config enthält `greenwall.enabled=true`.
- Legacy-Schalter `greenwall.switch` kann `auto`, `on`, `off` sein.

Modi:

- `auto`: nutzt `diff`, wenn Referenzbild vorhanden ist, sonst `chroma`.
- `diff`: Referenzvergleich gegen Hintergrundbild.
- `chroma`: klassisches Keying über Grün-Dominanz.

Referenzbilder werden typischerweise in `input_dir` oder `input_dir/assets` gesucht. Übliche Namen:

- `greenwall.png`
- `greenwall.jpg`
- `greenwall.jpeg`

Optionale Hintergrundbilder können u. a. heißen:

- `___greenwall.jpg`
- `___greenwall.png`
- `greenwall_bg.*`

Debug:

- `greenwall.write_mask_debug=true` schreibt Masken nach `output_originals/original_greenwall/*_mask.png`.

Typisches Tuning:

- Löcher in Gesicht/Haaren: `green_ratio` oder `diff_threshold` senken, ggf. `close_iter` leicht erhöhen.
- Grüne Ränder: `spill_suppression` erhöhen.
- Zu viel Hintergrund bleibt: `diff_threshold` oder `green_ratio` erhöhen.
- Zu viel Person verschwindet: `diff_threshold` senken und mit Debug-Masken testen.

## 8. CameraBridge API-Server

Der CameraBridge API-Server ist ein Windows-Programm auf Basis von `.NET 8 Windows`.

Aufgaben:

- HTTP-Requests vom Frontend/Controller annehmen.
- Requests in Named-Pipe-Kommandos für den Worker übersetzen.
- Antworten und Fehler als HTTP liefern.
- MJPEG-LiveView streamen.
- Worker-Erreichbarkeit überwachen.
- Worker automatisch starten oder neu anstoßen, wenn konfiguriert.
- Swagger/OpenAPI bereitstellen.

Wichtige Startflags:

```bat
ApiServer.exe --headless true --tray false --window_console false
ApiServer.exe --Bridge:Port=8052
ApiServer.exe --one-instance true
```

Named-Pipe-Kommandos zum Worker:

```text
status.get
cameras.list
camera.select
camera.refresh
liveview.start
liveview.stop
liveview.fps.get
liveview.fps.set
settings.get
settings.set
capture
watchdog.get
watchdog.set
frame.wait_next
```

Wichtige HTTP-Endpunkte:

```http
GET  /api/status
GET  /api/worker/reachable
GET  /api/worker/ping
POST /api/worker/restart
GET  /api/cameras
POST /api/select?serial=...
POST /api/select?id=...
POST /api/refresh?timeoutMs=4000
POST /api/liveview/start
POST /api/liveview/stop
GET  /api/liveview/fps
POST /api/liveview/fps?fps=10
GET  /api/settings
POST /api/settings
POST /api/capture
POST /api/capture-liveview
GET  /api/watchdog
POST /api/watchdog?enabled=true
GET  /live.mjpg
GET  /docs
GET  /swagger/v1/swagger.json
```

Auth-Regeln:

- Wenn `Bridge.AuthKey` leer ist, ist Auth deaktiviert.
- Wenn `Bridge.AuthKey` gesetzt ist, sind Status, Docs, Swagger, OpenAPI, Root, Favicon, OPTIONS und der MJPEG-Stream öffentlich.
- Alle anderen API-Endpunkte brauchen `X-Api-Key: <key>` oder `Authorization: Bearer <key>`.
- Der MJPEG-Stream bleibt typischerweise ungeschützt. Bei LAN/WLAN-Betrieb Bind-Adresse und Firewall bewusst konfigurieren.

Fehler-Mappings:

```text
device_busy      -> 409
no_camera        -> 404
cannot_focus     -> 422
timeout          -> 504
refresh_timeout  -> 504
unbekannt        -> 500
```

## 9. Python Tool-Server

Die Core-Module sind lokale Hilfsfunktionen. Die tatsächlichen HTTP-Routen liegen üblicherweise in `python_server.py`.

Module:

- `service_core.py`: Start/Stop/Status/Restart lokaler Prozesse.
- `upload_core.py`: Filepicker + Kopie nach Webroot, typ. `/pickUpload`.
- `filepicker_core.py`: OS-Dateidialog.
- `open_folder.py`: Ordner im Dateimanager öffnen.
- `printer_core.py`: Druckerlisten, Default setzen, Drucker-GUI öffnen.
- `close_browser.py`: Browser anhand HTTP-Connection finden und schließen.
- `render_core.py`: Collage-Renderer.

Response-Konvention:

```json
{
  "ok": true,
  "error": null,
  "http_status": 200
}
```

Regeln:

- `ok` ist der primäre Erfolgsindikator.
- Bei Fehlern `error` als kurzer stabiler Code zurückgeben.
- `http_status` ist oft als Empfehlung enthalten.
- Filepicker-Cancel ist kein technischer Fehler: `ok=false`, aber `http_status=200`.
- Schreibende Endpunkte über `api_key` bzw. `AuthKey` schützen.
- API-Key timing-safe vergleichen, z. B. `hmac.compare_digest`.
- GUI-Aktionen wie Picker, Explorer und Printer-GUI müssen auf einem Host mit Desktop laufen.

Typische Mapping-Namen:

```http
GET  /service/status?api_key=...&exe=C:/path/ApiServer.exe
POST /service/start
POST /service/stop
POST /service/restart
GET  /pickUpload?api_key=...&title=Select&path=...&filter=...&subdir=...&prefix=...&overwrite=0
POST /render/collage?api_key=...
POST /render/fromSession?api_key=...
GET  /openFolder?api_key=...&path=...&create=1&foreground=0
GET  /printers/list?api_key=...
POST /printers/default?api_key=...
POST /printers/gui?api_key=...
POST /closeBrowser?api_key=...
```

## 10. Device- und Kamera-Regeln

- Device-Auswahl wird in `config/config.json` gespeichert.
- `camera.device` ist das ausgewählte Device.
- Preview und Capture verwenden dasselbe Device.
- Device-Refresh nach Start/Restart der CameraBridge oder nach neu angeschlossener Kamera anbieten.
- Bei „Keine Verbindung zu CameraBridge“ Standard-Endpunkt `127.0.0.1:8052` prüfen.
- Für LAN/Tablet-Zugriff Bridge auf `0.0.0.0` oder `+` binden und Firewall-Port freigeben.
- Kameraeinstellungen werden über CameraBridge/digiCamControl weitergereicht; nicht jede Kamera unterstützt alle ISO-/Blenden-/Shutter-/WB-Werte.

Wichtige Kamera-JSON-Keys:

```text
camera_settings.iso
camera_settings.shutter
camera_settings.aperture
camera_settings.wb
camera_settings.exposure
camera_settings.use_settings_for_picture
camera_settings.liveview_always_active
camera_settings.preview_mirror
camera_settings.fullImg
```

## 11. Template Editor und Templates

Der Template Editor kann:

- neues Template anlegen,
- aktives Template laden,
- ZIP importieren,
- vorhandenes Projekt aktivieren,
- Photo-Platzhalter und Bild-Layer bearbeiten,
- Template speichern und als ZIP exportieren.

Template-ZIP muss enthalten:

- `template.xml`
- zugehörige Bilder und Assets

Aktives Template:

- XML meist unter `/activeTemplate/template.xml`.
- Assets relativ zu `/activeTemplate/`.
- Photo-Platzhalter entsprechen später den Capture-Slots.
- Beim Löschen von Photo-Platzhaltern nummeriert der Editor verbleibende Slots neu.

Greenwall im Template Editor:

- Greenwall ist templateweit, keine normale Ebene.
- Upload speichert Referenz-/Hintergrundbild meist als `___greenwall.png` oder `___greenwall.jpg`.
- Template-Flag und Render-Config müssen zusammenpassen.

Beim Ändern des Editors:

- Layer-Reihenfolge erhalten.
- Styles wie Radius, Rahmen und Schatten erhalten.
- Asset-Pfade nicht unnötig absolut machen.
- Export-ZIP als Backup-/Transportformat stabil halten.

## 12. Druck

Druckeinstellungen liegen teils in `config/config.json`, teils im aktiven Event.

Wichtige Keys:

```text
printer.printerName
printer.printerCount
print.print_automatically_when_finish
print.silent
active_event.max_prints
active_event.print_counter
active_event.allow_reprint
active_event.multiple_print
```

Regeln:

- `printer.printerName` ist der Windows-Drucker für Auto-Print.
- `printer.printerCount` bestimmt Basis-Kopien pro Druckauftrag.
- `active_event.multiple_print` kann zusätzliche Event-Logik abbilden.
- `max_prints = 0` bedeutet unbegrenzt.
- Druckerlisten unter Windows werden lokal ermittelt; wenn keine Drucker erscheinen, Installation/WMIC/Windows-Policies prüfen.
- Silent Print ist für Kiosk-Betrieb wichtig.

## 13. NiBu Launcher / Betrieb

Der Launcher ist die zentrale Windows-Oberfläche für:

- Dienste installieren, starten, stoppen, neustarten.
- Status von Caddy, PHP, Bridge API und Python prüfen.
- Healthchecks anzeigen.
- Logs öffnen.
- Firewall-Regeln und Task/Watchdog installieren.
- Windows-Kiosk-Anpassungen durchführen.
- Ports konfigurieren.
- Autostart manuell vorbereiten.

Bedienregeln:

- Nach frischem Download/Entpacken zuerst **Unblock Files** ausführen.
- Für Erstinstallation möglichst **Full Install** verwenden.
- Danach **Start** klicken und prüfen, ob alle Dienste `RUNNING` und `OK` sind.
- Ein Prozess kann laufen, während Health noch `FAIL` zeigt; mögliche Gründe sind Cold Start, falsche Config, Port/Firewall oder Dienst noch nicht bereit.
- Bei manuellem Stop/Restart setzt der Launcher eine Watchdog-Pause, damit der Watchdog den gewollten Stop nicht als Absturz wertet.
- Autostart wird bewusst nicht automatisch gesetzt. Benutzer kopiert `NibuBox_Autostart.lnk` manuell in den Windows-Autostart-Ordner.

## 14. Sicherheits- und Robustheitsregeln für Codeänderungen

Copilot soll diese Regeln bevorzugen:

1. **Keine Secrets hardcoden.** AuthKeys, Ports, Pfade und EXE-Pfade aus Config laden.
2. **LAN-Bindung bewusst behandeln.** `0.0.0.0`/`+` nur verwenden, wenn LAN/Tablet-Zugriff gewünscht ist; Firewall und Auth beachten.
3. **MJPEG ist meist öffentlich.** Keine Annahme treffen, dass `/live.mjpg` geschützt ist.
4. **Render-Requests serialisieren.** Renderer benötigt Locking wegen Output-Index und Copy-Operationen.
5. **Filepicker-Cancel nicht als Fehler eskalieren.** `ok=false` mit HTTP 200 ist erwartetes Verhalten.
6. **Windows-Pfade robust behandeln.** `pathlib`, Normalisierung und relative Pfade verwenden; nicht blind Slash-Richtungen mischen.
7. **Bestehende JSON-Keys erhalten.** UI-Formulare hängen an `data-json-*` Attributen.
8. **Abwärtskompatibilität beachten.** Legacy-Schalter wie `greenwall.switch` und Alias `render.photo_scale` nicht ohne Migrationslogik entfernen.
9. **Keine automatischen Autostart-Einträge erzwingen.** Das ist bewusst manuell, um Sicherheitssoftware nicht zu triggern.
10. **Service-Stop/Restart mit Watchdog-Pause respektieren.** Sonst kann der Watchdog in geplante Aktionen eingreifen.
11. **API-Responses stabil halten.** Frontend erwartet `ok`, `error`, ggf. `http_status` und Detailfelder.
12. **Kiosk-taugliche Fehler ausgeben.** Fehler müssen im UI sichtbar und im Log nachvollziehbar sein.
13. **Keine parallelen CameraBridge-Instanzen erzeugen.** `--one-instance true` ist Standard und reduziert Port-/Lockprobleme.
14. **Settings nur gezielt überschreiben.** Viele UI-Felder schreiben direkt in JSON; beim Speichern nicht fremde Gruppen löschen.
15. **Template-ZIP getrennt behandeln.** Nicht als normales JSON-Feld speichern.

## 15. Typische Troubleshooting-Hinweise

### Keine Devices gefunden

- CameraBridge läuft nicht.
- Kamera neu anstecken.
- `Devices laden` / Refresh ausführen.
- Bridge-Port und Firewall prüfen.

### Keine Verbindung zu CameraBridge

- Standard prüfen: `http://127.0.0.1:8052`.
- Läuft der API-Server?
- Bind-Adresse korrekt?
- Port durch Firewall erlaubt?
- Worker erreichbar?

### Template nicht gefunden

- `template`-Pfad in Payload prüfen.
- `session.render.template` prüfen.
- Sicherstellen, dass `booth_root` korrekt erkannt wird und ein `config/`-Verzeichnis vorhanden ist.

### Photos nicht gefunden

- Renderer sucht `Photo_{index}.*` im `input_dir`.
- Prüfen, ob CameraBridge wirklich in diesen Ordner schreibt.
- Extension beachten.

### Greenwall wirkt nicht

- Template-Root: `greenwall="1"` prüfen.
- Config: `greenwall.enabled=true` oder passender `greenwall.switch`.
- Referenz-/Hintergrundbild im richtigen Ordner?
- Debug-Masken aktivieren.

### Rendering langsam

- `render.photo_work_scale` setzen oder senken, Startwert `1.5`.
- Anzahl/Größe der DSLR-Dateien prüfen.
- Viele Shadows/Rotationen/Layers prüfen.
- Zielordner mit sehr vielen Dateien vermeiden.
- Original-Kopien nach `output_originals` berücksichtigen.

### Bild unscharf

- `render.photo_work_scale` schrittweise erhöhen, z. B. `1.5 -> 1.7`.
- Prüfen, ob Template-Layer sehr klein oder stark skaliert ist.

### Prozess läuft, aber Health = FAIL

- Dienst ist noch im Cold Start.
- Falsche Config.
- Portkonflikt.
- Firewallproblem.
- Worker nicht erreichbar.

## 16. Stil für neue Codeänderungen

- Bestehenden Stil respektieren: JS/jQuery im Frontend, Python-Core-Module für lokale APIs, .NET API-Server für CameraBridge.
- Kleine, nachvollziehbare Änderungen statt großer Umbauten.
- Bestehende Endpunkte und JSON-Strukturen nicht ohne Migration brechen.
- Neue Fehlercodes kurz, stabil und maschinenlesbar halten.
- Logs mit genug Kontext schreiben: Pfade, Ports, Status, aber keine Secrets.
- UI-Texte über bestehende i18n-/Language-Mechanik pflegen.
- Bei neuen Einstellungen: Default dokumentieren, JSON-Key dokumentieren, UI-Speicherpfad dokumentieren.
- Bei Render-/Capture-Änderungen: Recovery über `session.json` mitdenken.
- Bei Printer-/Filepicker-/Explorer-Aktionen: Desktop-Verfügbarkeit beachten.

## 17. Was Copilot vermeiden soll

- Nicht mehrere Renderer parallel starten.
- Nicht `photo_work_scale` als Upscale missverstehen.
- Nicht die CameraBridge direkt durch Renderer-Code ersetzen.
- Nicht Uploads ohne `subdir`-Sanitizing oder Traversal-Schutz implementieren.
- Nicht API-Key-Prüfung durch einfachen unsicheren Vergleich ersetzen.
- Nicht alle Settings-Dateien vollständig überschreiben, wenn nur ein Feld geändert wird.
- Nicht Autostart automatisch in Windows eintragen.
- Nicht davon ausgehen, dass macOS vollständig unterstützt ist; viele lokale Funktionen sind primär Windows, teils Linux.
- Nicht Device-Preview und Capture als getrennte Geräte behandeln, solange die UI-Konvention sagt: identisches Device.
- Nicht Template-ZIP-Pfade als normales JSON-Feld behandeln.

