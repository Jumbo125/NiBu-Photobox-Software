<?php
// sections/render_settings.php
// Modal: Render Settings (render_config.json)
?>
<div
    class="modal fade"
    id="modalRenderSettings"
    tabindex="-1"
    aria-labelledby="modalRenderSettingsLabel"
    aria-hidden="true">
    <div class="modal-dialog modal-lg modal-dialog-centered">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalRenderSettingsLabel"
                    data-lang-key="overlay.render_settings.title">
                    <?= t('overlay.render_settings.title', 'Render Settings') ?>
                </h5> <!-- Gear Icon mit Tooltip -->
                &nbsp; <i class="bi bi-gear fs-3"
                    data-bs-toggle="tooltip"
                    data-bs-trigger="hover click"
                    data-bs-placement="top"
                    title="config/render_config.json"></i>
                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="<?= t('form.close', 'Close') ?>"></button>
            </div>

            <div class="modal-body">
                <p
                    class="small text-secondary mb-3"
                    data-lang-key="overlay.render_settings.description">
                    <?= t(
                        'overlay.render_settings.description',
                        'Configure output quality and green screen (greenwall) settings used by the renderer.'
                    ) ?>
                </p>

                <form id="formRenderSettings" class="small" data-json-file="config/render_config.json">
 <!-- =========================
     IMAGE / CROPPING (FIT)
     ========================= -->
                    <h6 class="mt-2 mb-2" data-lang-key="overlay.render_settings.image_fit.section">
                        <?= t('overlay.render_settings.image_fit.section', 'Image-Cropping') ?>
                    </h6>

                    <div class="mb-3">
                        <label
                            for="renderImageFitMode"
                            class="form-label"
                            data-lang-key="overlay.render_settings.image_fit.mode.label">
                            <?= t('overlay.render_settings.image_fit.mode.label', 'Fit mode') ?>
                        </label>

                        <select
                            class="form-select form-select-sm"
                            id="renderImageFitMode"
                            data-json-group="render"
                            data-json-parm="resize_mode"
                            data-default-value="cover">
                            <option value="contain">
                                <?= t('overlay.render_settings.image_fit.mode.opt.contain', 'Contain (all visible, may Border on each Side)') ?>
                            </option>
                            <option value="cover">
                                <?= t('overlay.render_settings.image_fit.mode.opt.cover', 'Cover (fill, may cropping)') ?>
                            </option>
                            <option value="stretch">
                                <?= t('overlay.render_settings.image_fit.mode.opt.stretch', 'Stretch (stretch to placeholder, no cropping, but no aspect-ratio)') ?>
                            </option>
                        </select>

                        <!-- optionaler Hinweis -->
                        <div class="form-text" data-lang-key="overlay.render_settings.image_fit.hint">
                            <?= t('overlay.render_settings.image_fit.hint', 'Contain = no cropping, Cover = may crop, Stretch = distorted..') ?>
                        </div>
                    </div>

                    <!-- =========================
     PHOTO WORK SCALE
     ========================= -->
<h6 class="mt-2 mb-2" data-lang-key="overlay.render_settings.photo_work_scale.section">
    <?= t('overlay.render_settings.photo_work_scale.section', 'Photo render scale') ?>
</h6>

<div class="mb-3">
    <label
        for="renderPhotoWorkScale"
        class="form-label"
        data-lang-key="overlay.render_settings.photo_work_scale.label">
        <?= t('overlay.render_settings.photo_work_scale.label', 'Photo work scale') ?>
    </label>

    <input
        type="number"
        class="form-control form-control-sm"
        id="renderPhotoWorkScale"
        data-json-group="render"
        data-json-parm="photo_work_scale"
        data-default-value="1.5"
        min="0.1"
        max="10"
        step="0.1" />

    <div class="form-text" data-lang-key="overlay.render_settings.photo_work_scale.hint">
        <?= t('overlay.render_settings.photo_work_scale.hint', 'Scale factor for internal photo processing. Only downsizes, never upscales. Default: 1.5') ?>
    </div>
