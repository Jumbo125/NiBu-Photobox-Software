// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

/** i18n.js — Sprachdateien laden & anwenden (ohne Auto-Init) */
(function ($) {
  'use strict';
  window.PB = window.PB || {};
  const PB = window.PB;

  // ==========================================================
  PB.currentLanguageCode = PB.currentLanguageCode || 'en';
  PB.currentLanguageMap = PB.currentLanguageMap || {};

  // Startsprache aus window.PB_CONFIG (falls vorhanden)
  if (window.PB_CONFIG && window.PB_CONFIG.language) {
    PB.currentLanguageCode = window.PB_CONFIG.language;
  }

  // \n-Strings in echte Zeilenumbrüche umwandeln
  function normalizeTranslation(value) {
    return String(value == null ? '' : value).replace(/\\n/g, '\n');
  }

  // interne Lookup-Hilfe (ohne PB.t-Rekursion)
  function tRaw(key, fallback) {
    try {
      const map = PB.currentLanguageMap || {};
      if (key && Object.prototype.hasOwnProperty.call(map, key)) {
        return normalizeTranslation(map[key]);
      }
    } catch (_) {}
    return normalizeTranslation(fallback || key);
  }

  /**
   * Lädt die Sprachdatei lang/lang_<code>.json und wendet sie direkt an.
   * Handhabung: PB.loadLanguage('de');
   */
  PB.loadLanguage = PB.loadLanguage || function (langCode) {
    const url = 'lang/lang_' + langCode + '.json';
    return $.getJSON(url)
      .done(function (data) {
        PB.currentLanguageCode = langCode;
        PB.currentLanguageMap = data || {};
        PB.applyLanguage();
      })
      .fail(function () {
        if (window.console && console.warn) {
          console.warn(
            tRaw('i18n.warn.load_failed', 'Could not load language file:'),
            url
          );
        }
      });
  };

  /**
   * Setzt Texte/Placeholder anhand data-lang-key und dem geladenen Sprach-Mapping.
   * Handhabung: PB.applyLanguage();
   */
  PB.applyLanguage = PB.applyLanguage || function () {
    $('[data-lang-key]').each(function () {
      const $el = $(this);
      const key = $el.attr('data-lang-key');
      if (!key) return;

      if (!Object.prototype.hasOwnProperty.call(PB.currentLanguageMap, key)) {
        return;
      }

      const translation = normalizeTranslation(PB.currentLanguageMap[key]);

      if ($el.is('input, textarea')) {
        $el.attr('placeholder', translation);
      } else {
        $el.text(translation).css('white-space', 'pre-line');
      }
    });
  };

  /**
   * Liefert Übersetzung anhand key oder den Fallback zurück.
   * Beispiel: PB.t('bridge.stop.err.taskkill_failed', 'Fallback Text');
   */
  PB.t = PB.t || function (key, fallback) {
    try {
      const map = PB.currentLanguageMap || {};
      if (key && Object.prototype.hasOwnProperty.call(map, key)) {
        return normalizeTranslation(map[key]);
      }
    } catch (e) {
      console.warn(
        tRaw('i18n.warn.lookup_failed', '[PB.t] lookup failed'),
        e
      );
    }
    return normalizeTranslation(fallback || key);
  };

  // Back-compat / Convenience: pbT Alias (falls andere Module pbT nutzen)
  PB.pbT = PB.pbT || PB.t;
  window.pbT = window.pbT || PB.t;

})(jQuery);