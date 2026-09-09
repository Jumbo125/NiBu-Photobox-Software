/* SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Andreas Rottmann
 * ============================================================================
 * modal_stack_bindings.js — "Zurück"-Effekt für Sub-Modals.
 *
 * Ein Sub-Modal markiert sein Eltern-Modal deklarativ per
 * data-pb-parent-modal="#modalSettings" am .modal-Element.
 * Wird das Sub-Modal geschlossen (Save, Cancel oder X), wird einfach der
 * Button, der es ursprünglich geöffnet hat, für das Eltern-Modal erneut
 * "geklickt" — Bootstrap übernimmt Öffnen/Backdrop wie gewohnt.
 * ============================================================================
 */
(function ($) {
  "use strict";

  window.PB = window.PB || {};
  const PB = window.PB;

  PB.initModalStackBindings =
    PB.initModalStackBindings ||
    function () {
      if (PB._modalStackBound) return;
      PB._modalStackBound = true;

      $(document).on("hidden.bs.modal", ".modal", function () {
        const parentSel = this.dataset.pbParentModal;
        if (!parentSel) return;

        const trigger = document.querySelector(
          '[data-bs-toggle="modal"][data-bs-target="' + parentSel + '"]'
        );
        if (trigger) trigger.click();
      });
    };

  $(function () {
    PB.initModalStackBindings();
  });
})(jQuery);
