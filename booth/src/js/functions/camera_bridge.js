// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/* ===========================================================
 * camera_bridge.js — UI/Device Selection (nutzt PB.bridge.*)
 * =========================================================== */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  // i18n helpers (pbT + einfache {var}-Interpolation)
  const tr = (key, fallback) => {
    const fn = PB.pbT || window.pbT;
    return (typeof fn === 'function') ? fn(key, fallback) : (fallback || key);
  };

  const trf = (key, fallback, vars) => {
    let s = tr(key, fallback);
    if (!vars || typeof s !== 'string') return s;
    return s.replace(/\{(\w+)\}/g, (m, p) => {
      const v = vars[p];
      return (v === undefined || v === null) ? m : String(v);
    });
  };

  // ---------- OFFLINE HINT ----------
  PB.toggleCameraBridgeOfflineHint = function (show, type = 'offline', detail = '') {
    const box = document.getElementById('hintCameraBridgeOffline');
    if (!box) return;

    const msgs = box.querySelectorAll('.device-error-msg');
    msgs.forEach((m) => m.classList.add('d-none'));

    const detailEl = box.querySelector('.device-error-detail');
    if (detailEl) {
      detailEl.textContent = '';
      detailEl.classList.add('d-none');
    }

    box.classList.add('d-none');
    if (!show) return;

    if (!msgs.length) {
      const base =
        type === 'offline'
          ? tr('overlay.select_device.hint.camerabridge_offline', 'CameraBridge is offline.')
          : type === 'http'
          ? tr('overlay.select_device.hint.camerabridge_http_error', 'CameraBridge HTTP error.')
          : tr('overlay.select_device.hint.camerabridge_error', 'CameraBridge error.');

      const msg = (detail ? base + ' ' + detail : base).trim();
      if (!msg) return;

      box.textContent = msg;
      box.classList.remove('d-none');
      return;
    }

    let msgEl = null;
    if (type === 'offline') msgEl = box.querySelector('.device-error-offline');
    else if (type === 'http') msgEl = box.querySelector('.device-error-http');

    if (!msgEl) return;

    msgEl.classList.remove('d-none');

    if (detailEl && detail) {
      detailEl.textContent = detail;
      detailEl.classList.remove('d-none');
    }

    box.classList.remove('d-none');
  };

  /**
   * Zweck: Heuristik: erkennt typische 'Bridge offline' Fehler.
   */
  PB.isCameraBridgeOfflineError =
    PB.isCameraBridgeOfflineError ||
    function (err) {
      if (!err) return false;

      if (String(err.code || '') === 'CAMERABRIDGE_OFFLINE') return true;

      const name = String(err.name || '').toLowerCase();
      const msg = String(err.message || err || '').toLowerCase();

      if (name === 'aborterror') return false;

      return (
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('load failed') ||
        msg.includes('connection refused') ||
        msg.includes('err_connection_refused') ||
        msg.includes('net::err_connection_refused')
      );
    };

  // ---------- UI Helpers ----------
  PB.syncWebcamDeviceUi = function () {
    const cb = document.getElementById('settingUseWebcam');
    const sel = document.getElementById('settingDeviceSelected');
    if (sel) sel.disabled = false;
    if (cb) cb.checked = false;
  };

  PB.writeSelectedDeviceToHiddenInputs = function () {
    const sel = document.getElementById('settingDeviceSelected');
    if (!sel) return;

    const opt = sel.selectedOptions && sel.selectedOptions[0];
    if (!opt || !opt.dataset || !opt.dataset.device) return;

    let d = null;
    try {
      d = JSON.parse(opt.dataset.device);
    } catch (_) {
      d = null;
    }
    if (!d) return;

    const set = (id, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = val === undefined || val === null ? '' : String(val);
    };

    set('settingDeviceId', d.Id || '');
    set('settingDeviceDisplayName', d.DisplayName || '');
    set('settingDeviceManufacturer', d.Manufacturer || '');
    set('settingDeviceModel', d.Model || '');
    set('settingDeviceSerial', d.Serial || '');
    set('settingDevicePort', d.Port || '');
    set('settingDeviceIsConnected', d.IsConnected ? '1' : '0');
  };

  // ---------- Normalization ----------
  PB.normalizeCameraDevice = function (cam, idx) {
    if (typeof cam === 'number' || typeof cam === 'string') {
      const id = String(cam);
      return {
        Id: id,
        DisplayName: trf('overlay.select_device.device.camera_numbered', 'Camera {n}', { n: id }),
        Manufacturer: '',
        Model: '',
        Serial: '',
        Port: '',
        IsConnected: true
      };
    }

    const id = cam.Id ?? cam.id ?? idx;
    return {
      Id: String(id ?? ''),
      DisplayName:
        cam.DisplayName ??
        cam.displayName ??
        cam.Model ??
        cam.model ??
        trf('overlay.select_device.device.camera_numbered', 'Camera {n}', { n: idx }),
      Manufacturer: cam.Manufacturer ?? cam.manufacturer ?? '',
      Model: cam.Model ?? cam.model ?? '',
      Serial: cam.Serial ?? cam.serial ?? '',
      Port: cam.Port ?? cam.port ?? '',
      IsConnected: !!(cam.IsConnected ?? cam.isConnected ?? true)
    };
  };

  // ---------- Bridge calls (nur noch PB.bridge.*) ----------
  PB.fetchCameraList = async function () {
    if (!PB.bridge) throw new Error(tr("camera_bridge.err.bridge_not_loaded", "PB.bridge not loaded"));

    // optional: refresh
    try {
      if (typeof PB.bridge.refresh === "function") await PB.bridge.refresh();
    } catch (err) {
      if (PB.isCameraBridgeOfflineError(err)) throw err;
      console.warn("[DeviceRefresh] bridge.refresh error:", err);
    }

    // list
    const list = await PB.bridge.cameras();

    if (PB.isOnlyCamerasFilterEnabled && PB.isOnlyCamerasFilterEnabled()) {
      return Array.isArray(list) ? list.filter(PB.isCanonOrNikon) : list;
    }
    return list;
  };

  PB.populateCameraSelect = async function (selectId) {
    const sel = document.getElementById(selectId || "settingDeviceSelected");
    if (!sel) return;

    PB.toggleCameraBridgeOfflineHint(false);
    const prevValue = String(sel.value || "");

    const existingNoOpt = sel.querySelector('option[value=""]');
    const noLangKey = existingNoOpt
      ? (existingNoOpt.getAttribute("data-lang-key") || "overlay.select_device.no_devices")
      : "overlay.select_device.no_devices";
    const noText = existingNoOpt ? existingNoOpt.textContent : tr(noLangKey, "No devices found.");

    sel.innerHTML = "";
    const noOpt = document.createElement("option");
    noOpt.value = "";
    noOpt.setAttribute("data-lang-key", noLangKey);
    noOpt.textContent = noText;
    sel.appendChild(noOpt);

    let raw;
    try {
      raw = await PB.fetchCameraList();
    } catch (err) {
      if (PB.isCameraBridgeOfflineError(err)) {
        PB.toggleCameraBridgeOfflineHint(true, "offline");
        return;
      }
      console.warn("[DeviceRefresh] CameraList error:", err);
      PB.toggleCameraBridgeOfflineHint(true, "http");
      return;
    }

    PB.toggleCameraBridgeOfflineHint(false);

    const cams = Array.isArray(raw) ? raw : (raw && raw.cameras) ? raw.cameras : [];
    if (!cams.length) return;

    cams.forEach((cam, idx) => {
      const d = PB.normalizeCameraDevice(cam, idx);

      const opt = document.createElement("option");
      opt.value = d.Id;
      opt.textContent = d.DisplayName || d.Id;
      opt.dataset.device = JSON.stringify(d);
      sel.appendChild(opt);
    });

    if (prevValue && [...sel.options].some((o) => String(o.value) === prevValue)) {
      sel.value = prevValue;
    } else if (sel.options.length > 1) {
      sel.value = sel.options[1].value;
    }
  };

  PB.refreshUnifiedDeviceSelection = async function () {
    await PB.populateCameraSelect("settingDeviceSelected");
    PB.syncWebcamDeviceUi();
    PB.writeSelectedDeviceToHiddenInputs();
  };

  PB.triggerDeviceRefresh = function () {
    PB.refreshUnifiedDeviceSelection();
  };

  PB.bindDeviceModalTrigger = function () {
    $("#modalSelectDevice")
      .off("shown.bs.modal.pbDeviceUnified")
      .on("shown.bs.modal.pbDeviceUnified", async function () {
        if ($("#formSelectDevice").length && PB.applyConfigToForm) {
          PB.applyConfigToForm($("#formSelectDevice"), window.PB_CONFIG || {});
        }
        await PB.refreshUnifiedDeviceSelection();
        PB.syncWebcamDeviceUi();
      });
  };

  PB.bindDeviceRefreshClicks = function () {
    $("#btnDeviceRefresh")
      .off("click.pbDeviceRefresh")
      .on("click.pbDeviceRefresh", function (e) {
        e.preventDefault();
        e.stopPropagation();
        PB.triggerDeviceRefresh();
      });

    $("#btnDeviceRefresh_ico")
      .off("click.pbDeviceRefreshIco")
      .on("click.pbDeviceRefreshIco", function (e) {
        e.preventDefault();
        e.stopPropagation();
        PB.triggerDeviceRefresh();
      });
  };

  PB.initUnifiedDeviceSelection = function () {
    PB.bindDeviceRefreshClicks();
    PB.bindDeviceModalTrigger();
    PB.bindUnifiedDeviceSelectionEvents && PB.bindUnifiedDeviceSelectionEvents();
    PB.syncWebcamDeviceUi();
  };

  // -----------------------------------------------------------
  // Back-compat API names (delegieren auf PB.bridge.*)
  // -----------------------------------------------------------
  PB.apiSelectCameraById = PB.apiSelectCameraById || async function (id) {
    if (!PB.bridge?.select) throw new Error(tr("camera_bridge.err.bridge_select_not_available", "PB.bridge.select not available"));
    const r = await PB.bridge.select(id);
    await PB.autoStartLiveviewAfterSelectFromConfig?.();
    return r;
  };

  PB.apiSelectCameraBySerial = PB.apiSelectCameraBySerial || async function (serial) {
    if (!PB.bridge?.selectBySerial) throw new Error(tr("camera_bridge.err.bridge_select_by_serial_not_available", "PB.bridge.selectBySerial not available"));
    const r = await PB.bridge.selectBySerial(serial);
    await PB.autoStartLiveviewAfterSelectFromConfig?.();
    return r;
  };

  PB.apiLiveviewSetFps = PB.apiLiveviewSetFps || async function (fps) {
    if (!PB.bridge?.liveviewSetFps) throw new Error(tr("camera_bridge.err.bridge_liveview_set_fps_not_available", "PB.bridge.liveviewSetFps not available"));
    await PB.bridge.liveviewSetFps(fps);
    return true;
  };

  PB.apiLiveviewStart = PB.apiLiveviewStart || async function () {
    if (!PB.bridge?.liveviewStart) throw new Error(tr("camera_bridge.err.bridge_liveview_start_not_available", "PB.bridge.liveviewStart not available"));
    await PB.bridge.liveviewStart();
    return true;
  };

  // -----------------------------------------------------------
  // Auto LiveView nach Select (config-driven)
  // -----------------------------------------------------------
  PB._readBoolFromConfig = function (paths, fallback = false) {
    const store = window.PB_CONFIG || {};
    for (const p of paths) {
      const v = (typeof PB._getDeep === "function") ? PB._getDeep(store, p) : undefined;
      if (v === undefined) continue;
      if (typeof v === "boolean") return v;
      const s = String(v).trim().toLowerCase();
      if (["1", "true", "yes", "on"].includes(s)) return true;
      if (["0", "false", "no", "off"].includes(s)) return false;
    }
    return fallback;
  };

  PB._readIntFromConfig = function (paths, fallback = null) {
    const store = window.PB_CONFIG || {};
    for (const p of paths) {
      const v = (typeof PB._getDeep === "function") ? PB._getDeep(store, p) : undefined;
      if (v === undefined || v === null || v === "") continue;
      const n = Number(v);
      if (Number.isFinite(n)) return Math.trunc(n);
    }
    return fallback;
  };

  PB._cfgAlwaysLiveviewEnabled = function () {
    return PB._readBoolFromConfig(["camera.camera_settings.liveview_always_active"], false);
  };

  PB._cfgLiveviewFps = function () {
    let fps = PB._readIntFromConfig(["camera.camera_settings.liveview_fps_idle"], null);
    if (fps == null) return null;
    fps = Math.max(1, Math.min(60, fps));
    return fps;
  };

  PB.autoStartLiveviewAfterSelectFromConfig = async function () {
    if (!PB._cfgAlwaysLiveviewEnabled()) return false;

    try {
      const fps = PB._cfgLiveviewFps();
      if (fps != null) {
        await PB.apiLiveviewSetFps(fps);
        if (PB.sleep) await PB.sleep(80);
      }
      await PB.apiLiveviewStart();
      return true;
    } catch (e) {
      console.warn("[autoLiveviewAfterSelect] failed:", e);
      return false;
    }
  };

  // -----------------------------------------------------------
  // Filter helpers (unverändert)
  // -----------------------------------------------------------
  PB.isOnlyCamerasFilterEnabled = function () {
    const el = document.getElementById("settingOnlyCameras");
    return !!el && el.checked;
  };

  PB.isCanonOrNikon = function (cam) {
    const m = String(cam?.manufacturer ?? cam?.Manufacturer ?? cam?.brand ?? cam?.Brand ?? "").toLowerCase();
    return m.includes("canon") || m.includes("nikon") || m.includes("niklon");
  };

  // Selected Camera helpers (wie vorher)
  PB.getSelectedCameraDeviceObject = function (selectId = "settingDeviceSelected") {
    const sel = document.getElementById(selectId);
    if (!sel || sel.selectedIndex < 0) return null;

    const opt = sel.options[sel.selectedIndex];
    if (!opt) return null;

    const raw = opt.getAttribute("data-device") || opt.dataset.device;
    if (!raw) return null;

    try {
      return JSON.parse(raw);
    } catch (e1) {
      try {
        return JSON.parse(String(raw).replace(/&quot;/g, '"'));
      } catch (e2) {
        console.warn("[SelectedCamera] could not parse data-device JSON:", e2, raw);
        return null;
      }
    }
  };

  PB.normalizeSelectedCamera = function (cam) {
    if (!cam) return null;
    const id = cam.Id ?? cam.id ?? "";
    return {
      usb_id: String(id),
      id: String(id),
      display_name: String(cam.DisplayName ?? cam.displayName ?? ""),
      manufacturer: String(cam.Manufacturer ?? cam.manufacturer ?? ""),
      model: String(cam.Model ?? cam.model ?? ""),
      serial: String(cam.Serial ?? cam.serial ?? ""),
      port: String(cam.Port ?? cam.port ?? ""),
      is_connected: !!(cam.IsConnected ?? cam.isConnected),
    };
  };

  PB.applySelectedCameraFromConfig = function (cfgOrStore, selectId = "settingDeviceSelected") {
    const sel = document.getElementById(selectId);
    if (!sel) return;

    const store = cfgOrStore || window.PB_CONFIG || {};
    const cfg = store.general && store.general.camera ? store.general : store;

    const camCfg = cfg?.camera?.selected_camera || null;

    const preferredId =
      cfg?.camera?.device ??
      camCfg?.usb_id ??
      camCfg?.id ??
      camCfg?.usbId ??
      null;

    if (preferredId !== null && preferredId !== undefined) {
      const idStr = String(preferredId);
      const has = Array.from(sel.options).some((o) => String(o.value) === idStr);
      if (has) {
        sel.value = idStr;
        PB.writeSelectedDeviceToHiddenInputs && PB.writeSelectedDeviceToHiddenInputs();
        return;
      }
    }

    if (camCfg) {
      const opts = Array.from(sel.options);
      const match = opts.find((o) => {
        const raw = o.getAttribute("data-device") || o.dataset.device;
        if (!raw) return false;

        let d;
        try { d = JSON.parse(raw); }
        catch (e1) {
          try { d = JSON.parse(String(raw).replace(/&quot;/g, '"')); }
          catch (e2) { return false; }
        }

        const serial = String(d.Serial ?? d.serial ?? "");
        const port = String(d.Port ?? d.port ?? "");
        const name = String(d.DisplayName ?? d.displayName ?? "");

        return (
          (camCfg.serial && serial && String(camCfg.serial) === serial) ||
          (camCfg.port && port && String(camCfg.port) === port) ||
          (camCfg.display_name && name && String(camCfg.display_name) === name)
        );
      });

      if (match) {
        sel.value = match.value;
        PB.writeSelectedDeviceToHiddenInputs && PB.writeSelectedDeviceToHiddenInputs();
        return;
      }
    }

    sel.value = "";
    PB.writeSelectedDeviceToHiddenInputs && PB.writeSelectedDeviceToHiddenInputs();
  };
})(jQuery);
