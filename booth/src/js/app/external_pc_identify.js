/* SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (c) 2026 Andreas Rottmann
 * ============================================================================
 * external_pc_identify.js — "Externer PC"-Bereich: Pi Pico Serial-Identify
 *
 * Findet/prüft die serielle Schnittstelle des Pi Pico (ToF-Presence /
 * Münzprüfer) über die Python-Endpoints /pi_pico/list_identify und
 * /pi_pico/check_identify und hält server_config.json (Gruppe "external_pc")
 * synchron. Quelle der Wahrheit ist der echte Zustand des seriellen Busses,
 * nicht ein evtl. veralteter Frontend-Wert.
 * ============================================================================
 */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  const tr = (key, fallback) =>
    typeof pbT === "function" ? pbT(key, fallback) : fallback;

  const SERVER_CONFIG_FILE = "../tools/python_portable/server_config.json";

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
      const err = new Error(json?.error || json?.message || `request_failed:${endpoint}`);
      err.code = json?.error;
      throw err;
    }
    return json;
  }

  function setPortField(port) {
    const el = document.getElementById("externalPcPort");
    if (el) el.value = port || "";
  }

  function setBadge(reachable) {
    const el = document.getElementById("pb-externalpc-status");
    if (!el) return;
    el.classList.remove("bg-success", "bg-danger", "bg-secondary");
    // data-lang-key auf den aktuellen Status-Key nachziehen, sonst überschreibt
    // PB.applyLanguage() (Sprachwechsel, Modal-Save) den Live-Text wieder mit dem
    // PHP-Template-Default -- siehe #pb-bridge-status-Bugfix, gleiches Muster hier.
    if (reachable === true) {
      el.classList.add("bg-success");
      el.textContent = tr("externalPc.badge.reachable", "reachable");
      el.setAttribute("data-lang-key", "externalPc.badge.reachable");
    } else if (reachable === false) {
      el.classList.add("bg-danger");
      el.textContent = tr("externalPc.badge.notFound", "not found");
      el.setAttribute("data-lang-key", "externalPc.badge.notFound");
    } else {
      el.classList.add("bg-secondary");
      el.textContent = tr("externalPc.badge.unknown", "unknown");
      el.setAttribute("data-lang-key", "externalPc.badge.unknown");
    }
  }

  async function savePort(port) {
    if (typeof PB.configFileSet !== "function") return;
    await new Promise((resolve, reject) => {
      const req = PB.configFileSet(SERVER_CONFIG_FILE, { external_pc: { serial_port: port } });
      if (req && typeof req.done === "function") {
        req.done((res) => (res && res.ok === false ? reject(res) : resolve(res))).fail(reject);
        return;
      }
      Promise.resolve(req).then(resolve).catch(reject);
    });

    window.PB_CONFIG = window.PB_CONFIG || {};
    window.PB_CONFIG.pythonServer = window.PB_CONFIG.pythonServer || {};
    window.PB_CONFIG.pythonServer.external_pc = window.PB_CONFIG.pythonServer.external_pc || {};
    window.PB_CONFIG.pythonServer.external_pc.serial_port = port;
  }

  /**
   * Voller Scan aller seriellen Ports. Bei Erfolg wird das Ergebnis nach
   * server_config.json (external_pc.serial_port) zurückgeschrieben.
   */
  PB.externalPcListIdentify = PB.externalPcListIdentify || async function externalPcListIdentify() {
    const json = await fetchPython("/pi_pico/list_identify");
    setPortField(json.port);
    setBadge(json.identified === true);
    if (json.identified && json.port) {
      try {
        await savePort(json.port);
      } catch (e) {
        console.warn("[externalPc] savePort failed:", e);
      }
    }
    return json;
  };

  /**
   * Prüft primär den gespeicherten Port, fällt bei Nichterreichbarkeit auf
   * einen vollen Scan zurück.
   *
   * Einzige Quelle für #pb-externalpc-status (Korrektur 2026-08-26): wird
   * NICHT mehr per Dauerpoll aufgerufen, sondern gezielt bei drei
   * Anlässen -- Bootstrap/Seitenladen, Öffnen des "Externer PC"-Modals,
   * nach dem Speichern der dortigen Einstellungen (siehe
   * initExternalPcIdentifyBindings unten). Grund: Der Presence-Reader-
   * Thread in pi_pico_core.py (dessen "connected"-Status vorher per
   * 2s-Poll ausgelesen wurde) reconnected nach einem Identify-Scan nicht
   * immer zuverlässig (Backoff bis 30s) -- ein Dauerpoll darauf führte zu
   * einem Badge, das kurz "reachable" zeigte und dann fälschlich wieder
   * auf "nicht gefunden" zurückfiel, obwohl das Gerät angeschlossen blieb.
   */
  PB.syncExternalPcIdentifyFromPython = PB.syncExternalPcIdentifyFromPython || async function syncExternalPcIdentifyFromPython() {
    const storedPort = String(
      PB._getDeep?.(window.PB_CONFIG, "pythonServer.external_pc.serial_port") ?? "",
    ).trim();

    if (storedPort) {
      try {
        const checked = await fetchPython(`/pi_pico/check_identify?port=${encodeURIComponent(storedPort)}`);
        setPortField(storedPort);
        if (checked.reachable === true) {
          setBadge(true);
          return { ok: true, port: storedPort, reachable: true };
        }
      } catch (e) {
        if (e?.code === "coin_enabled_identify_blocked") {
          // Erwartbar/harmlos: Identify wird bewusst übersprungen, solange
          // der Münzzähler aktiv ist (siehe python_server.py) -- kein
          // echter Fehler, daher kein console.warn und kein Badge-Wechsel
          // auf "nicht gefunden" (Zustand bleibt wie zuletzt bekannt).
          return { ok: false, error: "coin_enabled_identify_blocked" };
        }
        console.warn("[externalPc] check_identify failed:", e);
      }
    }

    try {
      const json = await fetchPython("/pi_pico/list_identify");
      setPortField(json.port);
      setBadge(json.identified === true);
      if (json.identified && json.port) {
        try {
          await savePort(json.port);
        } catch (e) {
          console.warn("[externalPc] savePort failed:", e);
        }
      }
      return json;
    } catch (e) {
      if (e?.code === "coin_enabled_identify_blocked") {
        return { ok: false, error: "coin_enabled_identify_blocked" };
      }
      console.warn("[externalPc] list_identify failed:", e);
      setBadge(null);
      return { ok: false, error: "identify_failed", details: e };
    }
  };

  PB.initExternalPcIdentifyBindings = PB.initExternalPcIdentifyBindings || function initExternalPcIdentifyBindings() {
    $(document)
      .off("click.pbExternalPcPortManual", "#btnExternalPcPortManual")
      .on("click.pbExternalPcPortManual", "#btnExternalPcPortManual", function (e) {
        e.preventDefault();

        const $input = $("#externalPcPort");
        const $btn = $(this);
        const manual = $input.prop("readonly");

        $input.prop("readonly", !manual);
        $btn.toggleClass("btn-outline-secondary", !manual).toggleClass("btn-warning", manual);
        $btn.attr("aria-pressed", manual ? "true" : "false");

        if (manual) $input.trigger("focus");
      });

    $(document)
      .off("click.pbExternalPcIdentify", "#btnExternalPcIdentify")
      .on("click.pbExternalPcIdentify", "#btnExternalPcIdentify", async function (e) {
        e.preventDefault();

        const $btn = $(this);
        const oldHtml = $btn.html();
        $btn.prop("disabled", true).text(tr("common.ellipsis", "…"));

        try {
          const res = await PB.externalPcListIdentify();
          if (typeof PB.showMsg === "function") {
            PB.showMsg(
              res.identified
                ? tr("externalPc.identify.found", "Pi Pico found.")
                : tr("externalPc.identify.notFound", "No Pi Pico found."),
              res.identified ? "success" : "warning",
            );
          }
        } catch (err) {
          console.warn("[externalPc] identify click failed:", err);
          if (typeof PB.showMsg === "function") {
            const msg =
              err?.code === "coin_enabled_identify_blocked"
                ? tr(
                    "externalPc.identify.blockedByCoin",
                    "Search is disabled while the coin counter is active — a coin insertion during the search could be missed. Disable the coin counter first.",
                  )
                : tr("externalPc.identify.error", "Search failed.");
            PB.showMsg(msg, "warning");
          }
        } finally {
          $btn.prop("disabled", false).html(oldHtml);
        }
      });

    // Beim Öffnen des "Externer PC"-Modals erneut prüfen, ob das Gerät
    // erreichbar ist (einer der drei Anlässe, siehe
    // syncExternalPcIdentifyFromPython() oben -- Ersatz für den
    // entfernten Dauerpoll).
    $(document)
      .off("shown.bs.modal.pbExternalPcModal", "#modalExternalPcSettings")
      .on("shown.bs.modal.pbExternalPcModal", "#modalExternalPcSettings", function () {
        if (typeof PB.syncExternalPcIdentifyFromPython === "function") {
          PB.syncExternalPcIdentifyFromPython().catch((e) => {
            console.warn("[externalPc] modal-open identify sync failed:", e);
          });
        }
      });

    // Nach dem Speichern der Einstellungen im "Externer PC"-Modal erneut
    // prüfen (dritter Anlass). Der generische Save-Handler in
    // modal_config_bindings.js ist bereits an .pb-save-config gebunden;
    // dieses zweite, eigene Binding auf denselben Button feuert zusätzlich
    // (jQuery ruft mehrere Handler für dasselbe Event der Reihe nach auf)
    // und wartet kurz, bis server_config.json geschrieben wurde, bevor es
    // erneut prüft.
    $(document)
      .off("click.pbExternalPcSaveResync", "#modalExternalPcSettings .pb-save-config")
      .on("click.pbExternalPcSaveResync", "#modalExternalPcSettings .pb-save-config", function () {
        setTimeout(() => {
          if (typeof PB.syncExternalPcIdentifyFromPython === "function") {
            PB.syncExternalPcIdentifyFromPython().catch((e) => {
              console.warn("[externalPc] post-save identify sync failed:", e);
            });
          }
        }, 500);
      });
  };

  $(function () {
    PB.initExternalPcIdentifyBindings();
  });
})(jQuery);
