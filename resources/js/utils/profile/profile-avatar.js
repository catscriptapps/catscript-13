// /resources/js/utils/profile/profile-avatar.js

import { uploadModal, createUploadHandler } from '../../modals/upload-modal.js';
import { showToast } from '../../ui/toast.js';
import { loadPartial } from '../spa-router.js';
import { createDeleteHandler } from '../../factories/delete-factory.js';
import { openEditUserModal } from '../../modals/users-modal.js';
import { registerImagePreview } from '../globals/preview.js';
import { updateHeaderAvatar } from '../header-avatar.js';

/**
 * Initializes profile-specific interactions.
 * Handles avatar preview, upload, deletion, and profile data synchronization.
 */
export function initProfileAvatar() {
    // --- 1. DOM-SPECIFIC REGISTRATION (Runs on every SPA load) ---
    // We target the wrapper and the specific data-action added to the PHP.
    // This must run every time because the HTML element is replaced during loadPartial.
    const avatarWrapper = document.querySelector('#avatar-preview-wrapper');
    if (avatarWrapper) {
        registerImagePreview(avatarWrapper, '[data-action="view-avatar"]');
    }

    // --- 2. GLOBAL LISTENER GUARD ---
    // Prevent double-binding document-level listeners when navigating via SPA.
    if (window._profileListenersAttached) return;

    // --- 3. GLOBAL CLICK DELEGATION ---
    document.addEventListener('click', (e) => {
        const baseUrl = window.APP_CONFIG.baseUrl;

        // --- EDIT PROFILE ---
        const editBtn = e.target.closest('[data-action="edit-user-profile"]');
        if (editBtn) {
            e.preventDefault();
            openEditUserModal(editBtn);
            return;
        }

        // --- UPLOAD AVATAR ---
        const uploadBtn = e.target.closest('#change-avatar-btn');
        if (uploadBtn) {
            e.preventDefault();
            uploadModal.open();
            
            // Short delay ensures modal DOM is injected and ready for Dropzone/Handler
            setTimeout(() => {
                createUploadHandler(`${baseUrl}api/avatar-upload`, 'avatar', (files) => {
                    // Update the header's account avatar immediately — it lives
                    // outside #main-content, so the loadPartial() below (which
                    // only refreshes this page's own avatar preview) never
                    // reaches it on its own.
                    const fileName = files?.[0]?.url?.split('/').pop();
                    if (fileName) updateHeaderAvatar(fileName);

                    showToast('✅ Photo updated!', 'success');
                    loadPartial(`${baseUrl}profile`);
                }, 1, true, { single: true });
            }, 50);
            return;
        }

        // --- DELETE AVATAR ---
        const deleteBtn = e.target.closest('#delete-avatar-btn');
        if (deleteBtn) {
            e.preventDefault();
            const encodedId = deleteBtn.dataset.id;
            if (!encodedId) return;

            const deleteHandler = createDeleteHandler(`${baseUrl}api/avatar-delete`, 'Avatar');
            deleteHandler.showConfirmation(encodedId, deleteBtn, (success) => {
                if (success) {
                    updateHeaderAvatar(null);
                    showToast('🗑️ Avatar removed!', 'success');
                    loadPartial(`${baseUrl}profile`);
                }
            });
        }
    });

    // --- 4. PROFILE DATA SYNC ---
    // Listens for custom event to update UI text without a partial reload
    document.addEventListener('profileDataChanged', (e) => {
        const user = e.detail;
        if (!user || !document.getElementById('profile-page-container')) return;

        const fields = {
            'fullName': user.full_name,
            'email': user.email,
            'phone': user.phone || '—',
            'address': user.address || 'No address provided',
            'city': user.city || 'Location not set',
            'areaCode': user.area_code || '—',
            'regionName': user.region_name || (user.region?.region || '')
        };

        Object.entries(fields).forEach(([field, value]) => {
            const el = document.querySelector(`[data-field="${field}"]`);
            if (el) el.textContent = value;
        });

        // Update the country name span specifically
        const countryEl = document.querySelector('[data-field="countryName"]');
        if (countryEl) {
            const cName = user.country_name || (user.country?.country || '');
            countryEl.textContent = cName ? ` (${cName})` : '';
        }

        // Update Button Data Attributes for the Edit Modal to stay in sync
        const btn = document.querySelector('[data-action="edit-user-profile"]');
        if (btn) {
            btn.dataset.fullName = user.full_name;
            btn.dataset.email = user.email;
            btn.dataset.phone = user.phone || '';
            btn.dataset.address = user.address || '';
            btn.dataset.city = user.city || '';
            btn.dataset.areaCode = user.area_code || '';
            btn.dataset.countryId = user.country_id;
            btn.dataset.regionId = user.region_id;
        }
    });

    window._profileListenersAttached = true;
}