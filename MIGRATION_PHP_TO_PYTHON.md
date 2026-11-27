# Migration: PHP-API komplett nach Python (kein PHP mehr für die Photobox-App)

Ziel: Die Photobox-App (`booth/`) soll ohne PHP/Caddy-php_fastcgi laufen.
Alle `booth/api/*.php` Endpunkte sind 1:1 nach Python portiert
(`booth/tools/python_portable/webapi/`) und laufen im bereits vorhandenen
`python_server.py`-Prozess. Die PHP-Templates (`index.php`, `sections/*.php`,
`editor/*.php`) sind zu statischem HTML geworden.

**Scope:** Eigentlich nur die Photobox-App (`booth/`). EINE Ausnahme wurde
bewusst gemacht: der neue Watchdog-Helper-Prozess (siehe Paket 4b) musste in
`launcher/start.ps1`/`stop.ps1` eingehängt werden, weil er sonst gar keinen
Sinn ergäbe — das war eine explizite Nutzer-Entscheidung, keine
Scope-Aufweichung von mir aus.

Warum diese Migration überhaupt: PHP (php-cgi.exe) stürzt wiederholt ab,
ohne Logs zu schreiben. Root Cause: `launcher/start.ps1` startet php-cgi.exe
ohne `RedirectStandardOutput`/`RedirectStandardError`, Crash-Meldungen gehen
ins Leere. Statt den Logging-Fix zu bauen, wurde entschieden, PHP komplett
zu eliminieren.

---

## STATUS: Pakete 1–5 fertig. NÄCHSTER SCHRITT: Paket 6 (Caddyfile).

**Wichtig für den Nutzer:** Ausdrücklich nur bis Paket 5 gewünscht in dieser
Session. Pakete 6–8 sind geplant, aber NICHT begonnen — erst auf Zuruf
starten, nicht automatisch weitermachen.

---

## Status-Übersicht

- [x] **Paket 1:** Alle 19 PHP-API-Dateien + Caddyfile gelesen und verstanden.

- [x] **Paket 2:** `booth/tools/python_portable/webapi/` angelegt
  - `__init__.py`, `config_io.py` (JSON read/write/merge/backup-Helpers),
    `multipart.py` (multipart/form-data Parser für ZIP/Bild-Uploads),
    `routes.py` (alle Endpunkt-Handler)

- [x] **Paket 3: Routen in `python_server.py` eingehängt — GETESTET**
  - `_send_bytes()`-Helper ergänzt (in-memory ZIP-Export)
  - GET-Routen: `/api/config`, `/api/list_folders`, `/api/list_active_templates`,
    `/api/read_count_of_photos`, `/api/template_info`,
    `/api/template_editor_lade_config`, `/api/template_editor_list_projects`
  - POST-Routen (multipart VOR `parse_body()` abgefangen): `/api/set_active_template`,
    `/api/template_editor_import`, `/api/template_editor_upload_asset` (multipart);
    `/api/config`, `/api/session_snapshot`, `/api/template_set_active`,
    `/api/template_editor_save_config`, `/api/template_editor_save`,
    `/api/template_editor_export` (JSON)
  - **Verifiziert per echtem Testlauf** gegen echte Projektdaten (Port 18053):
    alle GET-Routen korrekt, Config-Write/Read-Roundtrip korrekt inkl. Backup,
    Session-Snapshot korrekt geschrieben, ZIP-Export (1.7MB, echte Assets)
    korrekt, multipart-Asset-Upload (von Hand gebauter Request) korrekt.
    Alle Test-Artefakte aufgeräumt.
  - `python_server_restart.php` → bewusst NICHT portiert (Bootstrap-Skript,
    obsolet sobald Python der einzige Server ist)
  - `test_print.php` → entfällt, nutzt natives `/print/test` (siehe Paket 4)

