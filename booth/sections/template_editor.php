<?php
// sections/template_editor.php
// Modal: Template Editor (90vw)
?>
<div
    class="modal fade"
    id="modalTemplateEditor"
    tabindex="-1"
    aria-labelledby="modalTemplateEditorLabel"
    aria-hidden="true"
>
    <div class="modal-dialog modal-xl modal-dialog-centered modal-template-editor">
        <div class="modal-content bg-dark text-light border border-secondary">
            <div class="modal-header border-secondary">
                <h5
                    class="modal-title"
                    id="modalTemplateEditorLabel"
                    data-lang-key="overlay.template_editor.title"
                >
                    <?= t('overlay.template_editor.title', 'Template Editor') ?>
                </h5>
                <button
                    type="button"
                    class="btn-close btn-close-white"
                    data-bs-dismiss="modal"
                    aria-label="<?= t('form.close', 'Close') ?>"
                ></button>
            </div>
            <div class="modal-body">
               

                <div id="template-editor-container" class="p-3">
                    <div class="text-center text-secondary">
                    <iframe
    src="http://localhost:8050/editor/editor.php"
    title="<?= t('overlay.template_editor.title', 'Template Editor') ?>"
    loading="lazy"
></iframe>
                    </div>
                </div>
            </div>
            <div class="modal-footer border-secondary">
                <button
                    type="button"
                    class="btn btn-outline-light btn-sm"
                    data-bs-dismiss="modal"
                >
                    <span data-lang-key="form.close">
                        <?= t('form.close', 'Close') ?>
                    </span>
                </button>
            </div>
        </div>
    </div>
</div>
