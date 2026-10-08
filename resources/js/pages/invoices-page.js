// /resources/js/pages/invoices-page.js
//
// Invoices: every invoice summary lives in memory (seeded from
// #invoices-data). render() draws the photo hero (outstanding, overdue, paid
// this year, drafts and a 12-month chart), the status filter chips and the
// list. Opening an invoice loads its lines and payments into a paper-style
// view (PDF, email, status, duplicate, delete); the editor builds rich-text
// line items with totals that update as you type. Every write returns the
// fresh list, so the page updates on the spot.
//
// Line-item HTML is cleaned on the server (Src\Utils\RichText) both when it's
// saved and when it's sent back, so it's safe to render.

import { Modal } from '../factories/modal-factory.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { guestBusiness } from '../utils/business/guest-store.js';
import { TONE, formSection, identityCard, bumpAvatar, kitInput, kitLabel, kitSubmit, kitGhost } from '../forms/form-kit.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/invoices`;
const HERO_SLIDE_MS = 8 * 1000;

const STATUS = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  orange: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};
const AVATARS = ['from-orange-400 to-rose-500', 'from-sky-400 to-indigo-500', 'from-emerald-400 to-teal-600', 'from-violet-400 to-fuchsia-500', 'from-amber-400 to-orange-500', 'from-cyan-400 to-sky-600', 'from-lime-400 to-emerald-500', 'from-pink-400 to-rose-500'];

