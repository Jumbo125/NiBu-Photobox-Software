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
