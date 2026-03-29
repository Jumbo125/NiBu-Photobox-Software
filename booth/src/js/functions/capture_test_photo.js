// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
/* Testphoto: JPEG capture -> preview in #testPhotoPreviewWrap */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  // Translation helper (pbT("key", "English fallback"))
  const t = typeof window.pbT === 'function'
    ? window.pbT
    : function (_key, fallback) { return fallback || _key; };

  const btn = document.getElementById('btnTakeTestPhoto');
  const wrap = document.getElementById('testPhotoPreviewWrap');
  if (!btn || !wrap) return;

  function revokeLastUrl() {
    const last = wrap.dataset ? wrap.dataset.objectUrl : null;
    if (last) {
      try { URL.revokeObjectURL(last); } catch (_) {}
      delete wrap.dataset.objectUrl;
    }
  }

  function getApplySettingsForTestPhoto() {
    // Config: camera.camera_settings.use_settings_for_picture
    if (typeof PB._readBoolFromConfig === 'function') {
      return PB._readBoolFromConfig(['camera.camera_settings.use_settings_for_picture'], true);
    }
    return true;
  }

  function setWrapLoading(on) {
    wrap.classList.toggle('is-loading', !!on);
    if (!on) return;

    wrap.textContent = '';
    const div = document.createElement('div');
    div.className = 'pb-spinner';
    div.textContent = t('overlay.camera_settings.testphoto.loading', 'Capturing test photo…');
    wrap.appendChild(div);
  }

  function setWrapError(msg) {
    revokeLastUrl();

    wrap.textContent = '';
    const div = document.createElement('div');
    div.className = 'pb-error';
    div.textContent = String(
      msg || t('overlay.camera_settings.testphoto.error.capture_failed', 'Test photo capture failed.')
    );
    wrap.appendChild(div);
  }

  function setWrapImage(objectUrl) {
    revokeLastUrl();
    if (wrap.dataset) wrap.dataset.objectUrl = objectUrl;

    const img = new Image();
    img.alt = t('overlay.camera_settings.testphoto.alt', 'Test photo preview');
    img.src = objectUrl;
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.display = 'block';

    wrap.textContent = '';
    wrap.appendChild(img);
  }

  function readInputValue(id) {
  const el = document.getElementById(id);
  if (!el) return '';

  // select / input
  let v = (el.value ?? '').toString().trim();

  // fallback: data-default-value falls leer
  if (!v && el.dataset && el.dataset.defaultValue) {
    v = String(el.dataset.defaultValue).trim();
  }
  return v;
}

// optional: WB Mapping (falls Backend "Auto/Daylight/..." statt "auto/daylight" erwartet)
function mapWhiteBalance(v) {
  const s = (v || '').trim().toLowerCase();
  const map = {
    auto: 'Auto',
    daylight: 'Daylight',
    cloudy: 'Cloudy',
    tungsten: 'Tungsten',
    fluorescent: 'Fluorescent'
  };
  return map[s] || v; // wenn unbekannt, unverändert durchreichen
}

function readCameraSettingsFromInputs() {
  const iso = readInputValue('cameraIso');
  const shutter = readInputValue('cameraShutter');
  const aperture = readInputValue('cameraAperture');
  const wb = mapWhiteBalance(readInputValue('cameraWB'));

  const exposureRaw = readInputValue('cameraExposure');
  const exposure = exposureRaw !== '' && !Number.isNaN(Number(exposureRaw))
    ? Number(exposureRaw)
    : undefined;

  return { iso, shutter, aperture, whiteBalance: wb, exposure };
}

function isCameraSettingsModalOpen() {
  const label = document.getElementById('modalCameraSettings');
  if (label) {
    const s = window.getComputedStyle(label);
    return label.classList.contains('show') && s.display !== 'none' && s.visibility !== 'hidden';
  }

  // fallback: normales Bootstrap modal
  const modal = document.getElementById('modalCameraSettings');
  if (!modal) return false;
  const style = window.getComputedStyle(modal);
  return modal.classList.contains('show') && style.display !== 'none' && style.visibility !== 'hidden';
}


  // jQuery statt addEventListener
$(btn).on('click', async function () {
  btn.disabled = true;
  setWrapLoading(true);

  try {
    if (!PB.bridge || typeof PB.bridge.captureJpeg !== 'function') {
      throw new Error(
        t(
          'overlay.camera_settings.testphoto.error.bridge_missing',
          'Test photo failed: PB.bridge.captureJpeg is missing (Binary JPEG client not integrated).'
        )
      );
    }

    // Nimm deine vorhandene Funktion (robuster als hasClass+visible)
    const modalOpen = isCameraSettingsModalOpen();


    // Modal offen -> immer Inputs testen
    // Modal zu -> wie bisher per Config-Schalter
    const applySettings = modalOpen ? true : getApplySettingsForTestPhoto();

    const payload = {
      applySettings,
      resetAfterShoot: true
    };

    // Nur wenn Modal offen, die (noch nicht gespeicherten) Input-Werte mitsenden
    if (modalOpen) {

      const s = readCameraSettingsFromInputs(); 
      if (s.iso) payload.iso = s.iso;
      if (s.shutter) payload.shutter = s.shutter;

      // dein 1. Reader liefert whiteBalance bereits korrekt:
      if (s.whiteBalance) payload.whiteBalance = s.whiteBalance;

      // optional
      if (s.aperture) payload.aperture = s.aperture;
      if (typeof s.exposure === 'number') payload.exposure = s.exposure;
    }

    const res = await PB.bridge.captureJpeg(payload);

    if (!res || res.ok !== true || !res.objectUrl) {
      const detail = res && (res.error || res.raw) ? String(res.error || res.raw) : '';
      const base = t(
        'overlay.camera_settings.testphoto.error.invalid_response',
        'Test photo failed: invalid response.'
      );
      throw new Error(detail ? (base + ' ' + detail) : base);
    }

    setWrapImage(res.objectUrl);
  } catch (err) {
    setWrapError(err && err.message ? err.message : String(err));
  } finally {
    btn.disabled = false;
    setWrapLoading(false);
  }
});


  // optional: jQuery statt window.addEventListener
  $(window).on('beforeunload', revokeLastUrl);

})(jQuery);