</div>

                    <!-- Background color (used for "contain") -->
                    <div class="mb-3">
                        <label
                            for="renderContainBgColor"
                            class="form-label"
                            data-lang-key="overlay.render_settings.image_fit.contain_bg.label">
                            <?= t('overlay.render_settings.image_fit.contain_bg.label', 'Contain background color') ?>
                        </label>

                        <input
                            type="color"
                            class="form-control form-control-sm form-control-color"
                            id="renderContainBgColor"
                            data-json-group="render"
                            data-json-parm="contain_bg"
                            data-default-value="#000000"
                            value="#000000"
                            title="<?= t('overlay.render_settings.image_fit.contain_bg.title', 'Pick a background color') ?>" />

                        <div class="form-text" data-lang-key="overlay.render_settings.image_fit.contain_bg.hint">
                            <?= t('overlay.render_settings.image_fit.contain_bg.hint', 'Only used when Fit mode is set to "Contain" (for the empty borders around the image).') ?>
                        </div>
                    </div>


                    <!-- =========================
                         OUTPUT
                         ========================= -->
                    <h6 class="mt-2 mb-2" data-lang-key="overlay.render_settings.output.section">
                        <?= t('overlay.render_settings.output.section', 'Output') ?>
                    </h6>

                    <!-- Output format -->
                    <div class="mb-3">
                        <label
                            for="renderOutputFormat"
                            class="form-label"
                            data-lang-key="overlay.render_settings.output.format.label">
                            <?= t('overlay.render_settings.output.format.label', 'Format') ?>
                        </label>

                        <select
                            class="form-select form-select-sm"
                            id="renderOutputFormat"
                            data-json-group="output"
                            data-json-parm="format"
                            data-default-value="jpg">
                            <option value="jpg"><?= t('overlay.render_settings.output.format.opt.jpg', 'JPEG (.jpg)') ?></option>
                            <option value="png"><?= t('overlay.render_settings.output.format.opt.png', 'PNG (.png)') ?></option>
                        </select>

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.format.help">
                            <?= t('overlay.render_settings.output.format.help', 'Output file format for the final rendered image.') ?>
                        </div>
                    </div>

                    <!-- JPEG quality -->
                    <div class="mb-3">
                        <label
                            for="renderJpegQuality"
                            class="form-label"
                            data-lang-key="overlay.render_settings.output.jpeg_quality.label">
                            <?= t('overlay.render_settings.output.jpeg_quality.label', 'JPEG quality') ?>
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="renderJpegQuality"
                            min="1"
                            max="100"
                            step="1"
                            placeholder="<?= t('overlay.render_settings.output.jpeg_quality.placeholder', '94') ?>"
                            value="94"
                            data-json-group="output"
                            data-json-parm="jpeg_quality"
                            data-default-value="94">

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.jpeg_quality.help">
                            <?= t('overlay.render_settings.output.jpeg_quality.help', '1–100. Higher = better quality, larger file. Recommended for print: 92–95.') ?>
                        </div>
                    </div>

                    <!-- JPEG subsampling -->
                    <div class="mb-3">
                        <label
                            for="renderJpegSubsampling"
                            class="form-label"
                            data-lang-key="overlay.render_settings.output.jpeg_subsampling.label">
                            <?= t('overlay.render_settings.output.jpeg_subsampling.label', 'JPEG subsampling') ?>
                        </label>

                        <select
                            class="form-select form-select-sm"
                            id="renderJpegSubsampling"
                            data-json-group="output"
                            data-json-parm="jpeg_subsampling"
                            data-default-value="0">
                            <option value="0"><?= t('overlay.render_settings.output.jpeg_subsampling.opt.0', '0 (4:4:4) – Best for logos/text') ?></option>
                            <option value="1"><?= t('overlay.render_settings.output.jpeg_subsampling.opt.1', '1 (4:2:2) – Balanced') ?></option>
                            <option value="2"><?= t('overlay.render_settings.output.jpeg_subsampling.opt.2', '2 (4:2:0) – Smaller, softer edges') ?></option>
                        </select>

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.jpeg_subsampling.help">
                            <?= t('overlay.render_settings.output.jpeg_subsampling.help', 'Color subsampling. 0 keeps best color edges; 2 reduces file size but may blur colored edges.') ?>
                        </div>
                    </div>

                    <!-- JPEG optimize -->
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="renderJpegOptimize"
                                data-json-group="output"
                                data-json-parm="jpeg_optimize"
                                data-default-value="true">
                            <label
                                class="form-check-label"
                                for="renderJpegOptimize"
                                data-lang-key="overlay.render_settings.output.jpeg_optimize.label">
                                <?= t('overlay.render_settings.output.jpeg_optimize.label', 'Optimize JPEG') ?>
                            </label>
                        </div>

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.jpeg_optimize.help">
                            <?= t('overlay.render_settings.output.jpeg_optimize.help', 'Better compression (smaller file), slightly slower saving.') ?>
                        </div>
                    </div>

                    <!-- JPEG progressive -->
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="renderJpegProgressive"
                                data-json-group="output"
                                data-json-parm="jpeg_progressive"
                                data-default-value="true">
                            <label
                                class="form-check-label"
                                for="renderJpegProgressive"
                                data-lang-key="overlay.render_settings.output.jpeg_progressive.label">
                                <?= t('overlay.render_settings.output.jpeg_progressive.label', 'Progressive JPEG') ?>
                            </label>
                        </div>

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.jpeg_progressive.help">
                            <?= t('overlay.render_settings.output.jpeg_progressive.help', 'Progressive loading in browsers. Usually not important for printing.') ?>
                        </div>
                    </div>

                    <!-- DPI -->
                    <div class="mb-3">
                        <label
                            for="renderOutputDpi"
                            class="form-label"
                            data-lang-key="overlay.render_settings.output.dpi.label">
                            <?= t('overlay.render_settings.output.dpi.label', 'DPI metadata') ?>
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="renderOutputDpi"
                            min="72"
                            max="1200"
                            step="1"
                            placeholder="<?= t('overlay.render_settings.output.dpi.placeholder', '300') ?>"
                            value="300"
                            data-json-group="output"
                            data-json-parm="dpi"
                            data-default-value="300">

                        <div class="form-text small" data-lang-key="overlay.render_settings.output.dpi.help">
                            <?= t('overlay.render_settings.output.dpi.help', 'Metadata only (pixels do not change). Useful for print workflows (e.g. 300 DPI).') ?>
                        </div>
                    </div>

                    <hr class="border-secondary">

                    <!-- =========================
                         GREENWALL
                         ========================= -->
                    <div id="greenwall_settings">
                        <h6 class="mt-2 mb-2" data-lang-key="overlay.render_settings.greenwall.section">
                            <?= t('overlay.render_settings.greenwall.section', 'Greenwall (Green Screen)') ?>
                        </h6>

                        <!-- Greenwall switch -->
                        <div class="mb-3">
                            <label
                                for="renderGreenwallSwitch"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.switch.label">
                                <?= t('overlay.render_settings.greenwall.switch.label', 'Greenwall switch') ?>
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="renderGreenwallSwitch"
                                data-json-group="greenwall"
                                data-json-parm="switch"
                                data-default-value="auto">
                                <option value="auto"><?= t('overlay.render_settings.greenwall.switch.opt.auto', 'Auto (follow template)') ?></option>
                                <option value="on"><?= t('overlay.render_settings.greenwall.switch.opt.on', 'On (force enabled)') ?></option>
                                <option value="off"><?= t('overlay.render_settings.greenwall.switch.opt.off', 'Off (force disabled)') ?></option>
                            </select>

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.switch.help">
                                <?= t('overlay.render_settings.greenwall.switch.help', 'Auto uses the template flag (e.g. greenwall="1"). On/Off overrides it globally.') ?>
                            </div>
                        </div>

                        <!-- Greenwall mode -->
                        <div class="mb-3">
                            <label
                                for="renderGreenwallMode"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.mode.label">
                                <?= t('overlay.render_settings.greenwall.mode.label', 'Mode') ?>
                            </label>

                            <select
                                class="form-select form-select-sm"
                                id="renderGreenwallMode"
                                data-json-group="greenwall"
                                data-json-parm="mode"
                                data-default-value="auto">
                                <option value="auto"><?= t('overlay.render_settings.greenwall.mode.opt.auto', 'Auto (diff if reference exists, else chroma)') ?></option>
                                <option value="diff"><?= t('overlay.render_settings.greenwall.mode.opt.diff', 'Diff (reference comparison)') ?></option>
                                <option value="chroma"><?= t('overlay.render_settings.greenwall.mode.opt.chroma', 'Chroma (green dominance)') ?></option>
                            </select>

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.mode.help">
                                <?= t('overlay.render_settings.greenwall.mode.help', 'Select how the mask is created: diff (with reference) or chroma key (green dominance).') ?>
                            </div>
                        </div>

                        <!-- diff_threshold -->
                        <div class="mb-3">
                            <label
                                for="renderDiffThreshold"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.diff_threshold.label">
                                <?= t('overlay.render_settings.greenwall.diff_threshold.label', 'Diff threshold') ?>
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderDiffThreshold"
                                min="0"
                                max="255"
                                step="1"
                                placeholder="<?= t('overlay.render_settings.greenwall.diff_threshold.placeholder', '25') ?>"
                                value="25"
                                data-json-group="greenwall"
                                data-json-parm="diff_threshold"
                                data-default-value="25">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.diff_threshold.help">
                                <?= t('overlay.render_settings.greenwall.diff_threshold.help', 'Diff sensitivity. Lower = keep more person; higher = stricter background removal.') ?>
                            </div>
                        </div>

                        <!-- green_min -->
                        <div class="mb-3">
                            <label
                                for="renderGreenMin"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.green_min.label">
                                <?= t('overlay.render_settings.greenwall.green_min.label', 'Green minimum') ?>
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderGreenMin"
                                min="0"
                                max="255"
                                step="1"
                                placeholder="<?= t('overlay.render_settings.greenwall.green_min.placeholder', '150') ?>"
                                value="150"
                                data-json-group="greenwall"
                                data-json-parm="green_min"
                                data-default-value="150">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.green_min.help">
                                <?= t('overlay.render_settings.greenwall.green_min.help', 'Minimum green channel value required before a pixel can be considered “green”.') ?>
                            </div>
                        </div>

                        <!-- green_ratio -->
                        <div class="mb-3">
                            <label
                                for="renderGreenRatio"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.green_ratio.label">
                                <?= t('overlay.render_settings.greenwall.green_ratio.label', 'Green ratio') ?>
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderGreenRatio"
                                min="1"
                                max="5"
                                step="0.01"
                                placeholder="<?= t('overlay.render_settings.greenwall.green_ratio.placeholder', '1.35') ?>"
                                value="1.35"
                                data-json-group="greenwall"
                                data-json-parm="green_ratio"
                                data-default-value="1.35">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.green_ratio.help">
                                <?= t('overlay.render_settings.greenwall.green_ratio.help', 'How strongly green must dominate red/blue. Higher = stricter (less false keying, but may create holes).') ?>
                            </div>
                        </div>

                        <!-- blur_radius -->
                        <div class="mb-3">
                            <label
                                for="renderBlurRadius"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.blur_radius.label">
                                <?= t('overlay.render_settings.greenwall.blur_radius.label', 'Mask blur radius') ?>
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderBlurRadius"
                                min="0"
                                max="20"
                                step="1"
                                placeholder="<?= t('overlay.render_settings.greenwall.blur_radius.placeholder', '2') ?>"
                                value="2"
                                data-json-group="greenwall"
                                data-json-parm="blur_radius"
                                data-default-value="2">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.blur_radius.help">
                                <?= t('overlay.render_settings.greenwall.blur_radius.help', 'Smooth the mask for cleaner edges (typical: 1–3).') ?>
                            </div>
                        </div>

                        <!-- feather -->
                        <div class="mb-3">
                            <label
                                for="renderFeather"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.feather.label">
                                <?= t('overlay.render_settings.greenwall.feather.label', 'Feather') ?>
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderFeather"
                                min="0"
                                max="50"
                                step="1"
                                placeholder="<?= t('overlay.render_settings.greenwall.feather.placeholder', '2') ?>"
                                value="2"
                                data-json-group="greenwall"
                                data-json-parm="feather"
                                data-default-value="2">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.feather.help">
                                <?= t('overlay.render_settings.greenwall.feather.help', 'Additional edge softening (implementation dependent).') ?>
                            </div>
                        </div>

                        <!-- spill_suppression -->
                        <div class="mb-3">
                            <label
                                for="renderSpillSuppression"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.spill_suppression.label">
                                <?= t('overlay.render_settings.greenwall.spill_suppression.label', 'Spill suppression') ?>
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderSpillSuppression"
                                min="0"
                                max="1"
                                step="0.01"
                                placeholder="<?= t('overlay.render_settings.greenwall.spill_suppression.placeholder', '0.35') ?>"
                                value="0.35"
                                data-json-group="greenwall"
                                data-json-parm="spill_suppression"
                                data-default-value="0.35">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.spill_suppression.help">
                                <?= t('overlay.render_settings.greenwall.spill_suppression.help', 'Reduce green color spill on edges (0–1).') ?>
                            </div>
                        </div>

                        <!-- close_iter -->
                        <div class="mb-3">
                            <label
                                for="renderCloseIter"
                                class="form-label"
                                data-lang-key="overlay.render_settings.greenwall.close_iter.label">
                                <?= t('overlay.render_settings.greenwall.close_iter.label', 'Close iterations') ?>
                            </label>

                            <input
                                type="number"
                                class="form-control form-control-sm"
                                id="renderCloseIter"
                                min="0"
                                max="10"
                                step="1"
                                placeholder="<?= t('overlay.render_settings.greenwall.close_iter.placeholder', '1') ?>"
                                value="1"
                                data-json-group="greenwall"
                                data-json-parm="close_iter"
                                data-default-value="1">

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.close_iter.help">
                                <?= t('overlay.render_settings.greenwall.close_iter.help', 'Close small holes in the mask (morphological closing). Typical: 0–2.') ?>
                            </div>
                        </div>

                        <!-- write_mask_debug -->
                        <div class="mb-3">
                            <div class="form-check form-switch">
                                <input
                                    class="form-check-input"
                                    type="checkbox"
                                    role="switch"
                                    id="renderWriteMaskDebug"
                                    data-json-group="greenwall"
                                    data-json-parm="write_mask_debug"
                                    data-default-value="false">
                                <label
                                    class="form-check-label"
                                    for="renderWriteMaskDebug"
                                    data-lang-key="overlay.render_settings.greenwall.write_mask_debug.label">
                                    <?= t('overlay.render_settings.greenwall.write_mask_debug.label', 'Write mask debug image') ?>
                                </label>
                            </div>

                            <div class="form-text small" data-lang-key="overlay.render_settings.greenwall.write_mask_debug.help">
                                <?= t('overlay.render_settings.greenwall.write_mask_debug.help', 'If enabled, the renderer exports the mask image for debugging/tuning.') ?>
                            </div>
                        </div>
                    </div>

                </form>
            </div>

            <div class="modal-footer border-secondary">
                <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
                    <span data-lang-key="form.cancel">
                        <?= t('form.cancel', 'Cancel') ?>
                    </span>
                </button>

                <!-- GENERIC SAVE (schreibt in config/render_config.json) -->
                <button
                    type="button"
                    class="btn btn-primary btn-sm pb-save-config"
                    data-json-file="config/render_config.json">
                    <span data-lang-key="form.save">
                        <?= t('form.save', 'Save') ?>
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>