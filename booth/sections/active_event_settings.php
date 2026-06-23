<?php
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (c) 2026 Andreas Rottmann
//
// sections/active_event_settings.php — Modal: Active Event
?>
<div
    class="modal fade"
    id="modalActiveEvent"
    tabindex="-1"
    aria-labelledby="modalActiveEventLabel"
    aria-hidden="true"
>
    <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalActiveEventLabel"
                    data-lang-key="overlay.active_event.title"
                >
                    <?= t('overlay.active_event.title', 'Active Event') ?>
                </h5>

                &nbsp;
                <!-- Config hint (tooltip) -->
                <i
                    class="bi bi-gear fs-3"
                    data-bs-toggle="tooltip"
                    data-bs-placement="top"
                    data-bs-trigger="hover click"
                    title="<?= t('overlay.active_event.config_file.tooltip', 'config/active_event_config.json') ?>"
                ></i>

                &nbsp;
                <!-- New event wizard -->
                <button
                    type="button"
                    class="btn btn-outline-success btn-sm"
                    id="btnNewEvent"
                    title="<?= t('overlay.active_event.new_event.title', 'Create new event') ?>"
                >
                    <i class="bi bi-plus-circle me-1"></i>
                    <span data-lang-key="overlay.active_event.new_event.button">
                        <?= t('overlay.active_event.new_event.button', 'New Event') ?>
                    </span>
                </button>

                &nbsp;
                <!-- Open event folder (Windows Explorer) — im Kiosk-Modus nicht verfügbar, daher auskommentiert -->
                <!--
                <button
                    type="button"
                    class="btn btn-outline-warning btn-sm pb-open-folder"
                    title="<?= t('overlay.active_event.open_folder.title', 'Open event folder') ?>"
                    data-target="activeEvent"
                    data-create_dir="true"
                    data-cooldown="3"
                >
                    <i class="bi bi-folder2-open me-1"></i>
                    <span data-lang-key="overlay.active_event.open_folder.button">
                        <?= t('overlay.active_event.open_folder.button', 'Folder') ?>
                    </span>
                </button>
                -->

                <!-- Eigener Foto-Explorer (Kiosk-kompatibel) -->
                <button
                    type="button"
                    class="btn btn-outline-warning btn-sm"
                    id="btnOpenPhotoExplorer"
                    title="<?= t('overlay.active_event.photo_explorer.title', 'Fotos anzeigen') ?>"
                >
                    <i class="bi bi-images me-1"></i>
                    <span data-lang-key="overlay.active_event.photo_explorer.button">
                        <?= t('overlay.active_event.photo_explorer.button', 'Fotos') ?>
                    </span>
                </button>

                <!-- Button close -->
                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="<?= t('form.close', 'Close') ?>"
                ></button>
            </div>

            <div class="modal-body">
                <p
                    class="small text-secondary mb-3"
                    data-lang-key="overlay.active_event.description"
                >
                    <?= t(
                        'overlay.active_event.description',
                        'Configure folder, template and print limits for the current event.'
                    ) ?>
                </p>

                <form
                    id="formActiveEvent"
                    class="small"
                    data-json-file="config/active_event_config.json"
                >
                    <div class="mb-3">
                        <label
                            for="eventNamse"
                            class="form-label"
                            data-lang-key="overlay.active_event.event_name.label"
                        >
                            <?= t('overlay.active_event.event_name.label', 'Event Name') ?>
                        </label>

                        <div class="input-group input-group-sm">
                            <input
                                type="text"
                                class="form-control"
                                id="eventNamse"
                                placeholder="<?= t('overlay.active_event.event_name.placeholder', 'Add Event Name') ?>"
                                data-json-group="active_event"
                                data-json-parm="eventName"
                                data-default-value=""
                            >
                        </div>
                    </div>

<?php
// Absoluter Pfad zu booth/EVENTS — Server legt Events direkt darunter an
$boothPhotosBase = rtrim(realpath(__DIR__ . '/..'), "\\/") . DIRECTORY_SEPARATOR . 'EVENTS';
$boothPhotosBaseOut = (DIRECTORY_SEPARATOR === '\\')
    ? str_replace('/', '\\', $boothPhotosBase)
    : $boothPhotosBase;
