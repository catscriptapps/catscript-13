// /resources/js/utils/header-avatar.js
//
// The account avatar in the top-right header (#header-account-avatar, see
// partials/{layout,contractor,landlord,real-estate-world}-header.php and
// layouts/portal.php) lives in the layout shell, outside #main-content —
// a loadPartial('profile'|'settings') refresh only ever swaps #main-content,
// so it never touches the header on its own. Both profile-avatar.js and
// settings-avatar.js (the two places a user can change their own avatar)
// call this right after a successful upload/delete so the header updates
// immediately instead of waiting for the next full page load.

/**
 * @param {string|null} avatarFileName Pass a filename to switch the header
 *   to that image, or null/'' to fall back to the initial (read from the
 *   element's own data-initial, set server-side).
 */
export function updateHeaderAvatar(avatarFileName) {
  const el = document.getElementById('header-account-avatar');
  if (!el) return;

  const accentClass = el.dataset.accentClass;

  if (avatarFileName) {
    const assetBase = window.APP_CONFIG?.assetBase || '/';
    if (accentClass) el.classList.remove(accentClass);
    el.innerHTML = `<img src="${assetBase}images/uploads/avatars/${avatarFileName}" alt="Avatar" class="w-full h-full object-cover">`;
  } else {
    if (accentClass) el.classList.add(accentClass);
    el.textContent = el.dataset.initial || '';
  }
}
