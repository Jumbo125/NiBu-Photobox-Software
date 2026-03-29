# CameraBridge API-Server Einstellungen {#camerabridge-api-server-settings}

## Beschreibung

In diesem Bereich werden Pfade und Laufzeitparameter für den **CameraBridge API-Server** sowie den zugehörigen **Worker-Prozess** konfiguriert.

Typischerweise wird hier eine eigene JSON-Datei für den Bridge-Server verwendet (z. B. `tools/camerabridge/APIServer/ApiServer_settings.json`). Die UI-Felder schreiben in die jeweils angegebenen JSON-Keys (z. B. `Bridge.Port`, `Worker.ExePath`).

Wichtig:

- Die Anwendung ergänzt/aktualisiert CLI-Parameter häufig automatisch. Trage manuelle Parameter nur ein, wenn du sicher bist, was du tust.

## API-Server-EXE-Pfad

- **Pfad zur Kamerasteuerung-Server-EXE**
  - **JSON:** `Server.ExePath`
  - **Typ:** string (Pfad)
  - **Wirkung:** Absoluter Pfad zur `Photobox.Bridge.ApiServer.exe`. Ohne korrekten Pfad kann der API-Server nicht gestartet werden.

- **Starte CameraBridge-API-SERVER im CLI Modus**
  - **JSON:** `Server.camerabridge_server_headless`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Startet den API-Server ohne GUI (Headless/CLI). Empfohlen für Kiosk-Betrieb.

- **Nur ein API-Server gleichzeitig**
  - **JSON:** `Server.camerabridge_server_one_instance`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Verhindert Mehrfachstarts (doppelte Instanzen) und reduziert Port-/Lock-Probleme. Empfohlen.

## API-Server Netzwerk

- **Bind-Adresse**
  - **JSON:** `Bridge.BindAddress`
  - **Typ:** string
  - **Default:** `127.0.0.1`
  - **Wirkung:** Legt fest, auf welcher Netzwerkschnittstelle der HTTP-Server lauscht.
    - `127.0.0.1` = nur lokal (kein LAN/WLAN-Zugriff)
    - `0.0.0.0` oder `+` = alle Interfaces (LAN/WLAN/Hotspot), z. B. für Tablet/Handy
  - **Hinweis:** Für LAN-Bindung muss die **Firewall** den Port erlauben.

- **HTTP-Port**
  - **JSON:** `Bridge.Port`
  - **Typ:** int
  - **Range:** 1–65535
  - **Default:** `8052`
  - **Wirkung:** Port der CameraBridge HTTP-API (z. B. `http://127.0.0.1:8052`).

## MJPEG-Endpunkt

- **MJPEG-Pfad**
  - **JSON:** `Bridge.MjpegPath`
  - **Typ:** string
  - **Default:** `/live.mjpg`
  - **Wirkung:** Pfad des MJPEG-Streams für die Vorschau (LiveView-Stream).
  - **Hinweis:** Der MJPEG-Stream bleibt typischerweise **ungeschützt** (auch wenn API-Key aktiv ist).

## API-Schlüssel

- **API-Schlüssel**
  - **JSON:** `Bridge.AuthKey`
  - **Typ:** string
  - **Default:** leer
  - **Wirkung:** Schlüssel für die geschützten `/api/*` Endpunkte.
    - Wird üblicherweise als Header `X-Api-Key` gesendet.
    - Leer lassen, um Authentifizierung zu deaktivieren.
  - **Button „Generieren“:** erzeugt einen neuen Schlüssel und trägt ihn ein.
  - **Wichtig:** MJPEG bleibt ungeschützt (siehe Hinweis im UI).

## Health

Diese Werte steuern, wie oft und wie streng der Health-/Watchdog-Check läuft.

- **Intervall (ms)**
  - **JSON:** `Health.IntervalMs`
  - **Typ:** int
  - **Range:** 200–60000
  - **Default:** `2000`
  - **Wirkung:** Wie oft der Health-Check ausgeführt wird.

- **Timeout (ms)**
  - **JSON:** `Health.TimeoutMs`
  - **Typ:** int
  - **Range:** 100–60000
  - **Default:** `800`
  - **Wirkung:** Wie lange gewartet wird, bevor ein Check als fehlgeschlagen gilt.

Praxis-Tipp:

- Bei schwächeren Systemen oder hoher Last kann ein zu niedriger Timeout zu „false negatives“ führen (Server wird als offline bewertet).

