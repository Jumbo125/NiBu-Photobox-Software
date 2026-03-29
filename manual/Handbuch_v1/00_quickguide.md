# Quickguide {#quickguide}

![Startbildschirm der Photobooth](images/startbild.jpg)

## In 3 Minuten startklar

1. **Photobooth UI öffnen** (Hauptbildschirm mit „Tap to start“).
2. **CameraBridge-Status prüfen** (unten rechts).  
   - Wenn „offline/unknown“: **CameraBridge starten**.  
   - Wenn du Geräte nicht siehst: **Devices laden** (Select Device).
3. **Aktives Event setzen**: Eventname + Speicherordner auswählen. Optional: Template ZIP zuweisen/importieren.  
   Mehr: [Aktives Event](#aktives-event)
4. **Device auswählen**: „Devices laden“ → Kamera/Webcam auswählen → **Speichern**.  
   Mehr: [Device auswählen](#select-device)
5. **Testfoto** (empfohlen): Kamera-Einstellungen öffnen → Testfoto auslösen und prüfen.  
   Mehr: [Kamera-Einstellungen](#kamera-einstellungen)
6. Zurück zum Startbild → **„Tap to start“** → Fotosession läuft.

## Wenn du drucken willst

1. **Druckereinstellungen** öffnen.
2. **Drucker auswählen** und **Kopienanzahl** setzen.
3. Optional: **Als Standarddrucker setzen** (hilft, wenn Tools den Windows-Default nutzen).  
   Mehr: [Druckereinstellungen](#printer-settings)

Zusätzlich prüfen:

- **Allgemeine Einstellungen** → „Automatisch drucken nach der Serie“ (Auto-Print).  
  Mehr: [Allgemeine Einstellungen](#general-settings)

## Wenn die Bildqualität nicht passt

- **Zu stark abgeschnitten / falscher Bildausschnitt**: „Fit mode“ prüfen (Cover/Contain/Stretch).
- **Dateigröße/Qualität**: JPEG-Qualität und Subsampling prüfen.
- **Print-Workflow**: DPI-Metadaten (z. B. 300) setzen.
- **Greenscreen/Greenwall**: Switch/Mode/Tuning anpassen, ggf. Debug-Maske exportieren.

Mehr: [Image Render Einstellungen](#render-settings)

## Wenn du ein Template ändern musst

- **Schnell ändern**: „Aktives Template“ im Template-Editor öffnen.
- **Neues Template**: „Neu“ wählen, Größe auswählen, Editor starten.
- **Import**: ZIP mit `template.xml` + Assets importieren.
- **Export/Backup**: Export ZIP verwenden.

Mehr:
- [Template Editor](#template-editor)
- [Template Editor Oberfläche](#template-editor-ui)

## Häufige Probleme (quick & dirty)

- **Keine Devices gefunden**
  - CameraBridge läuft nicht → starten.
  - Kamera neu anstecken → „Devices laden“ klicken.  
  Siehe: [Device auswählen](#select-device)

- **Keine Verbindung zu CameraBridge**
  - Standard ist oft `127.0.0.1:8052`.  
  - Wenn LAN/Tablet genutzt wird: Bind-Adresse/Firewall prüfen.  
  Siehe: [CameraBridge API-Server Einstellungen](#camerabridge-api-server-settings)

- **Druck kommt nicht / falscher Drucker**
  - Drucker auswählen, Kopien prüfen, ggf. Standarddrucker setzen.  
  Siehe: [Druckereinstellungen](#printer-settings)

- **Greenscreen sieht schlecht aus**
  - Greenwall im Template aktivieren (falls nötig) + Referenzbild nutzen.
  - Render-Tuning anpassen (Ratio/Threshold/Blur/Close/Spill).  
  Siehe: [Image Render Einstellungen](#render-settings) und [Template Editor Oberfläche](#template-editor-ui)
