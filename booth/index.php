<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>NiBu-Photobooth</title>
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="icon" type="image/png" href="src/favicon/favicon-96x96.png" sizes="96x96" />
<link rel="icon" type="image/svg+xml" href="src/favicon/favicon.svg" />
<link rel="shortcut icon" href="src/favicon/favicon.ico" />
<link rel="apple-touch-icon" sizes="180x180" href="src/favicon/apple-touch-icon.png" />
<link rel="manifest" href="src/favicon/site.webmanifest" />

    <!-- Bootstrap CSS (CDN) – später ggf. lokal hosten -->
    <link
       rel="stylesheet" href="src/css/bootstrap.css" 
        rel="stylesheet"
    >
    <link rel="stylesheet" href="src/css/bootstrap-icons.css">

    <!-- Eigene Styles -->
    <link rel="stylesheet" href="src/css/main.css?v=20261127">
 
    
</head>
<body class="bg-dark text-light d-flex flex-column">

<!-- Preloader -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->

<div id="loadingOverlay" class="loading-overlay" aria-live="polite" aria-busy="true">
  <div class="loading-card">
    <div class="spinner" aria-hidden="true"></div>

    <div class="loading-title">
      Loading configuration...
    </div>
  </div>
</div>

<!-- Navbar / Header -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->
<!--
layout/header.php
-->

<div id="appHeader">
  <nav class="navbar navbar-expand-lg navbar-dark bg-dark border-bottom border-secondary">
    <div class="container-fluid">
      <span class="navbar-brand mb-0 h1" data-lang-key="app.title">
        Photobooth Control
      </span>

      <!-- ######### Aktive Event ################# -->
      <div id="active_event_header_info">
        <span class="navbar-brand mb-0 h1 active_event_title"></span>

        <span data-lang-key="overlay.active_event.printed.counter">
          Printed Pictures
        </span>

        <span class="navbar-brand mb-0 h1 active_event_counter"></span>
      </div>

    <!-- ######### DNP Drucker  ################# -->
      <div id="printer_paper_remaining">
    

        <span data-lang-key="overlay.printed.paper.remaining">
          Remaining Paper
        </span>

        <span class="navbar-brand mb-0 h1 paper_remaining_value"></span>
        <button
          type="button"
          id="btnDnpPaperRefresh"
          class="btn btn-outline-light btn-sm rounded-circle d-inline-flex align-items-center justify-content-center pb-dnp-refresh"
          title="Refresh printer info"
          aria-label="Refresh printer info"
        >
          <i class="bi bi-arrow-clockwise"></i>
        </button>
      </div>

<!-- ######### Buttons  ################# -->
      <button
  id="btnUiReload"
  class="btn btn-warning btn rounded-circle d-inline-flex align-items-center justify-content-center btnUiReload"
  title="Reload browser"
  data-force="1"
  aria-label="Reload browser"
>
  <i class="bi bi-arrow-clockwise"></i>
</button>

&nbsp;&nbsp;

<button
  type="button"
  class="btn btn-primary btn rounded-circle d-inline-flex align-items-center justify-content-center pb-toggle-kiosk"
  title="Toggle kiosk mode"
  aria-label="Toogle kiosk Mode"
>
  <i class="bi bi-fullscreen"></i>
</button>

&nbsp;&nbsp;

<button
  type="button"
  class="btn btn-danger btn rounded-circle d-inline-flex align-items-center justify-content-center pb-close-browser"
  title="Close browser"
  data-force="1"
  aria-label="Close browser"
  data-action="closeBrowser"
>
  <i class="bi bi-x-lg"></i>
</button>


      &nbsp;&nbsp;

      <div class="d-flex gap-2">
        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          data-bs-toggle="modal"
          data-bs-target="#modalSettings"
          title="General Settings"
          aria-label="General Settings"
        >
          <i class="bi bi-gear"></i>
          <span data-lang-key="nav.general_settings">
            General Settings
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          data-bs-toggle="modal"
          data-bs-target="#modalTemplateEditor"
          title="Template Editor"
          aria-label="Template Editor"
        >
          <i class="bi bi-palette"></i>
          <span data-lang-key="nav.template_editor">
            Template Editor
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          data-bs-toggle="modal"
          data-bs-target="#modalActiveEvent"
          title="Active Event"
          aria-label="Active Event"
        >
          <i class="bi bi-easel"></i>
          <span data-lang-key="nav.active_event">
            Active Event
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnCameraSettings"
          data-bs-toggle="modal"
          data-bs-target="#modalCameraSettings"
          title="Camera Settings"
          aria-label="Camera Settings"
        >
          <i class="bi bi-camera"></i>
          <span data-lang-key="nav.camera_settings">
            Camera Settings
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnSelectDevice"
          data-bs-toggle="modal"
          data-bs-target="#modalSelectDevice"
          title="Select Camera"
          aria-label="Select Camera"
        >
          <i class="bi bi-camera-fill"></i>
          <span data-lang-key="nav.select_device">
            Select Camera
          </span>
        </button>

        <button
          type="button"
          class="btn btn-outline-light btn-nav-lg"
          id="btnFullscreen"
          title="Fullscreen"
          aria-label="Fullscreen"
        >
          <i class="bi bi-arrows-fullscreen"></i>
          <span data-lang-key="nav.fullscreen">
            Fullscreen
          </span>
        </button>
      </div>
    </div>
  </nav>
</div>

﻿<!--
SPDX-License-Identifier: Apache-2.0
Copyright (c) 2026 Andreas Rottmann
-->

