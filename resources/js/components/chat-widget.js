// /resources/js/components/chat-widget.js
//
// Floating live-chat bubble (guests + logged-in visitors ↔ admin). Lives
// outside #main-content in every layout, so unlike page-scoped modules this
// is initialized once from app.js on the initial page load — never
// re-initialized on SPA partial navigation (see init()'s guard below).
//
// Real-time delivery: short polling — ~1.5s while the panel is open, ~30s
// in the background to keep the bubble's unread badge honest without
// holding a connection open for no reason.
//
// This deliberately does NOT use Server-Sent Events. An SSE version was
// tried first, but this app's dev server runs via `php -S` (PHP's
// single-threaded built-in server) — a single open SSE connection blocks
// EVERY other request to the entire site for the life of that connection.
// Production's PHP execution model isn't guaranteed to fare better (many
// shared hosts run PHP-FPM with very few workers), so a feature that can
// freeze the whole site for other visitors just because one person has the
// chat panel open is an unacceptable trade for shaving a couple of seconds
// off delivery. Fast polling gets close to "instant" with zero risk to
// anything else on the site, on any hosting environment.
//
// The conversation is created lazily: nothing is written to the database
// until the visitor actually opens the bubble for the first time, so
// anonymous page views don't spam the chat_conversations table.
//
// Self-healing: the conversation id cached in localStorage can outlive the
// server-side record it points to (session expiry, or in dev, a database
// reset). Any 404 from the send/poll endpoints is treated as "this
// conversation is gone" — state is cleared and a fresh conversation is
// started transparently (reusing the guest's saved name/email so they
// aren't asked again), rather than leaving the visitor stuck on an error.

import { showToast } from '../ui/toast.js';

const STORAGE_CONVERSATION_ID = 'catscript_chat_conversation_id';
const STORAGE_LAST_SEEN_ID = 'catscript_chat_last_seen_id';
const STORAGE_GUEST_NAME = 'catscript_chat_guest_name';
const STORAGE_GUEST_EMAIL = 'catscript_chat_guest_email';
const OPEN_POLL_MS = 1500;
const CLOSED_POLL_MS = 30000;

let conversationId = null;
let lastMessageId = 0;
let panelOpen = false;
let pollTimer = null;

function baseUrl() {
  return window.APP_CONFIG?.baseUrl || '/';
}

function getStoredConversationId() {
  const stored = localStorage.getItem(STORAGE_CONVERSATION_ID);
  return stored ? Number(stored) : null;
}

function getStoredGuestName() {
  return localStorage.getItem(STORAGE_GUEST_NAME) || undefined;
}

function getStoredGuestEmail() {
  return localStorage.getItem(STORAGE_GUEST_EMAIL) || undefined;
}

function persistConversation(id, lastSeenId) {
  localStorage.setItem(STORAGE_CONVERSATION_ID, String(id));
  localStorage.setItem(STORAGE_LAST_SEEN_ID, String(lastSeenId));
}

/**
 * The conversation this browser remembered no longer exists server-side —
 * clears local state so the next attempt starts a fresh one instead of
 * repeatedly hitting the same dead id.
 */
function resetStaleConversation() {
  clearTimeout(pollTimer);
  conversationId = null;
  lastMessageId = 0;
  localStorage.removeItem(STORAGE_CONVERSATION_ID);
  localStorage.removeItem(STORAGE_LAST_SEEN_ID);
}

function renderMessage(thread, msg) {
  const isVisitor = msg.role === 'visitor';
  const wrapper = document.createElement('div');
  wrapper.className = `flex flex-col ${isVisitor ? 'items-end' : 'items-start'}`;
  wrapper.dataset.messageId = msg.id;
  wrapper.innerHTML = `
    ${msg.is_ai ? '<span class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5 px-1">AI Assistant</span>' : ''}
    <div class="max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${
      isVisitor
        ? 'bg-primary-600 text-white rounded-br-sm'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
    }"></div>
  `;
  wrapper.querySelector('div').textContent = msg.body;
  thread.appendChild(wrapper);
}

function scrollToBottom(thread) {
  thread.scrollTop = thread.scrollHeight;
}

function updateBadge(count) {
  const badge = document.getElementById('chat-widget-unread-badge');
  if (!badge) return;
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.classList.remove('hidden');
  } else {
    badge.classList.add('hidden');
  }
}

