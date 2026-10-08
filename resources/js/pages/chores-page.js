// /resources/js/pages/chores-page.js
//
// Chores: children, the chore library, the Timetable's chore slots, the plan
// (who does what in which slot) and this week's ticks all live in memory
// (seeded from #chores-data). render() draws the photo hero and the current
// view — Today (tick-off board), The week (planner), Chore library,
// Children — and every write patches that state from the API response.
//
// data.can_manage (Chores Manager capability) unlocks planning, the library
// and the children; everyone with Chores access can tick chores off. The API
// enforces the same rules.
//
// Left open on a TV: the hero slideshow runs, the board keeps itself current
// (re-syncs every minute when nobody's using it, so ticks from other devices
// show up) and a TV-safe screensaver takes over after 10 idle minutes.

import { Modal } from '../factories/modal-factory.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { escapeHtml } from '../utils/escape-html.js';
import { createScreensaver, SAVER_IDLE_MS } from '../utils/screensaver.js';
import { guestChores } from '../utils/chores/guest-store.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/chores`;

const TICK_MS = 30 * 1000;
const SYNC_MS = 60 * 1000;
const IDLE_MS = 90 * 1000;
const SAVER_MS = SAVER_IDLE_MS; // utils/screensaver.js — 5 minutes, the same on every page that has one
const HERO_SLIDE_MS = 8 * 1000;

