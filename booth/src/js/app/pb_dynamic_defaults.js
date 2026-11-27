// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * pb_dynamic_defaults.js — befüllt [data-pb-dynamic-default] Felder.
 *
 * Ersetzt, was früher PHP (__DIR__/realpath) bei jedem Seitenaufruf live
 * berechnet hat: absolute, installationsabhängige Dateisystempfade
 * (z.B. "C:\...\booth\activeTemplate\"). Ohne PHP gibt es keinen
 * Server-Prozess mehr, der das HTML vor dem Ausliefern generiert — daher
 * wird der Pfad hier einmalig beim Start aus /runtime (booth_root) geholt
 * und in die betroffenen <input>-Felder geschrieben, BEVOR
 * PB.applyConfigToForm läuft (das data-default-value liest, wenn die
 * gespeicherte Config noch keinen Wert hat).
 *
 * data-pb-dynamic-default="boothRoot/activeTemplate/" -> "boothRoot/" wird
 * durch den tatsächlichen booth_root ersetzt, Separatoren OS-passend.
 */
(function () {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  function joinBoothPath(boothRoot, rel) {
    const isWindows = boothRoot.indexOf("\\") !== -1;
    const sep = isWindows ? "\\" : "/";
    const base = boothRoot.replace(/[\\/]+$/, "");
    const relNorm = rel.replace(/\//g, sep);
    const trailingSep = /\/$/.test(rel) ? sep : "";
    return base + sep + relNorm.replace(/[\\/]+$/, "") + trailingSep;
  }

  async function fetchBoothRoot() {
    try {
      const port = Number(PB?.pythonSvc?.port) || 8053;
      const r = await fetch(`http://127.0.0.1:${port}/runtime`, { cache: "no-store" });
      if (!r.ok) return "";
      const j = await r.json();
      return String(j?.booth_root || "").trim();
    } catch (_) {
      return "";
    }
  }

  PB.applyDynamicDefaults = PB.applyDynamicDefaults || async function () {
    const $fields = $("[data-pb-dynamic-default]");
    if (!$fields.length) return;

    const boothRoot = await fetchBoothRoot();
    if (!boothRoot) {
      console.warn("[pb_dynamic_defaults] booth_root nicht ermittelbar (Python-Server nicht erreichbar?)");
      return;
    }

    $fields.each(function () {
      const $el = $(this);
      const spec = String($el.attr("data-pb-dynamic-default") || "").trim();
      if (!spec.startsWith("boothRoot/")) return;

      const rel = spec.slice("boothRoot/".length);
      const value = joinBoothPath(boothRoot, rel);

      $el.attr("data-default-value", value);
      if ($el.is("[value]") || $el.prop("tagName") === "INPUT") {
        $el.val(value);
      }
      if ($el.is("[data-photos-base]")) {
        $el.attr("data-photos-base", value);
      }

      const $display = $("#" + $el.attr("id") + "Display");
      if ($display.length && !$display.val()) {
        $display.attr("placeholder", value + "…");
      }
    });
  };
})();
