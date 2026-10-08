// /resources/js/pages/timetable-page.js
//
// Timetable: categories + every activity live in memory (seeded from
// #timetable-data). render() draws the pinned toolbar summary, the day
// headers and the week — an hour-by-hour grid on wide screens (blocks sized
// by duration, overlaps side by side, a "now" line, click an empty spot to
// add there) and a day-by-day list on phones. Saves patch that state from
// the API response and re-render, so everything updates on the spot.
//
// data.can_edit comes from the server (Timetable Editor capability); without
// it the page is read-only and the API refuses changes anyway.
//
// Guest mode (data-mode="guest", not signed in): the timetable lives in this
// browser (utils/timetable/guest-store.js), which answers every action the
// API would — so post() is the only thing that changes.
//
// Page listeners are delegated from #timetable-page, which the SPA router
// replaces on each visit; document-level listeners are bound once.

import { Modal } from '../factories/modal-factory.js';
import { FormValidator } from '../utils/form-validator.js';
import { buttonSpinner } from '../utils/spinner-utils.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { escapeHtml } from '../utils/escape-html.js';
import { guestTimetable } from '../utils/timetable/guest-store.js';
import { createScreensaver, SAVER_IDLE_MS } from '../utils/screensaver.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/timetable`;

const HOUR_PX = 60;          // grid height of one hour
const SNAP_MIN = 15;         // click-to-add snaps to this many minutes
const WIDE = '(min-width: 1024px)';

/** Category colour key -> classes (full strings, so Tailwind keeps them). */
const COLORS = {
  navy:    { block: 'bg-secondary-100 text-secondary-900 border-secondary-600 dark:bg-secondary-900 dark:text-secondary-50 dark:border-secondary-300', dot: 'bg-secondary-600 dark:bg-secondary-300' },
  indigo:  { block: 'bg-indigo-100 text-indigo-900 border-indigo-500 dark:bg-indigo-950 dark:text-indigo-100', dot: 'bg-indigo-500' },
  violet:  { block: 'bg-violet-100 text-violet-900 border-violet-500 dark:bg-violet-950 dark:text-violet-100', dot: 'bg-violet-500' },
  purple:  { block: 'bg-purple-100 text-purple-900 border-purple-500 dark:bg-purple-950 dark:text-purple-100', dot: 'bg-purple-500' },
  fuchsia: { block: 'bg-fuchsia-100 text-fuchsia-900 border-fuchsia-500 dark:bg-fuchsia-950 dark:text-fuchsia-100', dot: 'bg-fuchsia-500' },
  pink:    { block: 'bg-pink-100 text-pink-900 border-pink-500 dark:bg-pink-950 dark:text-pink-100', dot: 'bg-pink-500' },
  rose:    { block: 'bg-rose-100 text-rose-900 border-rose-500 dark:bg-rose-950 dark:text-rose-100', dot: 'bg-rose-500' },
  red:     { block: 'bg-red-100 text-red-900 border-red-500 dark:bg-red-950 dark:text-red-100', dot: 'bg-red-500' },
  orange:  { block: 'bg-orange-100 text-orange-900 border-orange-500 dark:bg-orange-950 dark:text-orange-100', dot: 'bg-orange-500' },
  amber:   { block: 'bg-amber-100 text-amber-900 border-amber-500 dark:bg-amber-950 dark:text-amber-100', dot: 'bg-amber-500' },
  yellow:  { block: 'bg-yellow-100 text-yellow-900 border-yellow-500 dark:bg-yellow-950 dark:text-yellow-100', dot: 'bg-yellow-500' },
  lime:    { block: 'bg-lime-100 text-lime-900 border-lime-500 dark:bg-lime-950 dark:text-lime-100', dot: 'bg-lime-500' },
  green:   { block: 'bg-green-100 text-green-900 border-green-500 dark:bg-green-950 dark:text-green-100', dot: 'bg-green-500' },
  emerald: { block: 'bg-emerald-100 text-emerald-900 border-emerald-500 dark:bg-emerald-950 dark:text-emerald-100', dot: 'bg-emerald-500' },
  teal:    { block: 'bg-teal-100 text-teal-900 border-teal-500 dark:bg-teal-950 dark:text-teal-100', dot: 'bg-teal-500' },
  cyan:    { block: 'bg-cyan-100 text-cyan-900 border-cyan-500 dark:bg-cyan-950 dark:text-cyan-100', dot: 'bg-cyan-500' },
  sky:     { block: 'bg-sky-100 text-sky-900 border-sky-500 dark:bg-sky-950 dark:text-sky-100', dot: 'bg-sky-500' },
  blue:    { block: 'bg-blue-100 text-blue-900 border-blue-500 dark:bg-blue-950 dark:text-blue-100', dot: 'bg-blue-500' },
  stone:   { block: 'bg-stone-200 text-stone-900 border-stone-500 dark:bg-stone-800 dark:text-stone-100', dot: 'bg-stone-500' },
  gray:    { block: 'bg-gray-100 text-gray-800 border-gray-400 dark:bg-gray-800 dark:text-gray-100', dot: 'bg-gray-400' },
};

let data = { categories: [], activities: [], can_edit: false, days: [] };
let hidden = new Set();     // category ids filtered out
let mobileDay = '';
let modal = null;
let nowTimer = null;
let docBound = false;
let mode = 'account';

// Live mode — for a timetable left open on a wall screen / tablet: once
// nobody has touched the page for IDLE_MS, it follows the clock (keeps the
// "now" line in view, rolls over at midnight) and re-syncs from the server.
const TICK_MS = 30 * 1000;
const IDLE_MS = 90 * 1000;
const SYNC_MS = 5 * 60 * 1000;
const LIVE_KEY = 'catscript.timetable.live';
const NOW_RING = ['ring-2', 'ring-red-400', 'ring-offset-2', 'ring-offset-white', 'dark:ring-offset-gray-900'];
let lastInteraction = Date.now();
let autoScrolling = false;
let lastDay = '';
let lastSync = Date.now();
let live = true;

// Screensaver (utils/screensaver.js) — protects a TV left showing the
// timetable for hours: after SAVER_MS alone (Live on or off), a dimmed photo backdrop
// with a drifting clock + Now/Next card. Any input brings the timetable back.
const SAVER_MS = SAVER_IDLE_MS; // utils/screensaver.js — 5 minutes, the same on every page that has one
let saver = null;
const isGuest = () => mode === 'guest';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const toHHMM = (min) => `${String(Math.floor(min / 60) % 24).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
const label = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const hourLabel = (h) => (h === 0 || h === 24 ? '12 AM' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`);
const range = (a) => `${label(a.start)} – ${label(a.end)}`;
const duration = (mins) => { const h = Math.floor(mins / 60), m = mins % 60; return [h ? `${h}h` : '', m ? `${m}m` : ''].filter(Boolean).join(' ') || '0m'; };
const todayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const cat = (id) => data.categories.find((c) => c.id === id) || { id, name: 'Other', color: 'gray' };
const color = (id) => COLORS[cat(id).color] || COLORS.gray;
const isWide = () => window.matchMedia(WIDE).matches;
const dayActivities = (day) => data.activities.filter((a) => a.day === day).sort((x, y) => x.start.localeCompare(y.start) || x.end.localeCompare(y.end));
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  plus: 'M12 4v16m8-8H4',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  warn: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  check: 'M5 13l4 4L19 7',
};

async function post(body) {
  if (isGuest()) {
    const json = guestTimetable.handle(body);
    if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
    return json;
  }
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}

function adoptState(json) {
  if (json.categories) data.categories = json.categories;
  if (json.activities) data.activities = json.activities;
  if (typeof json.can_edit === 'boolean') data.can_edit = json.can_edit;
}

function upsertActivities(list) {
  list.forEach((a) => {
    const i = data.activities.findIndex((x) => x.encoded_id === a.encoded_id);
    if (i >= 0) data.activities[i] = a; else data.activities.push(a);
  });
  recount();
}

function recount() {
  const counts = {};
  data.activities.forEach((a) => { counts[a.category_id] = (counts[a.category_id] || 0) + 1; });
  data.categories.forEach((c) => { c.count = counts[c.id] || 0; });
}

