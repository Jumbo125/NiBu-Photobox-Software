// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

// ui_fullscreen.js — UI-"Fullscreen" nur per CSS-Klasse (pb-fullscreen)
(function () {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  const CLS = "pb-fullscreen";
  const LOG_PREFIX = "[UI-FS]";
  const dbg = (PB._dbg && typeof PB._dbg === "function") ? PB._dbg : console.log;

  PB.setFullscreenUI = PB.setFullscreenUI || function (on) {
    const enabled = !!on;

    // Falls body noch nicht existiert (sehr früh im Load), dann später nochmal anwenden
    if (!document.body) {
      PB._uiFullscreen = enabled;
      return enabled;
    }

    document.body.classList.toggle(CLS, enabled);
    PB._uiFullscreen = enabled;

    dbg(LOG_PREFIX, "setFullscreenUI =", enabled);
    return enabled;
  };

  PB.isFullscreen = PB.isFullscreen || function () {
    return !!document.body && document.body.classList.contains(CLS);
  };

  PB.toggleFullscreen = PB.toggleFullscreen || function () {
    return PB.setFullscreenUI(!PB.isFullscreen());
  };

  PB.applyFullscreenFromConfig = PB.applyFullscreenFromConfig || function (cfg) {
    const c = cfg || window.PB_CONFIG || {};
    const on = !!PB._getDeep?.(c, "general.system.fullscreen");
    dbg(LOG_PREFIX, "applyFullscreenFromConfig ->", on);
    return PB.setFullscreenUI(on);
  };

  PB.enterFullscreen = PB.enterFullscreen || function () {
    return PB.setFullscreenUI(true);
  };

  PB.exitFullscreen = PB.exitFullscreen || function () {
    return PB.setFullscreenUI(false);
  };

  // Backwards-Compat: falls irgendwo noch updateFullscreenState() verwendet wird
  PB.updateFullscreenState = PB.updateFullscreenState || function () {
    return PB.applyFullscreenFromConfig(window.PB_CONFIG);
  };
})();