<main id="appMain" class="pb-main flex-fill d-flex align-items-center justify-content-center p-3">

  <div id="bgStaticImg"></div>

  <div id="bgVideo" class="pb-bg pb-bg-video">
    <div id="previewMediaWrap" class="pb-preview-media d-none">
      <button
        id="btnLiveviewToggle"
        type="button"
        class="btn btn-sm btn-outline-info d-none"
        aria-pressed="false"
        title="Toggle LiveView"
        data-lang-key="screen.main.liveview_toggle.title"
      >
        <i class="bi bi-camera-video"></i>
      </button>

      <iframe
        id="liveFrame"
        class="d-none"
        title="Camera stream"
        data-lang-key="screen.main.live_frame.title"
      ></iframe>
    </div>

    <div id="bgVideoHint" class="pb-video-hint d-none"></div>
  </div>

  <div id="debugCurrentFps">
    <p class="alert alert-warning">
      <span data-lang-key="screen.main.debug.current_fps">
        Current FPS:
      </span>
      <span id="current_fps"></span>
    </p>
  </div>

  <div id="previewOverlayWrap" class="pb-preview-overlay">
    <section id="start-area" class="start-area text-center">

      <!-- Template-Auswahl: liegt INNERHALB von start-area als oberste Ebene.
           Wird start-area durch den (unveränderten) Capture-Flow sichtbar
           geschaltet (setStartAreaVisible(true)), erscheint automatisch
           zuerst diese Auswahl, falls mehr als ein Template verfügbar ist.
           Standardmäßig d-none — PB.templateSelector blendet sie nur ein,
           wenn PB_CONFIG.activeEvent.active_event.templateCount > 1 ist.
           Siehe .claude/ACTIVE_TEMPLATE.md für den Gesamtzusammenhang. -->
      <section id="templateSelectArea" class="template-select-area d-none text-center">
        <h2 class="start-title" data-lang-key="screen.template_select.title">
          Choose your template
        </h2>
        <p class="start-subtitle" data-lang-key="screen.template_select.subtitle">
          Tap a template to continue.
        </p>

        <div id="templateSelectGrid" class="template-select-grid"></div>
      </section>

      <h1 class="start-title" data-lang-key="screen.main_placeholder_title">
        Touch to start
      </h1>
      <p class="start-subtitle" data-lang-key="screen.main_placeholder_text">
        Tap the screen to begin the photo session.
      </p>
    </section>
  </div>

  <button
    id="btnTogglePreview"
    type="button"
    class="pb-toggle-preview btn btn-lg"
    >
    <i id="mediaIcon" class="bi bi-film">   <span aria-label="Toggle image/stream"
    data-lang-key="screen.main.preview_toggle.aria_label"
  ></span></i>
  </button>

    <!--
  SPDX-License-Identifier: Apache-2.0
  Copyright (c) 2026 Andreas Rottmann
  -->

  <!-- Capture UI Layers -->
  <div id="Capture_countdown" class="pb-capture-layer d-none">
    <div class="pb-capture-box">
      <div class="pb-capture-counter" data-role="counter"></div>
      <div class="pb-capture-text" data-role="text"></div>

      <button type="button" class="btn btn-danger btn-lg mt-3" data-role="cancel">
      <i class="bi bi-x-circle me-1"></i>
      <span data-lang-key="form.cancel">Cancel</span>
  </button>
    </div>
  </div>


  <!-- Prepare / Warmup State -->
  <div id="Capture_prepare" class="pb-capture-layer d-none">
    <div class="pb-capture-box pb-capture-prepare-box">
      <div class="pb-capture-prepare-mark" aria-hidden="true">
        <i class="bi bi-stars"></i>
      </div>

      <div class="pb-capture-text mt-3" data-role="text">
        Mach dich bereit.
  Der Timer beginnt in wenigen Sekunden.
      </div>

      <button type="button" class="btn btn-danger btn-lg mt-3" data-role="cancel">
        <i class="bi bi-x-circle me-1"></i>
        <span data-lang-key="form.cancel">Cancel</span>
      </button>
    </div>
  </div>

  <!-- LiveView Waiting State -->
  <div id="Liveview_waiting_stream" class="pb-capture-layer d-none">
    <div class="pb-capture-box pb-capture-prepare-box">
      <div class="spinner-border mb-3" role="status" aria-hidden="true"></div>

      <div
        class="pb-capture-title mt-2"
        data-lang-key="liveview.waiting.title"
        data-placeholder-key="liveview.waiting.title"
        data-placeholder="Bitte warten"
      >
        Bitte warten
      </div>

      <div
        class="pb-capture-text mt-2"
        data-role="text"
        data-lang-key="liveview.waiting.text"
        data-placeholder-key="liveview.waiting.text"
        data-placeholder="Der Livestream wird gestartet…"
      >
        Der Livestream wird gestartet…
      </div>
    </div>
  </div>



  <!-- Render / Print Working (Backend-Zeit) -->
  <div id="Capture_working_render" class="pb-capture-layer d-none">
    <div class="pb-capture-box">
      <div class="spinner-border" role="status" aria-hidden="true"></div>

      <div class="pb-capture-text mt-3" data-role="text" data-lang-key="capture.working.render">
        Processing photos…
      </div>
    </div>
  </div>

  <!-- Abort / Transition Working -->
  <div id="Capture_working_abort" class="pb-capture-layer d-none">
    <div class="pb-capture-box">
      <div class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></div>

      <div class="pb-capture-text mt-3" data-lang-key="capture.working.abort">
        Cancelling…
      </div>
    </div>
  </div>

  <!-- Error State -->
  <div id="Capture_error" class="pb-capture-layer d-none">
    <div class="pb-capture-box">
      <div class="pb-capture-title" data-lang-key="capture.error.title">
        Error
      </div>

      <div class="pb-capture-text mt-2" data-role="text"></div>

      <button type="button" class="btn btn-light btn-lg mt-3" data-role="close" data-lang-key="common.ok">
        OK
      </button>
    </div>
  </div>

  <!-- Finish State -->
  <div id="Capture_finish" class="pb-capture-layer d-none">
    <div class="pb-capture-box">
      <div class="pb-capture-title" data-lang-key="capture.finish.title">
        Done
      </div>
      <div class="pb-capture-text mt-2" data-role="text"></div>
      <div class="pb-capture-debug-print-hint alert alert-warning small mt-3 d-none" data-role="debug-print-hint">
        Debug-Modus: Es wurde nicht gedruckt.
      </div>
    </div>
  </div>

  <!-- Finish State + Img -->
  <div id="Capture_finish_with_img" class="pb-capture-layer d-none">
    <div class="pb-finish-img-box">
      <div class="pb-finish-img-left">
        <img data-role="image" class="pb-finish-img d-none" alt="Preview" />
      </div>

      <div class="pb-finish-img-right">
        <div class="pb-capture-title" data-lang-key="capture.finish.title">
          Done
        </div>
        <div class="pb-capture-text mt-2" data-role="text"></div>

        <div class="pb-capture-debug-print-hint alert alert-warning small mt-3 d-none" data-role="debug-print-hint">
          Debug-Modus: Es wurde nicht gedruckt.
        </div>

        <!-- Coin-Print-Flow: Saldo-Anzeige + Druckbutton statt Auto-Print, wenn Münzzähler aktiv ist.
             Saldo bewusst groß/prominent (nicht "small") -- das Guthaben-Badge im
             #pb-connection-panel unten rechts ist während dieses Vollbild-Overlays
             nicht sichtbar, hier ist die einzige Anzeige, die der Nutzer sieht. -->
        <div id="coin_print_area" class="mt-3 d-none">
          <div class="mb-2" data-lang-key="capture.finish.coin.balance_label" style="font-size: 1.1rem;">
            Credit:
          </div>
          <div class="mb-3">
            <span id="coin_print_balance" class="badge bg-success" style="font-size: 2rem; padding: 0.4em 0.7em;"></span>
          </div>

          <button type="button" id="coin_print_btn" class="btn btn-success btn-lg" disabled>
            <i class="bi bi-printer-fill"></i>
            <span data-lang-key="capture.finish.coin.print_btn">Print</span>
            <span id="coin_print_cost"></span>
          </button>

          <div id="coin_print_insufficient_hint" class="pb-capture-text small mt-2 text-warning d-none" data-lang-key="capture.finish.coin.insufficient">
            Please insert more coins to print.
          </div>
        </div>

         <div class="mt-3">
          <button type="button" id="print_again" class="btn btn-warning btn-lg">
           <i class="bi bi-printer-fill"></i> <span data-lang-key="form.print_again">Print again</span>
          </button>
        </div>

        <!-- Coin-Print-Flow: ersetzt den generischen Close-Button, damit das
             Overlay offen bleibt, bis der Nutzer aktiv ein neues Foto startet
             (statt automatisch/vorzeitig zu schließen, während noch gedruckt
             werden könnte). -->
        <div class="mt-3 d-none" id="coin_print_new_photo_area">
          <button type="button" id="coin_print_new_photo_btn" class="btn btn-primary btn-lg">
            <span data-lang-key="capture.finish.coin.new_photo_btn">New photo</span>
          </button>
        </div>

        <div class="mt-3" id="capture_finish_close_area">
          <button type="button" class="btn btn-primary btn-lg" data-role="close" data-lang-key="form.close">
            Close
          </button>
        </div>
      </div>
    </div>
  </div>

  <!-- Preview Between Shots -->
  <div id="Capture_preview_between_shots" class="pb-capture-layer d-none">
    <div class="pb-shot-preview-box">
      <div class="pb-shot-preview-frame">
        <img
          data-role="image"
          class="pb-shot-preview-img d-none"
          alt="Preview"
        />
      </div>
    </div>
  </div>

  <!-- Capture Working (Minimal / White) -->
   <!-- svg ist nur durch javascript animiert  die funciton PB.shutter.playIn,   el.classList.remove('is-playing'); -->
  <div id="Capture_working_capture" class="pb-capture-layer d-none bg-white shutter">
    <div class="d-flex justify-content-center align-items-center working_capture" style="width:100vw; height:100vh;">
      <svg version="1.1" class="captureShutterSvg" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" width="100%" height="100%" viewBox="0 0 95.879 118.764" enable-background="new 0 0 95.879 100" xml:space="preserve">
    <style>
  /***************************************************
   * Generated by SVG Artista on 8/12/2025, 3:29:17 PM
   * MIT license (https://opensource.org/licenses/MIT)
   * W. https://svgartista.net
   **************************************************/

  @-webkit-keyframes animate-svg-fill-1 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-1 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-1 {
    -webkit-animation: animate-svg-fill-1 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 0.8s both;
            animation: animate-svg-fill-1 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 0.8s both;
  }

  @-webkit-keyframes animate-svg-fill-2 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-2 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-2 {
    -webkit-animation: animate-svg-fill-2 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 0.9s both;
            animation: animate-svg-fill-2 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 0.9s both;
  }

  @-webkit-keyframes animate-svg-fill-3 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-3 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-3 {
    -webkit-animation: animate-svg-fill-3 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1s both;
            animation: animate-svg-fill-3 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1s both;
  }

  @-webkit-keyframes animate-svg-fill-4 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-4 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-4 {
    -webkit-animation: animate-svg-fill-4 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.1s both;
            animation: animate-svg-fill-4 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.1s both;
  }

  @-webkit-keyframes animate-svg-fill-5 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-5 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-5 {
    -webkit-animation: animate-svg-fill-5 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.2000000000000002s both;
            animation: animate-svg-fill-5 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.2000000000000002s both;
  }

  @-webkit-keyframes animate-svg-fill-6 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-6 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-6 {
    -webkit-animation: animate-svg-fill-6 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.3s both;
            animation: animate-svg-fill-6 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.3s both;
  }

  @-webkit-keyframes animate-svg-fill-7 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-7 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-7 {
    -webkit-animation: animate-svg-fill-7 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.4000000000000001s both;
            animation: animate-svg-fill-7 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.4000000000000001s both;
  }

  @-webkit-keyframes animate-svg-fill-8 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-8 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-8 {
    -webkit-animation: animate-svg-fill-8 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.5s both;
            animation: animate-svg-fill-8 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.5s both;
  }

  @-webkit-keyframes animate-svg-fill-9 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-9 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-9 {
    -webkit-animation: animate-svg-fill-9 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.6s both;
            animation: animate-svg-fill-9 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.6s both;
  }

  @-webkit-keyframes animate-svg-fill-10 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-10 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-10 {
    -webkit-animation: animate-svg-fill-10 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.7000000000000002s both;
            animation: animate-svg-fill-10 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.7000000000000002s both;
  }

  @-webkit-keyframes animate-svg-fill-11 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-11 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-11 {
    -webkit-animation: animate-svg-fill-11 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.8s both;
            animation: animate-svg-fill-11 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.8s both;
  }

  @-webkit-keyframes animate-svg-fill-12 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-12 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-12 {
    -webkit-animation: animate-svg-fill-12 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.9000000000000001s both;
            animation: animate-svg-fill-12 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 1.9000000000000001s both;
  }

  @-webkit-keyframes animate-svg-fill-13 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-13 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-13 {
    -webkit-animation: animate-svg-fill-13 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2s both;
            animation: animate-svg-fill-13 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2s both;
  }

  @-webkit-keyframes animate-svg-fill-14 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-14 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-14 {
    -webkit-animation: animate-svg-fill-14 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.1s both;
            animation: animate-svg-fill-14 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.1s both;
  }

  @-webkit-keyframes animate-svg-fill-15 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-15 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-15 {
    -webkit-animation: animate-svg-fill-15 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.2s both;
            animation: animate-svg-fill-15 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.2s both;
  }

  @-webkit-keyframes animate-svg-fill-16 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-16 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-16 {
    -webkit-animation: animate-svg-fill-16 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.3s both;
            animation: animate-svg-fill-16 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.3s both;
  }

  @-webkit-keyframes animate-svg-fill-17 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-17 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-17 {
    -webkit-animation: animate-svg-fill-17 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.4000000000000004s both;
            animation: animate-svg-fill-17 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.4000000000000004s both;
  }

  @-webkit-keyframes animate-svg-fill-18 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  @keyframes animate-svg-fill-18 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(0, 0, 0);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-18 {
    -webkit-animation: animate-svg-fill-18 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.5s both;
            animation: animate-svg-fill-18 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.5s both;
  }

  @-webkit-keyframes animate-svg-fill-19 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-19 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-19 {
    -webkit-animation: animate-svg-fill-19 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.6s both;
            animation: animate-svg-fill-19 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.6s both;
  }

  @-webkit-keyframes animate-svg-fill-20 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  @keyframes animate-svg-fill-20 {
    0% {
      fill: transparent;
    }

    100% {
      fill: rgb(255, 255, 255);
    }
  }

  .shutter.is-playing .captureShutterSvg .svg-elem-20 {
    -webkit-animation: animate-svg-fill-20 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.7s both;
            animation: animate-svg-fill-20 0.7s cubic-bezier(0.47, 0, 0.745, 0.715) 2.7s both;
  }

    </style>

  <path fill="#FFFFFF" d="M95.799,49.75c0.021,0,0.041,0,0.062,0c0-7.548-0.036-15.095,0.019-22.642
  	c0.022-2.94-0.571-5.687-1.93-8.284c-1.408-2.694-3.283-4.905-6.256-5.915c-1.785-0.605-3.635-1.022-5.416-1.64
  	c-10.01-3.46-20.01-6.95-30.009-10.44c-2.511-0.876-5.065-1.142-7.624-0.386c-3.518,1.039-7.021,2.132-10.49,3.322
  	C25.888,6.601,17.657,9.54,9.388,12.373c-5.246,1.798-7.893,5.808-8.954,10.871c-0.55,2.627-0.272,5.434-0.31,8.159
  	C0.057,36.35,0.016,41.295,0,46.241c-0.007,2.203,0.099,4.407,0.11,6.611c0.034,6.493-0.066,12.988,0.114,19.478
  	c0.093,3.347,0.557,6.678,2.563,9.604c1.565,2.282,3.363,4.303,5.933,5.342c5.46,2.207,10.959,4.326,16.492,6.342
  	c5.234,1.906,10.527,3.653,15.808,5.432c3.208,1.081,6.592,1.589,9.857,0.904c4.233-0.888,8.365-2.304,12.504-3.61
  	c2.67-0.846,5.281-1.878,7.9-2.873c4.852-1.845,9.715-3.66,14.527-5.603c6.457-2.604,9.716-7.646,9.932-14.426
  	C95.991,65.552,95.799,57.647,95.799,49.75z" class="svg-elem-1"></path>
  <path d="M95.799,49.75c0,7.897,0.191,15.803-0.059,23.692c-0.215,6.78-3.474,11.82-9.931,14.426
  	c-4.813,1.941-9.677,3.758-14.526,5.603c-2.621,0.995-5.231,2.027-7.902,2.873c-4.137,1.308-8.27,2.724-12.504,3.61
  	c-3.266,0.685-6.648,0.177-9.856-0.904c-5.28-1.777-10.573-3.524-15.808-5.432c-5.533-2.016-11.032-4.135-16.492-6.342
  	c-2.569-1.039-4.367-3.06-5.933-5.342c-2.007-2.928-2.471-6.26-2.563-9.604c-0.181-6.488-0.08-12.983-0.114-19.478
  	C0.099,50.648-0.007,48.444,0,46.241c0.016-4.946,0.057-9.892,0.124-14.837c0.037-2.727-0.24-5.532,0.31-8.159
  	c1.062-5.063,3.708-9.073,8.954-10.871c8.269-2.833,16.5-5.771,24.767-8.607c3.469-1.19,6.973-2.283,10.49-3.322
  	c2.559-0.756,5.113-0.49,7.624,0.386c9.999,3.49,19.999,6.98,30.009,10.44c1.781,0.616,3.631,1.033,5.416,1.64
  	c2.973,1.01,4.848,3.221,6.256,5.915c1.357,2.599,1.952,5.344,1.93,8.284c-0.055,7.547-0.019,15.094-0.019,22.642
  	C95.84,49.75,95.82,49.75,95.799,49.75z M93.863,49.831c0.031,0,0.063,0,0.095,0c0-2.877,0.01-5.755-0.002-8.633
  	c-0.023-4.879,0.104-9.767-0.137-14.635c-0.29-5.926-2.691-10.635-8.604-12.898c-3.896-1.492-7.789-2.999-11.704-4.439
  	c-6.513-2.397-12.966-4.954-19.716-6.688c-3.744-0.961-7.438-1.224-11.104-0.063C36.11,4.56,29.569,6.782,23.032,9.011
  	c-4.146,1.412-8.291,2.845-12.358,4.465c-1.621,0.646-3.265,1.584-4.49,2.801c-2.86,2.837-4.084,6.504-4.226,10.484
  	c-0.148,4.172-0.224,8.351-0.193,12.524c0.08,11.266,0.199,22.528,0.373,33.792c0.088,5.697,3.292,9.516,8.03,12.073
  	c2.418,1.306,5.121,2.098,7.726,3.04c3.328,1.205,6.724,2.23,10.024,3.507c5.433,2.1,10.86,4.212,16.612,5.261
  	c1.909,0.349,3.92,0.595,5.831,0.389c4.771-0.516,9.257-2.247,13.755-3.818c4.235-1.48,8.403-3.157,12.604-4.742
  	c2.887-1.089,5.842-2.024,8.65-3.285c5.262-2.358,8.287-6.521,8.44-12.296C94.019,65.419,93.863,57.623,93.863,49.831z" class="svg-elem-2"></path>
  <path fill="#FFFFFF" d="M93.863,49.831c0,7.792,0.155,15.588-0.052,23.374c-0.152,5.774-3.18,9.938-8.439,12.296
  	c-2.811,1.261-5.766,2.196-8.651,3.285c-4.2,1.585-8.368,3.262-12.604,4.742c-4.498,1.571-8.982,3.304-13.754,3.818
  	c-1.91,0.206-3.922-0.04-5.831-0.389c-5.752-1.049-11.18-3.161-16.612-5.261c-3.301-1.275-6.696-2.302-10.024-3.507
  	c-2.604-0.942-5.308-1.734-7.726-3.04c-4.738-2.56-7.942-6.376-8.03-12.073C1.964,61.814,1.845,50.552,1.765,39.286
  	c-0.03-4.175,0.045-8.354,0.193-12.524c0.142-3.979,1.366-7.646,4.226-10.484c1.226-1.217,2.869-2.155,4.49-2.801
  	c4.067-1.62,8.213-3.053,12.358-4.465C29.569,6.782,36.11,4.56,42.693,2.474c3.664-1.16,7.359-0.897,11.104,0.063
  	c6.748,1.733,13.201,4.29,19.715,6.688c3.916,1.44,7.808,2.947,11.703,4.439c5.912,2.265,8.313,6.974,8.604,12.898
  	c0.239,4.868,0.112,9.756,0.136,14.635c0.014,2.878,0.002,5.756,0.002,8.633C93.926,49.831,93.895,49.831,93.863,49.831z
  	 M91.399,50.524c0.021,0,0.045,0,0.066,0c0-3.229,0.021-6.458-0.006-9.688c-0.043-5.019,0.008-10.042-0.217-15.053
  	c-0.229-5.082-3.013-8.396-7.861-10.078c-4.34-1.505-8.637-3.136-12.959-4.69C65.11,9.103,59.82,7.125,54.467,5.339
  	c-3.973-1.324-7.994-1.905-12.134-0.325c-4.748,1.813-9.593,3.369-14.381,5.076c-5.582,1.991-11.157,4.005-16.715,6.063
  	c-0.97,0.359-1.926,0.882-2.734,1.523c-2.878,2.279-4.006,5.469-4.104,8.985C4.269,31.328,4.332,36,4.36,40.668
  	C4.422,51.126,4.516,61.583,4.59,72.04c0.041,5.753,2.633,9.781,8.064,11.839c3.771,1.43,7.553,2.834,11.363,4.15
  	c6.164,2.129,12.37,4.136,18.53,6.273c4.009,1.391,7.958,1.526,11.92-0.094c0.355-0.146,0.726-0.263,1.088-0.396
  	c9.449-3.473,18.895-6.954,28.349-10.412c3.229-1.182,5.601-3.313,6.657-6.562c0.584-1.794,0.775-3.776,0.801-5.68
  	C91.456,64.284,91.399,57.403,91.399,50.524z" class="svg-elem-3"></path>
  <path d="M91.399,50.524c0,6.879,0.057,13.76-0.035,20.638c-0.025,1.902-0.217,3.886-0.801,5.68c-1.057,3.249-3.427,5.38-6.657,6.562
  	c-9.454,3.458-18.899,6.94-28.349,10.412c-0.362,0.134-0.73,0.25-1.088,0.396c-3.963,1.62-7.911,1.483-11.92,0.094
  	c-6.16-2.139-12.366-4.146-18.53-6.273c-3.811-1.316-7.593-2.722-11.363-4.15c-5.432-2.058-8.023-6.086-8.064-11.839
  	C4.518,61.585,4.423,51.128,4.362,40.67c-0.028-4.668-0.091-9.34,0.039-14.006c0.098-3.518,1.226-6.706,4.104-8.985
  	c0.809-0.643,1.765-1.164,2.734-1.523c5.558-2.059,11.133-4.071,16.715-6.063c4.788-1.706,9.633-3.265,14.381-5.076
  	c4.14-1.58,8.162-0.999,12.134,0.325c5.354,1.786,10.644,3.765,15.955,5.677c4.322,1.556,8.619,3.187,12.959,4.69
  	c4.85,1.682,7.633,4.996,7.861,10.078c0.225,5.011,0.174,10.034,0.217,15.053c0.027,3.229,0.006,6.458,0.006,9.688
  	C91.444,50.524,91.422,50.524,91.399,50.524z M47.806,12.232C27.552,11.88,10.422,29.667,10.601,49.72
  	c0.178,19.995,16.469,37.169,37.292,37.392c19.154,0.206,37.102-15.237,37.191-37.483C85.17,28.934,67.268,11.782,47.806,12.232z
  	 M14.494,23.361c0-1.401-0.943-2.521-2.126-2.521c-1.227,0-2.424,1.198-2.428,2.431c-0.005,1.293,1.04,2.479,2.204,2.507
  	C13.421,25.807,14.495,24.703,14.494,23.361z M83.963,73.124c-1.189-0.018-2.146,0.842-2.178,1.959
  	c-0.033,1.121,1.027,2.18,2.227,2.223c1.168,0.042,2.121-0.903,2.13-2.109C86.149,74.028,85.217,73.142,83.963,73.124z
  	 M12.275,77.341c1.256,0.007,2.204-0.81,2.205-1.896c0.002-1.115-1.108-2.121-2.321-2.104c-1.095,0.017-1.968,0.882-1.945,1.928
  	C10.238,76.453,11.116,77.335,12.275,77.341z M85.945,23.835c0.017-1.288-0.666-2.106-1.784-2.145
  	c-1.322-0.044-2.174,0.74-2.172,1.998c0.002,1.273,0.768,2.151,1.912,2.193C85.054,25.925,85.93,25.047,85.945,23.835z" class="svg-elem-4"></path>
  <path fill="#FFFFFF" d="M47.806,12.232c19.462-0.45,37.364,16.701,37.278,37.396c-0.09,22.246-18.037,37.689-37.191,37.483
  	c-20.824-0.221-37.115-17.395-37.292-37.39C10.422,29.667,27.552,11.881,47.806,12.232z M48.763,33.045
  	c-10.366-0.004-16.499,8.137-16.537,16.534c-0.038,8.552,6.729,15.376,15.128,15.581c9.057,0.221,16.122-7.913,16.283-14.768
  	C63.887,39.696,55.275,32.733,48.763,33.045z M34.717,80.742c-0.045-0.479-0.043-0.753-0.098-1.017
  	c-1.034-4.976-1.989-9.97-3.139-14.918c-1.078-4.642-2.519-9.207-2.249-14.063c0.035-0.628-0.132-1.269-0.221-2.04
  	c-0.241,0.218-0.362,0.291-0.436,0.397c-3.347,4.851-6.701,9.693-10.003,14.573c-0.235,0.349-0.249,1.042-0.068,1.439
  	c0.538,1.177,1.211,2.293,1.855,3.418C23.634,74.252,28.67,77.899,34.717,80.742z M34.95,62.902c0,0.356-0.027,0.532,0.004,0.696
  	c1.1,5.926,2.191,11.854,3.341,17.77c0.07,0.359,0.552,0.804,0.926,0.91c1.109,0.313,2.263,0.47,3.396,0.699
  	c6.252,1.261,12.247,0.146,18.277-2.001c-0.312-0.279-0.534-0.542-0.812-0.721c-3.635-2.321-7.277-4.628-10.912-6.945
  	C44.272,70.188,39.177,67.336,34.95,62.902z M16.584,60.553c5.889-8.517,11.621-16.807,17.414-25.183
  	c-0.374-0.047-0.748-0.16-1.108-0.125c-1.114,0.109-2.229,0.245-3.335,0.426c-4.041,0.664-8.083,1.328-12.112,2.061
  	c-0.449,0.081-1.061,0.522-1.184,0.925c-0.574,1.871-1.128,3.765-1.46,5.69c-0.863,5.017-0.706,9.984,1.106,14.813
  	C16.046,59.535,16.255,59.885,16.584,60.553z M61.945,18.713c-0.144,0.077-0.286,0.154-0.431,0.231
  	c1.854,10.131,3.706,20.262,5.589,30.55c0.533-0.646,1.056-1.169,1.446-1.772c2.861-4.409,5.707-8.827,8.513-13.271
  	c0.201-0.318,0.205-0.968,0.015-1.296c-2.98-5.11-6.861-9.381-11.912-12.527C64.105,19.966,63.02,19.35,61.945,18.713z
  	 M48.588,68.552c-0.055,0.091-0.111,0.181-0.168,0.271c1.568,1.139,3.105,2.325,4.715,3.403c1.277,0.855,2.668,1.545,3.968,2.371
  	c1.806,1.146,3.524,2.431,5.366,3.511c2.156,1.265,2.365,1.133,4.349-0.394c4.08-3.136,7.388-6.952,10.115-11.289
  	c0.666-1.058,1.237-2.173,1.89-3.326C68.64,64.936,58.614,66.743,48.588,68.552z M61.94,62.736c0.479,0.022,0.652,0.063,0.813,0.034
  	c2.52-0.437,5.043-0.849,7.553-1.33c2.889-0.558,5.754-1.248,8.654-1.729c0.938-0.154,1.338-0.484,1.506-1.359
  	c1.279-6.643,1.308-13.233-0.734-19.747c-0.117-0.375-0.32-0.723-0.604-1.349C73.325,45.841,68.348,54.644,61.94,62.736z
  	 M18.441,34.425c10.17-1.702,20.107-3.365,30.045-5.029c0.002-0.128,0.005-0.256,0.009-0.384c-0.433-0.281-0.855-0.574-1.294-0.844
  	c-3.284-2.017-6.571-4.028-9.859-6.04c-1.195-0.73-2.396-1.454-3.592-2.183c-0.739-0.449-1.413-0.352-2.15,0.093
  	c-5.313,3.203-9.532,7.469-12.588,12.87C18.783,33.311,18.679,33.781,18.441,34.425z M60.625,34.489
  	c0.045-0.523,0.086-0.664,0.063-0.795c-0.828-5.293-1.651-10.587-2.526-15.873c-0.05-0.3-0.479-0.692-0.8-0.769
  	c-6.368-1.525-12.746-1.881-19.117-0.01c-0.571,0.167-1.114,0.431-1.672,0.648c-0.03,0.148-0.062,0.298-0.093,0.447
  	C44.935,22.845,52.981,28.147,60.625,34.489z" class="svg-elem-5"></path>
  <path fill="#FFFFFF" d="M14.494,23.361c0.001,1.342-1.073,2.445-2.35,2.417c-1.164-0.026-2.209-1.214-2.204-2.507
  	c0.004-1.231,1.201-2.431,2.428-2.431C13.551,20.842,14.494,21.96,14.494,23.361z" class="svg-elem-6"></path>
  <path fill="#FFFFFF" d="M83.963,73.124c1.254,0.019,2.187,0.904,2.179,2.071c-0.009,1.206-0.962,2.151-2.13,2.109
  	c-1.198-0.043-2.26-1.102-2.227-2.223C81.817,73.966,82.773,73.106,83.963,73.124z" class="svg-elem-7"></path>
  <path fill="#FFFFFF" d="M12.275,77.341c-1.159-0.006-2.037-0.888-2.062-2.072c-0.022-1.046,0.851-1.911,1.945-1.928
  	c1.213-0.019,2.323,0.987,2.321,2.104C14.479,76.531,13.531,77.347,12.275,77.341z" class="svg-elem-8"></path>
  <path fill="#FFFFFF" d="M85.945,23.835c-0.016,1.212-0.892,2.09-2.044,2.048c-1.146-0.042-1.91-0.92-1.912-2.193
  	c-0.002-1.258,0.85-2.042,2.172-1.998C85.279,21.728,85.961,22.547,85.945,23.835z" class="svg-elem-9"></path>
  <path d="M48.763,33.045c6.513-0.312,15.124,6.651,14.874,17.349c-0.161,6.854-7.229,14.987-16.283,14.768
  	c-8.398-0.205-15.166-7.029-15.128-15.581C32.264,41.181,38.396,33.041,48.763,33.045z M41.948,39.681
  	c-1.703-0.015-3.116,1.153-3.137,2.595c-0.018,1.234,1.396,2.521,2.761,2.513c1.581-0.01,2.822-1.23,2.822-2.778
  	C44.395,40.696,43.34,39.692,41.948,39.681z M38.668,48.049c-1.342-0.005-2.128,0.739-2.138,2.023
  	c-0.01,1.241,1.289,2.6,2.463,2.576c1.008-0.021,1.804-0.799,1.822-1.783C40.846,49.282,39.908,48.053,38.668,48.049z" class="svg-elem-10"></path>
  <path d="M34.717,80.742c-6.047-2.843-11.083-6.49-14.357-12.208c-0.645-1.125-1.317-2.241-1.855-3.418
  	c-0.181-0.396-0.167-1.092,0.068-1.438c3.302-4.881,6.656-9.725,10.003-14.574c0.073-0.106,0.194-0.181,0.436-0.397
  	c0.089,0.771,0.256,1.412,0.221,2.04c-0.27,4.855,1.171,9.422,2.249,14.063c1.149,4.948,2.104,9.942,3.139,14.918
  	C34.674,79.989,34.672,80.264,34.717,80.742z" class="svg-elem-11"></path>
  <path d="M34.95,62.902c4.227,4.434,9.322,7.285,14.22,10.408c3.636,2.317,7.279,4.624,10.912,6.945
  	c0.277,0.179,0.502,0.44,0.813,0.721c-6.029,2.147-12.023,3.262-18.277,2.001c-1.134-0.229-2.287-0.388-3.396-0.699
  	c-0.374-0.106-0.855-0.551-0.926-0.91c-1.149-5.916-2.241-11.844-3.341-17.77C34.923,63.435,34.95,63.26,34.95,62.902z" class="svg-elem-12"></path>
  <path d="M16.584,60.553c-0.329-0.668-0.538-1.019-0.679-1.393c-1.813-4.829-1.97-9.798-1.106-14.813
  	c0.332-1.927,0.886-3.819,1.46-5.69c0.123-0.401,0.734-0.844,1.184-0.925c4.029-0.731,8.071-1.396,12.112-2.061
  	c1.105-0.181,2.221-0.315,3.335-0.426c0.36-0.035,0.734,0.078,1.108,0.125C28.205,43.747,22.473,52.037,16.584,60.553z" class="svg-elem-13"></path>
  <path d="M61.945,18.713c1.074,0.638,2.16,1.253,3.22,1.913c5.051,3.146,8.932,7.417,11.912,12.527
  	c0.19,0.328,0.188,0.978-0.015,1.296c-2.806,4.444-5.651,8.862-8.513,13.271c-0.393,0.604-0.913,1.126-1.446,1.772
  	c-1.883-10.288-3.735-20.419-5.589-30.55C61.659,18.867,61.801,18.79,61.945,18.713z" class="svg-elem-14"></path>
  <path d="M48.588,68.552c10.025-1.809,20.052-3.615,30.233-5.452c-0.651,1.153-1.224,2.27-1.89,3.327
  	c-2.729,4.336-6.035,8.152-10.115,11.288c-1.982,1.525-2.191,1.657-4.35,0.394c-1.842-1.08-3.562-2.364-5.365-3.511
  	c-1.3-0.826-2.689-1.516-3.969-2.371c-1.608-1.078-3.146-2.266-4.714-3.403C48.477,68.731,48.534,68.642,48.588,68.552z" class="svg-elem-15"></path>
  <path d="M61.94,62.736c6.407-8.093,11.385-16.896,17.188-25.48c0.283,0.626,0.485,0.974,0.604,1.349
  	c2.042,6.514,2.014,13.104,0.734,19.747c-0.168,0.875-0.568,1.205-1.506,1.359c-2.9,0.481-5.767,1.173-8.654,1.729
  	c-2.51,0.481-5.033,0.895-7.553,1.33C62.592,62.799,62.42,62.76,61.94,62.736z" class="svg-elem-16"></path>
  <path d="M18.441,34.425c0.237-0.644,0.342-1.113,0.569-1.517c3.056-5.401,7.275-9.667,12.588-12.87
  	c0.737-0.443,1.411-0.542,2.15-0.093c1.196,0.729,2.396,1.451,3.592,2.183c3.288,2.012,6.575,4.023,9.859,6.04
  	c0.438,0.27,0.862,0.563,1.293,0.844c-0.002,0.128-0.006,0.256-0.008,0.384C38.549,31.059,28.611,32.722,18.441,34.425z" class="svg-elem-17"></path>
  <path d="M60.625,34.489c-7.645-6.342-15.69-11.645-24.145-16.35c0.031-0.149,0.063-0.299,0.093-0.447
  	c0.558-0.219,1.101-0.481,1.672-0.648c6.371-1.871,12.749-1.517,19.117,0.01c0.319,0.075,0.75,0.469,0.8,0.769
  	c0.875,5.286,1.698,10.58,2.526,15.873C60.711,33.825,60.67,33.966,60.625,34.489z" class="svg-elem-18"></path>
  <path fill="#FFFFFF" d="M41.948,39.681c1.392,0.012,2.446,1.016,2.446,2.327c0,1.549-1.241,2.771-2.822,2.779
  	c-1.365,0.008-2.778-1.277-2.761-2.513C38.832,40.835,40.245,39.667,41.948,39.681z" class="svg-elem-19"></path>
  <path fill="#FFFFFF" d="M38.668,48.049c1.24,0.005,2.178,1.233,2.147,2.816c-0.019,0.984-0.814,1.763-1.822,1.783
  	c-1.174,0.022-2.473-1.335-2.463-2.576C36.54,48.788,37.326,48.044,38.668,48.049z" class="svg-elem-20"></path>

  </svg>

      <div class="spinner-border text-dark" role="status">
        <span class="visually-hidden" data-lang-key="common.loading">
          Loading…
        </span>
      </div>
    </div>
  </div>

  <!-- Trigger / Still Hold Working -->
  <div id="Capture_working_trigger" class="pb-capture-layer d-none shutter">
    <div class="pb-capture-box">
      <div id="Capture_working_trigger_loader_image">
        <img src="./src/img/trigger_wait.svg" alt="trigger_wait" style="height: 40vh; display: block; margin: 0 auto;">
      </div>

      <div class="Capture_working_trigger_loader_image_svg justify-content-center align-items-center ">
        <img src="./src/img/loading_svg.svg" alt="loading">
      </div>

      <!--<div class="spinner-border" role="status" aria-hidden="true"></div>-->

      <div class="pb-capture-title mt-3" data-lang-key="capture.working.trigger.title">
        Please hold still
      </div>

      <div class="pb-capture-text mt-2" data-role="text" data-lang-key="capture.working.trigger.text_triggering">
        The camera is taking the photo…
  please do not move.
      </div>
    </div>
  </div>



  <div id="Capture_error_paper" class="pb-capture-layer d-none">
    <div class="pb-capture-box">
      <div class="Capture_error_paper_image">
        <img src="./src/img/paper_empty.svg" alt="paper_empty" style="height: 30vh; display: block; margin: 0 auto;">
      </div>

      <div class="pb-capture-title mt-3" data-lang-key="capture.error.paper.title">
        Printer paper problem
      </div>

      <div class="pb-capture-text mt-2" data-role="text" data-lang-key="capture.error.paper.text">
        Printing is not possible.
      </div>

      <div class="mt-4 text-center">
        <button type="button" class="btn btn-light" data-role="close">
          Close
        </button>
      </div>
    </div>
  </div>



  <div id="Capture_error_printer" class="pb-capture-layer d-none">
    <div class="pb-capture-box">
      <div class="Capture_error_printer_image">
        <img src="./src/img/printer_error.svg" alt="printer_error" style="height: 30vh; display: block; margin: 0 auto;">
      </div>

      <div class="pb-capture-title mt-3" data-lang-key="capture.error.printer.title">
        Printer error
      </div>

      <div class="pb-capture-text mt-2" data-role="text" data-lang-key="capture.error.printer.text">
        Printing failed.
      </div>

      <div class="mt-4 text-center">
        <button type="button" class="btn btn-light" data-role="close">
          Close
        </button>
      </div>
    </div>
  </div>
