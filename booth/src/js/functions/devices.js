// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/**
 * devices.js — Device-/Source-Utilities
 *
 * Kapselt:
 *  - Unified Camera-Device Dropdown (#settingDeviceSelected) via camera_bridge.js
 *  - Preview-Source Liste (#settingMediaStreamSelected): URL-Streams + Browser MediaDevices
 */
(function ($) {
  'use strict';

  window.PB = window.PB || {};
  const PB = window.PB;

  PB.devices = PB.devices || {};

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

  /**
   * Befüllt das Unified Device Dropdown (#settingDeviceSelected) mit Kamera-Geräten.
   */
  PB.devices.refreshUnifiedDeviceDropdown =
    PB.devices.refreshUnifiedDeviceDropdown ||
    async function (opts) {
      const options = opts || {};
      const selectId = options.selectId || 'settingDeviceSelected';

      if (typeof PB.populateCameraSelect === 'function') {
        await PB.populateCameraSelect(selectId);
        return;
      }

      console.warn(
        tr(
          'devices.warn.populate_camera_select_missing',
          '[devices] populateCameraSelect missing — camera_bridge.js not loaded?'
        )
      );
    };

  /**
   * Befüllt eine Source-Liste für Preview (URL-Streams + Browser MediaDevices).
   */
  PB.devices.refreshPreviewSourceList =
    PB.devices.refreshPreviewSourceList ||
    async function (opts) {
      const options = opts || {};
      const selectId = options.selectId || 'settingMediaStreamSelected';

      const sel = document.getElementById(selectId);
      if (!sel) return;

      // merken (auch url:)
      let saved = sel.value;
      if (!saved && window.PB_CONFIG && typeof window.PB_CONFIG === 'object') {
        saved =
          typeof PB._getDeep === 'function'
            ? PB._getDeep(window.PB_CONFIG, 'general.camera.selected_mediastream') || ''
            : '';
      }

      sel.innerHTML = '';

      // --- URL Streams (immer anbieten)
      const ogUrl = document.createElement('optgroup');
      ogUrl.label = tr('overlay.select_device.preview_sources.group_url_streams', 'URL Streams');

      const localUrl = 'http://127.0.0.1:5514/live';
      ogUrl.appendChild(
        new Option(
          trf('overlay.select_device.preview_sources.local_stream', 'Local Live Stream ({url})', { url: localUrl }),
          'url:' + localUrl
        )
      );

      // falls gespeicherte URL anders ist -> extra eintragen
      if (saved && (String(saved).startsWith('url:') || /^https?:\/\//i.test(String(saved)))) {
        const v = String(saved).startsWith('url:') ? String(saved) : 'url:' + String(saved);
        const exists = Array.from(ogUrl.querySelectorAll('option')).some((o) => o.value === v);
        if (!exists) {
          const url = v.slice(4);
          ogUrl.appendChild(
            new Option(
              trf('overlay.select_device.preview_sources.saved_url', 'Saved URL ({url})', { url }),
              v
            )
          );
        }
      }

      sel.appendChild(ogUrl);

      // --- Browser Devices
      const ogDev = document.createElement('optgroup');
      ogDev.label = tr('overlay.select_device.preview_sources.group_browser_devices', 'Browser Devices');

      ogDev.appendChild(new Option(tr('overlay.select_device.preview_sources.default_browser', 'Default (Browser)'), ''));

      // Device-Labels erst nach Permission
      try {
        if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
          const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
          tmp.getTracks().forEach((t) => t.stop());
        }
      } catch (_) {
        /* ok */
      }

      try {
        if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices();
          const videos = devices.filter((d) => d.kind === 'videoinput');

          if (videos.length) {
            videos.forEach((d, i) => {
              const label =
                d.label ||
                trf('overlay.select_device.preview_sources.video_device_numbered', 'Video Device #{n}', { n: i + 1 });
              ogDev.appendChild(new Option(label, d.deviceId));
            });
          } else {
            ogDev.appendChild(
              new Option(tr('overlay.select_device.preview_sources.no_video_devices', 'No video devices found'), '')
            );
          }
        } else {
          ogDev.appendChild(
            new Option(tr('overlay.select_device.preview_sources.device_list_not_available', 'Device list not available'), '')
          );
        }
      } catch (_) {
        ogDev.appendChild(
          new Option(tr('overlay.select_device.preview_sources.device_list_not_available', 'Device list not available'), '')
        );
      }

      sel.appendChild(ogDev);

      // restore
      if (saved !== undefined && saved !== null) sel.value = String(saved);
    };
})(jQuery);