function errorsHtml(err) {
  return (err.messages || [err.message]).map((m) =>
    `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('timetable-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = JSON.parse(document.getElementById('timetable-data')?.textContent || '{}'); } catch { /* keep defaults */ }
  data = { categories: [], activities: [], can_edit: false, days: [], ...data };
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  if (isGuest()) data = { ...data, ...guestTimetable.load() };
  hidden = new Set();
  mobileDay = data.days.includes(todayName()) ? todayName() : data.days[0];

  page.addEventListener('click', onPageClick);

  if (!docBound) {
    docBound = true;
    document.addEventListener('click', (e) => { if (!e.target.closest('[data-menu-root]')) closeMenus(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
    window.matchMedia(WIDE).addEventListener('change', () => { if (document.getElementById('timetable-page')) render(); });
    // Anything a person does counts as "in use"; our own smooth scrolls don't
    const touched = () => { lastInteraction = Date.now(); };
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((ev) => window.addEventListener(ev, touched, { passive: true }));
    window.addEventListener('scroll', () => { if (!autoScrolling) touched(); }, { passive: true });
  }

  saver?.remove(); // a fresh visit gets its own, built from this visit's photos
  saver = createScreensaver({
    id: 'tt-saver',
    slides: data.slides || [],
    paint: saverLines,
    hint: 'Move the mouse or tap anywhere to return to the timetable',
    onWake: () => { lastInteraction = Date.now(); },
  });
  try { live = localStorage.getItem(LIVE_KEY) !== 'off'; } catch { live = true; }
  lastDay = todayName();
  lastSync = Date.now();
  lastInteraction = Date.now();

  render();
  startHeroSlides();
  scrollToNow();

  clearInterval(nowTimer);
  nowTimer = setInterval(tick, TICK_MS);
}

// ------------------------------------------------------------
// Live mode
// ------------------------------------------------------------

const idle = () => Date.now() - lastInteraction >= IDLE_MS;

/** Someone is mid-task (modal, dialog, open menu, typing) — never move the page under them. */
function busy() {
  return document.body.style.overflow === 'hidden'
    || !!document.getElementById('confirm-proceed')
    || !!document.querySelector('#timetable-page [data-menu]:not(.hidden)')
    || !!document.activeElement?.matches?.('input, textarea, select');
}

async function tick() {
  if (!document.getElementById('timetable-page')) { clearInterval(nowTimer); saver?.remove(); return; }
  if (document.visibilityState !== 'visible') return;

  // Midnight: a new "today"
  if (todayName() !== lastDay) {
    lastDay = todayName();
    if (!isWide() && (live || idle())) mobileDay = lastDay;
    render();
  } else {
    placeNowLine();
    markNow();
    renderSummary();
    renderHero();
  }

  if (!idle() || busy()) return;

  // The screensaver protects the screen whether or not Live is on
  if (saver && !saver.isOpen() && Date.now() - lastInteraction >= SAVER_MS) saver.show();
  if (!live) return;

  if (!isGuest() && Date.now() - lastSync >= SYNC_MS) await syncFromServer();
  followNow();
}

// ------------------------------------------------------------
// Screensaver card
// ------------------------------------------------------------

/** "Now" / "Next" lines for the screensaver card (today, honouring the category filter). */
function saverLines() {
  const m = nowMin();
  const today = dayActivities(todayName()).filter((a) => !hidden.has(a.category_id));
  const current = today.find((a) => toMin(a.start) <= m && m < toMin(a.end));
  const next = today.find((a) => toMin(a.start) > m);
  const line = (tag, a, when) => `
    <div class="flex items-center gap-3">
      <span class="h-3 w-3 flex-shrink-0 rounded-full ${color(a.category_id).dot} opacity-80"></span>
      <p class="min-w-0 text-xl sm:text-2xl text-white/80 truncate"><span class="text-white/45 text-base sm:text-lg uppercase tracking-widest mr-2">${tag}</span>${escapeHtml(a.name)}</p>
      <span class="ml-auto flex-shrink-0 text-base sm:text-lg text-white/45">${when}</span>
    </div>`;
  return (current ? line('Now', current, `until ${label(current.end)}`) : '')
    + (next ? line('Next', next, label(next.start)) : '')
    || '<p class="text-lg text-white/45">Nothing else planned today.</p>';
}

/** Pick up changes made elsewhere (another device, another person). */
async function syncFromServer() {
  lastSync = Date.now();
  try {
    const res = await fetch(api(), { cache: 'no-store' });
    const json = await res.json();
    if (!json.success || busy()) return;
    adoptState(json);
    render();
  } catch { /* offline for a moment — try again next time */ }
}

/** Glide the view so "now" (or today's current / next activity) is in sight. */
function followNow() {
  const sticky = document.getElementById('tt-sticky');
  const pinned = (sticky?.offsetHeight || 0) + 80; // app header + pinned toolbar
  let targetY = null;

  if (isWide()) {
    const line = document.querySelector('#tt-body [data-now]');
    if (!line) return;
    const lineY = line.getBoundingClientRect().top + window.scrollY;
    targetY = lineY - pinned - (window.innerHeight - pinned) * 0.3;
  } else {
    if (mobileDay !== todayName()) { mobileDay = todayName(); renderList(); }
    const rows = [...document.querySelectorAll('#tt-body [data-activity][data-day]')];
    const m = nowMin();
    const row = rows.find((r) => toMin(r.dataset.start) <= m && m < toMin(r.dataset.end)) || rows.find((r) => toMin(r.dataset.start) > m);
    if (!row) return;
    targetY = row.getBoundingClientRect().top + window.scrollY - pinned - 16;
  }

  targetY = Math.max(0, Math.round(targetY));
  if (Math.abs(window.scrollY - targetY) < 6) return;
  autoScrolling = true;
  window.scrollTo({ top: targetY, behavior: 'smooth' });
  setTimeout(() => { autoScrolling = false; }, 1200);
}

/** Ring whatever is happening right now (today, start <= now < end). */
function markNow() {
  const today = todayName();
  const m = nowMin();
  document.querySelectorAll('#tt-body [data-activity][data-day]').forEach((el) => {
    const on = el.dataset.day === today && toMin(el.dataset.start) <= m && m < toMin(el.dataset.end);
    NOW_RING.forEach((c) => el.classList.toggle(c, on));
  });
}

function toggleLive() {
  live = !live;
  try { localStorage.setItem(LIVE_KEY, live ? 'on' : 'off'); } catch { /* per-browser preference only */ }
  renderLiveToggle();
  if (live) { lastInteraction = 0; followNow(); lastInteraction = Date.now() - IDLE_MS; }
  showToast(live ? 'Live — the timetable will follow the clock when left alone.' : 'Live off — the timetable stays where you leave it.', 'success');
}

function renderLiveToggle() {
  const btn = document.querySelector('#timetable-page [data-act="live"]');
  if (!btn) return;
  btn.setAttribute('aria-pressed', String(live));
  btn.title = live ? 'Following the clock when left alone — click to stop' : 'Click to follow the clock when left alone';
  btn.querySelector('[data-live-dot]')?.classList.toggle('animate-pulse', live);
  const label = btn.querySelector('[data-live-label]');
  if (label) label.textContent = live ? 'Live' : 'Live off';
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function render() {
  document.querySelectorAll('#timetable-page [data-edit-only]').forEach((el) => el.classList.toggle('hidden', !data.can_edit));
  renderSummary();
  renderHero();
  renderFilter();
  renderLiveToggle();
  if (isWide()) renderGrid(); else renderList();
}

/** Today's activities (honouring the category filter) and what's on now / next. */
function todayNow() {
  const m = nowMin();
  const today = dayActivities(todayName()).filter((a) => !hidden.has(a.category_id));
  const current = today.filter((a) => toMin(a.start) <= m && m < toMin(a.end)).pop() || null;
  const next = today.find((a) => toMin(a.start) > m) || null;
  return { m, today, current, next };
}
const inMins = (mins) => (mins < 60 ? `${mins} min` : duration(mins));

function renderSummary() {
  const el = document.querySelector('#timetable-page [data-tt-summary]');
  if (!el) return;
  const mins = data.activities.reduce((s, a) => s + (toMin(a.end) - toMin(a.start)), 0);
  const n = data.activities.length;
  const { m, current, next } = todayNow();

  // The Now banner: a bold red pill that pulses, with the time left beside it
  const nowText = current
    ? `<span class="inline-flex min-w-0 items-center gap-2 rounded-full bg-red-600 pl-2.5 pr-3.5 py-1 text-sm font-bold text-white shadow-md shadow-red-600/30 ring-2 ring-red-200 dark:ring-red-900/70">
        <span class="relative flex h-2.5 w-2.5 flex-shrink-0"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-white"></span></span>
        <span class="text-[11px] font-black uppercase tracking-widest text-red-100">Now</span>
        <span class="truncate">${escapeHtml(current.name)}</span></span>
      <span class="flex-shrink-0 whitespace-nowrap text-sm font-bold text-red-600 dark:text-red-400">until ${label(current.end)} · ${inMins(toMin(current.end) - m)} left</span>`
    : next
      ? `<span class="inline-flex min-w-0 items-center gap-2 rounded-full bg-gray-900 dark:bg-white pl-2.5 pr-3.5 py-1 text-sm font-bold text-white dark:text-gray-900 shadow-sm">
          <span class="text-[11px] font-black uppercase tracking-widest opacity-70">Next</span>
          <span class="truncate">${escapeHtml(next.name)}</span></span>
        <span class="flex-shrink-0 whitespace-nowrap text-sm font-semibold text-gray-700 dark:text-gray-200">at ${label(next.start)} · in ${inMins(toMin(next.start) - m)}</span>`
      : '';
  const stats = n
    ? `${n} ${n === 1 ? 'activity' : 'activities'} · ${duration(mins)} a week${data.can_edit ? '' : ' · <span class="font-semibold">view only</span>'}`
    : (data.can_edit ? 'Nothing planned yet — add the first activity.' : 'Nothing planned yet.');

  el.innerHTML = nowText
    ? `${nowText}<span class="hidden xl:inline truncate">· ${stats}</span>`
    : `<span class="truncate">${stats}</span>`;
}

// ------------------------------------------------------------
// Hero (live): now / next, today's day at a glance, what's later
// ------------------------------------------------------------

function renderHero() {
  const el = document.getElementById('tt-hero-live');
  if (!el) return;
  const { m, today, current, next } = todayNow();
  const now = new Date();
  const dayLine = `${todayName()}, ${now.toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })} · ${label(toHHMM(m))}`;
  const dot = (a, cls = 'h-3 w-3') => `<span class="${cls} flex-shrink-0 rounded-full ${color(a.category_id).dot} ring-2 ring-white/30"></span>`;

  let pill, headline, sub, bar = '';
  if (current) {
    const len = toMin(current.end) - toMin(current.start);
    const done = m - toMin(current.start);
    pill = '<span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span></span> On now';
    headline = `<span class="inline-flex items-center gap-3">${dot(current, 'h-4 w-4')}${escapeHtml(current.name)}</span>`;
    sub = `${range(current)} · <span class="font-semibold text-primary-300">${inMins(toMin(current.end) - m)} left</span> · ${escapeHtml(cat(current.category_id).name)}`;
    bar = `<div class="mt-4 max-w-md"><div class="h-2 rounded-full bg-white/15 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-primary-400 to-amber-300 transition-all duration-700" style="width:${Math.round((done / len) * 100)}%"></div></div></div>`;
  } else if (next) {
    pill = `${svg(ICON.clock, 'h-3.5 w-3.5')} Up next`;
    headline = `<span class="inline-flex items-center gap-3">${dot(next, 'h-4 w-4')}${escapeHtml(next.name)}</span>`;
    sub = `${range(next)} · <span class="font-semibold text-primary-300">in ${inMins(toMin(next.start) - m)}</span> · ${escapeHtml(cat(next.category_id).name)}`;
  } else {
    const days = data.days;
    const tomorrow = days[(days.indexOf(todayName()) + 1) % days.length];
    const first = dayActivities(tomorrow).find((a) => !hidden.has(a.category_id));
    pill = `${svg(ICON.check, 'h-3.5 w-3.5')} ${escapeHtml(todayName())}`;
    headline = today.length ? 'That’s it for today' : (data.activities.length ? 'Nothing planned today' : 'Plan your week');
    sub = first
      ? `${escapeHtml(tomorrow)} starts with <span class="font-semibold text-white">${escapeHtml(first.name)}</span> at ${label(first.start)}.`
      : (data.activities.length ? 'Nothing planned tomorrow either.' : (data.can_edit ? 'Add the first activity — or click any spot in the week below.' : 'Nothing on the timetable yet.'));
  }

  // Today at a glance: coloured blocks across the day with a moving "now" marker
  let strip = '';
  if (today.length) {
    const start = Math.min(6 * 60, Math.floor(toMin(today[0].start) / 60) * 60);
    const end = Math.max(22 * 60, Math.ceil(Math.max(...today.map((a) => toMin(a.end))) / 60) * 60);
    const pos = (min) => Math.max(0, Math.min(100, ((min - start) / (end - start)) * 100));
    const blocks = today.map((a) => {
      const past = toMin(a.end) <= m;
      const on = a === current;
      return `<button type="button" data-activity="${escapeHtml(a.encoded_id)}" title="${escapeHtml(`${range(a)} · ${a.name}`)}" aria-label="${escapeHtml(`${range(a)}: ${a.name}`)}"
        class="absolute inset-y-0 rounded ring-1 ring-inset ring-white/25 ${color(a.category_id).dot} ${past ? 'opacity-35' : on ? 'ring-2 ring-white shadow-lg z-10' : 'opacity-90'} hover:opacity-100 transition-opacity"
        style="left:${pos(toMin(a.start)).toFixed(2)}%; width:max(4px, calc(${(pos(toMin(a.end)) - pos(toMin(a.start))).toFixed(2)}% - 2px))"></button>`;
    }).join('');
    const nowIn = m >= start && m <= end;
    strip = `
      <div class="mt-6">
        <div class="relative h-5 rounded-md bg-white/10">
          ${blocks}
          ${nowIn ? `<div class="absolute -top-1.5 -bottom-1.5 w-1 -translate-x-1/2 rounded-full bg-red-500 shadow-[0_0_0_3px_rgba(239,68,68,0.3)] z-20 pointer-events-none" style="left:${pos(m).toFixed(2)}%"></div>` : ''}
        </div>
        <div class="flex justify-between mt-1.5 text-[11px] font-semibold text-white/50"><span>${hourLabel(start / 60)}</span><span>${hourLabel(Math.round((start + end) / 120))}</span><span>${hourLabel(end / 60)}</span></div>
      </div>`;
  }

  const left = today.reduce((s, a) => s + Math.max(0, toMin(a.end) - Math.max(m, toMin(a.start))), 0);
  const weekMins = data.activities.reduce((s, a) => s + (toMin(a.end) - toMin(a.start)), 0);
  const tile = (value, lbl) => `
    <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-3 py-2.5 min-w-0">
      <span class="block text-xl sm:text-2xl font-bold leading-none truncate">${value}</span>
      <span class="block text-[10px] font-semibold uppercase tracking-wider text-secondary-200 mt-1 truncate">${lbl}</span>
    </div>`;

  const later = today.filter((a) => toMin(a.start) > m && a !== next).slice(0, 4);
  const upNext = current && next ? [next, ...later].slice(0, 5) : later;
  const laterHtml = upNext.length ? upNext.map((a) => `
    <button type="button" data-activity="${escapeHtml(a.encoded_id)}" class="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 text-left hover:bg-white/10 transition-colors">
      ${dot(a, 'h-2.5 w-2.5')}
      <span class="min-w-0 flex-1 text-sm font-semibold truncate">${escapeHtml(a.name)}</span>
      <span class="flex-shrink-0 text-xs text-white/60">${label(a.start)}</span>
    </button>`).join('') : `<p class="text-sm text-white/60">${today.length ? 'Nothing else later today.' : 'Nothing today.'}</p>`;

  el.innerHTML = `
    <div class="grid gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <span class="inline-flex items-center rounded-full bg-primary-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wider">Timetable</span>
          <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">${pill}</span>
          <span class="text-xs font-semibold text-white/60">${dayLine}</span>
        </div>
        ${current || next ? `<button type="button" data-activity="${escapeHtml((current || next).encoded_id)}" class="block text-left mt-3 group">` : '<div class="mt-3">'}
          <span class="block text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] break-words group-hover:underline decoration-white/30 underline-offset-8">${headline}</span>
        ${current || next ? '</button>' : '</div>'}
        <p class="mt-2 text-base text-secondary-50">${sub}</p>
        ${bar}
        ${strip}
      </div>
      <div class="lg:col-span-2 space-y-4 min-w-0">
        <div class="grid grid-cols-3 gap-2">
          ${tile(today.length, 'Today')}${tile(left ? duration(left) : '—', 'Left today')}${tile(duration(weekMins), 'This week')}
        </div>
        <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-4">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary-200 mb-2">${current && next ? 'Up next' : 'Later today'}</p>
          <div class="space-y-1">${laterHtml}</div>
        </div>
        ${hidden.size ? `<p class="text-xs text-white/50">Showing ${data.categories.length - hidden.size} of ${data.categories.length} categories.</p>` : ''}
      </div>
    </div>`;
}

let heroSlideTimer = null;
function startHeroSlides() {
  clearInterval(heroSlideTimer);
  const slides = [...document.querySelectorAll('#tt-hero [data-hero-slides] .hero-slide')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  heroSlideTimer = setInterval(() => {
    if (!document.body.contains(slides[0])) { clearInterval(heroSlideTimer); return; }
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, 8000);
}

function renderFilter() {
  const list = document.querySelector('#timetable-page [data-filter-list]');
  const lbl = document.querySelector('#timetable-page [data-filter-label]');
  if (lbl) {
    const shown = data.categories.filter((c) => !hidden.has(c.id)).length;
    lbl.textContent = hidden.size === 0 ? 'All categories' : `${shown} of ${data.categories.length}`;
  }
  if (!list) return;
  list.innerHTML = data.categories.map((c) => `
    <button type="button" data-filter-cat="${c.id}" aria-pressed="${!hidden.has(c.id)}"
      class="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors ${hidden.has(c.id) ? 'text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}">
      <span class="h-4 w-4 flex-shrink-0 rounded border flex items-center justify-center ${hidden.has(c.id) ? 'border-gray-300 dark:border-gray-600' : 'border-transparent bg-primary-500 text-white'}">${hidden.has(c.id) ? '' : svg(ICON.check, 'h-3 w-3')}</span>
      <span class="h-2.5 w-2.5 flex-shrink-0 rounded-full ${(COLORS[c.color] || COLORS.gray).dot}"></span>
      <span class="flex-1 truncate">${escapeHtml(c.name)}</span>
      <span class="text-xs text-gray-400">${c.count || 0}</span>
    </button>`).join('');
}

/** Visible hour span: 6 AM–10 PM, widened to fit every activity. */
function hourSpan() {
  let first = 6, last = 22;
  data.activities.forEach((a) => {
    first = Math.min(first, Math.floor(toMin(a.start) / 60));
    last = Math.max(last, Math.ceil(toMin(a.end) / 60));
  });
  return { first: Math.max(0, first), last: Math.min(24, last) };
}

/** Side-by-side columns for overlapping activities in one day. */
function layoutDay(list) {
  const out = [];
  let cluster = [], clusterEnd = -1, columns = [];
  const flush = () => {
    const n = columns.length || 1;
    cluster.forEach((item) => { item.cols = n; });
    out.push(...cluster);
    cluster = []; columns = []; clusterEnd = -1;
  };
  list.forEach((a) => {
    const s = toMin(a.start), e = toMin(a.end);
    if (cluster.length && s >= clusterEnd) flush();
    let col = columns.findIndex((end) => end <= s);
    if (col === -1) { col = columns.length; columns.push(e); } else columns[col] = e;
    cluster.push({ a, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, e);
  });
  if (cluster.length) flush();
  return out;
}

const GRID_COLS = 'grid grid-cols-[3.75rem_repeat(7,minmax(0,1fr))]';

function renderGrid() {
  const head = document.getElementById('tt-days');
  const body = document.getElementById('tt-body');
  if (!head || !body) return;
  const today = todayName();
  const { first, last } = hourSpan();
  const height = (last - first) * HOUR_PX;

  head.innerHTML = `
    <div class="${GRID_COLS} border-t border-gray-100 dark:border-gray-800">
      <div></div>
      ${data.days.map((d) => {
        const mins = dayActivities(d).reduce((s, a) => s + (toMin(a.end) - toMin(a.start)), 0);
        const isToday = d === today;
        return `
          <div class="group/day relative px-2 py-2 text-center border-l border-gray-100 dark:border-gray-800 ${isToday ? 'bg-primary-50/70 dark:bg-primary-950/30' : ''}">
            <span class="block text-base font-bold ${isToday ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}">${d.slice(0, 3)}<span class="hidden xl:inline">${d.slice(3)}</span></span>
            <span class="block text-xs ${isToday ? 'text-primary-600 dark:text-primary-400 font-semibold' : 'text-gray-400'}">${isToday ? 'Today' : ''}${isToday && mins ? ' · ' : ''}${mins ? duration(mins) : (isToday ? '' : '&nbsp;')}</span>
            ${data.can_edit ? `<button type="button" data-copy-day="${d}" title="Copy ${d} to other days" aria-label="Copy ${d}"
              class="absolute top-1.5 right-1.5 p-1 rounded-md text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 opacity-0 group-hover/day:opacity-100 focus:opacity-100 transition-opacity">${svg(ICON.copy, 'h-3.5 w-3.5')}</button>` : ''}
          </div>`;
      }).join('')}
    </div>`;

  const hours = [];
  for (let h = first; h <= last; h++) hours.push(h);

  body.innerHTML = `
    <div class="${GRID_COLS} pb-4">
      <div class="relative" style="height: ${height}px">
        ${hours.map((h) => `<span class="absolute right-2 -translate-y-1/2 text-xs font-semibold text-gray-500 dark:text-gray-400 whitespace-nowrap" style="top: ${(h - first) * HOUR_PX}px">${h === first ? '' : hourLabel(h)}</span>`).join('')}
      </div>
      ${data.days.map((d) => `
        <div class="tt-col relative border-l border-gray-100 dark:border-gray-800 ${d === today ? 'bg-primary-50/30 dark:bg-primary-950/10' : ''} ${data.can_edit ? 'cursor-copy' : ''}"
          data-col="${d}" style="height: ${height}px; background-image: repeating-linear-gradient(to bottom, rgb(148 163 184 / 0.18) 0, rgb(148 163 184 / 0.18) 1px, transparent 1px, transparent ${HOUR_PX}px);">
          ${layoutDay(dayActivities(d)).map(({ a, col, cols }) => blockHtml(a, col, cols, first)).join('')}
        </div>`).join('')}
    </div>
    ${data.activities.length ? '' : `
      <div class="pointer-events-none absolute inset-x-0 top-24 text-center">
        <p class="inline-block rounded-xl bg-white/90 dark:bg-gray-900/90 px-4 py-2 text-sm text-gray-500 dark:text-gray-400 shadow-sm ring-1 ring-gray-200 dark:ring-gray-800">
          ${data.can_edit ? 'Click anywhere in a day to add an activity at that time.' : 'Nothing on the timetable yet.'}
        </p>
      </div>`}`;
  body.dataset.first = String(first);
  placeNowLine();
  markNow();
}

function blockHtml(a, col, cols, first) {
  const s = toMin(a.start), e = toMin(a.end);
  const top = ((s - first * 60) / 60) * HOUR_PX;
  const real = ((e - s) / 60) * HOUR_PX - 2;
  // Very short activities (≤ 20 min) keep their true height, with smaller
  // text, so the next activity doesn't cover their name
  const tiny = real < 20;
  const h = Math.max(tiny ? 13 : 20, real);
  const dim = hidden.has(a.category_id);
  const c = color(a.category_id);
  const roomy = h >= 44; // room for the name + the times
  return `
    <button type="button" data-activity="${escapeHtml(a.encoded_id)}" data-day="${a.day}" data-start="${a.start}" data-end="${a.end}"
      title="${escapeHtml(`${a.name} · ${range(a)} · ${cat(a.category_id).name}`)}"
      class="tt-block absolute flex flex-col justify-start overflow-hidden ${tiny ? 'rounded-md' : 'rounded-lg'} border-l-4 px-2 ${roomy ? 'py-1.5' : tiny ? 'py-0 justify-center' : 'py-0.5'} text-left shadow-sm ring-1 ring-black/[0.04] dark:ring-gray-950 dark:shadow-black/40 hover:shadow-md hover:z-10 focus:z-10 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 transition-[opacity,box-shadow] ${c.block} ${dim ? 'opacity-20 pointer-events-none' : ''}"
      style="top: ${top + 1}px; height: ${h}px; left: calc(${(col / cols) * 100}% + 3px); width: calc(${100 / cols}% - 6px);">
      <span class="block ${tiny ? 'text-[11px] leading-none' : 'text-sm leading-tight'} font-bold ${h >= 66 ? 'line-clamp-2' : 'truncate'}">${escapeHtml(a.name)}</span>
      ${roomy ? `<span class="block text-xs font-medium opacity-80 truncate mt-0.5">${label(a.start)} – ${label(a.end)}</span>` : ''}
    </button>`;
}

function placeNowLine() {
  const body = document.getElementById('tt-body');
  if (!body || !isWide()) return;
  body.querySelector('[data-now]')?.remove();
  const col = body.querySelector(`[data-col="${todayName()}"]`);
  const first = Number(body.dataset.first || 0);
  const m = nowMin();
  if (!col || m < first * 60 || m > col.offsetHeight / HOUR_PX * 60 + first * 60) return;
  const line = document.createElement('div');
  line.dataset.now = '';
  line.className = 'pointer-events-none absolute left-0 right-0 z-20 h-0.5 bg-red-500';
  line.style.top = `${((m - first * 60) / 60) * HOUR_PX}px`;
  line.innerHTML = '<span class="absolute -left-1 -top-1 h-2.5 w-2.5 rounded-full bg-red-500"></span>';
  col.appendChild(line);
}

/** On first load, scroll the grid so "now" (or the first activity) is in view. */
function scrollToNow() {
  if (!isWide() || !data.activities.length) return;
  const body = document.getElementById('tt-body');
  const first = Number(body?.dataset.first || 0);
  const target = Math.max(nowMin(), Math.min(...data.activities.map((a) => toMin(a.start)))) - 60;
  const y = body.getBoundingClientRect().top + window.scrollY + ((target - first * 60) / 60) * HOUR_PX - 260;
  if (y > 200) window.scrollTo(0, y);
}

function renderList() {
  const head = document.getElementById('tt-days');
  const body = document.getElementById('tt-body');
  if (!head || !body) return;
  const today = todayName();

  head.innerHTML = `
    <div class="flex gap-1.5 overflow-x-auto px-3 pb-2.5 custom-scrollbar">
      ${data.days.map((d) => {
        const active = d === mobileDay;
        const n = dayActivities(d).length;
        return `
          <button type="button" data-day-tab="${d}" aria-pressed="${active}"
            class="flex-shrink-0 w-14 py-1.5 rounded-xl text-center transition-colors ${active ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}">
            <span class="block text-sm font-bold">${d.slice(0, 3)}</span>
            <span class="block text-[11px] ${active ? 'text-white/80' : 'text-gray-400'}">${d === today ? 'Today' : `${n || '–'}`}</span>
          </button>`;
      }).join('')}
    </div>`;

  const list = dayActivities(mobileDay).filter((a) => !hidden.has(a.category_id));
  const rows = [];
  let prevEnd = null;
  list.forEach((a) => {
    const s = toMin(a.start);
    if (prevEnd !== null && s - prevEnd >= 30) {
      rows.push(`<div class="flex items-center gap-2 pl-[4.5rem] py-1 text-xs font-medium text-gray-400">${svg(ICON.clock, 'h-3.5 w-3.5')} Free · ${duration(s - prevEnd)}</div>`);
    }
    prevEnd = Math.max(prevEnd ?? 0, toMin(a.end));
    const c = color(a.category_id);
    rows.push(`
      <button type="button" data-activity="${escapeHtml(a.encoded_id)}" data-day="${a.day}" data-start="${a.start}" data-end="${a.end}" class="w-full flex items-stretch gap-3 text-left rounded-xl">
        <span class="w-[3.75rem] flex-shrink-0 pt-2.5 text-right">
          <span class="block text-sm font-bold text-gray-900 dark:text-white">${label(a.start)}</span>
          <span class="block text-xs text-gray-400">${label(a.end)}</span>
        </span>
        <span class="flex-1 min-w-0 rounded-xl border-l-4 px-3 py-2.5 ${c.block}">
          <span class="block text-base font-bold leading-snug break-words">${escapeHtml(a.name)}</span>
          <span class="mt-0.5 block text-xs opacity-80">${escapeHtml(cat(a.category_id).name)} · ${duration(toMin(a.end) - s)}</span>
        </span>
      </button>`);
  });

  body.innerHTML = `
    <div class="px-3 py-3 space-y-2">
      ${rows.length ? rows.join('') : `<p class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">${hidden.size ? 'Nothing in the categories you picked.' : `Nothing planned for ${mobileDay}.`}</p>`}
      ${data.can_edit ? `<button type="button" data-add-day="${mobileDay}" class="mt-2 w-full rounded-xl border border-dashed border-gray-300 dark:border-gray-700 py-3 text-sm font-semibold text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors">+ Add to ${mobileDay}</button>` : ''}
    </div>`;
  markNow();
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

function closeMenus(except = null) {
  document.querySelectorAll('#timetable-page [data-menu]').forEach((m) => {
    if (m.dataset.menu === except) return;
    m.classList.add('hidden');
    document.querySelector(`#timetable-page [data-menu-toggle="${m.dataset.menu}"]`)?.setAttribute('aria-expanded', 'false');
  });
}

