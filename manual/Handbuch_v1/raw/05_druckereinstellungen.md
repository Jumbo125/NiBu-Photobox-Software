# Druckereinstellungen {#printer-settings}

## Beschreibung

![Druckereinstellungen (UI)](images/druckereinstellungen.jpg)

In den Druckereinstellungen wählst du den **Windows-Drucker**, legst die **Kopienanzahl** fest und kannst optional die **Windows-Druckeroptionen** öffnen.  
Die Einstellungen werden in der Datei `config/config.json` gespeichert (Formular: `data-json-file="config/config.json"`).

## Windows-Drucker

**Feld:** Windows-Drucker (Dropdown)  
**JSON:** `printer.printerName` (in `config/config.json`)  
**Default:** leer

Wirkung:

- Legt fest, **welcher Drucker** für den Druck verwendet wird (insbesondere beim automatischen Drucken nach der Fotoserie).
- Die Dropdown-Liste wird **lokal über CMD/WMIC** befüllt (Hinweis in der UI). Das bedeutet:
  - Funktioniert typischerweise nur unter **Windows**.
  - Der Rechner muss den Drucker installiert/erkennen.

Hinweise:

- Während die Druckerliste geladen wird, ist das Dropdown **deaktiviert** und zeigt „Drucker werden geladen…“.
- Wenn keine Drucker erscheinen, ist meist entweder **kein Drucker installiert** oder das WMIC-Listing schlägt fehl (Windows-Umgebung/Policies).

## Anzahl Kopien

**Feld:** Anzahl Kopien (Number Input)  
**JSON:** `printer.printerCount` (in `config/config.json`)  
**Range:** 1–20  
**Default:** 1

Wirkung:

- Bestimmt, wie viele Kopien pro Druckauftrag gedruckt werden.
- Dieser Wert wird gespeichert und **für das automatische Drucken** verwendet (Hinweis in der UI).

Praxis-Tipp:

- Wenn in einem Event zusätzlich ein „Multiple Print“ oder ähnliche Logik existiert, gelten dort ggf. zusätzliche Regeln. Die Basis-Kopienanzahl kommt aber aus `printer.printerCount`.

## Aktionen

Die folgenden Buttons lösen Aktionen aus (sie ändern nicht zwingend direkt JSON-Werte, sondern steuern Windows/Printer-Handling):

- **Liste neu laden**
  - Lädt die Druckerliste erneut (typisch: erneuter WMIC-Call).
  - Der Button ist während bestimmter Zustände deaktiviert (z. B. solange noch geladen wird).

- **Druckeroptionen öffnen**
  - Öffnet die Windows-Druckereinstellungen/Preferences für den ausgewählten Drucker.

- **Als Standarddrucker setzen**
  - Setzt den ausgewählten Drucker als **Windows-Standarddrucker**.
  - Sinnvoll, wenn externe Tools/Treiber den Standarddrucker nutzen oder wenn `printerName` leer bleibt.

## Hinweis zum Windows-Dialog

Der Hinweis in der UI ist wichtig:

- Das geöffnete Windows-Dialogfenster **druckt nicht selbst**.
- Es dient nur dazu, den Drucker zu **konfigurieren** (z. B. Papierformat, Qualität, Ränder, Farbmodus).

## Troubleshooting

- **Dropdown bleibt leer / keine Drucker**
  - Prüfen, ob mindestens ein Drucker in Windows installiert ist.
  - „Liste neu laden“ verwenden.
  - Wenn WMIC auf dem System nicht verfügbar ist (neuere Windows-Konfigurationen): Druckerliste wird ggf. nicht befüllbar.

- **Druck wird nicht ausgeführt**
  - Prüfen, ob `printer.printerName` gesetzt ist und der Drucker online ist.
  - Prüfen, ob der Druck-Workflow „Silent Print“/Treiber unterstützt.
  - Falls der Druck über einen Python-Endpunkt läuft: sicherstellen, dass der Python-Service erreichbar ist und keine Auth/Port-Probleme bestehen.
