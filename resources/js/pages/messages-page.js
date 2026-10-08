// /resources/js/pages/messages-page.js
//
// Messages: the contact-form inbox (admins only). Every thread summary lives
// in memory (seeded from #messages-data). The left pane lists threads
// (search + Inbox / Unread / Awaiting reply / Archived); the right pane shows
// the open conversation as a chat, with the reply box (emailed to the
// visitor) and the thread's actions. The list refreshes every 20s while the
// page is open, and the header / sidebar badges update as threads are read.
//
// Deep link: /messages?open={thread key} (e.g. from the new-message email).

import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { setMessagesBadge } from '../ui/unread-handler.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/messages`;
const REFRESH_MS = 20 * 1000;
const MAX_BODY = 5000;

const AVATARS = ['from-orange-400 to-rose-500', 'from-sky-400 to-indigo-500', 'from-emerald-400 to-teal-600', 'from-violet-400 to-fuchsia-500', 'from-amber-400 to-orange-500', 'from-cyan-400 to-sky-600', 'from-lime-400 to-emerald-500', 'from-pink-400 to-rose-500'];
const FILTERS = [
  ['inbox', 'Inbox', (t) => !t.archived],
  ['unread', 'Unread', (t) => !t.archived && t.unread > 0],
  ['awaiting', 'To reply', (t) => !t.archived && t.awaiting],
  ['archived', 'Archived', (t) => t.archived],
];

let data = { threads: [], counts: {}, can_email: false, me: 'Admin', contact_url: '' };
let state = { filter: 'inbox', q: '', open: null };
let current = null;          // the open thread (with messages)
let refreshTimer = null;
let drafts = {};             // unsent replies, per thread

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  inbox: 'M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4',
  archive: 'M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4',
  unread: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  send: 'M12 19l9 2-9-18-9 18 9-2zm0 0v-8',
  back: 'M15 19l-7-7 7-7',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  external: 'M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14',
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
};

function avatar(name, size = 'h-10 w-10', text = 'text-sm') {
  return `<span class="${size} flex-shrink-0 rounded-2xl bg-gradient-to-br ${AVATARS[hash(name || '?') % AVATARS.length]} flex items-center justify-center ${text} font-bold text-white shadow-sm">${escapeHtml(initials(name || '?'))}</span>`;
}

/** "3:42 PM" today, "Yesterday", "Mon", "Sep 4", "Sep 4, 2025". */
function when(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const day = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diff = Math.round((day(now) - day(d)) / 86400000);
  if (diff === 0) return d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' });
  if (diff === 1) return 'Yesterday';
  if (diff < 7) return d.toLocaleDateString('en-CA', { weekday: 'short' });
  return d.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', ...(d.getFullYear() !== now.getFullYear() ? { year: 'numeric' } : {}) });
}
const fullWhen = (iso) => (iso ? new Date(iso).toLocaleString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '');
const dayLabel = (iso) => {
  const d = new Date(iso);
  const w = when(iso);
  return /\d:\d/.test(w) ? 'Today' : (w === 'Yesterday' ? w : d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
};

async function call(method, body) {
  const res = await fetch(method === 'GET' ? `${api()}${body || ''}` : api(), method === 'GET'
    ? { cache: 'no-store' }
    : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}

function adopt(json) {
  ['threads', 'counts', 'can_email', 'me'].forEach((k) => { if (json[k] !== undefined) data[k] = json[k]; });
  setMessagesBadge(data.counts.unread || 0);
}

const thread = (key) => data.threads.find((t) => t.key === key);
const page = () => document.getElementById('messages-page');

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export function init() {
  const root = page();
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('messages-data')?.textContent || '{}') }; } catch { /* defaults */ }
  state = { filter: 'inbox', q: '', open: null };
  current = null;
  drafts = {};

  root.addEventListener('click', onClick);
  const search = document.getElementById('ms-search');
  search?.addEventListener('input', debounce(() => { state.q = search.value.trim().toLowerCase(); renderList(); }, 150));
  root.addEventListener('keydown', (e) => {
    // Rows are buttons-in-spirit: Enter / Space open them
    const row = e.target.closest?.('[data-open]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openThread(row.dataset.open); }
  });

  renderHero();
  renderFilters();
  renderList();
  renderThread();
  startRefresh();

  // Nothing opens by itself (opening marks it read) — except a deep link
  const open = new URLSearchParams(window.location.search).get('open');
  if (open && thread(open)) {
    if (thread(open).archived) state.filter = 'archived';
    renderFilters();
    openThread(open);
  }
}