/**
 * Receives one new message from a poll response.
 */
function receiveMessage(msg) {
  const thread = document.getElementById('chat-widget-thread');
  if (!thread) return;
  renderMessage(thread, msg);
  lastMessageId = msg.id;
  persistConversation(conversationId, lastMessageId);
  scrollToBottom(thread);
}

async function pollMessages(markRead) {
  if (!conversationId) return;

  try {
    const res = await fetch(
      `${baseUrl()}api/chat-poll?conversation_id=${conversationId}&after_id=${lastMessageId}&mark_read=${markRead ? 1 : 0}`,
      { cache: 'no-store' }
    );

    if (res.status === 404) {
      resetStaleConversation();
      return;
    }

    const data = await res.json();
    if (!data.success) return;

    if (data.messages.length) {
      data.messages.forEach((msg) => receiveMessage(msg));
    }

    updateBadge(markRead ? 0 : data.unread_count);
  } catch (err) {
    console.error('Chat poll failed:', err);
  }
}

function schedulePoll() {
  clearTimeout(pollTimer);
  const interval = panelOpen ? OPEN_POLL_MS : CLOSED_POLL_MS;

  pollTimer = setTimeout(async () => {
    if (document.visibilityState === 'visible') {
      await pollMessages(panelOpen);
    }
    schedulePoll();
  }, interval);
}

async function startConversation(guestName, guestEmail) {
  const res = await fetch(`${baseUrl()}api/chat-init`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ guest_name: guestName || undefined, guest_email: guestEmail || undefined }),
  });
  try {
    return await res.json();
  } catch {
    // Non-JSON error body — show "Couldn't start chat" instead of hanging on "Loading…"
    return { success: false };
  }
}

async function sendMessage(convId, body) {
  const res = await fetch(`${baseUrl()}api/chat-send`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversation_id: convId, message: body }),
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // Non-JSON error body — data stays {}, handled as a generic failure below.
  }
  return { status: res.status, data };
}

async function openPanel() {
  const panel = document.getElementById('chat-widget-panel');
  const iconOpen = document.getElementById('chat-widget-bubble-icon-open');
  const iconClose = document.getElementById('chat-widget-bubble-icon-close');
  const thread = document.getElementById('chat-widget-thread');
  const guestForm = document.getElementById('chat-widget-guest-form');
  const composer = document.getElementById('chat-widget-composer');

  panel.classList.remove('hidden');
  iconOpen.classList.add('hidden');
  iconClose.classList.remove('hidden');
  panelOpen = true;

  if (conversationId) {
    // Returning to an existing conversation this page load — pull anything
    // missed. If it's gone stale server-side, pollMessages() clears
    // conversationId and we fall through to starting a fresh one below.
    guestForm.classList.add('hidden');
    composer.classList.remove('hidden');
    await pollMessages(true);
  }

  if (!conversationId) {
    thread.innerHTML = '<p class="text-xs text-gray-400 text-center mt-4">Loading…</p>';
    const data = await startConversation(getStoredGuestName(), getStoredGuestEmail()).catch(() => ({ success: false }));
    if (!data.success) {
      thread.innerHTML = '<p class="text-xs text-red-500 text-center mt-4">Couldn\'t start chat. Please try again.</p>';
      if (data.messages?.[0]) console.error('Chat start failed:', data.messages[0]);
      return;
    }

    conversationId = data.conversation_id;
    thread.innerHTML = '';
    data.messages.forEach((msg) => renderMessage(thread, msg));
    if (data.messages.length) lastMessageId = data.messages[data.messages.length - 1].id;
    persistConversation(conversationId, lastMessageId);

    if (data.needs_guest_info) {
      guestForm.classList.remove('hidden');
      composer.classList.add('hidden');
    } else {
      guestForm.classList.add('hidden');
      composer.classList.remove('hidden');
    }
  }

  scrollToBottom(thread);
  schedulePoll();
}

function closePanel() {
  document.getElementById('chat-widget-panel').classList.add('hidden');
  document.getElementById('chat-widget-bubble-icon-open').classList.remove('hidden');
  document.getElementById('chat-widget-bubble-icon-close').classList.add('hidden');
  panelOpen = false;
  schedulePoll();
}