async function onPageClick(e) {
  if (e.target.closest('#tt-guest-sample')) {
    if (await confirmDialog('Replace your guest timetable with the sample week?', 'Reload sample', 'Cancel', 'bg-primary-600 hover:bg-primary-700')) {
      adoptState(guestTimetable.resetToSample());
      hidden = new Set();
      render();
      showToast('Sample week loaded.', 'success');
    }
    return;
  }
  if (e.target.closest('#tt-guest-clear')) {
    if (await confirmDialog('Remove every guest activity and start with an empty week?', 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700')) {
      adoptState(guestTimetable.clear());
      hidden = new Set();
      render();
      showToast('Started with an empty week.', 'success');
    }
    return;
  }

  const toggle = e.target.closest('[data-menu-toggle]');
  if (toggle) {
    const name = toggle.dataset.menuToggle;
    const menu = document.querySelector(`#timetable-page [data-menu="${name}"]`);
    const open = menu.classList.contains('hidden');
    closeMenus(name);
    menu.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    return;
  }

  const filterCat = e.target.closest('[data-filter-cat]');
  if (filterCat) {
    const id = Number(filterCat.dataset.filterCat);
    if (hidden.has(id)) hidden.delete(id); else hidden.add(id);
    render();
    return;
  }
  if (e.target.closest('[data-filter-all]')) { hidden = new Set(); render(); return; }

  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act) {
    closeMenus();
    if (act === 'live') { toggleLive(); return; }
    if (act === 'add') openActivityForm({ day: isWide() ? todayName() : mobileDay });
    if (act === 'categories') openCategories();
    if (act === 'copy-day') openCopyDay(isWide() ? todayName() : mobileDay);
    if (act === 'clear-day') openClearDay();
    if (act === 'clear-all') clearAll();
    return;
  }

  const copy = e.target.closest('[data-copy-day]');
  if (copy) { openCopyDay(copy.dataset.copyDay); return; }

  const tab = e.target.closest('[data-day-tab]');
  if (tab) { mobileDay = tab.dataset.dayTab; renderList(); return; }

  const addDay = e.target.closest('[data-add-day]');
  if (addDay) { openActivityForm({ day: addDay.dataset.addDay }); return; }

  const block = e.target.closest('[data-activity]');
  if (block) {
    const a = data.activities.find((x) => x.encoded_id === block.dataset.activity);
    if (a) { if (data.can_edit) openActivityForm({ activity: a }); else openDetails(a); }
    return;
  }

  // Click an empty spot in a day column -> add there, snapped to 15 minutes
  const col = e.target.closest('[data-col]');
  if (col && data.can_edit) {
    const first = Number(document.getElementById('tt-body')?.dataset.first || 0);
    const y = e.clientY - col.getBoundingClientRect().top;
    const start = Math.min(23 * 60 + 45, Math.max(0, first * 60 + Math.floor((y / HOUR_PX) * 60 / SNAP_MIN) * SNAP_MIN));
    openActivityForm({ day: col.dataset.col, start: toHHMM(start), end: toHHMM(Math.min(start + 60, 23 * 60 + 59)) });
  }
}

