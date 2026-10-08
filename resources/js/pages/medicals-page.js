// /resources/js/pages/medicals-page.js
//
// Medicals: the family's health in one place. Everything lives in memory
// (seeded from #medicals-data); render() draws the live photo hero and the
// current tab:
//
//   Today         reminders (book / confirm / refill / due / late doses),
//                 today's doses to tick off, as-needed medicines, the next
//                 two weeks of appointments
//   Appointments  upcoming / to book / past, by person
//   Medications   who takes what, dose times, refills
//   Records       vaccinations, check-ups, tests… with "next due"
//   Family        everyone's health profile (+ a printable summary)
//   Providers     doctors, dentists, pharmacies — tap to call
//
// What needs doing is worked out by utils/medicals/insights.js, shared with
// the hero and the TV screensaver. Every write returns the whole (small)
// state, which simply replaces ours. Guests (data-mode="guest") get the
// same page backed by utils/medicals/guest-store.js — only post() differs.
//
// Live: the hero redraws every 30 s; when nobody's touched the page for a
// while it re-syncs from the server, and after SAVER_IDLE_MS the TV-safe
// screensaver takes over (utils/screensaver.js).
//
// Listeners are delegated from #medicals-page, which the SPA router replaces
// on each visit; window-level listeners are bound once.

import { Modal } from '../factories/modal-factory.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { escapeHtml } from '../utils/escape-html.js';
import { createScreensaver, SAVER_IDLE_MS } from '../utils/screensaver.js';
import { TONE, formSection, kitInput, kitLabel, kitSubmit, kitGhost } from '../forms/form-kit.js';
import { guestMedicals } from '../utils/medicals/guest-store.js';
import {
  iso, pad, parse, clock, daysBetween, shortDate, when, countdown, age, person, provider, fullName, isCurrent,
  upcoming, unconfirmed, doseSlots, prnGivenToday, reminders, heroHtml, saverHtml,
} from '../utils/medicals/insights.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/medicals`;
const TICK_MS = 30 * 1000;
const IDLE_MS = 90 * 1000;
const SYNC_MS = 5 * 60 * 1000;
const HERO_SLIDE_MS = 8 * 1000;

/** Person colour -> classes (full strings for Tailwind). */
const PCOL = {
  sky:     { bg: 'bg-sky-500',     soft: 'bg-sky-50 dark:bg-sky-950/30',         text: 'text-sky-700 dark:text-sky-300',         ring: 'ring-sky-200 dark:ring-sky-900/60' },
  rose:    { bg: 'bg-rose-500',    soft: 'bg-rose-50 dark:bg-rose-950/30',       text: 'text-rose-700 dark:text-rose-300',       ring: 'ring-rose-200 dark:ring-rose-900/60' },
  emerald: { bg: 'bg-emerald-500', soft: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', ring: 'ring-emerald-200 dark:ring-emerald-900/60' },
  violet:  { bg: 'bg-violet-500',  soft: 'bg-violet-50 dark:bg-violet-950/30',   text: 'text-violet-700 dark:text-violet-300',   ring: 'ring-violet-200 dark:ring-violet-900/60' },
  amber:   { bg: 'bg-amber-500',   soft: 'bg-amber-50 dark:bg-amber-950/30',     text: 'text-amber-700 dark:text-amber-300',     ring: 'ring-amber-200 dark:ring-amber-900/60' },
  teal:    { bg: 'bg-teal-500',    soft: 'bg-teal-50 dark:bg-teal-950/30',       text: 'text-teal-700 dark:text-teal-300',       ring: 'ring-teal-200 dark:ring-teal-900/60' },
  indigo:  { bg: 'bg-indigo-500',  soft: 'bg-indigo-50 dark:bg-indigo-950/30',   text: 'text-indigo-700 dark:text-indigo-300',   ring: 'ring-indigo-200 dark:ring-indigo-900/60' },
  orange:  { bg: 'bg-orange-500',  soft: 'bg-orange-50 dark:bg-orange-950/30',   text: 'text-orange-700 dark:text-orange-300',   ring: 'ring-orange-200 dark:ring-orange-900/60' },
  lime:    { bg: 'bg-lime-500',    soft: 'bg-lime-50 dark:bg-lime-950/30',       text: 'text-lime-700 dark:text-lime-300',       ring: 'ring-lime-200 dark:ring-lime-900/60' },
  fuchsia: { bg: 'bg-fuchsia-500', soft: 'bg-fuchsia-50 dark:bg-fuchsia-950/30', text: 'text-fuchsia-700 dark:text-fuchsia-300', ring: 'ring-fuchsia-200 dark:ring-fuchsia-900/60' },
};
const pc = (p) => PCOL[p?.color] || PCOL.sky;
const STATUS_CHIP = {
  to_book: 'bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300',
  booked: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  done: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
  missed: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
};
const TONE_CARD = {
  red: 'border-red-200 bg-red-50/70 dark:border-red-900/50 dark:bg-red-950/20',
  amber: 'border-amber-200 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-950/20',
  violet: 'border-violet-200 bg-violet-50/70 dark:border-violet-900/50 dark:bg-violet-950/20',
  sky: 'border-sky-200 bg-sky-50/70 dark:border-sky-900/50 dark:bg-sky-950/20',
};
const APPT_ICON = { checkup: '🩺', dental: '🦷', vision: '👓', specialist: '👩‍⚕️', vaccination: '💉', lab: '🧪', therapy: '🧠', urgent: '🚑', other: '📌' };
const PROVIDER_ICON = { doctor: '🩺', dentist: '🦷', specialist: '👩‍⚕️', clinic: '🏥', hospital: '🏨', pharmacy: '💊', optometrist: '👓', therapist: '🧠', other: '📇' };

let data = { people: [], providers: [], appointments: [], medications: [], doses: [], records: [], accounts: [], today: '' };
let mode = 'account';
let view = 'today';
let who = 'all';           // person filter on Appointments / Medications / Records
let apptView = 'upcoming'; // upcoming | to_book | past
let recKind = 'all';
let modal = null;
let tickTimer = null;
let slideTimer = null;
let docBound = false;
let lastInteraction = Date.now();
let lastSync = Date.now();
let lastDay = '';
let saver = null;
const isGuest = () => mode === 'guest';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  plus: 'M12 4v16m8-8H4',
  check: 'M5 13l4 4L19 7',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  cal: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  print: 'M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z',
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  x: 'M6 18L18 6M6 6l12 12',
  globe: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9',
};
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const initials = (p) => `${(p?.first_name || '?')[0]}${(p?.last_name || '')[0] || ''}`.toUpperCase();
const telUrl = (s) => `tel:${String(s).replace(/[^\d+]/g, '')}`;
const nowHHMM = () => { const d = new Date(); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const card = (inner, extra = '') => `<section class="rounded-2xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm ${extra}">${inner}</section>`;
const sectionHead = (title, hint = '', right = '') => `
  <div class="flex flex-wrap items-end gap-3 px-5 pt-5 pb-3">
    <div class="min-w-0 flex-1"><h2 class="text-base font-bold text-gray-900 dark:text-white">${title}</h2>${hint ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${hint}</p>` : ''}</div>${right}
  </div>`;
const empty = (icon, title, text, button = '') => `
  <div class="px-5 py-12 text-center">
    <div class="text-4xl mb-3">${icon}</div>
    <p class="text-base font-semibold text-gray-800 dark:text-gray-100">${title}</p>
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-md mx-auto">${text}</p>${button}
  </div>`;
const btnPrimary = 'inline-flex items-center gap-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors';
const btnSoft = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors';
const avatar = (p, size = 'h-10 w-10 text-sm') => `<span class="${size} flex-shrink-0 rounded-2xl ${pc(p).bg} text-white font-bold flex items-center justify-center shadow-sm">${escapeHtml(initials(p))}</span>`;

async function post(body) {
  if (isGuest()) {
    const json = guestMedicals.handle(body);
    if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
    return json;
  }
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}

function adopt(json) {
  ['people', 'providers', 'appointments', 'medications', 'doses', 'records', 'today'].forEach((k) => { if (json[k] !== undefined) data[k] = json[k]; });
}
const errorsHtml = (err) => (err.messages || [err.message]).map((m) => `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');

// ------------------------------------------------------------
// Init & live updates
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('medicals-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('medicals-data')?.textContent || '{}') }; } catch { /* defaults */ }
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  if (isGuest()) {
    guestMedicals.setup(data);
    adopt(guestMedicals.state());
  }
  view = 'today';
  who = 'all';
  apptView = 'upcoming';
  recKind = 'all';

  page.addEventListener('click', onClick);

  if (!docBound) {
    docBound = true;
    const touched = () => { lastInteraction = Date.now(); };
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, touched, { passive: true }));
    document.addEventListener('click', (e) => { if (!e.target.closest('#medicals-page [data-menu-root]')) closeMenu(); });
  }
  lastInteraction = Date.now();
  lastSync = Date.now();
  lastDay = iso(new Date());

  saver?.remove();
  saver = createScreensaver({
    id: 'md-saver',
    slides: data.slides || [],
    paint: () => saverHtml(data),
    hint: 'Move the mouse or tap anywhere to return to Medicals',
    onWake: () => { lastInteraction = Date.now(); },
  });

  render();
  startHeroSlides();
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, TICK_MS);
}

const busy = () => document.body.style.overflow === 'hidden'
  || !!document.getElementById('confirm-proceed')
  || !!document.activeElement?.matches?.('input, textarea, select');

async function tick() {
  if (!document.getElementById('medicals-page')) { clearInterval(tickTimer); clearInterval(slideTimer); saver?.remove(); return; }
  if (document.visibilityState !== 'visible') return;

  if (iso(new Date()) !== lastDay && !busy()) { lastDay = iso(new Date()); data.today = lastDay; render(); }
  const idle = Date.now() - lastInteraction >= IDLE_MS;
  if (!isGuest() && idle && !busy() && Date.now() - lastSync >= SYNC_MS) {
    lastSync = Date.now();
    try {
      const json = await (await fetch(api(), { cache: 'no-store' })).json();
      if (json.success && !busy()) { adopt(json); renderBody(); }
    } catch { /* offline for a moment */ }
  }
  renderHero();
  if (view === 'today' && !busy()) renderBody();
  if (saver?.isOpen()) saver.repaint();
  else if (saver && Date.now() - lastInteraction >= SAVER_IDLE_MS && !busy()) saver.show();
}