function wireBubble() {
  const bubble = document.getElementById('chat-widget-bubble');
  bubble.addEventListener('click', () => {
    if (panelOpen) {
      closePanel();
    } else {
      openPanel();
    }
  });

  document.getElementById('chat-widget-close').addEventListener('click', closePanel);
}

function wireGuestForm() {
  document.getElementById('chat-widget-guest-start').addEventListener('click', async () => {
    const nameInput = document.getElementById('chat-widget-guest-name');
    const emailInput = document.getElementById('chat-widget-guest-email');
    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    if (!name) {
      showToast('Please enter your name to start chatting.', 'error');
      return;
    }

    const data = await startConversation(name, email);
    if (!data.success) {
      showToast('Something went wrong. Please try again.', 'error');
      return;
    }

    conversationId = data.conversation_id;
    persistConversation(conversationId, lastMessageId);
    localStorage.setItem(STORAGE_GUEST_NAME, name);
    if (email) localStorage.setItem(STORAGE_GUEST_EMAIL, email);

    document.getElementById('chat-widget-guest-form').classList.add('hidden');
    document.getElementById('chat-widget-composer').classList.remove('hidden');
  });
}

function wireComposer() {
  const form = document.getElementById('chat-widget-composer');
  const input = document.getElementById('chat-widget-input');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body) return;

    input.value = '';
    input.disabled = true;

    try {
      // conversationId can already be null here even though the composer is
      // showing — e.g. a background poll (see pollMessages) discovered the
      // conversation was stale and cleared it moments before the visitor
      // hit send. Treat that exactly like a 404-after-send below: start a
      // fresh conversation transparently rather than silently dropping the
      // message.
      if (!conversationId) {
        const initData = await startConversation(getStoredGuestName(), getStoredGuestEmail());

        if (!initData.success) {
          showToast('Something went wrong. Please try again.', 'error');
          return;
        }

        if (initData.needs_guest_info) {
          document.getElementById('chat-widget-guest-form').classList.remove('hidden');
          document.getElementById('chat-widget-composer').classList.add('hidden');
          showToast('We lost track of your chat — please re-enter your name to continue.', 'error');
          input.value = body;
          return;
        }

        conversationId = initData.conversation_id;
        persistConversation(conversationId, 0);
      }

      let { status, data } = await sendMessage(conversationId, body);

      if (status === 404) {
        // Stale conversation (session expired, or in dev a DB reset) —
        // start a fresh one transparently and resend rather than stopping here.
        resetStaleConversation();
        const initData = await startConversation(getStoredGuestName(), getStoredGuestEmail());

        if (!initData.success) {
          showToast('Something went wrong. Please try again.', 'error');
          return;
        }

        if (initData.needs_guest_info) {
          // No saved name to fall back on — ask again rather than lose the message.
          document.getElementById('chat-widget-guest-form').classList.remove('hidden');
          document.getElementById('chat-widget-composer').classList.add('hidden');
          showToast('We lost track of your chat — please re-enter your name to continue.', 'error');
          input.value = body;
          return;
        }

        conversationId = initData.conversation_id;
        persistConversation(conversationId, 0);
        ({ status, data } = await sendMessage(conversationId, body));
      }

      if (data.success) {
        const thread = document.getElementById('chat-widget-thread');
        renderMessage(thread, data.message);
        lastMessageId = data.message.id;
        if (data.ai_reply) {
          renderMessage(thread, data.ai_reply);
          lastMessageId = data.ai_reply.id;
        }
        persistConversation(conversationId, lastMessageId);
        scrollToBottom(thread);
      } else {
        showToast(data.messages?.[0] || 'Failed to send message.', 'error');
      }
    } catch (err) {
      console.error('Chat send failed:', err);
      showToast('Unexpected error. Please try again.', 'error');
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}

export function init() {
  const widget = document.getElementById('chat-widget');
  // Admins get a plain link to the /live-chat inbox instead (components/chat-widget.php)
  if (!widget || widget.dataset.initialized || widget.dataset.admin) return;
  widget.dataset.initialized = 'true';

  wireBubble();
  wireGuestForm();
  wireComposer();

  const storedId = getStoredConversationId();
  if (storedId) {
    conversationId = storedId;
    lastMessageId = Number(localStorage.getItem(STORAGE_LAST_SEEN_ID) || 0);
    pollMessages(false); // immediate badge check, don't wait a full interval — self-heals if stale
    schedulePoll();
  }
}
