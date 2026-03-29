<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
?>

<form id="formThirdSoftware_ServerSettings" class="small" data-json-file="../tools/python_portable/server_config.json">

  <!-- Caddy Webroot -->
  <div class="mb-3">
    <label for="settingCaddyWebRoot" class="form-label" data-lang-key="overlay.settings.app.python.caddyWebRoot.path">
      <?= t(
        'overlay.settings.app.python.caddyWebRoot.path',
        'Caddy webroot path (important for some Python API endpoints, e.g. uploads).'
      ) ?>
    </label>

    <div class="input-group input-group-sm">
      <input type="text"
             id="settingCaddyWebRoot"
             class="form-control"
             placeholder="<?= t('overlay.settings.app.python.caddyWebRoot.placeholder', 'e.g. C:\\photo-software\\booth\\') ?>"
             data-json-group=""
             data-json-parm="caddyWebroot"
             data-default-value="C:\photo-software\booth\">

      <button type="button"
              class="btn btn-outline-warning pb-pick-folder"
              data-target="#settingCaddyWebRoot"
              data-title="<?= t('overlay.settings.app.python.caddyWebRoot.folder', 'Select Caddy webroot folder') ?>">
        <span data-lang-key="form.pick_folder">
          <?= t('form.pick_folder', 'Pick folder') ?>
        </span>
      </button>
    </div>
  </div>

  <!-- Python Server-Port -->
  <div class="mb-3">
    <label for="settingPythonPort" class="form-label" data-lang-key="overlay.settings.app.python.port">
      <?= t('overlay.settings.app.python.port', 'Python Port') ?>
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
      <?= t('overlay.settings.app.python.api_key.label', 'Python API key') ?>
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
          <?= t('overlay.settings.app.python.api_key.generate', 'Generate') ?>
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
        <?= t('overlay.settings.app.python.server_controls.start', 'Start') ?>
      </span>
    </button>

    <button type="button" class="btn btn-sm btn-outline-warning" id="btnPythonRestart">
      <span data-lang-key="overlay.settings.app.python.server_controls.restart">
        <?= t('overlay.settings.app.python.server_controls.restart', 'Restart') ?>
      </span>
    </button>

    <button type="button" class="btn btn-sm btn-outline-danger" id="btnPythonStop">
      <span data-lang-key="overlay.settings.app.python.server_controls.stop">
        <?= t('overlay.settings.app.python.server_controls.stop', 'Stop') ?>
      </span>
    </button>

    <button type="button" class="btn btn-sm btn-outline-secondary ms-auto" id="btnPythonRefresh">
      <span data-lang-key="overlay.settings.app.python.server_controls.refresh">
        <?= t('overlay.settings.app.python.server_controls.refresh', 'Refresh') ?>
      </span>
    </button>
  </div>

  <div class="progress mt-2" style="height: 18px;">
    <div class="progress-bar" id="pythonServerBar" role="progressbar" style="width: 0%;">
      <span data-lang-key="common.unknown">
        <?= t('common.unknown', 'unknown') ?>
      </span>
    </div>
  </div>

  <div class="small mt-2 text-muted"
       id="pythonServerInfo"
       data-lang-key="overlay.settings.app.python.server_controls.status_unknown">
    <?= t('overlay.settings.app.python.server_controls.status_unknown', 'Status: unknown') ?>
  </div>

  <div class="small mt-1" id="pythonServerMsg"></div>
</div>