// ------------------------------------------------------------
// Details (view only)
// ------------------------------------------------------------

function openDetails(a) {
  modal?.destroy();
  const c = cat(a.category_id);
  modal = new Modal({
    id: 'tt-details-modal',
    title: a.name,
    size: 'md',
    showFooter: false,
    content: `
      <dl class="space-y-3 text-sm">
        <div class="flex justify-between gap-4"><dt class="text-gray-500 dark:text-gray-400">When</dt><dd class="font-semibold text-gray-900 dark:text-white text-right">${a.day}, ${range(a)}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-gray-500 dark:text-gray-400">How long</dt><dd class="font-semibold text-gray-900 dark:text-white">${duration(toMin(a.end) - toMin(a.start))}</dd></div>
        <div class="flex justify-between gap-4"><dt class="text-gray-500 dark:text-gray-400">Category</dt><dd class="inline-flex items-center gap-2 font-semibold text-gray-900 dark:text-white"><span class="h-2.5 w-2.5 rounded-full ${(COLORS[c.color] || COLORS.gray).dot}"></span>${escapeHtml(c.name)}</dd></div>
      </dl>`,
  });
  modal.open();
}

// ------------------------------------------------------------
// Activity form
// ------------------------------------------------------------

const input = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition';
const lbl = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5';
const chip = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300 aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-300';

