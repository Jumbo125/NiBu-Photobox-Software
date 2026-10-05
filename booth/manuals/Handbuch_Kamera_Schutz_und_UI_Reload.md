# Handbuch: Kamera-Schutz (LiveView) und UI-Reload-Timer

SPDX-License-Identifier: AGPL-3.0-or-later
Copyright (c) 2026 Andreas Rottmann

## Überblick

Dieses Dokument beschreibt die drei Mechanismen, die zusammen dafür sorgen,
dass die Kamera bei langen Events (Dauerbetrieb, mehrere Stunden) nicht durch
permanenten LiveView-Betrieb überhitzt oder in den Nikon-Hardware-Autostop
läuft, und dass die Web-Oberfläche (Browser/Electron) regelmäßig einen
sauberen Zustand behält.

Beteiligte Dateien:

- `booth/src/js/app/liveview_autopause.js` — Kamera-Schutz (zwei Timer)
- `booth/src/js/app/UI_Browser_watchdog.js` — UI-Reload-Timer
- `booth/sections/camera_settings.php` — UI-Formular (Camera Settings Modal)
- `booth/src/js/functions/edit_config.js` — Form↔Config-Binding (inkl. `data-sync-parm`)
- `booth/config/config/camera_config.json` — Config-Werte `camera_settings.*`
- `booth/config/config/general_config.json` (bzw. entsprechende general-Config) — `system.ui_watchdog_minutes`

---

## 1. Die beiden Kamera-Schutz-Timer

Beide Timer leben im selben Modul (`liveview_autopause.js`) und laufen
unabhängig voneinander. Beide werden aktuell über **ein einziges UI-Feld**
gesteuert (siehe Abschnitt 3), können aber technisch unterschiedliche Werte
in der Config haben.

### 1.1 `liveview_max_runtime_minutes` — harter Schutz (primär)

**Zweck:** Absolute Obergrenze für die Dauer, die LiveView am Stück laufen
darf — unabhängig davon, ob currently `liveview_always_active` an oder aus
ist, und unabhängig davon, ob gerade aktiv fotografiert wird oder nicht.

**Config:** `camera.camera_settings.liveview_max_runtime_minutes`
- `0` = deaktiviert (Default)
- `>0` = Minuten Dauerbetrieb bis Zwangsstopp

**Wie es funktioniert:**
1. Ein `pb:bridgeHealth`-Listener beobachtet `liveViewRunning` (kommt von der
   CameraBridge, alle ~5s gepollt).
2. Sobald `liveViewRunning` von `false` auf `true` wechselt, wird der
   aktuelle Zeitstempel unter dem Schlüssel `pb_liveviewMaxRuntime_startedAtTs`
   in `sessionStorage` gespeichert (`markRuntimeStarted()`).
3. Ein `setInterval` (alle 30s) vergleicht `Date.now()` mit diesem
   gespeicherten Startzeitpunkt. Überschreitet die Differenz
   `liveview_max_runtime_minutes * 60000`, wird `forceStopForMaxRuntime()`
   ausgeführt.
4. `forceStopForMaxRuntime()`:
   - bricht ab, falls gerade ein Capture läuft (`PB.captureFlow.isRunning()`)
     — wird beim nächsten Intervall-Tick erneut versucht,
   - stoppt LiveView über `PB.captureApi.liveviewStop()`,
   - zeigt das Preview-Overlay (`PB.preview.showOverlay()`),
   - setzt `PB.captureFlow._liveviewWarm = false`, damit beim nächsten
     Capture der normale Warmup-Pfad wieder greift,
   - löscht den `sessionStorage`-Eintrag.
5. Wechselt `liveViewRunning` wieder auf `false` (z.B. durch diesen Stopp
   oder durch die Inaktivitäts-Pause unten), wird der Zeitstempel ebenfalls
   gelöscht.
6. Startet LiveView später erneut (z.B. beim nächsten Capture), beginnt der
   Zähler wieder bei 0.

