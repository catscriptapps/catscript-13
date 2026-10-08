// /resources/js/utils/settings/settings-avatar.js
//
// Avatar upload/delete for the Settings page — same upload modal, endpoints,
// and delete-confirmation flow as the profile page's avatar widget (see
// utils/profile/profile-avatar.js), but reloads /settings afterward instead
// of /profile.

import { uploadModal, createUploadHandler } from '../../modals/upload-modal.js';
import { showToast } from '../../ui/toast.js';
import { loadPartial } from '../spa-router.js';
import { createDeleteHandler } from '../../factories/delete-factory.js';
import { registerImagePreview } from '../globals/preview.js';
import { updateHeaderAvatar } from '../header-avatar.js';

export function initSettingsAvatar() {
  registerImagePreview();

  if (window._settingsAvatarListenersAttached) return;
  window._settingsAvatarListenersAttached = true;

  document.addEventListener('click', (e) => {
    const baseUrl = window.APP_CONFIG.baseUrl;

    const uploadBtn = e.target.closest('#change-avatar-btn');
    if (uploadBtn) {
      e.preventDefault();
      uploadModal.open();

      setTimeout(() => {
        createUploadHandler(`${baseUrl}api/avatar-upload`, 'avatar', (files) => {
          const fileName = files?.[0]?.url?.split('/').pop();
          if (fileName) updateHeaderAvatar(fileName);

          showToast('✅ Photo updated!', 'success');
          loadPartial(`${baseUrl}settings`);
        }, 1, true, { single: true });
      }, 50);
      return;
    }

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
          loadPartial(`${baseUrl}settings`);
        }
      });
    }
  });
}