function swatches(selected, attr = 'data-swatch') {
  return Object.keys(COLORS).map((k) => `
    <button type="button" ${attr}="${k}" aria-pressed="${k === selected}" title="${k}" aria-label="${k}"
      class="h-7 w-7 rounded-full ${COLORS[k].dot} ring-offset-2 ring-offset-white dark:ring-offset-gray-900 aria-pressed:ring-2 aria-pressed:ring-gray-900 dark:aria-pressed:ring-white transition"></button>`).join('');
}

function categoryPickerHtml(selectedId) {
  return data.categories.map((c) => `
    <button type="button" data-cat-pick="${c.id}" aria-pressed="${c.id === selectedId}"
      class="flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-xs font-semibold border transition-colors border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:border-primary-300 aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-800 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-200">
      <span class="h-2.5 w-2.5 flex-shrink-0 rounded-full ${(COLORS[c.color] || COLORS.gray).dot}"></span>
      <span class="truncate">${escapeHtml(c.name)}</span>
    </button>`).join('');
}

/**
 * @param {{activity?: object, day?: string, start?: string, end?: string}} opts
 */
function openActivityForm({ activity = null, day = todayName(), start = '16:00', end = '17:00' } = {}) {
  modal?.destroy();
  const isEdit = !!activity;
  const a = activity || { day, start, end, name: '', category_id: (data.categories.find((c) => c.slug === 'routine') || data.categories[0])?.id };
  const days = new Set([a.day]);

  modal = new Modal({
    id: 'tt-activity-modal',
    title: isEdit ? 'Edit activity' : 'Add an activity',
    size: 'lg',
    showFooter: false,
    content: `
    <form id="tt-form" class="space-y-5" novalidate>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="space-y-5">
          <div>
            <label for="tt-name" class="${lbl}">Activity</label>
            <div class="relative">
              <input type="text" id="tt-name" name="name" required maxlength="150" autocomplete="off" value="${escapeHtml(a.name)}" placeholder="e.g. Piano practice" class="${input}">
              <ul data-suggest class="hidden absolute z-[100] left-0 right-0 mt-1 max-h-56 overflow-y-auto custom-scrollbar rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl"></ul>
            </div>
          </div>

          <div>
            <span class="${lbl}">${isEdit ? 'Day' : 'Days'}</span>
            <div class="flex flex-wrap gap-1.5" data-days>
              ${data.days.map((d) => `<button type="button" data-day="${d}" aria-pressed="${days.has(d)}" class="${chip} w-11">${d.slice(0, 3)}</button>`).join('')}
            </div>
            ${isEdit ? '' : `<div class="mt-2 flex flex-wrap gap-3 text-xs font-semibold">
              <button type="button" data-days-set="weekdays" class="text-primary-600 dark:text-primary-400 hover:underline">Weekdays</button>
              <button type="button" data-days-set="weekend" class="text-primary-600 dark:text-primary-400 hover:underline">Weekend</button>
              <button type="button" data-days-set="all" class="text-primary-600 dark:text-primary-400 hover:underline">Every day</button>
            </div>`}
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div><label for="tt-start" class="${lbl}">Starts</label><input type="time" id="tt-start" name="start" required value="${a.start}" step="300" class="${input}"></div>
            <div><label for="tt-end" class="${lbl}">Ends</label><input type="time" id="tt-end" name="end" required value="${a.end}" step="300" class="${input}"></div>
          </div>
          <div class="flex flex-wrap items-center gap-1.5 -mt-2">
            ${[15, 30, 45, 60, 90, 120].map((m) => `<button type="button" data-length="${m}" class="${chip}">${duration(m)}</button>`).join('')}
            <span class="ml-auto text-xs font-semibold text-gray-500 dark:text-gray-400" data-length-label></span>
          </div>
          <div data-overlap class="hidden rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-200 px-3.5 py-2.5 text-xs font-medium"></div>
        </div>

        <div>
          <div class="flex items-center justify-between mb-1.5">
            <span class="${lbl} !mb-0">Category</span>
            <button type="button" data-new-cat class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">+ New category</button>
          </div>
          <div data-new-cat-form class="hidden mb-3 rounded-xl border border-gray-200 dark:border-gray-700 p-3 space-y-3">
            <input type="text" data-new-cat-name maxlength="60" placeholder="e.g. Swimming" class="${input}">
            <div class="flex flex-wrap gap-2" data-new-cat-colors>${swatches('teal')}</div>
            <div class="flex justify-end gap-2">
              <button type="button" data-new-cat-cancel class="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
              <button type="button" data-new-cat-save class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700">Add category</button>
            </div>
          </div>
          <input type="hidden" name="category_id" value="${a.category_id ?? ''}">
          <div class="grid grid-cols-2 gap-1.5 max-h-[22rem] overflow-y-auto custom-scrollbar pr-1" data-cat-grid>${categoryPickerHtml(a.category_id)}</div>
        </div>
      </div>

      <div class="api-message"></div>

      <div class="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        ${isEdit ? '<button type="button" data-remove class="px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">Remove</button>' : ''}
        <button type="button" data-cancel class="ml-auto px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
        <button type="submit" class="inline-flex items-center justify-center min-w-[8rem] px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60">${isEdit ? 'Save changes' : 'Add activity'}</button>
      </div>
    </form>`,
  });
  modal.open();

  const form = document.getElementById('tt-form');
  if (!form) return;
  const nameEl = form.querySelector('[name="name"]');
  const startEl = form.querySelector('[name="start"]');
  const endEl = form.querySelector('[name="end"]');
  const catEl = form.querySelector('[name="category_id"]');
  const apiMsg = form.querySelector('.api-message');
  setTimeout(() => nameEl.focus(), 50);

  const setDays = (list) => {
    days.clear(); list.forEach((d) => days.add(d));
    form.querySelectorAll('[data-day]').forEach((b) => b.setAttribute('aria-pressed', String(days.has(b.dataset.day))));
    refresh();
  };
  const setCategory = (id) => {
    catEl.value = id;
    form.querySelectorAll('[data-cat-pick]').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.catPick) === Number(id))));
  };

  // Duration label + live overlap warning
  const refresh = () => {
    const s = startEl.value, e = endEl.value;
    const lenLabel = form.querySelector('[data-length-label]');
    const overlap = form.querySelector('[data-overlap]');
    if (!s || !e) { lenLabel.textContent = ''; overlap.classList.add('hidden'); return; }
    const len = toMin(e) - toMin(s);
    lenLabel.textContent = len > 0 ? duration(len) : 'Ends before it starts';
    lenLabel.classList.toggle('text-red-600', len <= 0);
    const hits = len > 0 ? data.activities.filter((x) => days.has(x.day) && x.encoded_id !== activity?.encoded_id
      && toMin(x.start) < toMin(e) && toMin(x.end) > toMin(s)) : [];
    overlap.classList.toggle('hidden', !hits.length);
    if (hits.length) {
      overlap.innerHTML = `<span class="inline-flex items-start gap-1.5">${svg(ICON.warn, 'h-4 w-4 flex-shrink-0')}<span>Overlaps with ${hits.slice(0, 3).map((x) => `<strong>${escapeHtml(x.name)}</strong> (${x.day.slice(0, 3)} ${range(x)})`).join(', ')}${hits.length > 3 ? ` and ${hits.length - 3} more` : ''}. You can still save it.</span></span>`;
    }
  };
  startEl.addEventListener('input', refresh);
  endEl.addEventListener('input', refresh);
  refresh();

  form.addEventListener('click', async (e) => {
    const dayBtn = e.target.closest('[data-day]');
    if (dayBtn) {
      const d = dayBtn.dataset.day;
      if (isEdit) setDays([d]);
      else if (days.has(d) && days.size > 1) { days.delete(d); setDays([...days]); } else { days.add(d); setDays([...days]); }
      return;
    }
    const set = e.target.closest('[data-days-set]')?.dataset.daysSet;
    if (set) { setDays(set === 'weekdays' ? data.days.slice(0, 5) : set === 'weekend' ? data.days.slice(5) : data.days); return; }

    const len = e.target.closest('[data-length]');
    if (len && startEl.value) { endEl.value = toHHMM(Math.min(toMin(startEl.value) + Number(len.dataset.length), 23 * 60 + 59)); refresh(); return; }

    const pick = e.target.closest('[data-cat-pick]');
    if (pick) { setCategory(pick.dataset.catPick); return; }

    // Inline "new category"
    const newForm = form.querySelector('[data-new-cat-form]');
    if (e.target.closest('[data-new-cat]')) { newForm.classList.remove('hidden'); newForm.querySelector('[data-new-cat-name]').focus(); return; }
    if (e.target.closest('[data-new-cat-cancel]')) { newForm.classList.add('hidden'); return; }
    const sw = e.target.closest('[data-swatch]');
    if (sw) { newForm.querySelectorAll('[data-swatch]').forEach((b) => b.setAttribute('aria-pressed', String(b === sw))); return; }
    if (e.target.closest('[data-new-cat-save]')) {
      const name = newForm.querySelector('[data-new-cat-name]').value.trim();
      const colorKey = newForm.querySelector('[data-swatch][aria-pressed="true"]')?.dataset.swatch || 'teal';
      try {
        const json = await post({ action: 'save-category', name, color: colorKey });
        adoptState(json);
        const created = data.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
        form.querySelector('[data-cat-grid]').innerHTML = categoryPickerHtml(created?.id);
        if (created) setCategory(created.id);
        newForm.classList.add('hidden');
        newForm.querySelector('[data-new-cat-name]').value = '';
        renderFilter();
        showToast(`Added “${name}”.`, 'success');
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }

    if (e.target.closest('[data-cancel]')) modal.close();
    if (e.target.closest('[data-remove]')) { modal.close(); removeActivity(activity); }
  });

  initNameSuggestions(nameEl, (s) => {
    setCategory(s.category_id);
    if (startEl.value && !isEdit) { endEl.value = toHHMM(Math.min(toMin(startEl.value) + s.length, 23 * 60 + 59)); refresh(); }
  });

  const validator = new FormValidator(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const original = submitBtn.innerHTML;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validator.validateForEmptyFields(e)) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = buttonSpinner;
    apiMsg.innerHTML = '';
    try {
      const body = {
        action: 'save-activity',
        name: nameEl.value.trim(),
        start: startEl.value,
        end: endEl.value,
        category_id: Number(catEl.value),
        ...(isEdit ? { encoded_id: activity.encoded_id, day: [...days][0] } : { days: data.days.filter((d) => days.has(d)) }),
      };
      const json = await post(body);
      upsertActivities(json.activities || []);
      modal.close();
      showToast(json.messages?.[0] || 'Saved.', 'success');
      if (!isWide() && body.days?.length && !body.days.includes(mobileDay)) mobileDay = body.days[0];
      render();
    } catch (err) {
      apiMsg.innerHTML = errorsHtml(err);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = original;
    }
  });
}

