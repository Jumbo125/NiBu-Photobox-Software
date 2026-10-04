/* SPDX-License-Identifier: AGPL-3.0-or-later
 * Copyright (c) 2026 Andreas Rottmann
 * ============================================================================
 * coin_print_flow.js — Münz-Print-Flow im Finish-Screen (Capture_finish_with_img)
 *
 * Ist der Münzzähler aktiviert (PB.creditState.coinEnabled === true, siehe
 * pico_status_poll.js), überspringt capture_flow.js den automatischen
 * Druck (Phase 5) und ruft stattdessen PB.initCoinPrintArea() auf, bevor
 * der Finish-Screen angezeigt wird. Dieses Modul zeigt dort:
 *   - den aktuellen Saldo (reagiert auf pb:creditStatus, das
 *     pico_status_poll.js alle 2s feuert -- reicht aus, damit ein frisch
 *     eingeworfener Coin zügig den Druckbutton freischaltet)
 *   - einen Druckbutton, aktiv sobald Saldo >= Preis
 *   - einen "Neues Foto"-Button, der das Overlay schließt (ersetzt den
 *     generischen Close-Button, solange der Coin-Flow aktiv ist -- das
 *     Overlay darf nicht automatisch/vorzeitig verschwinden, siehe Hinweis
 *     bei show_finish_image_seconds in general_settings.php)
 *
 * Nach einem erfolgreichen Druck bleibt der Finish-Screen bewusst offen
 * (nicht: automatisch schließen) -- der Nutzer kann bei ausreichendem
 * Saldo mehrfach drucken, bis er aktiv "Neues Foto" klickt.
 * ============================================================================
 */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  const tr = (key, fallback) =>
    typeof pbT === "function" ? pbT(key, fallback) : fallback;

  let _active = false;
  let _printPayload = null; // { imagePath, eventConfigPath, copies }
  let _busy = false;

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

  PB.coinPrintApi = PB.coinPrintApi || {};

  PB.coinPrintApi.spendCredit = PB.coinPrintApi.spendCredit || async function spendCredit() {
    const port = getPythonPort();
    const url = `http://127.0.0.1:${port}/credit/spend`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      const json = await res.json().catch(() => null);
      if (!json) return { ok: false, error: "invalid_response" };
      return json;
    } catch (e) {
      return { ok: false, error: "request_failed", message: String(e) };
    }
  };

  function formatCredit(cent) {
    if (typeof cent !== "number" || !Number.isFinite(cent)) return "-";
    return (cent / 100).toFixed(2) + " EUR";
  }

  function updateButtonState() {
    if (!_active) return;

    const creditCent = PB.creditState?.creditCent;
    const printCostCent = PB.creditState?.printCostCent;

    const $balance = $("#coin_print_balance");
    const $cost = $("#coin_print_cost");
    const $btn = $("#coin_print_btn");
    const $hint = $("#coin_print_insufficient_hint");

    $balance.text(formatCredit(creditCent));

    if (typeof printCostCent === "number" && printCostCent > 0) {
      $cost.text("(" + formatCredit(printCostCent) + ")");
    } else {
      $cost.text("");
    }

    const hasEnoughCredit =
      typeof creditCent === "number" &&
      typeof printCostCent === "number" &&
      printCostCent > 0 &&
      creditCent >= printCostCent;

    $btn.prop("disabled", _busy || !hasEnoughCredit);
    $hint.toggleClass("d-none", _busy || hasEnoughCredit || !printCostCent);
  }

  $(document).on("pb:creditStatus.coinPrintFlow", function () {
    updateButtonState();
  });

  async function handlePrintClick() {
    if (_busy || !_printPayload) return;
    _busy = true;
    updateButtonState();

    const $btn = $("#coin_print_btn");
    const oldHtml = $btn.html();
    $btn.html(tr("common.ellipsis", "…"));

    try {
      // Guthaben zuerst serverseitig abbuchen (403/402 falls deaktiviert
      // bzw. nicht ausreichend) -- verhindert, dass gedruckt wird, ohne
      // dass das Guthaben tatsächlich reicht (Server ist die Wahrheit,
      // nicht der zuletzt gepollte Frontend-Wert).
      const spendRes = await PB.coinPrintApi.spendCredit();

      if (!spendRes?.ok) {
        if (spendRes?.error === "insufficient_credit") {
          if (typeof PB.showMsg === "function") {
            PB.showMsg(
              tr("capture.finish.coin.insufficient", "Please insert more coins to print."),
              "warning",
            );
          }
        } else {
          if (typeof PB.showMsg === "function") {
            PB.showMsg(
              tr("capture.finish.coin.spend_failed", "Could not charge credit for printing."),
              "danger",
            );
          }
        }
        return;
      }

      const printPayload = {
        image_path: _printPayload.imagePath,
        event_file: _printPayload.eventConfigPath,
        copies: _printPayload.copies || 1,
      };

      const printRes = await PB.captureApi.printDefault(printPayload);

      if (!printRes?.ok) {
        if (typeof PB.showMsg === "function") {
          PB.showMsg(
            printRes?.message ||
              tr("capture.flow.err.reprint_failed", "Print failed."),
            "danger",
          );
        }
      }

      // Saldo-Anzeige aktualisiert sich über das nächste 2s-Poll-Tick von
      // selbst (pb:creditStatus) -- kein manueller Re-Fetch nötig.
    } finally {
      _busy = false;
      $btn.html(oldHtml);
      updateButtonState();
    }
  }

  function handleNewPhotoClick() {
    // Klickt programmatisch den (versteckten) generischen Close-Button des
    // Overlays -- löst denselben onClose-Callback aus wie das reguläre
    // Schließen (capture_flow.js: showFinishWithOptionalImage()).
    $("#Capture_finish_with_img [data-role='close']").trigger("click");
  }

  $(document)
    .off("click.pbCoinPrint", "#coin_print_btn")
    .on("click.pbCoinPrint", "#coin_print_btn", function (e) {
      e.preventDefault();
      handlePrintClick();
    });

  $(document)
    .off("click.pbCoinPrint", "#coin_print_new_photo_btn")
    .on("click.pbCoinPrint", "#coin_print_new_photo_btn", function (e) {
      e.preventDefault();
      handleNewPhotoClick();
    });

  PB.initCoinPrintArea = PB.initCoinPrintArea || function initCoinPrintArea({ imagePath, eventConfigPath, copies }) {
    _active = true;
    _busy = false;
    _printPayload = { imagePath, eventConfigPath, copies };

    $("#coin_print_area").removeClass("d-none");
    $("#coin_print_new_photo_area").removeClass("d-none");
    $("#capture_finish_close_area").addClass("d-none");

    updateButtonState();
  };

  PB.teardownCoinPrintArea = PB.teardownCoinPrintArea || function teardownCoinPrintArea() {
    _active = false;
    _busy = false;
    _printPayload = null;

    $("#coin_print_area").addClass("d-none");
    $("#coin_print_new_photo_area").addClass("d-none");
    $("#capture_finish_close_area").removeClass("d-none");
  };
})(jQuery);