- [x] **Paket 4: Frontend-JS auf neue Pfade umgestellt — FERTIG**
  - `PB.ENDPOINTS.config_rw` in `pb_core.js` → `"api/config"`
  - Alle `.php`-Suffixe in `template_selector.js`, `capture_flow.js`,
    `capture_bindings.js`, `te_app_core.js`, `te_functions_extras.js`,
    `te_functions_io.js` entfernt
  - `te_app_core.js` `test_print.php`-Call → direkter Aufruf `/pyapi/print/test`
    (Caddy-Reverse-Proxy zu Python). AuthKey wird im Editor lokal aus
    `../tools/python_portable/server_config.json` geladen (Caddy liefert die
    Datei als statische Ressource aus, kein API-Call nötig).
    `python_server.py`'s `/print/test` akzeptiert jetzt zusätzlich
    `templateName` (löst via `webapi_routes.resolve_template_dir_for_name()`
    zu `template_dir` auf) als Alternative zum bisherigen `template_dir`.
  - **NICHT geändert** (toter Code, schon vor dieser Migration kaputt,
    außerhalb Scope): `camera_config.php`, `control_device_list.php`,
    `select_windows_file.php`, `select_windows_folder.php`, `camerabridge.php`,
    `camera_api.php`, `start_filepicker.php` in `pb_core.js`/
    `select_linux_windows_file_dir.js`; tote Route-Keys
    `python_server_restart`/`select_folder` in `api_route.js`
    (werden nirgendwo per `PB.apiUrl()` aufgerufen)

- [x] **Paket 4b: Watchdog-Helper-Prozess — FERTIG + GETESTET**

  Hintergrund: Der alte "Start/Restart Python-Server"-Button in den Settings
  lief über Browser→PHP→Prozess-Start. Das kann nicht mehr funktionieren,
  sobald PHP weg ist — ein toter HTTP-Server kann sich nicht selbst
  wiederbeleben lassen. Nutzer-Entscheidung: separater, minimaler,
  OS-unabhängiger (Windows + Linux) Begleitprozess, der unabhängig vom
  Hauptserver läuft und dessen Abstürze übersteht.

  - **Port:** neuer Key `"WatchdogPort": 8054` in
    `booth/tools/python_portable/server_config.json` (Caddy=8050, PHP=8051
    entfällt, Bridge=8052, Python=8053, Watchdog=8054)
  - **Neue Datei `booth/tools/python_portable/watchdog_server.py`** — bewusst
    nur stdlib (http.server, json, subprocess, socket, urllib.request),
    KEINE Abhängigkeit zu render_core/printer_core/webapi/PIL:
    - `GET /ping` (ungeschützt) — Liveness-Check des Watchdogs selbst
    - `GET /status?api_key=...` — prüft ob Hauptserver via `/ping` erreichbar ist
    - `POST /start` — spawnt `python_server.py` neu via `subprocess.Popen`
      (`DETACHED_PROCESS`/`start_new_session`), nur wenn nicht schon erreichbar,
      3s Cooldown gegen Doppelstarts
    - `POST /stop` — ruft `/shutdown` am Hauptserver auf
    - Auth: gleicher `AuthKey` wie Hauptserver aus `server_config.json`
  - **Verifiziert per echtem Testlauf:** `/ping` ✅, `/status` ohne Key → 403 ✅,
    `/status` mit Key → korrekt `mainServerRunning: true` (erkannte echten
    laufenden Produktionsserver) ✅, `/start` → korrekt
    `started: false, reason: already_running` (kein Doppelstart) ✅.
    `/stop` bewusst NICHT gegen den echten laufenden Server getestet.
  - `python_server.py`: `/runtime` liefert jetzt zusätzlich `watchdog_port`
    und `booth_root` (für Paket 5 gebraucht, siehe dort)
  - `pb_python_server.js`: `startViaPhp()` → `startViaWatchdog()` (holt
    Watchdog-Port dynamisch über `/runtime`, gecached pro Seitenaufruf)
  - `python_server_bindings.js`: Start-Button nutzt jetzt `startViaWatchdog()`

