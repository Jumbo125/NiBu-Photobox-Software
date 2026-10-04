# NiBu Launcher – Handbuch

## Quick Guide

### Wofür ist der Launcher da?
Der **NiBu Launcher** ist die zentrale Windows-Oberfläche für deine Fotobox-Umgebung. Er hilft dabei, die benötigten lokalen Dienste zu **installieren**, **konfigurieren**, **starten**, **stoppen**, **überwachen** und bei Bedarf wieder zu **entfernen**.

Typisch gesteuerte Komponenten sind:
- **Caddy**
- **PHP**
- **Bridge API**
- **Python**

Zusätzlich gibt es Funktionen für:
- Firewall-Regeln
- geplante Aufgaben / Watchdog
- Port-Konfiguration
- Windows-Kiosk-Anpassungen
- Desktop-Verknüpfungen
- Logs und Statuskontrolle

---

### Schnellstart in 7 Schritten

1. **Launcher starten**
   - Die `launcher.exe` starten.
   - Das Hauptfenster öffnet sich und zeigt den Status der Dienste.

2. **Optional: Sprache wählen**
   - Rechts oben im Hauptfenster kann die Sprache umgestellt werden.

3. **Advanced öffnen**
   - Im Hauptfenster auf **Advanced** klicken.

4. **Dateien freigeben**
   - In der Advanced-Ansicht zuerst **Unblock Files** ausführen, wenn die Dateien neu heruntergeladen oder entpackt wurden.

5. **Full Install ausführen**
   - Auf **Full Install** klicken.
   - Falls nötig Ports prüfen bzw. anpassen.
   - Installation bestätigen.

6. **Starten**
   - Zurück im Hauptfenster auf **Start** klicken.
   - Der Launcher startet die benötigten Dienste.

7. **Status prüfen**
   - Im Statusbereich kontrollieren, ob alle Dienste auf **RUNNING** und **OK** stehen.

---

### Alltagsbetrieb

Für den normalen Betrieb brauchst du meistens nur diese Schaltflächen aus dem Hauptfenster:
- **Start** – startet die Umgebung
- **Stop** – stoppt die Umgebung
- **Restart** – startet sauber neu
- **Open App** – öffnet die App / Weboberfläche
- **Open Logs** – öffnet den Log-Ordner
- **Advanced** – öffnet die erweiterte Verwaltung

---

### Wichtiger Hinweis zum Autostart
Der Launcher setzt den Windows-Autostart **nicht mehr automatisch**. Der Grund ist, dass Sicherheitssoftware darauf empfindlich reagieren kann.

Stattdessen läuft es bewusst **manuell**:
1. In **Advanced** die Desktop-Verknüpfung erstellen.
2. Den **Autostart-Ordner öffnen**.
3. Die Verknüpfung `NibuBox_Autostart.lnk` manuell in den Windows-Autostart-Ordner kopieren.

---

## 1. Überblick

### 1.1 Ziel des Launchers
Der Launcher bündelt mehrere Aufgaben in einer Anwendung:
- Start und Stop der Fotobox-Dienste
- Sichtprüfung des Systemzustands
- geführte Installation
- technische Wartung
- Basisdiagnose über Logs und Statusanzeigen

Er ist damit sowohl für den **Tagesbetrieb** als auch für **Setup und Support** gedacht.

---

### 1.2 Aufbau des Launchers
Der Launcher besteht im Wesentlichen aus zwei Oberflächen:

#### MainForm
Das ist das Hauptfenster für den täglichen Einsatz.

#### AdvancedForm
Das ist die erweiterte Verwaltungsoberfläche für Installation, Systemeingriffe und technische Wartung.

---

## 2. Hauptfenster (MainForm)

### 2.1 Funktionen im Hauptfenster

#### Start
Startet die komplette Umgebung über das hinterlegte Start-Skript.

#### Stop
Stoppt die Umgebung. Vor dem Stop wird eine **kurze Watchdog-Pause** gesetzt, damit der Watchdog den manuellen Stop nicht sofort als Fehler interpretiert.

#### Restart
Stoppt zuerst und startet anschließend erneut. Auch hier wird vorher eine Watchdog-Pause gesetzt.

#### Open App
Öffnet die eigentliche Anwendung bzw. Weboberfläche.

#### Open Logs
Öffnet den Log-Ordner im Windows-Explorer.

#### Advanced
Öffnet die erweiterte Oberfläche mit Installations- und Wartungsfunktionen.

---

### 2.2 Statusanzeige
Im Hauptfenster wird der Zustand der wichtigsten Komponenten angezeigt:
- **Caddy**
- **PHP**
- **Bridge API**
- **Python**