## Logging

- **Logdatei**
  - **JSON:** `Logging.LogFile`
  - **Typ:** string (relativ oder absolut)
  - **Default:** `ApiServer_log.txt`
  - **Wirkung:** Pfad zur Logdatei des API-Servers. Hilfreich für Fehlersuche (Startprobleme, HTTP-Fehler, Worker-Starts).

## Worker-Prozess

Der API-Server startet/überwacht einen separaten **Worker**, der die Kamera/LiveView/Capture-Funktionen ausführt.

- **Worker-EXE-Pfad**
  - **JSON:** `Worker.ExePath`
  - **Typ:** string (Pfad)
  - **Default:** z. B. `.../tools/camerabridge/Worker/CameraWorker.exe`
  - **Wirkung:** Absoluter Pfad zur Worker-EXE. Ohne korrekten Pfad kann der Worker nicht starten.

- **Worker-Argumente**
  - **JSON:** `Worker.Args`
  - **Typ:** string
  - **Default:** leer
  - **Wirkung:** Zusätzliche CLI-Argumente für den Worker.
  - **Warnung:** Falsche Argumente können den Start verhindern. Unbekannte Argumente werden ggf. ignoriert.

  Unterstützte Beispiele aus der UI:

  - `--headless` / `--no-ui`
  - `--auto-http` / `--http` und `--no-auto-http` / `--no-http`
  - `--auto-refresh` / `--refresh` und `--no-auto-refresh` / `--no-refresh`
  - `--auto-select` / `--select` und `--no-auto-select` / `--no-select`
  - `--select=<id>` oder `--camera=<id>`
  - `--auto-liveview` / `--liveview` und `--no-auto-liveview` / `--no-liveview`
  - `--fps=<number>`
  - `--tray` / `--no-tray`
  - `--one-instance` / `--single-instance` (akzeptiert auch `--one_instanz`)

  Beispiele:
  - `--headless --http --liveview --fps=15`
  - `--select=0 --tray --one-instance`

- **Worker-Logdatei**
  - **JSON:** `Worker.LogFile`
  - **Typ:** string
  - **Default:** leer
  - **Wirkung:** Optionaler Pfad für Worker-Logs.
  - **Hinweis:** Wenn gesetzt, hängt die UI beim Speichern typischerweise `--log=<path>` an die Worker-Argumente an.

- **Beim Systemstart automatisch starten**
  - **JSON:** `Worker.AutoStartOnBoot`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Startet den Worker beim Boot automatisch (abhängig von eurer Startlogik/Service-Wrapper).

- **Automatisch starten, wenn nicht erreichbar**
  - **JSON:** `Worker.AutoStartWhenUnreachable`
  - **Typ:** bool
  - **Default:** `true`
  - **Wirkung:** Wenn der Worker nicht erreichbar ist, versucht der API-Server ihn automatisch zu starten.

- **Start-Abkühlzeit (ms)**
  - **JSON:** `Worker.StartCooldownMs`
  - **Typ:** int
  - **Range:** 0–600000
  - **Default:** `8000`
  - **Wirkung:** Mindestwartezeit zwischen Startversuchen (verhindert Start-Spam bei Fehlern).

- **Fehler-Schwelle**
  - **JSON:** `Worker.FailThreshold`
  - **Typ:** int
  - **Range:** 1–50
  - **Default:** `3`
  - **Wirkung:** Wie viele Fehler toleriert werden, bevor stärker reagiert wird (z. B. Neustart-Strategie/Backoff – abhängig von Implementierung).

## Troubleshooting

- **Zugriff vom Tablet/Handy klappt nicht**
  - `Bridge.BindAddress` auf `0.0.0.0` oder `+` setzen und **Firewall-Port** (z. B. 8052) freigeben.

- **API liefert 401/403**
  - `Bridge.AuthKey` prüfen: Key im Client muss identisch sein (Header `X-Api-Key`). Testweise AuthKey leer lassen (nur in geschützten Umgebungen!).

- **LiveView-Stream lädt nicht**
  - `Bridge.MjpegPath` prüfen (Standard `/live.mjpg`) und sicherstellen, dass der Server unter `http://<host>:<port><mjpegPath>` erreichbar ist.

- **Worker startet nicht**
  - `Worker.ExePath` prüfen.
  - Problematische `Worker.Args` testweise leeren.
  - `Worker.LogFile` setzen und Logs auswerten.
