// /resources/js/pages/live-chat-page.js
//
// Admin Live Chat inbox: conversation list (left) + active thread (right).
// Short-polls the list (~7s) and the open thread (~1.5s) — see
// chat-widget.js's docblock for why this uses polling rather than
// Server-Sent Events: this app's dev server runs via `php -S`, which is
// single-threaded, so one open SSE connection blocks every other request
// to the entire site. Production's PHP execution model isn't guaranteed to
// fare better either. Fast polling gets close to "instant" with no risk of
// an admin's open inbox freezing the site for visitors.
//
// Exported `init()` is called by app.js on full load and after partial-load
// navigation (see spa-router.js).

import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';

const LIST_POLL_MS = 7000;
const THREAD_POLL_MS = 1500;

let activeConversationId = null;
let lastMessageId = 0;
let listPollTimer = null;
let threadPollTimer = null;
let currentTab = 'open';

function baseUrl() {
  return window.APP_CONFIG?.baseUrl || '/';
}

function renderMessage(thread, msg) {
  const isAdmin = msg.role === 'admin';
  const wrapper = document.createElement('div');
  wrapper.className = `flex flex-col ${isAdmin ? 'items-end' : 'items-start'}`;
  wrapper.innerHTML = `
    ${msg.is_ai ? '<span class="text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500 mb-0.5 px-1">AI Assistant</span>' : ''}
    <div class="max-w-[75%] px-3.5 py-2 rounded-2xl text-sm ${
      isAdmin
        ? 'bg-primary-600 text-white rounded-br-sm'
        : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 rounded-bl-sm'
    }"></div>
  `;
  wrapper.querySelector('div').textContent = msg.body;
  thread.appendChild(wrapper);
}

function scrollToBottom(el) {
  el.scrollTop = el.scrollHeight;
}

async function selectConversation(id) {
  activeConversationId = Number(id);
  lastMessageId = 0;
  clearTimeout(threadPollTimer);

  document.querySelectorAll('[data-live-chat-item]').forEach((btn) => {
    btn.classList.toggle('bg-gray-50', Number(btn.dataset.conversationId) === activeConversationId);
    btn.classList.toggle('dark:bg-gray-800/60', Number(btn.dataset.conversationId) === activeConversationId);
  });

  const thread = document.getElementById('live-chat-thread');
  thread.innerHTML = '<p class="text-xs text-gray-400 text-center mt-6">Loading…</p>';

  await pollThread(true);

  pollList(); // refresh unread badges now that this one's been read
}

async function pollThread(initial = false) {
  if (!activeConversationId) return;

  try {
    const res = await fetch(
      `${baseUrl()}api/chat-admin-thread?conversation_id=${activeConversationId}&after_id=${initial ? 0 : lastMessageId}`,
      { cache: 'no-store' }
    );
    const data = await res.json();
    if (!data.success || isPageGone()) return;

    const thread = document.getElementById('live-chat-thread');
    if (initial) thread.innerHTML = '';

    if (data.messages.length) {
      data.messages.forEach((msg) => renderMessage(thread, msg));
      lastMessageId = data.messages[data.messages.length - 1].id;
      scrollToBottom(thread);
    } else if (initial) {
      thread.innerHTML = '<p class="text-xs text-gray-400 text-center mt-6">No messages yet.</p>';
    }

    document.getElementById('live-chat-thread-name').textContent = data.conversation.display_name;

    if (initial) {
      const isClosed = data.conversation.status !== 'open';
      document.getElementById('live-chat-composer').classList.toggle('hidden', isClosed);
      document.getElementById('live-chat-close-btn').classList.toggle('hidden', isClosed);

      clearTimeout(threadPollTimer);
      if (!isClosed) scheduleThreadPoll();
    }
  } catch (err) {
    console.error('Admin thread poll failed:', err);
  }
}

/**
 * True once the admin has navigated away via the SPA router —
 * #live-chat-list gets torn down with the rest of #main-content, but this
 * module's polling timers are singletons that outlive that DOM. Every poll
 * checks this first so the loop self-terminates instead of throwing on
 * null elements.
 */