Zu jeder Komponente gibt es mindestens zwei Sichtweisen:
- **Process** – läuft der Prozess?
- **Health** – antwortet der Dienst korrekt?

Typische Zustände:
- `RUNNING` = Prozess läuft
- `STOPPED` = Prozess läuft nicht
- `OK` = Healthcheck erfolgreich
- `FAIL` = Healthcheck fehlgeschlagen

Wichtig: Ein Prozess kann laufen, obwohl der Healthcheck auf `FAIL` steht. Das bedeutet meistens, dass der Dienst zwar gestartet ist, aber noch nicht korrekt reagiert.

---

### 2.3 Refresh
Der Launcher aktualisiert den Status regelmäßig automatisch. Zusätzlich kann über **Refresh** manuell neu geprüft werden.

Der manuelle Refresh ist nützlich, wenn:
- du gerade eine Aktion ausgeführt hast
- du nach einer Installation den Status sofort prüfen willst
- du einen verdächtigen Zustand kontrollieren möchtest

---

### 2.4 Sprache
Die Sprache wird über eine Dropdown-Liste gewählt und im Launcher gespeichert. Beim nächsten Start wird die zuletzt gewählte Sprache wieder geladen.

---

### 2.5 Tray-Verhalten
Der Launcher kann in den **System-Tray** minimiert werden.

Typisches Verhalten:
- Beim Schließen per Benutzeraktion wird die App nicht unbedingt beendet, sondern in den Tray verschoben.
- Ein Doppelklick auf das Tray-Symbol öffnet das Hauptfenster wieder.

Das ist praktisch, wenn der Launcher im Hintergrund weiterlaufen soll.

---

## 3. Erweiterte Oberfläche (AdvancedForm)

Die AdvancedForm ist für Installation, Konfiguration und technische Verwaltung gedacht.

Sie ist in mehrere Bereiche gegliedert.

---

### 3.1 Bereich: Setup

#### Unblock Files
Hebt den Windows-Blockierungsstatus von Dateien auf. Das ist besonders sinnvoll, wenn die Anwendung oder Skripte aus dem Internet stammen oder aus einem ZIP entpackt wurden.

Empfehlung:
- Nach einem frischen Download oder Entpacken zuerst **Unblock Files** ausführen.

#### Full Install
Führt die vollständige Installation aus.

Dabei können unter anderem folgende Schritte dazugehören:
- Port-Konfiguration vorbereiten
- Konfigurationsdateien erzeugen
- Installationsskripte mit erhöhten Rechten starten
- benötigte Systembestandteile einrichten

Vor dem Start erscheint eine Warnung, weil bestehende Einstellungen überschrieben werden können.

---

### 3.2 Bereich: Manuelle Installation

Dieser Bereich ist nützlich, wenn nicht alles über Full Install laufen soll oder wenn gezielt einzelne Punkte nachinstalliert werden müssen.

#### Firewall Install
Richtet die benötigten Firewall-Regeln ein.

#### Task Install
Installiert die geplante Aufgabe bzw. den Watchdog-bezogenen Task.

#### Edit Ports (Caddy/PHP)
Erlaubt das Anpassen der Ports für Caddy und PHP.

#### Windows Kiosk Anpassungen
Setzt Windows-bezogene Anpassungen für den Kiosk-Betrieb.

Beispiele für solche Änderungen können sein:
- Sperrbildschirm deaktivieren
- Consumer Features deaktivieren
- Toast-Benachrichtigungen reduzieren oder sperren

Ein Teil dieser Änderungen wird erst nach Ab- und Anmelden oder nach einem Neustart vollständig wirksam.

#### Desktop-Verknüpfung erstellen
Erstellt eine Desktop-Verknüpfung, die für den manuellen Autostart oder für den schnellen Zugriff genutzt werden kann.

#### Autostart-Ordner öffnen
Dieser Bereich dient nur noch als **Hilfe zur manuellen Einrichtung**.

Ablauf:
1. Desktop-Verknüpfung erstellen.
2. Windows-Autostart-Ordner öffnen.
3. `NibuBox_Autostart.lnk` manuell in diesen Ordner kopieren.

Diese Variante wurde bewusst gewählt, um Probleme mit Sicherheitssoftware zu vermeiden.

---

### 3.3 Bereich: Watchdog

#### Watchdog Start
Startet den Watchdog bzw. aktiviert die zugehörige geplante Aufgabe.

#### Watchdog Stop
Stoppt den Watchdog bzw. deaktiviert ihn.

Ziel des Watchdogs:
- Überwachung der Umgebung
- automatisches Eingreifen, falls Prozesse unerwartet stoppen

Wichtig:
Bei manuellem **Stop** oder **Restart** aus dem Hauptfenster setzt der Launcher eine **temporäre Pause**, damit der Watchdog diese Aktionen nicht sofort als Problem interpretiert.