**Wichtig — Reload-fest:** Der Startzeitpunkt steht in `sessionStorage`,
nicht nur in einer JavaScript-Variablen. Ein Seiten-Reload (z.B. durch den
UI-Reload-Timer, siehe Abschnitt 2) verwirft die bereits verstrichene
Laufzeit **nicht** — der Zähler zählt nach dem Reload korrekt weiter, bis
das Limit erreicht ist.

### 1.2 `liveview_auto_pause_minutes` — weicher Schutz (sekundär / Plan B)

**Zweck:** Pausiert LiveView nach X Minuten **Inaktivität** (kein Capture),
aber nur wenn `liveview_always_active = true` gesetzt ist. Dient als
zusätzliche Absicherung, falls der harte Max-Runtime-Schutz aus irgendeinem
Grund nicht greift.

**Config:** `camera.camera_settings.liveview_auto_pause_minutes`
- `0` = deaktiviert (Default)
- `>0` = Minuten Inaktivität bis Auto-Pause

**Wie es funktioniert:**
1. Bei folgenden Events wird der Inaktivitäts-Zeitpunkt neu gesetzt
   (`reset()` → `markInactiveSince(Date.now())`, gespeichert in
   `sessionStorage` unter `pb_liveviewAutopause_inactiveSinceTs`):
   - `pb:allConfigsLoaded` (Programmstart / Reload)
   - `pb:captureFlowDone` (Capture-Serie abgeschlossen)
2. Bei `pb:captureSessionStarted` (Capture beginnt) wird der Zeitpunkt
   gelöscht (`cancel()`) — während eines Captures gilt keine Inaktivität.
3. Ein `setInterval` (alle 15s) prüft, ob seit dem gespeicherten Zeitpunkt
   mehr Zeit vergangen ist als `liveview_auto_pause_minutes * 60000`. Wenn
   ja UND `liveview_always_active = true` UND kein Capture läuft →
   `pause()`.
4. `pause()` stoppt LiveView genauso wie `forceStopForMaxRuntime()`
   (`liveviewStop()`, Overlay, `_liveviewWarm = false`).

**Wichtig:** Dieser Timer ist bewusst **nur aktiv, wenn
`liveview_always_active = true`** ist — läuft LiveView nicht dauerhaft,
braucht es auch keine Inaktivitäts-Pause. Für den Fall, dass LiveView aus
anderen Gründen dauerhaft läuft (z.B. `liveview_always_active = false`,
aber LiveView bleibt durch andere Code-Pfade lange aktiv), ist ausschließlich
`liveview_max_runtime_minutes` zuständig — dieser prüft immer, unabhängig
von `liveview_always_active`.

**Auch reload-fest:** Genau wie beim Max-Runtime-Timer steht der
Referenz-Zeitpunkt in `sessionStorage`, ein Reload verwirft die bereits
verstrichene Inaktivitätszeit nicht.

### 1.3 Warum zwei Timer statt einem?

- **Max-Runtime** ist die zuverlässige, immer aktive Sicherheitsgrenze
  (Plan A) — sie schützt auch bei durchgehend aktivem Fotografieren, bei
  dem ein reiner Inaktivitäts-Timer nie auslösen würde.
- **Auto-Pause** ist eine zusätzliche, weichere Ebene (Plan B), die früher
  eingreift, wenn tatsächlich Leerlauf herrscht und `liveview_always_active`
  aktiv ist.
- Beide zusammen ergeben eine redundante Absicherung: fällt ein Mechanismus
  aus (z.B. weil `liveview_always_active` versehentlich falsch konfiguriert
  ist), greift der andere trotzdem.

---

## 2. UI-Reload-Timer (`UI_Browser_watchdog.js`)

**Wichtig:** Dieser Mechanismus reagiert **nicht** auf Fehler in der
CameraBridge oder der Kamera-Anbindung. Die CameraBridge ist ein
eigenständiger Prozess (kompilierte EXE), der komplett unabhängig vom
Browser/der Web-UI läuft. Ein Reload der Web-Seite hat keinerlei Einfluss
auf die CameraBridge — sie läuft während eines Reloads einfach weiter.