function startHeroSlides() {
  clearInterval(slideTimer);
  const slides = [...document.querySelectorAll('#medicals-page [data-hero-slides] .hero-slide')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  slideTimer = setInterval(() => {
    if (!document.body.contains(slides[0])) { clearInterval(slideTimer); return; }
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, HERO_SLIDE_MS);
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function render() {
  document.querySelectorAll('#medicals-page .md-tab').forEach((t) => t.setAttribute('aria-pressed', String(t.dataset.view === view)));
  renderHero();
  renderBody();
}

function renderHero() {
  const el = document.getElementById('md-hero');
  if (el) el.innerHTML = heroHtml(data);
}

function renderBody() {
  const el = document.getElementById('md-body');
  if (!el) return;
  if (!data.people.length && view !== 'providers') { el.innerHTML = card(empty('👪', 'Start with your family', 'Add the people you look after — then their doctors, appointments, medications and vaccinations.', `<button type="button" data-act="new-person" class="mt-5 ${btnPrimary}">${svg(ICON.plus)} Add a family member</button>`)); return; }
  el.innerHTML = {
    today: todayHtml, appointments: appointmentsHtml, medications: medicationsHtml,
    records: recordsHtml, family: familyHtml, providers: providersHtml,
  }[view]();
}

/** "Everyone / Grace / David …" chips. */
function whoChips() {
  const chip = (id, label, p) => `<button type="button" data-who="${id}" aria-pressed="${String(who === id)}"
    class="inline-flex items-center gap-2 whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300 aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-300">
    ${p ? `<span class="h-2.5 w-2.5 rounded-full ${pc(p).bg}"></span>` : ''}${escapeHtml(label)}</button>`;
  return `<div class="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1">${chip('all', 'Everyone')}${data.people.map((p) => chip(String(p.id), p.first_name, p)).join('')}</div>`;
}
const forWho = (personId) => who === 'all' || Number(who) === personId;

// --- Today ------------------------------------------------------------

function reminderCard(r) {
  const action = {
    confirm: `<button type="button" data-done="${r.action.id}" class="${btnSoft} bg-emerald-600 text-white hover:bg-emerald-700">Done</button>
              <button type="button" data-status="${r.action.id}|missed" class="${btnSoft} text-gray-600 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-gray-800">Missed</button>`,
    appointment: `<button type="button" data-open-appt="${r.action.id}" class="${btnSoft} text-sky-700 dark:text-sky-300 hover:bg-white/70 dark:hover:bg-gray-800">View</button>`,
    'book-existing': `<button type="button" data-edit-appt="${r.action.id}" class="${btnSoft} bg-violet-600 text-white hover:bg-violet-700">Book it</button>`,
    'book-new': `<button type="button" data-book='${escapeHtml(JSON.stringify(r.action))}' class="${btnSoft} bg-primary-600 text-white hover:bg-primary-700">Book</button>`,
    medication: `<button type="button" data-edit-med="${r.action.id}" class="${btnSoft} text-amber-700 dark:text-amber-300 hover:bg-white/70 dark:hover:bg-gray-800">Update</button>`,
    doses: '',
  }[r.action.type] || '';
  return `
    <div class="flex items-start gap-3 rounded-2xl border ${TONE_CARD[r.tone]} px-4 py-3" data-reminder-card="${escapeHtml(r.key)}">
      <span class="text-xl leading-none mt-0.5">${r.icon}</span>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(r.title)}</p>
        <p class="text-xs text-gray-600 dark:text-gray-300 mt-0.5">${escapeHtml(r.sub)}</p>
      </div>
      <div class="flex flex-shrink-0 items-center gap-1.5">${action}</div>
    </div>`;
}

function todayHtml() {
  const t = data.today;
  const rem = reminders(data);
  const slots = doseSlots(data);
  const prn = data.medications.filter((m) => isCurrent(m, t) && !m.times.length && person(data, m.person_id));
  const prnGiven = prnGivenToday(data, t);
  const soon = upcoming(data).filter((a) => daysBetween(t, a.date) <= 14);

  const byTime = {};
  slots.forEach((s) => { (byTime[s.time] ??= []).push(s); });
  const doseBtn = (s) => {
    const st = {
      given: 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/50 dark:bg-emerald-950/30',
      due: 'border-primary-300 bg-primary-50 dark:border-primary-800 dark:bg-primary-950/30 ring-2 ring-primary-400/40',
      late: 'border-red-300 bg-red-50 dark:border-red-900/60 dark:bg-red-950/30',
      later: 'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900',
    }[s.state];
    return `
      <button type="button" data-dose="${s.med.id}|${s.time}" aria-pressed="${s.state === 'given'}"
        class="w-full flex items-center gap-3 rounded-xl border ${st} px-3 py-2.5 text-left transition-colors hover:shadow-sm">
        <span class="h-6 w-6 flex-shrink-0 rounded-full border-2 ${s.state === 'given' ? 'border-emerald-500 bg-emerald-500 text-white' : s.state === 'late' ? 'border-red-400' : 'border-gray-300 dark:border-gray-600'} flex items-center justify-center">${s.state === 'given' ? svg(ICON.check, 'h-3.5 w-3.5') : ''}</span>
        <span class="h-2.5 w-2.5 flex-shrink-0 rounded-full ${pc(s.person).bg}"></span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-gray-900 dark:text-white truncate ${s.state === 'given' ? 'line-through opacity-60' : ''}">${escapeHtml(s.person.first_name)} · ${escapeHtml(s.med.name)}${s.med.dose ? ` <span class="font-normal text-gray-500">${escapeHtml(s.med.dose)}</span>` : ''}</span>
          ${s.med.instructions ? `<span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(s.med.instructions)}</span>` : ''}
        </span>
        <span class="flex-shrink-0 text-[11px] font-bold uppercase tracking-wider ${s.state === 'late' ? 'text-red-600' : s.state === 'due' ? 'text-primary-600' : s.state === 'given' ? 'text-emerald-600' : 'text-gray-400'}">${{ given: 'Given', due: 'Due now', late: 'Late', later: '' }[s.state]}</span>
      </button>`;
  };
  const given = slots.filter((s) => s.state === 'given').length;

  return `
    <div class="grid gap-6 xl:grid-cols-5">
      <div class="xl:col-span-3 space-y-6 min-w-0">
        ${card(`${sectionHead('Reminders', rem.length ? 'What needs doing, most urgent first.' : '')}
          <div class="px-5 pb-5 space-y-2">${rem.length ? rem.map(reminderCard).join('') : '<p class="rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 px-4 py-4 text-sm font-semibold text-emerald-800 dark:text-emerald-200">✓ Nothing needs doing right now — appointments, refills and vaccinations are all on track.</p>'}</div>`)}

        ${card(`${sectionHead('Coming up', 'Booked appointments in the next two weeks.', `<button type="button" data-view-go="appointments" class="text-xs font-semibold text-primary-600 dark:text-primary-400 hover:underline">All appointments →</button>`)}
          <div class="px-5 pb-5 space-y-2">${soon.length ? soon.map(apptRow).join('') : '<p class="text-sm text-gray-500 dark:text-gray-400">Nothing booked for the next two weeks.</p>'}</div>`)}
      </div>

      <div class="xl:col-span-2 space-y-6 min-w-0">
        ${card(`${sectionHead('Today’s doses', slots.length ? `${given} of ${plural(slots.length, 'dose')} given — tap to tick off.` : '', slots.length ? `<span class="rounded-full ${given === slots.length ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-primary-100 text-primary-700 dark:bg-primary-950/50 dark:text-primary-300'} px-2.5 py-1 text-xs font-bold">${given}/${slots.length}</span>` : '')}
          <div class="px-5 pb-5 space-y-4">
            ${slots.length ? Object.entries(byTime).map(([time, list]) => `
              <div><p class="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 mb-1.5">${clock(time)}</p><div class="space-y-1.5">${list.map(doseBtn).join('')}</div></div>`).join('')
              : `<p class="text-sm text-gray-500 dark:text-gray-400">No scheduled doses today.</p>`}
          </div>`)}

        ${prn.length ? card(`${sectionHead('As needed', 'Tap “Given now” each time one is taken.')}
          <div class="px-5 pb-5 space-y-2">${prn.map((m) => {
            const p = person(data, m.person_id);
            const list = prnGiven[m.id] || [];
            return `<div class="flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 px-3 py-2.5">
              <span class="h-2.5 w-2.5 flex-shrink-0 rounded-full ${pc(p).bg}"></span>
              <div class="min-w-0 flex-1"><p class="text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(p.first_name)} · ${escapeHtml(m.name)}${m.dose ? ` <span class="font-normal text-gray-500">${escapeHtml(m.dose)}</span>` : ''}</p>
                <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${list.length ? `Today: ${list.map(clock).join(', ')}` : escapeHtml(m.instructions || 'Not taken today')}</p></div>
              <button type="button" data-prn="${m.id}" class="${btnSoft} bg-primary-600 text-white hover:bg-primary-700 flex-shrink-0">Given now</button>
            </div>`;
          }).join('')}</div>`) : ''}
      </div>
    </div>`;
}

function apptRow(a) {
  const p = person(data, a.person_id);
  const prov = provider(data, a.provider_id);
  const d = a.date ? parse(a.date) : null;
  return `
    <button type="button" data-open-appt="${a.id}" class="w-full flex items-center gap-3 rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 px-3 py-2.5 text-left hover:border-primary-300 dark:hover:border-primary-800 hover:shadow-sm transition-all">
      <span class="h-12 w-12 flex-shrink-0 rounded-xl ${pc(p).soft} ring-1 ${pc(p).ring} flex flex-col items-center justify-center leading-none">
        ${d ? `<span class="text-[10px] font-bold uppercase ${pc(p).text}">${d.toLocaleDateString('en-US', { month: 'short' })}</span><span class="text-lg font-bold text-gray-900 dark:text-white">${d.getDate()}</span>` : '<span class="text-lg">☎️</span>'}
      </span>
      <span class="min-w-0 flex-1">
        <span class="flex items-center gap-2"><span class="text-base leading-none">${APPT_ICON[a.kind] || '📌'}</span><span class="text-sm font-bold text-gray-900 dark:text-white truncate">${escapeHtml(a.title)}</span></span>
        <span class="block text-xs text-gray-500 dark:text-gray-400 truncate mt-0.5"><span class="font-semibold ${pc(p).text}">${escapeHtml(p?.first_name || '')}</span>${a.date ? ` · ${escapeHtml(when(a.date, a.time, data.today))}` : ''}${prov ? ` · ${escapeHtml(prov.name)}` : ''}</span>
      </span>
      ${a.status === 'booked' && a.date && a.date >= data.today ? `<span class="hidden sm:block flex-shrink-0 text-xs font-semibold text-primary-600 dark:text-primary-400">${escapeHtml(countdown(a.date, a.time))}</span>` : ''}
      <span class="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_CHIP[a.status]}">${escapeHtml(data.statuses[a.status] || a.status)}</span>
    </button>`;
}

// --- Appointments -----------------------------------------------------

function appointmentsHtml() {
  const t = data.today;
  const mine = data.appointments.filter((a) => forWho(a.person_id) && person(data, a.person_id));
  const lists = {
    upcoming: upcoming(data).filter((a) => forWho(a.person_id)),
    to_book: mine.filter((a) => a.status === 'to_book'),
    past: mine.filter((a) => a.status !== 'to_book' && !upcoming(data).includes(a)).sort((x, y) => (y.date || '').localeCompare(x.date || '') || (y.time || '').localeCompare(x.time || '')),
  };
  const seg = (key, label) => `<button type="button" data-appt-view="${key}" aria-pressed="${apptView === key}" class="px-3 py-1.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 aria-pressed:bg-white aria-pressed:text-gray-900 aria-pressed:shadow-sm dark:aria-pressed:bg-gray-700 dark:aria-pressed:text-white">${label} <span class="ml-1 text-xs opacity-60">${lists[key].length}</span></button>`;
  const list = lists[apptView];
  const groups = {};
  if (apptView === 'upcoming') list.forEach((a) => { const n = daysBetween(t, a.date); const g = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n <= 7 ? 'This week' : n <= 31 ? 'This month' : 'Later'; (groups[g] ??= []).push(a); });
  else if (apptView === 'past') list.forEach((a) => { const g = a.date ? parse(a.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'No date'; (groups[g] ??= []).push(a); });
  else groups[''] = list;
  const unc = unconfirmed(data).filter((a) => forWho(a.person_id));

  return card(`
    <div class="flex flex-col lg:flex-row lg:items-center gap-3 px-5 pt-5 pb-3">
      <div class="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 self-start">${seg('upcoming', 'Upcoming')}${seg('to_book', 'To book')}${seg('past', 'Past')}</div>
      <div class="lg:ml-auto min-w-0">${whoChips()}</div>
    </div>
    ${apptView === 'upcoming' && unc.length ? `<div class="px-5 pb-2"><p class="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 px-4 py-2.5 text-sm text-amber-800 dark:text-amber-200">${plural(unc.length, 'past appointment')} not marked yet — find ${unc.length === 1 ? 'it' : 'them'} under <button type="button" data-appt-view="past" class="font-bold underline">Past</button>.</p></div>` : ''}
    <div class="px-5 pb-5 space-y-5">
      ${list.length ? Object.entries(groups).map(([g, rows]) => `
        <div>${g ? `<p class="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2">${escapeHtml(g)}</p>` : ''}<div class="space-y-2">${rows.map(apptRow).join('')}</div></div>`).join('')
        : empty(apptView === 'to_book' ? '☎️' : '📅', apptView === 'to_book' ? 'Nothing waiting to be booked' : apptView === 'past' ? 'No past appointments' : 'Nothing booked',
          apptView === 'to_book' ? 'Note an appointment you still need to make with status “To book” — it waits here until you’ve called.' : 'Book the next check-up, dental visit or eye exam.',
          `<button type="button" data-act="new-appointment" class="mt-5 ${btnPrimary}">${svg(ICON.plus)} Book appointment</button>`)}
    </div>`);
}

// --- Medications --------------------------------------------------------

function medicationsHtml() {
  const t = data.today;
  const people = data.people.filter((p) => forWho(p.id));
  const blocks = people.map((p) => {
    const meds = data.medications.filter((m) => m.person_id === p.id).sort((a, b) => Number(isCurrent(b, t)) - Number(isCurrent(a, t)) || a.name.localeCompare(b.name));
    if (!meds.length && who === 'all') return '';
    return `
      <div>
        <div class="flex items-center gap-2 mb-2">${avatar(p, 'h-7 w-7 text-xs rounded-lg')}<p class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(fullName(p))}</p>
          <button type="button" data-new-med="${p.id}" class="ml-auto ${btnSoft} text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40">${svg(ICON.plus, 'h-3.5 w-3.5')} Add</button></div>
        ${meds.length ? `<div class="grid gap-2 md:grid-cols-2">${meds.map((m) => {
          const cur = isCurrent(m, t);
          const refillDays = m.refill_date ? daysBetween(t, m.refill_date) : null;
          return `<button type="button" data-edit-med="${m.id}" class="text-left rounded-2xl border ${cur ? 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900' : 'border-dashed border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/40 opacity-70'} p-3.5 hover:border-primary-300 hover:shadow-sm transition-all">
            <div class="flex items-start gap-2"><span class="text-lg leading-none">💊</span>
              <div class="min-w-0 flex-1"><p class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(m.name)}${m.dose ? ` <span class="font-normal text-gray-500">· ${escapeHtml(m.dose)}</span>` : ''}</p>
                ${m.instructions ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${escapeHtml(m.instructions)}</p>` : ''}</div>
              ${!cur ? '<span class="rounded-full bg-gray-200 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:text-gray-300">Stopped</span>' : ''}</div>
            <div class="mt-2.5 flex flex-wrap gap-1.5">
              ${m.times.length ? m.times.map((x) => `<span class="rounded-lg ${pc(p).soft} ${pc(p).text} px-2 py-0.5 text-[11px] font-bold">${clock(x)}</span>`).join('') : '<span class="rounded-lg bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[11px] font-bold text-gray-600 dark:text-gray-300">As needed</span>'}
              ${refillDays !== null && cur ? `<span class="rounded-lg px-2 py-0.5 text-[11px] font-bold ${refillDays < 0 ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : refillDays <= 7 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}">Refill ${refillDays < 0 ? 'overdue' : `by ${shortDate(m.refill_date)}`}</span>` : ''}
              ${m.end_date && cur ? `<span class="rounded-lg bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300 px-2 py-0.5 text-[11px] font-bold">Until ${shortDate(m.end_date)}</span>` : ''}
            </div>
          </button>`;
        }).join('')}</div>` : '<p class="text-sm text-gray-500 dark:text-gray-400">No medications.</p>'}
      </div>`;
  }).filter(Boolean);

  return card(`${sectionHead('Medications', 'Tap one to edit it, update the refill date or stop it.', `<div class="min-w-0">${whoChips()}</div>`)}
    <div class="px-5 pb-5 space-y-6">${blocks.length ? blocks.join('') : empty('💊', 'No medications yet', 'Add what each person takes, with the dose times — today’s doses then show up to tick off.', `<button type="button" data-act="new-medication" class="mt-5 ${btnPrimary}">${svg(ICON.plus)} Add medication</button>`)}</div>`);
}

// --- Records ------------------------------------------------------------

function recordsHtml() {
  const t = data.today;
  const list = data.records.filter((r) => forWho(r.person_id) && person(data, r.person_id) && (recKind === 'all' || r.kind === recKind));
  const kinds = Object.entries(data.record_kinds || {});
  return card(`
    ${sectionHead('Health records', 'Vaccinations, check-ups, tests and results. A “next due” date turns into a reminder to book.', `<div class="min-w-0">${whoChips()}</div>`)}
    <div class="px-5 pb-3 flex gap-1.5 overflow-x-auto custom-scrollbar">
      ${[['all', { label: 'All', icon: '📚' }], ...kinds].map(([k, v]) => `<button type="button" data-rec-kind="${k}" aria-pressed="${recKind === k}" class="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-gray-200 dark:border-gray-700 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-300"><span>${v.icon}</span>${escapeHtml(v.label)}</button>`).join('')}
    </div>
    <div class="px-5 pb-5">
      ${list.length ? `<div class="divide-y divide-gray-100 dark:divide-gray-800">${list.map((r) => {
        const p = person(data, r.person_id);
        const due = r.next_due ? daysBetween(t, r.next_due) : null;
        return `<button type="button" data-edit-rec="${r.id}" class="w-full flex items-center gap-3 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-800/40 rounded-xl px-2 -mx-2 transition-colors">
          <span class="h-10 w-10 flex-shrink-0 rounded-xl ${pc(p).soft} flex items-center justify-center text-lg">${data.record_kinds?.[r.kind]?.icon || '📝'}</span>
          <span class="min-w-0 flex-1"><span class="block text-sm font-bold text-gray-900 dark:text-white truncate">${escapeHtml(r.title)}${r.value ? ` <span class="font-semibold text-gray-500">· ${escapeHtml(r.value)}</span>` : ''}</span>
            <span class="block text-xs text-gray-500 dark:text-gray-400 truncate"><span class="font-semibold ${pc(p).text}">${escapeHtml(p.first_name)}</span>${r.date ? ` · ${shortDate(r.date)}` : ''}${provider(data, r.provider_id) ? ` · ${escapeHtml(provider(data, r.provider_id).name)}` : ''}</span></span>
          ${due !== null ? `<span class="flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${due < 0 ? 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300' : due <= 30 ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300'}">${due < 0 ? 'Overdue' : 'Next'} ${shortDate(r.next_due)}</span>` : ''}
        </button>`;
      }).join('')}</div>` : empty('💉', 'No records here yet', 'Keep vaccinations, check-ups and test results — with when they’re due again.', `<button type="button" data-act="new-record" class="mt-5 ${btnPrimary}">${svg(ICON.plus)} Add a record</button>`)}
    </div>`);
}

// --- Family -------------------------------------------------------------

function familyHtml() {
  const t = data.today;
  return `<div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">${data.people.map((p) => {
    const meds = data.medications.filter((m) => m.person_id === p.id && isCurrent(m, t));
    const next = upcoming(data).find((a) => a.person_id === p.id);
    return `
      <div class="relative overflow-hidden rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm">
        <div class="h-16 ${pc(p).bg} opacity-90"></div>
        <div class="relative px-5 pb-5 -mt-8">
          <div class="flex items-start gap-3">
            <span class="h-16 w-16 flex-shrink-0 rounded-2xl ${pc(p).bg} ring-4 ring-white dark:ring-gray-900 text-white text-xl font-black flex items-center justify-center shadow-md">${escapeHtml(initials(p))}</span>
            <div class="min-w-0 pt-9"><p class="text-lg font-bold text-gray-900 dark:text-white truncate">${escapeHtml(fullName(p))}</p>
              <p class="text-xs text-gray-500 dark:text-gray-400">${p.date_of_birth ? `${age(p.date_of_birth, t)} · born ${shortDate(p.date_of_birth)}` : 'Age not set'}${p.blood_type ? ` · <span class="font-bold text-red-600">${escapeHtml(p.blood_type)}</span>` : ''}</p></div>
          </div>
          <div class="mt-4 space-y-2 text-sm">
            ${p.allergies.length ? `<div class="flex flex-wrap items-center gap-1.5"><span class="text-xs font-bold text-red-600">⚠️ Allergies</span>${p.allergies.map((x) => `<span class="rounded-full bg-red-100 dark:bg-red-950/50 px-2 py-0.5 text-xs font-semibold text-red-700 dark:text-red-300">${escapeHtml(x)}</span>`).join('')}</div>` : '<p class="text-xs text-gray-400">No known allergies</p>'}
            ${p.conditions.length ? `<div class="flex flex-wrap items-center gap-1.5"><span class="text-xs font-bold text-gray-500">Conditions</span>${p.conditions.map((x) => `<span class="rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:text-gray-300">${escapeHtml(x)}</span>`).join('')}</div>` : ''}
            <p class="text-xs text-gray-600 dark:text-gray-300">💊 ${meds.length ? escapeHtml(meds.map((m) => m.name).join(', ')) : 'No current medications'}</p>
            <p class="text-xs text-gray-600 dark:text-gray-300">📅 ${next ? `${escapeHtml(next.title)} — ${escapeHtml(when(next.date, next.time, t))}` : 'No appointment booked'}</p>
          </div>
          <div class="mt-4 flex flex-wrap gap-2">
            <button type="button" data-view-person="${p.id}" class="${btnSoft} bg-gray-900 text-white dark:bg-white dark:text-gray-900 hover:opacity-90">Open profile</button>
            <button type="button" data-print-person="${p.id}" class="${btnSoft} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.print, 'h-3.5 w-3.5')} Print summary</button>
            <button type="button" data-edit-person="${p.id}" class="${btnSoft} text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">${svg(ICON.edit, 'h-3.5 w-3.5')} Edit</button>
          </div>
        </div>
      </div>`;
  }).join('')}
    <button type="button" data-act="new-person" class="min-h-[14rem] rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 hover:text-primary-600 hover:border-primary-300 flex flex-col items-center justify-center gap-2 transition-colors">
      <span class="text-3xl">➕</span><span class="text-sm font-semibold">Add a family member</span></button>
  </div>`;
}

// --- Providers ------------------------------------------------------------

function providersHtml() {
  if (!data.providers.length) {
    return card(empty('🏥', 'No providers yet', 'Add your family doctor, dentist, pharmacy and specialists — then pick them when booking.', `<button type="button" data-act="new-provider" class="mt-5 ${btnPrimary}">${svg(ICON.plus)} Add a provider</button>`));
  }
  return `<div class="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">${data.providers.map((p) => {
    const next = upcoming(data).find((a) => a.provider_id === p.id);
    return `
      <div class="rounded-3xl bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 shadow-sm p-5">
        <div class="flex items-start gap-3">
          <span class="h-12 w-12 flex-shrink-0 rounded-2xl bg-gradient-to-br from-rose-400 to-pink-500 text-2xl flex items-center justify-center shadow-sm">${PROVIDER_ICON[p.kind] || '📇'}</span>
          <div class="min-w-0 flex-1"><p class="text-base font-bold text-gray-900 dark:text-white">${escapeHtml(p.name)}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(data.provider_kinds[p.kind] || p.kind)}${p.specialty ? ` · ${escapeHtml(p.specialty)}` : ''}</p></div>
          <button type="button" data-edit-provider="${p.id}" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800" aria-label="Edit ${escapeHtml(p.name)}">${svg(ICON.edit)}</button>
        </div>
        <div class="mt-4 flex flex-wrap gap-2">
          ${p.phone ? `<a href="${telUrl(p.phone)}" class="${btnSoft} bg-emerald-600 text-white hover:bg-emerald-700">${svg(ICON.phone, 'h-3.5 w-3.5')} ${escapeHtml(p.phone)}</a>` : ''}
          ${p.email ? `<a href="mailto:${escapeHtml(p.email)}" class="${btnSoft} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.mail, 'h-3.5 w-3.5')} Email</a>` : ''}
          ${p.address ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.address)}" target="_blank" rel="noopener" class="${btnSoft} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.pin, 'h-3.5 w-3.5')} Map</a>` : ''}
          ${p.website ? `<a href="${escapeHtml(/^https?:\/\//i.test(p.website) ? p.website : `https://${p.website}`)}" target="_blank" rel="noopener" class="${btnSoft} border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.globe, 'h-3.5 w-3.5')} Website</a>` : ''}
        </div>
        ${p.address ? `<p class="mt-3 text-xs text-gray-500 dark:text-gray-400">${escapeHtml(p.address)}</p>` : ''}
        ${p.notes ? `<p class="mt-1 text-xs text-gray-500 dark:text-gray-400">📝 ${escapeHtml(p.notes)}</p>` : ''}
        <div class="mt-4 flex items-center gap-2 border-t border-gray-100 dark:border-gray-800 pt-3">
          <p class="min-w-0 flex-1 text-xs text-gray-600 dark:text-gray-300 truncate">${next ? `Next: ${escapeHtml(person(data, next.person_id)?.first_name || '')} · ${escapeHtml(when(next.date, next.time, data.today))}` : 'Nothing booked'}</p>
          <button type="button" data-book='${escapeHtml(JSON.stringify({ provider_id: p.id, kind: { dentist: 'dental', optometrist: 'vision', specialist: 'specialist', therapist: 'therapy', pharmacy: 'vaccination' }[p.kind] || 'checkup' }))}' class="${btnSoft} text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40">Book</button>
        </div>
      </div>`;
  }).join('')}
    <button type="button" data-act="new-provider" class="min-h-[12rem] rounded-3xl border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-500 hover:text-primary-600 hover:border-primary-300 flex flex-col items-center justify-center gap-2 transition-colors">
      <span class="text-3xl">➕</span><span class="text-sm font-semibold">Add a provider</span></button>
  </div>`;
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

function closeMenu() {
  document.querySelector('#medicals-page [data-menu]')?.classList.add('hidden');
  document.querySelector('#medicals-page [data-menu-toggle]')?.setAttribute('aria-expanded', 'false');
}

async function onClick(e) {
  const t = (sel) => e.target.closest(sel);

  if (t('#md-guest-sample') || t('#md-guest-clear')) {
    const sample = !!t('#md-guest-sample');
    if (!(await confirmDialog(sample ? 'Replace the demo with the sample family?' : 'Remove everyone and everything from the demo and start empty?', sample ? 'Reload sample' : 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700'))) return;
    adopt(sample ? guestMedicals.resetToSample() : guestMedicals.clear());
    who = 'all';
    render();
    showToast(sample ? 'Sample family loaded.' : 'Starting empty — add a family member first.', 'success');
    return;
  }

  const toggle = t('[data-menu-toggle]');
  if (toggle) {
    const menu = document.querySelector('#medicals-page [data-menu]');
    const open = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    return;
  }

  const tab = t('.md-tab') || t('[data-view-go]');
  if (tab) { view = tab.dataset.view || tab.dataset.viewGo; render(); return; }
  const w = t('[data-who]');
  if (w) { who = w.dataset.who; renderBody(); return; }
  const av = t('[data-appt-view]');
  if (av) { apptView = av.dataset.apptView; view = 'appointments'; render(); return; }
  const rk = t('[data-rec-kind]');
  if (rk) { recKind = rk.dataset.recKind; renderBody(); return; }

  const act = t('[data-act]')?.dataset.act;
  if (act) {
    closeMenu();
    if (!data.people.length && act !== 'new-person' && act !== 'new-provider') { showToast('Add a family member first.', 'error'); openPersonForm(null); return; }
    if (act === 'new-appointment') openAppointmentForm(null, who !== 'all' ? { person_id: Number(who) } : {});
    if (act === 'new-medication') openMedicationForm(null, who !== 'all' ? { person_id: Number(who) } : {});
    if (act === 'new-record') openRecordForm(null, who !== 'all' ? { person_id: Number(who) } : {});
    if (act === 'new-person') openPersonForm(null);
    if (act === 'new-provider') openProviderForm(null);
    return;
  }

  const dose = t('[data-dose]');
  if (dose) { const [id, time] = dose.dataset.dose.split('|'); toggleDose(Number(id), time); return; }
  const prn = t('[data-prn]');
  if (prn) { toggleDose(Number(prn.dataset.prn), nowHHMM(), true); return; }

  const rem = t('[data-reminder]');
  if (rem) { runReminder(rem.dataset.reminder); return; }
  const open = t('[data-open-appt]');
  if (open) { openAppointment(Number(open.dataset.openAppt)); return; }
  const editA = t('[data-edit-appt]');
  if (editA) { openAppointmentForm(data.appointments.find((a) => a.id === Number(editA.dataset.editAppt))); return; }
  const done = t('[data-done]');
  if (done) { openDone(data.appointments.find((a) => a.id === Number(done.dataset.done))); return; }
  const st = t('[data-status]');
  if (st) { const [id, s] = st.dataset.status.split('|'); setStatus(Number(id), s); return; }
  const book = t('[data-book]');
  if (book) { const pre = JSON.parse(book.dataset.book); openAppointmentForm(null, { ...pre, status: 'booked' }); return; }

  const editM = t('[data-edit-med]');
  if (editM) { openMedicationForm(data.medications.find((m) => m.id === Number(editM.dataset.editMed))); return; }
  const newM = t('[data-new-med]');
  if (newM) { openMedicationForm(null, { person_id: Number(newM.dataset.newMed) }); return; }
  const editR = t('[data-edit-rec]');
  if (editR) { openRecordForm(data.records.find((r) => r.id === Number(editR.dataset.editRec))); return; }
  const vp = t('[data-view-person]');
  if (vp) { openPerson(person(data, Number(vp.dataset.viewPerson))); return; }
  const pp = t('[data-print-person]');
  if (pp) { printSummary(person(data, Number(pp.dataset.printPerson))); return; }
  const ep = t('[data-edit-person]');
  if (ep) { openPersonForm(person(data, Number(ep.dataset.editPerson))); return; }
  const epr = t('[data-edit-provider]');
  if (epr) openProviderForm(data.providers.find((p) => p.id === Number(epr.dataset.editProvider)));
}

/** A reminder chip in the hero does the same as its card's button. */
function runReminder(key) {
  const r = reminders(data).find((x) => x.key === key);
  if (!r) return;
  const a = r.action;
  if (a.type === 'confirm') openDone(data.appointments.find((x) => x.id === a.id));
  else if (a.type === 'appointment') openAppointment(a.id);
  else if (a.type === 'book-existing') openAppointmentForm(data.appointments.find((x) => x.id === a.id));
  else if (a.type === 'book-new') openAppointmentForm(null, { ...a, status: 'booked' });
  else if (a.type === 'medication') openMedicationForm(data.medications.find((x) => x.id === a.id));
  else if (a.type === 'doses') { view = 'today'; render(); }
}

// ------------------------------------------------------------
// Actions
// ------------------------------------------------------------

async function toggleDose(medId, time, isPrn = false) {
  const date = iso(new Date());
  const was = data.doses.some((d) => d.medication_id === medId && d.date === date && d.time === time);
  // Optimistic: flip it now, undo if it's refused
  data.doses = was ? data.doses.filter((d) => !(d.medication_id === medId && d.date === date && d.time === time)) : [...data.doses, { medication_id: medId, date, time }];
  renderHero(); renderBody();
  try {
    await post({ action: 'toggle-dose', medication_id: medId, date, time });
    if (isPrn) showToast(`Given at ${clock(time)}.`, 'success');
  } catch (err) {
    data.doses = was ? [...data.doses, { medication_id: medId, date, time }] : data.doses.filter((d) => !(d.medication_id === medId && d.date === date && d.time === time));
    renderHero(); renderBody();
    showToast(err.message, 'error');
  }
}

async function setStatus(id, status, outcome) {
  try {
    const json = await post({ action: 'appointment-status', id, status, ...(outcome !== undefined ? { outcome } : {}) });
    adopt(json); render(); showToast(json.messages?.[0] || 'Saved.', 'success');
    return true;
  } catch (err) { showToast(err.message, 'error'); return false; }
}

/** Save from a form: errors land in its .api-message; success replaces our state. */
async function submit(form, body, after) {
  const b = form.querySelector('button[type="submit"]');
  b.disabled = true;
  form.querySelector('.api-message').innerHTML = '';
  try {
    const json = await post(body);
    adopt(json); render(); showToast(json.messages?.[0] || 'Saved.', 'success');
    if (after) after(json); else modal.close();
  } catch (err) {
    form.querySelector('.api-message').innerHTML = errorsHtml(err);
    form.querySelector('.api-message').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } finally { b.disabled = false; }
}

function openModal(id, title, content, size = 'lg') {
  modal?.destroy();
  modal = new Modal({ id, title, size, showFooter: false, content });
  modal.open();
  return document.getElementById(id);
}

const opts = (list, selected, blank = '') => `${blank ? `<option value="">${escapeHtml(blank)}</option>` : ''}${list.map(([v, l]) => `<option value="${escapeHtml(String(v))}" ${String(v) === String(selected ?? '') ? 'selected' : ''}>${escapeHtml(String(l))}</option>`).join('')}`;
const peopleOpts = (sel) => opts(data.people.map((p) => [p.id, fullName(p)]), sel, 'Choose…');
const providerOpts = (sel, kinds = null) => opts(data.providers.filter((p) => !kinds || kinds.includes(p.kind) || p.id === sel).map((p) => [p.id, `${p.name} — ${data.provider_kinds[p.kind] || p.kind}`]), sel, 'None');
const field = (id, label, control, cls = '') => `<div class="${cls}"><label for="${id}" class="${kitLabel}">${label}</label>${control}</div>`;
const formFoot = (label, extraLeft = '') => `
  <div class="api-message space-y-2"></div>
  <div class="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
    <div>${extraLeft}</div>
    <div class="flex gap-3"><button type="button" data-cancel class="${kitGhost}">Cancel</button><button type="submit" class="${kitSubmit} min-w-[8rem]">${label}</button></div>
  </div>`;
const values = (form) => Object.fromEntries(new FormData(form).entries());

// --- Appointment view -------------------------------------------------

function openAppointment(id) {
  const a = data.appointments.find((x) => x.id === id);
  if (!a) return;
  const p = person(data, a.person_id);
  const prov = provider(data, a.provider_id);
  const parent = a.follow_up_of ? data.appointments.find((x) => x.id === a.follow_up_of) : null;
  const followUps = data.appointments.filter((x) => x.follow_up_of === a.id);
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors';
  const root = openModal('md-appt', `${APPT_ICON[a.kind] || '📌'} ${a.title}`, `
    <div class="space-y-5">
      <div class="relative overflow-hidden rounded-2xl ${pc(p).soft} ring-1 ${pc(p).ring} p-5">
        <div class="flex items-center gap-4">
          ${avatar(p, 'h-14 w-14 text-lg')}
          <div class="min-w-0 flex-1">
            <p class="text-xs font-bold uppercase tracking-wider ${pc(p).text}">${escapeHtml(fullName(p))} · ${escapeHtml(data.appt_kinds[a.kind] || a.kind)}</p>
            <p class="text-xl font-bold text-gray-900 dark:text-white">${a.date ? escapeHtml(parse(a.date).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })) : 'Not booked yet'}</p>
            <p class="text-sm text-gray-600 dark:text-gray-300">${a.time ? `${clock(a.time)} · ${a.duration} min` : a.date ? 'Time not set' : 'Set the date once it’s booked'}${a.status === 'booked' && a.date && a.date >= data.today ? ` · <span class="font-semibold text-primary-600">${escapeHtml(countdown(a.date, a.time))}</span>` : ''}</p>
          </div>
          <span class="rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_CHIP[a.status]}">${escapeHtml(data.statuses[a.status])}</span>
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2 text-sm">
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5"><p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">With</p>
          <p class="font-semibold text-gray-900 dark:text-white">${prov ? escapeHtml(prov.name) : '—'}</p>
          ${prov?.phone ? `<a href="${telUrl(prov.phone)}" class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">${svg(ICON.phone, 'h-3.5 w-3.5')} ${escapeHtml(prov.phone)}</a>` : ''}</div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5"><p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Where</p>
          <p class="font-semibold text-gray-900 dark:text-white">${escapeHtml(a.location || prov?.address || '—')}</p>
          ${(a.location || prov?.address) ? `<a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.location || prov.address)}" target="_blank" rel="noopener" class="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-sky-600">${svg(ICON.pin, 'h-3.5 w-3.5')} Map</a>` : ''}</div>
      </div>
      ${a.notes ? `<div class="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 p-3.5"><p class="text-[11px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-300">To bring / ask</p><p class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">${escapeHtml(a.notes)}</p></div>` : ''}
      ${a.outcome ? `<div class="rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50 p-3.5"><p class="text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">What happened</p><p class="text-sm text-gray-800 dark:text-gray-100 whitespace-pre-wrap">${escapeHtml(a.outcome)}</p></div>` : ''}
      ${parent ? `<p class="text-xs text-gray-500">↩︎ Follow-up of <button type="button" data-goto="${parent.id}" class="font-semibold underline">${escapeHtml(parent.title)}${parent.date ? ` (${shortDate(parent.date)})` : ''}</button></p>` : ''}
      ${followUps.length ? `<p class="text-xs text-gray-500">↪︎ Follow-up: ${followUps.map((f) => `<button type="button" data-goto="${f.id}" class="font-semibold underline">${escapeHtml(f.title)}${f.date ? ` (${shortDate(f.date)})` : ' (to book)'}</button>`).join(', ')}</p>` : ''}
      <div class="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
        ${a.status === 'booked' && a.date <= data.today ? `<button type="button" data-a="done" class="${btn} bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">${svg(ICON.check)} Done</button>` : ''}
        ${a.status === 'to_book' ? `<button type="button" data-a="edit" class="${btn} bg-violet-600 text-white hover:bg-violet-700 shadow-sm">☎️ Booked it — add the date</button>` : ''}
        <button type="button" data-a="edit" class="${btn} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.edit)} Edit</button>
        ${a.date && a.status === 'booked' ? `<button type="button" data-a="ics" class="${btn} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.cal)} Add to calendar</button>` : ''}
        <button type="button" data-a="follow" class="${btn} text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/40">↪︎ Book a follow-up</button>
        <span class="ml-auto flex items-center gap-1">
          ${a.status === 'booked' && a.date <= data.today ? `<button type="button" data-a="missed" class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Missed</button>` : ''}
          ${a.status === 'booked' ? `<button type="button" data-a="cancelled" class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Cancel it</button>` : ''}
          ${['done', 'cancelled', 'missed'].includes(a.status) ? `<button type="button" data-a="booked" class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Back to booked</button>` : ''}
          <button type="button" data-a="delete" class="${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" title="Delete">${svg(ICON.trash)}</button>
        </span>
      </div>
    </div>`);

  root.addEventListener('click', async (e) => {
    const go = e.target.closest('[data-goto]');
    if (go) { openAppointment(Number(go.dataset.goto)); return; }
    const x = e.target.closest('[data-a]')?.dataset.a;
    if (!x) return;
    if (x === 'done') openDone(a);
    else if (x === 'edit') openAppointmentForm(a);
    else if (x === 'ics') downloadIcs(a);
    else if (x === 'follow') openAppointmentForm(null, followUpOf(a));
    else if (x === 'missed' || x === 'cancelled' || x === 'booked') { if (await setStatus(a.id, x)) openAppointment(a.id); }
    else if (x === 'delete') {
      if (!(await confirmDialog(`Delete <strong>${escapeHtml(a.title)}</strong> for ${escapeHtml(p.first_name)}?`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      try { const json = await post({ action: 'delete-appointment', id: a.id }); adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Deleted.', 'success'); } catch (err) { showToast(err.message, 'error'); }
    }
  });
}

const followUpOf = (a) => ({ person_id: a.person_id, provider_id: a.provider_id, kind: a.kind, title: `Follow-up: ${a.title.replace(/^Follow-up: /, '')}`, follow_up_of: a.id, status: 'to_book' });

/** Mark done, with what happened — and offer a follow-up. */
function openDone(a) {
  if (!a) return;
  const p = person(data, a.person_id);
  const root = openModal('md-done', `How did it go? · ${a.title}`, `
    <form id="md-done-form" class="space-y-5" novalidate>
      ${formSection(TONE.green, '✅', `${escapeHtml(p.first_name)}’s ${escapeHtml(a.title.toLowerCase())}`, a.date ? escapeHtml(when(a.date, a.time, data.today)) : '', `
        ${field('md-outcome', 'What happened <span class="normal-case font-normal tracking-normal text-gray-400">(optional)</span>', `<textarea id="md-outcome" name="outcome" rows="4" class="${kitInput} resize-y" placeholder="The doctor’s advice, a new prescription, results to wait for…">${escapeHtml(a.outcome)}</textarea>`)}
        <label class="mt-4 flex items-center gap-3 rounded-xl border border-gray-200 dark:border-gray-700 px-3.5 py-3 cursor-pointer">
          <input type="checkbox" name="follow" class="rounded border-gray-300 text-primary-600 focus:ring-primary-500">
          <span class="text-sm text-gray-700 dark:text-gray-200"><strong>Book a follow-up</strong> — opens a new appointment for ${escapeHtml(p.first_name)}, ready to fill in</span>
        </label>`)}
      ${formFoot('Mark as done')}
    </form>`, 'md');
  const form = root.querySelector('form');
  form.querySelector('[data-cancel]').addEventListener('click', () => modal.close());
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = values(form);
    const b = form.querySelector('button[type="submit"]');
    b.disabled = true;
    try {
      const json = await post({ action: 'appointment-status', id: a.id, status: 'done', outcome: f.outcome || '' });
      adopt(json); render(); showToast('Marked as done.', 'success');
      if (f.follow) openAppointmentForm(null, followUpOf(a)); else modal.close();
    } catch (err) { form.querySelector('.api-message').innerHTML = errorsHtml(err); } finally { b.disabled = false; }
  });
}

/** An .ics file the phone / computer calendar opens (with a reminder). */
function downloadIcs(a) {
  const p = person(data, a.person_id);
  const prov = provider(data, a.provider_id);
  const esc = (s) => String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  const ymd = a.date.replace(/-/g, '');
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  let start, end;
  if (a.time) {
    const s = parse(a.date); const [h, m] = a.time.split(':').map(Number); s.setHours(h, m, 0, 0);
    const e = new Date(s.getTime() + a.duration * 60000);
    const f = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
    start = `DTSTART:${f(s)}`; end = `DTEND:${f(e)}`;
  } else {
    const next = parse(a.date); next.setDate(next.getDate() + 1);
    start = `DTSTART;VALUE=DATE:${ymd}`; end = `DTEND;VALUE=DATE:${iso(next).replace(/-/g, '')}`;
  }
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CatScript Apps//Medicals//EN', 'BEGIN:VEVENT',
    `UID:medicals-${a.id}-${ymd}@catscript-apps`, `DTSTAMP:${stamp}`, start, end,
    `SUMMARY:${esc(`${p.first_name}: ${a.title}`)}`,
    `LOCATION:${esc(a.location || prov?.address || '')}`,
    `DESCRIPTION:${esc([prov ? `With ${prov.name}${prov.phone ? ` (${prov.phone})` : ''}` : '', a.notes].filter(Boolean).join('\n'))}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(a.title)}`, `TRIGGER:${a.remind_days ? `-P${a.remind_days}D` : '-PT1H'}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  Object.assign(document.createElement('a'), { href: url, download: `${p.first_name}-${a.title}`.replace(/[^\w-]+/g, '-') + '.ics' }).click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// --- Appointment form -------------------------------------------------

function openAppointmentForm(a, pre = {}) {
  const isEdit = !!a;
  const v = a || { person_id: '', provider_id: null, title: '', kind: 'checkup', status: 'booked', date: '', time: '', duration: 30, location: '', notes: '', outcome: '', remind_days: 1, follow_up_of: null, ...pre };
  const remindLabel = { 0: 'On the day', 1: 'A day before', 2: 'Two days before', 7: 'A week before' };
  const root = openModal('md-appt-form', isEdit ? `Edit · ${a.title}` : (v.follow_up_of ? 'Book a follow-up' : 'Book an appointment'), `
    <form id="md-appt-f" class="space-y-5" novalidate>
      ${formSection(TONE.orange, '📅', 'Who and what', '', `
        <div class="grid gap-4 sm:grid-cols-2">
          ${field('ma-person', 'For', `<select id="ma-person" name="person_id" class="${kitInput}">${peopleOpts(v.person_id)}</select>`)}
          ${field('ma-kind', 'Type', `<select id="ma-kind" name="kind" class="${kitInput}">${opts(Object.entries(data.appt_kinds), v.kind)}</select>`)}
          ${field('ma-title', 'What it’s for', `<input id="ma-title" name="title" maxlength="150" value="${escapeHtml(v.title)}" placeholder="e.g. Dental cleaning, 4-year shots, Eye exam" class="${kitInput}">`, 'sm:col-span-2')}
          ${field('ma-provider', 'With', `<select id="ma-provider" name="provider_id" class="${kitInput}">${providerOpts(v.provider_id)}</select>`)}
          ${field('ma-location', 'Where <span class="normal-case font-normal tracking-normal text-gray-400">(if not their usual address)</span>', `<input id="ma-location" name="location" maxlength="255" value="${escapeHtml(v.location)}" placeholder="e.g. 3rd floor, room 312" class="${kitInput}">`)}
        </div>`)}
      ${formSection(TONE.sky, '🕒', 'When', 'Not booked yet? Choose “To book” and leave the date — it waits on the To book list.', `
        <div class="flex flex-wrap gap-1.5 mb-4">${['booked', 'to_book'].map((s) => `<label class="cursor-pointer"><input type="radio" name="status" value="${s}" ${v.status === s ? 'checked' : ''} class="peer sr-only"><span class="inline-flex items-center gap-1.5 rounded-full border-2 border-gray-200 dark:border-gray-700 px-3.5 py-1.5 text-sm font-semibold text-gray-600 dark:text-gray-300 peer-checked:border-sky-400 peer-checked:bg-sky-50 peer-checked:text-sky-800 dark:peer-checked:bg-sky-950/40 dark:peer-checked:text-sky-200">${s === 'booked' ? '✅ Booked' : '☎️ To book'}</span></label>`).join('')}
          ${isEdit && !['booked', 'to_book'].includes(v.status) ? `<input type="hidden" name="status" value="${v.status}">` : ''}</div>
        <div class="grid gap-4 sm:grid-cols-4">
          ${field('ma-date', 'Date', `<input id="ma-date" name="date" type="date" value="${v.date || ''}" class="${kitInput}">`)}
          ${field('ma-time', 'Time', `<input id="ma-time" name="time" type="time" value="${v.time || ''}" class="${kitInput}">`)}
          ${field('ma-duration', 'Length', `<select id="ma-duration" name="duration" class="${kitInput}">${opts([[15, '15 min'], [20, '20 min'], [30, '30 min'], [45, '45 min'], [60, '1 hour'], [90, '1½ hours'], [120, '2 hours'], [180, '3 hours']].concat([[v.duration, `${v.duration} min`]]).filter((x, i, arr) => arr.findIndex((y) => y[0] === x[0]) === i), v.duration)}</select>`)}
          ${field('ma-remind', 'Remind me', `<select id="ma-remind" name="remind_days" class="${kitInput}">${opts(data.remind_options.map((d) => [d, remindLabel[d] || `${d} days before`]), v.remind_days)}</select>`)}
        </div>
        <div class="mt-2 flex flex-wrap gap-1">${[[0, 'Today'], [1, 'Tomorrow'], [7, '+1 week'], [14, '+2 weeks'], [30, '+1 month'], [91, '+3 months'], [182, '+6 months'], [365, '+1 year']].map(([d, l]) => `<button type="button" data-days="${d}" class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-sky-200 dark:border-sky-800 bg-white/80 dark:bg-gray-900 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40">${l}</button>`).join('')}</div>`)}
      ${formSection(TONE.amber, '📝', 'Notes', '', `
        ${field('ma-notes', 'What to bring or ask', `<textarea id="ma-notes" name="notes" rows="3" class="${kitInput} resize-y" placeholder="e.g. Bring the vaccination booklet; ask about the rash">${escapeHtml(v.notes)}</textarea>`)}
        ${isEdit && v.status === 'done' ? field('ma-outcome', 'What happened', `<textarea id="ma-outcome" name="outcome" rows="3" class="${kitInput} resize-y">${escapeHtml(v.outcome)}</textarea>`, 'mt-4') : `<input type="hidden" name="outcome" value="${escapeHtml(v.outcome)}">`}`)}
      ${formFoot(isEdit ? 'Save' : 'Save appointment')}
    </form>`, 'xl');
  const form = root.querySelector('form');
  form.querySelector('[data-cancel]').addEventListener('click', () => (isEdit ? openAppointment(a.id) : modal.close()));
  form.addEventListener('click', (e) => {
    const d = e.target.closest('[data-days]');
    if (!d) return;
    const x = new Date(); x.setDate(x.getDate() + Number(d.dataset.days));
    form.querySelector('[name="date"]').value = iso(x);
    form.querySelector('[name="status"][value="booked"]').checked = true;
  });
  // Picking a provider fills in the type when it's obvious
  form.querySelector('[name="provider_id"]').addEventListener('change', (e) => {
    const p = provider(data, Number(e.target.value));
    const k = { dentist: 'dental', optometrist: 'vision', specialist: 'specialist', therapist: 'therapy' }[p?.kind];
    if (k && !isEdit) form.querySelector('[name="kind"]').value = k;
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = values(form);
    submit(form, {
      action: 'save-appointment', id: a?.id || 0, ...f, person_id: Number(f.person_id) || 0, provider_id: Number(f.provider_id) || 0,
      duration: Number(f.duration), remind_days: Number(f.remind_days), follow_up_of: v.follow_up_of || 0,
    }, (json) => openAppointment(json.saved || a?.id));
  });
  setTimeout(() => form.querySelector(v.person_id ? '[name="title"]' : '[name="person_id"]')?.focus(), 50);
}

// --- Medication form --------------------------------------------------

function openMedicationForm(m, pre = {}) {
  const isEdit = !!m;
  const v = m || { person_id: '', name: '', dose: '', times: [], instructions: '', prescriber_id: null, pharmacy_id: null, start_date: data.today, end_date: '', refill_date: '', active: true, ...pre };
  let times = [...v.times];
  const presets = [['07:00', '🌅 Morning'], ['08:00', '🍳 Breakfast'], ['12:00', '🍽️ Noon'], ['14:00', '☀️ Afternoon'], ['18:00', '🌇 Dinner'], ['20:00', '🌙 Evening'], ['21:00', '🛏️ Bedtime']];
  const root = openModal('md-med-form', isEdit ? `Edit · ${m.name}` : 'Add a medication', `
    <form id="md-med-f" class="space-y-5" novalidate>
      ${formSection(TONE.pink, '💊', 'The medication', '', `
        <div class="grid gap-4 sm:grid-cols-2">
          ${field('mm-person', 'Who takes it', `<select id="mm-person" name="person_id" class="${kitInput}">${peopleOpts(v.person_id)}</select>`)}
          ${field('mm-name', 'Name', `<input id="mm-name" name="name" maxlength="150" value="${escapeHtml(v.name)}" placeholder="e.g. Amoxicillin" class="${kitInput}">`)}
          ${field('mm-dose', 'Dose', `<input id="mm-dose" name="dose" maxlength="100" value="${escapeHtml(v.dose)}" placeholder="e.g. 5 ml, 1 tablet, 2 puffs" class="${kitInput}">`)}
          ${field('mm-ins', 'Instructions', `<input id="mm-ins" name="instructions" maxlength="255" value="${escapeHtml(v.instructions)}" placeholder="e.g. With food" class="${kitInput}">`)}
        </div>`)}
      ${formSection(TONE.violet, '⏰', 'Dose times', 'Leave empty for “as needed” — then tap “Given now” each time.', `
        <div data-times class="flex flex-wrap gap-1.5 min-h-[2.25rem]"></div>
        <div class="mt-3 flex flex-wrap items-center gap-1.5">
          ${presets.map(([t, l]) => `<button type="button" data-add-time="${t}" class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-violet-200 dark:border-violet-800 bg-white/80 dark:bg-gray-900 text-violet-700 dark:text-violet-300 hover:bg-violet-100 dark:hover:bg-violet-900/40">${l} · ${clock(t)}</button>`).join('')}
          <span class="inline-flex items-center gap-1"><input type="time" data-custom-time class="${kitInput} !w-32 !py-1.5"><button type="button" data-add-custom class="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-violet-600 text-white hover:bg-violet-700">Add</button></span>
        </div>`)}
      ${formSection(TONE.sky, '🗓️', 'Dates & pharmacy', 'A refill date within a week shows as a reminder; the end date finishes the course.', `
        <div class="grid gap-4 sm:grid-cols-3">
          ${field('mm-start', 'Started', `<input id="mm-start" name="start_date" type="date" value="${v.start_date || ''}" class="${kitInput}">`)}
          ${field('mm-end', 'Ends <span class="normal-case font-normal tracking-normal text-gray-400">(a course)</span>', `<input id="mm-end" name="end_date" type="date" value="${v.end_date || ''}" class="${kitInput}">`)}
          ${field('mm-refill', 'Refill by', `<input id="mm-refill" name="refill_date" type="date" value="${v.refill_date || ''}" class="${kitInput}">`)}
          ${field('mm-pres', 'Prescribed by', `<select id="mm-pres" name="prescriber_id" class="${kitInput}">${providerOpts(v.prescriber_id, ['doctor', 'specialist', 'clinic', 'hospital', 'dentist', 'optometrist', 'other'])}</select>`)}
          ${field('mm-pharm', 'Pharmacy', `<select id="mm-pharm" name="pharmacy_id" class="${kitInput}">${providerOpts(v.pharmacy_id, ['pharmacy'])}</select>`)}
          <label class="flex items-end gap-2 pb-2.5 cursor-pointer"><input type="checkbox" name="active" ${v.active ? 'checked' : ''} class="rounded border-gray-300 text-primary-600 focus:ring-primary-500"><span class="text-sm font-semibold text-gray-700 dark:text-gray-200">Still taking it</span></label>
        </div>`)}
      ${formFoot(isEdit ? 'Save' : 'Add medication', isEdit ? `<button type="button" data-delete class="px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Delete</button>` : '')}
    </form>`, 'xl');
  const form = root.querySelector('form');
  const paintTimes = () => {
    times.sort();
    form.querySelector('[data-times]').innerHTML = times.length ? times.map((t) => `<span class="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 pl-3 pr-1 py-1 text-sm font-bold text-violet-800 dark:text-violet-200">${clock(t)}<button type="button" data-rm-time="${t}" class="p-0.5 rounded-full hover:bg-violet-200 dark:hover:bg-violet-800" aria-label="Remove ${clock(t)}">${svg(ICON.x, 'h-3.5 w-3.5')}</button></span>`).join('')
      : '<span class="text-sm text-gray-500 dark:text-gray-400 py-1">As needed (no set times)</span>';
  };
  paintTimes();
  form.addEventListener('click', async (e) => {
    const add = e.target.closest('[data-add-time]');
    if (add) { if (!times.includes(add.dataset.addTime)) times.push(add.dataset.addTime); paintTimes(); return; }
    if (e.target.closest('[data-add-custom]')) { const c = form.querySelector('[data-custom-time]').value; if (c && !times.includes(c)) times.push(c); paintTimes(); return; }
    const rm = e.target.closest('[data-rm-time]');
    if (rm) { times = times.filter((t) => t !== rm.dataset.rmTime); paintTimes(); return; }
    if (e.target.closest('[data-cancel]')) { modal.close(); return; }
    if (e.target.closest('[data-delete]')) {
      if (!(await confirmDialog(`Delete <strong>${escapeHtml(m.name)}</strong> and its dose history? (To stop it but keep the history, untick “Still taking it”.)`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      try { const json = await post({ action: 'delete-medication', id: m.id }); adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Deleted.', 'success'); } catch (err) { showToast(err.message, 'error'); }
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = values(form);
    submit(form, { action: 'save-medication', id: m?.id || 0, ...f, times, active: !!f.active, person_id: Number(f.person_id) || 0, prescriber_id: Number(f.prescriber_id) || 0, pharmacy_id: Number(f.pharmacy_id) || 0 });
  });
}

// --- Record form --------------------------------------------------------

function openRecordForm(r, pre = {}) {
  const isEdit = !!r;
  const v = r || { person_id: '', kind: 'vaccination', title: '', date: data.today, value: '', notes: '', provider_id: null, next_due: '', ...pre };
  const root = openModal('md-rec-form', isEdit ? `Edit · ${r.title}` : 'Add a health record', `
    <form id="md-rec-f" class="space-y-5" novalidate>
      ${formSection(TONE.green, '💉', 'The record', '', `
        <div class="flex flex-wrap gap-1.5 mb-4">${Object.entries(data.record_kinds).map(([k, x]) => `<label class="cursor-pointer"><input type="radio" name="kind" value="${k}" ${v.kind === k ? 'checked' : ''} class="peer sr-only"><span class="inline-flex items-center gap-1.5 rounded-full border-2 border-gray-200 dark:border-gray-700 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 peer-checked:border-emerald-400 peer-checked:bg-emerald-50 peer-checked:text-emerald-800 dark:peer-checked:bg-emerald-950/40 dark:peer-checked:text-emerald-200">${x.icon} ${escapeHtml(x.label)}</span></label>`).join('')}</div>
        <div class="grid gap-4 sm:grid-cols-2">
          ${field('mr-person', 'For', `<select id="mr-person" name="person_id" class="${kitInput}">${peopleOpts(v.person_id)}</select>`)}
          ${field('mr-title', 'Title', `<input id="mr-title" name="title" maxlength="150" value="${escapeHtml(v.title)}" placeholder="e.g. Flu shot, Blood test, Height & weight" class="${kitInput}">`)}
          ${field('mr-date', 'Date', `<input id="mr-date" name="date" type="date" value="${v.date || ''}" class="${kitInput}">`)}
          ${field('mr-value', 'Result / value <span class="normal-case font-normal tracking-normal text-gray-400">(optional)</span>', `<input id="mr-value" name="value" maxlength="150" value="${escapeHtml(v.value)}" placeholder="e.g. 120/80, Negative, Dose 2 of 3" class="${kitInput}">`)}
          ${field('mr-provider', 'Where / who', `<select id="mr-provider" name="provider_id" class="${kitInput}">${providerOpts(v.provider_id)}</select>`)}
          ${field('mr-due', 'Next due <span class="normal-case font-normal tracking-normal text-gray-400">(reminds you to book)</span>', `<input id="mr-due" name="next_due" type="date" value="${v.next_due || ''}" class="${kitInput}">
            <div class="mt-1.5 flex flex-wrap gap-1">${[[182, '+6 months'], [365, '+1 year'], [730, '+2 years'], [1825, '+5 years']].map(([d, l]) => `<button type="button" data-due-in="${d}" class="px-2 py-0.5 rounded-md text-[11px] font-semibold border border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/40">${l}</button>`).join('')}</div>`)}
          ${field('mr-notes', 'Notes', `<textarea id="mr-notes" name="notes" rows="3" class="${kitInput} resize-y">${escapeHtml(v.notes)}</textarea>`, 'sm:col-span-2')}
        </div>`)}
      ${formFoot(isEdit ? 'Save' : 'Add record', isEdit ? `<button type="button" data-delete class="px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Delete</button>` : '')}
    </form>`, 'xl');
  const form = root.querySelector('form');
  form.addEventListener('click', async (e) => {
    const d = e.target.closest('[data-due-in]');
    if (d) { const from = form.querySelector('[name="date"]').value ? parse(form.querySelector('[name="date"]').value) : new Date(); from.setDate(from.getDate() + Number(d.dataset.dueIn)); form.querySelector('[name="next_due"]').value = iso(from); return; }
    if (e.target.closest('[data-cancel]')) { modal.close(); return; }
    if (e.target.closest('[data-delete]')) {
      if (!(await confirmDialog(`Delete <strong>${escapeHtml(r.title)}</strong>?`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      try { const json = await post({ action: 'delete-record', id: r.id }); adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Deleted.', 'success'); } catch (err) { showToast(err.message, 'error'); }
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = values(form);
    submit(form, { action: 'save-record', id: r?.id || 0, ...f, person_id: Number(f.person_id) || 0, provider_id: Number(f.provider_id) || 0 });
  });
}

// --- People -------------------------------------------------------------

function openPersonForm(p) {
  const isEdit = !!p;
  const used = data.people.map((x) => x.color);
  const v = p ? { ...p, allergies: p.allergies.join('\n'), conditions: p.conditions.join('\n') }
    : { first_name: '', last_name: '', date_of_birth: '', blood_type: '', color: data.colors.find((c) => !used.includes(c)) || 'sky', health_number: '', allergies: '', conditions: '', notes: '', emergency_contact: '', user_id: null };
  const swatch = PCOL;
  const root = openModal('md-person-form', isEdit ? `Edit · ${fullName(p)}` : 'Add a family member', `
    <form id="md-person-f" class="space-y-5" novalidate>
      ${formSection(TONE.orange, '👤', 'Who they are', '', `
        <div class="grid gap-4 sm:grid-cols-3">
          ${field('mp-first', 'First name', `<input id="mp-first" name="first_name" maxlength="100" value="${escapeHtml(v.first_name)}" class="${kitInput}">`)}
          ${field('mp-last', 'Last name', `<input id="mp-last" name="last_name" maxlength="100" value="${escapeHtml(v.last_name)}" class="${kitInput}">`)}
          ${field('mp-dob', 'Date of birth', `<input id="mp-dob" name="date_of_birth" type="date" max="${data.today}" value="${v.date_of_birth || ''}" class="${kitInput}">`)}
        </div>
        <p class="${kitLabel} mt-4">Colour</p>
        <div class="flex flex-wrap gap-2">${data.colors.map((c) => `<label class="cursor-pointer"><input type="radio" name="color" value="${c}" ${v.color === c ? 'checked' : ''} class="peer sr-only"><span class="block h-8 w-8 rounded-full ${swatch[c].bg} ring-offset-2 ring-offset-white dark:ring-offset-gray-900 peer-checked:ring-2 peer-checked:ring-gray-900 dark:peer-checked:ring-white"></span></label>`).join('')}</div>`)}
      ${formSection(TONE.pink, '❤️', 'Health', 'One allergy or condition per line.', `
        <div class="grid gap-4 sm:grid-cols-2">
          ${field('mp-allergies', '⚠️ Allergies', `<textarea id="mp-allergies" name="allergies" rows="3" class="${kitInput} resize-y" placeholder="e.g. Penicillin&#10;Peanuts">${escapeHtml(v.allergies)}</textarea>`)}
          ${field('mp-conditions', 'Conditions', `<textarea id="mp-conditions" name="conditions" rows="3" class="${kitInput} resize-y" placeholder="e.g. Asthma">${escapeHtml(v.conditions)}</textarea>`)}
          ${field('mp-blood', 'Blood type', `<select id="mp-blood" name="blood_type" class="${kitInput}">${opts(data.blood_types.map((b) => [b, b]), v.blood_type, 'Not known')}</select>`)}
          ${field('mp-health', 'Health card number', `<input id="mp-health" name="health_number" maxlength="60" value="${escapeHtml(v.health_number)}" autocomplete="off" class="${kitInput}">`)}
          ${field('mp-emerg', 'Emergency contact', `<input id="mp-emerg" name="emergency_contact" maxlength="255" value="${escapeHtml(v.emergency_contact)}" placeholder="Name · phone" class="${kitInput}">`)}
          ${data.accounts.length ? field('mp-user', 'Their CatScript account', `<select id="mp-user" name="user_id" class="${kitInput}">${opts(data.accounts.map((a) => [a.id, a.name]), v.user_id, 'None')}</select>`) : ''}
          ${field('mp-notes', 'Notes', `<textarea id="mp-notes" name="notes" rows="2" class="${kitInput} resize-y" placeholder="e.g. EpiPen in the school bag">${escapeHtml(v.notes)}</textarea>`, 'sm:col-span-2')}
        </div>`)}
      ${formFoot(isEdit ? 'Save' : 'Add', isEdit ? `<button type="button" data-delete class="px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Remove</button>` : '')}
    </form>`, 'xl');
  const form = root.querySelector('form');
  form.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cancel]')) { modal.close(); return; }
    if (e.target.closest('[data-delete]')) {
      if (!(await confirmDialog(`Remove <strong>${escapeHtml(p.first_name)}</strong> from Medicals? Their appointments, medications and records are hidden with them.`, 'Remove', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      try { const json = await post({ action: 'remove-person', id: p.id }); adopt(json); who = 'all'; modal.close(); render(); showToast(json.messages?.[0] || 'Removed.', 'success'); } catch (err) { showToast(err.message, 'error'); }
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = values(form);
    submit(form, { action: 'save-person', id: p?.id || 0, ...f, user_id: Number(f.user_id) || 0 });
  });
  setTimeout(() => form.querySelector('[name="first_name"]').focus(), 50);
}

/** A person's whole picture: profile, medications, upcoming, history, records. */
function openPerson(p) {
  if (!p) return;
  const t = data.today;
  const meds = data.medications.filter((m) => m.person_id === p.id);
  const appts = data.appointments.filter((a) => a.person_id === p.id);
  const ahead = upcoming(data).filter((a) => a.person_id === p.id);
  const past = appts.filter((a) => a.status === 'done').sort((x, y) => (y.date || '').localeCompare(x.date || '')).slice(0, 5);
  const recs = data.records.filter((r) => r.person_id === p.id).slice(0, 8);
  const block = (title, inner) => `<div><p class="text-[11px] font-black uppercase tracking-[0.15em] text-gray-400 mb-2">${title}</p>${inner}</div>`;
  const root = openModal('md-person', fullName(p), `
    <div class="space-y-6">
      <div class="relative overflow-hidden rounded-2xl ${pc(p).soft} ring-1 ${pc(p).ring} p-5 flex items-center gap-4">
        ${avatar(p, 'h-16 w-16 text-xl')}
        <div class="min-w-0 flex-1">
          <p class="text-xl font-bold text-gray-900 dark:text-white">${escapeHtml(fullName(p))}</p>
          <p class="text-sm text-gray-600 dark:text-gray-300">${p.date_of_birth ? `${age(p.date_of_birth, t)} · born ${shortDate(p.date_of_birth)}` : 'Age not set'}${p.blood_type ? ` · Blood type <strong class="text-red-600">${escapeHtml(p.blood_type)}</strong>` : ''}</p>
          ${p.health_number ? `<p class="text-xs text-gray-500 mt-1">Health card: <button type="button" data-reveal class="font-mono font-semibold underline decoration-dotted" data-number="${escapeHtml(p.health_number)}">•••• ${escapeHtml(p.health_number.slice(-4))}</button></p>` : ''}
        </div>
      </div>
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/20 p-3.5"><p class="text-[11px] font-bold uppercase tracking-wider text-red-600">⚠️ Allergies</p><p class="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">${p.allergies.length ? escapeHtml(p.allergies.join(', ')) : 'None known'}</p></div>
        <div class="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5"><p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Conditions</p><p class="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">${p.conditions.length ? escapeHtml(p.conditions.join(', ')) : 'None'}</p></div>
        ${p.emergency_contact ? `<div class="rounded-xl border border-gray-200 dark:border-gray-800 p-3.5"><p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Emergency contact</p><p class="text-sm font-semibold text-gray-900 dark:text-white mt-0.5">${escapeHtml(p.emergency_contact)}</p></div>` : ''}
        ${p.notes ? `<div class="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3.5"><p class="text-[11px] font-bold uppercase tracking-wider text-amber-700">Notes</p><p class="text-sm text-gray-900 dark:text-white mt-0.5 whitespace-pre-wrap">${escapeHtml(p.notes)}</p></div>` : ''}
      </div>
      ${block('Medications', meds.length ? `<div class="space-y-1.5">${meds.map((m) => `<button type="button" data-p-med="${m.id}" class="w-full flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2 text-left hover:border-primary-300 ${isCurrent(m, t) ? '' : 'opacity-60'}"><span>💊</span><span class="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(m.name)}${m.dose ? ` · ${escapeHtml(m.dose)}` : ''}</span><span class="text-xs text-gray-500">${m.times.length ? m.times.map(clock).join(', ') : 'As needed'}${isCurrent(m, t) ? '' : ' · stopped'}</span></button>`).join('')}</div>` : '<p class="text-sm text-gray-500">None.</p>')}
      ${block('Coming up', ahead.length ? `<div class="space-y-2">${ahead.map(apptRow).join('')}</div>` : '<p class="text-sm text-gray-500">Nothing booked.</p>')}
      ${past.length ? block('Recent visits', `<div class="space-y-2">${past.map(apptRow).join('')}</div>`) : ''}
      ${block('Records', recs.length ? `<div class="space-y-1.5">${recs.map((r) => `<button type="button" data-p-rec="${r.id}" class="w-full flex items-center gap-2 rounded-xl border border-gray-200 dark:border-gray-800 px-3 py-2 text-left hover:border-primary-300"><span>${data.record_kinds?.[r.kind]?.icon || '📝'}</span><span class="min-w-0 flex-1 text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(r.title)}${r.value ? ` · ${escapeHtml(r.value)}` : ''}</span><span class="text-xs text-gray-500">${r.date ? shortDate(r.date) : ''}${r.next_due ? ` · next ${shortDate(r.next_due)}` : ''}</span></button>`).join('')}</div>` : '<p class="text-sm text-gray-500">None yet.</p>')}
      <div class="flex flex-wrap gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
        <button type="button" data-p="book" class="${btnPrimary}">${svg(ICON.plus)} Book for ${escapeHtml(p.first_name)}</button>
        <button type="button" data-p="med" class="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">💊 Add medication</button>
        <button type="button" data-p="rec" class="inline-flex items-center gap-1.5 rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">💉 Add record</button>
        <span class="ml-auto flex gap-2">
          <button type="button" data-p="print" class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">${svg(ICON.print)} Print summary</button>
          <button type="button" data-p="edit" class="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800">${svg(ICON.edit)} Edit</button>
        </span>
      </div>
    </div>`, 'xl');
  root.addEventListener('click', (e) => {
    const rev = e.target.closest('[data-reveal]');
    if (rev) { rev.textContent = rev.dataset.number; rev.classList.remove('underline'); return; }
    const pm = e.target.closest('[data-p-med]');
    if (pm) { openMedicationForm(data.medications.find((m) => m.id === Number(pm.dataset.pMed))); return; }
    const pr = e.target.closest('[data-p-rec]');
    if (pr) { openRecordForm(data.records.find((r) => r.id === Number(pr.dataset.pRec))); return; }
    const oa = e.target.closest('[data-open-appt]');
    if (oa) { openAppointment(Number(oa.dataset.openAppt)); return; }
    const x = e.target.closest('[data-p]')?.dataset.p;
    if (x === 'book') openAppointmentForm(null, { person_id: p.id });
    if (x === 'med') openMedicationForm(null, { person_id: p.id });
    if (x === 'rec') openRecordForm(null, { person_id: p.id });
    if (x === 'print') printSummary(p);
    if (x === 'edit') openPersonForm(p);
  });
}

/** One printable page — for a new doctor, a babysitter, or a trip to emergency. */
function printSummary(p) {
  if (!p) return;
  const t = data.today;
  const meds = data.medications.filter((m) => m.person_id === p.id && isCurrent(m, t));
  const ahead = upcoming(data).filter((a) => a.person_id === p.id).slice(0, 5);
  const vacc = data.records.filter((r) => r.person_id === p.id && r.kind === 'vaccination').slice(0, 10);
  const recent = data.records.filter((r) => r.person_id === p.id && r.kind !== 'vaccination').slice(0, 6);
  const doctor = data.providers.find((x) => x.kind === 'doctor');
  const row = (k, v) => (v ? `<tr><th>${escapeHtml(k)}</th><td>${v}</td></tr>` : '');
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to print the summary.', 'error'); return; }
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Medical summary — ${escapeHtml(fullName(p))}</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#111827;margin:32px;font-size:13px;line-height:1.45}
      h1{font-size:22px;margin:0}h2{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#6b7280;margin:22px 0 6px;border-bottom:2px solid #f97316;padding-bottom:4px}
      .sub{color:#4b5563;margin:4px 0 0}.alert{margin-top:14px;padding:10px 12px;border:2px solid #dc2626;border-radius:8px;background:#fef2f2;font-weight:700;color:#991b1b}
      table{width:100%;border-collapse:collapse}th{text-align:left;color:#6b7280;font-weight:600;width:34%;padding:4px 8px 4px 0;vertical-align:top}td{padding:4px 0;vertical-align:top}
      ul{margin:0;padding-left:18px}li{margin:2px 0}.muted{color:#6b7280}.foot{margin-top:28px;color:#9ca3af;font-size:11px}
      @media print{body{margin:14mm}}
    </style></head><body>
    <h1>${escapeHtml(fullName(p))}</h1>
    <p class="sub">${p.date_of_birth ? `Born ${escapeHtml(shortDate(p.date_of_birth))} (${escapeHtml(age(p.date_of_birth, t))})` : ''}${p.blood_type ? ` · Blood type <strong>${escapeHtml(p.blood_type)}</strong>` : ''}</p>
    <div class="alert">⚠ Allergies: ${p.allergies.length ? escapeHtml(p.allergies.join(', ')) : 'none known'}</div>
    <h2>Details</h2><table>
      ${row('Conditions', p.conditions.length ? escapeHtml(p.conditions.join(', ')) : 'None')}
      ${row('Health card', escapeHtml(p.health_number))}
      ${row('Emergency contact', escapeHtml(p.emergency_contact))}
      ${row('Family doctor', doctor ? `${escapeHtml(doctor.name)}${doctor.phone ? ` · ${escapeHtml(doctor.phone)}` : ''}` : '')}
      ${row('Notes', escapeHtml(p.notes))}
    </table>
    <h2>Current medications</h2>${meds.length ? `<ul>${meds.map((m) => `<li><strong>${escapeHtml(m.name)}</strong>${m.dose ? ` — ${escapeHtml(m.dose)}` : ''} · ${m.times.length ? escapeHtml(m.times.map(clock).join(', ')) : 'as needed'}${m.instructions ? ` <span class="muted">(${escapeHtml(m.instructions)})</span>` : ''}${m.end_date ? ` <span class="muted">until ${escapeHtml(shortDate(m.end_date))}</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">None.</p>'}
    <h2>Upcoming appointments</h2>${ahead.length ? `<ul>${ahead.map((a) => `<li>${escapeHtml(shortDate(a.date))}${a.time ? ` ${escapeHtml(clock(a.time))}` : ''} — <strong>${escapeHtml(a.title)}</strong>${provider(data, a.provider_id) ? ` · ${escapeHtml(provider(data, a.provider_id).name)}` : ''}</li>`).join('')}</ul>` : '<p class="muted">None booked.</p>'}
    <h2>Vaccinations</h2>${vacc.length ? `<ul>${vacc.map((r) => `<li>${escapeHtml(r.title)}${r.value ? ` — ${escapeHtml(r.value)}` : ''}${r.date ? ` · ${escapeHtml(shortDate(r.date))}` : ''}${r.next_due ? ` <span class="muted">(next due ${escapeHtml(shortDate(r.next_due))})</span>` : ''}</li>`).join('')}</ul>` : '<p class="muted">None recorded.</p>'}
    ${recent.length ? `<h2>Recent records</h2><ul>${recent.map((r) => `<li>${escapeHtml(r.title)}${r.value ? ` — ${escapeHtml(r.value)}` : ''}${r.date ? ` · ${escapeHtml(shortDate(r.date))}` : ''}</li>`).join('')}</ul>` : ''}
    <p class="foot">Printed ${escapeHtml(shortDate(t))} from CatScript Apps · Medicals</p>
    </body></html>`);
  w.document.close();
  w.addEventListener('load', () => { w.focus(); w.print(); });
}

// --- Providers ------------------------------------------------------------

function openProviderForm(p) {
  const isEdit = !!p;
  const v = p || { name: '', kind: 'doctor', specialty: '', phone: '', email: '', address: '', website: '', notes: '' };
  const root = openModal('md-provider-form', isEdit ? `Edit · ${p.name}` : 'Add a provider', `
    <form id="md-provider-f" class="space-y-5" novalidate>
      ${formSection(TONE.pink, '🏥', 'Who they are', '', `
        <div class="flex flex-wrap gap-1.5 mb-4">${Object.entries(data.provider_kinds).map(([k, l]) => `<label class="cursor-pointer"><input type="radio" name="kind" value="${k}" ${v.kind === k ? 'checked' : ''} class="peer sr-only"><span class="inline-flex items-center gap-1.5 rounded-full border-2 border-gray-200 dark:border-gray-700 px-3 py-1 text-xs font-semibold text-gray-600 dark:text-gray-300 peer-checked:border-pink-400 peer-checked:bg-pink-50 peer-checked:text-pink-800 dark:peer-checked:bg-pink-950/40 dark:peer-checked:text-pink-200">${PROVIDER_ICON[k]} ${escapeHtml(l)}</span></label>`).join('')}</div>
        <div class="grid gap-4 sm:grid-cols-2">
          ${field('mv-name', 'Name', `<input id="mv-name" name="name" maxlength="150" value="${escapeHtml(v.name)}" placeholder="e.g. Dr. Priya Patel, Main Street Pharmacy" class="${kitInput}">`)}
          ${field('mv-spec', 'Specialty <span class="normal-case font-normal tracking-normal text-gray-400">(optional)</span>', `<input id="mv-spec" name="specialty" maxlength="120" value="${escapeHtml(v.specialty)}" placeholder="e.g. Paediatric allergist" class="${kitInput}">`)}
        </div>`)}
      ${formSection(TONE.sky, '☎️', 'How to reach them', '', `
        <div class="grid gap-4 sm:grid-cols-2">
          ${field('mv-phone', 'Phone', `<input id="mv-phone" name="phone" type="tel" maxlength="50" value="${escapeHtml(v.phone)}" class="${kitInput}">`)}
          ${field('mv-email', 'Email', `<input id="mv-email" name="email" type="email" maxlength="150" value="${escapeHtml(v.email)}" class="${kitInput}">`)}
          ${field('mv-address', 'Address', `<input id="mv-address" name="address" maxlength="255" value="${escapeHtml(v.address)}" class="${kitInput}">`)}
          ${field('mv-web', 'Website / booking page', `<input id="mv-web" name="website" maxlength="255" value="${escapeHtml(v.website)}" class="${kitInput}">`)}
          ${field('mv-notes', 'Notes', `<textarea id="mv-notes" name="notes" rows="2" class="${kitInput} resize-y" placeholder="e.g. Book online for routine visits">${escapeHtml(v.notes)}</textarea>`, 'sm:col-span-2')}
        </div>`)}
      ${formFoot(isEdit ? 'Save' : 'Add provider', isEdit ? `<button type="button" data-delete class="px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Delete</button>` : '')}
    </form>`, 'xl');
  const form = root.querySelector('form');
  form.addEventListener('click', async (e) => {
    if (e.target.closest('[data-cancel]')) { modal.close(); return; }
    if (e.target.closest('[data-delete]')) {
      if (!(await confirmDialog(`Delete <strong>${escapeHtml(p.name)}</strong>? Appointments and records that mention them keep everything else.`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      try { const json = await post({ action: 'delete-provider', id: p.id }); adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Deleted.', 'success'); } catch (err) { showToast(err.message, 'error'); }
    }
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    submit(form, { action: 'save-provider', id: p?.id || 0, ...values(form) });
  });
  setTimeout(() => form.querySelector('[name="name"]').focus(), 50);
}
