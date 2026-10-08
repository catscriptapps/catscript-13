// /resources/js/pages/customers-page.js
//
// Customers: the whole directory (with each customer's billing picture) lives
// in memory, seeded from #customers-data. render() draws the photo hero with
// the business numbers and top customers, then the filtered / sorted cards or
// list. The profile (contact actions, map, invoice history, logo) and the
// add / edit form are modals; every write returns the fresh directory, so
// everything on the page updates on the spot.
//
// Listeners are delegated from #customers-page, which the SPA router
// replaces on each visit.

import { Modal } from '../factories/modal-factory.js';
import { createUploadHandler } from '../modals/upload-modal.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { formatCanadaPostal } from '../utils/postal-formatter.js';
import { guestBusiness } from '../utils/business/guest-store.js';
import { TONE, formSection, identityCard, bumpAvatar, kitInput, kitLabel, kitSubmit, kitGhost } from '../forms/form-kit.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/customers`;
const HERO_SLIDE_MS = 8 * 1000;

/** Initials avatars: a stable colour per customer name (full class strings for Tailwind). */
const AVATARS = [
  'from-orange-400 to-rose-500', 'from-sky-400 to-indigo-500', 'from-emerald-400 to-teal-600', 'from-violet-400 to-fuchsia-500',
  'from-amber-400 to-orange-500', 'from-cyan-400 to-sky-600', 'from-lime-400 to-emerald-500', 'from-pink-400 to-rose-500',
];
/** invoice_statuses.status_color -> chip classes */
const STATUS = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  orange: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

