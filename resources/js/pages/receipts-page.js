// /resources/js/pages/receipts-page.js
//
// Receipts: every receipt summary lives in memory (seeded from
// #receipts-data), laid out like the Invoices page. render() draws the photo
// hero (collected this year and month, still owing, voided and a 12-month
// chart), the filter chips and the list. Opening a receipt shows a
// paper-style receipt (PDF, email, void / restore, delete); the editor
// records a payment against an invoice that's still owing, with the amount
// capped at what's left. Every write returns the fresh list, so the page
// updates on the spot — and the invoice's status follows on the server.
//
// Deep links: /receipts?open={receiptId}, /receipts?invoice={invoiceId}
// (records a payment for that invoice — from the Invoices page).

import { Modal } from '../factories/modal-factory.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { guestBusiness } from '../utils/business/guest-store.js';
import { TONE, formSection, identityCard, bumpAvatar, kitInput, kitLabel, kitSubmit, kitGhost } from '../forms/form-kit.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/receipts`;
const HERO_SLIDE_MS = 8 * 1000;
const PAID = 4;
const CANCELLED = 6;

const STATUS = {
  gray: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  blue: 'bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300',
  orange: 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300',
  green: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  red: 'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  slate: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};
const AVATARS = ['from-orange-400 to-rose-500', 'from-sky-400 to-indigo-500', 'from-emerald-400 to-teal-600', 'from-violet-400 to-fuchsia-500', 'from-amber-400 to-orange-500', 'from-cyan-400 to-sky-600', 'from-lime-400 to-emerald-500', 'from-pink-400 to-rose-500'];
const METHOD_ICON = { 'E-Transfer': '📲', 'Bank Transfer': '🏦', Cash: '💵', Cheque: '🧾', 'Credit Card': '💳', Wire: '🌐', Other: '✳️' };

let data = { receipts: [], invoices: [], customers: [], methods: [], today: '', next_number: '', can_email: false, invoices_url: '', can_invoices: false };
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
const invoice = (id) => data.invoices.find((i) => i.id === id);
const addDays = (n) => { const d = new Date(`${data.today}T00:00:00`); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const round2 = (n) => Math.round(n * 100) / 100;
const sum = (list) => round2(list.reduce((s, r) => s + r.amount, 0));
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  receipt: 'M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z',
  pdf: 'M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z',
  mail: 'M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  ban: 'M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636',
  undo: 'M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6',
  arrow: 'M14 5l7 7m0 0l-7 7m7-7H3',
};

function avatar(id, name, size = 'h-9 w-9', text = 'text-xs') {
  const c = customer(id);
  return c?.logo
    ? `<img src="${escapeHtml(c.logo)}" alt="" class="${size} flex-shrink-0 rounded-xl object-cover bg-white ring-1 ring-black/5">`
    : `<span class="${size} flex-shrink-0 rounded-xl bg-gradient-to-br ${AVATARS[hash(name) % AVATARS.length]} flex items-center justify-center ${text} font-bold text-white">${escapeHtml(initials(name))}</span>`;
}
const pill = (s) => `<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS[s.color] || STATUS.gray}">${escapeHtml(s.name)}</span>`;
const voidPill = '<span class="inline-block rounded-full px-2 py-0.5 text-[10px] font-bold bg-red-500 text-white">Voided</span>';
const statePills = (r) => (r.active ? `<span title="Invoice ${escapeHtml(r.invoice_number)} is ${escapeHtml(r.invoice_status.name.toLowerCase())}">${pill(r.invoice_status)}</span>` : voidPill);

/** What's still owing on an invoice — leaving out receipt `r` (being edited) if it counts. */
function owing(inv, r = null) {
  if (!inv) return 0;
  const back = r && r.active && r.invoice_id === inv.id ? r.amount : 0;
  return round2(Math.max(0, inv.total - inv.paid + back));
}

async function post(body) {
  if (isGuest()) {
    const json = guestBusiness.handleReceipts(body);
    if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
    return json;
  }
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}
function adopt(json) {
  ['receipts', 'invoices', 'customers', 'methods', 'next_number', 'today', 'can_email'].forEach((k) => { if (json[k] !== undefined) data[k] = json[k]; });
}
const errorsHtml = (err) => (err.messages || [err.message]).map((m) => `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('receipts-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('receipts-data')?.textContent || '{}') }; } catch { /* defaults */ }
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  if (isGuest()) {
    guestBusiness.setup({ methods: data.methods?.length ? data.methods : undefined });
    adopt(guestBusiness.receiptsState());
  }
  state = { q: '', filter: 'all', sort: 'newest' };

  page.addEventListener('click', onClick);
  const search = document.getElementById('rc-search');
  search?.addEventListener('input', debounce(() => { state.q = search.value.trim().toLowerCase(); renderList(); }, 150));
  document.getElementById('rc-sort')?.addEventListener('change', (e) => { state.sort = e.target.value; renderList(); });

  render();
  startHeroSlides();

  // Deep links: ?open={receipt} (e.g. from an invoice's payments), ?invoice={invoice} (record a payment for it)
  const params = new URLSearchParams(window.location.search);
  const open = params.get('open');
  const forInvoice = params.get('invoice');
  if (open && data.receipts.some((r) => r.id === open)) openReceipt(open);
  else if (forInvoice && invoice(forInvoice)) openEditor(null, forInvoice);
}

function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll('#receipts-page [data-hero-slides] .hero-slide')];
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
  const el = document.getElementById('rc-hero');
  if (!el) return;
  const active = data.receipts.filter((r) => r.active);
  const year = (data.today || '').slice(0, 4);
  const month = (data.today || '').slice(0, 7);
  const thisYear = active.filter((r) => (r.date || '').startsWith(year));
  const thisMonth = active.filter((r) => (r.date || '').startsWith(month));
  const voided = data.receipts.filter((r) => !r.active);
  // Sent and still owing (drafts aren't billed yet; paid and cancelled are closed)
  const open = data.invoices.filter((i) => ![1, PAID, CANCELLED].includes(i.status.id) && owing(i) > 0);
  const openSum = round2(open.reduce((s, i) => s + owing(i), 0));
  const avg = active.length ? sum(active) / active.length : 0;

  // Collected per month, last 12 months (voided excluded)
  const months = [];
  const now = new Date(`${data.today}T00:00:00`);
  for (let k = 11; k >= 0; k--) {
    const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
    months.push({ key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`, label: d.toLocaleDateString('en-CA', { month: 'short' }), total: 0 });
  }
  active.forEach((r) => { const m = months.find((x) => x.key === (r.date || '').slice(0, 7)); if (m) m.total += r.amount; });
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
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">Business · Receipts</span>
        <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">${thisYear.length ? `${money(sum(thisYear), 'CAD', true)} collected in ${year}` : `No payments yet in ${year}`}</h1>
        <p class="mt-2 text-base text-secondary-50">${plural(data.receipts.length, 'receipt')} · next number <strong>${escapeHtml(data.next_number || '')}</strong></p>
        <div class="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
          ${tile(thisMonth.length, 'This month', thisMonth.length ? money(sum(thisMonth), 'CAD', true) : 'nothing yet', thisMonth.length ? 'text-emerald-300' : 'text-white')}
          ${tile(open.length, 'Still owing', open.length ? money(openSum, 'CAD', true) : 'all collected', open.length ? 'text-amber-300' : 'text-emerald-300')}
          ${tile(money(avg, 'CAD', true), 'Average payment', active.length ? `over ${plural(active.length, 'receipt')}` : '')}
          ${tile(voided.length, 'Voided', voided.length ? 'not counted' : '', voided.length ? 'text-red-300' : 'text-white')}
        </div>
      </div>
      <div class="lg:col-span-2 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-4">
        <div class="flex items-baseline justify-between mb-3">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary-200">Collected · last 12 months</p>
          <p class="text-sm font-semibold">${money(yearTotal, 'CAD', true)}</p>
        </div>
        <div class="flex items-end gap-1.5 h-28" role="img" aria-label="Collected per month for the last 12 months">
          ${months.map((m) => `
            <div class="flex-1 flex flex-col items-center gap-1 h-full justify-end" title="${m.label}: ${money(m.total)}">
              <div class="w-full rounded-t-md ${m.total ? 'bg-gradient-to-t from-emerald-500 to-lime-300' : 'bg-white/10'}" style="height: ${m.total ? Math.max(6, Math.round((m.total / max) * 100)) : 4}%"></div>
              <span class="text-[9px] text-white/60">${m.label.slice(0, 1)}</span>
            </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/** Filter chips: the periods, then one per payment method in use, then voided. */
function filters() {
  const year = (data.today || '').slice(0, 4);
  const month = (data.today || '').slice(0, 7);
  const used = [...new Set(data.receipts.map((r) => r.method).filter(Boolean))]
    .sort((a, b) => (data.methods.indexOf(a) + 1 || 99) - (data.methods.indexOf(b) + 1 || 99));
  return [
    ['all', 'All', () => true],
    ['month', 'This month', (r) => r.active && (r.date || '').startsWith(month)],
    ['year', `In ${year}`, (r) => r.active && (r.date || '').startsWith(year)],
    ...used.map((m) => [`m:${m}`, m, (r) => r.active && r.method === m]),
    ['voided', 'Voided', (r) => !r.active],
  ];
}

function renderFilters() {
  const el = document.getElementById('rc-filters');
  if (!el) return;
  const list = filters();
  if (!list.some(([k]) => k === state.filter)) state.filter = 'all';
  el.innerHTML = list.map(([key, label, fn]) => {
    const n = data.receipts.filter(fn).length;
    const on = state.filter === key;
    return `<button type="button" data-filter="${escapeHtml(key)}" aria-pressed="${on}" class="flex-shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors ${on ? 'bg-secondary-900 text-white dark:bg-white dark:text-gray-900' : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 text-gray-600 dark:text-gray-300 hover:border-primary-300'}">
      ${escapeHtml(label)} <span class="text-xs ${on ? 'opacity-70' : 'text-gray-400'}">${n}</span></button>`;
  }).join('');
}

function visible() {
  const fn = (filters().find(([k]) => k === state.filter) || ['all', '', () => true])[2];
  const q = state.q;
  const list = data.receipts.filter((r) => fn(r) && (!q || `${r.number} ${r.invoice_number} ${r.invoice_title} ${r.customer} ${r.method} ${r.note}`.toLowerCase().includes(q)));
  const by = {
    newest: (a, b) => (b.date || '').localeCompare(a.date || '') || b.number.localeCompare(a.number),
    oldest: (a, b) => (a.date || '').localeCompare(b.date || '') || a.number.localeCompare(b.number),
    amount: (a, b) => b.amount - a.amount,
    customer: (a, b) => a.customer.localeCompare(b.customer) || (b.date || '').localeCompare(a.date || ''),
  }[state.sort];
  return [...list].sort(by);
}

const COLS = 'lg:grid-cols-[9rem_minmax(0,2.2fr)_7rem_8rem_8rem_8rem]';

function renderList() {
  const body = document.getElementById('rc-body');
  if (!body) return;
  const list = visible();
  if (!data.receipts.length) {
    body.innerHTML = emptyHtml('No receipts yet', 'Record a payment against an invoice — it gets the next receipt number automatically.', true);
    return;
  }
  if (!list.length) { body.innerHTML = emptyHtml('Nothing here', state.q ? 'Try a different receipt, invoice or customer.' : 'No receipts match that filter.'); return; }

  body.innerHTML = `
    <div class="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-sm">
      <div class="hidden lg:grid ${COLS} gap-4 px-5 py-3 border-b border-gray-100 dark:border-gray-800 text-[11px] font-bold uppercase tracking-wider text-gray-400">
        <span>Receipt</span><span>Customer · invoice</span><span>Paid on</span><span>Method</span><span class="text-right">Amount</span><span class="text-right">Invoice</span>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-800">
        ${list.map((r) => `
          <div data-open="${escapeHtml(r.id)}" role="button" tabindex="0"
            class="grid grid-cols-2 ${COLS} gap-x-4 gap-y-1 items-center px-5 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${r.active ? '' : 'opacity-60'}">
            <span class="text-sm font-bold text-gray-900 dark:text-white font-mono tracking-tight ${r.active ? '' : 'line-through decoration-red-400'}">${escapeHtml(r.number)}</span>
            <span class="col-span-2 lg:col-span-1 row-start-2 lg:row-start-auto flex items-center gap-3 min-w-0">${avatar(r.customer_id, r.customer)}
              <span class="min-w-0"><span class="block text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(r.customer)}</span><span class="block text-xs text-gray-500 dark:text-gray-400 truncate"><span class="font-mono">${escapeHtml(r.invoice_number)}</span>${r.invoice_title ? ` · ${escapeHtml(r.invoice_title)}` : ''}</span></span></span>
            <span class="hidden lg:block text-xs text-gray-600 dark:text-gray-300">${shortDate(r.date)}</span>
            <span class="hidden lg:block text-xs text-gray-600 dark:text-gray-300 truncate">${METHOD_ICON[r.method] || '•'} ${escapeHtml(r.method || '—')}</span>
            <span class="lg:hidden row-start-3 col-start-1 text-xs text-gray-500 dark:text-gray-400 truncate">${shortDate(r.date)} · ${escapeHtml(r.method || '—')}</span>
            <span class="row-start-3 col-start-2 lg:row-start-auto lg:col-start-auto text-sm font-bold text-right ${r.active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 line-through'}">${money(r.amount, r.currency)}</span>
            <span class="flex flex-wrap justify-end gap-1 row-start-1 col-start-2 lg:row-start-auto lg:col-start-auto">${statePills(r)}</span>
          </div>`).join('')}
      </div>
      ${footerHtml(list)}
    </div>`;
}

/** Totals for whatever is listed (follows the filter and search), per currency. */
function footerHtml(list) {
  const byCur = {};
  list.forEach((r) => {
    const t = (byCur[r.currency] ??= { amount: 0, n: 0, voided: 0 });
    if (r.active) t.amount += r.amount; else t.voided++;
    t.n++;
  });
  return Object.entries(byCur).map(([cur, t]) => `
    <div class="grid grid-cols-2 ${COLS} gap-x-4 gap-y-1 items-center px-5 py-3.5 border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/40">
      <span class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Totals${Object.keys(byCur).length > 1 ? ` · ${cur}` : ''}</span>
      <span class="text-xs text-gray-500 dark:text-gray-400 lg:col-span-3 text-right lg:text-left">${plural(t.n, 'receipt')}${t.voided ? ` · ${t.voided} voided, not counted` : ''}</span>
      <span class="col-span-2 text-right text-sm whitespace-nowrap text-gray-500 dark:text-gray-400">Collected <strong class="text-emerald-600 dark:text-emerald-400">${money(round2(t.amount), cur)}</strong></span>
    </div>`).join('');
}

const emptyHtml = (title, text, add = false) => `
  <div class="rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 py-16 px-6 text-center shadow-sm">
    <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-500 mb-4">${svg(ICON.receipt, 'h-7 w-7')}</span>
    <p class="text-base font-semibold text-gray-800 dark:text-gray-100">${title}</p>
    <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">${text}</p>
    ${add ? '<button type="button" data-act="new" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">Record payment</button>' : ''}
  </div>`;

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

async function onGuestReset(sample) {
  const ok = await confirmDialog(sample ? 'Replace the demo receipts, invoices and customers with the sample book?' : 'Remove every demo receipt, invoice and customer and start empty?',
    sample ? 'Reload sample' : 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700');
  if (!ok) return;
  if (sample) guestBusiness.resetToSample(); else guestBusiness.clear();
  adopt(guestBusiness.receiptsState());
  render();
  showToast(sample ? 'Sample data reloaded.' : 'Starting empty — add a customer and an invoice first, then record its payments here.', 'success');
}

function onClick(e) {
  if (e.target.closest('#rc-guest-sample')) { onGuestReset(true); return; }
  if (e.target.closest('#rc-guest-clear')) { onGuestReset(false); return; }
  const f = e.target.closest('[data-filter]');
  if (f) { state.filter = f.dataset.filter; renderFilters(); renderList(); return; }
  if (e.target.closest('[data-act="new"]')) { openEditor(null); return; }
  const o = e.target.closest('[data-open]');
  if (o) openReceipt(o.dataset.open);
}

// ------------------------------------------------------------
// View
// ------------------------------------------------------------

async function openReceipt(id) {
  let r;
  try {
    const json = isGuest()
      ? { success: !!guestBusiness.receiptDetail(id), receipt: guestBusiness.receiptDetail(id), messages: ['Receipt not found.'] }
      : await (await fetch(`${api()}?detail=${encodeURIComponent(id)}`)).json();
    if (!json.success) throw new Error(json.messages?.[0] || 'Receipt not found.');
    r = json.receipt;
  } catch (err) { showToast(err.message, 'error'); return; }

  const pdfUrl = `${base()}api/receipts-pdf?id=${encodeURIComponent(r.id)}`;
  const invoiceUrl = r.invoice_id && data.can_invoices ? `${data.invoices_url}?open=${encodeURIComponent(r.invoice_id)}` : '';
  const btn = 'inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-semibold transition-colors';
  const outline = `${btn} border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800`;
  const canEmail = data.can_email && r.active;

  const html = `
    <div class="space-y-5" data-receipt>
      <div class="flex flex-wrap items-center gap-2">
        ${statePills(r)}
        <span class="text-sm text-gray-500 dark:text-gray-400 mr-auto">${escapeHtml(r.customer)} · ${money(r.amount, r.currency)}</span>
        <button type="button" data-a="edit" class="${btn} bg-primary-600 hover:bg-primary-700 text-white shadow-sm">Edit</button>
        ${isGuest() ? `<button type="button" data-a="print" class="${outline}">${svg(ICON.pdf)} Print / Save as PDF</button>` : `
        <a href="${pdfUrl}" target="_blank" rel="noopener" class="${outline}">${svg(ICON.eye)} PDF</a>
        <a href="${pdfUrl}&download=1" class="${outline}">${svg(ICON.pdf)} Download</a>`}
        <button type="button" data-a="email" class="${outline} ${canEmail ? '' : 'opacity-50'}" ${data.can_email ? '' : 'title="Email isn’t set up on this server yet"'}>${svg(ICON.mail)} Email</button>
        ${r.active
          ? `<button type="button" data-a="void" class="${btn} text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40" title="Void — keeps it on file, stops it counting as paid">${svg(ICON.ban)} Void</button>`
          : `<button type="button" data-a="restore" class="${btn} text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40" title="Restore — counts as paid again">${svg(ICON.undo)} Restore</button>`}
        <button type="button" data-a="delete" class="${btn} text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" title="Delete">${svg(ICON.trash)}</button>
      </div>

      <!-- Paper -->
      <div data-paper class="relative overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-950 shadow-inner p-5 sm:p-8">
        ${r.active ? '' : '<span aria-hidden="true" class="pointer-events-none absolute top-1/3 left-1/2 -translate-x-1/2 -rotate-12 rounded-xl border-4 border-red-500/70 px-6 py-1 text-5xl font-black tracking-[0.3em] text-red-500/70">VOID</span>'}
        <div class="flex flex-wrap items-start justify-between gap-4">
          <div class="flex items-center gap-3">${avatar(r.customer_id, r.customer, 'h-12 w-12', 'text-sm')}
            <div><p class="text-[11px] font-bold uppercase tracking-wider text-gray-400">Received from</p><p class="text-base font-bold text-gray-900 dark:text-white">${escapeHtml(r.customer)}</p>
              ${[r.customer_place, r.customer_email].filter(Boolean).map((s) => `<p class="text-xs text-gray-500">${escapeHtml(s)}</p>`).join('')}</div>
          </div>
          <div class="text-right">
            <p class="text-2xl font-bold tracking-widest uppercase text-emerald-600">Receipt</p>
            <p class="text-sm font-mono font-semibold text-gray-700 dark:text-gray-200">${escapeHtml(r.number)}</p>
          </div>
        </div>

        <div class="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border-l-4 border-emerald-500 px-4 py-3">
          <div>
            <p class="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Amount received</p>
            <p class="text-3xl font-black tracking-tight text-gray-900 dark:text-white">${money(r.amount, r.currency)}</p>
          </div>
          <span class="rounded-full bg-white dark:bg-gray-900 px-3 py-1 text-xs font-bold text-gray-700 dark:text-gray-200 shadow-sm">${METHOD_ICON[r.method] || '•'} ${escapeHtml(r.method || '—')}</span>
        </div>

        <div class="mt-4 grid grid-cols-3 gap-3 text-sm">
          <div><p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Paid on</p><p class="font-semibold text-gray-800 dark:text-gray-100">${shortDate(r.date)}</p></div>
          <div><p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Recorded</p><p class="font-semibold text-gray-800 dark:text-gray-100">${shortDate(r.created) || '—'}</p></div>
          <div><p class="text-[10px] font-bold uppercase tracking-wider text-gray-400">Currency</p><p class="font-semibold text-gray-800 dark:text-gray-100">${escapeHtml(r.currency)}</p></div>
        </div>

        <table class="mt-5 w-full text-sm">
          <thead><tr class="border-b-2 border-emerald-500 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
            <th class="py-2 pr-2 text-left">Invoice</th><th class="py-2 px-2 text-left">Project / reference</th><th class="py-2 pl-2 text-right">Applied</th></tr></thead>
          <tbody><tr class="align-top">
            <td class="py-3 pr-2 font-mono font-semibold whitespace-nowrap">${invoiceUrl ? `<a href="${escapeHtml(invoiceUrl)}" data-partial class="text-primary-600 hover:underline">${escapeHtml(r.invoice_number)}</a>` : escapeHtml(r.invoice_number)}</td>
            <td class="py-3 px-2 text-gray-800 dark:text-gray-100">${escapeHtml(r.invoice_title)}</td>
            <td class="py-3 pl-2 text-right whitespace-nowrap font-semibold text-gray-900 dark:text-white">${money(r.amount, r.currency)}</td></tr></tbody>
        </table>
        <div class="mt-4 ml-auto w-full sm:w-72 space-y-1.5 text-sm">
          <div class="flex justify-between text-gray-500"><span>Invoice total</span><span>${money(r.invoice_total, r.currency)}</span></div>
          <div class="flex justify-between text-emerald-600"><span>Paid to date</span><span>−${money(r.invoice_paid, r.currency)}</span></div>
          <div class="flex justify-between border-t-2 border-emerald-500 pt-2 text-lg font-bold text-emerald-600"><span>${r.invoice_balance > 0 ? 'Balance remaining' : 'Paid in full'}</span><span>${money(r.invoice_balance, r.currency)}</span></div>
        </div>

        ${r.note ? `
          <div class="mt-5 rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-100 dark:border-gray-800 px-4 py-3">
            <p class="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-0.5">Reference</p>
            <p class="text-sm text-gray-700 dark:text-gray-200 whitespace-pre-line">${escapeHtml(r.note)}</p>
          </div>` : ''}
        <p class="mt-6 text-center text-sm font-semibold text-gray-500 dark:text-gray-400">Thank you for your payment.</p>
      </div>

      ${invoiceUrl ? `<a href="${escapeHtml(invoiceUrl)}" data-partial class="inline-flex items-center gap-1.5 text-sm font-semibold text-primary-600 hover:underline">Open invoice ${escapeHtml(r.invoice_number)} ${svg(ICON.arrow)}</a>` : ''}
    </div>`;
  modal?.destroy();
  modal = new Modal({ id: 'rc-view', title: r.number, size: 'lg', showFooter: false, content: html });
  modal.open();
  const root = document.getElementById('rc-view');

  root.addEventListener('click', async (e) => {
    const a = e.target.closest('[data-a]')?.dataset.a;
    if (!a) return;
    try {
      if (a === 'print') {
        printPaper(root.querySelector('[data-paper]'), r.number);
      } else if (a === 'edit') {
        openEditor(r);
      } else if (a === 'email') {
        if (isGuest()) { showToast('Emailing receipts is available once you sign in — in this demo, use Print / Save as PDF.', 'error'); return; }
        if (!data.can_email) { showToast('Email isn’t set up on this server yet — download the PDF and send it yourself.', 'error'); return; }
        if (!r.active) { showToast('This receipt is voided — restore it before sending it.', 'error'); return; }
        openEmail(r);
      } else if (a === 'void' || a === 'restore') {
        if (a === 'void' && !(await confirmDialog(`Void receipt <strong>${escapeHtml(r.number)}</strong>? It stays on file but no longer counts towards ${escapeHtml(r.invoice_number)}.`, 'Void', 'Cancel', 'bg-amber-600 hover:bg-amber-700'))) return;
        const json = await post({ action: a, id: r.id });
        adopt(json); render(); showToast(json.messages?.[0] || 'Updated.', 'success'); openReceipt(r.id);
      } else if (a === 'delete') {
        if (!(await confirmDialog(`Delete receipt <strong>${escapeHtml(r.number)}</strong> for good? ${r.active ? `${escapeHtml(r.invoice_number)} will show ${money(r.amount, r.currency)} less paid. ` : ''}Its number won't be reused.`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
        const json = await post({ action: 'delete', id: r.id });
        adopt(json); modal.close(); render(); showToast(json.messages?.[0] || 'Deleted.', 'success');
      }
    } catch (err) { showToast(err.message, 'error'); }
  });
}

