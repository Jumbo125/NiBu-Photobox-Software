<!doctype html>
<!-- SPDX-License-Identifier: Apache-2.0 -->
<!-- Copyright (c) 2026 Andreas Rottmann -->
<html lang="de">

<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title data-i18n="page.title">Template Editor</title>

  <link rel="stylesheet" href="../src/css/bootstrap.css">
  <link rel="stylesheet" href="../src/css/bootstrap-icons.css">

  <link rel="stylesheet" href="css/template_editor_main.css?v=20261127">
</head>

<body class="bg-dark text-light">
  <div class="d-flex flex-column vh-100">

        <!-- TOPBAR -->
    <nav class="navbar navbar-dark bg-dark border-bottom border-secondary px-2">
      <div class="container-fluid p-0 d-flex align-items-center gap-2">
        <div class="d-flex flex-column">
          <span class="navbar-brand mb-0 fw-bold" data-i18n="brand.title">Template Editor</span>
          <div class="d-flex align-items-center gap-2">
            <input
              type="text"
              id="teTemplateNameInput"
              class="form-control form-control-sm bg-dark text-light border-secondary"
              style="min-width:160px; max-width:260px; font-size:0.8rem;"
              placeholder="Template-Name"
              data-i18n-placeholder="te.template.name_placeholder"
              autocomplete="off"
              spellcheck="false"
            />
            <small class="text-secondary text-nowrap" id="teTemplateInfo"></small>
          </div>
        </div>
        <div class="vr text-secondary"></div>

        <!-- LANGUAGE -->
        <div class="dropdown">
          <button
            class="btn btn-outline-light btn-sm dropdown-toggle"
            type="button"
            id="teLangBtn"
            data-bs-toggle="dropdown"
            aria-expanded="false"
            aria-label="Sprache"
            data-i18n-aria-label="aria.language"
            title="Sprache wechseln"
            data-i18n-title="lang.switch.title"
          >
            <i class="bi bi-translate me-1"></i>
            <span data-i18n="lang.switch.btn">Sprache</span>
          </button>

          <ul class="dropdown-menu dropdown-menu-dark dropdown-menu-end" aria-labelledby="teLangBtn">
            <li>
              <button class="dropdown-item" type="button" data-lang="de">
                <span data-i18n="lang.de">Deutsch</span>
              </button>
            </li>
            <li>
              <button class="dropdown-item" type="button" data-lang="en">
                <span data-i18n="lang.en">English</span>
              </button>
            </li>
          </ul>
        </div>

        <div class="ms-auto d-flex flex-wrap gap-2 align-items-center">

          <div class="btn-group btn-group-sm"
               role="group"
               aria-label="Template Aktionen"
               data-i18n-aria-label="aria.templateActions">

            <!-- GREENWALL -->
            <div class="d-flex align-items-center gap-2 flex-wrap greenwall_wrapper">
              <div class="form-check form-check-inline m-0 ms-2">
                <input class="form-check-input" type="checkbox" id="chkGreenwall">
                <label class="form-check-label" for="chkGreenwall" data-i18n="chk.greenwall">Greenwall</label>
              </div>

              <div class="btn-group btn-group-sm"
                   role="group"
                   aria-label="Greenwall Aktionen"
                   data-i18n-aria-label="aria.greenwallActions">
                <button id="btnGreenwallUpload" type="button" class="btn btn-outline-light">
                  <i class="bi bi-upload me-1"></i><span data-i18n="btn.greenwall.upload">Hochladen</span>
                </button>
                <input id="fileGreenwall" type="file" accept="image/*" class="d-none" />
              </div>

              <small class="text-warning" id="greenwallInfo" data-i18n="lbl.greenwall.no_file">Kein Bild</small>
            </div>
            <!-- /GREENWALL -->

            <button id="btnNew" type="button" class="btn btn-outline-light">
              <i class="bi bi-plus-circle me-1"></i><span data-i18n="btn.new">Neu</span>
            </button>
             <button id="btnactiveTemplate" type="button" class="btn btn-outline-light">
                  <i class="bi bi-plus-circle me-1"></i><span data-i18n="btn.activeTemplate">Aktives Template bearebiten</span>
                </button>
            <button id="btnImport" type="button" class="btn btn-outline-light">
              <i class="bi bi-box-arrow-in-down me-1"></i><span data-i18n="btn.import">Import</span>
            </button>
            <button id="btnSave" type="button" class="btn btn-primary">
              <i class="bi bi-save me-1"></i><span data-i18n="btn.save">Speichern</span>
            </button>
            <button id="btnExport" type="button" class="btn btn-primary">
              <i class="bi bi-file-zip me-1"></i><span data-i18n="btn.exportZip">Export ZIP</span>
            </button>
            <button id="btnTestPrint" type="button" class="btn btn-outline-warning">
              <span id="btnTestPrintSpinner" class="spinner-border spinner-border-sm me-1 d-none" role="status" aria-hidden="true"></span>
              <i id="btnTestPrintIcon" class="bi bi-printer me-1"></i>
              <span data-i18n="btn.testPrint">Test-Druck</span>
            </button>
            <button id="btnSetActiveTemplate" type="button" class="btn btn-outline-success">
              <span id="btnSetActiveSpinner" class="spinner-border spinner-border-sm me-1 d-none" role="status" aria-hidden="true"></span>
              <i id="btnSetActiveIcon" class="bi bi-check-circle me-1"></i>
              <span data-i18n="btn.setActiveTemplate">Als aktives Template</span>
            </button>
          </div>

          <!-- Test-Druck Ergebnis-Toast -->
          <div id="testPrintToast" class="toast align-items-center border-0 position-fixed bottom-0 end-0 m-3" role="alert" aria-live="assertive" aria-atomic="true" style="z-index:9999; min-width:260px;">
            <div class="d-flex">
              <div class="toast-body" id="testPrintToastMsg">
                Druckauftrag gesendet.
              </div>
              <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Schließen"></button>
            </div>
          </div>

          <div class="vr text-secondary"></div>

          <div class="btn-group btn-group-sm"
               role="group"
               aria-label="Elemente hinzufügen"
               data-i18n-aria-label="aria.addItems">
            <button id="btnAddPhoto" type="button" class="btn btn-outline-light">
              <i class="bi bi-plus-square-dotted me-1"></i><span data-i18n="btn.addPhoto">Foto hinzufügen</span>
            </button>
            <button id="btnAddImage" type="button" class="btn btn-outline-light">
              <i class="bi bi-image me-1"></i><span data-i18n="btn.addImage">Bild hinzufügen</span>
            </button>
            <input id="fileAddImage" type="file" accept="image/*" class="d-none" />
          </div>

          <div class="vr text-secondary"></div>
        </div>
      </div>
    </nav>

        <!-- INSPECTOR -->
    <div class="d-flex flex-nowrap align-items-center gap-2">

      <div class="input-group input-group-sm" style="width: 120px;">
        <span class="input-group-text" data-i18n="inspector.x">X</span>
        <input id="inX" type="number" step="1" class="form-control">
      </div>

      <div class="input-group input-group-sm" style="width: 120px;">
        <span class="input-group-text" data-i18n="inspector.y">Y</span>
        <input id="inY" type="number" step="1" class="form-control">
      </div>

      <div class="input-group input-group-sm" style="width: 120px;">
        <span class="input-group-text" data-i18n="inspector.w">W</span>
        <input id="inW" type="number" step="1" class="form-control">
      </div>

      <button id="btnLockAspect" type="button"
              class="btn btn-outline-secondary btn-sm px-1"
              title="Proportionen sperren"
              data-i18n-title="inspector.lock_aspect"
              style="min-width:28px;">
        <i class="bi bi-lock" id="iconLockAspect"></i>
      </button>

      <div class="input-group input-group-sm" style="width: 120px;">
        <span class="input-group-text" data-i18n="inspector.h">H</span>
        <input id="inH" type="number" step="1" class="form-control">
      </div>

      <div class="input-group input-group-sm" style="width: 140px;">
        <span class="input-group-text" data-i18n="inspector.rot">Rot</span>
        <input id="inR" type="number" step="1" class="form-control">
      </div>

      <!-- Align + Guides -->
      <div id="align-guidelines" class="d-flex align-items-center gap-3">

        <div class="btn-group btn-group-sm" role="group" aria-label="Align horizontal" data-i18n-aria-label="aria.align.horizontal">
          <button type="button" class="btn btn-outline-light" id="btnAlignLeft"
                  title="Links ausrichten" data-i18n-title="te.align.left.title">
            <i class="bi bi-align-start"></i>
          </button>
          <button type="button" class="btn btn-outline-light" id="btnAlignCenterH"
                  title="Horizontal zentrieren" data-i18n-title="te.align.center_h.title">
            <i class="bi bi-align-center"></i>
          </button>
          <button type="button" class="btn btn-outline-light" id="btnAlignRight"
                  title="Rechts ausrichten" data-i18n-title="te.align.right.title">
            <i class="bi bi-align-end"></i>
          </button>
        </div>

        <div class="btn-group btn-group-sm" role="group" aria-label="Align vertical" data-i18n-aria-label="aria.align.vertical">
          <button type="button" class="btn btn-outline-light" id="btnAlignTop"
                  title="Oben ausrichten" data-i18n-title="te.align.top.title">
            <i class="bi bi-align-top"></i>
          </button>
          <button type="button" class="btn btn-outline-light" id="btnAlignMiddleV"
                  title="Vertikal zentrieren" data-i18n-title="te.align.middle_v.title">
            <i class="bi bi-align-middle"></i>
          </button>
          <button type="button" class="btn btn-outline-light" id="btnAlignBottom"
                  title="Unten ausrichten" data-i18n-title="te.align.bottom.title">
            <i class="bi bi-align-bottom"></i>
          </button>
        </div>

        <small class="text-secondary" id="teSelHint" data-i18n="hint.noSelection">Kein Objekt selektiert</small>
      </div>
    </div>

        <!-- MAIN -->
    <div class="container-fluid flex-grow-1 overflow-hidden py-3">
      <div class="te-split h-100">

            <!-- LEFT: CANVAS -->
        <div class="te-left h-100">
          <div class="card bg-dark border-secondary h-100">
            <div class="card-body h-100 te-canvas-scroll">
              <div class="te-canvas-frame">
                <canvas id="editorCanvas"></canvas>
              </div>
            </div>
          </div>
        </div>

            <!-- RIGHT: LAYERS -->
        <div class="te-right h-100 rechte_spalte">
          <div class="te-actions">
            <button type="button"
                    class="btn btn-outline-light"
                    id="teZoomOut"
                    title="Rauszoomen"
                    data-i18n-title="zoom.out.title">−</button>

            <span id="teScaleInfo" class="badge bg-secondary">100%</span>

            <button type="button"
                    class="btn btn-outline-light"
                    id="teZoomIn"
                    title="Reinzoomen"
                    data-i18n-title="zoom.in.title">+</button>
          </div>

          <div class="card bg-dark border-secondary h-100">
            <div class="card-header d-flex align-items-center justify-content-between">
              <div>
                <div class="fw-bold" data-i18n="layers.title">Ebenen</div>
                <small class="text-secondary">
                  <span data-i18n="layers.hint.topFront">Top = vorne</span>
                  <span aria-hidden="true"> • </span>
                  <span data-i18n="layers.hint.view">Ansicht:</span>
                  <span id="teScaleInfo">100%</span>
                </small>
              </div>

              <div class="btn-group btn-group-sm">
                <button id="btnBringFwd"
                        type="button"
                        class="btn btn-outline-light"
                        title="Ebene hoch"
                        data-i18n-title="layers.btn.bringFwd.title">
                  <i class="bi bi-arrow-up"></i>
                </button>
                <button id="btnSendBack"
                        type="button"
                        class="btn btn-outline-light"
                        title="Ebene runter"
                        data-i18n-title="layers.btn.sendBack.title">
                  <i class="bi bi-arrow-down"></i>
                </button>
                <button id="btnDelete"
                        type="button"
                        class="btn btn-danger"
                        title="Löschen"
                        data-i18n-title="layers.btn.delete.title">
                  <i class="bi bi-trash"></i>
                </button>
              </div>
            </div>

            <div class="card-body p-0 d-flex flex-column">
              <div class="flex-grow-1 overflow-auto">
                <div id="layersList" class="list-group list-group-flush"></div>
              </div>

              <!-- LAYER SETTINGS -->
              <div class="border-top border-secondary p-2">
                <div class="fw-bold small mb-2" data-i18n="layerSettings.title">Layer Einstellungen</div>

                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="chkRadius">
                  <label class="form-check-label" for="chkRadius" data-i18n="layerSettings.radius.enable">Eckenradius</label>
                </div>
                <div class="input-group input-group-sm mb-3">
                  <span class="input-group-text" data-i18n="layerSettings.radius.px">Radius (px)</span>
                  <input id="inRadiusPx" type="number" step="1" min="0" class="form-control" placeholder="px" data-i18n-placeholder="layerSettings.radius.placeholder">
                </div>

                <div class="form-check form-switch mb-2">
                  <input class="form-check-input" type="checkbox" id="chkBorder">
                  <label class="form-check-label" for="chkBorder" data-i18n="layerSettings.border.enable">Rahmen</label>
                </div>

                <div id="borderAccordionWrap" class="d-none">
                  <div class="accordion accordion-flush" id="borderAccordion">
                    <div class="accordion-item bg-dark text-light border-0">
                      <h2 class="accordion-header" id="headingBorderAdv">
                        <button class="accordion-button collapsed bg-warning text-dark py-2" type="button" data-bs-toggle="collapse" data-bs-target="#collapseBorderAdv" aria-expanded="false" aria-controls="collapseBorderAdv">
                          <span data-i18n="layerSettings.advanced">Erweitert</span>
                        </button>
                      </h2>
                      <div id="collapseBorderAdv" class="accordion-collapse collapse" aria-labelledby="headingBorderAdv" data-bs-parent="#borderAccordion">
                        <div class="accordion-body py-2">
                          <div class="row g-2 align-items-center">
                            <div class="col-6">
                              <label class="form-label small mb-1" for="borderColor" data-i18n="layerSettings.border.color">Farbe</label>
                              <input id="borderColor" type="color" class="form-control form-control-color w-100" value="#000000">
                            </div>
                            <div class="col-6">
                              <label class="form-label small mb-1" for="borderStyle" data-i18n="layerSettings.border.style">Stil</label>
                              <select id="borderStyle" class="form-select form-select-sm">
                                <option value="solid" data-i18n="layerSettings.border.style.solid">Durchgehend</option>
                                <option value="dashed" data-i18n="layerSettings.border.style.dashed">Gestrichelt</option>
                                <option value="dotted" data-i18n="layerSettings.border.style.dotted">Gepunktet</option>
                              </select>
                            </div>
                            <div class="col-12">
                              <label class="form-label small mb-1" for="borderWidth" data-i18n="layerSettings.border.width">Strichstärke</label>
                              <input id="borderWidth" type="number" step="1" min="0" class="form-control form-control-sm" placeholder="px" data-i18n-placeholder="layerSettings.border.width.placeholder">
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div class="form-check form-switch mb-2 mt-2">
                  <input class="form-check-input" type="checkbox" id="chkShadow">
                  <label class="form-check-label" for="chkShadow" data-i18n="layerSettings.shadow.enable">Schatten</label>
                </div>

                <div id="shadowControlsWrap" class="d-none">
                  <div class="row g-2 align-items-center mb-2">
                    <div class="col-6">
                      <label class="form-label small mb-1" for="shadowPreset" data-i18n="layerSettings.shadow.preset">Preset</label>
                      <select id="shadowPreset" class="form-select form-select-sm">
                        <option value="custom" data-i18n="layerSettings.shadow.preset.custom">Benutzerdefiniert</option>
                        <option value="1">1</option>
                        <option value="2">2</option>
                        <option value="3">3</option>
                        <option value="4">4</option>
                      </select>
                    </div>
                    <div class="col-6">
                      <label class="form-label small mb-1" for="shadowColor" data-i18n="layerSettings.shadow.color">Farbe</label>
                      <input id="shadowColor" type="color" class="form-control form-control-color w-100" value="#000000">
                    </div>
                  </div>

                  <div class="accordion accordion-flush" id="shadowAccordion">
                    <div class="accordion-item bg-dark text-light border-0">
                      <h2 class="accordion-header" id="headingShadowAdv">
                        <button class="accordion-button collapsed bg-warning text-dark py-2" type="button" data-bs-toggle="collapse" data-bs-target="#collapseShadowAdv" aria-expanded="false" aria-controls="collapseShadowAdv">
                          <span data-i18n="layerSettings.advanced">Erweitert</span>
                        </button>
                      </h2>

                      <div id="collapseShadowAdv" class="accordion-collapse collapse" aria-labelledby="headingShadowAdv" data-bs-parent="#shadowAccordion">
                        <div class="accordion-body py-2">

                          <div class="mb-2">
                            <label class="form-label small mb-1" for="shadowOffsetX" data-i18n="layerSettings.shadow.offsetX">Horizontal</label>
                            <div class="row g-2 align-items-center">
                              <div class="col">
                                <input id="shadowOffsetX" type="range" min="-200" max="200" step="1" class="form-range">
                              </div>
                              <div class="col-auto" style="width: 96px;">
                                <div class="input-group input-group-sm">
                                  <input id="shadowOffsetXNum" type="number" min="-200" max="200" step="1" class="form-control">
                                  <span class="input-group-text">px</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div class="mb-2">
                            <label class="form-label small mb-1" for="shadowOffsetY" data-i18n="layerSettings.shadow.offsetY">Vertikal</label>
                            <div class="row g-2 align-items-center">
                              <div class="col">
                                <input id="shadowOffsetY" type="range" min="-200" max="200" step="1" class="form-range">
                              </div>
                              <div class="col-auto" style="width: 96px;">
                                <div class="input-group input-group-sm">
                                  <input id="shadowOffsetYNum" type="number" min="-200" max="200" step="1" class="form-control">
                                  <span class="input-group-text">px</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div class="mb-2">
                            <label class="form-label small mb-1" for="shadowBlur" data-i18n="layerSettings.shadow.blur">Unschärfe</label>
                            <div class="row g-2 align-items-center">
                              <div class="col">
                                <input id="shadowBlur" type="range" min="0" max="200" step="1" class="form-range">
                              </div>
                              <div class="col-auto" style="width: 96px;">
                                <div class="input-group input-group-sm">
                                  <input id="shadowBlurNum" type="number" min="0" max="200" step="1" class="form-control">
                                  <span class="input-group-text">px</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          <div class="mb-2">
                            <label class="form-label small mb-1" for="shadowSpread" data-i18n="layerSettings.shadow.spread">Ausdehnung</label>
                            <div class="row g-2 align-items-center">
                              <div class="col">
                                <input id="shadowSpread" type="range" min="0" max="200" step="1" class="form-range">
                              </div>
                              <div class="col-auto" style="width: 96px;">
                                <div class="input-group input-group-sm">
                                  <input id="shadowSpreadNum" type="number" min="0" max="200" step="1" class="form-control">
                                  <span class="input-group-text">px</span>
                                </div>
                              </div>
                            </div>
                          </div>

                        </div>
                      </div>

                    </div>
                  </div>
                </div>

              </div>
              <!-- /LAYER SETTINGS -->
            </div>
          </div>
        </div>

      </div>
    </div>

        <!-- BOOTSTRAP TOAST -->
    <div class="toast-container position-fixed bottom-0 start-50 translate-middle-x p-3">
      <div id="teToast" class="toast text-bg-dark border-0" role="alert" aria-live="assertive" aria-atomic="true">
        <div class="d-flex">
          <div id="teToastBody" class="toast-body">—</div>
          <button type="button"
                  class="btn-close btn-close-white me-2 m-auto"
                  data-bs-dismiss="toast"
                  aria-label="Schließen"
                  data-i18n-aria-label="toast.close"></button>
        </div>
      </div>
    </div>

        <!-- START WIZARD MODAL -->
    <div class="modal fade" id="teModal" tabindex="-1" aria-hidden="true" data-bs-backdrop="static" data-bs-keyboard="false">
      <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark text-light border-secondary">
          <div class="modal-header border-secondary">
            <h5 class="modal-title fw-bold" data-i18n="modal.start.title">Template starten</h5>

            <button type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="Schließen"
                    data-i18n-aria-label="modal.close"></button>
          </div>

          <div class="modal-body">
            <ul class="nav nav-tabs" id="teTabs" role="tablist">
              <li class="nav-item" role="presentation">
                <button class="nav-link active" data-tab="new" type="button" data-i18n="tab.new">Neu</button>
              </li>
              <li class="nav-item" role="presentation">
                    <button class="nav-link" data-tab="activetemplate" type="button" data-i18n="tab.activeTemplate">Aktives Template</button>
              </li>
              <li class="nav-item" role="presentation">
                <button class="nav-link" data-tab="import" type="button" data-i18n="tab.importZip">Bestehend (ZIP)</button>
              </li>
              <li class="nav-item" role="presentation">
                <button class="nav-link" data-tab="projects" type="button" data-i18n="tab.projects">Projekt aktivieren</button>
              </li>
            </ul>

            <div class="pt-3">
              <!-- NEW -->
              <div class="te-tabpanel" data-panel="new">
                <div class="mb-3">
                  <label class="form-label text-secondary" data-i18n="new.name.label">Template-Name</label>
                  <input id="newName"
                         type="text"
                         class="form-control"
                         placeholder="z.B. event_2026"
                         data-i18n-placeholder="new.name.placeholder" />
                  <div class="form-text text-secondary" data-i18n="new.name.help">Erlaubt: a-z, 0-9, _ und -</div>
                </div>

                <div class="mb-3">
                  <label class="form-label text-secondary" data-i18n="new.sizePreset.label">Größe (Preset)</label>
                  <select id="presetSize" class="form-select">
                    <option value="1800x1200" selected data-i18n="preset.1800x1200">1800 x 1200 (4x6&quot; landscape)</option>
                    <option value="1200x1800" data-i18n="preset.1200x1800">1200 x 1800 (4x6&quot; portrait)</option>
                    <option value="2400x3600" data-i18n="preset.2400x3600">2400 x 3600 (8x12&quot; portrait)</option>
                    <option value="custom" data-i18n="preset.custom">Custom…</option>
                  </select>
                </div>

                <div class="row g-2">
                  <div class="col-md-6">
                    <label class="form-label text-secondary" data-i18n="new.width.label">Breite (px)</label>
                    <input id="newW" type="number" step="1" value="1800" class="form-control" />
                  </div>
                  <div class="col-md-6">
                    <label class="form-label text-secondary" data-i18n="new.height.label">Höhe (px)</label>
                    <input id="newH" type="number" step="1" value="1200" class="form-control" />
                  </div>
                </div>

                <div class="d-flex justify-content-end mt-3">
                  <button id="btnCreateNew" type="button" class="btn btn-primary">
                    <i class="bi bi-play-fill me-1"></i><span data-i18n="btn.startEditor">Editor starten</span>
                  </button>
                </div>
              </div>

              <!-- Active Template -->
    <div class="te-tabpanel d-none" data-panel="activetemplate">
      <div class="d-flex justify-content-end mt-3">
        <button id="btnLoadActiveTemplate" type="button" class="btn btn-primary">
          <i class="bi bi-play-fill me-1"></i>
          <span data-i18n="btn.startEditor">Editor starten</span>
        </button>
      </div>
    </div>

              <!-- IMPORT -->
              <div class="te-tabpanel d-none" data-panel="import">
                <div class="border border-secondary rounded-3 p-3 bg-black bg-opacity-25">
                  <div class="text-secondary mb-2" data-i18n-html="import.hint">
                    ZIP auswählen (enthält <code>template.xml</code> + Bilder/Assets)
                  </div>
                  <input id="fileImportZip" type="file" accept=".zip" class="form-control" />
                </div>

                <div class="d-flex justify-content-end mt-3">
                  <button id="btnDoImport" type="button" class="btn btn-primary">
                    <i class="bi bi-box-arrow-in-down me-1"></i><span data-i18n="btn.importDo">Importieren</span>
                  </button>
                </div>
              </div>

              <!-- PROJECTS -->
              <div class="te-tabpanel d-none" data-panel="projects">
                <div class="mt-3">
                  <label class="form-label" data-i18n="projects.select.label">Projekt auswählen</label>

                  <select id="teProjectSelect" class="form-select">
                    <option value="" data-i18n="projects.select.loading">– Lade Projekte –</option>
                  </select>

                  <div id="teProjectHint" class="form-text text-secondary" data-i18n="projects.hint.default"></div>

                  <div class="mt-2 d-flex gap-2">
                    <button type="button"
                            class="btn btn-outline-light"
                            id="teBtnRefreshProjects"
                            data-i18n="btn.refresh">Aktualisieren</button>

                    <button type="button"
                            class="btn btn-primary"
                            id="teBtnOpenProject"
                            disabled
                            data-i18n="btn.activateProject">Projekt aktivieren</button>
                  </div>
                </div>
              </div>

            </div>

            <div class="text-secondary small mt-3" data-i18n-html="wizard.tip">
              Tipp: Save/Export schreibt in <code>booth/templates/&lt;name&gt;</code>.
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>

    <!-- SCRIPTS -->
  <script src="../src/js/jquery-3.7.1.min.js"></script>
  <script src="../src/js/bootstrap.bundle.min.js"></script>
  <script src="js/fabric.min.js"></script>

  <!-- Fabric guideline extensions (always enabled) -->
  <script src="js/ext/centering_guidelines.js?v=20261127"></script>
  <script src="js/ext/aligning_guidelines.js?v=20261127"></script>


  <script src="js/te_functions_core.js?v=20261127"></script>
  <script src="js/te_functions_style.js?v=20261127"></script>
  <script src="js/te_functions_view_editor.js?v=20261127"></script>
  <script src="js/te_functions_layers_objects.js?v=20261127"></script>
  <script src="js/te_functions_io.js?v=20261127"></script>
  <script src="js/te_functions_extras.js?v=20261127"></script>

  <script src="js/te_panzoom.js?v=20261127"></script>
  <script src="js/te_style_inspector.js?v=20261127"></script>
  <script src="js/te_layers_ui.js?v=20261127"></script>
  <script src="js/te_app_core.js?v=20261127"></script>

  <!-- Align buttons + init guidelines -->
  <script src="js/te_align_ui.js?v=20261127"></script>
</body>
</html>
