// /resources/js/pages/settings-page.js
//
// Settings (views/pages/settings.php): section tabs (deep-linkable via
// #account / #security / #appearance / #admin), the profile photo, the
// Security panel (api/account-security) and Appearance (theme + sidebar,
// through Alpine's stores so the header and layout follow instantly).
// Nothing here needs saving — every control applies on the spot.

import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { escapeHtml } from '../utils/escape-html.js';
import { uploadModal, createUploadHandler } from '../modals/upload-modal.js';
import { createDeleteHandler } from '../factories/delete-factory.js';
import { registerImagePreview } from '../utils/globals/preview.js';
import { updateHeaderAvatar } from '../utils/header-avatar.js';
import { initChangePasswordTrigger } from '../modals/change-password-modal.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const page = () => document.getElementById('settings-page');

let listening = false;
let securityLoaded = false;

export function init() {
  if (!page()) return;
  registerImagePreview();
  initChangePasswordTrigger();
  securityLoaded = false; // fresh sign-in list on every visit

  showTab(location.hash.slice(1), false);
  syncAppearance();

  if (!listening) {
    // Delegated once: the page itself is swapped in and out by the SPA router
    listening = true;
    document.addEventListener('click', onClick);
    window.addEventListener('hashchange', () => { if (page()) showTab(location.hash.slice(1), false); });
    // Header theme button / device theme changes → keep the cards in step
    window.Alpine?.effect(() => {
      window.Alpine.store('theme').pref; // track
      window.Alpine.store('sidebar').expanded; // track
      syncAppearance();
    });
  }
}

// ------------------------------------------------------------
// Tabs
// ------------------------------------------------------------

function showTab(key, updateUrl = true) {
  const root = page();
  if (!root) return;
  const tabs = [...root.querySelectorAll('[data-settings-tab]')];
  if (!tabs.some((t) => t.dataset.settingsTab === key)) key = 'account';

  tabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.settingsTab === key)));
  root.querySelectorAll('[data-settings-panel]').forEach((p) => { p.hidden = p.dataset.settingsPanel !== key; });

  if (updateUrl) history.replaceState(history.state, '', key === 'account' ? location.pathname : `#${key}`);
  if (key === 'security' && !securityLoaded) loadSecurity();
}

function onClick(e) {
  if (!page()?.contains(e.target)) return;

  const tab = e.target.closest('[data-settings-tab]');
  if (tab) return showTab(tab.dataset.settingsTab);

  const theme = e.target.closest('[data-theme-choice]');
  if (theme) {
    const pref = theme.dataset.themeChoice;
    window.Alpine.store('theme').set(pref);
    return showToast({ light: 'Light theme on', dark: 'Dark theme on', system: 'Theme follows your device' }[pref], 'success');
  }

  const sidebar = e.target.closest('[data-sidebar-choice]');
  if (sidebar) {
    window.Alpine.store('sidebar').expanded = sidebar.dataset.sidebarChoice === 'expanded';
    return;
  }

  const action = e.target.closest('[data-settings-action]');
  if (!action) return;
  e.preventDefault();
  if (action.dataset.settingsAction === 'upload-avatar') uploadAvatar();
  if (action.dataset.settingsAction === 'remove-avatar') removeAvatar(action);
  if (action.dataset.settingsAction === 'sign-out-others') signOutOthers(action);
}

// ------------------------------------------------------------
// Appearance
// ------------------------------------------------------------

