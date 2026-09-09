/* SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (c) 2026 Andreas Rottmann
 * ============================================================================
 * pico_status_poll.js — Pollt /credit/status + /pico/status vom Python-Server
 * (Port 8053), zeigt den aktuellen Münzguthaben-Saldo in connection_info.php
 * an (#pb-credit-balance) und loggt erkannte ToF-/Coin-Ereignisse zum
 * Debuggen in die Browser-Konsole ([TOF]/[COIN]-Präfix).
 *
 * Zwei unabhängige Status-Anzeigen aus diesem Dauerpoll (jede reagiert nur
 * auf ihr eigenes Signal):
 *   - #pb-tof-status: ToF aktiviert/deaktiviert (tof_enabled)
 *   - #pb-credit-balance: Guthaben, durchgestrichen/"disabled" wenn der
 *     Münzzähler deaktiviert ist (coin_enabled)
 *
 * WICHTIG (Korrektur 2026-08-26): #pb-externalpc-status ("Gerät gefunden/
 * erreichbar") wird bewusst NICHT mehr aus diesem 2s-Dauerpoll gespeist.
 * Der Presence-Reader-Thread in pi_pico_core.py, dessen "connected"-Feld
 * hierfür genutzt wurde, ist selbst nicht immer stabil (Reconnect nach
 * einem Identify-Scan kann fehlschlagen und dann mit exponentiellem
 * Backoff bis zu 30s ausbleiben) — ein Dauerpoll auf dieses Feld führte zu
 * einem Badge, das kurz "reachable" zeigte und dann wieder auf "nicht
 * gefunden" zurückfiel, obwohl das Gerät real angeschlossen war/blieb.
 * Erreichbarkeit wird stattdessen nur noch gezielt geprüft: beim
 * Bootstrap/Seitenladen, beim Öffnen des "Externer PC"-Modals und nach dem
 * Speichern der Einstellungen dort (siehe external_pc_identify.js).
 *
 * Reines Anzeige-Feature (kein Health-Check) — einfacher Poller mit festem
 * Intervall, kein Backoff nötig: Bleibt der Python-Server kurz unerreichbar,
 * zeigt das Badge weiterhin den letzten bekannten Wert bzw. "unbekannt".
 * ============================================================================
 */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  const tr = (key, fallback) =>
    typeof pbT === "function" ? pbT(key, fallback) : fallback;

  const POLL_INTERVAL_MS = 2000;

  let _lastCreditCent = null;
  let _lastTriggerTs = null;
  let _lastCoinTs = null;
  let _lastTofEnabled = null;
  let _lastCoinEnabled = null;

  // Letzter bekannter Guthaben-Zustand, synchron für andere Module lesbar
  // (z.B. capture_flow.js: soll der Auto-Print übersprungen werden?).
  PB.creditState = PB.creditState || {
    creditCent: null,
    coinEnabled: null,
    printCostCent: null,
  };

  function getPythonPort() {
    try {
      if (PB.pythonUi && typeof PB.pythonUi.getPort === "function") {
        return PB.pythonUi.getPort();
      }
    } catch (_) {}

    const el = document.getElementById("settingPythonPort");
    const fromInput = parseInt(String(el?.value ?? ""), 10);
    if (Number.isFinite(fromInput) && fromInput > 0) return fromInput;

    return 8053;
  }

  async function fetchPython(endpoint) {
    const port = getPythonPort();
    const url = `http://127.0.0.1:${port}${endpoint}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json || json.ok === false) {
      throw new Error(json?.error || json?.message || `request_failed:${endpoint}`);
    }
    return json;
  }

  function formatCredit(cent) {
    return (cent / 100).toFixed(2) + " EUR";
  }

  // data-lang-key auf den aktuellen Status-Key nachziehen (bzw. entfernen, wenn
  // kein Übersetzungs-Key gilt, z.B. formatierter Geldbetrag), sonst überschreibt
  // PB.applyLanguage() (Sprachwechsel, Modal-Save) den Live-Text wieder mit dem
  // PHP-Template-Default -- siehe #pb-bridge-status-Bugfix, gleiches Muster hier.
  function setLangKey(el, langKey) {
    if (langKey) {
      el.setAttribute("data-lang-key", langKey);
    } else {
      el.removeAttribute("data-lang-key");
    }
  }

  function setCreditBadge(cent, coinEnabled) {
    const el = document.getElementById("pb-credit-balance");
    if (!el) return;

    el.classList.remove("bg-success", "bg-secondary");
    el.classList.toggle("text-decoration-line-through", coinEnabled === false);
    el.classList.toggle("opacity-50", coinEnabled === false);

    if (coinEnabled === false) {
      el.classList.add("bg-secondary");
      el.textContent = tr("externalPc.credit.disabled", "disabled");
      setLangKey(el, "externalPc.credit.disabled");
    } else if (typeof cent === "number") {
      el.classList.add("bg-success");
      el.textContent = formatCredit(cent);
      setLangKey(el, null);
    } else {
      el.classList.add("bg-secondary");
      el.textContent = tr("externalPc.credit.unknown", "-");
      setLangKey(el, "externalPc.credit.unknown");
    }
  }

  // #pb-tof-status: reagiert AUSSCHLIESSLICH auf tof_enabled (Toggle in
  // general_settings.php) -- unabhängig davon, ob das Gerät gerade
  // erreichbar ist oder nicht.
  function setTofEnabledBadge(tofEnabled) {
    const el = document.getElementById("pb-tof-status");
    if (!el) return;

    el.classList.remove("bg-success", "bg-secondary");

    if (tofEnabled === true) {
      el.classList.add("bg-success");
      el.textContent = tr("externalPc.tof.enabled", "enabled");
      setLangKey(el, "externalPc.tof.enabled");
    } else {
      el.classList.add("bg-secondary");
      el.textContent = tr("externalPc.tof.disabled", "disabled");
      setLangKey(el, "externalPc.tof.disabled");
    }
  }

  async function pollCreditStatus(coinEnabled) {
    try {
      const json = await fetchPython("/credit/status");
      const cent = Number(json.credit_cent);
      if (!Number.isFinite(cent)) return;

      // /credit/status liefert coin_enabled/print_cost_cent ebenfalls direkt
      // mit (server-autoritativ) -- als Fallback falls pollPicoStatus() den
      // Wert nicht liefern konnte (z.B. /pico/status kurzzeitig nicht erreichbar).
      const effectiveCoinEnabled = coinEnabled !== undefined ? coinEnabled : json.coin_enabled;
      const printCostCent = Number(json.print_cost_cent);

      setCreditBadge(cent, effectiveCoinEnabled);

      if (effectiveCoinEnabled !== false && _lastCreditCent !== null && cent !== _lastCreditCent) {
        const delta = cent - _lastCreditCent;
        console.log(
          "[COIN] balance changed: " + formatCredit(_lastCreditCent) + " -> " + formatCredit(cent) +
          " (" + (delta > 0 ? "+" : "") + delta + " cent)",
        );
      }
      _lastCreditCent = cent;

      PB.creditState.creditCent = cent;
      PB.creditState.coinEnabled = effectiveCoinEnabled === undefined ? null : effectiveCoinEnabled;
      PB.creditState.printCostCent = Number.isFinite(printCostCent) ? printCostCent : null;
      $(document).trigger("pb:creditStatus", [PB.creditState]);
    } catch (e) {
      // Python-Server evtl. nicht erreichbar oder credit_core nicht geladen -- Badge bleibt wie zuletzt bekannt.
    }
  }

  async function pollPicoStatus() {
    try {
      const json = await fetchPython("/pico/status");
      const status = json.status || {};

      const tofEnabled = status.tof_enabled;
      const coinEnabled = status.coin_enabled;

      setTofEnabledBadge(tofEnabled);

      if (tofEnabled !== _lastTofEnabled) {
        if (_lastTofEnabled !== null) {
          console.log("[TOF] " + (tofEnabled ? "enabled" : "disabled"));
        }
        _lastTofEnabled = tofEnabled;
      }
      if (coinEnabled !== _lastCoinEnabled) {
        if (_lastCoinEnabled !== null) {
          console.log("[COIN] " + (coinEnabled ? "enabled" : "disabled"));
        }
        _lastCoinEnabled = coinEnabled;
      }

      const triggerTs = status.last_trigger_ts;
      if (typeof triggerTs === "number" && triggerTs !== _lastTriggerTs) {
        if (_lastTriggerTs !== null && tofEnabled !== false) {
          console.log(
            "[TOF] liveview warmup triggered (distance=" + (status.last_distance_mm ?? "n/a") +
            "mm, in_range=" + status.in_range + ")",
          );
        }
        _lastTriggerTs = triggerTs;
      }

      const coinTs = status.last_coin_ts;
      if (typeof coinTs === "number" && coinTs !== _lastCoinTs) {
        if (_lastCoinTs !== null && coinEnabled !== false) {
          console.log("[COIN] coin event received (balance=" + formatCredit(status.last_credit_cent ?? 0) + ")");
        }
        _lastCoinTs = coinTs;
      }

      return coinEnabled;
    } catch (e) {
      // Python-Server evtl. nicht erreichbar -- nichts zu tun, nächster Tick versucht es erneut.
      return undefined;
    }
  }

  async function pollTick() {
    const coinEnabled = await pollPicoStatus();
    await pollCreditStatus(coinEnabled);
    PB._picoStatusPollTimer = setTimeout(pollTick, POLL_INTERVAL_MS);
  }

  PB.startPicoStatusPoll = PB.startPicoStatusPoll || function startPicoStatusPoll() {
    if (PB._picoStatusPollTimer) return;
    pollTick();
  };

  PB.stopPicoStatusPoll = PB.stopPicoStatusPoll || function stopPicoStatusPoll() {
    if (PB._picoStatusPollTimer) {
      clearTimeout(PB._picoStatusPollTimer);
      PB._picoStatusPollTimer = null;
    }
  };

  $(function () {
    PB.startPicoStatusPoll();
  });
})(jQuery);