</main>

<button
  type="button"
  id="btnExitFullscreen"
  class="pb-exit-fullscreen"
>
  <i class="bi bi-lock-fill"></i> <span aria-label="Exit fullscreen"
  data-lang-key="screen.main.exit_fullscreen.aria_label"></span>
</button>

<div
  class="modal fade"
  id="modalCloseBrowser"
  tabindex="-1"
  aria-hidden="true"
  data-bs-backdrop="static"
  data-bs-keyboard="false"
>
  <div class="modal-dialog modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content text-center">
      <div class="modal-body py-4">
        <div class="spinner-border mb-3" role="status"></div>

        <h5 data-lang-key="modal.close_app.title">
          Closing application
        </h5>

        <p class="text-muted mb-0" data-lang-key="modal.close_app.wait">
          Please wait…
        </p>
      </div>
    </div>
  </div>
</div>

<!-- infomedlung rechts unten -->
<!--
SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
-->

<!-- Toast (unten rechts) -->
<div class="toast-container position-fixed bottom-0 end-0 p-3 pb-toast-z">
  <div
    id="pbConnectionToast"
    class="toast align-items-center text-bg-dark border-0"
    role="alert"
    aria-live="polite"
    aria-atomic="true"
    data-bs-autohide="false"
  >
    <div class="d-flex">
      <div class="toast-body">
        <span id="pbConnectionToastText" data-role="pb-conn-text" data-lang-key="bridge.toast.waiting">
          Waiting for CameraBridge…
        </span>
      </div>

      <button
        type="button"
        class="btn-close btn-close-white me-2 m-auto"
        data-bs-dismiss="toast"
        data-lang-key="form.close"
        aria-label="Close"
      ></button>
    </div>
  </div>
</div>

<!-- Modals / Hauptbereiche -->
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->

<!-- sections/general_settings.php -->

<div class="modal fade"
  id="modalSettings"
  tabindex="-1"
  aria-labelledby="modalSettingsLabel"
  aria-hidden="true">

  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <i class="bi bi-gear fs-3"
          data-bs-toggle="tooltip"
          data-bs-trigger="hover click"
          data-bs-placement="top"
          title="config/config.json"></i>&nbsp;

        <h5 class="modal-title flex-grow-1"
          id="modalSettingsLabel"
          data-lang-key="overlay.settings.title">
          General Settings
        </h5>

        <button type="button"
          class="btn btn-outline-success btn-sm"
          data-bs-toggle="modal"
          data-bs-target="#modalPrinterSettings"
          title="Open Printer Settings"
          aria-label="Open Printer Settings">
          <i class="bi bi-printer"></i>
          <span data-lang-key="overlay.settings.printer">
            Open Printer Settings
          </span>
        </button>

        <button type="button"
          class="btn btn-outline-warning btn-sm"
          data-bs-toggle="modal"
          data-bs-target="#modalRenderSettings"
          title="(Advanced) Open Image Render Settings"
          aria-label="(Advanced) Open Image Render Settings">
          <i class="bi bi-card-image"></i>
          <span data-lang-key="overlay.settings.render">
            (Advanced) Open Image Render Settings
          </span>
        </button>

        <button type="button"
          class="btn btn-outline-warning btn-sm"
          data-bs-toggle="modal"
          data-bs-target="#modalCameraBridgeSettings"
          title="(Advanced) Open Camera Bridge Setup"
          aria-label="(Advanced) Open Camera Bridge Setup">
          <i class="bi bi-plugin"></i>
          <span data-lang-key="overlay.settings.cameraBridgeSetup">
            (Advanced) Open Camera Bridge Setup
          </span>
        </button>

        <button type="button"
          class="btn btn-outline-warning btn-sm"
          data-bs-toggle="modal"
          data-bs-target="#modalExternalPcSettings"
          title="Open External PC Settings"
          aria-label="Open External PC Settings">
          <i class="bi bi-usb-symbol"></i>
          <span data-lang-key="overlay.settings.externalPc">
            Open External PC Settings
          </span>
        </button>

        <button type="button"
          class="btn-close btn-close-white"
          data-bs-dismiss="modal"
          aria-label="Close"></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-3" data-lang-key="overlay.settings.description">
          Configure global options of the photobooth.
        </p>

        <form id="formGeneralSettings" class="small" data-json-file="config/config.json">

          <!-- Betriebssystem -->
          <div class="mb-3">
            <label for="settingOS" class="form-label" data-lang-key="overlay.settings.os.label">
              Operating System
            </label>

            <div class="input-group input-group-sm">
              <span class="input-group-text">
                <i id="settingOSIcon" class="bi bi-windows" aria-hidden="true"></i>
              </span>

              <select id="settingOS"
                class="form-select form-select-sm"
                data-json-group="system"
                data-json-parm="os"
                data-default-value="windows">
                <option value="windows" data-lang-key="overlay.settings.os.option_windows">
                  Windows
                </option>
                <option value="linux" data-lang-key="overlay.settings.os.option_linux">
                  Linux
                </option>
                <option value="mac" data-lang-key="overlay.settings.os.option_mac">
                  macOS
                </option>
              </select>
            </div>

            <div class="form-text text-secondary" data-lang-key="overlay.settings.os.help">
              This setting will be saved to config JSON.
            </div>
          </div>

          <!-- Sprache -->
          <div class="mb-3">
            <label for="settingLanguage" class="form-label" data-lang-key="overlay.settings.language.label">
              Language
            </label>

            <select id="settingLanguage"
              class="form-select form-select-sm"
              data-json-parm="language"
              data-default-value="en">
              <option value="en" data-lang-key="overlay.settings.language.option_en">
                🇬🇧 English
              </option>
              <option value="de" data-lang-key="overlay.settings.language.option_de">
                🇩🇪 Deutsch
              </option>
            </select>

            <div class="form-text text-secondary" data-lang-key="overlay.settings.language.help">
              This setting will be saved to config JSON.
            </div>
          </div>

          <hr class="border-secondary">

          <div class="accordion accordion-flush" id="accordionGeneralSettingsForm1">

            <!-- UI / Layout -->
            <div class="accordion-item bg-dark text-light border border-secondary">
              <h2 class="accordion-header" id="accUiHead">
                <button class="accordion-button collapsed bg-dark text-warning"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#accUiBody"
                  aria-expanded="false"
                  aria-controls="accUiBody">
                  <span class="text-uppercase" data-lang-key="overlay.settings.ui.title">
                    User Interface
                  </span>
                </button>
              </h2>

              <div id="accUiBody"
                class="accordion-collapse collapse"
                aria-labelledby="accUiHead"
                data-bs-parent="#accordionGeneralSettingsForm1">
                <div class="accordion-body pt-2 bg-dark text-light">

                  <div class="row">
                    <div class="col-md-6 mb-3">
                      <label for="settingBgColor" class="form-label" data-lang-key="overlay.settings.ui.bgcolor.label">
                        Background Color
                      </label>
                      <input type="color"
                        id="settingBgColor"
                        class="form-control form-control-color"
                        value="#000000"
                        data-json-group="ui"
                        data-json-parm="main_background_color"
                        data-json-type="color"
                        data-default-value="#000000">
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingTheme" class="form-label" data-lang-key="overlay.settings.ui.theme.label">
                        Theme Style
                      </label>
                      <select id="settingTheme"
                        class="form-select form-select-sm"
                        data-json-group="ui"
                        data-json-parm="theme"
                        data-default-value="dark">
                        <option value="dark" selected data-lang-key="overlay.settings.ui.theme.option_dark">
                          Dark
                        </option>
                        <option value="light" data-lang-key="overlay.settings.ui.theme.option_light">
                          Light
                        </option>
                      </select>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label for="bgStaticImgChoose" class="form-label" data-lang-key="overlay.settings.bgStaticImgChoose.label">
                      Background Image
                    </label>

                    <div class="input-group input-group-sm">
                      <input class="form-control" type="text"
                        id="bgStaticImgChoose"
                        placeholder="uploads/bgImage.jpg"
                        data-json-group="ui"
                        data-json-parm="bgStaticImg"
                        data-default-value="uploads/bgImage.jpg">

                      <button class="pb-upload btn btn-outline-warning"
                        data-filter="Images|*.png;*.jpg;*.jpeg;*.webp;*.bmp;*.gif|All|*.*"
                        data-subdir=""
                        data-prefix=""
                        data-overwrite="0"
                        data-target="#bgStaticImgChoose">
                        <span data-lang-key="form.pick_file_upload">
                          Pick file to Upload
                        </span>
                      </button>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <!-- Aufnahme / Countdown -->
            <div class="accordion-item bg-dark text-light border border-secondary">
              <h2 class="accordion-header" id="accCaptureHead">
                <button class="accordion-button collapsed bg-dark text-warning"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#accCaptureBody"
                  aria-expanded="false"
                  aria-controls="accCaptureBody">
                  <span class="text-uppercase" data-lang-key="overlay.settings.capture.title">
                    Capture Settings
                  </span>
                </button>
              </h2>

              <div id="accCaptureBody"
                class="accordion-collapse collapse"
                aria-labelledby="accCaptureHead"
                data-bs-parent="#accordionGeneralSettingsForm1">
                <div class="accordion-body pt-2 bg-dark text-light">

                  <div class="row">
                    <div class="col-md-12 mb-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox"
                          id="settingPrepareOverlayEnabled"
                          checked
                          data-json-group="capture"
                          data-json-parm="prepare_overlay_enabled"
                          data-default-value="true">
                        <label class="form-check-label"
                          for="settingPrepareOverlayEnabled"
                          data-lang-key="overlay.settings.capture.prepare_overlay_enabled">
                          Show prepare screen before countdown
                        </label>
                      </div>
                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.prepare_overlay_enabled_help">
                        Shows a friendly prepare screen while the camera preview becomes ready. The countdown still starts as soon as the preview image is available.
                      </div>
                    </div>

                    <div class="col-md-4 mb-3">
                      <label for="settingCounterFirst" class="form-label" data-lang-key="overlay.settings.capture.counter_first">
                        Countdown before first photo (s)
                      </label>
                      <input type="number" min="1" max="20" step="1"
                        id="settingCounterFirst"
                        class="form-control form-control-sm"
                        value="3"
                        data-json-group="capture"
                        data-json-parm="counter_first_image"
                        data-json-type="int"
                        data-default-value="3">
                    </div>

                    <div class="col-md-4 mb-3">
                      <label for="settingCounterBetween" class="form-label" data-lang-key="overlay.settings.capture.counter_between">
                        Seconds between photos
                      </label>
                      <input type="number" min="1" max="20" step="1"
                        id="settingCounterBetween"
                        class="form-control form-control-sm"
                        value="5"
                        data-json-group="capture"
                        data-json-parm="counter_between_each_photo"
                        data-json-type="int"
                        data-default-value="5">
                    </div>

                    <div class="col-md-4 mb-3">
                      <label for="settingCounterUntilCapture"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.counter_until_capture">
                        Seconds until capture
                      </label>

                      <input type="number"
                        min="1"
                        max="20"
                        step="1"
                        id="settingCounterUntilCapture"
                        class="form-control form-control-sm"
                        value="3"
                        data-json-group="capture"
                        data-json-parm="counter_until_capture"
                        data-json-type="int"
                        data-default-value="3">
                    </div>

                    <div class="col-md-4 mb-3">
                      <label for="settingCounterAfter" class="form-label" data-lang-key="overlay.settings.capture.counter_after">
                        Delay after series (s)
                      </label>
                      <input type="number" min="1" max="20" step="1"
                        id="settingCounterAfter"
                        class="form-control form-control-sm"
                        value="5"
                        data-json-group="capture"
                        data-json-parm="counter_after_finish_serie"
                        data-json-type="int"
                        data-default-value="5">
                    </div>
                

                  <div class="col-md-4 mb-3">
                      <label for="settingCounterPreviewImg" class="form-label" data-lang-key="overlay.settings.capture.preview_img_time">
                        Time for Show each finish photo
                      </label>
                      <input type="number" min="1" max="20" step="1"
                        id="settingCounterPreviewImg"
                        class="form-control form-control-sm"
                        value="1"
                        data-json-group="capture"
                        data-json-parm="preview_img_time"
                        data-json-type="int"
                        data-default-value="1">
                    </div>
                  </div>

                  <!-- Texte während capture -->
                  <div class="row">

                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCaptureStarting"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_starting">
                        Text: Starting
                      </label>

                      <input type="text"
                        id="settingTxtCaptureStarting"
                        class="form-control form-control-sm"
                        value="Starting…"
                        data-json-group="capture"
                        data-json-parm="text_starting"
                        data-json-type="string"
                        data-default-value="Starting…">
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCaptureNextPhoto"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_next_photo">
                        Next photo
                      </label>

                      <input type="text"
                        id="settingTxtCaptureNextPhoto"
                        class="form-control form-control-sm"
                        value="Next photo…"
                        data-json-group="capture"
                        data-json-parm="text_next_photo"
                        data-json-type="string"
                        data-default-value="Next photo…">
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCaptureProcessing"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_processing">
                        Processing
                      </label>

                      <input type="text"
                        id="settingTxtCaptureProcessing"
                        class="form-control form-control-sm"
                        value="Images are being processed…"
                        data-json-group="capture"
                        data-json-parm="text_processing"
                        data-json-type="string"
                        data-default-value="Images are being processed…">
                    </div>

                    <div class="mb-3">
                      <label for="settingTxtCaptureHoldStill"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_hold_still">
                        Hold still (during capture)
                      </label>

                      <input type="text"
                        id="settingTxtCaptureHoldStill"
                        class="form-control form-control-sm"
                        value="Photo {slot}/{target} – hold still…"
                        data-json-group="capture"
                        data-json-parm="text_hold_still"
                        data-json-type="string"
                        data-default-value="Photo {slot}/{target} – hold still…">

                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.text_hold_still_help">
                        You can use variables: {slot} (current photo number) and {target} (total photos). Example: "Photo {slot}/{target} – hold still…"
                      </div>
                    </div>

                    <!-- Hold still, trigger -->
                     <div class="mb-3">
  <label for="settingTxtCaptureTriggering"
    class="form-label"
    data-lang-key="overlay.settings.capture.text_triggering">
    Trigger text (while camera is taking the photo)
  </label>

  <textarea
    id="settingTxtCaptureTriggering"
    class="form-control form-control-sm"
    rows="2"
    data-json-group="capture"
    data-json-parm="text_triggering"
    data-json-type="string"
    data-default-value="The camera is taking the photo…
please do not move.">The camera is taking the photo…
please do not move.</textarea>

  <div class="form-text text-secondary"
    data-lang-key="overlay.settings.capture.text_triggering_help">
    Text shown after the countdown while the camera is still taking the photo.
  </div>
</div>


<hr/>
                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCapturePrinting"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_printing">
                        Printing
                      </label>

                      <input type="text"
                        id="settingTxtCapturePrinting"
                        class="form-control form-control-sm"
                        value="Picture is printing…"
                        data-json-group="capture"
                        data-json-parm="text_printing"
                        data-json-type="string"
                        data-default-value="Picture is printing…">
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingTxtCaptureDone"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.text_done">
                        Done
                      </label>

                      <input type="text"
                        id="settingTxtCaptureDone"
                        class="form-control form-control-sm"
                        value="Done!"
                        data-json-group="capture"
                        data-json-parm="text_done"
                        data-json-type="string"
                        data-default-value="Done!">
                    </div>

                  </div>
<hr />
                  <!-- Capture: Finish Image Preview -->
                  <div class="row">

                    <div class="col-md-6 mb-3">
                      <div class="form-check form-switch">
                        <input class="form-check-input" type="checkbox"
                          id="settingShowFinishImage"
                          checked
                          data-json-group="capture"
                          data-json-parm="show_finish_image"
                          data-default-value="true">
                        <label class="form-check-label"
                          for="settingShowFinishImage"
                          data-lang-key="overlay.settings.capture.show_finish_image">
                          Show final image after capture flow
                        </label>
                      </div>
                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.show_finish_image_help">
                        Display the final image to the user after the capture flow completes.
                      </div>
                    </div>

                    <div class="col-md-6 mb-3">
                      <label for="settingShowFinishImageSeconds"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.show_finish_image_seconds">
                        Final image display duration (seconds)
                      </label>

                      <input type="number"
                        min="1"
                        max="60"
                        step="1"
                        id="settingShowFinishImageSeconds"
                        class="form-control form-control-sm"
                        value="5"
                        data-json-group="capture"
                        data-json-parm="show_finish_image_seconds"
                        data-json-type="int"
                        data-default-value="5">

                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.show_finish_image_seconds_help">
                        How long the final image should stay visible before returning to the start screen. (0 = disabled)
                      </div>
                      <div class="form-text text-warning"
                        data-lang-key="overlay.settings.capture.show_finish_image_seconds_coin_hint">
                        Ignored while the coin counter is enabled (System section) — the final screen with the print button then stays open until the user closes it or prints, so it cannot disappear before a coin is inserted.
                      </div>
                    </div>
  <hr/>
                    <!-- Faster Capture effekt -->
                      <div class="col-md-6 mb-3">
                      <label for="settingFastCaptureEffect"
                        class="form-label"
                        data-lang-key="overlay.settings.capture.settingFastCaptureEffect">
                        Faster Capture (taking photo) than Countdown (ms)
                      </label>

                      <input type="number"
                        min="1"
                        max="60"
                        step="1"
                        id="settingFastCaptureEffect"
                        class="form-control form-control-sm"
                        value="500"
                        data-json-group="capture"
                        data-json-parm="setting_fast_capture_effect"
                        data-json-type="int"
                        data-default-value="500">

                      <div class="form-text text-secondary"
                        data-lang-key="overlay.settings.capture.settingFastCaptureEffect_help">
                        On some devices, taking a photo takes a long time. Simulate a faster capture process by triggering the capture before the visible countdown has finished. (0 = disabled)
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <!-- Druck -->
            <div class="accordion-item bg-dark text-light border border-secondary">
              <h2 class="accordion-header" id="accPrintHead">
                <button class="accordion-button collapsed bg-dark text-warning"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#accPrintBody"
                  aria-expanded="false"
                  aria-controls="accPrintBody">
                  <span class="text-uppercase" data-lang-key="overlay.settings.print.title">
                    Printing
                  </span>
                </button>
              </h2>

              <div id="accPrintBody"
                class="accordion-collapse collapse"
                aria-labelledby="accPrintHead"
                data-bs-parent="#accordionGeneralSettingsForm1">
                <div class="accordion-body pt-2 bg-dark text-light">

                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox"
                      id="settingAutoPrint" checked
                      data-json-group="print"
                      data-json-parm="print_automatically_when_finish"
                      data-default-value="true">
                    <label class="form-check-label" for="settingAutoPrint" data-lang-key="overlay.settings.print.auto">
                      Print automatically after series
                    </label>
                  </div>

                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox"
                      id="settingPrintSilent" checked
                      data-json-group="print"
                      data-json-parm="silent"
                      data-default-value="true">
                    <label class="form-check-label" for="settingPrintSilent" data-lang-key="overlay.settings.print.silent">
                      Silent print (no dialog window)
                    </label>
                  </div>

                </div>
              </div>
            </div>

            <!-- System -->
            <div class="accordion-item bg-dark text-light border border-secondary">
              <h2 class="accordion-header" id="accSystemHead">
                <button class="accordion-button collapsed bg-dark text-warning"
                  type="button"
                  data-bs-toggle="collapse"
                  data-bs-target="#accSystemBody"
                  aria-expanded="false"
                  aria-controls="accSystemBody">
                  <span class="text-uppercase" data-lang-key="overlay.settings.system.title">
                    System
                  </span>
                </button>
              </h2>