function isPageGone() {
  return !document.getElementById('live-chat-list');
}

function scheduleThreadPoll() {
  clearTimeout(threadPollTimer);
  if (isPageGone()) return;

  threadPollTimer = setTimeout(async () => {
    if (isPageGone()) return;
    if (document.visibilityState === 'visible') await pollThread(false);
    scheduleThreadPoll();
  }, THREAD_POLL_MS);
}

function renderListItem(c) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.dataset.conversationId = c.id;
  btn.dataset.liveChatItem = '';
  btn.className = 'w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800/60 transition-colors';
  if (c.id === activeConversationId) {
    btn.classList.add('bg-gray-50', 'dark:bg-gray-800/60');
  }
  btn.innerHTML = `
    <div class="flex items-center justify-between gap-2">
      <span class="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate"></span>
      ${c.unread_count > 0 ? `<span class="flex-shrink-0 min-w-[1.25rem] h-5 px-1 rounded-full bg-red-600 text-white text-xs font-bold flex items-center justify-center">${c.unread_count > 99 ? '99+' : c.unread_count}</span>` : ''}
    </div>
    <span class="text-xs text-gray-400"></span>
  `;
  btn.querySelector('span.truncate').textContent = c.display_name;
  btn.querySelector('span.text-xs').textContent = c.last_message_relative || '';
  return btn;
}

async function pollList() {
  try {
    const res = await fetch(`${baseUrl()}api/chat-admin-list?status=${currentTab}`, { cache: 'no-store' });
    const data = await res.json();
    if (!data.success || isPageGone()) return;

    const list = document.getElementById('live-chat-list');
    list.innerHTML = '';

    if (!data.conversations.length) {
      list.innerHTML = `<p class="text-xs text-gray-400 text-center p-6">No ${currentTab} conversations yet.</p>`;
    } else {
      data.conversations.forEach((c) => list.appendChild(renderListItem(c)));
    }

    document.getElementById('live-chat-total').textContent = data.total;
  } catch (err) {
    console.error('Admin conversation list poll failed:', err);
  }
}

function scheduleListPoll() {
  clearTimeout(listPollTimer);
  if (isPageGone()) return;

  listPollTimer = setTimeout(async () => {
    if (isPageGone()) return;
    if (document.visibilityState === 'visible') await pollList();
    scheduleListPoll();
  }, LIST_POLL_MS);
}

function wireList() {
  document.getElementById('live-chat-list').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-live-chat-item]');
    if (btn) selectConversation(btn.dataset.conversationId);
  });
}

function wireTabs() {
  const tabs = document.querySelectorAll('[data-live-chat-tab]');
  tabs.forEach((tabBtn) => {
    tabBtn.addEventListener('click', () => {
      const tab = tabBtn.dataset.liveChatTab;
      if (tab === currentTab) return;
      currentTab = tab;

      tabs.forEach((b) => {
        const active = b === tabBtn;
        b.classList.toggle('bg-white', active);
        b.classList.toggle('dark:bg-gray-900', active);
        b.classList.toggle('shadow-sm', active);
        b.classList.toggle('text-gray-800', active);
        b.classList.toggle('dark:text-gray-200', active);
        b.classList.toggle('text-gray-500', !active);
        b.classList.toggle('dark:text-gray-400', !active);
      });

      activeConversationId = null;
      clearTimeout(threadPollTimer);
      document.getElementById('live-chat-thread').innerHTML = '<p class="text-xs text-gray-400 text-center mt-6">Pick a conversation on the left to view its messages.</p>';
      document.getElementById('live-chat-thread-name').textContent = 'Select a conversation';
      document.getElementById('live-chat-composer').classList.add('hidden');
      document.getElementById('live-chat-close-btn').classList.add('hidden');

      pollList();
    });
  });
}

