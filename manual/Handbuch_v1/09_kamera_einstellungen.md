# Kamera-Einstellungen {#kamera-einstellungen}

## Beschreibung

In diesem Bereich werden die Kameraparameter der Photobox konfiguriert. Die Werte werden verwendet, um die Kamera über die digiCamControl-CLI zu steuern und sowohl Aufnahmeverhalten als auch LiveView-Vorschau anzupassen.

**Wichtig:**

- Die Einstellungen werden in der Datei `config/camera_config.json` gespeichert.
- Nicht jede Kamera unterstützt alle Werte gleich. Welche ISO-, Blenden-, Verschluss- oder Weißabgleichswerte tatsächlich funktionieren, hängt vom angeschlossenen Kameramodell und der digiCamControl-Anbindung ab.

## Aufnahmeparameter

- **ISO**
  - **JSON:** `camera_settings.iso`
  - **Typ:** string
  - **Default:** `"100"`
  - **Wirkung:** Legt die ISO-Empfindlichkeit der Kamera fest.
  - **Hinweis:** Verfügbare Werte im UI: `100`, `200`, `400`, `800`, `1600`.

- **Verschlusszeit**
  - **JSON:** `camera_settings.shutter`
  - **Typ:** string
  - **Default:** `"1/60"`
  - **Wirkung:** Bestimmt, wie lange der Sensor belichtet wird.
  - **Hinweis:** Verfügbare Werte im UI: `1/30`, `1/60`, `1/125`, `1/250`, `1/500`.

- **Blende (f)**
  - **JSON:** `camera_settings.aperture`
  - **Typ:** string
  - **Default:** `"5.6"`
  - **Wirkung:** Steuert die Blendenöffnung und damit Schärfentiefe sowie Lichtmenge.
  - **Hinweis:** Verfügbare Werte im UI: `2.8`, `4`, `5.6`, `8`, `11`.

- **Weißabgleich**
  - **JSON:** `camera_settings.wb`
  - **Typ:** string
  - **Default:** `"auto"`
  - **Wirkung:** Passt die Farbtemperatur an die Umgebungsbeleuchtung an.
  - **Hinweis:** Verfügbare Werte im UI: `auto`, `daylight`, `cloudy`, `tungsten`, `fluorescent`.

- **Belichtungskorrektur**
  - **JSON:** `camera_settings.exposure`
  - **Typ:** float
  - **Default:** `0`
  - **Wirkung:** Erhöht oder reduziert die Belichtung relativ zur Basisbelichtung.
  - **Hinweis:** Das Feld arbeitet in `0.3`-Schritten. Im HTML ist kein fester Min-/Max-Wert definiert.

## LiveView und Vorschau

- **Einstellungen für Foto verwenden**
  - **JSON:** `camera_settings.use_settings_for_picture`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Bestimmt, ob die konfigurierten Kameraeinstellungen aktiv für die Fotoaufnahme verwendet werden.
  - **Hinweis:** Der eingeblendete Hilfetext wirkt inhaltlich eher wie ein Hinweis zu LiveView-Verhalten; funktional ist anhand der JSON-Zuordnung aber klar, dass dieses Feld zur Fotoeinstellung gehört.

- **LiveView dauerhaft aktiv**
  - **JSON:** `camera_settings.liveview_always_active`
  - **Typ:** bool
  - **Default:** `false`
  - **Wirkung:** Hält die LiveView-Vorschau permanent aktiv, auch wenn keine Fotosession läuft.
  - **Hinweis:** Bei deaktivierter Option startet LiveView nur bei Bedarf. Vor der ersten Aufnahme erscheint dann ein 3-Sekunden-Aufwärm-Countdown.

- **Vorschau spiegeln**
  - **JSON:** `camera_settings.preview_mirror`
  - **Typ:** bool
  - **Default:** `false`
  - **Wirkung:** Spiegelt nur die Live-Vorschau auf dem Bildschirm.
  - **Hinweis:** Die gespeicherten Fotos bleiben unverändert.

