# Startbild {#startbild}

![Startbildschirm der Photobooth](images/startbild.jpg)

## Beschreibung

Das Startbild ist die **Kiosk-Ansicht** der Photobooth. Hier wartet die UI auf eine Interaktion und zeigt typischerweise:

- Overlay **„Tap to start“** (Start der Fotosession)
- Statusanzeige unten rechts (z. B. **CameraBridge** online/offline + Start/Stop)
- Oben die Navigationsleiste mit den wichtigsten Tabs

## Typischer Ablauf

1. Sicherstellen, dass **CameraBridge** läuft (Status unten rechts).
2. **Aktives Event** prüfen (Name, Speicherordner, Template).
3. **Device** ist ausgewählt (Kamera/Webcam).
4. Auf **„Tap to start“** tippen → Capture-Flow startet.

## Wenn „Tap to start“ nicht reagiert

- Prüfen, ob ein Modal noch offen ist (z. B. Settings).
- Browser **Reload** (oben in der UI) verwenden.
- Debug aktivieren (Allgemeine Einstellungen), um Fehlermeldungen zu sehen.

Mehr:
- [Tabs im oberen Bereich](#tabs)
- [Quickguide](#quickguide)
