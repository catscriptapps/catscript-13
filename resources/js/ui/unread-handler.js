// /resources/js/ui/unread-handler.js

/**
 * One request to rule them all.
 * Updates every unread badge in a single heartbeat (api/global-unread):
 * messages — the admin's contact-form inbox (header envelope + sidebar,
 * any [data-messages-badge] or #messages-badge), chats and notifications.
 */

const POLL_MS = 30000;
let started = false;

function badgesFor(key) {
  const sel = key === 'messages' ? '#messages-badge, [data-messages-badge]' : `#${key}-badge`;
  return [...document.querySelectorAll(sel)];
}

function setBadge(key, count) {
  badgesFor(key).forEach((el) => {
    if (count > 0) {
      // Only numeric badges get text (not the red-dot notification)
      if (key !== 'notifications') el.textContent = count > 99 ? '99+' : String(count);
      el.classList.remove('hidden');
    } else {
      el.classList.add('hidden');
      if (key !== 'notifications') el.textContent = '';
    }
  });
}

/** Set the messages badges right away (e.g. after opening a thread) without waiting for the next poll. */
export function setMessagesBadge(count) {
  setBadge('messages', count);
}

async function updateAllBadges() {
  try {
    const res = await fetch(`${window.APP_CONFIG.baseUrl}api/global-unread`, { cache: 'no-store' });
    const data = await res.json();
    if (data.success) ['messages', 'chats', 'notifications'].forEach((key) => setBadge(key, data.counts[key]));
  } catch (err) {
    console.error('Heartbeat failed:', err);
  }
}

export function initUnreadPolling() {
  if (started) return;
  started = true;
  updateAllBadges();
  setInterval(() => { if (document.visibilityState === 'visible') updateAllBadges(); }, POLL_MS);
  // Coming back to the tab: catch up at once
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') updateAllBadges(); });
}
