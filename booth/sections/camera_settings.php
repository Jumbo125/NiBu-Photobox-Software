<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann

// sections/camera_settings.php
// UI liest/schreibt Werte dynamisch über data-json-* in config/camera_config.json.
?>
<div
    class="modal fade"
    id="modalCameraSettings"
    tabindex="-1"
    aria-labelledby="modalCameraSettingsLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalCameraSettingsLabel"
                    data-lang-key="overlay.camera_settings.title">
                    <?= t('overlay.camera_settings.title', 'Camera Settings') ?>
                </h5>

                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="<?= t('form.close', 'Close') ?>"></button>
            </div>

            <div class="modal-body">
                <p
                    class="small text-secondary mb-3"
                    data-lang-key="overlay.camera_settings.description">
                    <?= t('overlay.camera_settings.description', 'Adjust camera parameters using digiCamControl CLI.') ?>
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
                                <?= t('overlay.camera_settings.iso.label', 'ISO') ?>
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
                                <?= t('overlay.camera_settings.shutter.label', 'Shutter Speed') ?>
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
                                <?= t('overlay.camera_settings.aperture.label', 'Aperture (f-stop)') ?>
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
                                <?= t('overlay.camera_settings.wb.label', 'White Balance') ?>
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="cameraWB"
                                data-json-group="camera_settings"
                                data-json-parm="wb"
                                data-default-value="auto">
                                <option value="auto" data-lang-key="overlay.camera_settings.wb.auto">
                                    <?= t('overlay.camera_settings.wb.auto', 'Auto') ?>
                                </option>
                                <option value="daylight" data-lang-key="overlay.camera_settings.wb.daylight">
                                    <?= t('overlay.camera_settings.wb.daylight', 'Daylight') ?>
                                </option>
                                <option value="cloudy" data-lang-key="overlay.camera_settings.wb.cloudy">
                                    <?= t('overlay.camera_settings.wb.cloudy', 'Cloudy') ?>
                                </option>
                                <option value="tungsten" data-lang-key="overlay.camera_settings.wb.tungsten">
                                    <?= t('overlay.camera_settings.wb.tungsten', 'Tungsten') ?>
                                </option>
                                <option value="fluorescent" data-lang-key="overlay.camera_settings.wb.fluorescent">
                                    <?= t('overlay.camera_settings.wb.fluorescent', 'Fluorescent') ?>
                                </option>
                            </select>
                        </div>

                        <!-- Exposure Compensation -->
                        <div class="col-md-4">
                            <label
                                class="form-label"
                                for="cameraExposure"
                                data-lang-key="overlay.camera_settings.exposure.label">
                                <?= t('overlay.camera_settings.exposure.label', 'Exposure Compensation') ?>
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
                                    <?= t('overlay.camera_settings.use_settings_for_picture.label', 'Use settings for picture') ?>
                                </label>
                            </div>

                            <div
                                class="small text-secondary"
                                data-lang-key="overlay.camera_settings.use_settings_for_picture.hint">
                                <?= t(
                                    'overlay.camera_settings.use_settings_for_picture.hint',
                                    'If enabled, LiveView runs continuously (increased heat and power usage; may reduce stability during long events). Recommended: lower FPS when idle and use higher FPS only during active photo sessions.'
                                ) ?>
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
                                    <?= t('overlay.camera_settings.liveview_always_active.label', 'Keep LiveView running all the time') ?>
                                </label>
                            </div>

                            <div
                                class="small text-secondary"
                                data-lang-key="overlay.camera_settings.liveview_always_active.hint">
                                <?= t(
                                    'overlay.camera_settings.liveview_always_active.hint',
                                    'If disabled, LiveView starts only when needed. Before the first capture a 3-second warmup countdown is shown.'
                                ) ?>
                            </div>

                            <div class="alert alert-warning py-2 mt-2 mb-0" role="alert">
                                <i class="bi bi-exclamation-triangle-fill me-2"></i>
                                <span data-lang-key="overlay.camera_settings.liveview_always_active.warning">
                                    <?= t(
                                        'overlay.camera_settings.liveview_always_active.warning',
                                        'If enabled, LiveView runs permanently (heat, power usage, possible stability issues on long events).'
                                    ) ?>
                                </span>
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
                                    <?= t('overlay.camera_settings.preview_mirror.label', 'Mirror preview image') ?>
                                </label>
                            </div>

                            <div
                                class="small text-secondary"
                                data-lang-key="overlay.camera_settings.preview_mirror.hint">
                                <?= t(
                                    'overlay.camera_settings.preview_mirror.hint',
                                    'Mirrors only the on-screen preview (useful for front-facing setups). Saved photos are not changed.'
                                ) ?>
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
                                    <?= t('overlay.camera_settings.full_img.label', 'Fullscreen preview (crop edges, center image)') ?>
                                </label>
                            </div>

                            <!-- FPS settings -->
                            <div class="row g-2 mt-3">
                                <div class="col-12 col-md-6">
                                    <label
                                        for="cameraLiveviewFpsActive"
                                        class="form-label mb-1"
                                        data-lang-key="overlay.camera_settings.liveview_fps_active.label">
                                        <?= t('overlay.camera_settings.liveview_fps_active.label', 'LiveView FPS (while session is running)') ?>
                                    </label>

                                    <div class="input-group input-group-sm">
                                        <input
                                            type="number"
                                            class="form-control"
                                            id="cameraLiveviewFpsActive"
                                            min="1"
                                            max="30"
                                            step="1"
                                            placeholder="<?= t('overlay.camera_settings.liveview_fps_active.placeholder', 'e.g. 15') ?>"
                                            data-json-group="camera_settings"
                                            data-json-parm="liveview_fps_active"
                                            data-json-type="int"
                                            data-default-value="20">
                                        <span class="input-group-text" data-lang-key="overlay.camera_settings.liveview_fps.unit">
                                            <?= t('overlay.camera_settings.liveview_fps.unit', 'FPS') ?>
                                        </span>
                                    </div>

                                    <div
                                        class="small text-secondary mt-1"
                                        data-lang-key="overlay.camera_settings.liveview_fps_active.hint">
                                        <?= t(
                                            'overlay.camera_settings.liveview_fps_active.hint',
                                            'Used after clicking START (countdown / capturing). Higher FPS feels smoother but uses more CPU/USB bandwidth.'
                                        ) ?>
                                    </div>
                                </div>

                                <div class="col-12 col-md-6">
                                    <label
                                        for="cameraLiveviewFpsIdle"
                                        class="form-label mb-1"
                                        data-lang-key="overlay.camera_settings.liveview_fps_idle.label">
                                        <?= t('overlay.camera_settings.liveview_fps_idle.label', 'LiveView FPS (idle / preview only)') ?>
                                    </label>

                                    <div class="input-group input-group-sm">
                                        <input
                                            type="number"
                                            class="form-control"
                                            id="cameraLiveviewFpsIdle"
                                            min="1"
                                            max="30"
                                            step="1"
                                            placeholder="<?= t('overlay.camera_settings.liveview_fps_idle.placeholder', 'e.g. 8') ?>"
                                            data-json-group="camera_settings"
                                            data-json-parm="liveview_fps_idle"
                                            data-json-type="int"
                                            data-default-value="10">
                                        <span class="input-group-text" data-lang-key="overlay.camera_settings.liveview_fps.unit">
                                            <?= t('overlay.camera_settings.liveview_fps.unit', 'FPS') ?>
                                        </span>
                                    </div>

                                    <div
                                        class="small text-secondary mt-1"
                                        data-lang-key="overlay.camera_settings.liveview_fps_idle.hint">
                                        <?= t(
                                            'overlay.camera_settings.liveview_fps_idle.hint',
                                            'Used when not in a photo session (only preview/stream). Lower FPS saves CPU and improves stability on long events.'
                                        ) ?>
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
                            <?= t('overlay.camera_settings.testphoto.title', 'Test Photo') ?>
                        </div>
                        <div class="small text-secondary" data-lang-key="overlay.camera_settings.testphoto.hint">
                            <?= t('overlay.camera_settings.testphoto.hint', 'Take a test shot to verify settings and framing.') ?>
                        </div>
                    </div>

                    <button
                        type="button"
                        class="btn btn-outline-info btn-sm"
                        id="btnTakeTestPhoto">
                        <i class="bi bi-camera"></i>
                        <span data-lang-key="overlay.camera_settings.testphoto.button">
                            <?= t('overlay.camera_settings.testphoto.button', 'Take test photo') ?>
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
                        <?= t('overlay.camera_settings.testphoto.placeholder', 'No test photo yet.') ?>
                    </div>

                    <img
                        id="testPhotoImg"
                        class="img-fluid d-none"
                        src=""
                        alt="<?= t('overlay.camera_settings.testphoto.alt', 'Test photo preview') ?>">
                </div>

                <div class="small text-secondary mt-2" data-lang-key="overlay.camera_settings.testphoto.note">
                    <?= t('overlay.camera_settings.testphoto.note', 'The latest test photo will be shown here.') ?>
                </div>
            </div>

            <div class="modal-footer border-secondary">
                <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    data-bs-dismiss="modal">
                    <span data-lang-key="form.cancel"><?= t('form.cancel', 'Cancel') ?></span>
                </button>

                <button
                    type="button"
                    class="btn btn-primary btn-sm pb-save-config"
                    id="btnSaveCameraSettings"
                    data-json-file="config/camera_config.json">
                    <span data-lang-key="overlay.camera_settings.actions.apply">
                        <?= t('overlay.camera_settings.actions.apply', 'Apply settings') ?>
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>