/** Suggest activity names already on the timetable (with their category and usual length). */
function initNameSuggestions(inputEl, onPick) {
  const list = inputEl.parentNode.querySelector('[data-suggest]');
  const known = new Map();
  data.activities.forEach((a) => {
    const key = a.name.toLowerCase();
    if (!known.has(key)) known.set(key, { name: a.name, category_id: a.category_id, length: toMin(a.end) - toMin(a.start) });
  });
  let items = [];
  let active = -1;
  const hide = () => { list.classList.add('hidden'); active = -1; };
  const choose = (i) => { const s = items[i]; if (!s) return; inputEl.value = s.name; hide(); onPick(s); };

  inputEl.addEventListener('input', () => {
    const q = inputEl.value.trim().toLowerCase();
    items = q.length < 2 ? [] : [...known.values()].filter((s) => s.name.toLowerCase().includes(q) && s.name.toLowerCase() !== q).slice(0, 8);
    if (!items.length) return hide();
    list.innerHTML = items.map((s, i) => `
      <li data-index="${i}" class="flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30">
        <span class="h-2.5 w-2.5 rounded-full flex-shrink-0 ${color(s.category_id).dot}"></span>
        <span class="flex-1 truncate">${escapeHtml(s.name)}</span>
        <span class="text-xs text-gray-400">${duration(s.length)}</span>
      </li>`).join('');
    list.classList.remove('hidden');
    active = -1;
  });
  inputEl.addEventListener('keydown', (e) => {
    if (list.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = e.key === 'ArrowDown' ? Math.min(active + 1, items.length - 1) : Math.max(active - 1, 0);
      [...list.children].forEach((li, n) => li.classList.toggle('bg-primary-50', n === active));
    } else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-index]');
    if (li) { e.preventDefault(); choose(Number(li.dataset.index)); }
  });
  inputEl.addEventListener('blur', () => setTimeout(hide, 100));
}

