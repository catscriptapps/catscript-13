// /resources/js/modals/profile-modal.js

import { openEditUserModal } from './users-modal.js';

/**
 * Connects the Profile Page button to the shared User Edit Modal
 */
export function initProfileModal() {
    const profileEditBtn = document.querySelector('[data-action="edit-user-profile"]');

    if (!profileEditBtn || profileEditBtn._initialized) return;
    profileEditBtn._initialized = true;

    profileEditBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();

        if (profileEditBtn._isProcessing) return;
        profileEditBtn._isProcessing = true;

        // Visual feedback: Transition to loading state
        const originalHtml = profileEditBtn.innerHTML;
        profileEditBtn.classList.add('opacity-50', 'cursor-wait', 'scale-95');
        profileEditBtn.innerHTML = `
            <svg class="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Processing...</span>
        `;

        try {
            // Trigger shared modal logic
            // This passes the button itself, which carries all the data-attributes
            // your modal needs to populate the fields correctly.
            await openEditUserModal(profileEditBtn);
        } catch (error) {
            console.error('Profile Modal Error:', error);
        } finally {
            // Restore button state
            profileEditBtn._isProcessing = false;
            profileEditBtn.classList.remove('opacity-50', 'cursor-wait', 'scale-95');
            profileEditBtn.innerHTML = originalHtml;
        }
    });
}