- [x] **Paket 4c: Launcher-Start/Stop für Watchdog ergänzt**
  - `launcher/start.ps1`: zusätzlicher `Start-Once`-Block für
    `watchdog_server.py`, direkt nach dem Python-Hauptserver-Start
  - `launcher/stop.ps1`: `Stop-PythonServerByCommandLine` generalisiert
    (neuer `-Label`-Parameter, Matching jetzt über den tatsächlichen
    Skript-Dateinamen statt hartkodiert `python_server.py`), damit Watchdog
    und Hauptserver unabhängig voneinander gestoppt werden können
  - Syntax-geprüft (PSParser, keine Fehler). NICHT im echten Betrieb
    getestet (hätte den echten Produktionsserver gestoppt/neugestartet).

- [x] **Paket 5: PHP-Templates zu statischem HTML — FERTIG + VERIFIZIERT**

  PHP machte dort nur zwei Dinge: `t('key','fallback')` für i18n-Strings
  (Server-Side-Fallback vor dem ersten JS-Paint) und `include` zum
  Zusammenbauen der Seite. Das Frontend hat bereits ein vollwertiges
  JS-i18n-System (`i18n.js`), das alle `data-lang-key="..."`-Elemente beim
  Laden clientseitig übersetzt — `t()` war also nie der dauerhafte
  Übersetzungsmechanismus, nur der Erstanzeige-Fallback.

  **Bearbeitet (alle 31 Dateien, per Hintergrund-Agent mit präzisem Briefing,
  danach von mir selbst nochmal per Grep gegengeprüft):**
  alle 20 `booth/sections/*.php`, alle 9 `booth/editor/includes/*.php`,
  `booth/editor/editor.php`, `booth/index.php`.

  **Transformationsregeln, die angewendet wurden:**
  - `<?= t('key', 'fallback') ?>` → literaler `fallback`-Text (auch in
    HTML-Attributen wie `title=`/`placeholder=`/`aria-label=`),
    `data-lang-key="key"` bleibt unverändert stehen (JS übersetzt zur Laufzeit)
  - `<?php include 'x.php'; ?>` → Inhalt der jeweils eingebundenen (bereits
    bereinigten) Datei direkt inline kopiert — rekursiv, "Blatt"-Dateien
    zuerst bereinigt, dann die Dateien die sie includen
  - SPDX-Lizenz-Header am Dateianfang → als HTML-Kommentar erhalten, nicht
    gelöscht
  - Cache-Buster `<?php echo time(); ?>` (47 Stellen in `index.php`) bzw.
    `$assetVersion` (14 Stellen in editor.php/head.php/scripts.php) →
    einheitlich fester String `20261127`
  - Ein `<?php include 'loading_svg.svg'; ?>` in `capture_sections.php` →
    SVG-Inhalt direkt inline eingebettet (byte-exakt gegen Original verifiziert)

  **Drei Sonderfälle wurden VOR dem Agenten-Lauf von mir selbst gelöst** (nicht
  vom Agenten anfassen lassen): In `active_event_settings.php` (2x) und
  `general_settings.php` (1x) berechnete PHP via `__DIR__`/`realpath()`
  installationsabhängige absolute Dateisystempfade (z.B.
  `C:\...\booth\activeTemplate\`) bei jedem Request neu. Diese drei Stellen
  haben jetzt `data-default-value=""` + `data-pb-dynamic-default="boothRoot/..."`
  und werden von einem neuen JS (`booth/src/js/app/pb_dynamic_defaults.js`,
  aufgerufen aus `app_bootstrap.js` direkt nach Config-Load, vor jedem
  Settings-Modal-Open) zur Laufzeit befüllt — holt `booth_root` von
  `/runtime` (Python-Server) und baut den Pfad OS-passend (`\` vs `/`) zusammen.

  **Finale Verifikation von mir (nicht nur Agenten-Selbstauskunft):**
  ```
  grep -c '<?php\|<?=' index.php editor/editor.php editor/includes/*.php sections/*.php
  grep -c "t('" index.php editor/editor.php editor/includes/*.php sections/*.php
  ```
  → beides 0 Treffer in allen 31 Dateien. Keine offenen `include`/`require`-Reste
  (die paar Grep-Treffer auf "require" waren Fließtext wie "may require
  restarting", keine PHP-Syntax).

  **Vom Agenten selbst gefundene & korrigierte eigene Fehler** (zur Info, nicht
  mehr offen): 3 Zahlen-Tippfehler beim SVG-Abschreiben (korrigiert, byte-exakt
  verifiziert), 3 verdoppelte Backslashes in einem Caddy-Webroot-Pfad-Beispieltext
  (korrigiert), ein zunächst übersehener `t()`-Call in `header.php` (in
  `header.php` selbst UND der schon inlinierten Kopie in `index.php` nachgezogen).

  **Bekannte, bewusst NICHT angefasste Altlast** (gehört zu Paket 6, nicht 5):
  `sections/template_editor.php` Zeile 35 (und die inlinierte Kopie davon in
  `index.php`) hat weiterhin
  `<iframe src="http://localhost:8050/editor/editor.php">` — hartkodierter
  Port UND `.php`-Dateiendung. Muss angefasst werden, sobald `editor.php` zu
  `editor.html` umbenannt wird bzw. wenn Caddy auf einen anderen Port als 8050
  laufen soll. Siehe Paket 6.

  **Nicht gemacht, bewusst zurückgestellt:** Dateien sind noch NICHT von
  `.php` zu `.html` umbenannt (Inhalt ist PHP-frei, Dateiname/Endung noch alt).
  Das gehört zu Paket 6, weil es mit der Caddy-Konfiguration zusammenhängt
  (welche Datei wird als Startseite ausgeliefert, `try_files`/`index`-Direktive).

---

## Noch offen — NICHT begonnen, nur geplant (auf Zuruf starten)

- [ ] **Paket 6: Caddyfile anpassen + Dateien umbenennen**
  - **WICHTIG, zuerst prüfen:** `booth/src/js/app/pb_dynamic_defaults.js`
    existiert bereits (aus Paket 5), ist aber noch NIRGENDWO per
    `<script src="...">` eingebunden — lädt also aktuell nie. Ohne diese
    Einbindung bleiben die 3 dynamischen Pfad-Felder aus Paket 5 (Photo
    storage folder, active_event config_path, General Settings
    Active-Template-Path + Render-Config-Path) dauerhaft leer. Muss als
    `<script src="src/js/app/pb_dynamic_defaults.js?v=20261127">`-Tag in
    `index.html` ergänzt werden (gleiche Stelle wie die anderen
    `src/js/app/*.js`-Includes, nach `app_bootstrap.js`, da
    `pb_dynamic_defaults.js` von dort aus aufgerufen wird). Ohne diesen
    Schritt ist Paket 5 funktional unvollständig, auch wenn der PHP-Code
    schon weg ist.
  - `Caddy/Caddyfile`: `php_fastcgi 127.0.0.1:{$PHP_PORT}`-Block entfernen
  - `index.php` → `index.html`, `editor/editor.php` → `editor/editor.html`
    umbenennen (Inhalt ist schon PHP-frei)
  - `sections/template_editor.php` (und die inlinierte Kopie in `index.html`):
    `<iframe src="http://localhost:8050/editor/editor.php">` fixen — Port
    nicht mehr hartkodieren (z.B. `window.location.origin` nutzen) UND auf
    `editor.html` umstellen
  - Root bleibt `booth` (file_server liefert jetzt `index.html` statt
    `index.php` — prüfen ob Caddy automatisch `index.html` als Startdatei
    nimmt, oder ob eine explizite `try_files`/`index`-Direktive nötig ist)
  - `/api/*`-Pfad an Python (Port 8053) weiterleiten — WICHTIG: alle meine
    Python-Routen in `webapi/routes.py` registrieren sich bereits mit vollem
    Pfad `/api/...` (kein Prefix-Strip wie bei `/pyapi/*`), daher
    `reverse_proxy` OHNE `handle_path`, sondern mit normalem `handle` + Pfad-Matcher
  - Alle anderen übrig gebliebenen, nie zu diesem Projekt gehörenden
    PHP-Dateien in `booth/` (die restlichen `api/*.php`, falls noch
    vorhanden) können nach erfolgreichem Test gelöscht werden — NICHT vorher,
    erst nach Paket 8

- [ ] **Paket 7: `launcher/start.ps1` PHP-Start-Block entfernen**
  - Ab Kommentar "PHP START" (~Zeile 477+ vor den Paket-4c-Änderungen, Zeile
    verschiebt sich): `php-cgi.exe`-Start-Block entfernen/auskommentieren
  - `$PhpExe`/`$PhpIni`-Existenzprüfungen (die aktuell mit `throw` abbrechen,
    wenn PHP fehlt) ebenfalls entfernen, sonst startet gar nichts mehr sobald
    der `php/`-Ordner weg ist
  - `stop.ps1`: PHP-Stop-Block (`[4] PHP (exakter Pfad)`, `[5] PHP
    (Port-Fallback)`) kann bleiben (stoppt einfach nichts, wenn PHP nicht
    mehr existiert) oder ebenfalls entfernt werden — unkritisch
  - **Scope-Hinweis:** Das ist der zweite (und letzte geplante) Launcher-Eingriff
    dieser Migration, zusätzlich zu Paket 4c. Vorher kurz beim Nutzer
    bestätigen, nicht automatisch.

- [ ] **Paket 8: Echter Browser-Test**
  - App starten (nach Paket 6+7), im Browser durchklicken:
    - Haupt-Capture-Flow (Fotos aufnehmen)
    - General Settings öffnen/speichern (inkl. der 3 dynamischen
      Pfad-Defaults aus Paket 5 — prüfen ob sie sich korrekt befüllen)
    - Template Editor: Liste laden, Template speichern, Export
      (ZIP-Download), Import (ZIP-Upload), Asset-Upload, Set-Active,
      Test-Druck (iframe + `/pyapi/print/test`)
    - Active Event: ZIP-Upload (set_active_template), Foto-Zähler
    - Drucker: Test-Druck, Papier-Restmenge
    - Photo-Explorer (list_folders)
    - Settings: Python-Server Start/Stop-Button (Watchdog-Mechanismus) —
      Hauptserver manuell killen, über UI "Start" klicken, prüfen ob er
      wieder hochkommt

---

## Referenz: Alle 19 portierten API-Endpunkte

| Alt (PHP)                                   | Neu (Python, in `webapi/routes.py`)       | Methode | Hinweis |
|---------------------------------------------|--------------------------------------------|---------|---------|
| `api/r_w_config.php`                        | `rw_config_get` / `rw_config_post`         | GET/POST| generischer JSON-Config-R/W unter `booth/config/` |
| `api/list_folders.php`                      | `list_folders`                             | GET     | Foto-Explorer Ordnerliste |
| `api/list_active_templates.php`             | `list_active_templates`                    | GET     | Slots in `activeTemplate/` |
| `api/read_count_of_photos.php`              | `read_count_of_photos`                     | GET     | liest `anzahl_an_foto` aus template.xml |
| `api/template_info.php`                     | `template_info`                            | GET     | photo_count + width/height/greenwall |
| `api/session_snapshot.php`                  | `session_snapshot`                         | POST    | schreibt session.json atomar |
| `api/set_Active_template.php`               | `set_active_template`                      | POST multipart | ZIP-Upload (mehrere Templates → Slots 1,2,3...) |
| `api/template_set_active.php`               | `template_set_active`                      | POST    | kopiert `templates/<name>/` → `activeTemplate/1/` |
| `api/template_editor_lade_config.php`       | `template_editor_lade_config`              | GET     | liest `config/config.json` (lang) |
| `api/template_editor_save_config.php`       | `template_editor_save_config`              | POST    | schreibt `config/config.json` (lang) |
| `api/template_editor_list_projects.php`     | `template_editor_list_projects`            | GET     | listet `templates/*/template.xml` |
| `api/template_editor_save.php`              | `template_editor_save`                     | POST    | schreibt template.xml aus layers[] |
| `api/template_editor_export.php`            | `template_editor_export`                   | POST → ZIP bytes | zippt ganzen Template-Ordner |
| `api/template_editor_import.php`            | `template_editor_import`                   | POST multipart | ZIP rein, XML parsen, layers[] raus |
| `api/template_editor_upload_asset.php`      | `template_editor_upload_asset`             | POST multipart | einzelnes Bild-Asset hochladen |
| `api/python_server_restart.php`             | **entfällt**                               | —       | Bootstrap-Skript, nicht mehr nötig (Watchdog übernimmt) |
| `api/test_print.php`                        | **entfällt**, nutzt natives `/print/test`  | —       | `templateName`→`template_dir` via `resolve_template_dir_for_name()` |
| `api/cors.php`                              | **entfällt** (CORS macht `Handler._cors()` in python_server.py bereits für alle Routen) | — | |
| `api/main_functions.php`                    | **entfällt** (war nur `t()`, s. Paket 5)   | —       | kein API-Endpunkt |

---

## Neue/geänderte Dateien — Gesamtübersicht

**Neu:**
- `booth/tools/python_portable/webapi/__init__.py`
- `booth/tools/python_portable/webapi/config_io.py`
- `booth/tools/python_portable/webapi/multipart.py`
- `booth/tools/python_portable/webapi/routes.py`
- `booth/tools/python_portable/watchdog_server.py`
- `booth/src/js/app/pb_dynamic_defaults.js` (**muss noch in `index.php`/
  `index.html`s Script-Liste eingebunden werden — siehe Paket 6, aktuell
  NICHT in index per `<script src=...>` referenziert, sonst lädt es nie!**)

**Geändert:**
- `booth/tools/python_portable/python_server.py` (Import-Block, `_send_bytes`,
  GET/POST-Routing, `/runtime` liefert `watchdog_port` + `booth_root`,
  `/print/test` akzeptiert `templateName`)
- `booth/tools/python_portable/server_config.json` (`WatchdogPort` ergänzt)
- `launcher/start.ps1`, `launcher/stop.ps1` (Watchdog Start/Stop)
- Diverse `booth/src/js/**/*.js` (Pfade ohne `.php`, `startViaWatchdog`)
- Alle 20 `booth/sections/*.php`, alle 9 `booth/editor/includes/*.php`,
  `booth/editor/editor.php`, `booth/index.php` (PHP-frei)
- `booth/editor/js/te_app_core.js` (test_print → `/pyapi/print/test`)

**Noch unverändert, aber bald irrelevant (Paket 6/7):**
- `Caddy/Caddyfile` (hat noch `php_fastcgi`-Block)
- `php/` Ordner (php-cgi.exe, php.ini — kann nach Paket 8 gelöscht werden)
- `launcher/start.ps1` PHP-Start-Block (Paket 7)

---

## Wie man nach einem neuen Chat weitermacht

1. Diese Datei lesen.
2. "Noch offen"-Abschnitt oben = die verbleibende Arbeit. Mit Paket 6 einsteigen.
3. **WICHTIG, bevor Paket 6 begonnen wird:** `pb_dynamic_defaults.js` muss noch
   per `<script src="...">`-Tag in `index.html` (ehemals `index.php`)
   eingebunden werden — aktuell existiert die Datei nur, wird aber nirgendwo
   geladen. Ohne das bleiben die 3 dynamischen Pfad-Felder aus Paket 5 leer.
4. Nach jedem abgeschlossenen Paket: Checkbox hier auf `[x]` setzen, kurze
   Notiz ergänzen (wie oben bei Paket 1-5 vorgemacht).
5. **Nicht automatisch alle Pakete am Stück durchziehen** — der Nutzer hat
   ausdrücklich gebeten, zwischendurch zu stoppen und den Stand zu besprechen.
