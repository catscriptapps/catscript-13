// /resources/js/ui/live-chat-badge.js
//
// Fast-polled (~3s) unread count for the "Live Chat" sidebar nav item (see
// resources/views/partials/layout-sidebar.php's #live-chat-nav-badge) so an
// admin sees a new conversation land no matter what page they're on —
// mirrors initUnreadPolling()'s gate (only runs for a logged-in session)
// but at a much shorter interval since this specifically answers "do I
// have a new message right now." A plain poll rather than SSE: a
// background badge doesn't need a held-open connection, see
// server/api/chat-admin-unread-count.php's docblock.

const POLL_MS = 3000;

let timer = null;
let stopped = false;

/** Every live-chat badge on the page: the admin's floating bubble (components/chat-widget.php) and any nav badge. */
function updateBadge(count) {
  document.querySelectorAll('#live-chat-nav-badge, [data-live-chat-badge]').forEach((badge) => {
    if (count > 0) {
      badge.textContent = count > 99 ? '99+' : String(count);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  });
}

async function poll() {
  try {
    const res = await fetch(`${window.APP_CONFIG?.baseUrl || '/'}api/chat-admin-unread-count`, { cache: 'no-store' });

    // Non-admin (or logged-out) session — this endpoint always 403s them,
    // so there's nothing to poll for. Stop rather than retry forever.
    if (res.status === 403) {
      stopped = true;
      return;
    }

    const data = await res.json();
    if (data.success) updateBadge(data.count);
  } catch (err) {
    console.error('Live chat badge poll failed:', err);
  }
}

function schedule() {
  clearTimeout(timer);
  if (stopped) return;

  timer = setTimeout(async () => {
    if (document.visibilityState === 'visible') await poll();
    schedule();
  }, POLL_MS);
}

export function initLiveChatBadge() {
  poll();
  schedule();
}