let data = { customers: [], countries: [], regions: [], year: new Date().getFullYear() };
let state = { q: '', filter: 'active', sort: 'name', layout: 'cards' };
let modal = null;
let heroTimer = null;
let mode = 'account';
const isGuest = () => mode === 'guest';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const money = (n) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: n >= 1000 ? 0 : 2 }).format(n || 0);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const byId = (id) => data.customers.find((c) => c.id === id);
const place = (c) => [c.city, c.region_code || c.region].filter(Boolean).join(', ');
const websiteUrl = (w) => (w ? (/^https?:\/\//i.test(w) ? w : `https://${w}`) : '');
const mapUrl = (c) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([c.address, c.city, c.region, c.postal, c.country].filter(Boolean).join(', '))}`;
const telUrl = (p) => `tel:${p.replace(/[^\d+]/g, '')}`;
const shortDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  phone: 'M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z',
  globe: 'M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9',
  pin: 'M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z M15 11a3 3 0 11-6 0 3 3 0 016 0z',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  camera: 'M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z',
};

function avatar(c, size = 'h-12 w-12', text = 'text-base') {
  return c.logo
    ? `<img src="${escapeHtml(c.logo)}" alt="" class="${size} flex-shrink-0 rounded-2xl object-cover bg-white ring-1 ring-black/5">`
    : `<span class="${size} flex-shrink-0 rounded-2xl bg-gradient-to-br ${AVATARS[hash(c.name) % AVATARS.length]} flex items-center justify-center ${text} font-bold text-white shadow-sm">${escapeHtml(initials(c.name))}</span>`;
}

async function post(body) {
  if (isGuest()) {
    const json = guestBusiness.handleCustomers(body);
    if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
    return json;
  }
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}

function adopt(json) {
  ['customers', 'countries', 'regions', 'year'].forEach((k) => { if (json[k] !== undefined) data[k] = json[k]; });
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('customers-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('customers-data')?.textContent || '{}') }; } catch { /* defaults */ }
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  if (isGuest()) {
    guestBusiness.setup({ countries: data.countries, regions: data.regions });
    adopt(guestBusiness.customersState());
  }
  state = { q: '', filter: 'active', sort: 'name', layout: 'cards' };
  try { state.layout = localStorage.getItem('catscript.customers.layout') === 'list' ? 'list' : 'cards'; } catch { /* default */ }

  page.addEventListener('click', onClick);
  const search = document.getElementById('cu-search');
  search?.addEventListener('input', debounce(() => { state.q = search.value.trim().toLowerCase(); renderBody(); }, 150));

  render();
  startHeroSlides();
}

function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll('#customers-page [data-hero-slides] .hero-slide')];
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

function render() {
  document.querySelectorAll('#customers-page [data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.filter === state.filter)));
  document.querySelectorAll('#customers-page [data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sort === state.sort)));
  document.querySelectorAll('#customers-page [data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === state.layout)));
  renderHero();
  renderBody();
}

function renderHero() {
  const el = document.getElementById('cu-hero');
  if (!el) return;
  const all = data.customers;
  const active = all.filter((c) => c.active);
  const billed = all.reduce((s, c) => s + c.billing.billed, 0);
  const owing = all.reduce((s, c) => s + c.billing.outstanding, 0);
  const openN = all.reduce((s, c) => s + c.billing.open, 0);
  const newThisYear = all.filter((c) => c.since && c.since.startsWith(String(data.year))).length;
  const top = [...all].filter((c) => c.billing.billed > 0).sort((a, b) => b.billing.billed - a.billing.billed).slice(0, 5);
  const max = top[0]?.billing.billed || 1;

  const tile = (value, lbl, note, accent = 'text-white') => `
    <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-4 py-3.5 min-w-0">
      <span class="block text-2xl sm:text-3xl font-bold leading-none ${accent} truncate">${value}</span>
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">${lbl}</span>
      ${note ? `<span class="block text-[11px] text-white/60 mt-0.5 truncate">${note}</span>` : ''}
    </div>`;

  el.innerHTML = `
    <div class="grid gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3 min-w-0">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">Business · Customers</span>
        <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">Your customers</h1>
        <p class="mt-2 text-base text-secondary-50">${plural(active.length, 'active customer')}${all.length !== active.length ? ` · ${all.length - active.length} archived` : ''} — everyone you do business with, and what they've been billed.</p>
        <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${tile(active.length, 'Active', `of ${all.length}`)}
          ${tile(money(billed), 'Billed', 'all time')}
          ${tile(money(owing), 'Outstanding', openN ? plural(openN, 'open invoice') : 'all paid up', owing > 0 ? 'text-amber-300' : 'text-emerald-300')}
          ${tile(newThisYear, `New in ${data.year}`, '')}
        </div>
      </div>
      <div class="lg:col-span-2 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-4">
        <p class="text-xs font-bold uppercase tracking-wider text-secondary-200 mb-3">Top customers</p>
        ${top.length ? `<div class="space-y-2.5">${top.map((c, i) => `
          <button type="button" data-open="${escapeHtml(c.id)}" class="w-full flex items-center gap-3 text-left group">
            <span class="w-4 text-xs font-bold text-white/50">${i + 1}</span>
            ${avatar(c, 'h-8 w-8', 'text-xs')}
            <span class="min-w-0 flex-1">
              <span class="flex justify-between gap-2 text-sm"><span class="font-semibold truncate group-hover:underline">${escapeHtml(c.name)}</span><span class="text-white/70 flex-shrink-0">${money(c.billing.billed)}</span></span>
              <span class="mt-1 block h-1.5 rounded-full bg-white/10 overflow-hidden"><span class="block h-full rounded-full bg-gradient-to-r from-primary-400 to-amber-300" style="width: ${Math.max(4, Math.round((c.billing.billed / max) * 100))}%"></span></span>
            </span>
          </button>`).join('')}</div>`
        : '<p class="text-sm text-white/60">Once invoices are sent, your biggest customers show up here.</p>'}
      </div>
    </div>`;
}

function visible() {
  const q = state.q;
  let list = data.customers.filter((c) => {
    if (state.filter === 'active' && !c.active) return false;
    if (state.filter === 'archived' && c.active) return false;
    if (state.filter === 'open' && !(c.billing.outstanding > 0 || c.billing.open > 0)) return false;
    if (!q) return true;
    return [c.name, c.email, c.phone, c.city, c.region, c.address, c.postal, c.website].join(' ').toLowerCase().includes(q)
      || (q.replace(/\D/g, '') && c.phone.replace(/\D/g, '').includes(q.replace(/\D/g, '')));
  });
  if (state.sort === 'billed') list = [...list].sort((a, b) => b.billing.billed - a.billing.billed || a.name.localeCompare(b.name));
  else if (state.sort === 'newest') list = [...list].sort((a, b) => (b.since || '').localeCompare(a.since || '') || a.name.localeCompare(b.name));
  else list = [...list].sort((a, b) => a.name.localeCompare(b.name));
  return list;
}

function renderBody() {
  const body = document.getElementById('cu-body');
  if (!body) return;
  const list = visible();

  if (!data.customers.length) {
    body.innerHTML = empty('No customers yet', 'Add your first customer to start building the directory.', true);
    return;
  }
  if (!list.length) {
    body.innerHTML = empty(state.q ? 'No customers match' : 'Nothing here', state.q ? 'Try a different name, email, phone or city.' : 'Try another filter.');
    return;
  }

  const count = `<p class="mb-3 text-xs font-semibold text-gray-500 dark:text-gray-400">${plural(list.length, 'customer')}</p>`;
  body.innerHTML = count + (state.layout === 'list' ? listHtml(list) : `<div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">${list.map(cardHtml).join('')}</div>`);
}

