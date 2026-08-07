// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ===========================================================
 * camera_keepalive.js
 * -----------------------------------------------------------
 * Verhindert die Kamera-Aufwärmverzögerung beim Capture-Start,
 * indem die Kamera im Hintergrund regelmäßig aktiv gehalten wird.
 *
 * Problem: DSLRs gehen nach kurzer Inaktivität in den Energiesparmodus.
 * Der erste liveviewStart nach dem Schlafen dauert dann 10–15 Sekunden.
 *
 * Lösung: Alle INTERVAL_MS Sekunden einen stillen liveviewStart senden.
 * Der Worker ignoriert den Aufruf, wenn LiveView ohnehin läuft — er
 * weckt die Kamera aber auf, bevor sie einschläft.
 *
 * Beim Programmstart wird zusätzlich einmalig nach WARMUP_DELAY_MS
 * ein Warmup ausgelöst, damit auch der erste Capture ohne Verzögerung
 * funktioniert.
 * =========================================================== */
(function () {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  // Kamera schläft typisch nach 30–60 s ein → alle 45 s anfassen
  const INTERVAL_MS = 45_000;

  // Beim Programmstart: kurz warten bis Bridge + Kamera bereit sind,
  // dann einmalig aufwecken (bevor der erste User-Klick kommt)
  const WARMUP_DELAY_MS = 8_000;

  let _timer = null;
  let _started = false;

  function isSafeToRun() {
    // Nicht eingreifen wenn ein Capture läuft
    if (PB.captureFlow?.isRunning?.()) return false;

    // Bridge muss erreichbar sein und eine Kamera selektiert haben
    const h = PB._bridgeLastHealth;
    if (!h || h.webserverReachable !== true) return false;
    if (!h.selected) return false;

    // Läuft LiveView bereits, ist nichts zu tun. WICHTIG bei Nikon: der Worker
    // behandelt liveviewStart() dort NICHT als No-op, sondern stoppt/startet die
    // Session hart neu (siehe CameraHost.StartLiveView). Ein Ping alle 45s hätte
    // sonst ungewollt regelmäßige Hard-Restarts der laufenden Session zur Folge
    // und kann nach ein paar Zyklen ohne jeden Auslöser in "MTP device busy" enden.
    if (h.liveViewRunning === true) return false;

    return true;
  }

  function ping() {
    if (!isSafeToRun()) return;

    PB.captureApi?.liveviewStart?.().catch(() => {});
  }

  function start() {
    if (_started) return;
    _started = true;

    // Einmaliger Warmup kurz nach Programmstart
    setTimeout(ping, WARMUP_DELAY_MS);

    // Danach regelmäßig wiederholen
    _timer = setInterval(ping, INTERVAL_MS);
  }

  function stop() {
    if (_timer) {
      clearInterval(_timer);
      _timer = null;
    }
    _started = false;
  }

  PB.cameraKeepalive = { start, stop };

  // Automatisch starten sobald alle Configs geladen sind
  // (Bridge-Polling läuft ab pb:configLoaded, also ist _bridgeLastHealth
  //  nach pb:allConfigsLoaded meist schon befüllt)
  if (typeof jQuery !== "undefined") {
    jQuery(document).on("pb:allConfigsLoaded.keepalive", function () {
      PB.cameraKeepalive.start();
    });
  }

  // Fallback: Falls pb:allConfigsLoaded schon gefeuert hat (Script-Ladereihenfolge)
  if (window.PB._configsLoaded) {
    PB.cameraKeepalive.start();
  }
})();