function wireComposer() {
  const form = document.getElementById('live-chat-composer');
  const input = document.getElementById('live-chat-input');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = input.value.trim();
    if (!body || !activeConversationId) return;

    input.value = '';
    input.disabled = true;

    try {
      const res = await fetch(`${baseUrl()}api/chat-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activeConversationId, message: body }),
      });
      const data = await res.json();

      if (data.success) {
        const thread = document.getElementById('live-chat-thread');
        renderMessage(thread, data.message);
        lastMessageId = data.message.id;
        scrollToBottom(thread);
      } else {
        showToast(data.messages?.[0] || 'Failed to send reply.', 'error');
      }
    } catch (err) {
      console.error('Admin reply send failed:', err);
      showToast('Unexpected error. Please try again.', 'error');
    } finally {
      input.disabled = false;
      input.focus();
    }
  });
}

function wireCloseButton() {
  document.getElementById('live-chat-close-btn').addEventListener('click', async () => {
    if (!activeConversationId) return;

    const confirmed = await confirmDialog(
      'Close this conversation? The visitor will need to start a new one to reach you again.',
      'Close Conversation',
      'Cancel',
      'bg-red-600 hover:bg-red-700'
    );
    if (!confirmed) return;

    try {
      const res = await fetch(`${baseUrl()}api/chat-close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: activeConversationId }),
      });
      const data = await res.json();

      if (data.success) {
        showToast('Conversation closed.', 'success');
        clearTimeout(threadPollTimer);
        activeConversationId = null;
        document.getElementById('live-chat-thread').innerHTML = '<p class="text-xs text-gray-400 text-center mt-6">Pick a conversation on the left to view its messages.</p>';
        document.getElementById('live-chat-thread-name').textContent = 'Select a conversation';
        document.getElementById('live-chat-composer').classList.add('hidden');
        document.getElementById('live-chat-close-btn').classList.add('hidden');
        pollList();
      } else {
        showToast(data.messages?.[0] || 'Failed to close conversation.', 'error');
      }
    } catch (err) {
      console.error('Close conversation failed:', err);
      showToast('Unexpected error. Please try again.', 'error');
    }
  });
}

async function loadAiSettings() {
  const toggle = document.getElementById('chat-ai-toggle');
  const textarea = document.getElementById('chat-ai-instructions');
  const notConfigured = document.getElementById('chat-ai-not-configured');
  if (!toggle) return;

  try {
    const res = await fetch(`${baseUrl()}api/chat-ai-settings`, { cache: 'no-store' });
    const data = await res.json();
    if (!data.success) return;

    toggle.checked = data.enabled;
    textarea.value = data.instructions || '';
    notConfigured.classList.toggle('hidden', data.configured);
  } catch (err) {
    console.error('Failed to load AI autorespond settings:', err);
  }
}

async function saveAiSettings(overrides = {}) {
  const toggle = document.getElementById('chat-ai-toggle');
  const textarea = document.getElementById('chat-ai-instructions');
  const notConfigured = document.getElementById('chat-ai-not-configured');

  const payload = {
    enabled: overrides.enabled ?? toggle.checked,
    instructions: overrides.instructions ?? textarea.value,
  };

  try {
    const res = await fetch(`${baseUrl()}api/chat-ai-settings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!data.success) {
      toggle.checked = !payload.enabled; // revert an optimistic toggle flip
      showToast(data.messages?.[0] || 'Failed to save Autorespond settings.', 'error');
      return;
    }

    toggle.checked = data.enabled;
    notConfigured.classList.toggle('hidden', data.configured);
    showToast('Autorespond settings saved.', 'success');
  } catch (err) {
    console.error('Failed to save AI autorespond settings:', err);
    toggle.checked = !payload.enabled;
    showToast('Unexpected error. Please try again.', 'error');
  }
}

function wireAiSettings() {
  const toggle = document.getElementById('chat-ai-toggle');
  const saveBtn = document.getElementById('chat-ai-save');
  if (!toggle) return;

  toggle.addEventListener('change', () => saveAiSettings({ enabled: toggle.checked }));
  saveBtn.addEventListener('click', () => saveAiSettings());

  loadAiSettings();
}

export function init() {
  const page = document.getElementById('live-chat-list');
  if (!page || page.dataset.initialized) return;
  page.dataset.initialized = 'true';

  wireList();
  wireTabs();
  wireComposer();
  wireCloseButton();
  wireAiSettings();
  scheduleListPoll();
}