const empty = (title, text, add = false) => `
  <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 px-6 text-center shadow-sm">
    <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-500 mb-4">${svg('M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z', 'h-7 w-7')}</span>
    <p class="text-base font-semibold text-gray-800 dark:text-gray-100">${title}</p>
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${text}</p>
    ${add ? '<button type="button" data-act="add" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">Add customer</button>' : ''}
  </div>`;

function quickActions(c, cls = '') {
  const btn = 'h-9 w-9 inline-flex items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-primary-50 hover:text-primary-600 dark:hover:bg-primary-950/40 dark:hover:text-primary-300 transition-colors';
  return `<div class="flex items-center gap-1.5 ${cls}">
    ${c.email ? `<a href="mailto:${escapeHtml(c.email)}" class="${btn}" title="Email ${escapeHtml(c.email)}" aria-label="Email">${svg(ICON.mail)}</a>` : ''}
    ${c.phone ? `<a href="${escapeHtml(telUrl(c.phone))}" class="${btn}" title="Call ${escapeHtml(c.phone)}" aria-label="Call">${svg(ICON.phone)}</a>` : ''}
    ${c.website ? `<a href="${escapeHtml(websiteUrl(c.website))}" target="_blank" rel="noopener" class="${btn}" title="${escapeHtml(c.website)}" aria-label="Website">${svg(ICON.globe)}</a>` : ''}
    ${c.address || c.city ? `<a href="${escapeHtml(mapUrl(c))}" target="_blank" rel="noopener" class="${btn}" title="Show on a map" aria-label="Map">${svg(ICON.pin)}</a>` : ''}
  </div>`;
}

function cardHtml(c) {
  const b = c.billing;
  return `
    <div data-open="${escapeHtml(c.id)}" role="button" tabindex="0"
      class="group relative cursor-pointer rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-5 shadow-sm hover:shadow-lg hover:-translate-y-0.5 hover:border-primary-200 dark:hover:border-primary-900 transition-all ${c.active ? '' : 'opacity-70'}">
      <div class="flex items-start gap-4">
        ${avatar(c)}
        <div class="min-w-0 flex-1">
          <p class="text-base font-bold text-gray-900 dark:text-white truncate group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">${escapeHtml(c.name)}</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(place(c) || c.email || 'No address yet')}</p>
          ${c.active ? '' : '<span class="mt-1 inline-block rounded-full bg-gray-100 dark:bg-gray-800 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-500">Archived</span>'}
        </div>
      </div>
      <div class="mt-4 grid grid-cols-3 gap-2 text-center">
        <div class="rounded-xl bg-gray-50 dark:bg-gray-800/60 py-2"><span class="block text-sm font-bold text-gray-900 dark:text-white">${b.invoices}</span><span class="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Invoices</span></div>
        <div class="rounded-xl bg-gray-50 dark:bg-gray-800/60 py-2"><span class="block text-sm font-bold text-gray-900 dark:text-white">${money(b.billed)}</span><span class="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Billed</span></div>
        <div class="rounded-xl ${b.outstanding > 0 ? 'bg-amber-50 dark:bg-amber-950/30' : 'bg-gray-50 dark:bg-gray-800/60'} py-2"><span class="block text-sm font-bold ${b.outstanding > 0 ? 'text-amber-700 dark:text-amber-300' : 'text-gray-900 dark:text-white'}">${money(b.outstanding)}</span><span class="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">Owing</span></div>
      </div>
      <div class="mt-4 flex items-center justify-between gap-2">
        ${quickActions(c)}
        <span class="text-[11px] text-gray-400">${c.since ? `Since ${c.since.slice(0, 4)}` : ''}</span>
      </div>
    </div>`;
}