---

### 3.4 Bereich: Remove

#### Uninstall
Entfernt die Installation. Dabei können Konfigurationen, Aufgaben oder weitere Bestandteile gelöscht werden.

#### Firewall Uninstall
Entfernt die Firewall-Regeln.

#### Task Uninstall
Entfernt die geplanten Aufgaben.

#### WindowsTweaks Uninstall
Nimmt die Windows-Anpassungen wieder zurück, soweit das jeweilige Skript dies unterstützt.

---

## 4. Port-Konfiguration

### 4.1 Wofür werden Ports gebraucht?
Mehrere Teile der Umgebung kommunizieren lokal über Netzwerkports. Damit sich die Dienste nicht in die Quere kommen, braucht jede Komponente ihren eigenen Port.

Typische Standardwerte im Projekt sind:
- **Caddy:** `8050`
- **PHP:** `8051`
- **Bridge API:** `8052`
- **Python:** `8053`

---

### 4.2 Wann muss man Ports ändern?
Ports sollten nur geändert werden, wenn:
- ein anderer Dienst bereits denselben Port nutzt
- mehrere Instanzen parallel laufen sollen
- eine spezielle lokale Umgebung andere Ports verlangt

---

### 4.3 Full Install und Port-Dialog
Beim Full Install kann ein Port-Dialog erscheinen. Dort werden die Ports eingegeben und daraus Konfigurationsdateien erzeugt.

Je nach Projektzustand werden dabei Template-Dateien in echte Konfigurationsdateien umgewandelt.

---

## 5. Installation – empfohlener Ablauf

### 5.1 Saubere Erstinstallation
Empfohlene Reihenfolge:

1. Launcher entpacken
2. Launcher starten
3. **Advanced** öffnen
4. **Unblock Files** ausführen
5. **Full Install** ausführen
6. Falls nötig **Firewall Install** und **Task Install** prüfen
7. Zurück ins Hauptfenster
8. **Start** klicken
9. Status kontrollieren
10. **Open App** testen

---

### 5.2 Wenn Full Install nicht alles erledigt
Dann können einzelne Schritte manuell ergänzt werden:
- Firewall Install
- Task Install
- Edit Ports
- Windows Kiosk Anpassungen

---

## 6. Logs und Diagnose

### 6.1 Log-Ordner
Über **Open Logs** wird der Log-Ordner geöffnet. Dort finden sich Ausgaben der Skripte und weitere Laufzeitinformationen.

Die Logs sind besonders nützlich bei:
- Installationsproblemen
- Startfehlern
- Portkonflikten
- Timeout-Problemen
- Problemen mit erhöhten Rechten

---

### 6.2 Konsolenfenster im Launcher
Sowohl Hauptfenster als auch Advanced-Fenster besitzen eine Konsole bzw. Log-Ausgabe.

Dort sieht man:
- gestartete Aktionen
- Skriptaufrufe
- Statusänderungen
- Fehlermeldungen
- zusammengefasste Ergebnisse von Checks

---

### 6.3 Typische Diagnosefragen

#### Prozess läuft nicht
Mögliche Ursachen:
- Startskript fehlgeschlagen
- fehlende Datei
- Port bereits belegt
- Abhängigkeit fehlt

#### Prozess läuft, aber Health = FAIL
Mögliche Ursachen:
- Dienst antwortet noch nicht
- Cold Start dauert länger
- Konfiguration falsch
- Firewall oder Portproblem

#### Installation bricht ab
Mögliche Ursachen:
- fehlende Adminrechte
- blockierte Dateien
- fehlende Runtime-Komponenten
- ungültige Portkonfiguration

---

## 7. Watchdog-Pause

Der Launcher setzt bei bestimmten manuellen Aktionen eine Datei zur **temporären Watchdog-Pause**.

Zweck:
- Ein manueller Stop soll nicht sofort als Absturz oder Ausfall erkannt werden.
- Ein Restart soll nicht vom Watchdog dazwischen gestört werden.

Typisches Verhalten:
- **Stop** setzt eine längere Pause
- **Restart** setzt eine kürzere Pause

Das ist wichtig für einen kontrollierten Betrieb.

---

## 8. Manuelle Autostart-Einrichtung

### 8.1 Warum manuell?
Automatisches Eintragen in den Autostart kann bei Sicherheitssoftware als verdächtiges Verhalten gewertet werden. Deshalb wird dieser Schritt bewusst nicht mehr automatisch durchgeführt.

---

### 8.2 So wird der Autostart eingerichtet

1. In der Advanced-Ansicht **Desktop-Verknüpfung erstellen** ausführen.
2. In der Advanced-Ansicht den **Autostart-Ordner öffnen**.
3. Die Datei `NibuBox_Autostart.lnk` in den geöffneten Windows-Autostart-Ordner kopieren.

