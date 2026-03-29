// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * Zweck: Bindet Change-Events an Device-Select/Webcam-Checkbox/Filter.
 * Handhabung: PB.bindUnifiedDeviceSelectionEvents();
 */
PB.bindUnifiedDeviceSelectionEvents = function () {
  // Legacy-Checkbox (falls noch im DOM): no-op
  $("#settingUseWebcam")
    .off("change.pbDeviceUnified")
    .on("change.pbDeviceUnified", function () {
      this.checked = false;
      PB.syncWebcamDeviceUi?.();
    });

  // Übersetzer-Helper (Fallback wenn PB.t fehlt)
  const pbT = (key, fallback) => (PB.t ? PB.t(key, fallback) : fallback);

  // Mini-Helper: {name}, {id}, {detail} ersetzen
  function fmt(key, fallback, vars) {
    let msg = String(pbT(key, fallback) || "");
    if (vars) {
      Object.keys(vars).forEach((k) => {
        const v = vars[k] == null ? "" : String(vars[k]);
        msg = msg.replace(new RegExp("\\{" + k + "\\}", "g"), v);
      });
    }
    return msg.trim();
  }

  // Queue gegen schnelles Umklicken
  let pendingId = null;
  let pendingSerial = null;
  let pendingName = null;
  let inFlight = false;

  async function doSelect(id, name, serial) {
    id = String(id || "").trim();
    name = String(name || "").trim();
    serial = String(serial || "").trim();

    if (!id && !serial) return false;

    if (inFlight) {
      pendingId = id || "";
      pendingSerial = serial || "";
      pendingName = name || "";
      return false;
    }

    inFlight = true;
    try {
      if (serial && typeof PB.apiSelectCameraBySerial === "function") {
        await PB.apiSelectCameraBySerial(serial);
      } else if (id) {
        await PB.apiSelectCameraById(id);
      } else {
        throw new Error(
          pbT("overlay.select_device.error.no_usable_selector", "No usable selector")
        );
      }

      PB.showMsg?.(
        fmt("overlay.select_device.info.camera_selected", "Camera selected: {name}", {
          id: id || serial,
          name: name || id || serial
        }),
        "info"
      );
      return true;
    } catch (e) {
      PB.showMsg?.(
        fmt(
          "overlay.select_device.error.camera_select_failed",
          "Camera could not be selected: {name}. {detail}",
          {
            id: id || serial,
            name: name || id || serial,
            detail: e && e.message ? e.message : ""
          }
        ),
        "warning"
      );
      console.warn("[DeviceSelect] select failed:", e);
      return false;
    } finally {
      inFlight = false;

      // Queue abarbeiten (wie bisher), jetzt inkl. serial/name
      if ((pendingId || pendingSerial) && (pendingId !== id || pendingSerial !== serial)) {
        const nextId = pendingId || "";
        const nextSerial = pendingSerial || "";
        const nextName = pendingName || "";

        pendingId = null;
        pendingSerial = null;
        pendingName = null;

        // name neu aus dem Select lesen, falls nicht gesetzt
        let finalName = nextName;
        if (!finalName && nextId) {
          const sel = document.getElementById("settingDeviceSelected");
          const opt = sel
            ? sel.querySelector(`option[value="${CSS.escape(nextId)}"]`)
            : null;
          finalName = opt ? (opt.textContent || "").trim() : nextId;
        }

        await doSelect(nextId, finalName, nextSerial);
      } else {
        pendingId = null;
        pendingSerial = null;
        pendingName = null;
      }
    }
  }

  $("#settingDeviceSelected")
    .off("change.pbDeviceUnified")
    .on("change.pbDeviceUnified", async function () {
      const sel = document.getElementById("settingDeviceSelected");
      const cb = document.getElementById("settingUseWebcam");

      if (cb) cb.checked = false;

      PB.syncWebcamDeviceUi?.();
      PB.writeSelectedDeviceToHiddenInputs?.();

      const id = String(sel?.value || "").trim();
      if (!id) return;

      const opt = sel?.selectedOptions?.[0];
      const name = opt ? (opt.textContent || "").trim() : id;

      let serial = "";
      try {
        let raw = opt?.getAttribute("data-device") || "";
        if (raw && raw.includes("&quot;")) raw = raw.replace(/&quot;/g, '"');
        if (raw) serial = String(JSON.parse(raw)?.Serial || "").trim();
      } catch (_) {}

      await doSelect(id, name, serial);
    });

  $("#settingOnlyCameras")
    .off("change.pbDeviceUnified")
    .on("change.pbDeviceUnified", function () {
      PB.triggerDeviceRefresh?.();
    });
};