function listHtml(list) {
  return `
    <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div class="hidden md:grid grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_6rem_6rem_auto] gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        <span>Customer</span><span>Contact</span><span>Location</span><span class="text-right">Billed</span><span class="text-right">Owing</span><span class="w-[9.5rem]"></span>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        ${list.map((c) => `
          <div data-open="${escapeHtml(c.id)}" role="button" tabindex="0" class="grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.5fr)_minmax(0,1fr)_6rem_6rem_auto] gap-2 md:gap-4 items-center px-5 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${c.active ? '' : 'opacity-70'}">
            <span class="flex items-center gap-3 min-w-0">${avatar(c, 'h-9 w-9', 'text-xs')}<span class="min-w-0"><span class="block text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(c.name)}</span><span class="block text-[11px] text-gray-400">${plural(c.billing.invoices, 'invoice')}${c.active ? '' : ' · archived'}</span></span></span>
            <span class="min-w-0 text-xs text-gray-600 dark:text-gray-300"><span class="block truncate">${escapeHtml(c.email || '—')}</span><span class="block text-gray-400 truncate">${escapeHtml(c.phone || '')}</span></span>
            <span class="text-xs text-gray-600 dark:text-gray-300 truncate">${escapeHtml(place(c) || '—')}</span>
            <span class="text-sm font-semibold text-gray-900 dark:text-white md:text-right">${money(c.billing.billed)}</span>
            <span class="text-sm font-semibold md:text-right ${c.billing.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}">${money(c.billing.outstanding)}</span>
            ${quickActions(c, 'md:justify-end md:w-[9.5rem]')}
          </div>`).join('')}
      </div>
    </div>`;
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

async function onGuestClick(e) {
  if (e.target.closest('[data-export]')) {
    e.preventDefault();
    const url = URL.createObjectURL(new Blob([guestBusiness.csv()], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: 'customers.csv' }).click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  const sample = !!e.target.closest('#cu-guest-sample');
  const ok = await confirmDialog(sample ? 'Replace the demo customers and invoices with the sample book?' : 'Remove every demo customer and invoice and start empty?',
    sample ? 'Reload sample' : 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700');
  if (!ok) return;
  if (sample) guestBusiness.resetToSample(); else guestBusiness.clear();
  adopt(guestBusiness.customersState());
  render();
  showToast(sample ? 'Sample data reloaded.' : 'Starting empty.', 'success');
}

function onClick(e) {
  if (isGuest() && e.target.closest('[data-export], #cu-guest-sample, #cu-guest-clear')) { onGuestClick(e); return; }
  if (e.target.closest('a[href]')) return; // quick actions: let the link work

  const f = e.target.closest('[data-filter]');
  if (f) { state.filter = f.dataset.filter; render(); return; }
  const s = e.target.closest('[data-sort]');
  if (s) { state.sort = s.dataset.sort; render(); return; }
  const l = e.target.closest('[data-layout]');
  if (l) {
    state.layout = l.dataset.layout;
    try { localStorage.setItem('catscript.customers.layout', state.layout); } catch { /* per-browser */ }
    render();
    return;
  }
  if (e.target.closest('[data-act="add"]')) { openForm(null); return; }
  const open = e.target.closest('[data-open]');
  if (open) openProfile(open.dataset.open);
}

// ------------------------------------------------------------
// Profile
// ------------------------------------------------------------

function openProfile(id) {
  const c = byId(id);
  if (!c) return;
  modal?.destroy();
  const b = c.billing;
  const row = (icon, label, value, href = '', copy = '') => value ? `
    <div class="flex items-center gap-3 py-2.5">
      <span class="h-9 w-9 flex-shrink-0 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-500 flex items-center justify-center">${svg(icon)}</span>
      <span class="min-w-0 flex-1"><span class="block text-[11px] font-semibold uppercase tracking-wider text-gray-400">${label}</span>
        ${href ? `<a href="${escapeHtml(href)}" ${href.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} class="block text-sm font-semibold text-primary-700 dark:text-primary-300 hover:underline truncate">${escapeHtml(value)}</a>` : `<span class="block text-sm font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(value)}</span>`}</span>
      ${copy ? `<button type="button" data-copy="${escapeHtml(copy)}" title="Copy" aria-label="Copy ${label}" class="p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40">${svg(ICON.copy)}</button>` : ''}
    </div>` : '';
  const addressLine = [c.address, [c.city, c.region_code || c.region].filter(Boolean).join(', '), c.postal, c.country].filter(Boolean).join(' · ');

  modal = new Modal({
    id: 'cu-profile',
    title: c.name,
    size: 'lg',
    showFooter: false,
    content: `
      <div class="space-y-6" id="cu-profile-body">
        <div class="flex flex-col sm:flex-row sm:items-center gap-4">
          <div class="relative group w-fit">
            ${avatar(c, 'h-20 w-20', 'text-2xl')}
            <button type="button" data-logo title="Change logo" class="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-white dark:bg-gray-800 shadow ring-1 ring-black/10 text-gray-600 dark:text-gray-300 flex items-center justify-center hover:text-primary-600">${svg(ICON.camera)}</button>
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm text-gray-500 dark:text-gray-400">${escapeHtml(place(c) || 'No address yet')}${c.since ? ` · customer since ${shortDate(c.since)}` : ''}</p>
            <p class="mt-1"><span class="rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${c.active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-800'}">${c.active ? 'Active' : 'Archived'}</span></p>
          </div>
          <div class="flex flex-wrap gap-2">
            <button type="button" data-edit class="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm">Edit</button>
            <button type="button" data-toggle-active class="px-4 py-2 rounded-xl border border-gray-300 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${c.active ? 'Archive' : 'Restore'}</button>
            ${b.invoices ? '' : '<button type="button" data-delete class="px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Delete</button>'}
          </div>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${[[b.invoices, 'Invoices', ''], [money(b.billed), 'Billed', ''], [money(b.outstanding), 'Outstanding', b.outstanding > 0 ? 'text-amber-600 dark:text-amber-400' : ''], [b.last ? shortDate(b.last) : '—', 'Last invoice', '']]
            .map(([v, lbl, cls]) => `<div class="rounded-2xl bg-gray-50 dark:bg-gray-800/60 px-4 py-3"><span class="block text-lg font-bold text-gray-900 dark:text-white ${cls} truncate">${v}</span><span class="block text-[11px] font-semibold uppercase tracking-wider text-gray-400 mt-0.5">${lbl}</span></div>`).join('')}
        </div>

        <div class="grid md:grid-cols-2 gap-6">
          <div class="divide-y divide-gray-100 dark:divide-gray-800">
            ${row(ICON.mail, 'Email', c.email, c.email ? `mailto:${c.email}` : '', c.email)}
            ${row(ICON.phone, 'Phone', c.phone, c.phone ? telUrl(c.phone) : '', c.phone)}
            ${row(ICON.globe, 'Website', c.website, websiteUrl(c.website))}
            ${row(ICON.pin, 'Address', addressLine, addressLine ? mapUrl(c) : '', addressLine)}
            ${!c.email && !c.phone && !c.website && !addressLine ? '<p class="py-4 text-sm text-gray-500">No contact details yet — add them with Edit.</p>' : ''}
          </div>
          <div>
            <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Invoices</p>
            <div data-invoices class="space-y-2"><p class="text-sm text-gray-400">Loading…</p></div>
          </div>
        </div>
      </div>`,
  });
  modal.open();

  const root = document.getElementById('cu-profile');
  loadInvoices(c.id, root.querySelector('[data-invoices]'));

  root.addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]');
    if (copy) {
      try { await navigator.clipboard.writeText(copy.dataset.copy); showToast('Copied.', 'success'); } catch { showToast('Could not copy.', 'error'); }
      return;
    }
    if (e.target.closest('[data-edit]')) { openForm(c); return; }
    if (e.target.closest('[data-logo]')) { changeLogo(c); return; }
    if (e.target.closest('[data-toggle-active]')) {
      try {
        const json = await post({ action: c.active ? 'archive' : 'restore', id: c.id });
        adopt(json); render(); showToast(json.messages?.[0] || 'Saved.', 'success'); openProfile(c.id);
      } catch (err) { showToast(err.message, 'error'); }
      return;
    }
    if (e.target.closest('[data-delete]')) {
      if (!(await confirmDialog(`Delete <strong>${escapeHtml(c.name)}</strong>? This can't be undone.`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      try {
        const json = await post({ action: 'delete', id: c.id });
        adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Deleted.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    }
  });
}

