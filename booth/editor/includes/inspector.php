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