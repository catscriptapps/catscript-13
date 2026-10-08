// /resources/js/modals/auth-gate-modal.js
//
// Guest content gates (.auth-gate-btn) open this small modal instead of
// jumping straight into Sign In: it offers Sign In (reusing the global
// a[data-login-button] trigger for LoginModal) and explains that accounts
// are created by an administrator — there's no self-registration.

import { Modal } from '../factories/modal-factory.js';

let gateModal = null;

function authGateContent() {
  return `
    <div class="space-y-4 text-center">
      <div class="p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/40">
        <h4 class="text-sm font-bold text-gray-900 dark:text-white">Already have an account?</h4>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 mb-4">Sign in to continue.</p>
        <a href="javascript:void(0)" data-login-button class="inline-flex items-center justify-center w-full px-5 py-2.5 bg-gray-900 hover:bg-gray-800 dark:bg-primary-600 dark:hover:bg-primary-500 text-white font-bold text-sm rounded-lg transition-colors shadow-sm">
          Sign In
        </a>
      </div>

      <p class="text-xs text-gray-500 dark:text-gray-400">Don't have an account yet? Accounts are created by an administrator — <a href="${window.APP_CONFIG?.baseUrl || '/'}contact" data-partial class="font-semibold text-primary-600 dark:text-primary-400 hover:underline">get in touch</a>.</p>
    </div>
  `;
}

export function openAuthGateModal() {
  if (gateModal) gateModal.destroy();

  gateModal = new Modal({
    id: 'auth-gate-modal',
    title: 'Sign In Required',
    content: authGateContent(),
    size: 'sm',
    showFooter: false,
  });

  gateModal.open();

  // Bubble-phase listener on the modal itself fires before the click
  // reaches document.body/document, where LoginModal's delegated listener
  // and the SPA router live — so this closes the gate first, then lets the
  // click carry on (sign-in modal, or the contact page).
  document.getElementById('auth-gate-modal')?.addEventListener('click', (e) => {
    if (e.target.closest('a[data-login-button], a[data-partial]')) {
      gateModal?.close();
    }
  });
}

export function initAuthGateTriggers() {
  if (document._authGateTriggersAttached) return;
  document._authGateTriggersAttached = true;

  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('.auth-gate-btn');
    if (!trigger) return;

    e.preventDefault();
    e.stopImmediatePropagation();

    openAuthGateModal();
  });
}