**Zweck:** Reine Browser-/UI-Stabilität. Lädt die Web-Oberfläche in festen
Abständen neu, um langfristig angesammelten Browser-Zustand (Memory,
hängende Timer/Requests, DOM-Reste) aufzuräumen — relevant bei
Dauerbetrieb über viele Stunden (Kiosk-Charakter der Photobox-Anwendung).

**Config:** `general.system.ui_watchdog_minutes`
- `0` = deaktiviert
- `>0` = Minuten zwischen zwei Reloads

**Wie es funktioniert:**
1. Der letzte Reload-Zeitpunkt steht in `sessionStorage`
   (`pb_uiReloadTimer_lastReloadTs`). Beim allerersten Start einer
   Browser-Session wird `Date.now()` als Referenz gesetzt.
2. Ein `setInterval` (alle 60s) prüft, ob seit dem letzten Reload mehr Zeit
   vergangen ist als `ui_watchdog_minutes * 60000`.
3. Läuft gerade ein Capture (`PB.captureFlow.isRunning()`), wird der Reload
   verschoben — er wird beim nächsten Check (nach Capture-Ende) nachgeholt.
4. Beim tatsächlichen Reload:
   - LiveView wird sauber gestoppt (`PB.stopLiveviewForUiAction(...)` bzw.
     Fallback über `liveviewStop()`),
   - der neue Reload-Zeitpunkt wird in `sessionStorage` geschrieben,
   - `location.reload()` wird aufgerufen (kompletter Browser-Reload der
     Seite, kein Teil-Refresh).

**Historie / warum umbenannt:** Ursprünglich hieß dieser Mechanismus
"Watchdog" und reagierte auf `framesActive` (kein aktives LiveView-Bild seit
X Minuten → Reload). Das führte zu einer ungewollten Wechselwirkung: Wenn
`liveview_auto_pause_minutes` LiveView absichtlich pausierte, interpretierte
der alte Watchdog das fälschlich als "UI eingefroren" und reloadete die
Seite, was wiederum den (damals nicht persistenten) Auto-Pause-Timer auf 0
zurücksetzte — ein sich selbst verstärkendes Problem, bei dem lange
Auto-Pause-Werte (z.B. 40 min) nie zum Zug kamen, wenn `ui_watchdog_minutes`
kürzer war (z.B. 5 min). Der Mechanismus wurde daher auf ein festes,
inaktivitätsunabhängiges Zeit-Intervall umgestellt, und beide
Kamera-Schutz-Timer wurden reload-fest gemacht (`sessionStorage` statt
reiner JS-Variable).

---

## 3. UI-Einstellung (Camera Settings Modal)

In den Kamera-Einstellungen (`booth/sections/camera_settings.php`) gibt es
**ein** sichtbares Eingabefeld:

> **"Camera protection: stop LiveView after (minutes)"**
> (`overlay.camera_settings.liveview_max_runtime.label`)

Dieses Feld ist an `camera.camera_settings.liveview_max_runtime_minutes`
gebunden (`data-json-parm`) und schreibt beim Speichern **zusätzlich**
denselben Wert nach `camera.camera_settings.liveview_auto_pause_minutes`
(über das Attribut `data-sync-parm="liveview_auto_pause_minutes"`).

**Technisch:** `PB.formToPatch()` in `edit_config.js` unterstützt das
Attribut `data-sync-parm` generisch — ein Feld kann damit seinen Wert beim
Speichern zusätzlich unter einem zweiten Config-Pfad ablegen, ohne dass
dafür ein zweites (z.B. verstecktes) Formular-Element nötig ist. Das ist
wichtig: ein früherer Ansatz mit einem zusätzlichen versteckten `<input>`
für `liveview_auto_pause_minutes` führte zu einem Bug, bei dem das
versteckte Feld beim Speichern seinen eigenen (alten) Wert erneut in den
Patch schrieb und den frisch synchronisierten Wert wieder überschrieb —
seitdem gibt es nur noch das eine sichtbare Feld.

