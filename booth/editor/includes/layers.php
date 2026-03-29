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