- **Vollbild-Vorschau (Kanten beschneiden, Bild zentrieren)**
  - **JSON:** `camera_settings.fullImg`
  - **Typ:** bool
  - **Default:** `false`
  - **Wirkung:** Skaliert die Vorschau auf Vollbild und beschneidet dabei die Ränder, damit das Bild zentriert dargestellt wird.
  - **Hinweis:** Diese Einstellung betrifft die Darstellung der Vorschau, nicht zwangsläufig die gespeicherte Bilddatei.

## LiveView-FPS

- **LiveView-FPS (während die Session läuft)**
  - **JSON:** `camera_settings.liveview_fps_active`
  - **Typ:** int
  - **Range:** `1–30`
  - **Default:** `20`
  - **Wirkung:** Legt die Bildrate der LiveView-Vorschau fest, solange eine Fotosession aktiv ist.
  - **Hinweis:** Höhere FPS wirken flüssiger, benötigen aber mehr CPU- und USB-Bandbreite.

- **LiveView-FPS (Leerlauf / nur Vorschau)**
  - **JSON:** `camera_settings.liveview_fps_idle`
  - **Typ:** int
  - **Range:** `1–30`
  - **Default:** `10`
  - **Wirkung:** Legt die Bildrate der Vorschau fest, wenn keine aktive Fotosession läuft.
  - **Hinweis:** Niedrigere FPS können die Stabilität verbessern und Systemlast sparen.

Praxis-Tipp:

- Für lange Events empfiehlt sich meist eine Konfiguration mit deaktiviertem permanentem LiveView oder mit niedriger `liveview_fps_idle` und höherer `liveview_fps_active`. So bleibt die Vorschau flüssig, ohne die Kamera dauerhaft unnötig zu belasten.

## Testfoto

- **Testfoto aufnehmen**
  - **JSON:** `—`
  - **Typ:** Aktion
  - **Default:** `—`
  - **Wirkung:** Löst eine Testaufnahme aus, um Belichtung, Ausschnitt und allgemeine Kameraeinstellungen zu prüfen.
  - **Hinweis:** Das zuletzt aufgenommene Testfoto wird direkt im Vorschaufenster angezeigt.

- **Testfoto-Vorschau**
  - **JSON:** `—`
  - **Typ:** Anzeige
  - **Default:** `Noch kein Testfoto vorhanden.`
  - **Wirkung:** Zeigt das zuletzt aufgenommene Testfoto im Dialog an.
  - **Hinweis:** Dient nur der Kontrolle und ist kein Konfigurationswert.

## Troubleshooting

- **Kamera reagiert nicht auf geänderte Werte**
  - Prüfen, ob die angeschlossene Kamera die gewählten Parameter über digiCamControl tatsächlich unterstützt.

- **Bild ist zu dunkel oder zu hell**
  - ISO, Verschlusszeit, Blende und `camera_settings.exposure` gemeinsam prüfen. Oft ist die Belichtungskorrektur oder eine zu kurze Verschlusszeit die Ursache.

- **LiveView wirkt instabil oder ruckelt**
  - `camera_settings.liveview_fps_active` und `camera_settings.liveview_fps_idle` reduzieren und prüfen, ob `liveview_always_active` deaktiviert werden sollte.

- **Kamera wird bei langen Events warm**
  - Dauerhaft aktiven LiveView vermeiden oder die Idle-FPS reduzieren.

- **Vorschau ist gespiegelt oder falsch skaliert**
  - `camera_settings.preview_mirror` und `camera_settings.fullImg` kontrollieren, da beide nur die Darstellung der Vorschau beeinflussen.

- **Testfoto erscheint nicht in der Vorschau**
  - Prüfen, ob die Aufnahme erfolgreich ausgelöst wurde und ob die Rückgabe bzw. Anzeige des letzten Testbilds korrekt funktioniert.
