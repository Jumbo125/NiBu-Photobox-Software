<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
?>

<form id="formThirdSoftwareSettings" class="small" data-json-file="config/config.json">

  <h6 class="text-uppercase mt-3" data-lang-key="overlay.settings.app.python.title">
    <?= t('overlay.settings.app.python.title', 'Python Environment') ?>
  </h6>

  <div class="mb-3">
    <label for="settingPythonPath" class="form-label" data-lang-key="overlay.settings.app.python.path">
      <?= t('overlay.settings.app.python.path', 'Python Executable Path') ?>
    </label>

    <div class="input-group input-group-sm">
      <input
        type="text"
        id="settingPythonPath"
        class="form-control"
        placeholder="<?= t('overlay.settings.app.python.placeholder', 'e.g. C:\photo-software\tools\python_portable\python.exe') ?>"
        data-json-group="python"
        data-json-parm="Path"
        data-default-value="C:\Users\andre\Desktop\photo-software\booth\tools\python_portable\python.exe"
      >

      <button
        type="button"
        class="btn pb-pick-file btn-outline-warning"
        data-target="#settingPythonPath"
        data-initial="C:\Photobox\booth\tools\python_portable\"
        data-title="<?= t('overlay.settings.app.python.pickfile_title', 'Select python.exe') ?>"
        data-filter="<?= t('overlay.settings.app.python.filter', 'Executable (*.exe)|*.exe|All files (*.*)|*.*') ?>"
      >
        <span data-lang-key="form.pick_file"><?= t('form.pick_file', 'Pick file') ?></span>
      </button>
    </div>
  </div>

  <hr class="border-secondary">

  <h6 class="text-uppercase mt-3" data-lang-key="overlay.settings.app.pickfile_render_app.title">
    <?= t('overlay.settings.app.pickfile_render_app.title', 'Render App (create Image)') ?>
  </h6>

  <h6 class="text-uppercase mt-3" data-lang-key="overlay.settings.app.pickfile_python_server.title">
    <?= t('overlay.settings.app.pickfile_python_server.title', 'Python Server') ?>
  </h6>

  <div class="mb-3">
    <div class="input-group input-group-sm">
      <input
        type="text"
        id="settingFilepickerServerPy"
        class="form-control"
        placeholder="<?= t('overlay.settings.app.pickfile_python_server.placeholder', 'e.g. C:\Photobooth\booth\tools\python_portable\python_server.py') ?>"
        data-json-group="app"
        data-json-parm="python_server"
        data-default-value="C:\Photobooth\booth\tools\python_portable\python_server.py"
      >

      <button
        type="button"
        class="btn btn-outline-warning pb-pick-file"
        data-target="#settingFilepickerServerPy"
        data-initial="C:\Photobox\booth\tools\python_portable\"
        data-title="<?= t('overlay.settings.app.pickfile_python_server.pickfile_title', 'Select python_server.py') ?>"
        data-filter="<?= t('overlay.settings.app.pickfile_python_server.filter', 'Python (*.py)|*.py|All files (*.*)|*.*') ?>"
      >
        <span data-lang-key="form.pick_file"><?= t('form.pick_file', 'Pick file') ?></span>
      </button>
    </div>
  </div>

</form>
