// /resources/js/pages/users-page.js
//
// Users (admins): every account lives in memory (seeded from #users-data).
// render() draws the photo hero (accounts, active, admins, archived, and how
// many people have each app), the filter chips and the directory; clicking a
// person opens their profile card (roles, apps, location, activity).
//
// Adding / editing reuse the shared user form — modals/users-modal.js listens
// for #add-user-btn and .edit-user-btn (with the data-* it reads) — and
// utils/users/form-submit.js fires "users:saved", after which this page
// reloads its copy (GET api/users?state=1). Deleting is done here, and so is
// resetting a password (the key on each row, or in the profile card).

import { Modal } from '../factories/modal-factory.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { initUsersModal } from '../modals/users-modal.js';
import { createUploadHandler } from '../modals/upload-modal.js';
import { updateHeaderAvatar } from '../utils/header-avatar.js';
import { TONE, formSection, kitInput, kitLabel, kitSubmit, kitGhost } from '../forms/form-kit.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const HERO_SLIDE_MS = 8 * 1000;
const AVATARS = ['from-orange-400 to-rose-500', 'from-sky-400 to-indigo-500', 'from-emerald-400 to-teal-600', 'from-violet-400 to-fuchsia-500', 'from-amber-400 to-orange-500', 'from-cyan-400 to-sky-600', 'from-lime-400 to-emerald-500', 'from-pink-400 to-rose-500'];
/**
 * Emoji per permissioned app (AuthService::PERMISSIONED_APPS), same as the
 * user form's app tiles (forms/user-form.js) — add one when you register a
 * new app; apps without one show ⭐.
 */
const APP_ICON = {};
/** Capabilities (AuthService::CAPABILITIES) ride along with an app rather than being apps. */
const CAPABILITY = Object.keys(window.APP_CONFIG?.appCapabilities || {});

let data = { users: [], grantable: [], today: '' };
let state = { q: '', filter: 'all', sort: 'name' };
let modal = null;
let heroTimer = null;
let listening = false;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const place = (u) => [u.city, u.region, u.country].filter(Boolean).join(', ');
const appsOnly = (list) => list.filter((a) => !CAPABILITY.includes(a));
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  edit: 'M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  users: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  key: 'M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z',
  camera: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  refresh: 'M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
};

/** "today", "3 days ago", "Sep 4, 2026" */
function ago(s) {
  if (!s) return 'No activity yet';
  const days = Math.round((new Date(`${data.today}T00:00:00`) - new Date(`${s}T00:00:00`)) / 86400000);
  if (days <= 0) return 'Active today';
  if (days === 1) return 'Active yesterday';
  if (days < 30) return `Active ${days} days ago`;
  return `Last active ${shortDate(s)}`;
}

function avatar(u, size = 'h-10 w-10', text = 'text-sm') {
  return u.avatar
    ? `<img src="${escapeHtml(u.avatar)}" alt="" class="${size} flex-shrink-0 rounded-2xl object-cover ring-1 ring-black/5">`
    : `<span class="${size} flex-shrink-0 rounded-2xl bg-gradient-to-br ${AVATARS[hash(u.name || '?') % AVATARS.length]} flex items-center justify-center ${text} font-bold text-white">${escapeHtml(initials(u.name || '?'))}</span>`;
}
const rolePill = (u) => (u.is_admin
  ? '<span class="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/50 px-2 py-0.5 text-[10px] font-bold text-rose-700 dark:text-rose-300">👑 Admin</span>'
  : '<span class="inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-bold text-gray-600 dark:text-gray-300">User</span>');
const statusPill = (u) => (u.active
  ? '<span class="inline-block rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Active</span>'
  : '<span class="inline-block rounded-full bg-slate-200 dark:bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:text-slate-300">Archived</span>');

