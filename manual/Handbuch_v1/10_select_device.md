# Device auswählen {#select-device}

## Beschreibung

In diesem Dialog wählst du das **Device** für **Live-Preview** und **Aufnahme**. Optional kann statt einer DSLR/CameraBridge auch eine **Webcam** (z. B. integrierte Kamera oder OBS Virtual Camera) verwendet werden.

Die Auswahl wird in `config/config.json` gespeichert (Formular: `data-json-file="config/config.json"`).

## Nur Cameras anzeigen

**Feld:** Nur Cameras anzeigen (Checkbox)  
**JSON:** `camera.show_only_camera` (in `config/config.json`)  
**Default:** `false`

Wirkung:

- Aktiviert einen **Filter für die Device-Liste**.
- In der UI steht explizit: „nur UI, wird nicht gespeichert“.  
  Das bedeutet: Der Filter beeinflusst nur die Anzeige der Geräte im Dropdown, nicht die eigentliche Konfiguration.

Praxis-Hinweis:

- Nützlich, wenn viele Video-Geräte vorhanden sind (virtuelle Kameras, Capture Cards) und du schnell die relevanten Kameras finden willst.

## Device (Auswahl)

**Feld:** Device (Dropdown)  
**JSON:** `camera.device` (in `config/config.json`)  
**Default:** leer

Wirkung:

- Das ausgewählte Device wird sowohl für:
  - **Preview** (Live-Stream)
  - **Capture** (Aufnahme)
  verwendet.
- Die UI weist darauf hin: **Stream + Capture sind identisch**. Wenn ein Device als Preview gewählt ist, ist es auch die Aufnahmequelle.

## Devices laden / Refresh

**Buttons:** Refresh-Icon (oben rechts) / „Devices laden“ (Footer)

Wirkung:

- Lädt die Device-Liste neu (Device-Scan / Anfrage an CameraBridge bzw. den Device-Provider).
- Sinnvoll bei:
  - neu angesteckter Kamera/Webcam
  - nach Start/Restart der CameraBridge
  - wenn „Keine Devices gefunden“ erscheint

## CameraBridge Offline / Fehlerhinweise

Unterhalb des Dropdowns können Fehlermeldungen eingeblendet werden:

- **Keine Verbindung zu CameraBridge**
  - Der Hinweis nennt den Standard-Endpunkt: `127.0.0.1:8052`.
  - Typische Ursachen: API-Server läuft nicht, falscher Host/Port oder Firewall blockiert.

- **Fehler beim Laden der Kamera-Liste**
  - Allgemeiner HTTP-/Fetch-Fehler beim Abrufen der Geräte.

Praxis-Tipp:

- Für LAN/Tablet-Zugriff muss die Bridge ggf. auf `0.0.0.0`/`+` gebunden sein und der Port (z. B. 8052) in der Firewall freigegeben werden.

## Gerätemetadaten (Hidden Fields)

Beim Speichern werden neben der Device-ID zusätzliche Metadaten in `config/config.json` geschrieben. Diese Felder sind im UI verborgen, damit sie automatisch aus der Device-Liste übernommen werden.

**JSON-Gruppe:** `camera.selected_camera`

- `usb_id` – interner/USB-Identifier (falls verfügbar)
- `id` – Device-ID (z. B. „0“, „1“)
- `display_name` – Anzeigename inkl. Systempfad
- `manufacturer` – Hersteller (falls verfügbar)
- `model` – Modellbezeichnung
- `serial` – Seriennummer oder System-Ident
- `port` – Port-/Device-Path
- `is_connected` – bool, ob das Device als verbunden erkannt wird

Wofür das genutzt wird:

- Stabilere Wiedererkennung des Geräts nach Neustart.
- Debugging/Support (welches Gerät war ausgewählt).
- Automatische (Wieder-)Auswahl anhand von ID/Seriennummer.

## Speichern

**Button:** Speichern (`pb-save-config`)

Wirkung:

- Schreibt die Auswahl nach `config/config.json`.
- Danach nutzt die UI beim nächsten Start/Flow das gespeicherte Device.

## Schließen

**Button:** Schließen

Wirkung:

- Schließt das Modal ohne weitere Änderungen (außer bereits gespeicherte Werte).

## Troubleshooting

- **„Keine Devices gefunden“**
  - CameraBridge starten/restarten.
  - Kamera/Webcam neu anstecken.
  - „Devices laden“ klicken.

- **Preview funktioniert, Capture nicht**
  - Da Preview und Capture identisch sind: prüfen, ob das Device korrekt ausgewählt ist und ob es von eurem Capture-Workflow unterstützt wird (virtuelle Kameras können je nach Setup Einschränkungen haben).

- **Modal zeigt „Offline“**
  - Bridge-Endpunkt prüfen (Standard `127.0.0.1:8052`) sowie BindAddress/Port/API-Key in den CameraBridge-Einstellungen.
