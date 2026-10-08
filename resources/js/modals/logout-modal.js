// /resources/js/modals/logout-modal.js

/**
 * LogoutModal Class
 * -----------------
 * Handles the logout confirmation modal and AJAX logout flow.
 */

import { Modal } from '../factories/modal-factory.js';
import { buttonSpinner } from '../utils/spinner-utils.js';

export class LogoutModal {
    constructor(buttonSelector = 'a[data-logout-button]') {
        this.selector = buttonSelector;

        this.modal = new Modal({
            id: 'logout-modal',
            title: 'Sign Out',
            content: this.getLogoutContent(),
            size: 'sm',
            showFooter: false,
        });

        this.initEventListeners();
    }

    /**
     * Generate logout modal content HTML
     */
    getLogoutContent() {
        return `
            <div class="text-center space-y-4 font-sans">
                <p class="text-gray-600 dark:text-gray-400 font-medium">
                    Are you sure you want to sign out?
                </p>
                <div id="logout-api-message" class="mt-2"></div>
                <div class="flex justify-center gap-3 mt-6">
                    <button id="confirm-logout-btn" 
                        class="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl font-black transition-all active:scale-95">
                        Yes, Sign Out
                    </button>
                    <button id="cancel-logout-btn" 
                        class="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100 px-6 py-2.5 rounded-xl font-black transition-all">
                        Cancel
                    </button>
                </div>
            </div>
        `;
    }

    /**
     * Centralized event delegation
     */
    initEventListeners() {
        // 1. Listen for OPEN trigger
        document.addEventListener('click', (e) => {
            const btn = e.target.closest(this.selector);
            if (!btn) return;

            e.preventDefault();
            this.modal.open();
        });

        // 2. Listen for modal button clicks (Delegated to document)
        document.addEventListener('click', async (e) => {
            // Handle CANCEL
            if (e.target.id === 'cancel-logout-btn') {
                this.modal.close();
                return;
            }

            // Handle CONFIRM
            if (e.target.id === 'confirm-logout-btn') {
                const confirmBtn = e.target;
                const apiMessageContainer = document.getElementById('logout-api-message');
                
                if (confirmBtn.disabled) return; // Prevent double-clicks

                confirmBtn.disabled = true;
                confirmBtn.innerHTML = buttonSpinner;

                try {
                    const logoutUrl = `${window.APP_CONFIG.baseUrl}api/logout`;
                    const response = await fetch(logoutUrl, { method: 'POST' });
                    const result = await response.json();

                    if (result.success) {
                        if (apiMessageContainer) {
                            apiMessageContainer.innerHTML = `
                                <div class="mt-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-sm font-bold">
                                    ${result.messages.join('<br>')}
                                </div>
                            `;
                        }

                        // Hide the buttons on success
                        confirmBtn.style.display = 'none';
                        document.getElementById('cancel-logout-btn').style.display = 'none';

                        setTimeout(() => {
                            this.modal.close();
                            window.location.href = window.APP_CONFIG.baseUrl;
                        }, 800);
                    } else {
                        throw new Error(result.messages.join(' '));
                    }
                } catch (err) {
                    confirmBtn.disabled = false;
                    confirmBtn.textContent = 'Yes, Sign Out';
                    if (apiMessageContainer) {
                        apiMessageContainer.innerHTML = `
                            <div class="mt-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 text-sm font-bold">
                                Error: ${err.message || 'Logout failed'}
                            </div>
                        `;
                    }
                }
            }
        });
    }
}