/** Guest "PDF": the paper view in a clean window, printed (the browser can save it as PDF). */
function printPaper(paper, number) {
  const w = window.open('', '_blank');
  if (!w) { showToast('Allow pop-ups to print the receipt.', 'error'); return; }
  const styles = [...document.querySelectorAll('link[rel="stylesheet"]')].map((l) => `<link rel="stylesheet" href="${escapeHtml(l.href)}">`).join('');
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Receipt ${escapeHtml(number)}</title>${styles}
    <style>body{background:#fff;padding:24px}@media print{body{padding:0}}</style></head>
    <body class="bg-white">${paper.outerHTML.replace('shadow-inner', '')}</body></html>`);
  w.document.close();
  w.addEventListener('load', () => { w.focus(); w.print(); });
}

function openEmail(r) {
  modal?.destroy();
  modal = new Modal({
    id: 'rc-email', title: `Email ${r.number}`, size: 'md', showFooter: false,
    content: `
      <form id="rc-email-form" class="space-y-4" novalidate>
        <div><label for="rc-to" class="${lbl}">To</label><input id="rc-to" name="to" type="email" value="${escapeHtml(r.customer_email)}" class="${input}" placeholder="customer@company.com"></div>
        <div><label for="rc-msg" class="${lbl}">Message</label><textarea id="rc-msg" name="message" rows="5" class="${input} resize-y">Hello,

Thank you for your payment of ${money(r.amount, r.currency)} received ${shortDate(r.date)} towards invoice ${escapeHtml(r.invoice_number)} (${escapeHtml(r.invoice_title)}). Receipt ${escapeHtml(r.number)} is attached.
${r.invoice_balance > 0 ? `\nThe remaining balance is ${money(r.invoice_balance, r.currency)}.\n` : '\nThe invoice is now paid in full.\n'}
Thank you for your business.</textarea></div>
        <p class="text-xs text-gray-500 dark:text-gray-400">The receipt PDF is attached.</p>
        <div class="api-message"></div>
        <div class="flex justify-end gap-3 pt-3 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-cancel class="${ghost}">Cancel</button>
          <button type="submit" class="${primary}">Send</button>
        </div>
      </form>`,
  });
  modal.open();
  const form = document.getElementById('rc-email-form');
  form.querySelector('[data-cancel]').addEventListener('click', () => openReceipt(r.id));
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('button[type="submit"]');
    b.disabled = true;
    try {
      const f = Object.fromEntries(new FormData(form).entries());
      const json = await post({ action: 'email', id: r.id, ...f });
      adopt(json); render(); showToast(json.messages?.[0] || 'Sent.', 'success'); openReceipt(r.id);
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

/** The editor's identity-card avatar: the customer's logo, their initials, or a receipt. */
const whoAvatar = (who) => (who?.logo
  ? `<img src="${escapeHtml(who.logo)}" alt="" class="h-full w-full object-cover bg-white">`
  : (who ? escapeHtml(initials(who.name)) : '🧾'));

/**
 * Record a payment (r = null) or edit receipt r. `forInvoice` preselects an
 * invoice and fills in its balance (from the Invoices page).
 */
function openEditor(r, forInvoice = '') {
  const isEdit = !!r;
  const v = r || { invoice_id: forInvoice, amount: '', date: data.today, method: data.methods[0] || 'E-Transfer', note: '' };
  if (!isEdit && forInvoice) v.amount = owing(invoice(forInvoice)) || '';
  // Invoices that can take a payment (+ this receipt's own, whatever its state)
  const choices = data.invoices.filter((i) => i.id === v.invoice_id || (i.status.id !== CANCELLED && owing(i, r) > 0));
  const methods = data.methods.includes(v.method) || !v.method ? data.methods : [...data.methods, v.method];
  const number = isEdit ? r.number : (data.next_number || 'New receipt');
  const greenChip = 'px-2.5 py-1 rounded-lg text-xs font-semibold border border-emerald-200 dark:border-emerald-800 bg-white/80 dark:bg-gray-900 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors';

  if (!choices.length) {
    showToast(data.invoices.length ? 'Every invoice is paid up — there’s nothing to record a payment against.' : 'Create an invoice first, then record its payments here.', 'error');
    return;
  }

  modal?.destroy();
  modal = new Modal({
    id: 'rc-editor', title: isEdit ? `Edit ${r.number}` : `Record payment · ${data.next_number || ''}`, size: 'lg', showFooter: false,
    content: `
      <form id="rc-form" class="space-y-5" novalidate>
        ${identityCard({
          avatar: whoAvatar(customer(invoice(v.invoice_id)?.customer_id)),
          tag: escapeHtml(number),
          tagDot: isEdit ? (r.active ? 'bg-emerald-300' : 'bg-red-400') : 'bg-emerald-300 animate-pulse',
          title: escapeHtml(invoice(v.invoice_id)?.customer || 'Choose an invoice'),
          sub: escapeHtml(invoice(v.invoice_id) ? `${invoice(v.invoice_id).number} · ${invoice(v.invoice_id).title}` : 'Who paid, and for what'),
          aside: `<div class="text-right flex-shrink-0">
              <p data-preview-total class="text-2xl sm:text-3xl font-bold tracking-tight">$0.00</p>
              <p data-preview-meta class="text-[11px] font-semibold uppercase tracking-wider text-white/60"></p></div>`,
        })}

        ${formSection(TONE.orange, '🧾', 'Applied to', 'The invoice this payment goes towards.', `
          <label for="rc-invoice" class="${kitLabel}">Invoice</label>
          <select id="rc-invoice" name="invoice_id" class="${kitInput}"><option value="">Choose an invoice…</option>
            ${choices.map((i) => `<option value="${escapeHtml(i.id)}" ${i.id === v.invoice_id ? 'selected' : ''}>${escapeHtml(i.number)} — ${escapeHtml(i.customer)} — ${money(owing(i, r), i.currency)} owing</option>`).join('')}</select>
          <div data-inv-summary class="mt-3"></div>
          ${data.can_invoices && !isEdit ? `<a href="${escapeHtml(data.invoices_url)}" data-partial class="mt-2 ml-1 inline-block text-xs font-semibold text-orange-600 dark:text-orange-400 hover:underline">Not invoiced yet? Create the invoice in Invoices</a>` : ''}`)}

        ${formSection(TONE.green, '💵', 'Payment', 'What came in, when, and how.', `
          <div class="grid gap-4 sm:grid-cols-2">
            <div><label for="rc-amount" class="${kitLabel}">Amount received</label>
              <div class="relative"><span class="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-400">$</span>
                <input id="rc-amount" name="amount" inputmode="decimal" value="${escapeHtml(String(v.amount))}" placeholder="0.00" class="${kitInput} pl-8 text-right font-semibold"></div>
              <div class="mt-1.5 flex flex-wrap gap-1"><button type="button" data-fill="1" class="${greenChip}">Full balance</button><button type="button" data-fill="0.5" class="${greenChip}">Half</button></div></div>
            <div><label for="rc-date" class="${kitLabel}">Paid on</label><input id="rc-date" name="date" type="date" value="${escapeHtml(v.date || '')}" max="${escapeHtml(addDays(365))}" class="${kitInput}">
              <div class="mt-1.5 flex flex-wrap gap-1"><button type="button" data-day="0" class="${greenChip}">Today</button><button type="button" data-day="-1" class="${greenChip}">Yesterday</button></div></div>
          </div>
          <p class="${kitLabel} mt-4">Paid by</p>
          <div class="grid grid-cols-2 sm:grid-cols-4 gap-2">
            ${methods.map((m) => `<label class="cursor-pointer">
              <input type="radio" name="method" value="${escapeHtml(m)}" ${m === v.method ? 'checked' : ''} class="peer sr-only">
              <span class="flex items-center gap-2 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 text-sm font-semibold text-gray-600 dark:text-gray-300 transition-all hover:border-emerald-300 peer-checked:border-emerald-500 peer-checked:bg-emerald-50 peer-checked:text-emerald-800 dark:peer-checked:bg-emerald-950/40 dark:peer-checked:text-emerald-200 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-400">
                <span aria-hidden="true">${METHOD_ICON[m] || '•'}</span>${escapeHtml(m)}</span></label>`).join('')}
          </div>`)}

        ${formSection(TONE.sky, '📝', 'Reference', 'Optional — a confirmation number, cheque number or a note. Printed on the receipt.', `
          <textarea id="rc-note" name="note" rows="2" maxlength="255" placeholder="e.g. Interac ref C1A2B3, or cheque #1042" class="${kitInput} resize-y">${escapeHtml(v.note || '')}</textarea>
          <p data-note-count class="mt-1 mr-1 text-right text-[11px] text-gray-400"></p>`)}

        <div class="relative overflow-hidden rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-sky-500 p-4 sm:p-5 text-white shadow-lg shadow-emerald-500/25">
          <div aria-hidden="true" class="pointer-events-none absolute -top-10 right-1/4 h-32 w-32 rounded-full bg-white/20 blur-2xl"></div>
          <div class="relative flex flex-col-reverse sm:flex-row sm:items-end gap-4">
            <div class="min-w-0"><p class="text-xs font-bold uppercase tracking-wider text-white/80">After this payment</p>
              <p data-after class="text-base sm:text-lg font-bold truncate">—</p></div>
            <div class="sm:ml-auto text-right">
              <p class="text-xs font-bold uppercase tracking-wider text-white/80">Received</p>
              <p data-total class="text-4xl font-black tracking-tight drop-shadow-sm">$0.00</p>
            </div>
          </div>
        </div>
        <div class="api-message"></div>
        <div class="flex justify-end gap-3">
          <button type="button" data-cancel class="${kitGhost}">Cancel</button>
          <button type="submit" class="${kitSubmit} min-w-[9rem]">${isEdit ? 'Save changes' : 'Record payment'}</button>
        </div>
      </form>`,
  });
  modal.open();

  const form = document.getElementById('rc-form');
  const field = (n) => form.querySelector(`[name="${n}"]`);
  const num = (s) => { const n = parseFloat(String(s).replace(/[,$\s]/g, '')); return Number.isFinite(n) ? n : 0; };
  const counts = () => !isEdit || r.active; // a voided receipt doesn't count towards the invoice

  const refresh = () => {
    const inv = invoice(field('invoice_id').value);
    const cur = inv?.currency || 'CAD';
    const amount = round2(num(field('amount').value));
    const left = owing(inv, r);
    const method = form.querySelector('[name="method"]:checked')?.value || '';
    const date = field('date').value;

    form.querySelector('[data-total]').textContent = money(amount, cur);
    form.querySelector('[data-preview-total]').textContent = money(amount, cur);
    form.querySelector('[data-preview-meta]').textContent = [method, date ? shortDate(date) : ''].filter(Boolean).join(' · ');

    form.querySelector('[data-inv-summary]').innerHTML = inv ? `
      <div class="grid grid-cols-3 gap-2 text-center">
        ${[['Invoice total', money(inv.total, cur), 'text-gray-900 dark:text-white'],
          ['Paid so far', money(round2(inv.total - left), cur), 'text-emerald-600 dark:text-emerald-400'],
          ['Owing', money(left, cur), left > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-400']].map(([l, val, cls]) => `
          <div class="rounded-xl bg-white/80 dark:bg-gray-900 ring-1 ring-orange-100 dark:ring-orange-900/40 px-2 py-2">
            <span class="block text-sm font-bold ${cls}">${val}</span>
            <span class="block text-[10px] font-semibold uppercase tracking-wider text-gray-400">${l}</span></div>`).join('')}
      </div>
      <p class="mt-2 ml-1 text-xs text-gray-500 dark:text-gray-400">${pill(inv.status)} <span class="ml-1">${escapeHtml(inv.title)}${inv.due ? ` · due ${shortDate(inv.due)}` : ''}</span></p>` : '';

    const after = form.querySelector('[data-after]');
    if (!inv) after.textContent = 'Choose an invoice';
    else if (!counts()) after.textContent = 'Voided — doesn’t count towards the invoice';
    else if (amount <= 0) after.textContent = `${money(left, cur)} still owing on ${inv.number}`;
    else if (amount - left > 0.004) after.textContent = `That’s ${money(round2(amount - left), cur)} more than what’s owing`;
    else if (left - amount < 0.005) after.textContent = `${inv.number} is paid in full 🎉`;
    else after.textContent = `${money(round2(left - amount), cur)} left to pay on ${inv.number}`;
    form.querySelector('[data-total]').classList.toggle('text-red-100', !!inv && counts() && amount - left > 0.004);

    form.querySelector('[data-note-count]').textContent = `${field('note').value.length} / 255`;
  };

  const onInvoice = () => {
    const inv = invoice(field('invoice_id').value);
    form.querySelector('[data-preview-title]').textContent = inv?.customer || 'Choose an invoice';
    form.querySelector('[data-preview-sub]').textContent = inv ? `${inv.number} · ${inv.title}` : 'Who paid, and for what';
    form.querySelector('[data-preview-avatar]').innerHTML = whoAvatar(customer(inv?.customer_id));
    bumpAvatar(form);
    // A new payment starts at the full balance
    if (!isEdit && inv) field('amount').value = owing(inv) || '';
  };

  form.addEventListener('input', refresh);
  form.addEventListener('change', (e) => { if (e.target.name === 'invoice_id') onInvoice(); refresh(); });
  refresh();

  form.addEventListener('click', (e) => {
    const fill = e.target.closest('[data-fill]');
    if (fill) {
      const left = owing(invoice(field('invoice_id').value), r);
      if (!left) { showToast('Choose an invoice that still has something owing.', 'error'); return; }
      field('amount').value = round2(left * Number(fill.dataset.fill)).toFixed(2);
      refresh(); return;
    }
    const day = e.target.closest('[data-day]');
    if (day) { field('date').value = addDays(Number(day.dataset.day)); refresh(); return; }
    if (e.target.closest('[data-cancel]')) { if (isEdit) openReceipt(r.id); else modal.close(); }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const b = form.querySelector('button[type="submit"]');
    b.disabled = true;
    form.querySelector('.api-message').innerHTML = '';
    const f = Object.fromEntries(new FormData(form).entries());
    try {
      const json = await post({ action: 'save', id: r?.id || '', invoice_id: f.invoice_id, amount: (f.amount || '').trim(), date: f.date, method: f.method || '', note: f.note || '' });
      adopt(json); render(); showToast(json.messages?.[0] || 'Saved.', 'success'); openReceipt(json.saved);
    } catch (err) {
      form.querySelector('.api-message').innerHTML = errorsHtml(err);
      form.querySelector('.api-message').scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } finally { b.disabled = false; }
  });
}