?>
                    <!-- Photo storage folder — automatisch aus booth/photos + Eventname -->
                    <div class="mb-3">
                        <label class="form-label" data-lang-key="overlay.active_event.storage.label">
                            <?= t('overlay.active_event.storage.label', 'Photo storage folder') ?>
                        </label>

                        <!-- Verstecktes Feld — wird per JS automatisch befüllt, in JSON gespeichert -->
                        <input
                            type="hidden"
                            id="eventStoragePath"
                            data-json-group="active_event"
                            data-json-parm="photo_storage_path"
                            data-default-value="<?= htmlspecialchars($boothPhotosBaseOut, ENT_QUOTES) ?>"
                            data-photos-base="<?= htmlspecialchars($boothPhotosBaseOut, ENT_QUOTES) ?>"
                        >

                        <!-- Schreibgeschützte Pfad-Anzeige -->
                        <div class="input-group input-group-sm">
                            <span class="input-group-text text-secondary">
                                <i class="bi bi-folder2"></i>
                            </span>
                            <input
                                type="text"
                                class="form-control text-secondary"
                                id="eventStoragePathDisplay"
                                readonly
                                placeholder="<?= htmlspecialchars($boothPhotosBaseOut . DIRECTORY_SEPARATOR . 'EVENTS' . DIRECTORY_SEPARATOR . '…', ENT_QUOTES) ?>"
                                tabindex="-1"
                            >
                        </div>

                        <div class="form-text small" data-lang-key="overlay.active_event.storage.help_auto">
                            <?= t(
                                'overlay.active_event.storage.help_auto',
                                'The storage path is automatically set to photos/EVENTS/<event-name> within the booth folder.'
                            ) ?>
                        </div>
                    </div>

                    <!-- Template (ZIP) -->
                    <div class="mb-3">
                        <label
                            for="eventTemplateZip"
                            class="form-label"
                            data-lang-key="overlay.active_event.template.label"
                        >
                            <?= t('overlay.active_event.template.label', 'Template (ZIP)') ?>
                        </label>

                        <!-- Note: File inputs are not stored via JSON. Handle upload via a dedicated endpoint (FormData). -->
                        <input
                            type="file"
                            class="form-control form-control-sm"
                            id="eventTemplateZip"
                            accept=".zip"
                        >

                        <div class="form-text small" data-lang-key="overlay.active_event.template.help">
                            <?= t(
                                'overlay.active_event.template.help',
                                'Select the template ZIP archive. It will be unpacked into the current event template folder.'
                            ) ?>
                        </div>
                    </div>

                    <!-- Maximum prints -->
                    <div class="mb-3">
                        <label
                            for="eventMaxPrints"
                            class="form-label"
                            data-lang-key="overlay.active_event.prints.label"
                        >
                            <?= t('overlay.active_event.prints.label', 'Maximum number of prints') ?>
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="eventMaxPrints"
                            min="0"
                            step="1"
                            placeholder="<?= t('overlay.active_event.prints.placeholder', '0') ?>"
                            value="0"
                            data-json-group="active_event"
                            data-json-parm="max_prints"
                            data-default-value="0"
                        >

                        <div class="form-text small" data-lang-key="overlay.active_event.prints.help">
                            <?= t('overlay.active_event.prints.help', '0 = unlimited. This limit is counted down with every print.') ?>
                        </div>
                    </div>

                    <!-- Already printed photos (print counter) -->
                    <div class="mb-3">
                        <label
                            for="eventPrintCounter"
                            class="form-label"
                            data-lang-key="overlay.active_event.print_counter.label"
                        >
                            <?= t('overlay.active_event.print_counter.label', 'Already printed photos') ?>
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="eventPrintCounter"
                            min="0"
                            step="1"
                            placeholder="<?= t('overlay.active_event.print_counter.placeholder', '0') ?>"
                            value="0"
                            data-json-group="active_event"
                            data-json-parm="print_counter"
                            data-default-value="0"
                        >

                        <div class="form-text small" data-lang-key="overlay.active_event.print_counter.help">
                            <?= t('overlay.active_event.print_counter.help', 'Current counter of already printed photos for this event.') ?>
                        </div>
                    </div>

                    <!-- Allow reprint -->
                    <div class="mb-3">
                        <div class="form-check form-switch">
                            <input
                                class="form-check-input"
                                type="checkbox"
                                role="switch"
                                id="eventAllowReprint"
                                data-json-group="active_event"
                                data-json-parm="allow_reprint"
                                data-default-value="false"
                            >

                            <label
                                class="form-check-label"
                                for="eventAllowReprint"
                                data-lang-key="overlay.active_event.allow_reprint.label"
                            >
                                <?= t('overlay.active_event.allow_reprint.label', 'Allow reprint') ?>
                            </label>
                        </div>

                        <div class="form-text small" data-lang-key="overlay.active_event.allow_reprint.help">
                            <?= t(
                                'overlay.active_event.allow_reprint.help',
                                'If enabled, operators can reprint the last result without consuming a new photo session.'
                            ) ?>
                        </div>
                    </div>

                    <!-- Multiple print copies -->
                    <div class="mb-3">
                        <label
                            for="eventMultiplePrint"
                            class="form-label"
                            data-lang-key="overlay.active_event.multiple_print.label"
                        >
                            <?= t('overlay.active_event.multiple_print.label', 'Multiple print copies') ?>
                        </label>

                        <input
                            type="number"
                            class="form-control form-control-sm"
                            id="eventMultiplePrint"
                            min="1"
                            step="1"
                            placeholder="<?= t('overlay.active_event.multiple_print.placeholder', '1') ?>"
                            value="1"
                            data-json-group="active_event"
                            data-json-parm="multiple_print"
                            data-default-value="1"
                        >

                        <div class="form-text small" data-lang-key="overlay.active_event.multiple_print.help">
                            <?= t(
                                'overlay.active_event.multiple_print.help',
                                'Number of copies per print job (e.g. 2 prints each time).'
                            ) ?>
                        </div>
                    </div>

