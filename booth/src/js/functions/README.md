# functions.js Split — Bridge-only (JS -> 127.0.0.1:8052)


✅ **Frontend (JS) spricht direkt mit dem lokalen API-Server** (`PB.API_BASE`, default `http://127.0.0.1:8052`)  

## Empfohlene Einbindung (Reihenfolge!)
```html
<script src="js/functions/pb_core.js"></script>
<script src="js/functions/config_io.js"></script>
<script src="js/functions/edit_config.js"></script>
<script src="js/functions/i18n.js"></script>

<!-- Einheitlicher JSON-Client für den lokalen API-Server -->
<script src="js/functions/bridge_api.js"></script>

<!-- Bridge UI + Device Selection (Dropdown, Refresh, Offline-Hint) -->
<script src="js/functions/camera_bridge.js"></script>

<!-- Preview (Webcam oder Kamera-IFrame) -->
<script src="js/functions/preview.js"></script>

<!-- Preview-Source List + Wrapper für refreshUnifiedDeviceDropdown -->
<script src="js/functions/devices.js"></script>

<script src="js/functions/main_screen.js"></script>
<script src="js/functions/capture_flow.js"></script>
<script src="js/functions/unlock.js"></script>
<script src="js/functions/windows_api.js"></script>

<!-- Dieses File darf Side-Effects haben -->
<script src="js/functions/app_init.js"></script>
```

## Erwartete Bridge-Endpunkte (minimal)
- `POST /api/refresh`
- `GET  /api/cameras`
- `POST /api/select?id=<id>`

## Optional/empfohlen (wenn du Capture ebenfalls über die Bridge willst)
- `POST /api/capture` (Body JSON, z. B. `{ "slot": 1 }`)
- `GET  /api/photo-count` (oder Count aus Template-Config im Browser)

## Hinweise
- `capture_flow.js` ist bereits auf `PB.bridge.capture()` umgestellt (Fallback: direkter fetch gegen `${PB.API_BASE}/api/capture`).