function startRefresh() {
  clearInterval(refreshTimer);
  refreshTimer = setInterval(async () => {
    if (!document.body.contains(page())) { clearInterval(refreshTimer); return; }
    if (document.visibilityState !== 'visible') return;
    try {
      const before = data.threads.map((t) => `${t.key}:${t.last_at}:${t.unread}:${t.archived}`).join('|');
      adopt(await call('GET'));
      const after = data.threads.map((t) => `${t.key}:${t.last_at}:${t.unread}:${t.archived}`).join('|');
      if (before !== after) { renderHero(); renderFilters(); renderList(); }
    } catch { /* try again next time */ }
  }, REFRESH_MS);
}

// ------------------------------------------------------------
// Render: hero, filters, list
// ------------------------------------------------------------

function renderHero() {
  const el = document.getElementById('ms-hero');
  if (!el) return;
  const c = data.counts || {};
  const tile = (value, label, note, accent = 'text-white', filter = '') => `
    <button type="button" ${filter ? `data-filter="${filter}"` : 'disabled'} class="text-left rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-4 py-3 min-w-0 ${filter ? 'hover:bg-white/15 transition-colors' : 'cursor-default'}">
      <span class="block text-2xl sm:text-3xl font-bold leading-none ${accent}">${value}</span>
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">${label}</span>
      ${note ? `<span class="block text-[11px] text-white/60 mt-0.5 truncate">${note}</span>` : ''}
    </button>`;
  el.innerHTML = `
    <div class="flex flex-col xl:flex-row xl:items-end gap-5">
      <div class="min-w-0 flex-1">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">${svg(ICON.inbox, 'h-3.5 w-3.5')} Admin · Contact inbox</span>
        <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">${c.unread ? `${plural(c.unread, 'unread conversation')}` : 'You’re all caught up'}</h1>
        <p class="mt-1.5 text-sm text-secondary-100/80">Messages sent through the <a href="${escapeHtml(data.contact_url)}" data-partial class="underline decoration-white/30 hover:decoration-white">contact form</a>. Replies are emailed to the sender${data.can_email ? '' : ' — <strong class="text-amber-300">email isn’t set up on this server yet</strong>'}.</p>
      </div>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-2.5 xl:w-[34rem]">
        ${tile(c.unread || 0, 'Unread', c.unread ? 'need a look' : 'none', c.unread ? 'text-amber-300' : 'text-emerald-300', 'unread')}
        ${tile(c.awaiting || 0, 'To reply', c.awaiting ? 'waiting on you' : 'all answered', c.awaiting ? 'text-sky-300' : 'text-white', 'awaiting')}
        ${tile(c.week || 0, 'This week', 'new conversations')}
        ${tile(c.total || 0, 'All time', c.archived ? `${c.archived} archived` : '', 'text-white', 'inbox')}
      </div>
    </div>`;
}

function renderFilters() {
  const el = document.getElementById('ms-filters');
  if (!el) return;
  el.innerHTML = FILTERS.map(([key, label, fn]) => {
    const n = data.threads.filter(fn).length;
    const on = state.filter === key;
    return `<button type="button" data-filter="${key}" aria-pressed="${on}" class="flex-1 inline-flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${on ? 'bg-white text-gray-900 shadow-sm dark:bg-gray-700 dark:text-white' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}">
      ${label}${n && key !== 'inbox' ? ` <span class="rounded-full px-1.5 text-[10px] ${key === 'unread' ? 'bg-primary-500 text-white' : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-200'}">${n}</span>` : ''}</button>`;
  }).join('');
}

function visible() {
  const fn = (FILTERS.find(([k]) => k === state.filter) || FILTERS[0])[2];
  const q = state.q;
  return data.threads.filter((t) => fn(t) && (!q || `${t.name} ${t.email} ${t.subject} ${t.preview}`.toLowerCase().includes(q)));
}