/** The apps a person can open, as emoji chips (admins: everything). */
function appChips(u, max = 6) {
  if (u.is_admin) return '<span class="text-xs font-semibold text-rose-600 dark:text-rose-400">Every app</span>';
  const apps = appsOnly(u.apps);
  if (!apps.length) return '<span class="text-xs text-gray-400">No apps yet</span>';
  return `<span class="flex flex-wrap items-center gap-1">${apps.slice(0, max).map((a) => `<span title="${escapeHtml(a)}" class="h-6 w-6 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs">${APP_ICON[a] || '⭐'}</span>`).join('')}${apps.length > max ? `<span class="text-[11px] font-semibold text-gray-400">+${apps.length - max}</span>` : ''}</span>`;
}

/** The button the shared edit modal reads its data from (modals/users-modal.js). */
function editButton(u, cls, label) {
  const attrs = {
    'encoded-id': u.id, 'first-name': u.first_name, 'last-name': u.last_name, email: u.email,
    'country-id': u.country_id || '', 'region-id': u.region_id || '', city: u.city,
    'is-active': u.active ? '1' : '0', 'is-protected': u.admin_locked ? '1' : '0',
    'user-type-ids': JSON.stringify(u.role_ids), 'permitted-apps': JSON.stringify(u.permitted),
  };
  return `<button type="button" class="edit-user-btn ${cls}" ${Object.entries(attrs).map(([k, v]) => `data-${k}="${escapeHtml(String(v ?? ''))}"`).join(' ')}>${label}</button>`;
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('users-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('users-data')?.textContent || '{}') }; } catch { /* defaults */ }
  state = { q: '', filter: 'all', sort: 'name' };

  initUsersModal(); // #add-user-btn and .edit-user-btn → the shared form
  page.addEventListener('click', onClick);
  page.addEventListener('keydown', (e) => {
    const row = e.target.closest?.('[data-open]');
    if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openProfile(row.dataset.open); }
  });
  const search = document.getElementById('us-search');
  search?.addEventListener('input', debounce(() => { state.q = search.value.trim().toLowerCase(); renderList(); }, 150));
  document.getElementById('us-sort')?.addEventListener('change', (e) => { state.sort = e.target.value; renderList(); });

  // After the shared form saves: close any open profile and reload the directory
  if (!listening) {
    listening = true;
    document.addEventListener('users:saved', async () => {
      if (!document.getElementById('users-page')) return;
      await reload();
    });
  }

  render();
  startHeroSlides();
}

async function reload() {
  try {
    const res = await fetch(`${base()}api/users?state=1`, { cache: 'no-store' });
    const json = await res.json();
    if (json.success) { data = { ...data, users: json.users, grantable: json.grantable, today: json.today }; render(); }
  } catch { /* keep what we have */ }
}

