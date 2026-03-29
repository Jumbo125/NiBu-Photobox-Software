# Aktives Event {#aktives-event}

## Beschreibung

In diesem Bereich wird das aktuell laufende Event der Photobox konfiguriert. Hier legst du Eventname, Foto-Speicherort, Template sowie Drucklimits und Nachdruck-Verhalten fest.

**Wichtig:**

- Die Einstellungen werden in der Datei `config/active_event_config.json` gespeichert.
- Das Template-ZIP ist **kein JSON-Feld**. Es wird separat per Upload verarbeitet und in den Event-Template-Ordner entpackt.

## Allgemeine Eventdaten

- **Eventname**
  - **JSON:** `active_event.eventName`
  - **Typ:** string
  - **Default:** `""`
  - **Wirkung:** Legt den Namen des aktuell aktiven Events fest.
  - **Hinweis:** Der Feldname im HTML lautet `eventNamse` und scheint ein Tippfehler zu sein, die JSON-Zuordnung zeigt aber korrekt auf `eventName`.

- **Foto-Speicherordner**
  - **JSON:** `active_event.photo_storage_path`
  - **Typ:** string
  - **Default:** `""`
  - **Wirkung:** Definiert den Ordner, in dem die Fotos dieses Events gespeichert werden.
  - **Hinweis:** Der Ordner kann direkt eingetragen oder über **Ordner wählen** ausgewählt werden.

- **Template (ZIP)**
  - **JSON:** `—`
  - **Typ:** Datei (`.zip`)
  - **Default:** `—`
  - **Wirkung:** Lädt ein Template als ZIP-Archiv hoch. Dieses wird für das aktuelle Event verwendet und entpackt.
  - **Hinweis:** Dieses Feld wird nicht über die JSON-Konfiguration gespeichert, sondern über einen separaten Upload-Endpunkt verarbeitet.

## Druckeinstellungen

- **Maximale Anzahl an Ausdrucken**
  - **JSON:** `active_event.max_prints`
  - **Typ:** int
  - **Range:** `0–∞`
  - **Default:** `0`
  - **Wirkung:** Begrenzt die Gesamtzahl erlaubter Ausdrucke für das Event.
  - **Hinweis:** `0` bedeutet unbegrenzt.

- **Bereits gedruckte Fotos**
  - **JSON:** `active_event.print_counter`
  - **Typ:** int
  - **Range:** `0–∞`
  - **Default:** `0`
  - **Wirkung:** Zählt, wie viele Fotos bereits gedruckt wurden.
  - **Hinweis:** Dieser Wert ist relevant, wenn ein Drucklimit aktiv ist.

- **Nachdruck erlauben**
  - **JSON:** `active_event.allow_reprint`
  - **Typ:** bool
  - **Default:** `false`
  - **Wirkung:** Erlaubt es Operatoren, das letzte Ergebnis erneut zu drucken, ohne eine neue Fotosession zu verbrauchen.

- **Mehrere Druckkopien**
  - **JSON:** `active_event.multiple_print`
  - **Typ:** int
  - **Range:** `1–∞`
  - **Default:** `1`
  - **Wirkung:** Bestimmt, wie viele Kopien pro Druckauftrag erstellt werden.
  - **Hinweis:** Beispiel: Bei Wert `2` werden bei jedem Druck automatisch zwei Ausdrucke ausgegeben.

Praxis-Tipp:

- Für Veranstaltungen mit Druckerbetrieb empfiehlt sich eine Kombination aus `max_prints`, `print_counter` und `multiple_print`, damit das verfügbare Druckkontingent sauber kontrolliert werden kann.

## Technische Felder

- **Konfigurationspfad**
  - **JSON:** `active_event.config_path`
  - **Typ:** string
  - **Default:** `C:\Users\andre\Desktop\photo-software\booth\config\active_event_config.json`
  - **Wirkung:** Enthält den internen Pfad zur aktiven Event-Konfigurationsdatei.
  - **Hinweis:** Dieses Feld ist im Dialog verborgen und dient primär technischen bzw. internen Zwecken.

## Troubleshooting

- **Fotos werden nicht im gewünschten Ordner gespeichert**
  - Prüfen, ob `active_event.photo_storage_path` korrekt gesetzt ist und der Zielordner existiert oder erstellt werden darf.

- **Template wird nicht angewendet**
  - Sicherstellen, dass eine gültige ZIP-Datei hochgeladen wurde und der Upload-Endpunkt das Archiv korrekt entpackt hat.

- **Drucklimit greift nicht wie erwartet**
  - Kontrollieren, ob `max_prints` auf `0` steht. In diesem Fall ist das Limit deaktiviert.

- **Zu viele Ausdrucke pro Vorgang**
  - Prüfen, ob `multiple_print` versehentlich größer als `1` gesetzt wurde.

- **Nachdruck ist nicht möglich**
  - Überprüfen, ob `allow_reprint` aktiviert wurde. Ohne diese Option ist kein Nachdruck vorgesehen.
