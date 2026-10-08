// /resources/js/modals/change-password-modal.js

import { Modal } from '../factories/modal-factory.js';
import { changePasswordForm } from '../forms/change-password-form.js';
import { FormValidator } from '../utils/form-validator.js';
import { showToast } from '../ui/toast.js';

function openChangePasswordModal() {
  const modal = new Modal({
    id: 'change-password-modal',
    title: 'Change Password',
    content: changePasswordForm(),
    size: 'sm',
    showFooter: false,
  });

  modal.open();

  const form = document.getElementById('change-password-form');
  const validator = new FormValidator(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;
  const messageSlot = document.getElementById('change-password-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageSlot.innerHTML = '';

    if (!validator.validateForEmptyFields(e)) return;

    const newPassword = form.querySelector('#new-password-input').value;
    const confirmPassword = form.querySelector('#new-password-confirmation-input').value;
    if (newPassword !== confirmPassword) {
      messageSlot.innerHTML = `<p class="text-xs text-red-600">New password and confirmation do not match.</p>`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Updating...';

    try {
      const baseUrl = window.APP_CONFIG?.baseUrl || '/';
      const response = await fetch(`${baseUrl}api/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          current_password: form.querySelector('#current-password-input').value,
          new_password: newPassword,
          new_password_confirmation: confirmPassword,
        }),
      });
      const result = await response.json();

      if (result.success) {
        messageSlot.innerHTML = `<div class="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-4 py-3 rounded-xl font-bold text-sm text-center">${result.message}</div>`;
        showToast('Password updated.', 'success');
        form.reset();
        setTimeout(() => modal.close(), 1200);
      } else {
        messageSlot.innerHTML = (result.messages || ['Could not update password.'])
          .map((msg) => `<p class="text-xs text-red-600">${msg}</p>`)
          .join('');
      }
    } catch (err) {
      console.error('Change password error:', err);
      messageSlot.innerHTML = `<p class="text-xs text-red-600">Unexpected error.</p>`;
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = originalLabel;
    }
  });
}

export function initChangePasswordTrigger() {
  if (document._changePasswordTriggerAttached) return;
  document._changePasswordTriggerAttached = true;

  document.addEventListener('click', (e) => {
    if (e.target.closest('#change-password-btn, [data-action="open-change-password"]')) {
      openChangePasswordModal();
    }
  });
}