let data = { invoices: [], customers: [], statuses: [], payment_terms: [], delivery_terms: [], currencies: ['CAD', 'USD'], today: '', can_email: false };
let state = { q: '', filter: 'all', sort: 'newest' };
let modal = null;
let heroTimer = null;
let mode = 'account';
const isGuest = () => mode === 'guest';

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const money = (n, cur = 'CAD', compact = false) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: cur, maximumFractionDigits: compact && Math.abs(n) >= 1000 ? 0 : 2 }).format(n || 0);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const hash = (s) => [...s].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) >>> 0, 7);
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';
const customer = (id) => data.customers.find((c) => c.id === id);
const addDays = (n) => { const d = new Date(`${data.today}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const round2 = (n) => Math.round(n * 100) / 100;
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  plus: 'M12 4v16m8-8H4',
  pdf: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  copy: 'M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  up: 'M5 15l7-7 7 7', down: 'M19 9l-7 7-7-7', x: 'M6 18L18 6M6 6l12 12',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
};

function avatar(id, name, size = 'h-9 w-9', text = 'text-xs') {
  const c = customer(id);
  return c?.logo
    ? `<img src="${escapeHtml(c.logo)}" alt="" class="${size} flex-shrink-0 rounded-xl object-cover bg-white ring-1 ring-black/5">`
    : `<span class="${size} flex-shrink-0 rounded-xl bg-gradient-to-br ${AVATARS[hash(name) % AVATARS.length]} flex items-center justify-center ${text} font-bold text-white">${escapeHtml(initials(name))}</span>`;
}
const pill = (s) => `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[s.color] || STATUS.gray}">${escapeHtml(s.name)}</span>`;
const overduePill = '<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white">Overdue</span>';

async function post(body) {
  if (isGuest()) {
    const json = guestBusiness.handleInvoices(body);
    if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
    return json;
  }
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}
function adopt(json) {
  ['invoices', 'customers', 'statuses', 'payment_terms', 'delivery_terms', 'currencies', 'next_number', 'today', 'can_email'].forEach((k) => { if (json[k] !== undefined) data[k] = json[k]; });
}
const errorsHtml = (err) => (err.messages || [err.message]).map((m) => `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('invoices-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('invoices-data')?.textContent || '{}') }; } catch { /* defaults */ }
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  if (isGuest()) {
    guestBusiness.setup({ statuses: data.statuses, payment_terms: data.payment_terms, delivery_terms: data.delivery_terms, currencies: data.currencies });
    adopt(guestBusiness.invoicesState());
  }
  state = { q: '', filter: 'all', sort: 'newest' };

  page.addEventListener('click', onClick);
  const search = document.getElementById('in-search');
  search?.addEventListener('input', debounce(() => { state.q = search.value.trim().toLowerCase(); renderList(); }, 150));
  document.getElementById('in-sort')?.addEventListener('change', (e) => { state.sort = e.target.value; renderList(); });

  render();
  startHeroSlides();

  // Deep link: /invoices?open={id} (e.g. from a customer's profile)
  const open = new URLSearchParams(window.location.search).get('open');
  if (open && data.invoices.some((i) => i.id === open)) openInvoice(open);
}

function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll('#invoices-page [data-hero-slides] .hero-slide')];
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
  const el = document.getElementById('in-hero');
  if (!el) return;
  const inv = data.invoices;
  const year = (data.today || '').slice(0, 4);
  const owing = inv.filter((i) => i.open && i.status.id !== 1);
  const overdue = inv.filter((i) => i.overdue || (i.open && i.status.id === 5));
  const paidYear = inv.filter((i) => (i.created || '').startsWith(year)).reduce((s, i) => s + (i.status.id === 4 ? i.total : i.paid), 0);
  const drafts = inv.filter((i) => i.status.id === 1);

  // Billed per month, last 12 months (cancelled excluded)
  const months = [];
  const now = new Date(`${data.today}T00:00:00`);
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-CA', { month: 'short' }), total: 0 });
  }
  inv.forEach((i) => { const m = months.find((x) => x.key === (i.created || '').slice(0, 7)); if (m && i.status.id !== 6) m.total += i.total; });
  const max = Math.max(1, ...months.map((m) => m.total));
  const yearTotal = months.reduce((s, m) => s + m.total, 0);

  const tile = (value, label, note, accent = 'text-white') => `
    <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-4 py-3.5 min-w-0">
      <span class="block text-2xl sm:text-3xl font-bold leading-none ${accent} truncate">${value}</span>
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">${label}</span>
      ${note ? `<span class="block text-[11px] text-white/60 mt-0.5 truncate">${note}</span>` : ''}
    </div>`;

  el.innerHTML = `
    <div class="grid gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3 min-w-0">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">Business · Invoices</span>
        <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">${owing.length ? `${money(owing.reduce((s, i) => s + i.balance, 0), 'CAD', true)} to collect` : 'All paid up'}</h1>
        <p class="mt-2 text-base text-secondary-50">${plural(inv.length, 'invoice')} · next number <strong>${escapeHtml(data.next_number || '')}</strong></p>
        <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${tile(owing.length, 'Owing', owing.length ? money(owing.reduce((s, i) => s + i.balance, 0), 'CAD', true) : 'nothing open', owing.length ? 'text-amber-300' : 'text-emerald-300')}
          ${tile(overdue.length, 'Overdue', overdue.length ? money(overdue.reduce((s, i) => s + i.balance, 0), 'CAD', true) : 'none — nice', overdue.length ? 'text-red-300' : 'text-white')}
          ${tile(money(paidYear, 'CAD', true), `Paid in ${year}`, '')}
          ${tile(drafts.length, 'Drafts', drafts.length ? 'not sent yet' : '')}
        </div>
      </div>
      <div class="lg:col-span-2 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-4">
        <div class="flex items-baseline justify-between mb-3">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary-200">Billed · last 12 months</p>
          <p class="text-sm font-semibold">${money(yearTotal, 'CAD', true)}</p>
        </div>
        <div class="flex items-end gap-1.5 h-28" role="img" aria-label="Billed per month for the last 12 months">
          ${months.map((m) => `
            <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end" title="${m.label}: ${money(m.total)}">
              <div class="w-full rounded-t-md ${m.total ? 'bg-gradient-to-t from-primary-500 to-amber-300' : 'bg-white/10'}" style="height: ${m.total ? Math.max(6, Math.round((m.total / max) * 100)) : 4}%"></div>
              <span class="text-[9px] text-white/60">${m.label.slice(0, 1)}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

const FILTERS = [
  ['all', 'All', () => true],
  ['owing', 'Owing', (i) => i.open && i.status.id !== 1],
  ['overdue', 'Overdue', (i) => i.overdue || (i.open && i.status.id === 5)],
  ['1', 'Drafts', (i) => i.status.id === 1],
  ['2', 'Sent', (i) => i.status.id === 2],
  ['3', 'Partially paid', (i) => i.status.id === 3],
  ['4', 'Paid', (i) => i.status.id === 4],
  ['6', 'Cancelled', (i) => i.status.id === 6],
];

function renderFilters() {
  const el = document.getElementById('in-filters');
  if (!el) return;
  el.innerHTML = FILTERS.map(([key, label, fn]) => {
    const n = data.invoices.filter(fn).length;
    const on = state.filter === key;
    return `<button type="button" data-filter="${key}" aria-pressed="${on}" class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${on ? 'bg-secondary-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300'}">
      ${label} <span class="text-xs ${on ? 'opacity-70' : 'text-gray-400'}">${n}</span></button>`;
  }).join('');
}

function visible() {
  const fn = (FILTERS.find(([k]) => k === state.filter) || FILTERS[0])[2];
  const q = state.q;
  let list = data.invoices.filter((i) => fn(i) && (!q || `${i.number} ${i.customer} ${i.title}`.toLowerCase().includes(q)));
  const by = {
    newest: (a, b) => (b.created || '').localeCompare(a.created || '') || b.number.localeCompare(a.number),
    due: (a, b) => (a.due || '9999').localeCompare(b.due || '9999'),
    amount: (a, b) => b.total - a.total,
    balance: (a, b) => b.balance - a.balance,
  }[state.sort];
  return [...list].sort(by);
}

function renderList() {
  const body = document.getElementById('in-body');
  if (!body) return;
  const list = visible();
  if (!data.invoices.length) {
    body.innerHTML = emptyHtml('No invoices yet', 'Create your first invoice — it gets the next number automatically.', true);
    return;
  }
  if (!list.length) { body.innerHTML = emptyHtml('Nothing here', state.q ? 'Try a different number, customer or title.' : 'No invoices with that status.'); return; }

  body.innerHTML = `
    <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div class="hidden lg:grid grid-cols-[9rem_minmax(0,2.2fr)_7rem_7rem_7rem_7rem_8rem] gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        <span>Invoice</span><span>Customer · project</span><span>Issued</span><span>Due</span><span class="text-right">Total</span><span class="text-right">Balance</span><span class="text-right">Status</span>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        ${list.map((i) => `
          <div data-open="${escapeHtml(i.id)}" role="button" tabindex="0"
            class="grid grid-cols-2 lg:grid-cols-[9rem_minmax(0,2.2fr)_7rem_7rem_7rem_7rem_8rem] gap-x-4 gap-y-1 items-center px-5 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <span class="text-sm font-bold text-gray-900 dark:text-white font-mono tracking-tight">${escapeHtml(i.number)}</span>
            <span class="col-span-2 lg:col-span-1 row-start-2 lg:row-start-auto flex items-center gap-3 min-w-0">${avatar(i.customer_id, i.customer)}
              <span class="min-w-0"><span class="block text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(i.customer)}</span><span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(i.title)}</span></span></span>
            <span class="hidden lg:block text-xs text-gray-600 dark:text-gray-300">${shortDate(i.created)}</span>
            <span class="hidden lg:block text-xs ${i.overdue ? 'text-red-600 font-semibold' : 'text-gray-600 dark:text-gray-300'}">${i.due ? shortDate(i.due) : 'On receipt'}</span>
            <span class="hidden lg:block text-sm font-semibold text-gray-900 dark:text-white text-right">${money(i.total, i.currency)}</span>
            <span class="hidden lg:block text-sm font-semibold text-right ${i.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}">${money(i.balance, i.currency)}</span>
            <span class="flex flex-wrap justify-end gap-1 row-start-1 col-start-2 lg:row-start-auto lg:col-start-auto">${i.overdue ? overduePill : ''}${pill(i.status)}</span>
          </div>`).join('')}
      </div>
      ${footerHtml(list)}
    </div>`;
}

/** Totals for whatever is listed (follows the filter and search), per currency. */
function footerHtml(list) {
  const byCur = {};
  list.forEach((i) => {
    const t = (byCur[i.currency] ??= { total: 0, paid: 0, balance: 0, n: 0 });
    if (i.status.id !== 6) { t.total += i.total; t.paid += i.paid + (i.status.id === 4 ? i.total - i.paid : 0); }
    t.balance += i.balance;
    t.n++;
  });
  return Object.entries(byCur).map(([cur, t]) => `
    <div class="grid grid-cols-2 lg:grid-cols-[9rem_minmax(0,2.2fr)_7rem_7rem_7rem_7rem_8rem] gap-x-4 gap-y-1 items-center px-5 py-3.5 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
      <span class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Totals${Object.keys(byCur).length > 1 ? ` · ${cur}` : ''}</span>
      <span class="text-xs text-gray-500 dark:text-gray-400">${plural(t.n, 'invoice')}${list.some((i) => i.status.id === 6) ? ' · cancelled not counted' : ''}</span>
      <span class="hidden lg:block text-xs text-gray-500 dark:text-gray-400 lg:col-span-2 text-right">Collected <strong class="text-emerald-600 dark:text-emerald-400">${money(t.paid, cur)}</strong></span>
      <span class="text-sm font-bold text-gray-900 dark:text-white lg:text-right">${money(t.total, cur)}</span>
      <span class="text-sm font-bold lg:text-right ${t.balance > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400'}">${money(t.balance, cur)}</span>
      <span class="hidden lg:block"></span>
    </div>`).join('');
}

const emptyHtml = (title, text, add = false) => `
  <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 px-6 text-center shadow-sm">
    <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-500 mb-4">${svg(ICON.pdf, 'h-7 w-7')}</span>
    <p class="text-base font-semibold text-gray-800 dark:text-gray-100">${title}</p>
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${text}</p>
    ${add ? '<button type="button" data-act="new" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">New invoice</button>' : ''}
  </div>`;

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

async function onGuestReset(sample) {
  const ok = await confirmDialog(sample ? 'Replace the demo invoices and customers with the sample book?' : 'Remove every demo invoice and customer and start empty?',
    sample ? 'Reload sample' : 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700');
  if (!ok) return;
  if (sample) guestBusiness.resetToSample(); else guestBusiness.clear();
  adopt(guestBusiness.invoicesState());
  render();
  showToast(sample ? 'Sample data reloaded.' : 'Starting empty — add a customer first, then an invoice.', 'success');
}

function onClick(e) {
  if (e.target.closest('#in-guest-sample')) { onGuestReset(true); return; }
  if (e.target.closest('#in-guest-clear')) { onGuestReset(false); return; }
  const f = e.target.closest('[data-filter]');
  if (f) { state.filter = f.dataset.filter; renderFilters(); renderList(); return; }
  if (e.target.closest('[data-act="new"]')) { openEditor(null); return; }
  const o = e.target.closest('[data-open]');
  if (o) openInvoice(o.dataset.open);
}

// ------------------------------------------------------------
// View
// ------------------------------------------------------------

async function openInvoice(id) {
  let inv;
  try {
    const json = isGuest()
      ? { success: !!guestBusiness.detail(id), invoice: guestBusiness.detail(id), messages: ['Invoice not found.'] }
      : await (await fetch(`${api()}?detail=${encodeURIComponent(id)}`)).json();
    if (!json.success) throw new Error(json.messages?.[0] || 'Invoice not found.');
    inv = json.invoice;
  } catch (err) { showToast(err.message, 'error'); return; }

  const pdfUrl = `${base()}api/invoices-pdf?id=${encodeURIComponent(inv.id)}`;
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors';
  // Payments are recorded in Receipts (which keeps this invoice's status in step)
  const payUrl = data.can_receipts && inv.status.id !== 6 && round2(inv.total - inv.paid) > 0
    ? `${data.receipts_url}?invoice=${encodeURIComponent(inv.id)}` : '';
  const receiptUrl = (r) => (data.can_receipts && r.id ? `${data.receipts_url}?open=${encodeURIComponent(r.id)}` : '');

  const html = `
    <div class="space-y-5" data-invoice>
      <div class="flex flex-wrap items-center gap-2">
        ${inv.overdue ? overduePill : ''}${pill(inv.status)}
        <span class="text-sm text-gray-500 dark:text-gray-400 mr-auto">${escapeHtml(inv.customer)} · ${money(inv.total, inv.currency)}</span>
        <button type="button" data-a="edit" class="${btn} bg-primary-600 hover:bg-primary-700 text-white shadow-sm">Edit</button>
        ${payUrl ? `<a href="${escapeHtml(payUrl)}" data-partial class="${btn} bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">${svg(ICON.plus)} Record payment</a>` : ''}
        ${isGuest() ? `<button type="button" data-a="print" class="${btn} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.pdf)} Print / Save as PDF</button>` : `
        <a href="${pdfUrl}" target="_blank" rel="noopener" class="${btn} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.eye)} PDF</a>
        <a href="${pdfUrl}&download=1" class="${btn} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800">${svg(ICON.pdf)} Download</a>`}
        <button type="button" data-a="email" class="${btn} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 ${data.can_email ? '' : 'opacity-50'}" ${data.can_email ? '' : 'title="Email isn’t set up on this server yet"'}>${svg(ICON.mail)} Email</button>
        <button type="button" data-a="duplicate" class="${btn} text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800" title="Duplicate as a new draft">${svg(ICON.copy)}</button>
        ${inv.receipts.length ? '' : `<button type="button" data-a="delete" class="${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" title="Delete">${svg(ICON.trash)}</button>`}
      </div>

      <div class="flex flex-wrap items-center gap-1.5">
        <span class="text-xs font-semibold text-gray-500 dark:text-gray-400 mr-1">Mark as</span>
        ${data.statuses.map((s) => `<button type="button" data-status="${s.id}" aria-pressed="${s.id === inv.status.id}" class="px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300 aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-300">${escapeHtml(s.name)}</button>`).join('')}
      </div>

      <!-- Paper -->
      <div data-paper class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-inner p-5 sm:p-8">
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-center gap-3">${avatar(inv.customer_id, inv.customer, 'h-12 w-12', 'text-sm')}
            <div><p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Bill to</p><p class="text-base font-bold text-gray-900 dark:text-white">${escapeHtml(inv.customer)}</p>${inv.customer_email ? `<p class="text-xs text-gray-500">${escapeHtml(inv.customer_email)}</p>` : ''}</div>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold tracking-widest uppercase text-primary-600">Invoice</p>
            <p class="text-sm font-mono font-semibold text-gray-700 dark:text-gray-200">${escapeHtml(inv.number)}</p>
          </div>
        </div>
        <div class="mt-5 rounded-xl bg-primary-50 dark:bg-primary-950/30 border-l-4 border-primary-500 px-4 py-2.5">
          <p class="text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">Project / reference</p>
          <p class="text-sm font-bold text-gray-900 dark:text-white">${escapeHtml(inv.title)}</p>
        </div>
        <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div><p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Issued</p><p class="font-semibold text-gray-800 dark:text-gray-100">${shortDate(inv.created)}</p></div>
          <div><p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Due</p><p class="font-semibold ${inv.overdue ? 'text-red-600' : 'text-gray-800 dark:text-gray-100'}">${inv.due ? shortDate(inv.due) : 'Upon receipt'}</p></div>
          <div><p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Currency</p><p class="font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(inv.currency)}</p></div>
        </div>
        <table class="mt-5 w-full text-sm">
          <thead><tr class="border-b-2 border-primary-500 text-[10px] font-bold uppercase tracking-wider text-primary-700 dark:text-primary-300">
            <th class="py-2 pr-2 text-left w-8">#</th><th class="py-2 pr-2 text-left">Description</th><th class="py-2 px-2 text-right">Qty</th><th class="py-2 px-2 text-right">Rate</th><th class="py-2 pl-2 text-right">Amount</th></tr></thead>
          <tbody class="divide-y divide-gray-100 dark:divide-gray-800">
            ${inv.items.map((it, n) => `<tr class="align-top">
              <td class="py-3 pr-2 text-gray-400">${n + 1}</td>
              <td class="py-3 pr-2 text-gray-800 dark:text-gray-100 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:mt-1 [&_ol]:mt-1">${it.description}</td>
              <td class="py-3 px-2 text-right whitespace-nowrap ${it.quantity < 0 ? 'text-emerald-600' : ''}">${it.quantity}</td>
              <td class="py-3 px-2 text-right whitespace-nowrap">${money(it.unit_price, inv.currency)}</td>
              <td class="py-3 pl-2 text-right whitespace-nowrap font-semibold ${it.amount < 0 ? 'text-emerald-600' : 'text-gray-900 dark:text-white'}">${money(it.amount, inv.currency)}</td></tr>`).join('')}
          </tbody>
        </table>
        <div class="mt-4 ml-auto w-full sm:w-72 space-y-1.5 text-sm">
          <div class="flex justify-between text-gray-500"><span>Subtotal</span><span>${money(inv.total, inv.currency)}</span></div>
          ${inv.paid > 0 ? `<div class="flex justify-between text-emerald-600"><span>Paid</span><span>−${money(inv.paid, inv.currency)}</span></div>` : ''}
          <div class="flex justify-between border-t-2 border-primary-500 pt-2 text-lg font-bold text-primary-600"><span>${inv.paid > 0 ? 'Balance' : 'Total'}</span><span>${money(inv.paid > 0 ? inv.balance : inv.total, inv.currency)}</span></div>
        </div>
      </div>

      ${inv.receipts.length ? `
        <div>
          <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">Payments</p>
          <div class="space-y-2">${inv.receipts.map((r) => `
            <${receiptUrl(r) ? `a href="${escapeHtml(receiptUrl(r))}" data-partial` : 'div'} class="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-gray-800 px-4 py-2.5 text-sm ${receiptUrl(r) ? 'hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 transition-colors' : ''}">
              <span class="font-mono font-semibold text-gray-700 dark:text-gray-200">${escapeHtml(r.number)}</span>
              <span class="text-gray-500">${shortDate(r.date)}${r.method ? ` · ${escapeHtml(r.method)}` : ''}</span>
              <span class="ml-auto font-bold text-emerald-600">${money(r.amount, inv.currency)}</span>
            </${receiptUrl(r) ? 'a' : 'div'}>`).join('')}</div>
        </div>` : ''}
    </div>`;
  modal?.destroy();
  modal = new Modal({ id: 'in-view', title: inv.number, size: 'xl', showFooter: false, content: html });
  modal.open();
  const root = document.getElementById('in-view');

  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    const st = e.target.closest('[data-status]');
    try {
      if (st) {
        const json = await post({ action: 'status', id: inv.id, status_id: Number(st.dataset.status) });
        adopt(json); render(); showToast(json.messages?.[0] || 'Updated.', 'success'); openInvoice(inv.id);
      } else if (a === 'print') {
        printPaper(root.querySelector('[data-paper]'), inv.number);
      } else if (a === 'edit') {
        openEditor(inv);
      } else if (a === 'email') {
        if (isGuest()) { showToast('Emailing invoices is available once you sign in — in this demo, use Print / Save as PDF.', 'error'); return; }
        if (!data.can_email) { showToast('Email isn’t set up on this server yet — download the PDF and send it yourself.', 'error'); return; }
        openEmail(inv);
      } else if (a === 'duplicate') {
        const json = await post({ action: 'duplicate', id: inv.id });
        adopt(json); render(); showToast(json.messages?.[0] || 'Duplicated.', 'success'); openInvoice(json.saved);
      } else if (a === 'delete') {
        if (!(await confirmDialog(`Delete invoice <strong>${escapeHtml(inv.number)}</strong>? Its number won't be reused.`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
        const json = await post({ action: 'delete', id: inv.id });
        adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Deleted.', 'success');
      }
    } catch (err) { showToast(err.message, 'error'); }
  });
}

/** Guest "PDF": the paper view in a clean window, printed (the browser can save it as PDF). */
function printPaper(paper, number) {
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to print the invoice.', 'error'); return; }
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => `<link rel="stylesheet" href="${escapeHtml(l.href)}">`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${escapeHtml(number)}</title>${styles}
    <style>body{background:#fff;padding:24px}@media print{body{padding:0}}</style></head>
    <body class="bg-white">${paper.outerHTML.replace('shadow-inner', '')}</body></html>`);
  w.document.close();
  w.addEventListener('load', () => { w.focus(); w.print(); });
}

function openEmail(inv) {
  modal?.destroy();
  modal = new Modal({
    id: 'in-email', title: `Email ${inv.number}`, size: 'md', showFooter: false,
    content: `
      <form id="in-email-form" class="space-y-4" novalidate>
        <div><label for="in-to" class="${lbl}">To</label><input id="in-to" name="to" type="email" value="${escapeHtml(inv.customer_email)}" class="${input}" placeholder="customer@company.com"></div>
        <div><label for="in-msg" class="${lbl}">Message</label><textarea id="in-msg" name="message" rows="5" class="${input} resize-y">Hello,

Please find invoice ${escapeHtml(inv.number)} (${escapeHtml(inv.title)}) attached — ${money(inv.balance || inv.total, inv.currency)}${inv.due ? `, due ${shortDate(inv.due)}` : ''}.

Thank you for your business.</textarea></div>
        <p class="text-xs text-gray-500 dark:text-gray-400">The invoice PDF is attached. A draft is marked as Sent once it goes.</p>
        <div class="api-message"></div>
        <div class="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-cancel class="${ghost}">Cancel</button>
          <button type="submit" class="${primary}">Send</button>
        </div>
      </form>`,
  });
  modal.open();
  const form = document.getElementById('in-email-form');
  form.querySelector('[data-cancel]').addEventListener('click', () => openInvoice(inv.id));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('button[type="submit"]');
    b.disabled = true;
    try {
      const f = Object.fromEntries(new FormData(form).entries());
      const json = await post({ action: 'email', id: inv.id, ...f });
      adopt(json); render(); showToast(json.messages?.[0] || 'Sent.', 'success'); openInvoice(inv.id);
    } catch (err) { form.querySelector('.api-message').innerHTML = errorsHtml(err); } finally { b.disabled = false; }
  });
}

// ------------------------------------------------------------
// Editor
// ------------------------------------------------------------

const input = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition';
const lbl = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5';
const primary = 'inline-flex items-center justify-center min-w-[7rem] px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm disabled:opacity-60';
const ghost = 'px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800';
const chip = 'px-2.5 py-1 rounded-lg text-xs font-semibold border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300 hover:text-primary-700';

function lineHtml(it = { description: '', quantity: 1, unit_price: '' }) {
  return `
    <div data-line class="relative overflow-hidden rounded-2xl border border-violet-100 dark:border-violet-900/40 bg-white dark:bg-gray-900 p-3 pl-5 shadow-sm transition-colors">
      <span data-stripe aria-hidden="true" class="absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b from-violet-400 to-fuchsia-500"></span>
      <div class="flex items-center gap-1 mb-2">
        <span data-line-no class="mr-1.5 h-6 min-w-[1.5rem] px-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/40 text-xs font-black text-violet-700 dark:text-violet-300 flex items-center justify-center">1</span>
        <button type="button" data-fmt="bold" title="Bold (Ctrl+B)" class="h-7 w-7 rounded-lg text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40">B</button>
        <button type="button" data-fmt="italic" title="Italic (Ctrl+I)" class="h-7 w-7 rounded-lg text-sm italic text-gray-600 dark:text-gray-300 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40">I</button>
        <button type="button" data-fmt="insertUnorderedList" title="Bullet list" class="h-7 px-2 rounded-lg text-xs font-semibold text-gray-600 dark:text-gray-300 hover:bg-violet-50 hover:text-violet-700 dark:hover:bg-violet-950/40">• List</button>
        <span data-discount-tag class="hidden ml-2 rounded-full bg-emerald-100 dark:bg-emerald-900/40 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Discount</span>
        <span class="ml-auto flex items-center gap-0.5">
          <button type="button" data-move="-1" title="Move up" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${svg(ICON.up, 'h-3.5 w-3.5')}</button>
          <button type="button" data-move="1" title="Move down" class="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800">${svg(ICON.down, 'h-3.5 w-3.5')}</button>
          <button type="button" data-remove title="Remove line" class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">${svg(ICON.x, 'h-3.5 w-3.5')}</button>
        </span>
      </div>
      <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_6rem_7rem_8rem] items-start">
        <div data-desc contenteditable="true" role="textbox" aria-multiline="true" aria-label="Description" data-placeholder="Describe the work…"
          class="min-h-[2.75rem] max-h-64 overflow-y-auto rounded-xl border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white focus:border-violet-400 focus:ring-4 focus:ring-violet-400/20 outline-none [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400">${it.description}</div>
        <label class="block"><span class="sm:hidden text-xs text-gray-500">Qty</span><input data-qty inputmode="decimal" value="${it.quantity}" aria-label="Quantity" class="${kitInput} text-right"></label>
        <label class="block"><span class="sm:hidden text-xs text-gray-500">Rate</span><input data-rate inputmode="decimal" value="${it.unit_price}" placeholder="0.00" aria-label="Rate" class="${kitInput} text-right"></label>
        <p data-amount class="mt-0.5 rounded-xl bg-violet-50 dark:bg-violet-950/30 px-3 py-2 text-right text-sm font-bold text-violet-800 dark:text-violet-200">$0.00</p>
      </div>
    </div>`;
}

/** The editor's identity-card avatar: the customer's logo, their initials, or a receipt. */
const whoAvatar = (who) => (who?.logo
  ? `<img src="${escapeHtml(who.logo)}" alt="" class="h-full w-full object-cover bg-white">`
  : (who ? escapeHtml(initials(who.name)) : '🧾'));

function openEditor(inv) {
  const isEdit = !!inv;
  const v = inv || {
    customer_id: '', title: '', due: addDays(15), currency: 'CAD', payment_term_id: data.payment_terms[0]?.id || null,
    delivery_term_id: data.delivery_terms[0]?.id || null, status: { id: 1 }, items: [{ description: '', quantity: 1, unit_price: '' }],
  };
  const customers = data.customers.filter((c) => c.active || c.id === v.customer_id);
  const number = isEdit ? inv.number : (data.next_number || 'New invoice');
  const skyChip = 'px-2.5 py-1 rounded-lg text-xs font-semibold border border-sky-200 dark:border-sky-800 bg-white/80 dark:bg-gray-900 text-sky-700 dark:text-sky-300 hover:bg-sky-100 dark:hover:bg-sky-900/40 transition-colors';

  modal?.destroy();
  modal = new Modal({
    id: 'in-editor', title: isEdit ? `Edit ${inv.number}` : `New invoice · ${data.next_number || ''}`, size: 'xl', showFooter: false,
    content: `
      <form id="in-form" class="space-y-5" novalidate>
        ${identityCard({
          avatar: whoAvatar(customer(v.customer_id)),
          tag: escapeHtml(number),
          tagDot: isEdit ? 'bg-primary-300' : 'bg-emerald-300 animate-pulse',
          title: escapeHtml(v.title || 'Project / reference'),
          sub: escapeHtml(customer(v.customer_id)?.name || 'Choose a customer'),
          aside: `<div class="text-right flex-shrink-0">
              <p data-preview-total class="text-2xl sm:text-3xl font-bold tracking-tight">$0.00</p>
              <p data-preview-meta class="text-[11px] font-semibold uppercase tracking-wider text-white/60"></p></div>`,
        })}

        ${formSection(TONE.orange, '🧾', 'Bill to', 'Who it’s for, and what it’s for.', `
          <div class="grid gap-4 md:grid-cols-2">
            <div><label for="in-customer" class="${kitLabel}">Customer</label>
              <select id="in-customer" name="customer_id" class="${kitInput}"><option value="">Choose a customer…</option>
                ${customers.map((c) => `<option value="${escapeHtml(c.id)}" ${c.id === v.customer_id ? 'selected' : ''}>${escapeHtml(c.name)}${c.city ? ` — ${escapeHtml(c.city)}` : ''}</option>`).join('')}</select>
              ${data.can_customers ? `<a href="${escapeHtml(data.customers_url)}" data-partial class="mt-1.5 ml-1 inline-block text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">New customer? Add them in Customers</a>` : ''}</div>
            <div><label for="in-title" class="${kitLabel}">Project / reference</label><input id="in-title" name="title" maxlength="255" value="${escapeHtml(v.title)}" placeholder="e.g. New website for PMBrokers" class="${kitInput}"></div>
          </div>`)}

        ${formSection(TONE.sky, '📅', 'Dates & terms', '', `
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div><label for="in-due" class="${kitLabel}">Due</label><input id="in-due" name="due" type="date" value="${v.due || ''}" class="${kitInput}">
              <div class="mt-1.5 flex flex-wrap gap-1">${[['', 'On receipt'], [15, '+15d'], [30, '+30d'], [60, '+60d']].map(([d, t]) => `<button type="button" data-due="${d}" class="${skyChip}">${t}</button>`).join('')}</div></div>
            <div><label for="in-currency" class="${kitLabel}">Currency</label><select id="in-currency" name="currency" class="${kitInput}">${data.currencies.map((c) => `<option ${c === v.currency ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
            <div><label for="in-pay" class="${kitLabel}">Payment terms</label><select id="in-pay" name="payment_term_id" class="${kitInput}"><option value="">—</option>${data.payment_terms.map((t) => `<option value="${t.id}" ${t.id === v.payment_term_id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}</select></div>
            <div><label for="in-del" class="${kitLabel}">Delivery</label><select id="in-del" name="delivery_term_id" class="${kitInput}"><option value="">—</option>${data.delivery_terms.map((t) => `<option value="${t.id}" ${t.id === v.delivery_term_id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('')}</select></div>
          </div>`)}

        ${formSection(TONE.violet, '✍️', 'Lines', 'Bold, italics and bullet lists work in descriptions. Use a negative quantity for a discount.', `
          <div data-lines class="space-y-3">${v.items.map(lineHtml).join('')}</div>
          <div class="mt-3 flex flex-wrap gap-2">
            <button type="button" data-add-line class="inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-violet-300 dark:border-violet-800 bg-white/70 dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40 transition-colors">${svg(ICON.plus)} Add line</button>
            <button type="button" data-add-discount class="inline-flex items-center gap-1.5 rounded-xl border-2 border-dashed border-emerald-300 dark:border-emerald-800 bg-white/70 dark:bg-gray-900 px-4 py-2 text-sm font-semibold text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 transition-colors">${svg(ICON.plus)} Add discount</button>
          </div>`)}

        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary-500 via-orange-500 to-rose-500 p-4 sm:p-5 text-white shadow-lg shadow-primary-500/25">
          <div aria-hidden="true" class="pointer-events-none absolute -top-10 right-1/4 h-32 w-32 rounded-full bg-white/20 blur-2xl"></div>
          <div class="relative flex flex-col-reverse sm:flex-row sm:items-end gap-4">
            <div class="sm:w-60"><label for="in-status" class="block text-xs font-bold uppercase tracking-wider text-white/80 mb-1.5 ml-1">Status</label>
              <select id="in-status" name="status_id" class="block w-full rounded-xl border-0 bg-white/95 text-gray-900 py-2.5 px-4 sm:text-sm font-semibold focus:ring-4 focus:ring-white/40 outline-none">${data.statuses.map((s) => `<option value="${s.id}" ${s.id === v.status.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>`).join('')}</select></div>
            <div class="sm:ml-auto text-right">
              <p class="text-xs font-bold uppercase tracking-wider text-white/80">Total</p>
              <p data-total class="text-4xl font-black tracking-tight drop-shadow-sm">$0.00</p>
            </div>
          </div>
        </div>
        <div class="api-message"></div>
        <div class="flex justify-end gap-3">
          <button type="button" data-cancel class="${kitGhost}">Cancel</button>
          <button type="submit" class="${kitSubmit} min-w-[9rem]">${isEdit ? 'Save changes' : 'Create invoice'}</button>
        </div>
      </form>`,
  });
  modal.open();

  const form = document.getElementById('in-form');
  const lines = form.querySelector('[data-lines]');
  const cur = () => form.querySelector('[name="currency"]').value;
  const num = (s) => { const n = parseFloat(String(s).replace(/[,$\s]/g, '')); return Number.isFinite(n) ? n : 0; };
  const recalc = () => {
    let total = 0;
    const rows = [...lines.querySelectorAll('[data-line]')];
    rows.forEach((row, i) => {
      const qty = num(row.querySelector('[data-qty]').value);
      const amt = round2(qty * num(row.querySelector('[data-rate]').value));
      total += amt;
      const el = row.querySelector('[data-amount]');
      el.textContent = money(amt, cur());
      // Discount lines (negative quantity) go green
      const discount = qty < 0;
      row.querySelector('[data-line-no]').textContent = String(i + 1);
      row.querySelector('[data-discount-tag]').classList.toggle('hidden', !discount);
      const stripe = row.querySelector('[data-stripe]');
      stripe.classList.toggle('from-violet-400', !discount); stripe.classList.toggle('to-fuchsia-500', !discount);
      stripe.classList.toggle('from-emerald-400', discount); stripe.classList.toggle('to-teal-500', discount);
      el.classList.toggle('bg-violet-50', !discount); el.classList.toggle('text-violet-800', !discount);
      el.classList.toggle('bg-emerald-50', discount); el.classList.toggle('text-emerald-700', discount);
      row.classList.toggle('border-violet-100', !discount); row.classList.toggle('border-emerald-200', discount);
    });
    const t = form.querySelector('[data-total]');
    t.textContent = money(round2(total), cur());
    t.classList.toggle('text-red-100', total < 0);
    form.querySelector('[data-preview-total]').textContent = money(round2(total), cur());
    const due = form.querySelector('[name="due"]').value;
    form.querySelector('[data-preview-meta]').textContent = `${plural(rows.length, 'line')} · ${due ? `due ${shortDate(due)}` : 'due on receipt'}`;
  };
  recalc();

  // Live identity card: customer and project
  const preview = (e) => {
    if (e.target.name === 'customer_id') {
      const who = customer(e.target.value);
      form.querySelector('[data-preview-sub]').textContent = who?.name || 'Choose a customer';
      form.querySelector('[data-preview-avatar]').innerHTML = whoAvatar(who);
      bumpAvatar(form);
    }
    if (e.target.name === 'title') form.querySelector('[data-preview-title]').textContent = e.target.value.trim() || 'Project / reference';
    if (e.target.name === 'due') recalc();
  };
  form.addEventListener('input', preview);
  form.addEventListener('change', preview);

  form.addEventListener('input', (e) => { if (e.target.matches('[data-qty], [data-rate]')) recalc(); });
  form.querySelector('[name="currency"]').addEventListener('change', recalc);
  // Paste plain text only (Word / web pages bring a mess of markup)
  form.addEventListener('paste', (e) => {
    if (!e.target.closest('[data-desc]')) return;
    e.preventDefault();
    document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
  });

  form.addEventListener('click', (e) => {
    const fmt = e.target.closest('[data-fmt]');
    if (fmt) {
      const desc = fmt.closest('[data-line]').querySelector('[data-desc]');
      desc.focus();
      document.execCommand(fmt.dataset.fmt, false);
      return;
    }
    const due = e.target.closest('[data-due]');
    if (due) { form.querySelector('[name="due"]').value = due.dataset.due === '' ? '' : addDays(Number(due.dataset.due)); recalc(); return; }
    if (e.target.closest('[data-add-line]')) { lines.insertAdjacentHTML('beforeend', lineHtml()); lines.lastElementChild.querySelector('[data-desc]').focus(); recalc(); return; }
    if (e.target.closest('[data-add-discount]')) {
      lines.insertAdjacentHTML('beforeend', lineHtml({ description: 'Discount', quantity: -1, unit_price: '' }));
      lines.lastElementChild.querySelector('[data-rate]').focus(); recalc(); return;
    }
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const row = mv.closest('[data-line]');
      if (mv.dataset.move === '-1' && row.previousElementSibling) row.parentNode.insertBefore(row, row.previousElementSibling);
      if (mv.dataset.move === '1' && row.nextElementSibling) row.parentNode.insertBefore(row.nextElementSibling, row);
      recalc();
      return;
    }
    const rm = e.target.closest('[data-remove]');
    if (rm) {
      if (lines.children.length === 1) { rm.closest('[data-line]').querySelectorAll('[data-desc]').forEach((d) => { d.innerHTML = ''; }); return; }
      rm.closest('[data-line]').remove(); recalc(); return;
    }
    if (e.target.closest('[data-cancel]')) { if (isEdit) openInvoice(inv.id); else modal.close(); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('button[type="submit"]');
    b.disabled = true;
    form.querySelector('.api-message').innerHTML = '';
    const f = Object.fromEntries(new FormData(form).entries());
    const items = [...lines.querySelectorAll('[data-line]')].map((row) => ({
      description: row.querySelector('[data-desc]').innerHTML,
      quantity: row.querySelector('[data-qty]').value.trim(),
      unit_price: row.querySelector('[data-rate]').value.trim(),
    }));
    try {
      const json = await post({
        action: 'save', id: inv?.id || '', ...f, items,
        payment_term_id: Number(f.payment_term_id) || 0, delivery_term_id: Number(f.delivery_term_id) || 0, status_id: Number(f.status_id),
      });
      adopt(json); render(); showToast(json.messages?.[0] || 'Saved.', 'success'); openInvoice(json.saved);
    } catch (err) {
      form.querySelector('.api-message').innerHTML = errorsHtml(err);
      form.querySelector('.api-message').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } finally { b.disabled = false; }
  });
}
