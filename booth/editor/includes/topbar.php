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
