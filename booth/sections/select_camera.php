<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

// sections/select_device.php
?>
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
                    <?= t('overlay.select_device.title', 'Select Device') ?>
                </h5>

                &nbsp;
                <i class="bi bi-gear fs-3"
                   data-bs-toggle="tooltip"
                   data-bs-trigger="hover click"
                   data-bs-placement="top"
                   title="<?= t('overlay.select_device.config_tooltip', 'config/config.json') ?>"></i>

                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="<?= t('form.close', 'Close') ?>"></button>
            </div>

            <div class="modal-body">
                <p class="text-secondary small mb-3" data-lang-key="overlay.select_device.description">
                    <?= t('overlay.select_device.description', 'Choose the device used for live preview and capture. Optionally use a webcam instead.') ?>
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
                                <?= t('overlay.select_device.only_cameras.label', 'Show cameras only') ?>
                            </label>
                        </div>

                        <div class="form-text text-secondary" data-lang-key="overlay.select_device.only_cameras.help">
                            <?= t('overlay.select_device.only_cameras.help', 'Filters the device list (UI only, not saved to config).') ?>
                        </div>
                    </div>

                    <div class="mb-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <label
                                for="settingDeviceSelected"
                                class="form-label mb-0"
                                data-lang-key="overlay.select_device.device.label">
                                <?= t('overlay.select_device.device.label', 'Device') ?>
                            </label>

                            <button
                                type="button"
                                class="btn btn-sm btn-outline-light"
                                id="btnDeviceRefresh"
                                title="<?= t('overlay.select_device.refresh', 'Load devices') ?>"
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
                                <?= t('overlay.select_device.no_devices', 'No devices found.') ?>
                            </option>
                        </select>

                        <div
                            id="settingDeviceSelectedHelp"
                            class="form-text text-secondary"
                            data-lang-key="overlay.select_device.device.help">
                            <?= t('overlay.select_device.device.help', 'This device will be used for both preview and capture (stream + capture are the same).') ?>
                        </div>
                    </div>

                    <div id="hintCameraBridgeOffline" class="alert alert-danger py-2 mt-2 d-none" role="alert">
                        <div class="device-error-msg device-error-offline d-none"
                             data-lang-key="overlay.select_device.error.camerabridge_offline">
                            <?= t(
                                'overlay.select_device.error.camerabridge_offline',
                                'No connection to CameraBridge. Please start CameraBridge.exe (Default: 127.0.0.1:8052).'
                            ) ?>
                        </div>

                        <div class="device-error-msg device-error-http d-none"
                             data-lang-key="overlay.select_device.error.camera_api_http">
                            <?= t('overlay.select_device.error.camera_api_http', 'Load list failed.') ?>
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
                        <?= t('overlay.select_device.refresh', 'Load devices') ?>
                    </span>
                </button>

                <button
                    type="button"
                    class="btn btn-primary btn-sm pb-save-config"
                    id="btnSaveSelectDevice"
                    data-form-id="formSelectDevice">
                    <span data-lang-key="overlay.select_device.save">
                        <?= t('overlay.select_device.save', 'Save') ?>
                    </span>
                </button>

                <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    data-bs-dismiss="modal">
                    <span data-lang-key="form.close">
                        <?= t('form.close', 'Close') ?>
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>