<div id="accSystemBody"
  class="accordion-collapse collapse"
  aria-labelledby="accSystemHead"
  data-bs-parent="#accordionGeneralSettingsForm1">
  <div class="accordion-body pt-2 bg-dark text-light">

    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="settingFullscreen" checked
        data-json-group="system"
        data-json-parm="fullscreen"
        data-default-value="true">
      <label class="form-check-label" for="settingFullscreen" data-lang-key="overlay.settings.system.fullscreen">
        Start in fullscreen / kiosk mode
      </label>
    </div>

    <div class="mb-2">
      <label for="settingUiBrowserWatchdogInterval"
        class="form-label"
        data-lang-key="overlay.settings.system.ui_browser_watchdog_interval">
        UI browser watchdog check interval (minutes)
      </label>

      <input type="number"
        min="1"
        max="60"
        step="1"
        id="settingUiBrowserWatchdogInterval"
        class="form-control form-control-sm"
        value="5"
        data-json-group="system"
        data-json-parm="ui_watchdog_minutes"
        data-json-type="int"
        data-default-value="5">
    </div>
<br/>
    <!-- Autostart enable/disable -->
    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="settingAutostartEnabled"
        data-python-toggle="autostart"
        data-enable-endpoint="/autostart/enable"
        data-disable-endpoint="/autostart/disable"
        data-json-group="system" 
        data-json-parm="autostart"
        >
      <label class="form-check-label" for="settingAutostartEnabled"
        data-lang-key="overlay.settings.system.autostart">
        Autostart aktivieren/deaktivieren
      </label>
    </div>

    <div class="form-text mb-3"
      data-lang-key="overlay.settings.system.autostart_help">
      Startet die Anwendung automatisch nach dem Windows-Start.
    </div>

    <!-- Task Planer / systemd watchdog enable/disable -->
    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="settingTaskPlanerServiceEnabled"
        data-python-toggle="task_planer_service"
        data-enable-endpoint="/task_planer_service/enable"
        data-disable-endpoint="/task_planer_service/disable"
        data-json-group="system" 
        data-json-parm="task_planer_service">
      <label class="form-check-label" for="settingTaskPlanerServiceEnabled"
        data-lang-key="overlay.settings.system.task_planer_service">
        Task-Planer Win / systemd Linux aktivieren/deaktivieren
      </label>
    </div>

    <div class="form-text mb-3"
      data-lang-key="overlay.settings.system.task_planer_service_help">
      Aktiviert die Überwachung des gesamten Programms. Dadurch können alle benötigten Programme kontrolliert und bei Bedarf automatisch neu gestartet werden.
    </div>

    <!-- ToF-Bewegungssensor (Externer PC) enable/disable -->
    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="settingTofEnabled"
        data-python-toggle="tof"
        data-enable-endpoint="/pi_pico/tof/enable"
        data-disable-endpoint="/pi_pico/tof/disable">
      <label class="form-check-label" for="settingTofEnabled"
        data-lang-key="overlay.settings.system.tof">
        Bewegungssender (ToF) aktivieren/deaktivieren
      </label>
    </div>

    <div class="form-text mb-3"
      data-lang-key="overlay.settings.system.tof_help">
      Löst LiveView-Vorwärmung aus, sobald sich eine Person dem Sensor nähert.
    </div>

    <!-- Münzzähler (Externer PC) enable/disable -->
    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="settingCoinEnabled"
        data-python-toggle="coin"
        data-enable-endpoint="/pi_pico/coin/enable"
        data-disable-endpoint="/pi_pico/coin/disable">
      <label class="form-check-label" for="settingCoinEnabled"
        data-lang-key="overlay.settings.system.coin">
        Münzzähler aktivieren/deaktivieren
      </label>
    </div>

    <div class="form-text mb-3"
      data-lang-key="overlay.settings.system.coin_help">
      Verbucht Münzeinwürfe des ST-001-Münzprüfers als Guthaben.
    </div>

    <div class="form-text" data-lang-key="overlay.settings.system.debug_help">
      Enable or disable Debug-Console at the bottom
    </div>

    <div class="form-check form-switch mb-2">
      <input class="form-check-input" type="checkbox"
        id="debugMode" checked
        data-json-group="system"
        data-json-parm="debugMode"
        data-default-value="true">
      <label class="form-check-label" for="debugMode" data-lang-key="overlay.settings.system.debug">
        Enable/Disable Debug-Mode
      </label>
    </div>

    <!-- Admin Password -->
    <div class="mb-2">
      <label class="form-label" for="settingPassword" data-lang-key="overlay.settings.system.password">
        Admin password
      </label>

      <div class="input-group">
        <input class="form-control" type="password"
          id="settingPassword"
          placeholder="••••••••"
          autocomplete="new-password"
          data-json-group="system"
          data-json-parm="password"
          data-default-value="">
        <button class="btn btn-outline-secondary"
          type="button"
          id="btnTogglePassword"
          aria-label="Show/Hide password">👁️</button>
      </div>
    </div>

  </div>
</div>
            </div>

          </div><!-- /accordion -->

          <!-- value/data-default-value absichtlich leer — siehe Kommentar bei
               eventStoragePath in active_event_settings.php (pb_dynamic_defaults.js) -->
          <div>
            <input type="hidden"
              id="settingActiveTemplate"
              class="form-control form-control-sm"
              value=""
              readonly
              data-json-group="activeTemplate"
              data-json-parm="path"
              data-json-type="string"
              data-default-value=""
              data-pb-dynamic-default="boothRoot/activeTemplate/">
          </div>

          <div>
            <input type="hidden"
              id="settingRenderConfig"
              class="form-control form-control-sm"
              value=""
              readonly
              data-json-group="python"
              data-json-parm="renderConfig"
              data-json-type="string"
              data-default-value=""
              data-pb-dynamic-default="boothRoot/config/config/render_config.json">
          </div>

        </form>

        <hr class="border-secondary">

        <div class="accordion" id="accordionThirdParty">
          <div class="accordion-item bg-dark text-warning border border-secondary">

            <h2 class="accordion-header" id="headingThirdPartyAdvanced">
              <button class="accordion-button collapsed bg-dark text-warning"
                type="button"
                data-bs-toggle="collapse"
                data-bs-target="#collapseThirdPartyAdvanced"
                aria-expanded="false"
                aria-controls="collapseThirdPartyAdvanced">
                <i class="bi bi-sliders me-2"></i>
                <span data-lang-key="overlay.settings.app.advanced.title">
                  Advanced setup (Python paths & ports)
                </span>
              </button>
            </h2>

            <div id="collapseThirdPartyAdvanced"
              class="accordion-collapse collapse"
              aria-labelledby="headingThirdPartyAdvanced"
              data-bs-parent="#accordionThirdParty">

              <div class="accordion-body">
                <!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
                <!-- Copyright (c) 2026 Andreas Rottmann -->

                <form id="formThirdSoftwareSettings" class="small" data-json-file="config/config.json">

                  <h6 class="text-uppercase mt-3" data-lang-key="overlay.settings.app.python.title">
                    Python Environment
                  </h6>

                  <div class="mb-3">
                    <label for="settingPythonPath" class="form-label" data-lang-key="overlay.settings.app.python.path">
                      Python Executable Path
                    </label>

                    <div class="input-group input-group-sm">
                      <input
                        type="text"
                        id="settingPythonPath"
                        class="form-control"
                        placeholder="e.g. C:\photo-software\tools\python_portable\python.exe"
                        data-json-group="python"
                        data-json-parm="Path"
                        data-default-value="C:\Users\andre\Desktop\photo-software\booth\tools\python_portable\python.exe"
                      >

                      <button
                        type="button"
                        class="btn pb-pick-file btn-outline-warning"
                        data-target="#settingPythonPath"
                        data-initial="C:\Photobox\booth\tools\python_portable\"
                        data-title="Select python.exe"
                        data-filter="Executable (*.exe)|*.exe|All files (*.*)|*.*"
                      >
                        <span data-lang-key="form.pick_file">Pick file</span>
                      </button>
                    </div>
                  </div>

                  <hr class="border-secondary">

                  <h6 class="text-uppercase mt-3" data-lang-key="overlay.settings.app.pickfile_render_app.title">
                    Render App (create Image)
                  </h6>

                  <h6 class="text-uppercase mt-3" data-lang-key="overlay.settings.app.pickfile_python_server.title">
                    Python Server
                  </h6>

                  <div class="mb-3">
                    <div class="input-group input-group-sm">
                      <input
                        type="text"
                        id="settingFilepickerServerPy"
                        class="form-control"
                        placeholder="e.g. C:\Photobooth\booth\tools\python_portable\python_server.py"
                        data-json-group="app"
                        data-json-parm="python_server"
                        data-default-value="C:\Photobooth\booth\tools\python_portable\python_server.py"
                      >

                      <button
                        type="button"
                        class="btn btn-outline-warning pb-pick-file"
                        data-target="#settingFilepickerServerPy"
                        data-initial="C:\Photobox\booth\tools\python_portable\"
                        data-title="Select python_server.py"
                        data-filter="Python (*.py)|*.py|All files (*.*)|*.*"
                      >
                        <span data-lang-key="form.pick_file">Pick file</span>
                      </button>
                    </div>
                  </div>

                </form>

                <!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
                <!-- Copyright (c) 2026 Andreas Rottmann -->

                <form id="formThirdSoftware_ServerSettings" class="small" data-json-file="../tools/python_portable/server_config.json">

                  <!-- Caddy Webroot -->
                  <div class="mb-3">
                    <label for="settingCaddyWebRoot" class="form-label" data-lang-key="overlay.settings.app.python.caddyWebRoot.path">
                      Caddy webroot path (important for some Python API endpoints, e.g. uploads).
                    </label>

                    <div class="input-group input-group-sm">
                      <input type="text"
                             id="settingCaddyWebRoot"
                             class="form-control"
                             placeholder="e.g. C:\photo-software\booth\"
                             data-json-group=""
                             data-json-parm="caddyWebroot"
                             data-default-value="C:\photo-software\booth\">

                      <button type="button"
                              class="btn btn-outline-warning pb-pick-folder"
                              data-target="#settingCaddyWebRoot"
                              data-title="Select Caddy webroot folder">
                        <span data-lang-key="form.pick_folder">
                          Pick folder
                        </span>
                      </button>
                    </div>
                  </div>

                  <!-- Python Server-Port -->
                  <div class="mb-3">
                    <label for="settingPythonPort" class="form-label" data-lang-key="overlay.settings.app.python.port">
                      Python Port
                    </label>

                    <input type="number"
                           id="settingPythonPort"
                           class="form-control form-control-sm"
                           min="1" max="65535" step="1"
                           value="8053"
                           data-json-parm="Python_ServerPort"
                           data-default-value="8053">
                  </div>

                  <!-- Python API Key -->
                  <div class="mb-3">
                    <label for="pbPythonApiKey" class="form-label" data-lang-key="overlay.settings.app.python.api_key.label">
                      Python API key
                    </label>

                    <div class="input-group input-group-sm">
                      <input type="text"
                             id="pbPythonApiKey"
                             class="form-control bg-dark text-warning border-secondary"
                             placeholder=""
                             data-json-parm="AuthKey"
                             data-default-value="">

                      <button type="button"
                              class="btn btn-outline-warning border-secondary KeyGen"
                              id="pbPythonApiKeyGen"
                              data-lang-key="overlay.settings.app.python.api_key.generate"
                              data-key-for="#pbPythonApiKey">
                        <span data-lang-key="overlay.settings.app.python.api_key.generate">
                          Generate
                        </span>
                      </button>
                    </div>
                  </div>

                </form>

                <!-- Python Tool Server Controls -->
                <div class="mt-3 p-2 border border-secondary rounded" id="pythonServerPanel">
                  <div class="d-flex align-items-center gap-2 flex-wrap">
                    <button type="button" class="btn btn-sm btn-outline-success" id="btnPythonStart">
                      <span data-lang-key="overlay.settings.app.python.server_controls.start">
                        Start
                      </span>
                    </button>

                    <button type="button" class="btn btn-sm btn-outline-warning" id="btnPythonRestart">
                      <span data-lang-key="overlay.settings.app.python.server_controls.restart">
                        Restart
                      </span>
                    </button>

                    <button type="button" class="btn btn-sm btn-outline-danger" id="btnPythonStop">
                      <span data-lang-key="overlay.settings.app.python.server_controls.stop">
                        Stop
                      </span>
                    </button>

                    <button type="button" class="btn btn-sm btn-outline-secondary ms-auto" id="btnPythonRefresh">
                      <span data-lang-key="overlay.settings.app.python.server_controls.refresh">
                        Refresh
                      </span>
                    </button>
                  </div>

                  <div class="progress mt-2" style="height: 18px;">
                    <div class="progress-bar" id="pythonServerBar" role="progressbar" style="width: 0%;">
                      <span data-lang-key="common.unknown">
                        unknown
                      </span>
                    </div>
                  </div>

                  <div class="small mt-2 text-muted"
                       id="pythonServerInfo"
                       data-lang-key="overlay.settings.app.python.server_controls.status_unknown">
                    Status: unknown
                  </div>

                  <div class="small mt-1" id="pythonServerMsg"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /.modal-body -->

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel">Cancel</span>
        </button>

        <button type="button"
          class="btn btn-primary btn-sm pb-save-config"
          id="btnSaveGeneralSettings"
          data-multiple-form="1">
          <span data-lang-key="form.save">Save</span>
        </button>
      </div>

    </div>
  </div>
</div>
﻿<!--
sections/render_settings.php
Modal: Render Settings (render_config.json)
-->
<div
    class="modal fade"
    id="modalRenderSettings"
    tabindex="-1"
    aria-labelledby="modalRenderSettingsLabel"
    aria-hidden="true"
    data-pb-parent-modal="#modalSettings">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalRenderSettingsLabel"
                    data-lang-key="overlay.render_settings.title">
                    Render Settings
                </h5> <!-- Gear Icon mit Tooltip -->
                &nbsp; <i class="bi bi-gear fs-3"
                    data-bs-toggle="tooltip"
                    data-bs-trigger="hover click"
                    data-bs-placement="top"
                    title="config/render_config.json"></i>
                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>

            <div class="modal-body">
                <p
                    class="small text-secondary mb-3"
                    data-lang-key="overlay.render_settings.description">
                    Configure output quality and green screen (greenwall) settings used by the renderer.
                </p>

                <form id="formRenderSettings" class="small" data-json-file="config/render_config.json">
 <!-- =========================
     IMAGE / CROPPING (FIT)
     ========================= -->
                    <h6 class="mt-2 mb-2" data-lang-key="overlay.render_settings.image_fit.section">
                        Image-Cropping
                    </h6>

                    <div class="mb-3">
                        <label
                            for="renderImageFitMode"
                            class="form-label"
                            data-lang-key="overlay.render_settings.image_fit.mode.label">
                            Fit mode
                        </label>

                        <select
                            class="form-select form-select-sm"
                            id="renderImageFitMode"
                            data-json-group="render"
                            data-json-parm="resize_mode"
                            data-default-value="cover">
                            <option value="contain">
                                Contain (all visible, may Border on each Side)
                            </option>
                            <option value="cover">
                                Cover (fill, may cropping)
                            </option>
                            <option value="stretch">
                                Stretch (stretch to placeholder, no cropping, but no aspect-ratio)
                            </option>
                        </select>

                        <!-- optionaler Hinweis -->
                        <div class="form-text" data-lang-key="overlay.render_settings.image_fit.hint">
                            Contain = no cropping, Cover = may crop, Stretch = distorted..
                        </div>
                    </div>

                    <!-- =========================
     PHOTO WORK SCALE
     ========================= -->
<h6 class="mt-2 mb-2" data-lang-key="overlay.render_settings.photo_work_scale.section">
    Photo render scale
</h6>

<div class="mb-3">
    <label
        for="renderPhotoWorkScale"
        class="form-label"
        data-lang-key="overlay.render_settings.photo_work_scale.label">
        Photo work scale
    </label>

    <input
        type="number"
        class="form-control form-control-sm"
        id="renderPhotoWorkScale"
        data-json-group="render"
        data-json-parm="photo_work_scale"
        data-default-value="1.5"
        min="0.1"
        max="10"
        step="0.1" />

    <div class="form-text" data-lang-key="overlay.render_settings.photo_work_scale.hint">
        Scale factor for internal photo processing. Only downsizes, never upscales. Default: 1.5
    </div>
</div>

                    <!-- Background color (used for "contain") -->
                    <div class="mb-3">
                        <label
                            for="renderContainBgColor"
                            class="form-label"
                            data-lang-key="overlay.render_settings.image_fit.contain_bg.label">
                            Contain background color
                        </label>

                        <input
                            type="color"
                            class="form-control form-control-sm form-control-color"
                            id="renderContainBgColor"
                            data-json-group="render"
                            data-json-parm="contain_bg"
                            data-default-value="#000000"
                            value="#000000"
                            title="Pick a background color" />

                        <div class="form-text" data-lang-key="overlay.render_settings.image_fit.contain_bg.hint">
                            Only used when Fit mode is set to "Contain" (for the empty borders around the image).
                        </div>
                    </div>


                    <!-- =========================
                         OUTPUT
                         ========================= -->
                    <h6 class="mt-2 mb-2" data-lang-key="overlay.render_settings.output.section">
                        Output
                    </h6>

                    <!-- Output format -->
                    <div class="mb-3">
                        <label
                            for="renderOutputFormat"
                            class="form-label"
                            data-lang-key="overlay.render_settings.output.format.label">
                            Format
                        </label>

                        <select
                            class="form-select form-select-sm"
                            id="renderOutputFormat"
                            data-json-group="output"
                            data-json-parm="format"
                            data-default-value="jpg">
                            <option value="jpg">JPEG (.jpg)</option>
                            <option value="png">PNG (.png)</option>
                        </select>

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.format.help">
                            Output file format for the final rendered image.
                        </div>
                    </div>

                    <!-- JPEG quality -->
                    <div class="mb-3">
                        <label
                            for="renderJpegQuality"
                            class="form-label"
                            data-lang-key="overlay.render_settings.output.jpeg_quality.label">
                            JPEG quality
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="renderJpegQuality"
                            min="1"
                            max="100"
                            step="1"
                            placeholder="94"
                            value="94"
                            data-json-group="output"
                            data-json-parm="jpeg_quality"
                            data-default-value="94">

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.jpeg_quality.help">
                            1–100. Higher = better quality, larger file. Recommended for print: 92–95.
                        </div>
                    </div>

                    <!-- JPEG subsampling -->
                    <div class="mb-3">
                        <label
                            for="renderJpegSubsampling"
                            class="form-label"
                            data-lang-key="overlay.render_settings.output.jpeg_subsampling.label">
                            JPEG subsampling
                        </label>

                        <select
                            class="form-select form-select-sm"
                            id="renderJpegSubsampling"
                            data-json-group="output"
                            data-json-parm="jpeg_subsampling"
                            data-default-value="0">
                            <option value="0">0 (4:4:4) – Best for logos/text</option>
                            <option value="1">1 (4:2:2) – Balanced</option>
                            <option value="2">2 (4:2:0) – Smaller, softer edges</option>
                        </select>

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.jpeg_subsampling.help">
                            Color subsampling. 0 keeps best color edges; 2 reduces file size but may blur colored edges.
                        </div>
                    </div>

                    <!-- JPEG optimize -->
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="renderJpegOptimize"
                                data-json-group="output"
                                data-json-parm="jpeg_optimize"
                                data-default-value="true">
                            <label
                                class="form-check-label"
                                for="renderJpegOptimize"
                                data-lang-key="overlay.render_settings.output.jpeg_optimize.label">
                                Optimize JPEG
                            </label>
                        </div>

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.jpeg_optimize.help">
                            Better compression (smaller file), slightly slower saving.
                        </div>
                    </div>

                    <!-- JPEG progressive -->
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="renderJpegProgressive"
                                data-json-group="output"
                                data-json-parm="jpeg_progressive"
                                data-default-value="true">
                            <label
                                class="form-check-label"
                                for="renderJpegProgressive"
                                data-lang-key="overlay.render_settings.output.jpeg_progressive.label">
                                Progressive JPEG
                            </label>
                        </div>

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.jpeg_progressive.help">
                            Progressive loading in browsers. Usually not important for printing.
                        </div>
                    </div>

                    <!-- DPI -->
                    <div class="mb-3">
                        <label
                            for="renderOutputDpi"
                            class="form-label"
                            data-lang-key="overlay.render_settings.output.dpi.label">
                            DPI metadata
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="renderOutputDpi"
                            min="72"
                            max="1200"
                            step="1"
                            placeholder="300"
                            value="300"
                            data-json-group="output"
                            data-json-parm="dpi"
                            data-default-value="300">

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.dpi.help">
                            Metadata only (pixels do not change). Useful for print workflows (e.g. 300 DPI).
                        </div>
                    </div>

                    <hr class="border-secondary">

                    <!-- =========================
                         GREENWALL
                         ========================= -->
                    <div id="greenwall_settings">
                        <h6 class="mt-2 mb-2" data-lang-key="overlay.render_settings.greenwall.section">
                            Greenwall (Green Screen)
                        </h6>