function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll('#users-page [data-hero-slides] .hero-slide')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  heroTimer = setInterval(() => {
    if (!document.body.contains(slides[0])) { clearInterval(heroTimer); return; }
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, HERO_SLIDE_MS);
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function render() { renderHero(); renderFilters(); renderList(); }

function renderHero() {
  const el = document.getElementById('us-hero');
  if (!el) return;
  const users = data.users;
  const active = users.filter((u) => u.active);
  const admins = users.filter((u) => u.is_admin);
  const year = (data.today || '').slice(0, 4);
  const newThisYear = users.filter((u) => (u.joined || '').startsWith(year));
  const seenWeek = active.filter((u) => u.last_seen && (new Date(`${data.today}T00:00:00`) - new Date(`${u.last_seen}T00:00:00`)) / 86400000 < 7);

  // How many (non-admin, active) people have each app — admins open everything anyway
  const counted = active.filter((u) => !u.is_admin);
  const perApp = appsOnly(data.grantable).map((a) => ({ a, n: counted.filter((u) => u.apps.includes(a)).length }));
  const max = Math.max(1, ...perApp.map((x) => x.n));

  const tile = (value, label, note, accent = 'text-white', filter = '') => `
    <button type="button" ${filter ? `data-filter="${filter}"` : 'disabled'} class="text-left rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-4 py-3.5 min-w-0 ${filter ? 'hover:bg-white/15 transition-colors' : 'cursor-default'}">
      <span class="block text-2xl sm:text-3xl font-bold leading-none ${accent} truncate">${value}</span>
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">${label}</span>
      ${note ? `<span class="block text-[11px] text-white/60 mt-0.5 truncate">${note}</span>` : ''}
    </button>`;

  el.innerHTML = `
    <div class="grid gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3 min-w-0">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">${svg(ICON.users, 'h-3.5 w-3.5')} Admin · Users</span>
        <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">${plural(active.length, 'person', 'people')} on ${escapeHtml(window.APP_CONFIG?.appName || 'the team')}</h1>
        <p class="mt-2 text-base text-secondary-50">Accounts, roles and who can open which app. ${seenWeek.length ? `${plural(seenWeek.length, 'person', 'people')} active this week.` : ''}</p>
        <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${tile(active.length, 'Active', `${plural(users.length, 'account')} in all`, 'text-emerald-300', 'active')}
          ${tile(admins.length, 'Admins', 'every app', 'text-rose-300', 'admins')}
          ${tile(users.length - active.length, 'Archived', 'can’t sign in', 'text-white', 'archived')}
          ${tile(newThisYear.length, `New in ${year}`, newThisYear.length ? 'accounts added' : '')}
        </div>
      </div>
      <div class="lg:col-span-2 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-4">
        <div class="flex items-baseline justify-between mb-3">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary-200">Who has each app</p>
          <p class="text-[11px] text-white/60">active non-admins</p>
        </div>
        <div class="space-y-1.5">
          ${perApp.map(({ a, n }) => `
            <button type="button" data-app="${escapeHtml(a)}" class="w-full flex items-center gap-2 text-left group" title="Show who has ${escapeHtml(a)}">
              <span class="w-5 text-center text-sm">${APP_ICON[a] || '⭐'}</span>
              <span class="w-24 text-xs text-white/80 truncate group-hover:text-white">${escapeHtml(a)}</span>
              <span class="flex-1 h-2 rounded-full bg-white/10 overflow-hidden"><span class="block h-full rounded-full bg-gradient-to-r from-primary-500 to-amber-300" style="width:${Math.round((n / max) * 100)}%"></span></span>
              <span class="w-5 text-right text-xs font-semibold">${n}</span>
            </button>`).join('')}
        </div>
      </div>
    </div>`;
}

function filters() {
  return [
    ['all', 'All', () => true],
    ['active', 'Active', (u) => u.active],
    ['admins', 'Admins', (u) => u.is_admin],
    ['archived', 'Archived', (u) => !u.active],
    ['no-apps', 'No apps yet', (u) => !u.is_admin && !appsOnly(u.apps).length],
    ...(state.filter.startsWith('app:') ? [[state.filter, state.filter.slice(4), (u) => u.is_admin || u.apps.includes(state.filter.slice(4))]] : []),
  ];
}

function renderFilters() {
  const el = document.getElementById('us-filters');
  if (!el) return;
  el.innerHTML = filters().map(([key, label, fn]) => {
    const n = data.users.filter(fn).length;
    const on = state.filter === key;
    return `<button type="button" data-filter="${escapeHtml(key)}" aria-pressed="${on}" class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${on ? 'bg-secondary-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300'}">
      ${key.startsWith('app:') ? `${APP_ICON[label] || '⭐'} ` : ''}${escapeHtml(label)} <span class="text-xs ${on ? 'opacity-70' : 'text-gray-400'}">${n}</span></button>`;
  }).join('');
}

function visible() {
  const fn = (filters().find(([k]) => k === state.filter) || filters()[0])[2];
  const q = state.q;
  const list = data.users.filter((u) => fn(u) && (!q || `${u.name} ${u.email} ${place(u)} ${u.roles.join(' ')} ${u.apps.join(' ')}`.toLowerCase().includes(q)));
  const by = {
    name: (a, b) => a.name.localeCompare(b.name),
    newest: (a, b) => (b.joined || '').localeCompare(a.joined || ''),
    active: (a, b) => (b.last_seen || '').localeCompare(a.last_seen || ''),
    apps: (a, b) => (b.is_admin - a.is_admin) || (appsOnly(b.apps).length - appsOnly(a.apps).length),
  }[state.sort];
  return [...list].sort(by);
}

const COLS = 'lg:grid-cols-[minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.6fr)_8rem_6rem]';

function renderList() {
  const body = document.getElementById('us-body');
  if (!body) return;
  const list = visible();
  if (!list.length) {
    body.innerHTML = `<div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 px-6 text-center shadow-sm">
      <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-500 mb-4">${svg(ICON.users, 'h-7 w-7')}</span>
      <p class="text-base font-semibold text-gray-800 dark:text-gray-100">Nobody here</p>
      <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${state.q ? 'Try another name, email or app.' : 'No accounts match that filter.'}</p></div>`;
    return;
  }
  body.innerHTML = `
    <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div class="hidden lg:grid ${COLS} gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        <span>Person</span><span>Location</span><span>Apps</span><span>Activity</span><span class="text-right">Status</span>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        ${list.map((u) => `
          <div data-open="${escapeHtml(u.id)}" role="button" tabindex="0"
            class="grid grid-cols-[minmax(0,1fr)_auto] ${COLS} gap-x-4 gap-y-2 items-center px-5 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${u.active ? '' : 'opacity-60'}">
            <span class="flex items-center gap-3 min-w-0">${avatar(u)}
              <span class="min-w-0"><span class="flex items-center gap-1.5"><span class="text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(u.name)}</span>${u.is_me ? '<span class="text-[10px] font-bold text-primary-600">(you)</span>' : ''}</span>
                <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(u.email)}</span></span></span>
            <span class="hidden lg:block text-xs text-gray-600 dark:text-gray-300 truncate">${escapeHtml(place(u)) || '<span class="text-gray-400">—</span>'}</span>
            <span class="col-span-2 lg:col-span-1 row-start-2 lg:row-start-auto">${appChips(u)}</span>
            <span class="hidden lg:block text-xs text-gray-500 dark:text-gray-400">${escapeHtml(ago(u.last_seen))}</span>
            <span class="flex flex-wrap items-center justify-end gap-1 row-start-1 col-start-2 lg:row-start-auto lg:col-start-auto">${rolePill(u)}${u.active ? '' : statusPill(u)}
              ${canReset(u) ? `<button type="button" data-reset="${escapeHtml(u.id)}" title="Reset ${escapeHtml(u.first_name || u.name)}’s password" aria-label="Reset ${escapeHtml(u.name)}’s password"
                class="ml-1 p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/40 transition-colors">${svg(ICON.key, 'h-4 w-4')}</button>` : ''}</span>
          </div>`).join('')}
      </div>
      <div class="px-5 py-3 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40 text-xs text-gray-500 dark:text-gray-400">
        Showing ${plural(list.length, 'account')}${list.length !== data.users.length ? ` of ${data.users.length}` : ''}
      </div>
    </div>`;
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

function onClick(e) {
  const f = e.target.closest('[data-filter]');
  if (f) { state.filter = f.dataset.filter; renderFilters(); renderList(); return; }
  const app = e.target.closest('[data-app]');
  if (app) { state.filter = `app:${app.dataset.app}`; renderFilters(); renderList(); document.getElementById('us-body')?.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; }
  if (e.target.closest('.edit-user-btn')) return; // the shared modal handles it
  const r = e.target.closest('[data-reset]');
  if (r) { openReset(data.users.find((x) => x.id === r.dataset.reset)); return; }
  const o = e.target.closest('[data-open]');
  if (o) openProfile(o.dataset.open);
}

// ------------------------------------------------------------
// Profile card
// ------------------------------------------------------------

function openProfile(id) {
  const u = data.users.find((x) => x.id === id);
  if (!u) return;
  const apps = appsOnly(u.apps);
  const caps = u.apps.filter((a) => CAPABILITY.includes(a));
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors';

  modal?.destroy();
  modal = new Modal({
    id: 'us-profile', title: u.name, size: 'md', showFooter: false,
    content: `
      <div class="space-y-5" data-profile>
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-800 via-secondary-900 to-secondary-950 p-5 text-white shadow-xl shadow-secondary-900/20">
          <div aria-hidden="true" class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-primary-500/40 blur-3xl"></div>
          <div class="relative flex items-center gap-4">
            ${avatar(u, 'h-16 w-16', 'text-xl')}
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap gap-1.5">${rolePill(u)}${statusPill(u)}</div>
              <p class="mt-1.5 text-xl font-bold tracking-tight truncate">${escapeHtml(u.name)}${u.is_me ? ' <span class="text-sm font-semibold text-primary-300">(you)</span>' : ''}</p>
              <a href="mailto:${escapeHtml(u.email)}" class="text-sm text-secondary-100/80 hover:text-white truncate block">${escapeHtml(u.email)}</a>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-3 gap-2 text-center">
          ${[[u.is_admin ? 'All' : apps.length, 'Apps'], [shortDate(u.joined) || '—', 'Joined'], [u.last_seen ? shortDate(u.last_seen) : '—', 'Last active']].map(([v, l]) => `
            <div class="rounded-xl bg-gray-50 dark:bg-gray-800/60 py-2.5 px-1"><span class="block text-sm font-bold text-gray-900 dark:text-white truncate">${escapeHtml(String(v))}</span><span class="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">${l}</span></div>`).join('')}
        </div>

        ${place(u) ? `<p class="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">${svg(ICON.pin, 'h-4 w-4 text-gray-400')} ${escapeHtml(place(u))}</p>` : ''}

        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">${u.is_admin ? 'Apps — admins open every app' : 'Apps they can open'}</p>
          ${u.is_admin ? '<p class="text-sm text-gray-600 dark:text-gray-300">As an admin, they can open every app and every admin tool.</p>'
            : (apps.length ? `<div class="flex flex-wrap gap-1.5">${apps.map((a) => `<span class="inline-flex items-center gap-1.5 rounded-xl bg-gray-100 dark:bg-gray-800 px-2.5 py-1.5 text-xs font-semibold text-gray-700 dark:text-gray-200">${APP_ICON[a] || '⭐'} ${escapeHtml(a)}</span>`).join('')}</div>`
              : '<p class="text-sm text-gray-500 dark:text-gray-400">No apps yet — edit them to give some.</p>')}
          ${!u.is_admin && caps.length ? `<p class="text-xs font-bold uppercase tracking-wider text-gray-400 mt-3 mb-2">Extra permissions</p><div class="flex flex-wrap gap-1.5">${caps.map((a) => `<span class="inline-flex items-center gap-1.5 rounded-xl bg-primary-50 dark:bg-primary-950/40 px-2.5 py-1.5 text-xs font-semibold text-primary-700 dark:text-primary-300">${APP_ICON[a] || '⭐'} ${escapeHtml(a)}</span>`).join('')}</div>` : ''}
        </div>

        <div class="flex flex-wrap items-center gap-2 pt-4 border-t border-gray-100 dark:border-gray-800">
          ${editButton(u, `${btn} bg-primary-600 hover:bg-primary-700 text-white shadow-sm`, `${svg(ICON.edit)} Edit`)}
          <a href="mailto:${escapeHtml(u.email)}" class="${btn} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.mail)} Email</a>
          ${canReset(u) ? `<button type="button" data-reset-here class="${btn} border border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/40">${svg(ICON.key)} Reset password</button>` : ''}
          ${canReset(u) ? `<button type="button" data-photo class="${btn} border border-sky-300 dark:border-sky-800 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40">${svg(ICON.camera)} ${u.avatar ? 'Change photo' : 'Add photo'}</button>` : ''}
          ${canReset(u) && u.avatar ? `<button type="button" data-photo-remove class="${btn} text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">Remove photo</button>` : ''}
          ${u.protected || u.is_me ? `<span class="ml-auto text-[11px] text-gray-400">${u.protected ? 'Core account — can’t be deleted' : 'You can’t delete your own account'}</span>`
            : `<button type="button" data-delete class="${btn} ml-auto text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">${svg(ICON.trash)} Delete</button>`}
        </div>
      </div>`,
  });
  modal.open();
  const root = document.getElementById('us-profile');
  // Editing replaces this card with the shared form
  root.querySelector('.edit-user-btn')?.addEventListener('click', () => setTimeout(() => modal?.destroy(), 0));
  root.querySelector('[data-reset-here]')?.addEventListener('click', () => openReset(u));
  root.querySelector('[data-photo]')?.addEventListener('click', () => changePhoto(u));
  root.querySelector('[data-photo-remove]')?.addEventListener('click', () => removePhoto(u));
  root.querySelector('[data-delete]')?.addEventListener('click', async () => {
    if (!(await confirmDialog(`Delete <strong>${escapeHtml(u.name)}</strong>’s account for good? To stop them signing in but keep their history, edit them and set them to Archived instead.`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
    try {
      const res = await fetch(`${base()}api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _method: 'DELETE', id: u.id }) });
      const json = await res.json().catch(() => ({ success: false }));
      if (!json.success) throw new Error(json.messages?.[0] || 'Could not delete the account.');
      modal.close();
      showToast(json.messages?.[0] || 'Deleted.', 'success');
      await reload();
    } catch (err) { showToast(err.message, 'error'); }
  });
}

// ------------------------------------------------------------
// Reset password (admins; UsersController::resetPassword / sendResetLink)
// ------------------------------------------------------------

/** Cat's own account (admin_locked) can only be reset by Cat. */
const canReset = (u) => !u.admin_locked || u.is_me;

const WORDS = ['Maple', 'River', 'Cedar', 'Otter', 'Comet', 'Harbor', 'Meadow', 'Falcon', 'Ember', 'Willow', 'Summit', 'Lantern', 'Pebble', 'Thistle', 'Orchid', 'Canyon',
  'Juniper', 'Marble', 'Saffron', 'Tundra', 'Breeze', 'Copper', 'Velvet', 'Glacier', 'Mango', 'Puffin', 'Quartz', 'Raven', 'Sparrow', 'Tulip', 'Walnut', 'Zephyr',
  'Acorn', 'Bramble', 'Clover', 'Dune', 'Fennel', 'Grove', 'Heron', 'Indigo', 'Jasper', 'Kestrel', 'Lagoon', 'Moss', 'Nutmeg', 'Olive', 'Prairie', 'Quill',
  'Ripple', 'Sable', 'Timber', 'Umber', 'Violet', 'Wren', 'Yarrow', 'Aspen', 'Basil', 'Coral', 'Delta', 'Fable', 'Garnet', 'Hazel', 'Iris', 'Kelp'];

/** A strong but readable password, e.g. "Cedar-Puffin-Glacier-Wren-47" (random from the browser's crypto). */
function generatePassword() {
  const r = new Uint32Array(5);
  crypto.getRandomValues(r);
  const words = [...r.slice(0, 4)].map((n) => WORDS[n % WORDS.length]);
  return `${words.join('-')}-${String(10 + (r[4] % 90))}`;
}

function openReset(u) {
  if (!u || !canReset(u)) return;
  modal?.destroy();
  modal = new Modal({
    id: 'us-reset', title: `Reset password · ${u.name}`, size: 'md', showFooter: false,
    content: `
      <form id="us-reset-form" class="space-y-5" novalidate>
        <div class="flex items-center gap-3 rounded-2xl bg-gray-50 dark:bg-gray-800/60 p-3">
          ${avatar(u, 'h-11 w-11', 'text-sm')}
          <div class="min-w-0"><p class="text-sm font-bold text-gray-900 dark:text-white truncate">${escapeHtml(u.name)}${u.is_me ? ' <span class="text-xs font-semibold text-primary-600">(you)</span>' : ''}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(u.email)}${u.active ? '' : ' · <span class="font-semibold text-amber-600">archived — they still can’t sign in until restored</span>'}</p></div>
        </div>

        <div class="grid grid-cols-2 gap-2" role="radiogroup" aria-label="How to reset">
          ${[['set', '🔑', 'Set a new password', 'You give it to them'], ['link', '✉️', 'Email a reset link', data.can_email ? 'They choose their own' : 'Email isn’t set up']].map(([v, i, t, s]) => `
            <label class="${v === 'link' && !data.can_email ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}">
              <input type="radio" name="how" value="${v}" ${v === 'set' ? 'checked' : ''} ${v === 'link' && !data.can_email ? 'disabled' : ''} class="peer sr-only">
              <span class="flex h-full flex-col gap-0.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 px-3 py-2.5 transition-colors peer-checked:border-amber-400 peer-checked:bg-amber-50 dark:peer-checked:bg-amber-950/30">
                <span class="text-sm font-bold text-gray-900 dark:text-white">${i} ${t}</span><span class="text-xs text-gray-500 dark:text-gray-400">${s}</span></span>
            </label>`).join('')}
        </div>

        <div data-set>
          ${formSection(TONE.amber, '🔑', 'New password', 'A strong one is suggested — change it if you like. At least 8 characters.', `
            <label for="us-new-pw" class="${kitLabel}">Password</label>
            <div class="flex gap-2">
              <input id="us-new-pw" name="password" type="text" autocomplete="new-password" spellcheck="false" value="${escapeHtml(generatePassword())}" class="${kitInput} font-mono">
              <button type="button" data-gen title="Suggest another" aria-label="Suggest another password" class="flex-shrink-0 px-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.refresh)}</button>
              <button type="button" data-show title="Show / hide" aria-label="Show or hide the password" class="flex-shrink-0 px-3 rounded-xl border border-gray-300 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.eye)}</button>
            </div>
            <label class="mt-4 flex items-start gap-2.5 cursor-pointer">
              <input type="checkbox" name="sign_out" checked class="mt-0.5 rounded border-gray-300 text-amber-600 focus:ring-amber-500">
              <span class="text-sm text-gray-700 dark:text-gray-200"><strong>Sign them out everywhere</strong> — any device still signed in with the old password has to sign in again.</span>
            </label>`)}
        </div>
        <div data-link class="hidden">
          ${formSection(TONE.sky, '✉️', 'Reset link', '', `<p class="text-sm text-gray-700 dark:text-gray-200">We’ll email <strong>${escapeHtml(u.email)}</strong> a link to choose a new password. It works for 60 minutes; their current password keeps working until they use it.</p>`)}
        </div>

        <div class="api-message space-y-2"></div>
        <div class="flex justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-cancel class="${kitGhost}">Cancel</button>
          <button type="submit" class="${kitSubmit} min-w-[9rem]">Reset password</button>
        </div>
      </form>`,
  });
  modal.open();

  const form = document.getElementById('us-reset-form');
  const pw = form.querySelector('[name="password"]');
  const submitBtn = form.querySelector('button[type="submit"]');
  const how = () => form.querySelector('[name="how"]:checked').value;
  form.addEventListener('change', (e) => {
    if (e.target.name !== 'how') return;
    form.querySelector('[data-set]').classList.toggle('hidden', how() !== 'set');
    form.querySelector('[data-link]').classList.toggle('hidden', how() !== 'link');
    submitBtn.textContent = how() === 'set' ? 'Reset password' : 'Send the link';
  });
  form.addEventListener('click', (e) => {
    if (e.target.closest('[data-gen]')) { pw.value = generatePassword(); pw.type = 'text'; return; }
    if (e.target.closest('[data-show]')) { pw.type = pw.type === 'password' ? 'text' : 'password'; return; }
    if (e.target.closest('[data-cancel]')) modal.close();
  });
  setTimeout(() => pw.select(), 50);

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = form.querySelector('.api-message');
    msg.innerHTML = '';
    const set = how() === 'set';
    if (set && pw.value.trim().length < 8) {
      msg.innerHTML = '<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">The password must be at least 8 characters.</p>';
      pw.focus();
      return;
    }
    submitBtn.disabled = true;
    try {
      const body = set
        ? { action: 'reset-password', id: u.id, password: pw.value.trim(), sign_out: form.querySelector('[name="sign_out"]').checked }
        : { action: 'send-reset-link', id: u.id };
      const res = await fetch(`${base()}api/users`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
      if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Could not reset the password.'), { messages: json.messages });
      if (set) showResetDone(u, body.password, json); else { modal.close(); showToast(json.messages?.[0] || 'Link sent.', 'success'); }
    } catch (err) {
      msg.innerHTML = (err.messages || [err.message]).map((m) => `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');
    } finally { submitBtn.disabled = false; }
  });
}

/** The new password, once, with Copy — to pass on to them. */
function showResetDone(u, password, json) {
  modal?.destroy();
  modal = new Modal({
    id: 'us-reset-done', title: 'Password reset', size: 'md', showFooter: false,
    content: `
      <div class="space-y-5">
        <div class="rounded-2xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 p-4">
          <p class="text-sm font-bold text-emerald-800 dark:text-emerald-200">✓ ${escapeHtml(json.messages?.[0] || 'Password reset.')}</p>
          <p class="text-xs text-emerald-700/80 dark:text-emerald-300/80 mt-1">${json.signed_out ? `Signed out of ${plural(json.signed_out, 'other session')}.` : 'Nobody else was signed in to that account.'}</p>
        </div>
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">Their new password</p>
          <div class="flex gap-2">
            <code data-pw class="flex-1 min-w-0 break-all rounded-xl bg-gray-900 text-amber-300 dark:bg-black px-4 py-3 text-base font-bold tracking-wide">${escapeHtml(password)}</code>
            <button type="button" data-copy class="flex-shrink-0 inline-flex items-center gap-1.5 px-4 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold">${svg(ICON.copy)} Copy</button>
          </div>
          <p class="text-xs text-gray-500 dark:text-gray-400 mt-2">Give it to ${escapeHtml(u.first_name || u.name)} in person or by message. They can change it under Profile once they’ve signed in. It isn’t shown again.</p>
        </div>
        <div class="flex justify-end pt-4 border-t border-gray-100 dark:border-gray-800"><button type="button" data-close class="${kitSubmit}">Done</button></div>
      </div>`,
  });
  modal.open();
  const root = document.getElementById('us-reset-done');
  root.querySelector('[data-copy]').addEventListener('click', async (e) => {
    const b = e.currentTarget;
    try { await navigator.clipboard.writeText(password); b.innerHTML = `${svg(ICON.copy)} Copied`; showToast('Copied.', 'success'); } catch { showToast('Select it and copy it by hand.', 'error'); }
  });
  root.querySelector('[data-close]').addEventListener('click', () => modal.close());
}

// ------------------------------------------------------------
// Profile photo (admins, for anyone — api/avatar-upload|delete ?user=)
// ------------------------------------------------------------

function changePhoto(u) {
  if (!u || !canReset(u)) return;
  modal?.close();
  createUploadHandler(`${base()}api/avatar-upload?user=${encodeURIComponent(u.id)}`, 'avatar', async (files) => {
    // Your own photo also lives in the header
    const fileName = files?.[0]?.url?.split('/').pop();
    if (u.is_me && fileName) updateHeaderAvatar(fileName);
    showToast(`${u.first_name || u.name}’s photo has been updated.`, 'success');
    await reload();
    openProfile(u.id);
  }, 1, true, { single: true, maxFiles: 1 });
}

async function removePhoto(u) {
  if (!u || !canReset(u)) return;
  if (!(await confirmDialog(`Remove <strong>${escapeHtml(u.name)}</strong>’s profile photo? Their initials show instead.`, 'Remove', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    const res = await fetch(`${base()}api/avatar-delete?user=${encodeURIComponent(u.id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ user: u.id }) });
    const json = await res.json().catch(() => ({ success: false }));
    if (!json.success) throw new Error(json.message || json.messages?.[0] || 'Could not remove the photo.');
    if (u.is_me) updateHeaderAvatar(null);
    showToast('Photo removed.', 'success');
    await reload();
    openProfile(u.id);
  } catch (err) { showToast(err.message, 'error'); }
}
