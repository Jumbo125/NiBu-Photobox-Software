<?php
# SPDX-License-Identifier: Apache-2.0
# Copyright (c) 2026 Andreas Rottmann
?>

<form id="formCameraBridgeApiServerSettings" class="small"
      data-json-file="../tools/camerabridge/APIServer/ApiServer_settings.json">

  <h5 class="mt-2 mb-3 text-center text-warning" data-lang-key="overlay.camerabridge_settings.apiserver.section">
    <?= t('overlay.camerabridge_settings.apiserver.section', 'API Server') ?>
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
            <?= t('overlay.camerabridge_settings.apiserver.exepath.label', 'API Server EXE path') ?>
          </span>
        </button>
      </h2>

      <div id="collapseApiExe" class="accordion-collapse collapse"
           aria-labelledby="headingApiExe"
           data-bs-parent="#accordionApiServerSettings">
        <div class="accordion-body bg-dark text-warning">

          <div class="mb-3">
            <label for="settingCameraAPIServerPath" class="form-label" data-lang-key="overlay.settings.app.pickfile_bridge_app.path">
              <?= t('overlay.settings.app.pickfile_bridge_app.path', 'Path to camera control (Photobox.Bridge.ApiServer.exe)') ?>
            </label>

            <div class="input-group input-group-sm">
              <input type="text"
                     id="settingCameraAPIServerPath"
                     class="form-control"
                     placeholder="<?= t('overlay.settings.app.pickfile_bridge_app.placeholder', 'e.g. C:\Photobox\tools\camerabridge\APIServer\Photobox.Bridge.ApiServer.exe') ?>"
                     data-json-group="Server"
                     data-json-parm="ExePath"
                     data-default-value="C:\Photobox\tools\camerabridge\APIServer\Photobox.Bridge.ApiServer.exe ">

              <button type="button"
                      class="btn btn-outline-warning pb-pick-file"
                      data-target="#settingCameraAPIServerPath"
                      data-initial="tools/camerabridge/"
                      data-title="<?= t('overlay.settings.app.pickfile_bridge_app.title', 'Select Photobox.Bridge.ApiServer.exe') ?>"
                      data-filter="<?= t('overlay.settings.app.pickfile_bridge_app.filter', 'Executable (*.exe)|*.exe|All files (*.*)|*.*') ?>">
                <span data-lang-key="form.pick_file"><?= t('form.pick_file', 'Pick file') ?></span>
              </button>
            </div>
          </div>

          <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="headlessCameraBridge_server" checked
                   data-json-group="Server"
                   data-json-parm="camerabridge_server_headless"
                   data-default-value="true">
            <label class="form-check-label" for="headlessCameraBridge_server" data-lang-key="overlay.settings.camera_server.headless">
              <?= t('overlay.settings.camera_server.headless', 'Start CameraBridge-API-SERVER Headless') ?>
            </label>
          </div>

          <div class="form-check form-switch mb-3">
            <input class="form-check-input" type="checkbox" id="one_instanceCameraBridge_server" checked
                   data-json-group="Server"
                   data-json-parm="camerabridge_server_one_instance"
                   data-default-value="true">
            <label class="form-check-label" for="one_instanceCameraBridge_server" data-lang-key="overlay.settings.camera_server.oneinstance">
              <?= t('overlay.settings.camera_server.oneinstance', 'Enable only one CameraBridge-API-SERVER at the same time (*recommend)') ?>
            </label>
          </div>

          <div class="alert alert-warning">
            <?= t(
              'overlay.settings.camera.control_cmd.note',
              'Normally, only set the EXE path here. The app will add/update CLI parameters automatically based on your settings. Add manual parameters only if you know what you are doing.'
            ) ?>
          </div>

          <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.apiserver.exepath.hint">
            <?= t('overlay.camerabridge_settings.apiserver.exepath.hint', 'Absolute path to the API server executable (required).') ?>
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
            <?= t('overlay.camerabridge_settings.bridge.section', 'API-SERVER Config') ?>
          </span>
        </button>
      </h2>

      <div id="collapseBridge" class="accordion-collapse collapse"
           aria-labelledby="headingBridge"
           data-bs-parent="#accordionApiServerSettings">
        <div class="accordion-body bg-dark text-warning">

          <div class="mb-3">
            <label for="pbBridgeBindAddress" class="form-label" data-lang-key="overlay.camerabridge_settings.bind_address.label">
              <?= t('overlay.camerabridge_settings.bind_address.label', 'Bind address') ?>
            </label>

            <input type="text"
                   id="pbBridgeBindAddress"
                   class="form-control"
                   placeholder="127.0.0.1"
                   data-json-parm="Bridge.BindAddress"
                   data-default-value="127.0.0.1" />

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.bind_address.hint">
              <?= t('overlay.camerabridge_settings.bind_address.hint', 'IP to listen on. Use 127.0.0.1 for local-only access, or 0.0.0.0 / + for LAN access (firewall required).') ?>
            </div>

            <div class="alert alert-warning small mt-2 bg-dark text-warning border border-warning" role="alert">
              <strong data-lang-key="overlay.camerabridge_settings.bind_address.alert.title">
                <?= t('overlay.camerabridge_settings.bind_address.alert.title', 'Bind address hint') ?>
              </strong>

              <div class="mt-1" data-lang-key="overlay.camerabridge_settings.bind_address.alert.text">
                <?= t('overlay.camerabridge_settings.bind_address.alert.text', 'Defines on which network interface the HTTP server listens:') ?>
              </div>

              <ul class="mb-0">
                <li data-lang-key="overlay.camerabridge_settings.bind_address.alert.local">
                  <?= t('overlay.camerabridge_settings.bind_address.alert.local', '127.0.0.1 = local only (no LAN/WiFi access).') ?>
                </li>
                <li data-lang-key="overlay.camerabridge_settings.bind_address.alert.all">
                  <?= t('overlay.camerabridge_settings.bind_address.alert.all', '+ / 0.0.0.0 = all interfaces (LAN/WiFi/Hotspot), e.g. for tablet/phone.') ?>
                </li>
              </ul>

              <hr class="my-2">

              <small data-lang-key="overlay.camerabridge_settings.bind_address.alert.firewall">
                <?= t('overlay.camerabridge_settings.bind_address.alert.firewall', 'Important: For LAN binding, Windows Firewall must allow the port (e.g. 8052).') ?>
              </small>
            </div>
          </div>

          <div class="mb-3">
            <label for="pbBridgeHttpPort" class="form-label" data-lang-key="overlay.camerabridge_settings.http_port.label">
              <?= t('overlay.camerabridge_settings.http_port.label', 'HTTP port') ?>
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
              <?= t('overlay.camerabridge_settings.http_port.hint', 'Local API port for the API server (default: 8052).') ?>
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
            <?= t('overlay.camerabridge_settings.mjpeg.section', 'MJPEG endpoint') ?>
          </span>
        </button>
      </h2>

      <div id="collapseMjpeg" class="accordion-collapse collapse"
           aria-labelledby="headingMjpeg"
           data-bs-parent="#accordionApiServerSettings">
        <div class="accordion-body bg-dark text-warning">

          <div class="mb-3">
            <label for="pbBridgeMjpegPath" class="form-label" data-lang-key="overlay.camerabridge_settings.mjpeg_path.label">
              <?= t('overlay.camerabridge_settings.mjpeg_path.label', 'MJPEG path') ?>
            </label>

            <input type="text"
                   id="pbBridgeMjpegPath"
                   class="form-control"
                   placeholder="/live.mjpg"
                   data-json-parm="Bridge.MjpegPath"
                   data-default-value="/live.mjpg" />

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.mjpeg_path.hint">
              <?= t('overlay.camerabridge_settings.mjpeg_path.hint', 'HTTP path for the MJPEG stream used by the preview element.') ?>
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
            <?= t('overlay.camerabridge_settings.api.section', 'API key') ?>
          </span>
        </button>
      </h2>

      <div id="collapseApiKey" class="accordion-collapse collapse"
           aria-labelledby="headingApiKey"
           data-bs-parent="#accordionApiServerSettings">
        <div class="accordion-body bg-dark text-warning">

          <div class="mb-3">
            <label for="pbBridgeApiKey" class="form-label" data-lang-key="overlay.camerabridge_settings.api_key.label">
              <?= t('overlay.camerabridge_settings.api_key.label', 'API key') ?>
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
                <?= t('overlay.camerabridge_settings.api_key.generate', 'Generate') ?>
              </button>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.api_key.hint">
              <?= t('overlay.camerabridge_settings.api_key.hint', 'Required for /api/* endpoints (sent as X-Api-Key). MJPEG stream remains unprotected. Leave empty to disable authentication.') ?>
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
            <?= t('overlay.camerabridge_settings.health.section', 'Health') ?>
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
                <?= t('overlay.camerabridge_settings.health.interval.label', 'Interval (ms)') ?>
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
                <?= t('overlay.camerabridge_settings.health.interval.hint', 'How often the watchdog/health check runs.') ?>
              </div>
            </div>

            <div class="col-md-6">
              <label for="pbBridgeHealthTimeoutMs" class="form-label" data-lang-key="overlay.camerabridge_settings.health.timeout.label">
                <?= t('overlay.camerabridge_settings.health.timeout.label', 'Timeout (ms)') ?>
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
                <?= t('overlay.camerabridge_settings.health.timeout.hint', 'How long to wait before a health check is considered failed.') ?>
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
            <?= t('overlay.camerabridge_settings.logging.section', 'Logging') ?>
          </span>
        </button>
      </h2>

      <div id="collapseLogging" class="accordion-collapse collapse"
           aria-labelledby="headingLogging"
           data-bs-parent="#accordionApiServerSettings">
        <div class="accordion-body bg-dark text-warning">

          <div class="mb-3">
            <label for="pbBridgeLogFile" class="form-label" data-lang-key="overlay.camerabridge_settings.logging.logfile.label">
              <?= t('overlay.camerabridge_settings.logging.logfile.label', 'Log file') ?>
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
                      data-title="<?= t('overlay.camerabridge_settings.logging.logfile.pick_title', 'Select log file') ?>"
                      data-filter="<?= t('overlay.camerabridge_settings.logging.logfile.filter', 'Text (*.txt)|*.txt|All files (*.*)|*.*') ?>">
                <span data-lang-key="form.pick_file"><?= t('form.pick_file', 'Pick file') ?></span>
              </button>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.logging.logfile.hint">
              <?= t('overlay.camerabridge_settings.logging.logfile.hint', 'Relative or absolute path to the API server log file.') ?>
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
            <?= t('overlay.camerabridge_settings.worker.section', 'Worker process') ?>
          </span>
        </button>
      </h2>

      <div id="collapseWorker" class="accordion-collapse collapse"
           aria-labelledby="headingWorker"
           data-bs-parent="#accordionApiServerSettings">
        <div class="accordion-body bg-dark text-warning">

          <div class="mb-3">
            <label for="pbBridgeWorkerExePath" class="form-label" data-lang-key="overlay.camerabridge_settings.worker.exepath.label">
              <?= t('overlay.camerabridge_settings.worker.exepath.label', 'Worker EXE path') ?>
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
                      data-title="<?= t('overlay.camerabridge_settings.worker.exepath.pick_title', 'Select CameraWorker.exe') ?>"
                      data-filter="<?= t('overlay.camerabridge_settings.worker.exepath.filter', 'Executable (*.exe)|*.exe|All files (*.*)|*.*') ?>">
                <span data-lang-key="form.pick_file"><?= t('form.pick_file', 'Pick file') ?></span>
              </button>
            </div>

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.worker.exepath.hint">
              <?= t('overlay.camerabridge_settings.worker.exepath.hint', 'Absolute path to CameraWorker.exe (required).') ?>
            </div>
          </div>

          <div class="mb-3">
            <label for="pbBridgeWorkerArgs" class="form-label" data-lang-key="overlay.camerabridge_settings.worker.args.label">
              <?= t('overlay.camerabridge_settings.worker.args.label', 'Worker arguments') ?>
            </label>

            <input type="text"
                   id="pbBridgeWorkerArgs"
                   class="form-control"
                   placeholder=""
                   data-json-parm="Worker.Args"
                   data-default-value="" />

            <div class="form-text text-secondary mt-2" data-lang-key="overlay.camerabridge_settings.worker.args.hint">
              <?= t('overlay.camerabridge_settings.worker.args.hint', 'Optional command line args passed to the worker.') ?>
            </div>

            <div class="alert alert-warning mt-3 mb-0 py-2 px-3 small bg-dark text-warning border border-warning">
              <div class="d-flex align-items-start justify-content-between gap-3">
                <div class="flex-grow-1">
                  <div class="fw-semibold" data-lang-key="overlay.camerabridge_settings.worker.args.warn.title">
                    <?= t('overlay.camerabridge_settings.worker.args.warn.title', '⚠ Be careful with worker args') ?>
                  </div>

                  <div class="mt-1" data-lang-key="overlay.camerabridge_settings.worker.args.warn.text">
                    <?= t('overlay.camerabridge_settings.worker.args.warn.text', 'Wrong arguments can prevent the CameraBridge worker from starting. Unknown args are ignored.') ?>
                  </div>

                  <a class="d-inline-block mt-2 link-warning"
                     data-bs-toggle="collapse"
                     href="#pbBridgeWorkerArgsHelp"
                     role="button"
                     aria-expanded="false"
                     aria-controls="pbBridgeWorkerArgsHelp"
                     data-lang-key="overlay.camerabridge_settings.worker.args.warn.toggle">
                    <?= t('overlay.camerabridge_settings.worker.args.warn.toggle', 'Show supported arguments') ?>
                  </a>

                  <div class="collapse mt-2" id="pbBridgeWorkerArgsHelp">
                    <div class="border border-warning rounded p-2">
                      <div class="fw-semibold mb-1" data-lang-key="overlay.camerabridge_settings.worker.args.supported.title">
                        <?= t('overlay.camerabridge_settings.worker.args.supported.title', 'Supported CLI flags') ?>
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
                        <?= t('overlay.camerabridge_settings.worker.args.examples.title', 'Examples') ?>
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
                        title="<?= t('overlay.camerabridge_settings.worker.args.help.toggle_title', 'Toggle help') ?>">
                  ?
                </button>
              </div>
            </div>
          </div>

          <div class="mb-3">
            <label for="pbBridgeWorkerLogFile"
                   class="form-label"
                   data-lang-key="overlay.camerabridge_settings.worker.logging.logfile.label">
              <?= t('overlay.camerabridge_settings.worker.logging.logfile.label', 'Worker log file') ?>
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
                      data-title="<?= t('overlay.camerabridge_settings.worker.logging.logfile.pick_title', 'Select worker log file') ?>"
                      data-filter="<?= t('overlay.camerabridge_settings.worker.logging.logfile.filter', 'Log (*.log)|*.log|Text (*.txt)|*.txt|All files (*.*)|*.*') ?>">
                <span data-lang-key="form.pick_file"><?= t('form.pick_file', 'Pick file') ?></span>
              </button>
            </div>

            <div class="form-text text-secondary mt-2"
                 data-lang-key="overlay.camerabridge_settings.worker.logging.logfile.hint">
              <?= t('overlay.camerabridge_settings.worker.logging.logfile.hint', 'Optional. If set, the UI will append <code>--log=&lt;path&gt;</code> to the worker arguments when saving.') ?>
            </div>
          </div>

          <div class="row g-2">
            <div class="col-md-6">
              <div class="form-check mt-2">
                <input class="form-check-input" type="checkbox" id="pbBridgeWorkerAutoStartOnBoot"
                       data-json-parm="Worker.AutoStartOnBoot" data-default-value="true" />
                <label class="form-check-label" for="pbBridgeWorkerAutoStartOnBoot"
                       data-lang-key="overlay.camerabridge_settings.worker.autostart_boot.label">
                  <?= t('overlay.camerabridge_settings.worker.autostart_boot.label', 'Auto start on boot') ?>
                </label>
              </div>
            </div>

            <div class="col-md-6">
              <div class="form-check mt-2">
                <input class="form-check-input" type="checkbox" id="pbBridgeWorkerAutoStartWhenUnreachable"
                       data-json-parm="Worker.AutoStartWhenUnreachable" data-default-value="true" />
                <label class="form-check-label" for="pbBridgeWorkerAutoStartWhenUnreachable"
                       data-lang-key="overlay.camerabridge_settings.worker.autostart_unreachable.label">
                  <?= t('overlay.camerabridge_settings.worker.autostart_unreachable.label', 'Auto start when unreachable') ?>
                </label>
              </div>
            </div>
          </div>

          <div class="row g-2 mt-2">
            <div class="col-md-6">
              <label for="pbBridgeWorkerStartCooldownMs" class="form-label"
                     data-lang-key="overlay.camerabridge_settings.worker.cooldown.label">
                <?= t('overlay.camerabridge_settings.worker.cooldown.label', 'Start cooldown (ms)') ?>
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
                <?= t('overlay.camerabridge_settings.worker.failthreshold.label', 'Fail threshold') ?>
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
            <?= t('overlay.camerabridge_settings.worker.note', 'These options control how the API server supervises and restarts the worker process.') ?>
          </div>

        </div>
      </div>
    </div>

  </div>

  <hr class="border-secondary my-3">
</form>