<!-- Greenwall reference image path -->
<div class="mb-3">
    <label
        for="greenwallReferenceImagePath"
        class="form-label"
        data-lang-key="overlay.render_settings.greenwall.reference_image_path.label">
        Referenzbild
    </label>

    <div class="input-group input-group-sm">
        <input
            class="form-control"
            type="text"
            id="greenwallReferenceImagePath"
            placeholder="C:/images/reference.jpg"
            data-json-group="greenwall"
            data-json-parm="reference_image_path"
            data-default-value="">

        <button
            class="pb-pick-file btn btn-outline-warning"
            type="button"
            data-filter="Images|*.png;*.jpg;*.jpeg;*.gif|All|*.*"
            data-subdir=""
            data-prefix=""
            data-overwrite="0"
            data-target="#greenwallReferenceImagePath">
            <span data-lang-key="form.pick_file">
                Pick file
            </span>
        </button>
    </div>

    <div
        class="form-text small"
        data-lang-key="overlay.render_settings.greenwall.reference_image_path.help">
        Wähle das Referenzbild aus. Der absolute Pfad wird gespeichert.
    </div>
</div>

<!-- Generate greenwall profile -->
<div class="mb-3">
    <button
        type="button"
        id="btnGenerateGreenwallProfile"
        class="btn btn-sm btn-warning">
        <span data-lang-key="overlay.render_settings.greenwall.generate_profile.button">
            Referenzprofil generieren
        </span>
    </button>

    <div
        id="greenwallProfileGenerateStatus"
        class="form-text small text-muted mt-1"
        data-lang-key="overlay.render_settings.greenwall.generate_profile.status_idle">
        Noch kein Referenzprofil generiert.
    </div>
</div>

<!-- Greenwall reference profile path -->
<div class="mb-3">
    <label
        for="renderGreenwallReferenceProfilePath"
        class="form-label"
        data-lang-key="overlay.render_settings.greenwall.reference_profile_path.label">
        Referenzprofil-Pfad
    </label>

    <input
        type="text"
        class="form-control form-control-sm"
        id="renderGreenwallReferenceProfilePath"
        placeholder="C:/profiles/reference-profile.npy"
        readonly
        data-json-group="greenwall"
        data-json-parm="reference_profile_path"
        data-default-value="" />

    <div
        class="form-text small"
        data-lang-key="overlay.render_settings.greenwall.reference_profile_path.help">
        Hier wird später der Pfad des erzeugten Referenzprofils angezeigt.
    </div>
</div>
                        <!-- Greenwall switch -->
                        <div class="mb-3">
                            <label
                                for="renderGreenwallSwitch"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.switch.label">
                                Greenwall switch
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="renderGreenwallSwitch"
                                data-json-group="greenwall"
                                data-json-parm="switch"
                                data-default-value="auto">
                                <option value="auto">Auto (follow template)</option>
                                <option value="on">On (force enabled)</option>
                                <option value="off">Off (force disabled)</option>
                            </select>

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.switch.help">
                                Auto uses the template flag (e.g. greenwall="1"). On/Off overrides it globally.
                            </div>
                        </div>

                    <!-- Greenwall mode -->
                        <div class="mb-3">
                            <label
                                for="renderGreenwallMode"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.mode.label">
                                Mode
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="renderGreenwallMode"
                                data-json-group="greenwall"
                                data-json-parm="mode"
                                data-default-value="auto">
                                <option value="auto">Auto (diff if reference exists, else chroma)</option>
                                <option value="diff">Diff (reference comparison)</option>
                                <option value="chroma">Chroma (green dominance)</option>
                            </select>

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.mode.help">
                                Select how the mask is created: diff (with reference) or chroma key (green dominance).
                            </div>
                        </div>

                        <!-- diff_threshold -->
                        <div class="mb-3">
                            <label
                                for="renderDiffThreshold"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.diff_threshold.label">
                                Diff threshold
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderDiffThreshold"
                                min="0"
                                max="255"
                                step="1"
                                placeholder="25"
                                value="25"
                                data-json-group="greenwall"
                                data-json-parm="diff_threshold"
                                data-default-value="25">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.diff_threshold.help">
                                Diff sensitivity. Lower = keep more person; higher = stricter background removal.
                            </div>
                        </div>

                        <!-- green_min -->
                        <div class="mb-3">
                            <label
                                for="renderGreenMin"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.green_min.label">
                                Green minimum
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderGreenMin"
                                min="0"
                                max="255"
                                step="1"
                                placeholder="150"
                                value="150"
                                data-json-group="greenwall"
                                data-json-parm="green_min"
                                data-default-value="150">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.green_min.help">
                                Minimum green channel value required before a pixel can be considered “green”.
                            </div>
                        </div>

                        <!-- green_ratio -->
                        <div class="mb-3">
                            <label
                                for="renderGreenRatio"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.green_ratio.label">
                                Green ratio
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderGreenRatio"
                                min="1"
                                max="5"
                                step="0.01"
                                placeholder="1.35"
                                value="1.35"
                                data-json-group="greenwall"
                                data-json-parm="green_ratio"
                                data-default-value="1.35">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.green_ratio.help">
                                How strongly green must dominate red/blue. Higher = stricter (less false keying, but may create holes).
                            </div>
                        </div>

                        <!-- blur_radius -->
                        <div class="mb-3">
                            <label
                                for="renderBlurRadius"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.blur_radius.label">
                                Mask blur radius
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderBlurRadius"
                                min="0"
                                max="20"
                                step="1"
                                placeholder="2"
                                value="2"
                                data-json-group="greenwall"
                                data-json-parm="blur_radius"
                                data-default-value="2">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.blur_radius.help">
                                Smooth the mask for cleaner edges (typical: 1–3).
                            </div>
                        </div>

                        <!-- feather -->
                        <div class="mb-3">
                            <label
                                for="renderFeather"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.feather.label">
                                Feather
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderFeather"
                                min="0"
                                max="50"
                                step="1"
                                placeholder="2"
                                value="2"
                                data-json-group="greenwall"
                                data-json-parm="feather"
                                data-default-value="2">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.feather.help">
                                Additional edge softening (implementation dependent).
                            </div>
                        </div>

                        <!-- spill_suppression -->
                        <div class="mb-3">
                            <label
                                for="renderSpillSuppression"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.spill_suppression.label">
                                Spill suppression
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderSpillSuppression"
                                min="0"
                                max="1"
                                step="0.01"
                                placeholder="0.35"
                                value="0.35"
                                data-json-group="greenwall"
                                data-json-parm="spill_suppression"
                                data-default-value="0.35">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.spill_suppression.help">
                                Reduce green color spill on edges (0–1).
                            </div>
                        </div>

                        <!-- close_iter -->
                        <div class="mb-3">
                            <label
                                for="renderCloseIter"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.close_iter.label">
                                Close iterations
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderCloseIter"
                                min="0"
                                max="10"
                                step="1"
                                placeholder="1"
                                value="1"
                                data-json-group="greenwall"
                                data-json-parm="close_iter"
                                data-default-value="1">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.close_iter.help">
                                Close small holes in the mask (morphological closing). Typical: 0–2.
                            </div>
                        </div>

                        <!-- write_mask_debug -->
                        <div class="mb-3">
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="renderWriteMaskDebug"
                                    data-json-group="greenwall"
                                    data-json-parm="write_mask_debug"
                                    data-default-value="false">
                                <label
                                    class="form-check-label"
                                    for="renderWriteMaskDebug"
                                    data-lang-key="overlay.render_settings.greenwall.write_mask_debug.label">
                                    Write mask debug image
                                </label>
                            </div>

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.write_mask_debug.help">
                                If enabled, the renderer exports the mask image for debugging/tuning.
                            </div>
                        </div>
                    </div>

                </form>
            </div>

            <div class="modal-footer border-secondary">
                <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
                    <span data-lang-key="form.cancel">
                        Cancel
                    </span>
                </button>

                <!-- GENERIC SAVE (schreibt in config/render_config.json) -->
                <button
                    type="button"
                    class="btn btn-primary btn-sm pb-save-config"
                    data-json-file="config/render_config.json">
                    <span data-lang-key="form.save">
                        Save
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>
﻿<!--
SPDX-License-Identifier: Apache-2.0
Copyright (c) 2026 Andreas Rottmann
-->
<div class="modal fade" id="modalPrinterSettings" tabindex="-1" aria-labelledby="modalPrinterSettingsLabel" aria-hidden="true" data-pb-parent-modal="#modalSettings">
  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <h5 class="modal-title" id="modalPrinterSettingsLabel" data-lang-key="overlay.printer_settings.title">
          Printer Settings
        </h5>

        &nbsp;
        <i
          class="bi bi-gear fs-3"
          data-bs-toggle="tooltip"
          data-bs-trigger="hover click"
          data-bs-placement="top"
          title="config/config.json"
        ></i>

        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-3" data-lang-key="overlay.printer_settings.description">
          Select a printer, configure copies, and optionally open the Windows printer preferences.
        </p>

        <div id="printerSettingsAlert" class="alert alert-secondary small d-none mb-3" role="alert"></div>

        <form id="formPrinterSettings" class="small" data-json-file="config/config.json">

          <h6 class="mt-2 mb-2" data-lang-key="overlay.printer_settings.printer.section">
            Printer
          </h6>

          <div class="mb-3">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                id="pbDnpPaperStatus"
                data-json-group="printer"
                data-json-parm="dnpPaperStatusQuery"
                data-default-value="false"
              />

              <label
                class="form-check-label"
                for="pbDnpPaperStatus"
                data-lang-key="overlay.printer_settings.dnp_paper_status.label"
              >
                DNP Drucker vorhanden. Papierstatus abfrage
              </label>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.printer_settings.dnp_paper_status.hint">
              Aktiviert die Papierstatus-Abfrage, wenn ein DNP-Drucker vorhanden ist.
            </div>
          </div>

          <div class="mb-3">
            <label for="pbPrinterSelect" class="form-label" data-lang-key="overlay.printer_settings.printer.label">
              Windows printer
            </label>

            <div class="input-group input-group-sm">
              <select
                id="pbPrinterSelect"
                class="form-select bg-dark text-light border-secondary"
                data-json-group="printer"
                data-json-parm="printerName"
                data-default-value=""
              >
                <option value="" selected>
                  Loading printers…
                </option>
              </select>

              <span
                id="pbPrintersSpinnerWrap"
                class="input-group-text bg-dark border-secondary d-none"
                aria-label="Loading printers…"
                title="Loading printers…"
              >
                <span class="spinner-border spinner-border-sm text-secondary" role="status" aria-hidden="true"></span>
              </span>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.printer_settings.printer.hint">
              The list is provided by the local API (PowerShell).
            </div>
          </div>

          <h6 class="mt-3 mb-2" data-lang-key="overlay.printer_settings.copies.section">
            Copies
          </h6>

          <div class="mb-3">
            <label for="pbPrinterCopies" class="form-label" data-lang-key="overlay.printer_settings.copies.label">
              Number of copies
            </label>

            <input
              type="number"
              inputmode="numeric"
              min="1"
              max="20"
              step="1"
              id="pbPrinterCopies"
              class="form-control form-control-sm bg-dark text-light border-secondary"
              value="1"
              data-json-group="printer"
              data-json-parm="printerCount"
              data-default-value="1"
            />

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.printer_settings.copies.hint">
              This value is saved and used for automatic printing.
            </div>
          </div>

          <h6 class="mt-3 mb-2" data-lang-key="overlay.printer_settings.debug.section">
            Debug
          </h6>

          <div class="mb-3">
            <div class="form-check form-switch">
              <input
                class="form-check-input"
                type="checkbox"
                id="pbPrinterDebugSkipPrint"
                data-json-group="printer"
                data-json-parm="debugSkipPrint"
                data-default-value="false"
              />

              <label
                class="form-check-label"
                for="pbPrinterDebugSkipPrint"
                data-lang-key="overlay.printer_settings.debug.skip_print.label"
              >
                Druckvorgang überspringen (Debug)
              </label>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.printer_settings.debug.skip_print.hint">
              Wenn aktiviert, wird der eigentliche Druck übersprungen. Alle anderen Schritte (Rendern, Zähler, etc.) laufen normal weiter.
            </div>
          </div>

          <h6 class="mt-3 mb-2" data-lang-key="overlay.printer_settings.actions.section">
            Actions
          </h6>

          <div class="d-flex flex-wrap gap-2 mb-3">
            <button type="button" id="btnReloadPrinters" class="btn btn-outline-light btn-sm" data-lang-key="overlay.printer_settings.actions.reload">
              Reload list
            </button>

            <button type="button" id="btnOpenPrinterSettings" class="btn btn-outline-warning btn-sm" data-lang-key="overlay.printer_settings.actions.open_settings">
              Open printer preferences
            </button>

            <button type="button" id="btnSetDefaultPrinter" class="btn btn-outline-info btn-sm" data-lang-key="overlay.printer_settings.actions.set_default">
              Set as default printer
            </button>
          </div>

          <hr class="border-secondary my-3">

          <div class="small text-secondary" data-lang-key="overlay.printer_settings.note">
            Note: Opening the Windows dialog does not print. It is only for configuring the printer.
          </div>

        </form>
      </div>

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel">Cancel</span>
        </button>

        <button type="button" class="btn btn-primary btn-sm pb-save-config" data-json-file="config/print_config.json">
          <span data-lang-key="form.save">Save</span>
        </button>
      </div>

    </div>
  </div>
</div>
﻿<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->