async function loadInvoices(id, el) {
  try {
    const json = isGuest()
      ? { success: true, invoices: guestBusiness.customerInvoices(id) }
      : await (await fetch(`${api()}?invoices=${encodeURIComponent(id)}`)).json();
    const list = json.success ? json.invoices : [];
    if (!el.isConnected) return;
    const canOpen = !!data.can_invoices;
    el.innerHTML = list.length ? list.map((i) => `
      <${canOpen ? `a href="${escapeHtml(`${base()}invoices?open=${encodeURIComponent(i.id)}`)}" data-partial` : 'div'} class="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 px-3 py-2.5 ${canOpen ? 'hover:border-primary-300 dark:hover:border-primary-800 transition-colors' : ''}">
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-gray-800 dark:text-gray-100 truncate">${escapeHtml(i.title || i.number)}</p>
          <p class="text-[11px] text-gray-500 dark:text-gray-400">${escapeHtml(i.number)}${i.due ? ` · due ${shortDate(i.due)}` : ''}</p>
        </div>
        <div class="text-right flex-shrink-0">
          <p class="text-sm font-bold text-gray-900 dark:text-white">${money(i.total)}</p>
          <span class="inline-block mt-0.5 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[i.color] || STATUS.gray}">${escapeHtml(i.status)}</span>
        </div>
      </${canOpen ? 'a' : 'div'}>`).join('') : '<p class="rounded-xl bg-gray-50 dark:bg-gray-800/60 px-4 py-6 text-center text-sm text-gray-500 dark:text-gray-400">No invoices yet.</p>';
  } catch {
    if (el.isConnected) el.innerHTML = '<p class="text-sm text-red-600">Could not load the invoices.</p>';
  }
}

