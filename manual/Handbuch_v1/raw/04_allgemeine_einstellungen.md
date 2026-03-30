# Allgemeine Einstellungen {#general-settings}

## Beschreibung

![Allgemeine Einstellungen (UI)](images/allgemeine_einstellungen.jpg)

In diesem Bereich werden die **globalen Optionen** der Fotobox konfiguriert. Die meisten Felder schreiben direkt in eine JSON-Konfiguration über die Attribute `data-json-file`, `data-json-group` und `data-json-parm`.

- Formular **General Settings** speichert nach `config/config.json`.
- Der Block **Erweiterte Einrichtung** speichert zusätzlich nach `../tools/python_portable/server_config.json`.

Hinweis: Einige Werte werden in der UI als „versteckte“ Felder geführt (Hidden Inputs), weil sie für den Betrieb benötigt werden, aber im Normalfall nicht manuell geändert werden.

## Betriebssystem

**Feld:** Betriebssystem  
**JSON:** `system.os` (in `config/config.json`)  
**Werte:** `windows` (Default), `linux`, `mac`

Wofür es genutzt wird:

- Das Betriebssystem-Flag wird gespeichert und kann für OS-spezifisches Verhalten genutzt werden (z. B. Pfadformate, Tool-Aufrufe, Filepicker-Defaults).

## Sprache

**Feld:** Sprache  
**JSON:** `language` (in `config/config.json`)  
**Werte:** `en` (Default), `de`

Wofür es genutzt wird:

- Legt die UI-Sprache fest (i18n über `data-lang-key`).
- Die Standardtexte der Capture-Phasen sind teils Englisch und sollten bei Bedarf angepasst werden.

## Benutzeroberfläche

Dieser Accordion-Block steuert Darstellung und Layout.

- **Hintergrundfarbe**
  - **JSON:** `ui.main_background_color`
  - **Typ:** Color (`#RRGGBB`)
  - **Default:** `#000000`
  - **Wirkung:** Grund-Hintergrundfarbe der UI.

- **Designstil**
  - **JSON:** `ui.theme`
  - **Werte:** `dark` (Default), `light`
  - **Wirkung:** Schaltet zwischen dunklem und hellem UI-Theme (sofern Theme-Logik/CSS aktiv ist).

- **Hintergrundbild**
  - **JSON:** `ui.bgStaticImg`
  - **Default:** `uploads/bgImage.jpg`
  - **Wirkung:** Pfad zu einem statischen Hintergrundbild.
  - **UI:** Der Button „Datei zum Hochladen auswählen“ befüllt das Feld über den Upload/Filepicker-Flow.

Praxis-Tipp:

- Wenn ein Hintergrundbild nicht angezeigt wird: Pfad prüfen und sicherstellen, dass die Datei im Webroot/Uploads-Verzeichnis erreichbar ist.

## Aufnahmeeinstellungen

Dieser Accordion-Block steuert **Countdown-Timings** und **Texte** während des Capture-Flows.

- **Countdown vor dem ersten Foto (Sek.)**
  - **JSON:** `capture.counter_first_image`
  - **Range:** 1–20 (int)
  - **Default:** 3
  - **Wirkung:** Zeit von „Start“ bis zum ersten Foto.

- **Sekunden zwischen den Fotos**
  - **JSON:** `capture.counter_between_each_photo`
  - **Range:** 1–20 (int)
  - **Default:** 5
  - **Wirkung:** Pause zwischen den einzelnen Fotos einer Serie.

- **Sekunden bis zur Aufnahme**
  - **JSON:** `capture.counter_until_capture`
  - **Range:** 1–20 (int)
  - **Default:** 3
  - **Wirkung:** Runterzählen unmittelbar vor dem Auslösen (pro Foto).

- **Verzögerung nach der Serie (Sek.)**
  - **JSON:** `capture.counter_after_finish_serie`
  - **Range:** 1–20 (int)
  - **Default:** 5
  - **Wirkung:** Wartezeit nach Abschluss der Serie, bevor weiterverarbeitet wird (Render/Print/Finish).

## Texte während der Aufnahme

Diese Texte werden in verschiedenen Phasen des Capture-Flows angezeigt.

- **Text: Start**
  - **JSON:** `capture.text_starting`
  - **Default:** `Starting…`
  - **Wirkung:** Anzeige beim Beginn des Flows.

- **Nächstes Foto**
  - **JSON:** `capture.text_next_photo`
  - **Default:** `Next photo…`
  - **Wirkung:** Hinweis beim Übergang zum nächsten Foto.

- **Verarbeitung**
  - **JSON:** `capture.text_processing`
  - **Default:** `Images are being processed…`
  - **Wirkung:** Anzeige während Render/Processing.

- **Stillhalten (während der Aufnahme)**
  - **JSON:** `capture.text_hold_still`
  - **Default:** `Photo {slot}/{target} – hold still…`
  - **Wirkung:** Text während der Auslösung.
  - **Variablen:**
    - `{slot}` = aktuelles Foto (1..N)
    - `{target}` = Anzahl Fotos der Serie