<div class="modal fade" id="modalCameraBridgeSettings" tabindex="-1" aria-labelledby="modalCameraBridgeSettingsLabel" aria-hidden="true" data-pb-parent-modal="#modalSettings">
  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <h5 class="modal-title" id="modalCameraBridgeSettingsLabel" data-lang-key="overlay.camerabridge_settings.title">
          CameraBridge Settings
        </h5>

        <button
          type="button"
          class="btn-close btn-close-white"
          data-bs-dismiss="modal"
          aria-label="Close"
        ></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-3" data-lang-key="overlay.camerabridge_settings.description">
          Configure API server and worker settings for the CameraBridge service.
        </p>

        <!-- API Server Config -->
        <!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
        <!-- Copyright (c) 2026 Andreas Rottmann -->

        <form id="formCameraBridgeApiServerSettings" class="small"
              data-json-file="../tools/camerabridge/APIServer/ApiServer_settings.json">

          <h5 class="mt-2 mb-3 text-center text-warning" data-lang-key="overlay.camerabridge_settings.apiserver.section">
            API Server
          </h5>
          &nbsp;
          <i class="bi bi-gear fs-3"
             data-bs-toggle="tooltip"
             data-bs-trigger="hover click"
             data-bs-placement="top"
             title="../tools/camerabridge/APIServer/ApiServer_settings.json"></i>

          <div class="accordion" id="accordionApiServerSettings">

            <div class="accordion-item bg-dark border border-secondary">
              <h2 class="accordion-header" id="headingApiExe">
                <button class="accordion-button collapsed bg-dark text-warning"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseApiExe"
                        aria-expanded="false"
                        aria-controls="collapseApiExe">
                  <i class="bi bi-file-earmark-binary me-2"></i>
                  <span data-lang-key="overlay.camerabridge_settings.apiserver.exepath.label">
                    API Server EXE path
                  </span>
                </button>
              </h2>

              <div id="collapseApiExe" class="accordion-collapse collapse"
                   aria-labelledby="headingApiExe"
                   data-bs-parent="#accordionApiServerSettings">
                <div class="accordion-body bg-dark text-warning">

                  <div class="mb-3">
                    <label for="settingCameraAPIServerPath" class="form-label" data-lang-key="overlay.settings.app.pickfile_bridge_app.path">
                      Path to camera control (Photobox.Bridge.ApiServer.exe)
                    </label>

                    <div class="input-group input-group-sm">
                      <input type="text"
                             id="settingCameraAPIServerPath"
                             class="form-control"
                             placeholder="e.g. C:\Photobox\tools\camerabridge\APIServer\Photobox.Bridge.ApiServer.exe"
                             data-json-group="Server"
                             data-json-parm="ExePath"
                             data-default-value="C:\Photobox\tools\camerabridge\APIServer\Photobox.Bridge.ApiServer.exe ">

                      <button type="button"
                              class="btn btn-outline-warning pb-pick-file"
                              data-target="#settingCameraAPIServerPath"
                              data-initial="tools/camerabridge/"
                              data-title="Select Photobox.Bridge.ApiServer.exe"
                              data-filter="Executable (*.exe)|*.exe|All files (*.*)|*.*">
                        <span data-lang-key="form.pick_file">Pick file</span>
                      </button>
                    </div>
                  </div>

                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="headlessCameraBridge_server" checked
                           data-json-group="Server"
                           data-json-parm="camerabridge_server_headless"
                           data-default-value="true">
                    <label class="form-check-label" for="headlessCameraBridge_server" data-lang-key="overlay.settings.camera_server.headless">
                      Start CameraBridge-API-SERVER Headless
                    </label>
                  </div>

                  <div class="form-check form-switch mb-3">
                    <input class="form-check-input" type="checkbox" id="one_instanceCameraBridge_server" checked
                           data-json-group="Server"
                           data-json-parm="camerabridge_server_one_instance"
                           data-default-value="true">
                    <label class="form-check-label" for="one_instanceCameraBridge_server" data-lang-key="overlay.settings.camera_server.oneinstance">
                      Enable only one CameraBridge-API-SERVER at the same time (*recommend)
                    </label>
                  </div>

                  <div class="alert alert-warning">
                    Normally, only set the EXE path here. The app will add/update CLI parameters automatically based on your settings. Add manual parameters only if you know what you are doing.
                  </div>

                  <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.apiserver.exepath.hint">
                    Absolute path to the API server executable (required).
                  </div>

                </div>
              </div>
            </div>

            <div class="accordion-item bg-dark border border-secondary">
              <h2 class="accordion-header" id="headingBridge">
                <button class="accordion-button collapsed bg-dark text-warning"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseBridge"
                        aria-expanded="false"
                        aria-controls="collapseBridge">
                  <i class="bi bi-diagram-3 me-2"></i>
                  <span data-lang-key="overlay.camerabridge_settings.bridge.section">
                    API-SERVER Config
                  </span>
                </button>
              </h2>

              <div id="collapseBridge" class="accordion-collapse collapse"
                   aria-labelledby="headingBridge"
                   data-bs-parent="#accordionApiServerSettings">
                <div class="accordion-body bg-dark text-warning">

                  <div class="mb-3">
                    <label for="pbBridgeBindAddress" class="form-label" data-lang-key="overlay.camerabridge_settings.bind_address.label">
                      Bind address
                    </label>

                    <input type="text"
                           id="pbBridgeBindAddress"
                           class="form-control"
                           placeholder="127.0.0.1"
                           data-json-parm="Bridge.BindAddress"
                           data-default-value="127.0.0.1" />

                    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.bind_address.hint">
                      IP to listen on. Use 127.0.0.1 for local-only access, or 0.0.0.0 / + for LAN access (firewall required).
                    </div>

                    <div class="alert alert-warning small mt-2 bg-dark text-warning border border-warning" role="alert">
                      <strong data-lang-key="overlay.camerabridge_settings.bind_address.alert.title">
                        Bind address hint
                      </strong>

                      <div class="mt-1" data-lang-key="overlay.camerabridge_settings.bind_address.alert.text">
                        Defines on which network interface the HTTP server listens:
                      </div>

                      <ul class="mb-0">
                        <li data-lang-key="overlay.camerabridge_settings.bind_address.alert.local">
                          127.0.0.1 = local only (no LAN/WiFi access).
                        </li>
                        <li data-lang-key="overlay.camerabridge_settings.bind_address.alert.all">
                          + / 0.0.0.0 = all interfaces (LAN/WiFi/Hotspot), e.g. for tablet/phone.
                        </li>
                      </ul>

                      <hr class="my-2">

                      <small data-lang-key="overlay.camerabridge_settings.bind_address.alert.firewall">
                        Important: For LAN binding, Windows Firewall must allow the port (e.g. 8052).
                      </small>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label for="pbBridgeHttpPort" class="form-label" data-lang-key="overlay.camerabridge_settings.http_port.label">
                      HTTP port
                    </label>

                    <input type="number"
                           inputmode="numeric"
                           min="1"
                           max="65535"
                           step="1"
                           id="pbBridgeHttpPort"
                           class="form-control"
                           value="8052"
                           data-json-parm="Bridge.Port"
                           data-default-value="8052" />

                    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.http_port.hint">
                      Local API port for the API server (default: 8052).
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div class="accordion-item bg-dark border border-secondary">
              <h2 class="accordion-header" id="headingMjpeg">
                <button class="accordion-button collapsed bg-dark text-warning"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseMjpeg"
                        aria-expanded="false"
                        aria-controls="collapseMjpeg">
                  <i class="bi bi-broadcast me-2"></i>
                  <span data-lang-key="overlay.camerabridge_settings.mjpeg.section">
                    MJPEG endpoint
                  </span>
                </button>
              </h2>

              <div id="collapseMjpeg" class="accordion-collapse collapse"
                   aria-labelledby="headingMjpeg"
                   data-bs-parent="#accordionApiServerSettings">
                <div class="accordion-body bg-dark text-warning">

                  <div class="mb-3">
                    <label for="pbBridgeMjpegPath" class="form-label" data-lang-key="overlay.camerabridge_settings.mjpeg_path.label">
                      MJPEG path
                    </label>

                    <input type="text"
                           id="pbBridgeMjpegPath"
                           class="form-control"
                           placeholder="/live.mjpg"
                           data-json-parm="Bridge.MjpegPath"
                           data-default-value="/live.mjpg" />

                    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.mjpeg_path.hint">
                      HTTP path for the MJPEG stream used by the preview element.
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div class="accordion-item bg-dark border border-secondary">
              <h2 class="accordion-header" id="headingApiKey">
                <button class="accordion-button collapsed bg-dark text-warning"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseApiKey"
                        aria-expanded="false"
                        aria-controls="collapseApiKey">
                  <i class="bi bi-key me-2"></i>
                  <span data-lang-key="overlay.camerabridge_settings.api.section">
                    API key
                  </span>
                </button>
              </h2>

              <div id="collapseApiKey" class="accordion-collapse collapse"
                   aria-labelledby="headingApiKey"
                   data-bs-parent="#accordionApiServerSettings">
                <div class="accordion-body bg-dark text-warning">

                  <div class="mb-3">
                    <label for="pbBridgeApiKey" class="form-label" data-lang-key="overlay.camerabridge_settings.api_key.label">
                      API key
                    </label>

                    <div class="input-group input-group-sm">
                      <input type="text"
                             id="pbBridgeApiKey"
                             class="form-control bg-dark text-warning border-secondary"
                             placeholder=""
                             data-json-parm="Bridge.AuthKey"
                             data-default-value="" />

                      <button type="button"
                              class="btn btn-outline-warning border-secondary KeyGen"
                              id="pbBridgeApiKeyGen"
                              data-lang-key="overlay.camerabridge_settings.api_key.generate"
                              data-key-for="#pbBridgeApiKey">
                        Generate
                      </button>
                    </div>

                    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.api_key.hint">
                      Required for /api/* endpoints (sent as X-Api-Key). MJPEG stream remains unprotected. Leave empty to disable authentication.
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div class="accordion-item bg-dark border border-secondary">
              <h2 class="accordion-header" id="headingHealth">
                <button class="accordion-button collapsed bg-dark text-warning"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseHealth"
                        aria-expanded="false"
                        aria-controls="collapseHealth">
                  <i class="bi bi-heart-pulse me-2"></i>
                  <span data-lang-key="overlay.camerabridge_settings.health.section">
                    Health
                  </span>
                </button>
              </h2>

              <div id="collapseHealth" class="accordion-collapse collapse"
                   aria-labelledby="headingHealth"
                   data-bs-parent="#accordionApiServerSettings">
                <div class="accordion-body bg-dark text-warning">

                  <div class="row g-2">
                    <div class="col-md-6">
                      <label for="pbBridgeHealthIntervalMs" class="form-label" data-lang-key="overlay.camerabridge_settings.health.interval.label">
                        Interval (ms)
                      </label>
                      <input type="number"
                             inputmode="numeric"
                             min="200"
                             max="60000"
                             step="100"
                             id="pbBridgeHealthIntervalMs"
                             class="form-control"
                             value="2000"
                             data-json-parm="Health.IntervalMs"
                             data-default-value="2000" />
                      <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.health.interval.hint">
                        How often the watchdog/health check runs.
                      </div>
                    </div>

                    <div class="col-md-6">
                      <label for="pbBridgeHealthTimeoutMs" class="form-label" data-lang-key="overlay.camerabridge_settings.health.timeout.label">
                        Timeout (ms)
                      </label>
                      <input type="number"
                             inputmode="numeric"
                             min="100"
                             max="60000"
                             step="50"
                             id="pbBridgeHealthTimeoutMs"
                             class="form-control"
                             value="800"
                             data-json-parm="Health.TimeoutMs"
                             data-default-value="800" />
                      <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.health.timeout.hint">
                        How long to wait before a health check is considered failed.
                      </div>
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div class="accordion-item bg-dark border border-secondary">
              <h2 class="accordion-header" id="headingLogging">
                <button class="accordion-button collapsed bg-dark text-warning"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseLogging"
                        aria-expanded="false"
                        aria-controls="collapseLogging">
                  <i class="bi bi-journal-text me-2"></i>
                  <span data-lang-key="overlay.camerabridge_settings.logging.section">
                    Logging
                  </span>
                </button>
              </h2>

              <div id="collapseLogging" class="accordion-collapse collapse"
                   aria-labelledby="headingLogging"
                   data-bs-parent="#accordionApiServerSettings">
                <div class="accordion-body bg-dark text-warning">

                  <div class="mb-3">
                    <label for="pbBridgeLogFile" class="form-label" data-lang-key="overlay.camerabridge_settings.logging.logfile.label">
                      Log file
                    </label>

                    <div class="input-group input-group-sm">
                      <input type="text"
                             id="pbBridgeLogFile"
                             class="form-control"
                             placeholder="ApiServer_log.txt"
                             data-json-parm="Logging.LogFile"
                             data-default-value="ApiServer_log.txt" />

                      <button type="button"
                              class="btn btn-outline-warning pb-pick-file"
                              data-target="#pbBridgeLogFile"
                              data-initial="C:/Photobox/tools/camerabridge/APIServer/"
                              data-title="Select log file"
                              data-filter="Text (*.txt)|*.txt|All files (*.*)|*.*">
                        <span data-lang-key="form.pick_file">Pick file</span>
                      </button>
                    </div>

                    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.logging.logfile.hint">
                      Relative or absolute path to the API server log file.
                    </div>
                  </div>

                </div>
              </div>
            </div>

            <div class="accordion-item bg-dark border border-secondary">
              <h2 class="accordion-header" id="headingWorker">
                <button class="accordion-button collapsed bg-dark text-warning"
                        type="button"
                        data-bs-toggle="collapse"
                        data-bs-target="#collapseWorker"
                        aria-expanded="false"
                        aria-controls="collapseWorker">
                  <i class="bi bi-cpu me-2"></i>
                  <span data-lang-key="overlay.camerabridge_settings.worker.section">
                    Worker process
                  </span>
                </button>
              </h2>

              <div id="collapseWorker" class="accordion-collapse collapse"
                   aria-labelledby="headingWorker"
                   data-bs-parent="#accordionApiServerSettings">
                <div class="accordion-body bg-dark text-warning">

                  <div class="mb-3">
                    <label for="pbBridgeWorkerExePath" class="form-label" data-lang-key="overlay.camerabridge_settings.worker.exepath.label">
                      Worker EXE path
                    </label>

                    <div class="input-group input-group-sm">
                      <input type="text"
                             id="pbBridgeWorkerExePath"
                             class="form-control"
                             placeholder="C:/Photobox/tools/camerabridge/Worker/CameraWorker.exe"
                             data-json-parm="Worker.ExePath"
                             data-default-value="C:/Photobox/tools/camerabridge/Worker/CameraWorker.exe" />

                      <button type="button"
                              class="btn btn-outline-warning pb-pick-file"
                              data-target="#pbBridgeWorkerExePath"
                              data-initial="C:/Photobox/tools/camerabridge/Worker/"
                              data-title="Select CameraWorker.exe"
                              data-filter="Executable (*.exe)|*.exe|All files (*.*)|*.*">
                        <span data-lang-key="form.pick_file">Pick file</span>
                      </button>
                    </div>

                    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.worker.exepath.hint">
                      Absolute path to CameraWorker.exe (required).
                    </div>
                  </div>

                  <div class="mb-3">
                    <label for="pbBridgeWorkerArgs" class="form-label" data-lang-key="overlay.camerabridge_settings.worker.args.label">
                      Worker arguments
                    </label>

                    <input type="text"
                           id="pbBridgeWorkerArgs"
                           class="form-control"
                           placeholder=""
                           data-json-parm="Worker.Args"
                           data-default-value="" />

                    <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.worker.args.hint">
                      Optional command line args passed to the worker.
                    </div>

                    <div class="alert alert-warning mt-3 mb-0 py-2 px-3 small bg-dark text-warning border border-warning">
                      <div class="d-flex align-items-start justify-content-between gap-3">
                        <div class="flex-grow-1">
                          <div class="fw-semibold" data-lang-key="overlay.camerabridge_settings.worker.args.warn.title">
                            ⚠ Be careful with worker args
                          </div>

                          <div class="mt-1" data-lang-key="overlay.camerabridge_settings.worker.args.warn.text">
                            Wrong arguments can prevent the CameraBridge worker from starting. Unknown args are ignored.
                          </div>

                          <a class="d-inline-block mt-2 link-warning"
                             data-bs-toggle="collapse"
                             href="#pbBridgeWorkerArgsHelp"
                             role="button"
                             aria-expanded="false"
                             aria-controls="pbBridgeWorkerArgsHelp"
                             data-lang-key="overlay.camerabridge_settings.worker.args.warn.toggle">
                            Show supported arguments
                          </a>

                          <div class="collapse mt-2" id="pbBridgeWorkerArgsHelp">
                            <div class="border border-warning rounded p-2">
                              <div class="fw-semibold mb-1" data-lang-key="overlay.camerabridge_settings.worker.args.supported.title">
                                Supported CLI flags
                              </div>

                              <ul class="mb-2 ps-3">
                                <li><code>--headless</code> / <code>--no-ui</code></li>
                                <li><code>--auto-http</code> / <code>--http</code></li>
                                <li><code>--no-auto-http</code> / <code>--no-http</code></li>
                                <li><code>--auto-refresh</code> / <code>--refresh</code></li>
                                <li><code>--no-auto-refresh</code> / <code>--no-refresh</code></li>
                                <li><code>--auto-select</code> / <code>--select</code></li>
                                <li><code>--no-auto-select</code> / <code>--no-select</code></li>
                                <li><code>--select=&lt;id&gt;</code> or <code>--camera=&lt;id&gt;</code></li>
                                <li><code>--auto-liveview</code> / <code>--liveview</code></li>
                                <li><code>--no-auto-liveview</code> / <code>--no-liveview</code></li>
                                <li><code>--fps=&lt;number&gt;</code></li>
                                <li><code>--tray</code> / <code>--no-tray</code></li>
                                <li><code>--one-instance</code> / <code>--single-instance</code> (also accepts <code>--one_instanz</code>)</li>
                              </ul>

                              <div class="fw-semibold mb-1" data-lang-key="overlay.camerabridge_settings.worker.args.examples.title">
                                Examples
                              </div>
                              <div class="text-break">
                                <code>--headless --http --liveview --fps=15</code><br />
                                <code>--select=0 --tray --one-instance</code>
                              </div>
                            </div>
                          </div>
                        </div>

                        <button type="button"
                                class="btn btn-sm btn-outline-warning"
                                data-bs-toggle="collapse"
                                data-bs-target="#pbBridgeWorkerArgsHelp"
                                aria-expanded="false"
                                aria-controls="pbBridgeWorkerArgsHelp"
                                title="Toggle help">
                          ?
                        </button>
                      </div>
                    </div>
                  </div>

                  <div class="mb-3">
                    <label for="pbBridgeWorkerLogFile"
                           class="form-label"
                           data-lang-key="overlay.camerabridge_settings.worker.logging.logfile.label">
                      Worker log file
                    </label>

                    <div class="input-group input-group-sm">
                      <input type="text"
                             id="pbBridgeWorkerLogFile"
                             class="form-control"
                             placeholder="Worker_log.txt"
                             data-json-parm="Worker.LogFile"
                             data-default-value="" />

                      <button type="button"
                              class="btn btn-outline-warning pb-pick-file"
                              data-target="#pbBridgeWorkerLogFile"
                              data-initial="C:/Photobox/tools/camerabridge/Worker/"
                              data-title="Select worker log file"
                              data-filter="Log (*.log)|*.log|Text (*.txt)|*.txt|All files (*.*)|*.*">
                        <span data-lang-key="form.pick_file">Pick file</span>
                      </button>
                    </div>

                    <div class="form-text text-secondary mt-2"
                         data-lang-key="overlay.camerabridge_settings.worker.logging.logfile.hint">
                      Optional. If set, the UI will append <code>--log=&lt;path&gt;</code> to the worker arguments when saving.
                    </div>
                  </div>

                  <div class="row g-2">
                    <div class="col-md-6">
                      <div class="form-check mt-2">
                        <input class="form-check-input" type="checkbox" id="pbBridgeWorkerAutoStartOnBoot"
                               data-json-parm="Worker.AutoStartOnBoot" data-default-value="true" />
                        <label class="form-check-label" for="pbBridgeWorkerAutoStartOnBoot"
                               data-lang-key="overlay.camerabridge_settings.worker.autostart_boot.label">
                          Auto start on boot
                        </label>
                      </div>
                    </div>

                    <div class="col-md-6">
                      <div class="form-check mt-2">
                        <input class="form-check-input" type="checkbox" id="pbBridgeWorkerAutoStartWhenUnreachable"
                               data-json-parm="Worker.AutoStartWhenUnreachable" data-default-value="true" />
                        <label class="form-check-label" for="pbBridgeWorkerAutoStartWhenUnreachable"
                               data-lang-key="overlay.camerabridge_settings.worker.autostart_unreachable.label">
                          Auto start when unreachable
                        </label>
                      </div>
                    </div>
                  </div>

                  <div class="row g-2 mt-2">
                    <div class="col-md-6">
                      <label for="pbBridgeWorkerStartCooldownMs" class="form-label"
                             data-lang-key="overlay.camerabridge_settings.worker.cooldown.label">
                        Start cooldown (ms)
                      </label>
                      <input type="number" inputmode="numeric" min="0" max="600000" step="500"
                             id="pbBridgeWorkerStartCooldownMs"
                             class="form-control"
                             value="8000"
                             data-json-parm="Worker.StartCooldownMs"
                             data-default-value="8000" />
                    </div>

                    <div class="col-md-6">
                      <label for="pbBridgeWorkerFailThreshold" class="form-label"
                             data-lang-key="overlay.camerabridge_settings.worker.failthreshold.label">
                        Fail threshold
                      </label>
                      <input type="number" inputmode="numeric" min="1" max="50" step="1"
                             id="pbBridgeWorkerFailThreshold"
                             class="form-control"
                             value="3"
                             data-json-parm="Worker.FailThreshold"
                             data-default-value="3" />
                    </div>
                  </div>

                  <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.worker.note">
                    These options control how the API server supervises and restarts the worker process.
                  </div>

                </div>
              </div>
            </div>

          </div>

          <hr class="border-secondary my-3">
        </form>

        <hr class="border-secondary my-3">

        <!-- Worker App Settings -->
        <!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
        <!-- Copyright (c) 2026 Andreas Rottmann -->

        <form id="formCameraBridgeWorkerAppSettings" class="small"
              data-json-file="../tools/camerabridge/Worker/appsettings.json">

          <h5 class="mt-2 mb-2 text-center" data-lang-key="overlay.camerabridge_settings.capture.section">
            Capture settings
          </h5>
          &nbsp;

          <!-- Settings file path tooltip -->
          <i class="bi bi-gear fs-3"
             data-bs-toggle="tooltip"
             data-bs-placement="top"
             data-bs-trigger="hover click"
             title="../tools/camerabridge/Worker/appsettings.json"></i>

          <h6 class="mt-3 mb-2" data-lang-key="overlay.camerabridge_settings.liveview.section">
            Live View
          </h6>

          <div class="mb-3">
            <label for="pbBridgeLiveViewFps" class="form-label" data-lang-key="overlay.camerabridge_settings.liveview_fps.label">
              Live view FPS
            </label>

            <input
              type="number"
              inputmode="numeric"
              min="1"
              max="60"
              step="1"
              id="pbBridgeLiveViewFps"
              class="form-control form-control-sm bg-dark text-light border-secondary"
              value="20"
              data-json-parm="liveViewFps"
              data-default-value="20"
            />

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.liveview_fps.hint">
              Frames per second for MJPEG live view. Lower values reduce CPU/USB load.
            </div>
          </div>

          <div class="mb-3">
            <label for="pbBridgeKeepAliveSeconds" class="form-label" data-lang-key="overlay.camerabridge_settings.keepalive_seconds.label">
              Keep-alive seconds
            </label>

            <input
              type="number"
              inputmode="numeric"
              min="5"
              max="600"
              step="1"
              id="pbBridgeKeepAliveSeconds"
              class="form-control form-control-sm bg-dark text-light border-secondary"
              value="60"
              data-json-parm="keepAliveSeconds"
              data-default-value="60"
            />

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.keepalive_seconds.hint">
              How long the worker stays active without requests before releasing resources.
            </div>
          </div>

          <h6 class="mt-3 mb-2" data-lang-key="overlay.camerabridge_settings.devices.section">
            Device scan
          </h6>

          <div class="mb-3">
            <div class="form-check">
              <input
                class="form-check-input"
                type="checkbox"
                id="pbBridgeLoadWiaDevices"
                data-json-parm="loadWiaDevices"
                data-default-value="false"
              />
              <label class="form-check-label" for="pbBridgeLoadWiaDevices" data-lang-key="overlay.camerabridge_settings.load_wia_devices.label">
                Load WIA devices (Windows Imaging)
              </label>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.load_wia_devices.hint">
              Enable only if you need WIA device discovery. Leaving it off can speed up startup and reduce conflicts.
            </div>
          </div>

          <h6 class="mt-3 mb-2" data-lang-key="overlay.camerabridge_settings.storage.section">
            Storage
          </h6>

          <div class="mb-3">
            <label for="pbBridgeDefaultCaptureFolder" class="form-label" data-lang-key="overlay.camerabridge_settings.capture_folder.label">
              Default capture folder
            </label>

            <div class="input-group input-group-sm">
              <input
                type="text"
                id="pbBridgeDefaultCaptureFolder"
                class="form-control form-control-sm bg-dark text-light border-secondary"
                placeholder="C:/Photobox/captures"
                data-json-parm="defaultCaptureFolder"
                data-default-value="C:/Photobox/captures"
              />

              <button type="button"
                      class="btn btn-outline-warning pb-pick-folder"
                      data-target="#pbBridgeDefaultCaptureFolder"
                      data-title="Select capture folder">
                <span data-lang-key="form.pick_folder">
                  Pick folder
                </span>
              </button>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.capture_folder.hint">
              Folder where captured originals are stored by default (must be writable).
            </div>
          </div>

          <hr class="border-secondary my-3">
          <div class="small text-secondary" data-lang-key="overlay.camerabridge_settings.note">
            Note: Some changes may require restarting the CameraBridge service to take effect.
          </div>
        </form>
      </div>

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel">Cancel</span>
        </button>

        <button type="button" class="btn btn-primary btn-sm pb-save-config" data-multiple-form="1">
          <span data-lang-key="form.save">Save</span>
        </button>
      </div>

    </div>
  </div>
</div>
<!--
SPDX-License-Identifier: Apache-2.0
Copyright (c) 2026 Andreas Rottmann
-->
<div class="modal fade" id="modalExternalPcSettings" tabindex="-1" aria-labelledby="modalExternalPcSettingsLabel" aria-hidden="true" data-pb-parent-modal="#modalSettings">
  <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <h5 class="modal-title" id="modalExternalPcSettingsLabel" data-lang-key="overlay.externalPc.title">
          External PC Settings
        </h5>

        &nbsp;
        <i
          class="bi bi-gear fs-3"
          data-bs-toggle="tooltip"
          data-bs-trigger="hover click"
          data-bs-placement="top"
          title="tools/python_portable/server_config.json"
        ></i>

        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-3" data-lang-key="overlay.externalPc.description">
          Identify the Pi Pico (ToF presence sensor / coin acceptor) serial interface.
        </p>

        <div id="externalPcSettingsAlert" class="alert alert-secondary small d-none mb-3" role="alert"></div>

        <form id="formExternalPcSettings" class="small" data-json-file="../tools/python_portable/server_config.json">

          <!-- Serial port (auto via "Search"/list_identify, or manual entry via toggle) -->
          <div class="mb-3">
            <label for="externalPcPort" class="form-label" data-lang-key="overlay.externalPc.port.label">
              Serial port
            </label>

            <div class="input-group input-group-sm">
              <input type="text"
                     id="externalPcPort"
                     class="form-control"
                     readonly
                     placeholder="e.g. COM5 / /dev/ttyACM0"
                     data-json-group="external_pc"
                     data-json-parm="serial_port"
                     data-default-value="">

              <button type="button"
                      class="btn btn-outline-secondary"
                      id="btnExternalPcPortManual"
                      data-lang-key="overlay.externalPc.manual_btn"
                      title="Toggle manual entry"
                      aria-pressed="false">
                <i class="bi bi-pencil"></i>
              </button>

              <button type="button"
                      class="btn btn-outline-warning"
                      id="btnExternalPcIdentify"
                      data-lang-key="overlay.externalPc.identify_btn">
                Search
              </button>
            </div>

            <div class="form-text" data-lang-key="overlay.externalPc.port.help">
              Scans all serial ports for the Pi Pico and stores the found interface. Use the pencil icon to enter the port manually instead.
            </div>
          </div>

          <!-- Baudrate (editable, default 115200) -->
          <div class="mb-3">
            <label for="externalPcBaudrate" class="form-label" data-lang-key="overlay.externalPc.baudrate.label">
              Baudrate
            </label>

            <input type="number"
                   id="externalPcBaudrate"
                   class="form-control form-control-sm"
                   min="1"
                   step="1"
                   value="115200"
                   data-json-group="external_pc"
                   data-json-parm="baudrate"
                   data-json-type="int"
                   data-default-value="115200">
          </div>

          <!-- ToF distance threshold (mm), server-side edge detection -->
          <div class="mb-3">
            <label for="externalPcDistanceThreshold" class="form-label" data-lang-key="overlay.externalPc.distanceThreshold.label">
              ToF distance threshold (mm)
            </label>

            <input type="number"
                   id="externalPcDistanceThreshold"
                   class="form-control form-control-sm"
                   min="0"
                   step="10"
                   value="800"
                   data-json-group="external_pc"
                   data-json-parm="distance_threshold_mm"
                   data-json-type="int"
                   data-default-value="800">

            <div class="form-text" data-lang-key="overlay.externalPc.distanceThreshold.help">
              A person closer than this distance (in mm) triggers the liveview warmup. Requires Pico firmware sending DISTANCE:&lt;mm&gt; lines.
            </div>
          </div>

          <!-- ToF distance cooldown (seconds), separate/higher than the plain PRESENCE cooldown -->
          <div class="mb-3">
            <label for="externalPcDistanceCooldown" class="form-label" data-lang-key="overlay.externalPc.distanceCooldown.label">
              ToF trigger cooldown (seconds)
            </label>

            <input type="number"
                   id="externalPcDistanceCooldown"
                   class="form-control form-control-sm"
                   min="0"
                   step="10"
                   value="180"
                   data-json-group="external_pc"
                   data-json-parm="distance_cooldown_sec"
                   data-json-type="int"
                   data-default-value="180">

            <div class="form-text" data-lang-key="overlay.externalPc.distanceCooldown.help">
              Minimum time between two liveview triggers from the distance sensor. Higher than the plain presence cooldown, since distance is reported continuously.
            </div>
          </div>

          <!-- Eigenständiger ToF-Laufzeit-Timer, übersteuert camera.camera_settings.liveview_max_runtime_minutes wenn ToF aktiv -->
          <div class="mb-3">
            <label for="externalPcTofMaxRuntimeMinutes" class="form-label" data-lang-key="overlay.externalPc.tofMaxRuntime.label">
              ToF liveview max runtime (minutes)
            </label>

            <div class="input-group input-group-sm">
              <input type="number"
                     id="externalPcTofMaxRuntimeMinutes"
                     class="form-control form-control-sm"
                     min="0"
                     step="1"
                     value="0"
                     placeholder="0 = off"
                     data-json-group="external_pc"
                     data-json-parm="tof_max_runtime_minutes"
                     data-json-type="int"
                     data-default-value="0">
            </div>

            <div class="form-text" data-lang-key="overlay.externalPc.tofMaxRuntime.help">
              Overrides camera max runtime while ToF is enabled — regardless of "always active liveview". 0 = use the camera setting instead.
            </div>
          </div>

          <!-- Print cost, only relevant while coin_enabled -->
          <div class="mb-3">
            <label for="externalPcPrintCostEuro" class="form-label" data-lang-key="overlay.externalPc.printCost.label">
              Print cost (EUR)
            </label>

            <div class="input-group input-group-sm">
              <span class="input-group-text">€</span>
              <input type="number"
                     id="externalPcPrintCostEuro"
                     class="form-control form-control-sm"
                     min="0"
                     step="0.10"
                     value="1.50"
                     data-json-group="external_pc"
                     data-json-parm="print_cost_euro"
                     data-json-type="float"
                     data-default-value="1.50">
            </div>

            <div class="form-text" data-lang-key="overlay.externalPc.printCost.help">
              Amount deducted from the coin balance per print. Only relevant while the coin counter is enabled — supports decimals (e.g. 0.10, 0.20, 0.50).
            </div>
          </div>

        </form>
      </div>

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel">Cancel</span>
        </button>

        <button type="button" class="btn btn-primary btn-sm pb-save-config">
          <span data-lang-key="form.save">Save</span>
        </button>
      </div>

    </div>
  </div>
</div>
﻿<!--
sections/template_editor.php
Modal: Template Editor (90vw)
-->
<div
    class="modal fade"
    id="modalTemplateEditor"
    tabindex="-1"
    aria-labelledby="modalTemplateEditorLabel"
    aria-hidden="true"
>
    <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable modal-template-editor">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalTemplateEditorLabel"
                    data-lang-key="overlay.template_editor.title"
                >
                    Template Editor
                </h5>
                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                ></button>
            </div>
            <div class="modal-body">
               

                <div id="template-editor-container" class="p-3">
                    <div class="text-center text-secondary">
                    <iframe
    src="http://localhost:8050/editor/editor.php"
    title="Template Editor"
    loading="lazy"
></iframe>
                    </div>
                </div>
            </div>
            <div class="modal-footer border-secondary">
                <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    data-bs-dismiss="modal"
                >
                    <span data-lang-key="form.close">
                        Close
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>
﻿<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->
<!--
sections/active_event_settings.php — Modal: Active Event
-->
<div
    class="modal fade"
    id="modalActiveEvent"
    tabindex="-1"
    aria-labelledby="modalActiveEventLabel"
    aria-hidden="true"
>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalActiveEventLabel"
                    data-lang-key="overlay.active_event.title"
                >
                    Active Event
                </h5>

                &nbsp;
                <!-- Config hint (tooltip) -->
                <i
                    class="bi bi-gear fs-3"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    data-bs-trigger="hover click"
                    title="config/active_event_config.json"
                ></i>

                &nbsp;
                <!-- New event wizard -->
                <button
                    type="button"
                    class="btn btn-outline-success btn-sm"
                    id="btnNewEvent"
                    title="Create new event"
                >
                    <i class="bi bi-plus-circle me-1"></i>
                    <span data-lang-key="overlay.active_event.new_event.button">
                        New Event
                    </span>
                </button>

                &nbsp;
                <!-- Open event folder (Windows Explorer) — im Kiosk-Modus nicht verfügbar, daher auskommentiert -->
                <!--
                <button
                    type="button"
                    class="btn btn-outline-warning btn-sm pb-open-folder"
                    title="Open event folder"
                    data-target="activeEvent"
                    data-create_dir="true"
                    data-cooldown="3"
                >
                    <i class="bi bi-folder2-open me-1"></i>
                    <span data-lang-key="overlay.active_event.open_folder.button">
                        Folder
                    </span>
                </button>
                -->

                <!-- Eigener Foto-Explorer (Kiosk-kompatibel) -->
                <button
                    type="button"
                    class="btn btn-outline-warning btn-sm"
                    id="btnOpenPhotoExplorer"
                    title="Fotos anzeigen"
                >
                    <i class="bi bi-images me-1"></i>
                    <span data-lang-key="overlay.active_event.photo_explorer.button">
                        Fotos
                    </span>
                </button>

                <!-- Button close -->
                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="Close"
                ></button>
            </div>

            <div class="modal-body">
                <p
                    class="small text-secondary mb-3"
                    data-lang-key="overlay.active_event.description"
                >
                    Configure folder, template and print limits for the current event.
                </p>

                <form
                    id="formActiveEvent"
                    class="small"
                    data-json-file="config/active_event_config.json"
                >
                    <div class="mb-3">
                        <label
                            for="eventNamse"
                            class="form-label"
                            data-lang-key="overlay.active_event.event_name.label"
                        >
                            Event Name
                        </label>

                        <div class="input-group input-group-sm">
                            <input
                                type="text"
                                class="form-control"
                                id="eventNamse"
                                placeholder="Add Event Name"
                                data-json-group="active_event"
                                data-json-parm="eventName"
                                data-default-value=""
                            >
                        </div>
                    </div>

                    <!-- Photo storage folder — automatisch aus booth/photos + Eventname -->
                    <div class="mb-3">
                        <label class="form-label" data-lang-key="overlay.active_event.storage.label">
                            Photo storage folder
                        </label>

                        <!-- Verstecktes Feld — wird per JS automatisch befüllt, in JSON gespeichert.
                             data-default-value ist absichtlich leer: der absolute Dateisystempfad
                             ist installationsabhängig und wird von pb_dynamic_defaults.js zur
                             Laufzeit aus /runtime (booth_root) berechnet und hier eingesetzt,
                             bevor PB.applyConfigToForm läuft. -->
                        <input
                            type="hidden"
                            id="eventStoragePath"
                            data-json-group="active_event"
                            data-json-parm="photo_storage_path"
                            data-default-value=""
                            data-pb-dynamic-default="boothRoot/EVENTS"
                            data-photos-base=""
                        >

                        <!-- Schreibgeschützte Pfad-Anzeige -->
                        <div class="input-group input-group-sm">
                            <span class="input-group-text text-secondary">
                                <i class="bi bi-folder2"></i>
                            </span>
                            <input
                                type="text"
                                class="form-control text-secondary"
                                id="eventStoragePathDisplay"
                                readonly
                                placeholder="…"
                                tabindex="-1"
                            >
                        </div>

                        <div class="form-text small" data-lang-key="overlay.active_event.storage.help_auto">
                            The storage path is automatically set to photos/EVENTS/<event-name> within the booth folder.
                        </div>
                    </div>

                    <!-- Template (ZIP) -->
                    <div class="mb-3">
                        <label
                            for="eventTemplateZip"
                            class="form-label"
                            data-lang-key="overlay.active_event.template.label"
                        >
                            Template (ZIP)
                        </label>

                        <!-- Note: File inputs are not stored via JSON. Handle upload via a dedicated endpoint (FormData).
                             multiple: Besucher sollen zwischen mehreren Templates wählen können (Slots 1..N).
                             Wählt der Benutzer hier mehrere ZIPs aus, legt der Upload-Endpoint für jede Datei
                             einen eigenen nummerierten Unterordner unter activeTemplate/<n>/ an. -->
                        <input
                            type="file"
                            class="form-control form-control-sm"
                            id="eventTemplateZip"
                            accept=".zip"
                            multiple
                        >

                        <div class="form-text small" data-lang-key="overlay.active_event.template.help">
                            Select one or more template ZIP archives. One file = single active template. Multiple files = the visitor can choose between them before starting the capture.
                        </div>

                        <!-- Vorschau der aktuell aktiven Templates (activeTemplate/<n>/preview.jpg).
                             Rein lesend, wird per JS (active_event.js) aus
                             api/list_active_templates.php befüllt. Klick auf ein Thumbnail
                             öffnet die Dateiauswahl erneut, um dieses Template zu ersetzen.
                             Zeigt nichts an, solange kein preview.jpg im Template-ZIP liegt
                             (Feature wird an anderer Stelle separat ergänzt, siehe
                             .claude/ACTIVE_TEMPLATE.md). -->
                        <div id="activeTemplatePreviewWrap" class="d-flex flex-wrap gap-2 mt-2"></div>
                    </div>

                    <!-- Maximum prints -->
                    <div class="mb-3">
                        <label
                            for="eventMaxPrints"
                            class="form-label"
                            data-lang-key="overlay.active_event.prints.label"
                        >
                            Maximum number of prints
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="eventMaxPrints"
                            min="0"
                            step="1"
                            placeholder="0"
                            value="0"
                            data-json-group="active_event"
                            data-json-parm="max_prints"
                            data-default-value="0"
                        >

                        <div class="form-text small" data-lang-key="overlay.active_event.prints.help">
                            0 = unlimited. This limit is counted down with every print.
                        </div>
                    </div>

                    <!-- Already printed photos (print counter) -->
                    <div class="mb-3">
                        <label
                            for="eventPrintCounter"
                            class="form-label"
                            data-lang-key="overlay.active_event.print_counter.label"
                        >
                            Already printed photos
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="eventPrintCounter"
                            min="0"
                            step="1"
                            placeholder="0"
                            value="0"
                            data-json-group="active_event"
                            data-json-parm="print_counter"
                            data-default-value="0"
                        >

                        <div class="form-text small" data-lang-key="overlay.active_event.print_counter.help">
                            Current counter of already printed photos for this event.
                        </div>
                    </div>

                    <!-- Allow reprint -->
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="eventAllowReprint"
                                data-json-group="active_event"
                                data-json-parm="allow_reprint"
                                data-default-value="false"
                            >

                            <label
                                class="form-check-label"
                                for="eventAllowReprint"
                                data-lang-key="overlay.active_event.allow_reprint.label"
                            >
                                Allow reprint
                            </label>
                        </div>

                        <div class="form-text small" data-lang-key="overlay.active_event.allow_reprint.help">
                            If enabled, operators can reprint the last result without consuming a new photo session.
                        </div>
                    </div>

                    <!-- Multiple print copies -->
                    <div class="mb-3">
                        <label
                            for="eventMultiplePrint"
                            class="form-label"
                            data-lang-key="overlay.active_event.multiple_print.label"
                        >
                            Multiple print copies
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="eventMultiplePrint"
                            min="1"
                            step="1"
                            placeholder="1"
                            value="1"
                            data-json-group="active_event"
                            data-json-parm="multiple_print"
                            data-default-value="1"
                        >

                        <div class="form-text small" data-lang-key="overlay.active_event.multiple_print.help">
                            Number of copies per print job (e.g. 2 prints each time).
                        </div>
                    </div>

                    <!-- Hidden config path — value/data-default-value absichtlich leer,
                         siehe Kommentar oben bei eventStoragePath (pb_dynamic_defaults.js). -->
                    <div>
                        <input
                            type="hidden"
                            id="settingActiveEvent"
                            class="form-control form-control-sm"
                            value=""
                            readonly
                            data-json-group="active_event"
                            data-json-parm="config_path"
                            data-json-type="string"
                            data-default-value=""
                            data-pb-dynamic-default="boothRoot/config/active_event_config.json"
                        >
                    </div>
                </form>
            </div>

            <div class="modal-footer border-secondary">
                <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
                    <span data-lang-key="form.cancel">
                        Cancel
                    </span>
                </button>

                <!-- Save active_event_config.json -->
                <button
                    type="button"
                    class="btn btn-primary btn-sm pb-save-config"
                    data-json-file="config/active_event_config.json"
                >
                    <span data-lang-key="form.save">
                        Save
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>
﻿<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->

<!--
sections/camera_settings.php
UI liest/schreibt Werte dynamisch über data-json-* in config/camera_config.json.
-->
<div
    class="modal fade"
    id="modalCameraSettings"
    tabindex="-1"
    aria-labelledby="modalCameraSettingsLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalCameraSettingsLabel"
                    data-lang-key="overlay.camera_settings.title">
                    Camera Settings
                </h5>

                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>

            <div class="modal-body">
                <p
                    class="small text-secondary mb-3"
                    data-lang-key="overlay.camera_settings.description">
                    Adjust camera parameters using digiCamControl CLI.
                </p>

                <form
                    id="formCameraSettings"
                    class="small"
                    data-json-file="config/camera_config.json">
                    <div class="row g-3">
                        <!-- ISO -->
                        <div class="col-md-4">
                            <label
                                class="form-label"
                                for="cameraIso"
                                data-lang-key="overlay.camera_settings.iso.label">
                                ISO
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="cameraIso"
                                data-json-group="camera_settings"
                                data-json-parm="iso"
                                data-default-value="100">
                                <option value="100">100</option>
                                <option value="200">200</option>
                                <option value="400">400</option>
                                <option value="800">800</option>
                                <option value="1600">1600</option>
                            </select>
                        </div>

                        <!-- Shutter Speed -->
                        <div class="col-md-4">
                            <label
                                class="form-label"
                                for="cameraShutter"
                                data-lang-key="overlay.camera_settings.shutter.label">
                                Shutter Speed
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="cameraShutter"
                                data-json-group="camera_settings"
                                data-json-parm="shutter"
                                data-default-value="1/60">
                                <option value="30">30"</option>
                                <option value="15">15"</option>
                                <option value="8">8"</option>
                                <option value="4">4"</option>
                                <option value="2">2"</option>
                                <option value="1">1"</option>
                                <option value="1/2">1/2</option>
                                <option value="1/4">1/4</option>
                                <option value="1/8">1/8</option>
                                <option value="1/15">1/15</option>
                                <option value="1/30">1/30</option>
                                <option value="1/60" selected>1/60</option>
                                <option value="1/80">1/80</option>
                                <option value="1/100">1/100</option>
                                <option value="1/125">1/125</option>
                                <option value="1/250">1/250</option>
                                <option value="1/500">1/500</option>
                                <option value="1/1000">1/1000</option>
                                <option value="1/2000">1/2000</option>
                                <option value="1/4000">1/4000</option>
                                <option value="1/8000">1/8000</option>
                            </select>
                        </div>

                        <!-- Aperture -->
                        <div class="col-md-4">
                            <label
                                class="form-label"
                                for="cameraAperture"
                                data-lang-key="overlay.camera_settings.aperture.label">
                                Aperture (f-stop)
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="cameraAperture"
                                data-json-group="camera_settings"
                                data-json-parm="aperture"
                                data-default-value="5.6">
                                <option value="2.8">f/2.8</option>
                                <option value="4">f/4</option>
                                <option value="5.6">f/5.6</option>
                                <option value="8">f/8</option>
                                <option value="11">f/11</option>
                            </select>
                        </div>

                        <!-- White Balance -->
                        <div class="col-md-4">
                            <label
                                class="form-label"
                                for="cameraWB"
                                data-lang-key="overlay.camera_settings.wb.label">
                                White Balance
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="cameraWB"
                                data-json-group="camera_settings"
                                data-json-parm="wb"
                                data-default-value="auto">
                                <option value="auto" data-lang-key="overlay.camera_settings.wb.auto">
                                    Auto
                                </option>
                                <option value="daylight" data-lang-key="overlay.camera_settings.wb.daylight">
                                    Daylight
                                </option>
                                <option value="cloudy" data-lang-key="overlay.camera_settings.wb.cloudy">
                                    Cloudy
                                </option>
                                <option value="tungsten" data-lang-key="overlay.camera_settings.wb.tungsten">
                                    Tungsten
                                </option>
                                <option value="fluorescent" data-lang-key="overlay.camera_settings.wb.fluorescent">
                                    Fluorescent
                                </option>
                            </select>
                        </div>

                        <!-- Exposure Compensation -->
                        <div class="col-md-4">
                            <label
                                class="form-label"
                                for="cameraExposure"
                                data-lang-key="overlay.camera_settings.exposure.label">
                                Exposure Compensation
                            </label>

                            <input
                                type="number"
                                step="0.3"
                                class="form-control form-control-sm"
                                id="cameraExposure"
                                value="0"
                                data-json-group="camera_settings"
                                data-json-parm="exposure"
                                data-json-type="float"
                                data-default-value="0">
                        </div>

                        <!-- Use settings for picture -->
                        <div class="col-12">
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="cameraUseSettingsForPicture"
                                    data-json-group="camera_settings"
                                    data-json-parm="use_settings_for_picture"
                                    data-default-value="true"
                                    checked>
                                <label
                                    class="form-check-label"
                                    for="cameraUseSettingsForPicture"
                                    data-lang-key="overlay.camera_settings.use_settings_for_picture.label">
                                    Use settings for picture
                                </label>
                            </div>

                            <div
                                class="small text-secondary"
                                data-lang-key="overlay.camera_settings.use_settings_for_picture.hint">
                                If enabled, LiveView runs continuously (increased heat and power usage; may reduce stability during long events). Recommended: lower FPS when idle and use higher FPS only during active photo sessions.
                            </div>
                        </div>

                        <!-- LiveView always active -->
                        <div class="col-12">
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="cameraLiveviewAlwaysActive"
                                    data-json-group="camera_settings"
                                    data-json-parm="liveview_always_active"
                                    data-default-value="false">
                                <label
                                    class="form-check-label"
                                    for="cameraLiveviewAlwaysActive"
                                    data-lang-key="overlay.camera_settings.liveview_always_active.label">
                                    Keep LiveView running all the time
                                </label>
                            </div>

                            <div
                                class="small text-secondary"
                                data-lang-key="overlay.camera_settings.liveview_always_active.hint">
                                If disabled, LiveView starts only when needed. Before the first capture a 3-second warmup countdown is shown.
                            </div>

                            <div class="alert alert-warning py-2 mt-2 mb-0" role="alert">
                                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                <span data-lang-key="overlay.camera_settings.liveview_always_active.warning">
                                    If enabled, LiveView runs permanently (heat, power usage, possible stability issues on long events).
                                </span>
                            </div>

                            <!-- LiveView auf Startbildschirm anzeigen -->
                            <div class="form-check form-switch mt-3">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="cameraLiveviewShowOnStartscreen"
                                    data-json-group="camera_settings"
                                    data-json-parm="liveview_show_on_startscreen"
                                    data-default-value="true">
                                <label
                                    class="form-check-label"
                                    for="cameraLiveviewShowOnStartscreen"
                                    data-lang-key="overlay.camera_settings.liveview_show_on_startscreen.label">
                                    Show LiveView on startscreen
                                </label>
                            </div>
                            <div
                                class="small text-secondary"
                                data-lang-key="overlay.camera_settings.liveview_show_on_startscreen.hint">
                                Only relevant when "Keep LiveView running" is active. If disabled, the static background is shown instead — LiveView still runs in the background.
                            </div>

                            <hr class="my-3">

                            <!-- Mirror preview only -->
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="cameraPreviewMirror"
                                    data-json-group="camera_settings"
                                    data-json-parm="preview_mirror"
                                    data-default-value="false">
                                <label
                                    class="form-check-label"
                                    for="cameraPreviewMirror"
                                    data-lang-key="overlay.camera_settings.preview_mirror.label">
                                    Mirror preview image
                                </label>
                            </div>

                            <div
                                class="small text-secondary"
                                data-lang-key="overlay.camera_settings.preview_mirror.hint">
                                Mirrors only the on-screen preview (useful for front-facing setups). Saved photos are not changed.
                            </div>

                            <hr class="my-3">

                            <!-- Fullscreen/crop preview -->
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="cameraFullImg"
                                    data-json-group="camera_settings"
                                    data-json-parm="fullImg"
                                    data-default-value="false">
                                <label
                                    class="form-check-label"
                                    for="cameraFullImg"
                                    data-lang-key="overlay.camera_settings.full_img.label">
                                    Fullscreen preview (crop edges, center image)
                                </label>
                            </div>

                            <!-- FPS settings -->
                            <!-- LiveView Camera Protection (schreibt liveview_max_runtime_minutes UND liveview_auto_pause_minutes) -->
                            <div class="row g-2 mt-3">
                                <div class="col-12">
                                    <label
                                        for="cameraLiveviewMaxRuntimeMin"
                                        class="form-label mb-1"
                                        data-lang-key="overlay.camera_settings.liveview_max_runtime.label">
                                        Camera protection: stop LiveView after (minutes)
                                    </label>

                                    <div class="input-group input-group-sm" style="max-width:200px">
                                        <input
                                            type="number"
                                            class="form-control"
                                            id="cameraLiveviewMaxRuntimeMin"
                                            min="0"
                                            max="120"
                                            step="1"
                                            placeholder="0 = off"
                                            data-json-group="camera_settings"
                                            data-json-parm="liveview_max_runtime_minutes"
                                            data-json-type="int"
                                            data-default-value="0"
                                            data-sync-parm="liveview_auto_pause_minutes">
                                        <span class="input-group-text" data-lang-key="overlay.camera_settings.liveview_max_runtime.unit">
                                            min
                                        </span>
                                    </div>

                                    <div
                                        class="small text-secondary mt-1"
                                        data-lang-key="overlay.camera_settings.liveview_max_runtime.hint">
                                        0 = disabled. LiveView is stopped automatically after X minutes to protect the camera — both during inactivity and during continuous use. It restarts on the next capture.
                                    </div>
                                </div>
                            </div>

                            <div class="row g-2 mt-3">
                                <div class="col-12 col-md-6">
                                    <label
                                        for="cameraLiveviewFpsActive"
                                        class="form-label mb-1"
                                        data-lang-key="overlay.camera_settings.liveview_fps_active.label">
                                        LiveView FPS (while session is running)
                                    </label>

                                    <div class="input-group input-group-sm">
                                        <input
                                            type="number"
                                            class="form-control"
                                            id="cameraLiveviewFpsActive"
                                            min="1"
                                            max="30"
                                            step="1"
                                            placeholder="e.g. 15"
                                            data-json-group="camera_settings"
                                            data-json-parm="liveview_fps_active"
                                            data-json-type="int"
                                            data-default-value="20">
                                        <span class="input-group-text" data-lang-key="overlay.camera_settings.liveview_fps.unit">
                                            FPS
                                        </span>
                                    </div>

                                    <div
                                        class="small text-secondary mt-1"
                                        data-lang-key="overlay.camera_settings.liveview_fps_active.hint">
                                        Used after clicking START (countdown / capturing). Higher FPS feels smoother but uses more CPU/USB bandwidth.
                                    </div>
                                </div>

                                <div class="col-12 col-md-6">
                                    <label
                                        for="cameraLiveviewFpsIdle"
                                        class="form-label mb-1"
                                        data-lang-key="overlay.camera_settings.liveview_fps_idle.label">
                                        LiveView FPS (idle / preview only)
                                    </label>

                                    <div class="input-group input-group-sm">
                                        <input
                                            type="number"
                                            class="form-control"
                                            id="cameraLiveviewFpsIdle"
                                            min="1"
                                            max="30"
                                            step="1"
                                            placeholder="e.g. 8"
                                            data-json-group="camera_settings"
                                            data-json-parm="liveview_fps_idle"
                                            data-json-type="int"
                                            data-default-value="10">
                                        <span class="input-group-text" data-lang-key="overlay.camera_settings.liveview_fps.unit">
                                            FPS
                                        </span>
                                    </div>

                                    <div
                                        class="small text-secondary mt-1"
                                        data-lang-key="overlay.camera_settings.liveview_fps_idle.hint">
                                        Used when not in a photo session (only preview/stream). Lower FPS saves CPU and improves stability on long events.
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </form>

                <hr class="border-secondary my-4">

                <!-- Test photo -->
                <div class="d-flex align-items-start justify-content-between gap-3 mb-2">
                    <div>
                        <div class="fw-semibold" data-lang-key="overlay.camera_settings.testphoto.title">
                            Test Photo
                        </div>
                        <div class="small text-secondary" data-lang-key="overlay.camera_settings.testphoto.hint">
                            Take a test shot to verify settings and framing.
                        </div>
                    </div>

                    <button
                        type="button"
                        class="btn btn-outline-info btn-sm"
                        id="btnTakeTestPhoto">
                        <i class="bi bi-camera"></i>
                        <span data-lang-key="overlay.camera_settings.testphoto.button">
                            Take test photo
                        </span>
                    </button>
                </div>

                <div
                    id="testPhotoPreviewWrap"
                    class="border border-secondary rounded bg-black p-2"
                    style="min-height: 180px;">
                    <div
                        id="testPhotoPlaceholder"
                        class="small text-secondary"
                        data-lang-key="overlay.camera_settings.testphoto.placeholder">
                        No test photo yet.
                    </div>

                    <img
                        id="testPhotoImg"
                        class="img-fluid d-none"
                        src=""
                        alt="Test photo preview">
                </div>

                <div class="small text-secondary mt-2" data-lang-key="overlay.camera_settings.testphoto.note">
                    The latest test photo will be shown here.
                </div>
            </div>

            <div class="modal-footer border-secondary">
                <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    data-bs-dismiss="modal">
                    <span data-lang-key="form.cancel">Cancel</span>
                </button>

                <button
                    type="button"
                    class="btn btn-primary btn-sm pb-save-config"
                    id="btnSaveCameraSettings"
                    data-json-file="config/camera_config.json">
                    <span data-lang-key="overlay.camera_settings.actions.apply">
                        Apply settings
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>
﻿<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->

<!-- sections/select_device.php -->
<div
    class="modal fade"
    id="modalSelectDevice"
    tabindex="-1"
    aria-labelledby="modalSelectDeviceLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalSelectDeviceLabel"
                    data-lang-key="overlay.select_device.title">
                    Select Device
                </h5>

                &nbsp;
                <i class="bi bi-gear fs-3"
                   data-bs-toggle="tooltip"
                   data-bs-trigger="hover click"
                   data-bs-placement="top"
                   title="config/config.json"></i>

                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="Close"></button>
            </div>

            <div class="modal-body">
                <p class="text-secondary small mb-3" data-lang-key="overlay.select_device.description">
                    Choose the device used for live preview and capture. Optionally use a webcam instead.
                </p>

                <form
                    id="formSelectDevice"
                    class="small"
                    data-json-file="config/config.json">

                    <div class="mb-3">
                        <div class="form-check">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                id="settingOnlyCameras"
                                data-json-group="camera"
                                data-json-parm="show_only_camera"
                                data-default-value="false">
                            <label
                                class="form-check-label"
                                for="settingOnlyCameras"
                                data-lang-key="overlay.select_device.only_cameras.label">
                                Show cameras only
                            </label>
                        </div>

                        <div class="form-text text-secondary" data-lang-key="overlay.select_device.only_cameras.help">
                            Filters the device list (UI only, not saved to config).
                        </div>
                    </div>

                    <div class="mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <label
                                for="settingDeviceSelected"
                                class="form-label mb-0"
                                data-lang-key="overlay.select_device.device.label">
                                Device
                            </label>

                            <button
                                type="button"
                                class="btn btn-sm btn-outline-light"
                                id="btnDeviceRefresh"
                                title="Load devices"
                                data-bs-toggle="tooltip"
                                data-bs-placement="left">
                                <i class="bi bi-arrow-repeat"></i>
                            </button>
                        </div>

                        <select
                            id="settingDeviceSelected"
                            class="form-select form-select-sm mt-1"
                            data-json-group="camera"
                            data-json-parm="device"
                            data-default-value=""
                            aria-describedby="settingDeviceSelectedHelp">
                            <option value="" data-lang-key="overlay.select_device.no_devices">
                                No devices found.
                            </option>
                        </select>

                        <div
                            id="settingDeviceSelectedHelp"
                            class="form-text text-secondary"
                            data-lang-key="overlay.select_device.device.help">
                            This device will be used for both preview and capture (stream + capture are the same).
                        </div>
                    </div>

                    <div id="hintCameraBridgeOffline" class="alert alert-danger py-2 mt-2 d-none" role="alert">
                        <div class="device-error-msg device-error-offline d-none"
                             data-lang-key="overlay.select_device.error.camerabridge_offline">
                            No connection to CameraBridge. Please start CameraBridge.exe (Default: 127.0.0.1:8052).
                        </div>

                        <div class="device-error-msg device-error-http d-none"
                             data-lang-key="overlay.select_device.error.camera_api_http">
                            Load list failed.
                            <span class="device-error-detail ms-1"></span>
                        </div>
                    </div>

                    <input type="hidden" id="pbCam_usb_id"       data-json-group="camera.selected_camera" data-json-parm="usb_id" value="">
                    <input type="hidden" id="pbCam_id"           data-json-group="camera.selected_camera" data-json-parm="id" value="">
                    <input type="hidden" id="pbCam_display_name" data-json-group="camera.selected_camera" data-json-parm="display_name" value="">
                    <input type="hidden" id="pbCam_manufacturer" data-json-group="camera.selected_camera" data-json-parm="manufacturer" value="">
                    <input type="hidden" id="pbCam_model"        data-json-group="camera.selected_camera" data-json-parm="model" value="">
                    <input type="hidden" id="pbCam_serial"       data-json-group="camera.selected_camera" data-json-parm="serial" value="">
                    <input type="hidden" id="pbCam_port"         data-json-group="camera.selected_camera" data-json-parm="port" value="">
                    <input type="hidden" id="pbCam_is_connected" data-json-group="camera.selected_camera" data-json-parm="is_connected" data-json-type="bool" value="">
                </form>
            </div>

            <div class="modal-footer border-secondary">
                <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    id="btnDeviceRefresh_ico">
                    <span data-lang-key="overlay.select_device.refresh">
                        Load devices
                    </span>
                </button>

                <button
                    type="button"
                    class="btn btn-primary btn-sm pb-save-config"
                    id="btnSaveSelectDevice"
                    data-form-id="formSelectDevice">
                    <span data-lang-key="overlay.select_device.save">
                        Save
                    </span>
                </button>

                <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    data-bs-dismiss="modal">
                    <span data-lang-key="form.close">
                        Close
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->

<!-- sections/unlock_screen.php -->
<div class="modal fade"
     id="modalExitFullscreen"
     tabindex="-1"
     aria-labelledby="modalExitFullscreenLabel"
     aria-hidden="true">

  <div class="modal-dialog modal-sm modal-dialog-centered">
    <div class="modal-content bg-dark text-light border border-secondary">

      <div class="modal-header border-secondary">
        <h5 class="modal-title"
            id="modalExitFullscreenLabel"
            data-lang-key="overlay.exit_fullscreen.title">
          Exit fullscreen
        </h5>

        <button type="button"
                class="btn-close btn-close-white"
                data-bs-dismiss="modal"
                aria-label="Close"></button>
      </div>

      <div class="modal-body">
        <p class="small text-secondary mb-2" data-lang-key="overlay.exit_fullscreen.text">
          Enter admin password to exit kiosk mode.
        </p>

        <input type="password"
               class="form-control form-control-sm"
               id="exitFullscreenPassword"
               autocomplete="off"
               inputmode="none"
               readonly
               placeholder="Password">

        <div class="pb-keypad mt-3" id="exitFullscreenKeypad">
          <div class="row g-2">
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="1">1</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="2">2</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="3">3</button></div>

            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="4">4</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="5">5</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="6">6</button></div>

            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="7">7</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="8">8</button></div>
            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="9">9</button></div>

            <div class="col-4">
              <button type="button" class="btn btn-outline-warning w-100 pb-key" data-keypad-action="clear">
                <span data-lang-key="overlay.exit_fullscreen.keypad.clear">
                  C
                </span>
              </button>
            </div>

            <div class="col-4"><button type="button" class="btn btn-outline-light w-100 pb-key" data-keypad-digit="0">0</button></div>

            <div class="col-4">
              <button type="button" class="btn btn-outline-danger w-100 pb-key" data-keypad-action="back">
                <span data-lang-key="overlay.exit_fullscreen.keypad.back">
                  ⌫
                </span>
              </button>
            </div>
          </div>
        </div>

        <div id="exitFullscreenError"
             class="text-danger small mt-2 d-none"
             data-lang-key="overlay.exit_fullscreen.error">
          Wrong password.
        </div>
      </div>

      <div class="modal-footer border-secondary">
        <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
          <span data-lang-key="form.cancel">Cancel</span>
        </button>

        <button type="button" class="btn btn-danger btn-sm" id="btnExitFullscreenConfirm">
          <span data-lang-key="overlay.exit_fullscreen.confirm">Exit</span>
        </button>
      </div>

    </div>
  </div>
</div>
<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
<!-- Copyright (c) 2026 Andreas Rottmann -->

<div id="pb-connection-panel" class="pb-connection-panel">
  <div class="pb-connection-row">
    <span class="pb-connection-device" data-lang-key="overlay.connection_info.connected_device">
      Connected Device:
    </span>
    <span id="pb-connection-device_model"></span>
  <div class="pb-connection-row">
    <span class="pb-connection-label" data-lang-key="externalPc.label">
      External PC:
    </span>

    <span
      id="pb-externalpc-status"
      class="badge bg-secondary"
      data-lang-key="externalPc.badge.unknown"
    >
      unknown
    </span>
  </div>

  <div class="pb-connection-row">
    <span class="pb-connection-label" data-lang-key="externalPc.tof.label">
      ToF:
    </span>

    <span
      id="pb-tof-status"
      class="badge bg-secondary"
      data-lang-key="externalPc.tof.disabled"
    >
      disabled
    </span>
  </div>

  <div class="pb-connection-row">
    <span class="pb-connection-label" data-lang-key="externalPc.credit.label">
      Credit:
    </span>

    <span
      id="pb-credit-balance"
      class="badge bg-secondary"
      data-lang-key="externalPc.credit.unknown"
    >
      —
    </span>
  </div>

  <div class="pb-connection-row">
    <span class="pb-connection-label" data-lang-key="overlay.connection_info.bridge_label">
      CameraBridge:
    </span>

    <span
      id="pb-bridge-status"
      class="badge bg-secondary"
      data-lang-key="bridge.badge.unknown"
    >
      unknown
    </span>

    <button
      type="button"
      class="btn btn-sm btn-outline-light pb-bridge-start"
      data-bridge="camera"
      title="Start CameraBridge"
    >
      <span data-lang-key="overlay.connection_info_start_btn">
        Start CameraBridge
      </span>
    </button>

    <button
      type="button"
      class="btn btn-sm btn-outline-danger pb-bridge-stop"
      data-bridge="camera"
      title="Stop CameraBridge"
    >
      <span data-lang-key="overlay.connection_info_stop_btn">
        Stop CameraBridge
      </span>
    </button>
  </div>
</div>

<!-- Bootstrap Bundle (mit Popper) -->
<script
    src="src/js/bootstrap.bundle.min.js"
></script>

<!-- jQuery -->
<script src="src/js/jquery-3.7.1.min.js"></script>
<script src="src/js/crypto-js.min.js"></script>


<!-- Funktionssammlung (ohne Events) -->
<script src="src/js/functions/debug.js?v=20261127"></script>
<script src="src/js/functions/debug_mode_bindings.js?v=20261127"></script>


<script src="src/js/functions/pb_core.js?v=20261127"></script>
<script src="src/js/functions/config_io.js?v=20261127"></script>
<script src="src/js/app/app_bootstrap.js?v=20261127"></script>
<script src="src/js/app/camera_restore.js?v=20261127"></script>
<script src="src/js/app/liveview_autopause.js?v=20261127"></script>
<script src="src/js/app/main.js?v=20261127"></script>
<script src="src/js/functions/edit_config.js?v=20261127"></script>
<script src="src/js/functions/i18n.js?v=20261127"></script>
<!-- Einheitlicher JSON-Client für den lokalen API-Server -->
<script src="src/js/functions/bridge_api.js?v=20261127"></script>
<script src="src/js/functions/pb_python_server.js?v=20261127"></script>
<script src="src/js/functions/pb_bridge_services.js?v=20261127"></script>
<!-- Bridge UI + Device Selection (Dropdown, Refresh, Offline-Hint) -->
<script src="src/js/functions/camera_bridge.js?v=20261127"></script>
<!-- Preview (Webcam oder Kamera-IFrame) -->
<script src="src/js/functions/preview.js?v=20261127"></script>
<!-- Preview-Source List + Wrapper für refreshUnifiedDeviceDropdown -->
<script src="src/js/functions/select_device_bindings.js?v=20261127"></script>
<script src="src/js/functions/devices.js?v=20261127"></script>
<script src="src/js/functions/main_screen.js?v=20261127"></script>
<script src="src/js/functions/unlock.js?v=20261127"></script>
<!--<script src="src/js/functions/windows_api.js?v=20261127"></script>-->
<script src="src/js/functions/api_route.js?v=20261127"></script>
<!--<script src="src/js/functions/app_init.js?v=20261127"></script>-->
<script src="src/js/functions/ui_fullscreen.js?v=20261127"></script>




<!-- Event-Handler / Initialisierung -->
<script src="src/js/app/preview_bindings.js?v=20261127"></script>
<script src="src/js/app/modal_config_bindings.js?v=20261127"></script>
<script src="src/js/app/modal_stack_bindings.js?v=20261127"></script>
<script src="src/js/app/fullscreen_unlock_bindings.js?v=20261127"></script>
<script src="src/js/app/windows_picker_bindings.js?v=20261127"></script>
<script src="src/js/app/printer_settings.js?v=20261127"></script>
<script src="src/js/app/active_event.js?v=20261127"></script>
<script src="src/js/app/template_selector.js?v=20261127"></script>
<script src="src/js/app/photo_explorer.js?v=20261127"></script>
<!--<script src="src/js/app/app.js?v=20261127"></script>-->
<script src="src/js/app/camerabridge_API_server_status.js?v=20261127"></script>
<script src="src/js/app/camerabridge_API_server_start_restart.js?v=20261127"></script>
<script src="src/js/app/icon_for_os.js?v=20261127"></script>
<script src="src/js/app/python_server_bindings.js?v=20261127"></script>
<script src="src/js/app/external_pc_identify.js?v=20261127"></script>
<script src="src/js/app/pico_status_poll.js?v=20261127"></script>


<!-- capture js -->
<script src="src/js/app/capture/capture_api.js?v=20261127"></script>
<script src="src/js/app/coin_print_flow.js?v=20261127"></script>

<script src="src/js/app/capture/capture_bindings.js?v=20261127"></script>
<script src="src/js/app/capture/capture_flow.js?v=20261127"></script>

<script src="src/js/functions/capture_test_photo.js?v=20261127"></script>


<script src="src/js/functions/pb-init.js?v=20261127"></script>
<!-- PRELOADER -->
<script src="src/js/functions/preloader.js?v=20261127"></script>

</body>
</html>