function changeLogo(c) {
  if (c.logo) {
    confirmDialog(`Replace or remove the logo for <strong>${escapeHtml(c.name)}</strong>?`, 'Upload a new one', 'Remove it', 'bg-primary-600 hover:bg-primary-700').then(async (upload) => {
      if (upload) { uploadLogo(c); return; }
      try { const json = await post({ action: 'remove-logo', id: c.id }); adopt(json); render(); openProfile(c.id); showToast('Logo removed.', 'success'); } catch (err) { showToast(err.message, 'error'); }
    });
    return;
  }
  uploadLogo(c);
}

/** Guest logos: resized in the browser and kept as a small data URL. */
function guestLogo(c) {
  const pick = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
  pick.addEventListener('change', async () => {
    const file = pick.files?.[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const r = Math.min(1, 300 / Math.max(bitmap.width, bitmap.height));
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * r), height: Math.round(bitmap.height * r) });
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      guestBusiness.setLogo(c.id, canvas.toDataURL('image/jpeg', 0.85));
      adopt(guestBusiness.customersState());
      render();
      openProfile(c.id);
      showToast('Logo updated.', 'success');
    } catch { showToast('That image could not be read.', 'error'); }
  });
  pick.click();
}

function uploadLogo(c) {
  if (isGuest()) { guestLogo(c); return; }
  createUploadHandler(`${base()}api/customer-logo/${encodeURIComponent(c.id)}`, 'logo', (files) => {
    const url = files?.[0]?.url;
    if (!url) return;
    const cur = byId(c.id);
    if (cur) cur.logo = url;
    render();
    openProfile(c.id);
    showToast('Logo updated.', 'success');
  }, 1, true, { single: true, maxFiles: 1, quality: { maxDim: 600, q: 0.9, targetKB: 200 } });
}