function renderList() {
  const el = document.getElementById('ms-list');
  if (!el) return;
  const list = visible();
  if (!list.length) {
    const empty = state.q ? ['No matches', 'Try another name, email or word.']
      : { inbox: ['Inbox zero', 'New contact-form messages land here.'], unread: ['Nothing unread', 'You’ve seen everything that came in.'], awaiting: ['Nothing to reply to', 'Every conversation has an answer.'], archived: ['No archived conversations', 'Archive a conversation to tidy it away.'] }[state.filter];
    el.innerHTML = `<div class="px-6 py-14 text-center">
      <span class="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-500 mb-3">${svg(ICON.inbox, 'h-6 w-6')}</span>
      <p class="text-sm font-semibold text-gray-800 dark:text-gray-100">${empty[0]}</p><p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${empty[1]}</p></div>`;
    return;
  }
  el.innerHTML = list.map((t) => {
    const on = t.key === state.open;
    const unread = t.unread > 0;
    return `
      <div data-open="${escapeHtml(t.key)}" role="button" tabindex="0" aria-current="${on}"
        class="relative flex gap-3 px-4 py-3.5 cursor-pointer border-b border-gray-100 dark:border-gray-800/80 transition-colors ${on ? 'bg-primary-50/70 dark:bg-primary-950/30' : 'hover:bg-gray-50 dark:hover:bg-gray-800/40'}">
        ${on ? '<span aria-hidden="true" class="absolute inset-y-0 left-0 w-1 bg-primary-500 rounded-r"></span>' : ''}
        ${avatar(t.name)}
        <div class="min-w-0 flex-1">
          <div class="flex items-baseline gap-2">
            <p class="text-sm truncate ${unread ? 'font-bold text-gray-900 dark:text-white' : 'font-semibold text-gray-700 dark:text-gray-200'}">${escapeHtml(t.name)}</p>
            ${t.count > 1 ? `<span class="text-[10px] font-semibold text-gray-400">${t.count}</span>` : ''}
            <span class="ml-auto flex-shrink-0 text-[11px] ${unread ? 'font-bold text-primary-600 dark:text-primary-400' : 'text-gray-400'}">${when(t.last_at)}</span>
          </div>
          <p class="text-[13px] truncate ${unread ? 'font-semibold text-gray-800 dark:text-gray-100' : 'text-gray-600 dark:text-gray-300'}">${escapeHtml(t.subject)}</p>
          <div class="mt-0.5 flex items-center gap-2">
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate flex-1">${t.last_from === 'you' ? '<span class="font-semibold text-gray-400">You: </span>' : ''}${escapeHtml(t.preview)}</p>
            ${unread ? '<span class="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-primary-500 ring-4 ring-primary-500/15" title="Unread"></span>'
              : (t.awaiting && !t.archived ? '<span class="flex-shrink-0 rounded-full bg-sky-100 dark:bg-sky-950/50 px-1.5 py-0.5 text-[10px] font-bold text-sky-700 dark:text-sky-300">To reply</span>' : '')}
          </div>
        </div>
      </div>`;
  }).join('');
}

// ------------------------------------------------------------
// Conversation
// ------------------------------------------------------------

/** On small screens one pane shows at a time. */
function showPane(which) {
  const list = document.getElementById('ms-list-pane');
  const pane = document.getElementById('ms-thread-pane');
  if (!list || !pane) return;
  list.classList.toggle('hidden', which === 'thread');
  list.classList.toggle('lg:flex', true);
  pane.classList.toggle('hidden', which !== 'thread');
  pane.classList.toggle('flex', which === 'thread');
}

async function openThread(key) {
  saveDraft();
  state.open = key;
  renderList();
  showPane('thread');
  const pane = document.getElementById('ms-thread-pane');
  if (!current || current.key !== key) pane.innerHTML = '<div class="flex-1 flex items-center justify-center text-sm text-gray-400">Loading…</div>';
  try {
    const json = await call('GET', `?thread=${encodeURIComponent(key)}`);
    if (state.open !== key) return; // clicked elsewhere meanwhile
    current = json.thread;
    // Opening reads it: update the list and the badges on the spot
    const t = thread(key);
    if (t && t.unread) {
      t.unread = 0;
      if (!t.archived) data.counts.unread = Math.max(0, (data.counts.unread || 0) - 1);
      renderHero(); renderFilters(); renderList();
    }
    setMessagesBadge(json.unread ?? data.counts.unread ?? 0);
    renderThread();
  } catch (err) {
    showToast(err.message, 'error');
    current = null;
    state.open = null;
    renderThread();
  }
}