/** Child colour key -> classes (full strings, so Tailwind keeps them). */
const KID = {
  orange:  { bg: 'bg-orange-500',  soft: 'bg-orange-50 dark:bg-orange-950/30',   text: 'text-orange-600 dark:text-orange-400',   bar: 'bg-orange-500', ring: 'text-orange-400' },
  sky:     { bg: 'bg-sky-500',     soft: 'bg-sky-50 dark:bg-sky-950/30',         text: 'text-sky-600 dark:text-sky-400',         bar: 'bg-sky-500', ring: 'text-sky-400' },
  emerald: { bg: 'bg-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-600 dark:text-emerald-400', bar: 'bg-emerald-500', ring: 'text-emerald-400' },
  violet:  { bg: 'bg-violet-500',  soft: 'bg-violet-50 dark:bg-violet-950/30',   text: 'text-violet-600 dark:text-violet-400',   bar: 'bg-violet-500', ring: 'text-violet-400' },
  rose:    { bg: 'bg-rose-500',    soft: 'bg-rose-50 dark:bg-rose-950/30',       text: 'text-rose-600 dark:text-rose-400',       bar: 'bg-rose-500', ring: 'text-rose-400' },
  amber:   { bg: 'bg-amber-500',   soft: 'bg-amber-50 dark:bg-amber-950/30',     text: 'text-amber-600 dark:text-amber-400',     bar: 'bg-amber-500', ring: 'text-amber-400' },
  teal:    { bg: 'bg-teal-500',    soft: 'bg-teal-50 dark:bg-teal-950/30',       text: 'text-teal-600 dark:text-teal-400',       bar: 'bg-teal-500', ring: 'text-teal-400' },
  indigo:  { bg: 'bg-indigo-500',  soft: 'bg-indigo-50 dark:bg-indigo-950/30',   text: 'text-indigo-600 dark:text-indigo-400',   bar: 'bg-indigo-500', ring: 'text-indigo-400' },
  lime:    { bg: 'bg-lime-500',    soft: 'bg-lime-50 dark:bg-lime-950/30',       text: 'text-lime-700 dark:text-lime-400',       bar: 'bg-lime-500', ring: 'text-lime-400' },
  fuchsia: { bg: 'bg-fuchsia-500', soft: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', text: 'text-fuchsia-600 dark:text-fuchsia-400', bar: 'bg-fuchsia-500', ring: 'text-fuchsia-400' },
};
const AREA_ICON = {
  kitchen: '🍽️', dining: '🪑', bedroom: '🛏️', bathroom: '🛁', living: '🛋️', floors: '🧹',
  laundry: '🧺', garbage: '🗑️', outdoors: '🌿', pets: '🐾', car: '🚗', general: '✨',
};
const TIME_LABEL = { morning: 'Morning', afternoon: 'Afternoon', evening: 'Evening', any: 'Any time' };

let data = { children: [], library: [], slots: [], plan: [], done: [], days: [], areas: {}, can_manage: false, accounts: [] };
let view = 'today';
let planDay = '';
let libQuery = '';
let libArea = '';
let modal = null;
let timer = null;
let heroTimer = null;
let docBound = false;
let lastInteraction = Date.now();
let mode = 'account';
const isGuest = () => mode === 'guest';
let lastSync = Date.now();
let saver = null;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const label = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`; };
const nowMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const parseDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayName = () => parseDate(data.today).toLocaleDateString('en-US', { weekday: 'long' });
const dateOf = (day) => { const d = parseDate(data.week_start); d.setDate(d.getDate() + data.days.indexOf(day)); return iso(d); };
const kidColor = (k) => KID[k?.color] || KID.orange;

/**
 * A child's face: their profile photo when they're linked to an account that
 * has one (ChoresController::presentChild → avatar), otherwise their initial
 * on their colour. `box` = size / shape / position classes, `text` = the
 * initial's size.
 */
function kidFace(k, box, text) {
  // The photo sits in a box with the same classes (an <img> wouldn't stretch
  // to fit absolute insets like the banner's ring)
  return k.avatar
    ? `<span class="${box} block overflow-hidden bg-white"><img src="${escapeHtml(k.avatar)}" alt="${escapeHtml(k.first_name)}" class="h-full w-full object-cover"></span>`
    : `<span class="${box} ${kidColor(k).bg} flex items-center justify-center ${text} font-bold text-white">${escapeHtml(k.first_name.slice(0, 1))}</span>`;
}
const chore = (id) => data.library.find((c) => c.id === id) || { id, title: 'Removed chore', minutes: 0, area: 'general', best_time: 'any' };
const child = (id) => data.children.find((c) => c.id === id);
const fullName = (k) => `${k.first_name}${k.last_name ? ` ${k.last_name}` : ''}`;
const slotsOn = (day) => data.slots.filter((s) => s.day === day);
const rowsFor = (slotKey, childId) => data.plan.filter((p) => p.slot === slotKey && (childId === undefined || p.child_id === childId));
const minutesOf = (rows) => rows.reduce((s, p) => s + chore(p.chore_id).minutes, 0);
const isDone = (planId, date) => data.done.some((d) => d.plan_id === planId && d.date === date);
const knownSlot = (key) => data.slots.some((s) => s.key === key);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  check: 'M5 13l4 4L19 7',
  plus: 'M12 4v16m8-8H4',
  x: 'M6 18L18 6M6 6l12 12',
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  share: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  trophy: 'M5 3h14v3a7 7 0 01-14 0V3zm7 10v4m-4 4h8M5 6H3a3 3 0 003 3m13-3h2a3 3 0 01-3 3',
};

/** The slot on now today, else the next one today. */
function currentSlot() {
  const m = nowMin();
  const today = slotsOn(todayName());
  return {
    now: today.find((s) => toMin(s.start) <= m && m < toMin(s.end)) || null,
    next: today.find((s) => toMin(s.start) > m) || null,
  };
}

/** Today's progress for one child (or everyone): {done, total}. */
function progressToday(childId) {
  const date = data.today;
  const keys = new Set(slotsOn(todayName()).map((s) => s.key));
  const rows = data.plan.filter((p) => keys.has(p.slot) && (childId === undefined || p.child_id === childId));
  return { done: rows.filter((p) => isDone(p.id, date)).length, total: rows.length };
}

/** This week so far (Monday .. today) for one child. */
function progressWeek(childId) {
  const upto = data.days.indexOf(todayName());
  let done = 0, total = 0;
  data.days.slice(0, upto + 1).forEach((day) => {
    const date = dateOf(day);
    slotsOn(day).forEach((s) => rowsFor(s.key, childId).forEach((p) => { total++; if (isDone(p.id, date)) done++; }));
  });
  return { done, total };
}

async function post(body) {
  if (isGuest()) {
    const json = guestChores.handle(body);
    if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
    return json;
  }
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}

function adopt(json) {
  ['children', 'library', 'slots', 'plan', 'done', 'today', 'week_start', 'areas', 'can_manage', 'accounts'].forEach((k) => {
    if (json[k] !== undefined) data[k] = json[k];
  });
}

function ring(pct, sizeCls, colorCls) {
  const r = 16, c = 2 * Math.PI * r;
  return `
    <svg class="${sizeCls} -rotate-90" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="currentColor" stroke-width="4" class="text-white/15"></circle>
      <circle cx="20" cy="20" r="${r}" fill="none" stroke="currentColor" stroke-width="4" stroke-linecap="round" class="${colorCls}"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}" style="transition: stroke-dashoffset 0.8s ease"></circle>
    </svg>`;
}

// ------------------------------------------------------------
// Init & live updates
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('chores-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('chores-data')?.textContent || '{}') }; } catch { /* defaults */ }
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  if (isGuest()) {
    guestChores.setup(data);
    adopt(guestChores.state());
  }
  view = 'today';
  planDay = todayName();
  libQuery = '';
  libArea = '';

  page.addEventListener('click', onClick);
  page.addEventListener('input', (e) => {
    if (e.target.matches('[data-lib-search]')) { libQuery = e.target.value.trim().toLowerCase(); renderLibraryList(); }
  });

  if (!docBound) {
    docBound = true;
    const touched = () => { lastInteraction = Date.now(); };
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, touched, { passive: true }));
  }
  lastInteraction = Date.now();
  lastSync = Date.now();

  saver?.remove();
  saver = createScreensaver({
    id: 'ch-saver',
    slides: data.slides || [],
    paint: saverLines,
    hint: 'Move the mouse or tap anywhere to return to the chores',
    onWake: () => { lastInteraction = Date.now(); },
  });

  render();
  startHeroSlides();
  clearInterval(timer);
  timer = setInterval(tick, TICK_MS);
}

const busy = () => document.body.style.overflow === 'hidden'
  || !!document.getElementById('confirm-proceed')
  || !!document.activeElement?.matches?.('input, textarea, select');

async function tick() {
  if (!document.getElementById('chores-page')) { clearInterval(timer); clearInterval(heroTimer); saver?.remove(); return; }
  if (document.visibilityState !== 'visible') return;
  const idle = Date.now() - lastInteraction >= IDLE_MS;

  if (idle && !busy() && Date.now() - lastSync >= SYNC_MS) {
    lastSync = Date.now();
    try {
      const json = isGuest() ? guestChores.state() : await (await fetch(api(), { cache: 'no-store' })).json();
      if (json.success && !busy()) adopt(json);
    } catch { /* offline for a moment */ }
  }
  renderHero();
  if (view === 'today' && !busy()) renderToday();
  if (saver?.isOpen()) saver.repaint();
  else if (saver && Date.now() - lastInteraction >= SAVER_MS && !busy()) saver.show();
}

function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll('#chores-page [data-hero-slides] .hero-slide')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  heroTimer = setInterval(() => {
    if (!document.body.contains(slides[0])) { clearInterval(heroTimer); return; }
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, HERO_SLIDE_MS);
}

/** Screensaver card: the slot on now / next, and how each child is doing today. */
function saverLines() {
  const { now, next } = currentSlot();
  const slot = now || next;
  const head = slot
    ? `<p class="text-xl sm:text-2xl text-white/80"><span class="text-white/45 text-base sm:text-lg uppercase tracking-widest mr-2">${now ? 'Now' : 'Next'}</span>${escapeHtml(slot.name)} <span class="text-white/45">· ${label(slot.start)}–${label(slot.end)}</span></p>`
    : '<p class="text-lg text-white/45">No more chore slots today.</p>';
  const kids = data.children.map((k) => {
    const p = progressToday(k.id);
    if (!p.total) return '';
    return `<div class="flex items-center gap-3 text-lg text-white/70">
      <span class="h-3 w-3 rounded-full ${kidColor(k).bg} opacity-80"></span>
      <span class="flex-1 truncate">${escapeHtml(k.first_name)}</span>
      <span class="text-white/50">${p.done === p.total ? 'All done ✓' : `${p.done} of ${p.total}`}</span>
    </div>`;
  }).join('');
  return head + (kids ? `<div class="mt-4 space-y-2">${kids}</div>` : '');
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function render() {
  document.querySelectorAll('#chores-page [data-manage-only]').forEach((el) => el.classList.toggle('hidden', !data.can_manage));
  if (view === 'kids' && !data.can_manage) view = 'today';
  document.querySelectorAll('#chores-page .ch-tab').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.view === view)));
  renderHero();
  if (view === 'today') renderToday();
  else if (view === 'plan') renderPlan();
  else if (view === 'library') renderLibrary();
  else renderKids();
}

function renderHero() {
  const el = document.getElementById('ch-hero');
  if (!el) return;
  const { now, next } = currentSlot();
  const all = progressToday();
  const m = nowMin();

  let headline, sub;
  if (!data.slots.length) {
    headline = 'Set up chore time';
    sub = 'Add “Chores” activities to the Timetable (e.g. Mon–Fri 6:30–6:50 AM) — they become the chore slots here.';
  } else if (now) {
    headline = escapeHtml(now.name);
    sub = `${label(now.start)} – ${label(now.end)} · <span class="font-semibold text-primary-300">${plural(toMin(now.end) - m, 'minute')} left</span>`;
  } else if (next) {
    headline = `Next: ${escapeHtml(next.name)}`;
    sub = `Starts at ${label(next.start)} · ${plural(next.minutes, 'minute')}`;
  } else {
    headline = all.total && all.done === all.total ? 'All done for today 🎉' : 'That’s it for chores today';
    sub = all.total ? `${all.done} of ${plural(all.total, 'chore')} done today` : 'No chores were planned for today.';
  }

  const kids = data.children.map((k) => {
    const p = progressToday(k.id);
    const pct = p.total ? p.done / p.total : 0;
    return `
      <div class="flex flex-col items-center gap-1.5 w-16">
        <div class="relative h-14 w-14">
          ${ring(pct, 'absolute inset-0 h-14 w-14', kidColor(k).ring)}
          ${kidFace(k, "absolute inset-[7px] rounded-full shadow-md", "text-base")}
          ${p.total && p.done === p.total ? `<span class="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-emerald-400 text-white flex items-center justify-center ring-2 ring-secondary-900">${svg(ICON.check, 'h-3 w-3')}</span>` : ''}
        </div>
        <span class="text-xs font-semibold text-white/90 truncate max-w-full">${escapeHtml(k.first_name)}</span>
        <span class="text-[11px] text-white/60">${p.total ? `${p.done}/${p.total}` : '—'}</span>
      </div>`;
  }).join('');

  el.innerHTML = `
    <div class="flex flex-col lg:flex-row lg:items-center gap-6">
      <div class="min-w-0 flex-1">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">
          ${now ? '<span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-primary-400"></span></span> Chore time' : `${svg(ICON.clock, 'h-3.5 w-3.5')} ${escapeHtml(todayName())}`}
        </span>
        <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">${headline}</h1>
        <p class="mt-2 text-base text-secondary-50">${sub}</p>
        ${all.total ? `
          <div class="mt-4 max-w-md">
            <div class="flex justify-between text-xs font-semibold text-white/70 mb-1.5"><span>Today</span><span>${all.done} of ${plural(all.total, 'chore')}</span></div>
            <div class="h-2 rounded-full bg-white/15 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-primary-400 to-amber-300 transition-all duration-700" style="width: ${Math.round((all.done / all.total) * 100)}%"></div></div>
          </div>` : ''}
      </div>
      ${data.children.length ? `<div class="flex flex-wrap gap-3 lg:justify-end">${kids}</div>` : ''}
    </div>`;
}

// --- Today --------------------------------------------------

function renderToday() {
  const body = document.getElementById('ch-body');
  if (!body) return;
  const day = todayName();
  const slots = slotsOn(day);
  const { now, next } = currentSlot();
  const focus = now || next;

  if (!data.slots.length) { body.innerHTML = noSlotsHtml(); return; }
  if (!slots.length) {
    body.innerHTML = card(`<div class="py-12 text-center"><p class="text-base font-semibold text-gray-800 dark:text-gray-100">No chore slots on ${escapeHtml(day)}</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Enjoy the day off! Chore slots come from the Timetable.</p></div>`) + championsHtml();
    return;
  }

  body.innerHTML = `<div class="space-y-5">${slots.map((s) => todaySlotHtml(s, s === focus, now === s)).join('')}</div>${championsHtml()}`;
}

function todaySlotHtml(slot, focused, isNow) {
  const date = data.today;
  const m = nowMin();
  const past = toMin(slot.end) <= m;
  const kids = data.children.filter((k) => rowsFor(slot.key, k.id).length);
  const total = rowsFor(slot.key);
  const doneN = total.filter((p) => isDone(p.id, date)).length;

  return `
    <section class="rounded-2xl border ${isNow ? 'border-primary-300 dark:border-primary-800 ring-4 ring-primary-500/10' : 'border-gray-200 dark:border-gray-800'} bg-white dark:bg-gray-900 shadow-sm overflow-hidden">
      <header class="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800 ${isNow ? 'bg-primary-50/60 dark:bg-primary-950/20' : ''}">
        <div class="min-w-0 mr-auto">
          <h2 class="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
            ${escapeHtml(slot.name)}
            ${isNow ? '<span class="rounded-full bg-primary-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">Now</span>' : ''}
            ${past && total.length && doneN === total.length ? '<span class="rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">All done</span>' : ''}
          </h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">${label(slot.start)} – ${label(slot.end)} · ${plural(slot.minutes, 'minute')}${total.length ? ` · ${doneN} of ${plural(total.length, 'chore')} done` : ''}</p>
        </div>
      </header>
      ${!total.length ? `<p class="px-5 py-6 text-sm text-gray-500 dark:text-gray-400">${data.can_manage ? 'No chores planned for this slot yet — use “Share out chores” or The week tab.' : 'No chores planned for this slot.'}</p>` : `
      <div class="grid gap-4 p-4 sm:p-5 sm:grid-cols-2 lg:grid-cols-3 ${kids.length > 3 ? '2xl:grid-cols-5' : ''} ${!focused && past ? 'opacity-75' : ''}">
        ${kids.map((k) => kidCardHtml(k, slot, date)).join('')}
      </div>`}
    </section>`;
}

function kidCardHtml(k, slot, date) {
  const c = kidColor(k);
  const rows = rowsFor(slot.key, k.id);
  const done = rows.filter((p) => isDone(p.id, date)).length;
  const all = done === rows.length;
  return `
    <div class="rounded-2xl ${c.soft} p-3.5 ${all ? 'ring-2 ring-emerald-400/60' : ''}">
      <div class="flex items-center gap-2.5 mb-3">
        ${kidFace(k, "h-9 w-9 flex-shrink-0 rounded-full shadow", "text-sm")}
        <div class="min-w-0 flex-1">
          <p class="text-sm font-bold text-gray-900 dark:text-white truncate">${escapeHtml(k.first_name)}</p>
          <p class="text-[11px] font-semibold ${all ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'}">${all ? 'All done! 🎉' : `${done} of ${rows.length} done`}</p>
        </div>
      </div>
      <ul class="space-y-1.5">
        ${rows.map((p) => {
          const ch = chore(p.chore_id);
          const d = isDone(p.id, date);
          return `
          <li>
            <button type="button" data-toggle="${p.id}" aria-pressed="${d}"
              class="w-full flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition-colors ${d ? 'bg-white/60 dark:bg-gray-900/40' : 'bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800 shadow-sm'}">
              <span class="h-6 w-6 flex-shrink-0 rounded-lg border-2 flex items-center justify-center transition-colors ${d ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-gray-300 dark:border-gray-600'}">${d ? svg(ICON.check, 'h-4 w-4') : ''}</span>
              <span class="min-w-0 flex-1">
                <span class="block text-sm font-semibold leading-snug break-words ${d ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}">${AREA_ICON[ch.area] || '✨'} ${escapeHtml(ch.title)}</span>
              </span>
              <span class="flex-shrink-0 text-[11px] font-semibold text-gray-400">${ch.minutes}m</span>
            </button>
          </li>`;
        }).join('')}
      </ul>
    </div>`;
}

function championsHtml() {
  const rows = data.children.map((k) => ({ k, ...progressWeek(k.id) })).filter((r) => r.total);
  if (!rows.length) return '';
  const best = Math.max(...rows.map((r) => (r.total ? r.done / r.total : 0)));
  return card(`
    <div class="p-5">
      <div class="flex items-center gap-2 mb-4">
        <span class="h-8 w-8 rounded-xl bg-amber-100 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">${svg(ICON.trophy)}</span>
        <div><h2 class="text-base font-bold text-gray-900 dark:text-white">Chore champions</h2><p class="text-xs text-gray-500 dark:text-gray-400">This week so far</p></div>
      </div>
      <div class="space-y-3">
        ${rows.map(({ k, done, total }) => {
          const pct = total ? done / total : 0;
          return `
          <div class="flex items-center gap-3">
            ${kidFace(k, "h-8 w-8 flex-shrink-0 rounded-full", "text-xs")}
            <div class="min-w-0 flex-1">
              <div class="flex justify-between text-sm"><span class="font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHtml(k.first_name)} ${pct === best && pct > 0 ? '👑' : ''}</span><span class="text-gray-500 dark:text-gray-400">${done}/${total}</span></div>
              <div class="mt-1 h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div class="h-full rounded-full ${kidColor(k).bar} transition-all duration-700" style="width: ${Math.round(pct * 100)}%"></div></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>`, 'mt-6');
}

const card = (inner, extra = '') => `<div class="${extra} rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">${inner}</div>`;

function noSlotsHtml() {
  return card(`
    <div class="py-14 px-6 text-center">
      <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 dark:bg-teal-950/40 text-3xl mb-4">🧹</span>
      <p class="text-base font-semibold text-gray-800 dark:text-gray-100">No chore slots yet</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">Chore slots come from the Timetable: any activity in the <strong>Chores</strong> category (or with “chore” in its name), like Mon–Fri 6:30–6:50 AM “Morning chores”.</p>
      <a href="${escapeHtml(data.timetable_url || `${base()}timetable`)}" data-partial class="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">Open the Timetable</a>
    </div>`);
}

// --- The week ----------------------------------------------

function renderPlan() {
  const body = document.getElementById('ch-body');
  if (!body) return;
  if (!data.slots.length) { body.innerHTML = noSlotsHtml(); return; }
  if (!data.days.includes(planDay)) planDay = todayName();

  const orphans = data.plan.filter((p) => !knownSlot(p.slot));
  const tabs = data.days.map((d) => {
    const n = slotsOn(d).length;
    const active = d === planDay;
    return `<button type="button" data-plan-day="${d}" aria-pressed="${active}"
      class="flex-shrink-0 px-3.5 py-2 rounded-xl text-sm font-semibold transition-colors ${active ? 'bg-primary-600 text-white shadow-sm' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300'}">
      ${d.slice(0, 3)}${d === todayName() ? ' •' : ''} <span class="ml-1 text-xs ${active ? 'text-white/80' : 'text-gray-400'}">${n}</span></button>`;
  }).join('');

  const slots = slotsOn(planDay);
  body.innerHTML = `
    ${orphans.length ? `
      <div class="mb-4 rounded-2xl bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 px-4 py-3 text-sm flex flex-wrap items-center gap-3">
        <span>${plural(orphans.length, 'planned chore is', 'planned chores are')} in chore slots that are no longer on the Timetable.</span>
        ${data.can_manage ? '<button type="button" data-act="orphans" class="ml-auto font-semibold underline">Remove them</button>' : ''}
      </div>` : ''}
    <div class="flex gap-2 overflow-x-auto pb-2 custom-scrollbar">${tabs}</div>
    <div class="mt-3 space-y-5">
      ${slots.length ? slots.map(planSlotHtml).join('') : card(`<p class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No chore slots on ${escapeHtml(planDay)}.</p>`)}
    </div>`;
}

function planSlotHtml(slot) {
  const kids = data.children;
  return `
    <section class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <header class="flex flex-wrap items-center gap-3 px-5 py-3.5 border-b border-gray-100 dark:border-gray-800">
        <div class="min-w-0 mr-auto">
          <h2 class="text-base font-bold text-gray-900 dark:text-white">${escapeHtml(slot.name)}</h2>
          <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(slot.day)} · ${label(slot.start)} – ${label(slot.end)} · each child has <strong>${plural(slot.minutes, 'minute')}</strong></p>
        </div>
        ${data.can_manage ? `
          <button type="button" data-share-slot="${escapeHtml(slot.key)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100 transition-colors">${svg(ICON.share, 'h-3.5 w-3.5')} Share out</button>
          <button type="button" data-clear-slot="${escapeHtml(slot.key)}" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">Clear</button>` : ''}
      </header>
      ${kids.length ? `
      <div class="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
        ${kids.map((k) => {
          const rows = rowsFor(slot.key, k.id);
          const used = minutesOf(rows);
          const pct = Math.min(100, Math.round((used / Math.max(1, slot.minutes)) * 100));
          const over = used > slot.minutes;
          const c = kidColor(k);
          return `
          <div class="rounded-2xl border border-gray-100 dark:border-gray-800 p-3">
            <div class="flex items-center gap-2 mb-2">
              ${kidFace(k, "h-7 w-7 rounded-full", "text-xs")}
              <span class="text-sm font-bold text-gray-900 dark:text-white truncate flex-1">${escapeHtml(k.first_name)}</span>
              <span class="text-[11px] font-semibold ${over ? 'text-red-600' : 'text-gray-400'}">${used}/${slot.minutes}m</span>
            </div>
            <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden mb-3" title="${used} of ${slot.minutes} minutes used">
              <div class="h-full rounded-full ${over ? 'bg-red-500' : pct > 85 ? 'bg-amber-400' : c.bar}" style="width: ${pct}%"></div>
            </div>
            ${over ? `<p class="mb-2 text-[11px] font-semibold text-red-600">${used - slot.minutes} min over the slot</p>` : ''}
            <ul class="space-y-1">
              ${rows.map((p) => {
                const ch = chore(p.chore_id);
                return `<li class="group flex items-center gap-2 rounded-lg bg-gray-50 dark:bg-gray-800/60 px-2 py-1.5 text-xs">
                  <span class="flex-1 min-w-0 truncate text-gray-800 dark:text-gray-100" title="${escapeHtml(ch.title)}">${AREA_ICON[ch.area] || '✨'} ${escapeHtml(ch.title)}</span>
                  <span class="text-gray-400">${ch.minutes}m</span>
                  ${data.can_manage ? `<button type="button" data-unassign="${p.id}" aria-label="Remove ${escapeHtml(ch.title)}" class="p-0.5 rounded text-gray-400 hover:text-red-600 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">${svg(ICON.x, 'h-3.5 w-3.5')}</button>` : ''}
                </li>`;
              }).join('') || '<li class="text-xs text-gray-400 px-1 py-1">No chores yet</li>'}
            </ul>
            ${data.can_manage ? `<button type="button" data-add-for="${k.id}" data-add-slot="${escapeHtml(slot.key)}" class="mt-2 w-full inline-flex items-center justify-center gap-1 rounded-lg border border-dashed border-gray-300 dark:border-gray-700 py-1.5 text-xs font-semibold text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors">${svg(ICON.plus, 'h-3.5 w-3.5')} Add chore</button>` : ''}
          </div>`;
        }).join('')}
      </div>` : '<p class="px-5 py-6 text-sm text-gray-500">Add children first (Children tab).</p>'}
    </section>`;
}

// --- Library ------------------------------------------------

function renderLibrary() {
  const body = document.getElementById('ch-body');
  if (!body) return;
  const areas = Object.entries(data.areas || {});
  body.innerHTML = card(`
    <div class="p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-3 sm:items-center">
      <div class="relative sm:w-72">
        <input type="search" data-lib-search value="${escapeHtml(libQuery)}" placeholder="Search ${plural(data.library.length, 'chore')}…" autocomplete="off"
          class="block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 px-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none">
      </div>
      <div class="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        <button type="button" data-lib-area="" aria-pressed="${libArea === ''}" class="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-300">All</button>
        ${areas.map(([k, v]) => `<button type="button" data-lib-area="${k}" aria-pressed="${libArea === k}" class="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-300">${AREA_ICON[k] || ''} ${escapeHtml(v)}</button>`).join('')}
      </div>
      ${data.can_manage ? `<button type="button" data-act="new-chore" class="sm:ml-auto flex-shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm">${svg(ICON.plus)} Add chore</button>` : ''}
    </div>
    <div data-lib-list class="p-4 sm:p-5"></div>`);
  renderLibraryList();
}

function renderLibraryList() {
  const list = document.querySelector('#chores-page [data-lib-list]');
  if (!list) return;
  const uses = {};
  data.plan.forEach((p) => { uses[p.chore_id] = (uses[p.chore_id] || 0) + 1; });
  const items = data.library.filter((c) => (!libArea || c.area === libArea) && (!libQuery || c.title.toLowerCase().includes(libQuery)));
  const groups = Object.keys(data.areas || {}).map((a) => [a, items.filter((c) => c.area === a)]).filter(([, l]) => l.length);

  list.innerHTML = groups.length ? groups.map(([area, chores]) => `
    <section class="mb-6 last:mb-0">
      <h3 class="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">${AREA_ICON[area] || ''} ${escapeHtml(data.areas[area])} <span class="text-gray-400">${chores.length}</span></h3>
      <div class="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        ${chores.map((c) => `
          <div class="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5 ${c.active ? '' : 'opacity-50'}">
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHtml(c.title)}</p>
              <p class="text-[11px] text-gray-500 dark:text-gray-400">${c.per_child ? '<span class="font-semibold text-teal-600 dark:text-teal-400">Personal</span> · ' : ''}${c.minutes} min · ${TIME_LABEL[c.best_time] || 'Any time'}${uses[c.id] ? ` · planned ${plural(uses[c.id], 'time')}` : ''}</p>
            </div>
            ${data.can_manage ? `<button type="button" data-edit-chore="${c.id}" class="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Edit</button>` : ''}
          </div>`).join('')}
      </div>
    </section>`).join('') : '<p class="py-10 text-center text-sm text-gray-500 dark:text-gray-400">No chores match.</p>';
}