async function removeActivity(a) {
  if (!a) return;
  if (!(await confirmDialog(`Remove <strong>${escapeHtml(a.name)}</strong> (${a.day}, ${range(a)})?`, 'Remove', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    await post({ action: 'delete-activity', id: a.encoded_id });
    data.activities = data.activities.filter((x) => x.encoded_id !== a.encoded_id);
    recount();
    showToast('Activity removed.', 'success');
    render();
  } catch (err) { showToast(err.message, 'error'); }
}

// ------------------------------------------------------------
// Copy / clear
// ------------------------------------------------------------

function openCopyDay(source) {
  modal?.destroy();
  modal = new Modal({
    id: 'tt-copy-modal',
    title: 'Copy a day',
    size: 'md',
    showFooter: false,
    content: `
      <form id="tt-copy-form" class="space-y-5" novalidate>
        <div>
          <label for="tt-copy-source" class="${lbl}">Copy everything on</label>
          <select id="tt-copy-source" name="source" class="${input}">
            ${data.days.map((d) => `<option value="${d}" ${d === source ? 'selected' : ''}>${d} (${dayActivities(d).length})</option>`).join('')}
          </select>
        </div>
        <div>
          <span class="${lbl}">To</span>
          <div class="flex flex-wrap gap-1.5" data-targets>
            ${data.days.map((d) => `<button type="button" data-target="${d}" aria-pressed="false" class="${chip} w-11">${d.slice(0, 3)}</button>`).join('')}
          </div>
        </div>
        <fieldset class="space-y-2">
          <legend class="${lbl}">What's already there</legend>
          <label class="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-200"><input type="radio" name="mode" value="add" checked class="mt-0.5 text-primary-600 focus:ring-primary-500"> <span><strong>Keep it</strong> — add the copied activities alongside</span></label>
          <label class="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-200"><input type="radio" name="mode" value="replace" class="mt-0.5 text-primary-600 focus:ring-primary-500"> <span><strong>Replace it</strong> — remove what's there first</span></label>
        </fieldset>
        <div class="api-message"></div>
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-cancel class="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" class="inline-flex items-center justify-center min-w-[7rem] px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm disabled:opacity-60">Copy</button>
        </div>
      </form>`,
  });
  modal.open();

  const form = document.getElementById('tt-copy-form');
  const sourceEl = form.querySelector('[name="source"]');
  const targets = new Set();
  const sync = () => form.querySelectorAll('[data-target]').forEach((b) => {
    const isSource = b.dataset.target === sourceEl.value;
    if (isSource) targets.delete(b.dataset.target);
    b.disabled = isSource;
    b.classList.toggle('opacity-40', isSource);
    b.setAttribute('aria-pressed', String(targets.has(b.dataset.target)));
  });
  sourceEl.addEventListener('change', sync);
  sync();

  form.addEventListener('click', (e) => {
    const t = e.target.closest('[data-target]');
    if (t && !t.disabled) { if (targets.has(t.dataset.target)) targets.delete(t.dataset.target); else targets.add(t.dataset.target); sync(); }
    if (e.target.closest('[data-cancel]')) modal.close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const replace = form.querySelector('[name="mode"]:checked')?.value === 'replace';
    const list = data.days.filter((d) => targets.has(d));
    if (replace && list.some((d) => dayActivities(d).length)) {
      const n = list.reduce((s, d) => s + dayActivities(d).length, 0);
      if (!(await confirmDialog(`This removes ${n} ${n === 1 ? 'activity' : 'activities'} already on ${list.join(', ')} first. Go ahead?`, 'Replace', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
    }
    btn.disabled = true;
    try {
      const json = await post({ action: 'copy-day', source: sourceEl.value, targets: list, replace });
      adoptState(json);
      modal.close();
      showToast(json.messages?.[0] || 'Copied.', 'success');
      render();
    } catch (err) {
      form.querySelector('.api-message').innerHTML = errorsHtml(err);
    } finally { btn.disabled = false; }
  });
}

function openClearDay() {
  modal?.destroy();
  modal = new Modal({
    id: 'tt-clear-modal',
    title: 'Clear a day',
    size: 'md',
    showFooter: false,
    content: `
      <form id="tt-clear-form" class="space-y-5" novalidate>
        <div>
          <label for="tt-clear-day" class="${lbl}">Remove every activity on</label>
          <select id="tt-clear-day" name="day" class="${input}">
            ${data.days.map((d) => `<option value="${d}" ${dayActivities(d).length ? '' : 'disabled'}>${d} (${dayActivities(d).length})</option>`).join('')}
          </select>
        </div>
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-cancel class="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
          <button type="submit" class="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-sm font-semibold text-white shadow-sm">Clear day</button>
        </div>
      </form>`,
  });
  modal.open();
  const form = document.getElementById('tt-clear-form');
  const firstFull = data.days.find((d) => dayActivities(d).length);
  if (firstFull) form.querySelector('[name="day"]').value = firstFull;
  form.addEventListener('click', (e) => { if (e.target.closest('[data-cancel]')) modal.close(); });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const day = form.querySelector('[name="day"]').value;
    const n = dayActivities(day).length;
    if (!n) { modal.close(); return; }
    if (!(await confirmDialog(`Remove all ${n} ${n === 1 ? 'activity' : 'activities'} on ${day}? This can't be undone.`, 'Clear day', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
    try {
      const json = await post({ action: 'clear', day });
      data.activities = data.activities.filter((a) => a.day !== day);
      recount();
      modal.close();
      showToast(json.messages?.[0] || 'Cleared.', 'success');
      render();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

async function clearAll() {
  const n = data.activities.length;
  if (!n) { showToast('The timetable is already empty.', 'success'); return; }
  if (!(await confirmDialog(`Remove <strong>all ${n} activities</strong> from every day of the week? This can't be undone.`, 'Continue', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  if (!(await confirmDialog('Really clear the whole timetable? Everyone will see an empty week.', 'Yes, clear everything', 'Keep it', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    const json = await post({ action: 'clear', day: 'all' });
    data.activities = [];
    recount();
    showToast(json.messages?.[0] || 'Cleared.', 'success');
    render();
  } catch (err) { showToast(err.message, 'error'); }
}

// ------------------------------------------------------------
// Categories
// ------------------------------------------------------------

function openCategories() {
  modal?.destroy();
  modal = new Modal({
    id: 'tt-categories-modal',
    title: 'Categories',
    size: 'lg',
    showFooter: false,
    content: `
      <div class="space-y-5" id="tt-cats">
        <form data-cat-add class="rounded-2xl border border-gray-200 dark:border-gray-800 p-4 space-y-3" novalidate>
          <p class="text-sm font-semibold text-gray-700 dark:text-gray-300">Add a category</p>
          <div class="flex flex-col sm:flex-row gap-3">
            <input type="text" name="name" maxlength="60" placeholder="e.g. Swimming" class="${input} sm:flex-1">
            <button type="submit" class="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm">Add</button>
          </div>
          <div class="flex flex-wrap gap-2">${swatches('teal')}</div>
        </form>
        <div data-cat-rows class="divide-y divide-gray-100 dark:divide-gray-800"></div>
      </div>`,
  });
  modal.open();

  const root = document.getElementById('tt-cats');
  const rows = root.querySelector('[data-cat-rows]');
  let editing = null;
  let deleting = null;

  const draw = () => {
    rows.innerHTML = data.categories.map((c) => {
      if (editing === c.id) {
        return `
          <div class="py-3 space-y-3" data-row="${c.id}">
            <input type="text" data-edit-name maxlength="60" value="${escapeHtml(c.name)}" class="${input}">
            <div class="flex flex-wrap gap-2" data-edit-colors>${swatches(c.color)}</div>
            <div class="flex justify-end gap-2">
              <button type="button" data-edit-cancel class="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
              <button type="button" data-edit-save="${c.id}" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-primary-600 hover:bg-primary-700">Save</button>
            </div>
          </div>`;
      }
      if (deleting === c.id) {
        const others = data.categories.filter((o) => o.id !== c.id);
        return `
          <div class="py-3 space-y-3" data-row="${c.id}">
            <p class="text-sm text-gray-700 dark:text-gray-200">Delete <strong>${escapeHtml(c.name)}</strong>?${c.count ? ` Its ${c.count} ${c.count === 1 ? 'activity moves' : 'activities move'} to:` : ''}</p>
            ${c.count ? `<select data-move-to class="${input}">${others.map((o) => `<option value="${o.id}" ${o.slug === 'routine' ? 'selected' : ''}>${escapeHtml(o.name)}</option>`).join('')}</select>` : ''}
            <div class="flex justify-end gap-2">
              <button type="button" data-delete-cancel class="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel</button>
              <button type="button" data-delete-confirm="${c.id}" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700">Delete</button>
            </div>
          </div>`;
      }
      return `
        <div class="flex items-center gap-3 py-2.5" data-row="${c.id}">
          <span class="h-3.5 w-3.5 rounded-full flex-shrink-0 ${(COLORS[c.color] || COLORS.gray).dot}"></span>
          <span class="flex-1 min-w-0 truncate text-sm font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(c.name)}</span>
          <span class="text-xs text-gray-400 whitespace-nowrap">${c.count || 0} ${c.count === 1 ? 'activity' : 'activities'}</span>
          <button type="button" data-edit="${c.id}" class="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Edit</button>
          <button type="button" data-delete="${c.id}" ${c.locked ? 'disabled title="One of the original categories — you can rename or recolour it"' : ''}
            class="px-2.5 py-1 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-30 disabled:hover:bg-transparent">Delete</button>
        </div>`;
    }).join('');
  };
  draw();

  const refreshAll = (json, message) => {
    adoptState(json);
    editing = null; deleting = null;
    draw();
    render();
    showToast(message || json.messages?.[0] || 'Saved.', 'success');
  };

  root.addEventListener('click', async (e) => {
    const sw = e.target.closest('[data-swatch]');
    if (sw) { sw.parentNode.querySelectorAll('[data-swatch]').forEach((b) => b.setAttribute('aria-pressed', String(b === sw))); return; }
    const ed = e.target.closest('[data-edit]');
    if (ed) { editing = Number(ed.dataset.edit); deleting = null; draw(); rows.querySelector('[data-edit-name]')?.focus(); return; }
    if (e.target.closest('[data-edit-cancel], [data-delete-cancel]')) { editing = null; deleting = null; draw(); return; }
    const del = e.target.closest('[data-delete]');
    if (del && !del.disabled) { deleting = Number(del.dataset.delete); editing = null; draw(); return; }

    const save = e.target.closest('[data-edit-save]');
    if (save) {
      const row = save.closest('[data-row]');
      try {
        const json = await post({
          action: 'save-category',
          id: Number(save.dataset.editSave),
          name: row.querySelector('[data-edit-name]').value.trim(),
          color: row.querySelector('[data-swatch][aria-pressed="true"]')?.dataset.swatch,
        });
        refreshAll(json);
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }
    const confirmDel = e.target.closest('[data-delete-confirm]');
    if (confirmDel) {
      const row = confirmDel.closest('[data-row]');
      try {
        const json = await post({ action: 'delete-category', id: Number(confirmDel.dataset.deleteConfirm), move_to: Number(row.querySelector('[data-move-to]')?.value || 0) });
        hidden.delete(Number(confirmDel.dataset.deleteConfirm));
        refreshAll(json);
      } catch (err) { showToast(err.message, 'error'); }
    }
  });

  root.querySelector('[data-cat-add]').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = e.currentTarget;
    const name = f.querySelector('[name="name"]').value.trim();
    try {
      const json = await post({ action: 'save-category', name, color: f.querySelector('[data-swatch][aria-pressed="true"]')?.dataset.swatch || 'teal' });
      f.querySelector('[name="name"]').value = '';
      refreshAll(json, `Added “${name}”.`);
    } catch (err) { showToast(err.message, 'error'); }
  });
}