**Konsequenz für die Praxis:** Der Nutzer trägt nur eine Zahl ein
("nach X Minuten schützen"), im Hintergrund laufen aber weiterhin zwei
unabhängige, sich gegenseitig absichernde Mechanismen (siehe 1.1 und 1.2).

Der Wert für `ui_watchdog_minutes` (UI-Reload-Timer) ist aktuell **nicht**
über dieses Modal einstellbar und muss direkt in der general-Config
gesetzt werden.

---

## 4. Zusammenspiel — Beispielablauf

Angenommen: `liveview_max_runtime_minutes = 40`,
`liveview_auto_pause_minutes = 40` (durch das eine UI-Feld synchron),
`liveview_always_active = true`, `ui_watchdog_minutes = 5`.

1. LiveView startet (z.B. beim Programmstart durch `liveview_always_active`).
   → Max-Runtime-Zähler beginnt bei 0.
2. Alle 5 Minuten lädt der UI-Reload-Timer die Seite neu (sofern kein
   Capture läuft). Der Max-Runtime-Zähler bleibt davon unberührt
   (`sessionStorage` übersteht den Reload).
3. Fällt zwischendurch 40 Minuten am Stück keine Aktivität an (kein
   Capture) UND LiveView läuft die ganze Zeit → die Auto-Pause könnte vor
   Erreichen der 40 Minuten Max-Runtime bereits greifen, falls exakt in
   diesem Fenster keine Captures stattfanden (beide Zähler laufen parallel,
   der zuerst erreichte Grenzwert löst aus).
4. Bei durchgehend aktivem Fotografieren (z.B. alle 2 Minuten ein Foto) läuft
   die Auto-Pause nie ab (wird bei jedem `pb:captureFlowDone` zurückgesetzt),
   aber der Max-Runtime-Zähler läuft unbeeindruckt weiter und stoppt
   LiveView spätestens nach 40 Minuten Dauerbetrieb — das ist der Kernschutz
   gegen Kameraschäden bei Dauerbetrieb.
5. Nach einem Zwangsstopp (egal durch welchen der beiden Mechanismen)
   bleibt LiveView aus. Es startet erst wieder, wenn ein neues Capture
   beginnt — dann beginnen beide Zähler wieder bei 0.

---

## 5. Console-Log-Referenz (zum Debuggen / Testen)

| Log-Ausgabe | Bedeutung |
|---|---|
| `[liveview_autopause] LiveView pausiert nach Inaktivität.` | Auto-Pause hat ausgelöst (Inaktivität + `liveview_always_active`) |
| `[liveview_autopause] LiveView nach Laufzeitlimit zwangsweise gestoppt.` | Max-Runtime hat ausgelöst (Dauerbetrieb-Limit erreicht) |
| `[UI Reload Timer] enabled: reload every X min` | UI-Reload-Timer aktiv, Init-Log |
| `[UI Reload Timer] disabled (ui_watchdog_minutes = 0)` | UI-Reload-Timer deaktiviert |
| `[UI Reload Timer] X min erreicht – Seite wird neu geladen` | UI-Reload-Timer löst gerade aus |

## 6. Empfohlene Test-Vorgehensweise

Für einen schnellen, aussagekräftigen Test (nicht für den Produktivbetrieb):

```json
"liveview_always_active": true,
"liveview_max_runtime_minutes": 2,
"liveview_auto_pause_minutes": 2
```
```json
"ui_watchdog_minutes": 1
```

Erwarteter Ablauf: nach ~1 Minute reloadet die Seite einmal (UI Reload
Timer), nach ~2 Minuten Dauerbetrieb greift trotzdem der Max-Runtime-Stopp —
das belegt, dass der Zähler den zwischenzeitlichen Reload korrekt
übersteht. Nach dem Test die Werte wieder auf produktive Größenordnungen
zurückstellen (z.B. `liveview_max_runtime_minutes: 40-60`,
`ui_watchdog_minutes: 5-15`).
