/**
 * ResetModal Class
 * ----------------
 * Handles modal display, form validation, and the AJAX admin DB reset
 * request (additive database updates only — see server/api/reset.php).
 * Features:
 * - Custom form validation with shake animation for empty input
 * - Single-line input group (password + submit button)
 * - Spinner and "Processing..." feedback while request is pending
 * - Hides input group and displays green success alert on successful reset
 * - Displays red alert with shake animation on failure
 */

import { Modal } from '../factories/modal-factory.js';
import { FormValidator } from '../utils/form-validator.js';
import { resetFormHTML } from '../forms/reset-form.js';
import { buttonSpinner } from '../utils/spinner-utils.js';

export class ResetModal {
  constructor(resetButtonSelector = '[data-reset-button]') {
    this.resetButton = document.querySelector(resetButtonSelector);
    if (!this.resetButton) return;

    // Initialize modal
    this.modal = new Modal({
      id: 'reset-modal',
      title: 'Database Reset',
      content: resetFormHTML,
      // Wide: the migration messages are long (and their file names don't wrap)
      size: 'lg',
      showFooter: false,
    });

    this.attachResetListener();
  }

  attachResetListener() {
    // This button lives in the persistent header (outside #main-content),
    // so it survives partial-load navigations untouched — but
    // initGlobalModals() re-runs `new ResetModal(...)` after every one of
    // them. Without this guard, each navigation would stack another click
    // listener on the same button, and clicking it would then re-attach
    // another submit listener on top of that — so after enough navigating
    // (or even just opening/closing the modal a few times), one real
    // submit could fire the reset request multiple times.
    if (this.resetButton.dataset.resetBound) return;
    this.resetButton.dataset.resetBound = 'true';

    this.resetButton.addEventListener('click', (e) => {
      e.preventDefault();
      this.modal.open();

      const form = document.getElementById('reset-form');
      if (!form) return;

      // Two very different flows share this same button/modal: maintenance
      // mode (ADMIN_RESET=true in .env — see layouts/db-reset.php) checks
      // the submitted password against the shared ADMIN_RESET_PASSWORD
      // secret, while the normal signed-in flow (the header trash icon —
      // see server/api/reset.php) checks it against the logged-in admin's
      // own account password. Same-looking "Enter admin password" prompt
      // for both was ambiguous enough that typing the wrong one produced a
      // confusing "Incorrect password" with no clue why.
      const passwordInput = document.getElementById('reset-password');
      if (passwordInput) {
        passwordInput.placeholder = this.resetButton.dataset.resetMode === 'maintenance'
          ? 'Enter the maintenance reset password (.env)'
          : 'Enter your account password';
      }

      if (form.dataset.submitBound) return;
      form.dataset.submitBound = 'true';

      // Initialize custom validator for shake animation & live error clearing
      const validator = new FormValidator(form);

      const apiMessageContainer = document.getElementById('reset-api-message');
      const inputGroup = document.getElementById('reset-input-group');

      // Form submission handler
      form.addEventListener('submit', async (ev) => {
        ev.preventDefault();

        // Validate required field
        if (!validator.validateForEmptyFields(ev)) return;

        const submitBtn = form.querySelector('button[type="submit"]');
        const originalText = submitBtn.textContent;

        // Disable button + show spinner
        submitBtn.disabled = true;
        submitBtn.innerHTML = buttonSpinner;

        // Clear previous API messages
        apiMessageContainer.innerHTML = '';
        apiMessageContainer.classList.add('hidden');

        try {
          const body = JSON.stringify(Object.fromEntries(new FormData(form).entries()));

          const response = await fetch(`${window.APP_CONFIG.baseUrl}api/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });

          const result = await response.json();

          if (result.success) {
            // ✅ Success: hide input group + intro and display green alert
            if (inputGroup) inputGroup.classList.add('hidden');
            document.getElementById('reset-intro')?.classList.add('hidden');

            apiMessageContainer.innerHTML = `
              <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded-md mt-3 animate-fade-in">
                <p class="font-semibold mb-1">Database Updated — existing data untouched</p>
                <ul class="list-disc pl-5 text-sm space-y-1 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2 [overflow-wrap:anywhere]">
                  ${result.messages.map(msg => `<li>${msg}</li>`).join('')}
                </ul>
              </div>
            `;
            apiMessageContainer.classList.remove('hidden');

          } else {
            // ❌ Failure: show red alert
            apiMessageContainer.innerHTML = `
              <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mt-3 animate-shake">
                <p class="font-semibold mb-1">Reset Failed</p>
                <ul class="list-disc pl-5 text-sm space-y-1 max-h-[55vh] overflow-y-auto custom-scrollbar pr-2 [overflow-wrap:anywhere]">
                  ${result.messages.map(msg => `<li>${msg}</li>`).join('')}
                </ul>
              </div>
            `;
            apiMessageContainer.classList.remove('hidden');
          }
        } catch (err) {
          console.error(err);
          apiMessageContainer.innerHTML = `
            <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-md mt-3 animate-shake">
              <p class="font-semibold">Unexpected error occurred.</p>
            </div>
          `;
          apiMessageContainer.classList.remove('hidden');
        } finally {
          // Restore button
          submitBtn.disabled = false;
          submitBtn.textContent = originalText;
        }
      });
    });
  }
}