function syncAppearance() {
  const root = page();
  const Alpine = window.Alpine;
  if (!root || !Alpine) return;
  const pref = Alpine.store('theme').pref;
  const expanded = Alpine.store('sidebar').expanded;
  root.querySelectorAll('[data-theme-choice]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.themeChoice === pref)));
  root.querySelectorAll('[data-sidebar-choice]').forEach((b) => b.setAttribute('aria-checked', String((b.dataset.sidebarChoice === 'expanded') === expanded)));
}

// ------------------------------------------------------------
// Profile photo — updated in place (header and sidebar card too)
// ------------------------------------------------------------

function initialOf() {
  const name = document.querySelector('#settings-page h1')?.textContent.trim() || 'U';
  return escapeHtml(name.charAt(0).toUpperCase());
}

function renderAvatar(url) {
  const root = page();
  if (!root) return;
  const img = url ? `<img src="${escapeHtml(url)}" alt="" class="h-full w-full object-cover">` : initialOf();
  root.querySelectorAll('[data-settings-avatar], [data-settings-avatar-large]').forEach((el) => { el.innerHTML = img; });
  const large = root.querySelector('[data-settings-avatar-large]');
  if (large) {
    large.dataset.imgSrc = url || '';
    large.classList.toggle('cursor-zoom-in', !!url);
  }
  root.querySelector('[data-settings-action="remove-avatar"]')?.classList.toggle('hidden', !url);
  const uploadLabel = root.querySelector('button[data-settings-action="upload-avatar"].rounded-xl');
  if (uploadLabel) uploadLabel.lastChild.textContent = url ? ' Upload a new photo' : ' Upload a photo';

  // The sidebar's personal card (outside #main-content)
  const card = document.querySelector('aside a[href$="/profile"][title="Your profile"] span.relative');
  if (card) {
    card.firstElementChild.outerHTML = url
      ? `<img src="${escapeHtml(url)}" alt="" class="h-10 w-10 rounded-xl object-cover ring-2 ring-primary-500/60">`
      : `<span class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-400 to-primary-600 text-sm font-bold ring-2 ring-primary-500/40">${initialOf()}</span>`;
  }
}

function uploadAvatar() {
  uploadModal.open();
  setTimeout(() => {
    createUploadHandler(`${base()}api/avatar-upload`, 'avatar', (files) => {
      const url = files?.[0]?.url;
      const fileName = url?.split('/').pop();
      if (fileName) {
        updateHeaderAvatar(fileName);
        renderAvatar(`${window.APP_CONFIG?.assetBase || '/'}images/uploads/avatars/${fileName}`);
      }
      showToast('Photo updated', 'success');
    }, 1, true, { single: true });
  }, 50);
}

function removeAvatar(btn) {
  createDeleteHandler(`${base()}api/avatar-delete`, 'Avatar').showConfirmation(btn.dataset.id, btn, (success) => {
    if (!success) return;
    updateHeaderAvatar(null);
    renderAvatar('');
    showToast('Photo removed', 'success');
  });
}

// ------------------------------------------------------------
// Security
// ------------------------------------------------------------

async function loadSecurity() {
  try {
    const res = await fetch(`${base()}api/account-security`, { cache: 'no-store' });
    const json = await res.json();
    if (!json.success) throw new Error(json.messages?.[0] || 'Could not load');
    securityLoaded = true;
    renderSecurity(json);
  } catch (err) {
    const list = page()?.querySelector('[data-security-signins]');
    if (list) list.innerHTML = `<li class="px-5 sm:px-6 py-4 text-sm text-red-500">Couldn’t load your sign-ins. ${escapeHtml(err.message)}</li>`;
  }
}

function renderSecurity(data) {
  const root = page();
  if (!root) return;
  root.querySelector('[data-security-this-device]').textContent = data.this_device;

  const n = data.other_sessions;
  const others = root.querySelector('[data-security-others]');
  others.textContent = n ? `${n} other ${n === 1 ? 'device' : 'devices'} signed in` : 'No other devices signed in';
  others.className = `inline-flex items-center rounded-lg px-3 py-1.5 font-semibold ${n ? 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}`;

  const list = root.querySelector('[data-security-signins]');
  list.innerHTML = data.signins.length
    ? data.signins.map((s, i) => `
      <li class="flex items-center gap-3 px-5 sm:px-6 py-3.5">
        <span class="h-9 w-9 flex-shrink-0 rounded-xl flex items-center justify-center ${i === 0 ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40 dark:text-emerald-400' : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'}">
          <svg class="h-[18px] w-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75"><path stroke-linecap="round" stroke-linejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" /></svg>
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(s.device)}</span>
          <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${s.ip ? `IP ${escapeHtml(s.ip)}` : 'IP unknown'}</span>
        </span>
        <time class="flex-shrink-0 text-xs text-gray-400" datetime="${escapeHtml(s.at || '')}">${escapeHtml(s.ago)}</time>
      </li>`).join('')
    : '<li class="px-5 sm:px-6 py-4 text-sm text-gray-400">No sign-ins recorded yet.</li>';
}

async function signOutOthers(btn) {
  const ok = await confirmDialog('Sign out of every other browser and device? You’ll stay signed in here.', 'Sign them out', 'Cancel', 'bg-primary-600 hover:bg-primary-700');
  if (!ok) return;
  btn.disabled = true;
  try {
    const res = await fetch(`${base()}api/account-security`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sign-out-others' }),
    });
    const json = await res.json();
    showToast(json.messages?.[0] || (json.success ? 'Done' : 'Something went wrong'), json.success ? 'success' : 'error');
    if (json.success) renderSecurity(json);
  } catch {
    showToast('Could not reach the server — try again.', 'error');
  } finally {
    btn.disabled = false;
  }
}