function renderThread() {
  const pane = document.getElementById('ms-thread-pane');
  if (!pane) return;
  if (!current) {
    pane.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center text-center px-8 py-16 bg-gradient-to-b from-gray-50/60 to-white dark:from-gray-950/40 dark:to-gray-900">
        <span class="inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-primary-400 to-rose-500 text-white shadow-lg shadow-primary-500/25 mb-4">${svg(ICON.chat, 'h-8 w-8')}</span>
        <p class="text-base font-bold text-gray-900 dark:text-white">Pick a conversation</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-xs">Choose a message on the left to read it and reply.</p>
      </div>`;
    return;
  }
  const t = current;
  const btn = 'inline-flex items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-semibold transition-colors';
  const mailto = `mailto:${encodeURIComponent(t.email)}?subject=${encodeURIComponent(/^re:/i.test(t.subject) ? t.subject : `Re: ${t.subject}`)}`;

  // Messages grouped by day, as chat bubbles
  let lastDay = '';
  const bubbles = t.messages.map((m) => {
    const day = dayLabel(m.at);
    const sep = day !== lastDay ? `<div class="flex items-center gap-3 my-2"><span class="h-px flex-1 bg-gray-200 dark:bg-gray-800"></span><span class="text-[11px] font-semibold uppercase tracking-wider text-gray-400">${escapeHtml(day)}</span><span class="h-px flex-1 bg-gray-200 dark:bg-gray-800"></span></div>` : '';
    lastDay = day;
    const mine = m.from === 'you';
    return `${sep}
      <div class="flex gap-2.5 ${mine ? 'flex-row-reverse' : ''}">
        ${mine ? avatar(m.name || data.me, 'h-8 w-8', 'text-[11px]') : avatar(t.name, 'h-8 w-8', 'text-[11px]')}
        <div class="max-w-[85%] sm:max-w-[75%] min-w-0 ${mine ? 'items-end' : 'items-start'} flex flex-col">
          <div class="rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${mine ? 'bg-gradient-to-br from-primary-500 to-orange-500 text-white rounded-tr-md shadow-sm shadow-primary-500/20' : 'bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-100 rounded-tl-md'}">${escapeHtml(m.body)}</div>
          <span class="mt-1 px-1 text-[11px] text-gray-400" title="${escapeHtml(fullWhen(m.at))}">${mine ? `${escapeHtml(m.name || 'You')} · emailed · ` : ''}${escapeHtml(new Date(m.at).toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' }))}</span>
        </div>
      </div>`;
  }).join('');

  pane.innerHTML = `
    <!-- Thread header -->
    <div class="flex items-start gap-3 px-4 sm:px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
      <button type="button" data-a="back" class="lg:hidden -ml-1 mt-1.5 p-1.5 rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Back to the list">${svg(ICON.back, 'h-5 w-5')}</button>
      ${avatar(t.name, 'h-11 w-11')}
      <div class="min-w-0 flex-1">
        <p class="text-base font-bold text-gray-900 dark:text-white truncate">${escapeHtml(t.subject)}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 truncate">
          <span class="font-semibold text-gray-700 dark:text-gray-200">${escapeHtml(t.name)}</span> ·
          <a href="mailto:${escapeHtml(t.email)}" class="hover:text-primary-600 hover:underline">${escapeHtml(t.email)}</a>
          <button type="button" data-a="copy" title="Copy email address" class="align-middle ml-0.5 p-0.5 rounded text-gray-400 hover:text-gray-700">${svg(ICON.copy, 'h-3.5 w-3.5')}</button>
        </p>
        <p class="text-[11px] text-gray-400 mt-0.5">First wrote ${escapeHtml(fullWhen(t.first_at))} · ${plural(t.count, 'message')}${t.archived ? ' · <span class="font-semibold text-gray-500">Archived</span>' : ''}</p>
      </div>
      <div class="flex items-center gap-0.5 flex-shrink-0">
        <button type="button" data-a="unread" class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Mark unread">${svg(ICON.unread)}<span class="hidden xl:inline">Unread</span></button>
        <button type="button" data-a="${t.archived ? 'restore' : 'archive'}" class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="${t.archived ? 'Move back to the inbox' : 'Archive'}">${svg(t.archived ? ICON.inbox : ICON.archive)}<span class="hidden xl:inline">${t.archived ? 'Unarchive' : 'Archive'}</span></button>
        <button type="button" data-a="delete" class="${btn} text-red-500 hover:bg-red-50 dark:hover:bg-red-950/40" title="Delete conversation">${svg(ICON.trash)}</button>
      </div>
    </div>

    <!-- Messages -->
    <div data-scroll class="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-5 space-y-4 bg-gradient-to-b from-gray-50/50 to-white dark:from-gray-950/30 dark:to-gray-900 max-h-[60vh] lg:max-h-none">${bubbles}</div>

    <!-- Reply -->
    <form data-reply class="border-t border-gray-100 dark:border-gray-800 p-3 sm:p-4" novalidate>
      ${data.can_email ? '' : `<p class="mb-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 px-3.5 py-2 text-xs font-medium">Email isn’t set up on this server, so replies can’t be sent from here yet. <a href="${escapeHtml(mailto)}" class="font-bold underline">Reply in your email app</a> instead.</p>`}
      <div class="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950 focus-within:border-primary-400 focus-within:ring-4 focus-within:ring-primary-400/15 transition">
        <textarea name="body" rows="3" maxlength="${MAX_BODY}" ${data.can_email ? '' : 'disabled'}
          placeholder="Write a reply to ${escapeHtml(t.name.split(' ')[0])}…"
          class="block w-full resize-none bg-transparent border-0 px-4 pt-3 pb-1 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:ring-0 outline-none max-h-60 disabled:opacity-60">${escapeHtml(drafts[t.key] || '')}</textarea>
        <div class="flex items-center gap-2 px-3 pb-2.5">
          <span class="text-[11px] text-gray-400 hidden sm:inline">Emailed to ${escapeHtml(t.email)} · <kbd class="font-sans">Ctrl</kbd>+<kbd class="font-sans">Enter</kbd> to send</span>
          <a href="${escapeHtml(mailto)}" class="ml-auto inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800" title="Reply from your own email app">${svg(ICON.external, 'h-3.5 w-3.5')} Email app</a>
          <button type="submit" ${data.can_email ? '' : 'disabled'} class="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-primary-500 to-orange-500 px-4 py-2 text-sm font-bold text-white shadow-md shadow-primary-500/25 hover:shadow-lg disabled:opacity-50 disabled:shadow-none transition">${svg(ICON.send)} Send</button>
        </div>
      </div>
    </form>`;

  const scroller = pane.querySelector('[data-scroll]');
  scroller.scrollTop = scroller.scrollHeight;
  wireReply(pane.querySelector('[data-reply]'));
}

function saveDraft() {
  const ta = document.querySelector('#ms-thread-pane [data-reply] textarea');
  if (current && ta) drafts[current.key] = ta.value;
}

function wireReply(form) {
  const ta = form.querySelector('textarea');
  const grow = () => { ta.style.height = 'auto'; ta.style.height = `${Math.min(ta.scrollHeight, 240)}px`; };
  ta.addEventListener('input', grow);
  grow();
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const body = ta.value.trim();
    if (!body) { ta.focus(); return; }
    const b = form.querySelector('button[type="submit"]');
    b.disabled = true; ta.disabled = true;
    b.innerHTML = `${svg(ICON.send)} Sending…`;
    try {
      const json = await call('POST', { action: 'reply', key: current.key, body });
      delete drafts[current.key];
      adopt(json);
      showToast(json.messages?.[0] || 'Sent.', 'success');
      renderHero(); renderFilters();
      await openThread(json.key || current.key);
    } catch (err) {
      showToast(err.message, 'error');
      b.disabled = false; ta.disabled = false;
      b.innerHTML = `${svg(ICON.send)} Send`;
    }
  });
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

async function onClick(e) {
  const f = e.target.closest('[data-filter]');
  if (f) { state.filter = f.dataset.filter; renderFilters(); renderList(); showPane('list'); return; }
  const o = e.target.closest('[data-open]');
  if (o) { openThread(o.dataset.open); return; }

  const a = e.target.closest('[data-a]')?.dataset.a;
  if (!a || !current) return;
  const t = current;
  try {
    if (a === 'back') { saveDraft(); state.open = null; renderList(); showPane('list'); return; }
    if (a === 'copy') {
      await navigator.clipboard?.writeText(t.email);
      showToast('Email address copied.', 'success');
      return;
    }
    if (a === 'delete' && !(await confirmDialog(`Delete the whole conversation with <strong>${escapeHtml(t.name)}</strong> (${plural(t.count, 'message')})? This can’t be undone.`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;

    const json = await call('POST', { action: a, key: t.key });
    adopt(json);
    showToast(json.messages?.[0] || 'Done.', 'success');
    if (a === 'unread' || a === 'archive' || a === 'delete') {
      // Leave the conversation (it's unread / tidied away / gone)
      current = null; state.open = null;
      renderThread(); showPane('list');
    } else {
      current.archived = false;
      renderThread();
    }
    renderHero(); renderFilters(); renderList();
  } catch (err) { showToast(err.message, 'error'); }
}