// --- Children -----------------------------------------------

function renderKids() {
  const body = document.getElementById('ch-body');
  if (!body) return;
  body.innerHTML = `
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      ${data.children.map((k) => {
        const c = kidColor(k);
        const acct = data.accounts.find((a) => a.id === k.user_id);
        const week = progressWeek(k.id);
        const planned = data.plan.filter((p) => p.child_id === k.id).length;
        return card(`
          <div class="p-5 flex items-start gap-4">
            ${kidFace(k, "h-14 w-14 flex-shrink-0 rounded-2xl shadow-md", "text-xl")}
            <div class="min-w-0 flex-1">
              <p class="text-base font-bold text-gray-900 dark:text-white truncate">${escapeHtml(fullName(k))}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${plural(planned, 'chore')} a week · ${week.done}/${week.total} done so far</p>
              <p class="text-xs text-gray-400 mt-0.5">${acct ? `Account: ${escapeHtml(acct.name)}` : 'No account linked'}</p>
            </div>
            <button type="button" data-edit-kid="${k.id}" class="px-2.5 py-1 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">Edit</button>
          </div>`);
      }).join('')}
      <button type="button" data-act="new-kid" class="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 p-5 text-sm font-semibold text-gray-500 hover:text-primary-600 hover:border-primary-300 transition-colors">+ Add a child</button>
    </div>`;
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

async function onClick(e) {
  if (e.target.closest('#ch-guest-sample')) {
    if (!(await confirmDialog('Replace everything you have changed in the Chores demo with the sample children and plan?', 'Reload sample', 'Cancel', 'bg-primary-600 hover:bg-primary-700'))) return;
    adopt(guestChores.resetToSample()); render(); showToast('Sample data reloaded.', 'success'); return;
  }
  if (e.target.closest('#ch-guest-clear')) {
    if (!(await confirmDialog('Clear the chore plan and ticks in this browser? The children and the chore library stay.', 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700'))) return;
    adopt(guestChores.clear()); render(); showToast('The plan is empty — try “Share out chores”.', 'success'); return;
  }

  const tab = e.target.closest('.ch-tab');
  if (tab) { view = tab.dataset.view; render(); return; }

  const toggle = e.target.closest('[data-toggle]');
  if (toggle) { toggleDone(Number(toggle.dataset.toggle)); return; }

  const day = e.target.closest('[data-plan-day]');
  if (day) { planDay = day.dataset.planDay; renderPlan(); return; }

  const area = e.target.closest('[data-lib-area]');
  if (area) { libArea = area.dataset.libArea; renderLibrary(); return; }

  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act === 'share') { openShareOut(); return; }
  if (act === 'new-chore') { openChoreForm(null); return; }
  if (act === 'new-kid') { openKidForm(null); return; }
  if (act === 'orphans') { removeOrphans(); return; }

  const shareSlot = e.target.closest('[data-share-slot]');
  if (shareSlot) { openShareOut([shareSlot.dataset.shareSlot]); return; }
  const clear = e.target.closest('[data-clear-slot]');
  if (clear) { clearSlot(clear.dataset.clearSlot); return; }
  const un = e.target.closest('[data-unassign]');
  if (un) { unassign(Number(un.dataset.unassign)); return; }
  const add = e.target.closest('[data-add-for]');
  if (add) { openPicker(add.dataset.addSlot, Number(add.dataset.addFor)); return; }
  const edit = e.target.closest('[data-edit-chore]');
  if (edit) { openChoreForm(data.library.find((c) => c.id === Number(edit.dataset.editChore))); return; }
  const kid = e.target.closest('[data-edit-kid]');
  if (kid) { openKidForm(data.children.find((c) => c.id === Number(kid.dataset.editKid))); }
}

// ------------------------------------------------------------
// Actions
// ------------------------------------------------------------

async function toggleDone(planId) {
  const date = data.today;
  const was = isDone(planId, date);
  // Optimistic: flip it now, undo if the server says no
  data.done = was ? data.done.filter((d) => !(d.plan_id === planId && d.date === date)) : [...data.done, { plan_id: planId, date }];
  render();
  try {
    const json = await post({ action: 'toggle-done', plan_id: planId, date });
    if (json.done && progressToday().total && progressToday().done === progressToday().total) showToast('Every chore is done for today — great teamwork! 🎉', 'success');
  } catch (err) {
    data.done = was ? [...data.done, { plan_id: planId, date }] : data.done.filter((d) => !(d.plan_id === planId && d.date === date));
    render();
    showToast(err.message, 'error');
  }
}

async function unassign(id) {
  try {
    await post({ action: 'unassign', id });
    data.plan = data.plan.filter((p) => p.id !== id);
    data.done = data.done.filter((d) => d.plan_id !== id);
    render();
  } catch (err) { showToast(err.message, 'error'); }
}

async function clearSlot(key) {
  const n = rowsFor(key).length;
  if (!n) { showToast('That slot is already empty.', 'success'); return; }
  const s = data.slots.find((x) => x.key === key);
  if (!(await confirmDialog(`Take all ${plural(n, 'chore')} out of ${escapeHtml(s?.name || 'this slot')} on ${escapeHtml(s?.day || '')}?`, 'Clear slot', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    const json = await post({ action: 'clear-slot', slot: key });
    adopt(json);
    render();
    showToast(json.messages?.[0] || 'Cleared.', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

async function removeOrphans() {
  const orphans = data.plan.filter((p) => !knownSlot(p.slot));
  if (!(await confirmDialog(`Remove ${plural(orphans.length, 'planned chore')} whose slots are no longer on the Timetable?`, 'Remove', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    for (const p of orphans) await post({ action: 'unassign', id: p.id });
    data.plan = data.plan.filter((p) => knownSlot(p.slot));
    render();
    showToast('Removed.', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

// ------------------------------------------------------------
// Modals
// ------------------------------------------------------------

const input = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition';
const lbl = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5';
const chipCls = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300 aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-300';
const btnPrimary = 'inline-flex items-center justify-center min-w-[7rem] px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60';
const btnGhost = 'px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors';
const errorsHtml = (err) => (err.messages || [err.message]).map((m) => `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');

function openModal(id, title, content, size = 'lg') {
  modal?.destroy();
  modal = new Modal({ id, title, size, showFooter: false, content });
  modal.open();
  return document.getElementById(id);
}

/** Pick a chore for one child in one slot (stays open to add several). */
function openPicker(slotKey, childId) {
  const slot = data.slots.find((s) => s.key === slotKey);
  const k = child(childId);
  if (!slot || !k) return;
  let q = '';

  const root = openModal('ch-picker', `Add a chore for ${k.first_name}`, `
    <div class="space-y-4">
      <p class="text-sm text-gray-600 dark:text-gray-300">${escapeHtml(slot.name)} · ${escapeHtml(slot.day)} ${label(slot.start)}–${label(slot.end)} · <strong data-left></strong></p>
      <input type="search" data-q placeholder="Search chores…" autocomplete="off" class="${input}">
      <div data-list class="max-h-[26rem] overflow-y-auto custom-scrollbar divide-y divide-gray-100 dark:divide-gray-800 -mx-1"></div>
      <div class="flex justify-end pt-2"><button type="button" data-done class="${btnPrimary}">Done</button></div>
    </div>`);

  const draw = () => {
    const mine = rowsFor(slotKey, childId);
    const left = slot.minutes - minutesOf(mine);
    root.querySelector('[data-left]').textContent = left >= 0 ? `${left} min left for ${k.first_name}` : `${-left} min over`;
    const taken = new Map(rowsFor(slotKey).map((p) => [p.chore_id, p.child_id]));
    const list = data.library.filter((c) => c.active && (!q || c.title.toLowerCase().includes(q)))
      .sort((a, b) => ((a.best_time === slot.period ? 0 : a.best_time === 'any' ? 1 : 2) - (b.best_time === slot.period ? 0 : b.best_time === 'any' ? 1 : 2)) || a.title.localeCompare(b.title));
    root.querySelector('[data-list]').innerHTML = list.map((c) => {
      const holder = taken.get(c.id);
      const isMine = holder === childId;
      const fits = c.minutes <= left;
      return `
        <button type="button" data-pick="${c.id}" ${isMine ? 'disabled' : ''}
          class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-800/60 disabled:opacity-40 disabled:hover:bg-transparent transition-colors">
          <span class="text-lg">${AREA_ICON[c.area] || '✨'}</span>
          <span class="min-w-0 flex-1">
            <span class="block text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHtml(c.title)}</span>
            <span class="block text-[11px] text-gray-500 dark:text-gray-400">${c.per_child ? 'Personal · ' : ''}${TIME_LABEL[c.best_time]}${holder && !isMine && !c.per_child ? ` · ${escapeHtml(child(holder)?.first_name || 'someone')} has it` : ''}${isMine ? ' · already theirs' : ''}</span>
          </span>
          <span class="flex-shrink-0 text-xs font-semibold ${fits ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600'}">${c.minutes}m${fits ? '' : ' · too long'}</span>
        </button>`;
    }).join('') || '<p class="py-8 text-center text-sm text-gray-500">No chores match.</p>';
  };
  draw();
  setTimeout(() => root.querySelector('[data-q]')?.focus(), 50);

  root.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); draw(); });
  root.addEventListener('click', async (e) => {
    if (e.target.closest('[data-done]')) { modal.close(); return; }
    const pick = e.target.closest('[data-pick]');
    if (!pick || pick.disabled) return;
    try {
      const json = await post({ action: 'assign', slot: slotKey, child_id: childId, chore_id: Number(pick.dataset.pick) });
      data.plan.push(json.plan);
      draw();
      render();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

/** Share chores out across one or more slots. */
function openShareOut(preselect = []) {
  if (!data.slots.length) { showToast('Add chore slots to the Timetable first.', 'error'); return; }
  const chosenSlots = new Set(preselect);
  const chosenChores = new Set();
  let q = '';

  // Group slots by name + start time (e.g. "Morning chores · 6:30 AM" Mon–Fri)
  const groups = [];
  data.slots.forEach((s) => {
    const key = `${s.name}|${s.start}`;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, name: s.name, start: s.start, end: s.end, period: s.period, slots: [] }));
    g.slots.push(s);
  });

  const root = openModal('ch-share', 'Share out chores', `
    <form data-share class="space-y-5" novalidate>
      <div>
        <span class="${lbl}">1. Which chore slots?</span>
        <div class="space-y-2" data-groups>
          ${groups.map((g, gi) => `
            <div class="rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5 flex flex-wrap items-center gap-2">
              <button type="button" data-group="${gi}" class="mr-auto text-left">
                <span class="block text-sm font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(g.name)}</span>
                <span class="block text-[11px] text-gray-500 dark:text-gray-400">${label(g.start)}–${label(g.end)} · tap to pick every day</span>
              </button>
              ${g.slots.map((s) => `<button type="button" data-slot-pick="${escapeHtml(s.key)}" aria-pressed="false" class="${chipCls} w-11">${s.day.slice(0, 3)}</button>`).join('')}
            </div>`).join('')}
        </div>
      </div>
      <div>
        <div class="flex flex-wrap items-center gap-2 mb-1.5">
          <span class="${lbl} !mb-0 mr-auto">2. Which chores?</span>
          <button type="button" data-suggest class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">Pick ones that suit these times</button>
          <button type="button" data-none class="text-xs font-semibold text-gray-500 hover:underline">Clear</button>
        </div>
        <input type="search" data-q placeholder="Search chores…" autocomplete="off" class="${input} mb-2">
        <div data-chores class="max-h-64 overflow-y-auto custom-scrollbar rounded-xl border border-gray-200 dark:border-gray-700 p-2 grid sm:grid-cols-2 gap-1"></div>
        <p class="mt-2 text-xs text-gray-500 dark:text-gray-400" data-summary></p>
      </div>
      <fieldset class="space-y-2">
        <legend class="${lbl}">3. What's already in those slots</legend>
        <label class="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-200"><input type="radio" name="mode" value="add" checked class="mt-0.5 text-primary-600"> <span><strong>Keep it</strong> — share out the new chores around it</span></label>
        <label class="flex items-start gap-2.5 text-sm text-gray-700 dark:text-gray-200"><input type="radio" name="mode" value="replace" class="mt-0.5 text-primary-600"> <span><strong>Start over</strong> — clear those slots first</span></label>
      </fieldset>
      <div class="api-message"></div>
      <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        <button type="button" data-cancel class="${btnGhost}">Cancel</button>
        <button type="submit" class="${btnPrimary}">Share out</button>
      </div>
    </form>`);

  const form = root.querySelector('[data-share]');
  const syncSlots = () => form.querySelectorAll('[data-slot-pick]').forEach((b) => b.setAttribute('aria-pressed', String(chosenSlots.has(b.dataset.slotPick))));
  const drawChores = () => {
    const list = data.library.filter((c) => c.active && (!q || c.title.toLowerCase().includes(q)));
    form.querySelector('[data-chores]').innerHTML = list.map((c) => `
      <label class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-gray-50 dark:hover:bg-gray-800/60 cursor-pointer">
        <input type="checkbox" data-chore="${c.id}" ${chosenChores.has(c.id) ? 'checked' : ''} class="rounded border-gray-300 text-primary-500 focus:ring-primary-400">
        <span class="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200">${AREA_ICON[c.area] || '✨'} ${escapeHtml(c.title)}</span>
        <span class="text-[11px] text-gray-400">${c.per_child ? '<span class="text-teal-600 dark:text-teal-400 font-semibold">each</span> · ' : ''}${c.minutes}m</span>
      </label>`).join('') || '<p class="p-4 text-sm text-gray-500">No chores match.</p>';
    summary();
  };
  const summary = () => {
    const kids = Math.max(1, data.children.length);
    const mins = [...chosenChores].reduce((s, id) => s + chore(id).minutes * (chore(id).per_child ? kids : 1), 0);
    const slots = data.slots.filter((s) => chosenSlots.has(s.key));
    const cap = slots.length ? Math.min(...slots.map((s) => s.minutes)) * Math.max(1, data.children.length) : 0;
    form.querySelector('[data-summary]').innerHTML = chosenChores.size
      ? `${plural(chosenChores.size, 'chore')} · ${mins} min of work per slot${cap ? ` · room for about ${cap} min (${data.children.length} × ${Math.min(...slots.map((s) => s.minutes))} min)` : ''}${cap && mins > cap ? ' — <span class="text-amber-600 font-semibold">some won\'t fit</span>' : ''}`
      : 'Tick the chores to share out.';
  };
  syncSlots();
  drawChores();

  form.querySelector('[data-q]').addEventListener('input', (e) => { q = e.target.value.trim().toLowerCase(); drawChores(); });
  form.addEventListener('change', (e) => {
    const cb = e.target.closest('[data-chore]');
    if (!cb) return;
    const id = Number(cb.dataset.chore);
    if (cb.checked) chosenChores.add(id); else chosenChores.delete(id);
    summary();
  });
  form.addEventListener('click', (e) => {
    const sp = e.target.closest('[data-slot-pick]');
    if (sp) { const k = sp.dataset.slotPick; if (chosenSlots.has(k)) chosenSlots.delete(k); else chosenSlots.add(k); syncSlots(); summary(); return; }
    const g = e.target.closest('[data-group]');
    if (g) {
      const slots = groups[Number(g.dataset.group)].slots.map((s) => s.key);
      const all = slots.every((k) => chosenSlots.has(k));
      slots.forEach((k) => (all ? chosenSlots.delete(k) : chosenSlots.add(k)));
      syncSlots(); summary(); return;
    }
    if (e.target.closest('[data-suggest]')) {
      const periods = new Set(data.slots.filter((s) => chosenSlots.has(s.key)).map((s) => s.period));
      if (!periods.size) { showToast('Pick the chore slots first.', 'error'); return; }
      data.library.forEach((c) => { if (c.active && periods.has(c.best_time)) chosenChores.add(c.id); });
      drawChores(); return;
    }
    if (e.target.closest('[data-none]')) { chosenChores.clear(); drawChores(); return; }
    if (e.target.closest('[data-cancel]')) modal.close();
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    const replace = form.querySelector('[name="mode"]:checked')?.value === 'replace';
    const slotKeys = data.slots.filter((s) => chosenSlots.has(s.key)).map((s) => s.key);
    if (replace && slotKeys.some((k) => rowsFor(k).length)) {
      const n = slotKeys.reduce((s, k) => s + rowsFor(k).length, 0);
      if (!(await confirmDialog(`This clears ${plural(n, 'planned chore')} from those slots first (and any ticks on them). Go ahead?`, 'Start over', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
    }
    btn.disabled = true;
    try {
      const json = await post({ action: 'share-out', slots: slotKeys, chore_ids: [...chosenChores], replace });
      adopt(json);
      modal.close();
      render();
      showToast(json.messages?.[0] || 'Shared out.', 'success');
      if (json.unfit?.length) {
        const shown = json.unfit.slice(0, 8).map(escapeHtml).join('<br>');
        confirmDialog(`These didn't fit anyone's time in the slot:<br><br>${shown}${json.unfit.length > 8 ? `<br>…and ${json.unfit.length - 8} more` : ''}<br><br>Try fewer chores, or longer chore slots in the Timetable.`, 'OK', 'Close', 'bg-primary-600 hover:bg-primary-700');
      }
    } catch (err) {
      form.querySelector('.api-message').innerHTML = errorsHtml(err);
    } finally { btn.disabled = false; }
  });
}

function openChoreForm(c) {
  const isEdit = !!c;
  const v = c || { title: '', area: 'kitchen', minutes: 10, best_time: 'any', per_child: false, detail: '' };
  const root = openModal('ch-chore', isEdit ? 'Edit chore' : 'Add a chore', `
    <form data-chore-form class="space-y-5" novalidate>
      <div><label class="${lbl}" for="ch-title">Chore</label><input id="ch-title" name="title" maxlength="150" value="${escapeHtml(v.title)}" placeholder="e.g. Wipe the bathroom mirror" class="${input}"></div>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="${lbl}" for="ch-area">Where</label>
          <select id="ch-area" name="area" class="${input}">${Object.entries(data.areas).map(([k, n]) => `<option value="${k}" ${k === v.area ? 'selected' : ''}>${AREA_ICON[k] || ''} ${escapeHtml(n)}</option>`).join('')}</select></div>
        <div><label class="${lbl}" for="ch-min">About how long</label>
          <div class="relative"><input id="ch-min" name="minutes" type="number" min="1" max="240" value="${v.minutes}" class="${input} pr-14"><span class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">min</span></div>
          <div class="mt-2 flex flex-wrap gap-1.5">${[5, 10, 15, 20, 30].map((m) => `<button type="button" data-min="${m}" class="${chipCls}">${m}m</button>`).join('')}</div></div>
      </div>
      <div><span class="${lbl}">Best time of day</span>
        <div class="flex flex-wrap gap-1.5">${Object.entries(TIME_LABEL).map(([k, n]) => `<button type="button" data-best="${k}" aria-pressed="${k === v.best_time}" class="${chipCls}">${n}</button>`).join('')}</div>
        <input type="hidden" name="best_time" value="${v.best_time}"></div>
      <label class="flex items-start gap-3 rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3 cursor-pointer">
        <input type="checkbox" name="per_child" value="1" ${v.per_child ? 'checked' : ''} class="mt-0.5 rounded border-gray-300 text-primary-500 focus:ring-primary-400">
        <span><span class="block text-sm font-semibold text-gray-800 dark:text-gray-100">Personal — everyone does their own</span>
        <span class="block text-xs text-gray-500 dark:text-gray-400">Like making your bed. “Share out” gives it to every child, instead of just one.</span></span>
      </label>
      <div><label class="${lbl}" for="ch-detail">Notes <span class="font-normal text-gray-400">(optional)</span></label><textarea id="ch-detail" name="detail" rows="2" maxlength="1000" class="${input} resize-y" placeholder="How to do it well…">${escapeHtml(v.detail || '')}</textarea></div>
      <div class="api-message"></div>
      <div class="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        ${isEdit ? '<button type="button" data-delete class="px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Delete</button>' : ''}
        <button type="button" data-cancel class="${btnGhost} ml-auto">Cancel</button>
        <button type="submit" class="${btnPrimary}">${isEdit ? 'Save' : 'Add chore'}</button>
      </div>
    </form>`, 'md');
  const form = root.querySelector('[data-chore-form]');
  setTimeout(() => form.querySelector('[name="title"]').focus(), 50);

  form.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-min]');
    if (m) { form.querySelector('[name="minutes"]').value = m.dataset.min; return; }
    const b = e.target.closest('[data-best]');
    if (b) { form.querySelector('[name="best_time"]').value = b.dataset.best; form.querySelectorAll('[data-best]').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); return; }
    if (e.target.closest('[data-cancel]')) { modal.close(); return; }
    if (e.target.closest('[data-delete]')) {
      const uses = data.plan.filter((p) => p.chore_id === c.id).length;
      if (!(await confirmDialog(`Delete <strong>${escapeHtml(c.title)}</strong> from the library${uses ? ` and from ${plural(uses, 'planned slot')}` : ''}?`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      try { const json = await post({ action: 'delete-chore', id: c.id }); adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Deleted.', 'success'); } catch (err) { showToast(err.message, 'error'); }
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    try {
      const json = await post({ action: 'save-chore', id: c?.id || 0, ...f, minutes: Number(f.minutes), per_child: !!f.per_child });
      const i = data.library.findIndex((x) => x.id === json.chore.id);
      if (i >= 0) data.library[i] = json.chore; else data.library.push(json.chore);
      data.library.sort((a, b) => a.title.localeCompare(b.title));
      modal.close();
      render();
      showToast(json.messages?.[0] || 'Saved.', 'success');
    } catch (err) { form.querySelector('.api-message').innerHTML = errorsHtml(err); }
  });
}

function openKidForm(k) {
  const isEdit = !!k;
  const v = k || { first_name: '', last_name: '', color: Object.keys(KID).find((c) => !data.children.some((x) => x.color === c)) || 'orange', user_id: null };
  const root = openModal('ch-kid', isEdit ? `Edit ${k.first_name}` : 'Add a child', `
    <form data-kid-form class="space-y-5" novalidate>
      <div class="grid sm:grid-cols-2 gap-4">
        <div><label class="${lbl}" for="ch-first">First name</label><input id="ch-first" name="first_name" maxlength="100" value="${escapeHtml(v.first_name)}" class="${input}"></div>
        <div><label class="${lbl}" for="ch-last">Last name</label><input id="ch-last" name="last_name" maxlength="100" value="${escapeHtml(v.last_name)}" class="${input}"></div>
      </div>
      <div><span class="${lbl}">Colour</span>
        <div class="flex flex-wrap gap-2">${Object.keys(KID).map((c) => `<button type="button" data-color="${c}" aria-pressed="${c === v.color}" aria-label="${c}" class="h-8 w-8 rounded-full ${KID[c].bg} ring-offset-2 ring-offset-white dark:ring-offset-gray-900 aria-pressed:ring-2 aria-pressed:ring-gray-900 dark:aria-pressed:ring-white"></button>`).join('')}</div>
        <input type="hidden" name="color" value="${v.color}"></div>
      <div><label class="${lbl}" for="ch-acct">Their CatScript account <span class="font-normal text-gray-400">(optional)</span></label>
        <select id="ch-acct" name="user_id" class="${input}"><option value="">None</option>${data.accounts.map((a) => `<option value="${a.id}" ${a.id === v.user_id ? 'selected' : ''}>${escapeHtml(a.name)}</option>`).join('')}</select></div>
      <div class="api-message"></div>
      <div class="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
        ${isEdit ? '<button type="button" data-remove class="px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Take off the chores</button>' : ''}
        <button type="button" data-cancel class="${btnGhost} ml-auto">Cancel</button>
        <button type="submit" class="${btnPrimary}">${isEdit ? 'Save' : 'Add'}</button>
      </div>
    </form>`, 'md');
  const form = root.querySelector('[data-kid-form]');
  form.addEventListener('click', async (e) => {
    const c = e.target.closest('[data-color]');
    if (c) { form.querySelector('[name="color"]').value = c.dataset.color; form.querySelectorAll('[data-color]').forEach((x) => x.setAttribute('aria-pressed', String(x === c))); return; }
    if (e.target.closest('[data-cancel]')) { modal.close(); return; }
    if (e.target.closest('[data-remove]')) {
      const n = data.plan.filter((p) => p.child_id === k.id).length;
      if (!(await confirmDialog(`Take <strong>${escapeHtml(fullName(k))}</strong> off the chores?${n ? ` Their ${plural(n, 'planned chore')} will be removed.` : ''}`, 'Take off', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      try { const json = await post({ action: 'remove-child', id: k.id }); adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Done.', 'success'); } catch (err) { showToast(err.message, 'error'); }
    }
  });
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form).entries());
    try {
      const json = await post({ action: 'save-child', id: k?.id || 0, ...f, user_id: Number(f.user_id) || 0 });
      adopt(json);
      modal.close();
      render();
      showToast(json.messages?.[0] || 'Saved.', 'success');
    } catch (err) { form.querySelector('.api-message').innerHTML = errorsHtml(err); }
  });
}