<?php
// booth-Root (absolut) bestimmen
$boothRoot = realpath(__DIR__ . '/..');

// Datei-Pfad (ohne trailing separator)
$activeEventConfigPath =
    rtrim($boothRoot, "\\/") .
    DIRECTORY_SEPARATOR . 'config' .
    DIRECTORY_SEPARATOR . 'active_event_config.json';

// Ausgabe: nur unter Windows Backslashes erzwingen, Linux bleibt mit /
$activeEventConfigPathOut = (DIRECTORY_SEPARATOR === '\\')
    ? str_replace('/', '\\', $activeEventConfigPath)
    : $activeEventConfigPath;
?>

                    <!-- Hidden config path -->
                    <div>
                        <input
                            type="hidden"
                            id="settingActiveEvent"
                            class="form-control form-control-sm"
                            value="<?= htmlspecialchars($activeEventConfigPathOut, ENT_QUOTES) ?>"
                            readonly
                            data-json-group="active_event"
                            data-json-parm="config_path"
                            data-json-type="string"
                            data-default-value="<?= htmlspecialchars($activeEventConfigPathOut, ENT_QUOTES) ?>"
                        >
                    </div>
                </form>
            </div>

            <div class="modal-footer border-secondary">
                <button type="button" class="btn btn-outline-light btn-sm" data-bs-dismiss="modal">
                    <span data-lang-key="form.cancel">
                        <?= t('form.cancel', 'Cancel') ?>
                    </span>
                </button>

                <!-- Save active_event_config.json -->
                <button
                    type="button"
                    class="btn btn-primary btn-sm pb-save-config"
                    data-json-file="config/active_event_config.json"
                >
                    <span data-lang-key="form.save">
                        <?= t('form.save', 'Save') ?>
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>