---

### 8.3 Speicherort des Windows-Autostarts
Für den aktuellen Benutzer liegt der Startup-Ordner typischerweise hier:

`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`

Der Launcher öffnet diesen Ordner direkt, damit man ihn nicht manuell suchen muss.

---

## 9. Typische Arbeitsabläufe

### 9.1 Normale Nutzung im Alltag
- Launcher öffnen
- Start klicken
- Status prüfen
- App öffnen

### 9.2 Nach Änderungen an Ports
- Advanced öffnen
- Ports ändern
- bei Bedarf Dienste neu starten
- Status erneut prüfen

### 9.3 Bei Problemen nach Download oder Kopie
- Advanced öffnen
- Unblock Files ausführen
- Full Install erneut testen

### 9.4 Bei Watchdog-Problemen
- Task Install prüfen
- Watchdog Start / Stop prüfen
- Logs kontrollieren

---

## 10. Fehlersuche

### 10.1 Launcher-Fenster zu klein oder Inhalte abgeschnitten
Mögliche Ursachen:
- Windows-Skalierung
- Fenster nicht maximiert
- ältere Launcher-Version ohne Layout-Fix

Empfohlene Lösung:
- Launcher aktualisieren
- maximiert öffnen
- Advanced mit scrollbarigem linken Bereich nutzen

---

### 10.2 Open App funktioniert nicht
Prüfen:
- Läuft Caddy?
- Läuft PHP?
- Stimmt die Portkonfiguration?
- Gibt es einen Fehler in den Logs?

---

### 10.3 Firewall-Check zeigt Fehler
Prüfen:
- Firewall Install erneut ausführen
- mit Adminrechten arbeiten
- Portwerte kontrollieren

---

### 10.4 Task-Check zeigt nicht installiert oder disabled
Prüfen:
- Task Install ausführen
- Watchdog Start ausführen
- geplante Aufgaben in Windows kontrollieren

---

### 10.5 Sicherheitssoftware meldet den Launcher
Besonders sensibel sind oft:
- automatische Autostart-Einträge
- Änderungen an Startup-Ordnern
- Skriptketten mit `cmd`, `.bat` oder `.ps1`

Deshalb wurde der Autostart auf eine **manuelle Benutzeraktion** umgestellt.

Wenn Sicherheitssoftware trotzdem reagiert:
- Logs prüfen
- die gemeldete Aktion identifizieren
- ggf. nur den betroffenen Schritt ändern oder vermeiden

---

## 11. Empfohlene Bedienregeln

- Nach einem neuen Download zuerst **Unblock Files** ausführen.
- Für die Erstinstallation möglichst **Full Install** verwenden.
- Ports nur ändern, wenn es einen klaren Grund gibt.
- Den Autostart nur manuell über die Verknüpfung einrichten.
- Bei Problemen immer zuerst **Status + Logs** prüfen.
- Den Watchdog nicht dauerhaft deaktivieren, wenn er für den stabilen Betrieb benötigt wird.

---

## 12. Kurzreferenz

### Hauptfenster
- **Start** – Umgebung starten
- **Stop** – Umgebung stoppen
- **Restart** – Umgebung neu starten
- **Open App** – App öffnen
- **Open Logs** – Log-Ordner öffnen
- **Advanced** – erweiterte Verwaltung öffnen

### Advanced
- **Unblock Files** – Dateien freigeben
- **Full Install** – komplette Installation
- **Firewall Install** – Firewall-Regeln einrichten
- **Task Install** – Aufgaben / Watchdog einrichten
- **Edit Ports** – Ports anpassen
- **Windows Kiosk Anpassungen** – Windows-Verhalten anpassen
- **Desktop-Verknüpfung erstellen** – Verknüpfung erzeugen
- **Autostart-Ordner öffnen** – manuelle Autostart-Hilfe
- **Watchdog Start/Stop** – Überwachung steuern
- **Uninstall / Uninstall-Teile** – Installation zurückbauen

---

## 13. Hinweise zum Umfang dieses Handbuchs

Dieses Handbuch beschreibt den Launcher auf Basis der bislang bekannten Projektstruktur und der besprochenen Oberflächen. Es deckt den praktischen Betrieb und die wichtigsten technischen Zusammenhänge ab.

Nicht im Detail beschrieben sind hier unter anderem:
- die vollständigen Inhalte aller Batch- und PowerShell-Skripte
- jedes einzelne Template oder jede interne Konfigurationsdatei
- die komplette interne Logik der Bridge- und Python-Komponenten

Für den normalen Betrieb und die übliche Wartung sollte dieses Handbuch aber ausreichen.