- **Drucken**
  - **JSON:** `capture.text_printing`
  - **Default:** `Picture is printing…`
  - **Wirkung:** Anzeige während des Druckvorgangs.

- **Fertig**
  - **JSON:** `capture.text_done`
  - **Default:** `Done!`
  - **Wirkung:** Abschlussmeldung nach erfolgreichem Ablauf.

## Finale Bildvorschau nach der Aufnahme

Optionen, die die „Finish“-Phase steuern.

- **Finales Bild nach der Aufnahme anzeigen**
  - **JSON:** `capture.show_finish_image`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Zeigt nach Render/Print das finale Bild an (statt direkt zum Start zurückzukehren).

- **Anzeigedauer des finalen Bildes (Sekunden)**
  - **JSON:** `capture.show_finish_image_seconds`
  - **Range:** 1–60 (int)
  - **Default:** 5
  - **Wirkung:** Dauer der Anzeige, bevor automatisch zum Startbild gewechselt wird.

## Druck

Standard-Druckverhalten nach einer Serie.

- **Automatisch drucken nach der Serie**
  - **JSON:** `print.print_automatically_when_finish`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Startet nach dem Rendern automatisch einen Druckauftrag.

- **Still drucken (ohne Dialogfenster)**
  - **JSON:** `print.silent`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Druck ohne Dialog/Bestätigung (Kiosk-tauglich).

## System

Kiosk/Debug/Watchdog und Admin-Schutz.

- **Im Vollbild-/Kioskmodus starten**
  - **JSON:** `system.fullscreen`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Startet die UI im Fullscreen-Modus.

- **UI-Browser-Watchdog Prüfintervall (Minuten)**
  - **JSON:** `system.ui_watchdog_minutes`
  - **Range:** 1–60 (int)
  - **Default:** 5
  - **Wirkung:** Intervall für UI-/Browser-Prüfungen (z. B. Reload/Recovery je nach Implementierung).

- **Debug-Modus aktivieren/deaktivieren**
  - **JSON:** `system.debugMode`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Debug-Elemente/Konsole ein- oder ausblenden.

- **Admin-Passwort**
  - **JSON:** `system.password`
  - **Typ:** string
  - **Default:** leer
  - **Wirkung:** Passwort für administrative Aktionen (z. B. Fullscreen verlassen/Unlock per Keypad).
  - **UI:** Button „👁️“ blendet das Passwort ein/aus.

## Versteckte Pfade

Diese Werte werden als Hidden Inputs im Formular geführt und in `config/config.json` gespeichert.

- **Aktives Template (Pfad)**
  - **JSON:** `activeTemplate.path`
  - **Wirkung:** Basisverzeichnis des aktiven Templates (z. B. für `template.xml` und Asset-Pfade).

- **Render-Konfiguration (Pfad)**
  - **JSON:** `python.renderConfig`
  - **Wirkung:** Pfad zur Render-Konfigurationsdatei (z. B. `render_config.json`), die beim Python-Rendering genutzt wird.

## Erweiterte Einrichtung

Dieser Bereich integriert Python/Server-Komponenten und speichert in zwei Dateien:

- `config/config.json` (Python EXE + Python Server Script)
- `../tools/python_portable/server_config.json` (Webroot, Port, API-Key)

## Python Umgebung

- **Pfad zur Python-Exe**
  - **JSON:** `python.Path` (in `config/config.json`)
  - **Wirkung:** Python-Executable für Tool-Server/Render/Service-Aufrufe.
  - **UI:** Filepicker (Filter: `*.exe`).

## Python Server Script

- **Pfad zur python_server.py**
  - **JSON:** `app.python_server` (in `config/config.json`)
  - **Wirkung:** Script-Datei des Python Tool-Servers.
  - **UI:** Filepicker (Filter: `*.py`).

## Caddy Webroot

- **Caddy-Webroot-Pfad**
  - **JSON:** `caddyWebroot` (in `../tools/python_portable/server_config.json`)
  - **Wirkung:** Basisverzeichnis, das für bestimmte Python-Endpunkte (z. B. Uploads/Dateipfade) relevant ist.
  - **UI:** Folder-Picker.

## Python Port

- **Python Port**
  - **JSON:** `Python_ServerPort` (in `../tools/python_portable/server_config.json`)
  - **Range:** 1–65535 (int)
  - **Default:** 8053
  - **Wirkung:** Port, unter dem der Python Tool-Server erreichbar ist.

## Python API-Key

- **Python API-Key**
  - **JSON:** `AuthKey` (in `../tools/python_portable/server_config.json`)
  - **Default:** leer
  - **Wirkung:** Schlüssel für abgesicherte Python-API-Endpunkte (typisch Header `X-Api-Key`).
  - **UI:** Button „Generieren“ setzt einen neuen Key.

## Python Server Controls

Steuerung des Python Tool-Servers direkt aus der UI.

- **Start:** startet den Server
- **Neustart:** startet den Server neu
- **Stopp:** beendet den Server
- **Aktualisieren:** Status neu abfragen

Anzeige:

- Fortschrittsbalken (z. B. „running“)
- Status-/Infotext (z. B. „Python service reachable (PID …)“ oder „Status: unbekannt“)