// ------------------------------------------------------------
// Form
// ------------------------------------------------------------

const input = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition';
const lbl = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5';

function formatPhone(raw) {
  const d = raw.replace(/\D/g, '');
  const n = d.length === 11 && d.startsWith('1') ? d.slice(1) : d;
  return n.length === 10 ? `(${n.slice(0, 3)}) ${n.slice(3, 6)}-${n.slice(6)}` : raw.trim();
}

/** Identity-card avatar (logo, or initials) and sub line for the form's live preview. */
const cardAvatar = (v) => (v.logo
  ? `<img src="${escapeHtml(v.logo)}" alt="" class="h-full w-full object-cover bg-white">`
  : escapeHtml(v.name ? initials(v.name) : '?'));
const cardSub = (v) => [v.email, v.phone, v.city].map((s) => (s || '').trim()).filter(Boolean).join(' · ');

function openForm(c) {
  const isEdit = !!c;
  const v = c || { name: '', email: '', phone: '', website: '', address: '', city: '', country_id: data.countries[0]?.id || null, region_id: null, postal: '' };
  modal?.destroy();
  modal = new Modal({
    id: 'cu-form-modal',
    title: isEdit ? `Edit ${c.name}` : 'Add a customer',
    size: 'lg',
    showFooter: false,
    content: `
      <form id="cu-form" class="space-y-5" novalidate>
        ${identityCard({
          avatar: cardAvatar(v),
          tag: isEdit ? 'Editing customer' : 'New customer',
          tagDot: isEdit ? 'bg-primary-300' : 'bg-emerald-300 animate-pulse',
          title: escapeHtml(v.name || 'Their company name'),
          sub: escapeHtml(cardSub(v) || 'Email · phone · city'),
          aside: isEdit && c.billing ? `<div class="hidden sm:block text-right flex-shrink-0">
              <p class="text-2xl font-bold">${money(c.billing.billed)}</p>
              <p class="text-[11px] font-semibold uppercase tracking-wider text-white/60">billed · ${plural(c.billing.invoices, 'invoice')}</p></div>` : '',
        })}

        ${formSection(TONE.orange, '🏢', 'Who they are', 'The name that goes on their invoices.', `
          <label for="cu-name" class="${kitLabel}">Customer or company name</label>
          <input id="cu-name" name="name" maxlength="255" value="${escapeHtml(v.name)}" placeholder="e.g. HomeWorks Advantage Inc." class="${kitInput}">`)}

        ${formSection(TONE.sky, '☎️', 'How to reach them', 'Invoices are emailed to this address.', `
          <div class="grid sm:grid-cols-2 gap-4">
            <div><label for="cu-email" class="${kitLabel}">Email</label><input id="cu-email" name="email" type="email" maxlength="255" value="${escapeHtml(v.email)}" placeholder="name@company.com" class="${kitInput}"></div>
            <div><label for="cu-phone" class="${kitLabel}">Phone</label><input id="cu-phone" name="phone" type="tel" maxlength="50" value="${escapeHtml(v.phone)}" placeholder="(705) 555-0123" class="${kitInput}"></div>
          </div>
          <div class="mt-4"><label for="cu-web" class="${kitLabel}">Website <span class="normal-case font-normal tracking-normal text-gray-400">(optional)</span></label><input id="cu-web" name="website" maxlength="255" value="${escapeHtml(v.website)}" placeholder="company.com" class="${kitInput}"></div>`)}

        ${formSection(TONE.green, '📍', 'Address', 'Printed on their invoices, and used for the map.', `
          <div><label for="cu-address" class="${kitLabel}">Street</label><input id="cu-address" name="address" maxlength="255" value="${escapeHtml(v.address)}" placeholder="11 Girdwood Drive" class="${kitInput}"></div>
          <div class="mt-4 grid sm:grid-cols-2 gap-4">
            <div><label for="cu-city" class="${kitLabel}">City</label><input id="cu-city" name="city" maxlength="255" value="${escapeHtml(v.city)}" placeholder="Barrie" class="${kitInput}"></div>
            <div><label for="cu-postal" class="${kitLabel}">Postal / ZIP code</label><input id="cu-postal" name="postal" maxlength="16" value="${escapeHtml(v.postal)}" placeholder="L4N 8P5" class="${kitInput}"></div>
          </div>
          <div class="mt-4 grid sm:grid-cols-2 gap-4">
            <div><label for="cu-country" class="${kitLabel}">Country</label>
              <select id="cu-country" name="country_id" class="${kitInput}"><option value="">—</option>${data.countries.map((co) => `<option value="${co.id}" ${co.id === v.country_id ? 'selected' : ''}>${escapeHtml(co.name)}</option>`).join('')}</select></div>
            <div><label for="cu-region" class="${kitLabel}">Province / State</label><select id="cu-region" name="region_id" class="${kitInput}"></select></div>
          </div>`)}

        <div class="api-message"></div>
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-cancel class="${kitGhost}">Cancel</button>
          <button type="submit" class="${kitSubmit} min-w-[9rem]">${isEdit ? 'Save changes' : 'Add customer'}</button>
        </div>
      </form>`,
  });
  modal.open();

  const form = document.getElementById('cu-form');
  const country = form.querySelector('[name="country_id"]');
  const region = form.querySelector('[name="region_id"]');
  const fillRegions = (selected) => {
    const list = data.regions.filter((r) => r.country_id === Number(country.value));
    region.innerHTML = `<option value="">—</option>${list.map((r) => `<option value="${r.id}" ${r.id === selected ? 'selected' : ''}>${escapeHtml(r.name)}</option>`).join('')}`;
  };
  fillRegions(v.region_id);
  country.addEventListener('change', () => fillRegions(null));
  setTimeout(() => form.querySelector('[name="name"]').focus(), 50);

  // Live identity card
  form.addEventListener('input', (e) => {
    const val = (n) => form.querySelector(`[name="${n}"]`).value;
    const now = { name: val('name').trim(), email: val('email'), phone: val('phone'), city: val('city'), logo: v.logo };
    form.querySelector('[data-preview-title]').textContent = now.name || 'Their company name';
    form.querySelector('[data-preview-sub]').textContent = cardSub(now) || 'Email · phone · city';
    if (e.target.name === 'name' && !v.logo) { form.querySelector('[data-preview-avatar]').innerHTML = cardAvatar(now); bumpAvatar(form); }
  });

  form.querySelector('[name="phone"]').addEventListener('blur', (e) => { e.target.value = formatPhone(e.target.value); });
  form.querySelector('[name="postal"]').addEventListener('blur', (e) => {
    const isCanada = (data.countries.find((co) => co.id === Number(country.value))?.name || '').toLowerCase() === 'canada';
    if (isCanada) e.target.value = formatCanadaPostal(e.target.value);
  });
  form.querySelector('[data-cancel]').addEventListener('click', () => (isEdit ? openProfile(c.id) : modal.close()));

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    form.querySelector('.api-message').innerHTML = '';
    try {
      const f = Object.fromEntries(new FormData(form).entries());
      const json = await post({ action: 'save', id: c?.id || '', ...f, country_id: Number(f.country_id) || 0, region_id: Number(f.region_id) || 0 });
      adopt(json);
      render();
      showToast(json.messages?.[0] || 'Saved.', 'success');
      if (json.saved) openProfile(json.saved); else modal.close();
    } catch (err) {
      form.querySelector('.api-message').innerHTML = (err.messages || [err.message]).map((m) =>
        `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');
    } finally { btn.disabled = false; }
  });
}
