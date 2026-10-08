// /resources/js/pages/cash-flow-page.js
//
// Cash Flow: the whole ledger lives in memory (seeded from #cf-data), and a
// single render() recomputes every total, chart and list row from it. So:
//   - period / type / search filters update everything instantly (no fetch)
//   - saving, deleting or attaching a receipt patches the ledger from the
//     API response and re-renders on the spot
//   - the entry form shows its effect on that month's totals as you type
// Filters scope everything below them, so the numbers always agree.

import { Modal } from '../factories/modal-factory.js';
import { createDeleteHandler } from '../factories/delete-factory.js';
import { createUploadHandler } from '../modals/upload-modal.js';
import { FormValidator } from '../utils/form-validator.js';
import { buttonSpinner } from '../utils/spinner-utils.js';
import { showToast } from '../ui/toast.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { cashFlowForm, localDate } from '../forms/cash-flow-form.js';
import { money, compactMoney, renderFlowChart, renderBalanceChart, renderTopChart } from '../utils/cash-flow/charts.js';
import { guestStore } from '../utils/cash-flow/guest-store.js';
import { confirmDialog } from '../ui/confirm.js';
import { createScreensaver, SAVER_IDLE_MS } from '../utils/screensaver.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/cash-flow`;

let ledger = [];
// 'guest' = try-it demo: the ledger lives in this browser (guest-store.js),
// nothing goes to the server; 'account' = the signed-in owner's real ledger.
let mode = 'account';
const isGuest = () => mode === 'guest';
let state = { period: 'month', type: 'all', q: '' };
let modal = null;
let shown = { net: 0, in: 0, out: 0 }; // last rendered KPI values (for tweening)
let resizeObserver = null;
let headerObserver = null; // shows the compact header once #cf-header scrolls away
// Created once per page visit: the shared delete factory reuses its dialog and
// would stack another confirm listener each time a handler is created.
let entryDeleter = null;
let receiptDeleter = null;

// TV screensaver (utils/screensaver.js): after SAVER_IDLE_MS untouched, a
// dimmed, slowly drifting card with this month's money in / out / net and
// the latest entries — protects a screen left showing the ledger for hours.
const SAVER_TICK_MS = 30 * 1000;
let saver = null;
let saverTimer = null;
let lastInteraction = Date.now();
let saverBound = false;

// ------------------------------------------------------------
// Dates (local, never UTC)
// ------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const monthStart = (y, m) => new Date(y, m, 1);
const monthEnd = (y, m) => new Date(y, m + 1, 0);
const longDate = (d) => d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
const monthLabel = (d) => d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' });

/** {start, end, prev: {start,end}|null, label, prevLabel} for a period key. */
function periodRange(key) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  switch (key) {
    case 'last-month': {
      const s = monthStart(y, m - 1);
      return { start: s, end: monthEnd(y, m - 1), prev: { start: monthStart(y, m - 2), end: monthEnd(y, m - 2) }, label: monthLabel(s), prevLabel: 'the month before' };
    }
    case 'quarter':
      return { start: monthStart(y, m - 2), end: monthEnd(y, m), prev: { start: monthStart(y, m - 5), end: monthEnd(y, m - 3) }, label: 'the last 3 months', prevLabel: 'the 3 months before' };
    case 'year':
      return { start: new Date(y, 0, 1), end: new Date(y, 11, 31), prev: { start: new Date(y - 1, 0, 1), end: new Date(y - 1, 11, 31) }, label: String(y), prevLabel: String(y - 1) };
    case 'all': {
      const dates = ledger.map((t) => t.date).filter(Boolean).sort();
      const start = dates.length ? parse(dates[0]) : monthStart(y, m);
      const last = dates.length ? parse(dates[dates.length - 1]) : now;
      return { start: monthStart(start.getFullYear(), start.getMonth()), end: last > now ? last : now, prev: null, label: 'all time', prevLabel: '' };
    }
    default:
      return { start: monthStart(y, m), end: monthEnd(y, m), prev: { start: monthStart(y, m - 1), end: monthEnd(y, m - 1) }, label: monthLabel(now), prevLabel: 'last month' };
  }
}

// ------------------------------------------------------------
// Slicing & aggregation
// ------------------------------------------------------------

function matches(t) {
  if (state.type !== 'all' && t.type !== state.type) return false;
  if (state.q) {
    const q = state.q.toLowerCase();
    if (!(`${t.title} ${t.ref} ${t.details}`.toLowerCase().includes(q))) return false;
  }
  return true;
}

function inRange(t, range) {
  return t.date && t.date >= iso(range.start) && t.date <= iso(range.end);
}

function totals(entries) {
  let inn = 0, out = 0;
  entries.forEach((t) => { if (t.type === 'income') inn += t.amount; else out += t.amount; });
  return { in: round(inn), out: round(out), net: round(inn - out), count: entries.length };
}
const round = (n) => Math.round(n * 100) / 100;

/** Chart buckets for the range: days (month views), weeks (3 months), months (year / all). */
function buckets(range, entries) {
  const out = [];
  const spanDays = Math.round((range.end - range.start) / 864e5) + 1;
  const push = (s, e, label, title) => out.push({ start: iso(s), end: iso(e), label, title, in: 0, out: 0 });

  if (spanDays <= 31) {
    for (let d = new Date(range.start); d <= range.end; d = addDays(d, 1)) push(d, d, String(d.getDate()), longDate(d));
  } else if (spanDays <= 100) {
    for (let d = new Date(range.start); d <= range.end; d = addDays(d, 7)) {
      const e = addDays(d, 6) > range.end ? range.end : addDays(d, 6);
      push(d, e, `${MONTHS[d.getMonth()]} ${d.getDate()}`, `Week of ${longDate(d)}`);
    }
  } else {
    const months = (range.end.getFullYear() - range.start.getFullYear()) * 12 + range.end.getMonth() - range.start.getMonth() + 1;
    if (months > 48) {
      for (let yy = range.start.getFullYear(); yy <= range.end.getFullYear(); yy++) push(new Date(yy, 0, 1), new Date(yy, 11, 31), String(yy), String(yy));
    } else {
      for (let i = 0; i < months; i++) {
        const s = monthStart(range.start.getFullYear(), range.start.getMonth() + i);
        push(s, monthEnd(s.getFullYear(), s.getMonth()), months > 12 ? `${MONTHS[s.getMonth()]} ’${String(s.getFullYear()).slice(2)}` : MONTHS[s.getMonth()], monthLabel(s));
      }
    }
  }

  entries.forEach((t) => {
    const b = out.find((x) => t.date >= x.start && t.date <= x.end);
    if (b) b[t.type === 'income' ? 'in' : 'out'] += t.amount;
  });
  out.forEach((b) => { b.in = round(b.in); b.out = round(b.out); });
  return out;
}

function topExpenses(entries, limit = 6) {
  const groups = new Map();
  entries.filter((t) => t.type === 'expense').forEach((t) => {
    const key = t.title.trim().toLowerCase();
    const g = groups.get(key) || { label: t.title.trim(), value: 0, count: 0 };
    g.value += t.amount; g.count += 1;
    groups.set(key, g);
  });
  const rows = [...groups.values()].sort((a, b) => b.value - a.value);
  if (rows.length > limit) {
    const rest = rows.splice(limit - 1);
    rows.push({ label: 'Everything else', value: rest.reduce((s, r) => s + r.value, 0), count: rest.reduce((s, r) => s + r.count, 0) });
  }
  return rows.map((r) => ({ ...r, value: round(r.value) }));
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function render() {
  const page = document.getElementById('cash-flow-page');
  if (!page) return;

  const range = periodRange(state.period);
  const slice = ledger.filter((t) => matches(t) && inRange(t, range));
  const now = totals(slice);
  const prev = range.prev ? totals(ledger.filter((t) => matches(t) && inRange(t, range.prev))) : null;

  renderKpis(range, now, prev);

  const flow = buckets(range, slice);
  renderFlowChart(document.getElementById('cf-flow-chart'), flow);
  setText('cf-flow-sub', `${flow.length > 0 ? ({ 'month': 'By day', 'last-month': 'By day', 'quarter': 'By week' }[state.period] || 'By month') : ''} · ${range.label}${filterNote()}`);

  let running = 0;
  renderBalanceChart(document.getElementById('cf-balance-chart'), flow.map((b) => ({ title: b.title, value: (running = round(running + b.in - b.out)) })));
  setText('cf-balance-sub', `Money in minus money out, accumulated across ${range.label}${filterNote()}`);

  renderTopChart(document.getElementById('cf-top-chart'), topExpenses(slice));

  renderList(slice, range);
}

const filterNote = () => [state.type !== 'all' ? (state.type === 'income' ? 'money in only' : 'money out only') : '', state.q ? `matching “${state.q}”` : ''].filter(Boolean).map((s) => ` · ${s}`).join('');

function renderKpis(range, now, prev) {
  setText('cf-net-label', `Net · ${cap(range.label)}${filterNote()}`);
  tween('cf-net', shown.net, now.net, (v) => money(v)); shown.net = now.net;
  tween('cf-in', shown.in, now.in, (v) => money(v)); shown.in = now.in;
  tween('cf-out', shown.out, now.out, (v) => money(v)); shown.out = now.out;

  const inCount = count('income', range);
  const outCount = count('expense', range);
  setText('cf-in-sub', `${inCount} ${inCount === 1 ? 'entry' : 'entries'}${prev ? ` · ${delta(now.in, prev.in, range.prevLabel)}` : ''}`);
  setText('cf-out-sub', `${outCount} ${outCount === 1 ? 'entry' : 'entries'}${prev ? ` · ${delta(now.out, prev.out, range.prevLabel)}` : ''}`);
  setText('cf-net-delta', prev ? delta(now.net, prev.net, range.prevLabel, true) : `${now.count} ${now.count === 1 ? 'entry' : 'entries'} recorded`);

  // Share of money in that went back out
  const bar = document.getElementById('cf-kept-bar');
  const val = document.getElementById('cf-kept-value');
  const meter = document.getElementById('cf-kept-meter');
  if (now.in > 0) {
    const pct = Math.round((now.out / now.in) * 100);
    bar.style.width = `${Math.min(100, pct)}%`;
    bar.classList.toggle('bg-primary-400', pct <= 100);
    bar.classList.toggle('bg-red-400', pct > 100);
    val.textContent = pct > 100 ? `${pct}% — more out than in` : `${pct}% · kept ${money(now.net)}`;
    meter.setAttribute('aria-valuenow', String(Math.min(100, pct)));
  } else {
    bar.style.width = '0%';
    val.textContent = now.out > 0 ? 'Nothing came in' : '—';
    meter.setAttribute('aria-valuenow', '0');
  }
}

function count(type, range) {
  return ledger.filter((t) => t.type === type && matches(t) && inRange(t, range)).length;
}

function delta(now, prev, prevLabel, isNet = false) {
  const d = round(now - prev);
  if (d === 0) return `same as ${prevLabel}`;
  const arrow = d > 0 ? '▲' : '▼';
  return `${arrow} ${money(Math.abs(d))} vs ${prevLabel}${isNet ? '' : ''}`;
}

function renderList(slice, range) {
  const list = document.getElementById('cf-list');
  const t = totals(slice);
  setText('cf-list-sub', `${t.count} ${t.count === 1 ? 'entry' : 'entries'} · ${range.label}${filterNote()}`);

  if (!slice.length) {
    list.innerHTML = `
      <div class="py-14 text-center">
        <div class="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 mb-4">
          <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${state.q || state.type !== 'all' ? 'Nothing matches' : 'No entries in this period'}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${ledger.length ? 'Try another period or filter.' : 'Record your first entry to see your cash flow come alive.'}</p>
      </div>`;
    return;
  }

  // group by month, newest first
  const groups = [];
  [...slice].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).forEach((e) => {
    const key = e.date.slice(0, 7);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, label: monthLabel(parse(`${key}-01`)), items: [] }));
    g.items.push(e);
  });

  list.innerHTML = groups.map((g) => {
    const gt = totals(g.items);
    return `
    <section class="mt-2 first:mt-0">
      <div class="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
        <h3 class="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">${escapeHtml(g.label)}</h3>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm" style="background: var(--cf-in)"></span>${money(gt.in)}</span>
          <span class="mx-1.5">·</span>
          <span class="inline-flex items-center gap-1"><span class="h-2 w-2 rounded-sm" style="background: var(--cf-out)"></span>${money(gt.out)}</span>
          <span class="mx-1.5">·</span>
          <span class="font-semibold text-gray-700 dark:text-gray-200">net ${money(gt.net)}</span>
        </p>
      </div>
      <ul class="divide-y divide-gray-100 dark:divide-gray-800/70">${g.items.map(rowHtml).join('')}</ul>
    </section>`;
  }).join('');
}

function rowHtml(e) {
  const d = parse(e.date);
  const isIn = e.type === 'income';
  return `
  <li class="cf-row group relative flex items-center gap-3 sm:gap-4 pl-4 pr-2 py-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors" data-id="${e.encoded_id}">
    <span class="absolute left-1 top-3 bottom-3 w-1 rounded-full" style="background: var(${isIn ? '--cf-in' : '--cf-out'})" aria-hidden="true"></span>
    <div class="h-11 w-11 flex-shrink-0 rounded-xl bg-gray-100 dark:bg-gray-800 flex flex-col items-center justify-center">
      <span class="text-[10px] font-semibold uppercase leading-none text-gray-500 dark:text-gray-400">${d.toLocaleDateString('en-CA', { weekday: 'short' })}</span>
      <span class="text-base font-bold leading-tight text-gray-900 dark:text-white">${d.getDate()}</span>
    </div>
    <button type="button" class="cf-view min-w-0 flex-1 text-left focus:outline-none">
      <span class="block text-sm font-semibold text-gray-900 dark:text-white truncate group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">${escapeHtml(e.title)}</span>
      <span class="block text-xs text-gray-500 dark:text-gray-400 truncate">${escapeHtml(e.ref)}${e.details ? ` · ${escapeHtml(e.details)}` : ''}</span>
    </button>
    ${e.receipt_url ? `<button type="button" class="cf-receipt-view flex-shrink-0 h-9 w-9 rounded-lg overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700" title="View receipt"><img src="${escapeHtml(e.receipt_url)}" alt="Receipt" class="h-full w-full object-cover"></button>` : ''}
    <div class="text-right flex-shrink-0">
      <span class="block text-sm font-bold text-gray-900 dark:text-white" style="font-variant-numeric: tabular-nums">${isIn ? '+' : '−'}${money(e.amount)}</span>
      <span class="block text-[11px] text-gray-500 dark:text-gray-400">${isIn ? 'Money in' : 'Money out'}</span>
    </div>
    <div class="flex items-center flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
      <button type="button" class="cf-receipt ${isGuest() ? 'hidden ' : ''}p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40" title="${e.receipt_url ? 'Replace receipt' : 'Attach receipt'}" aria-label="${e.receipt_url ? 'Replace receipt' : 'Attach receipt'}">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
      </button>
      <button type="button" class="cf-edit p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40" title="Edit" aria-label="Edit entry">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
      </button>
      <button type="button" class="cf-delete p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40" title="Delete" aria-label="Delete entry">
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
      </button>
    </div>
  </li>`;
}

// ------------------------------------------------------------
// Small UI helpers
// ------------------------------------------------------------

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
function setText(id, text) { const e = document.getElementById(id); if (e) e.textContent = text; }

/** Count a number up/down to its new value (skipped for reduced motion). */
function tween(id, from, to, fmt) {
  const node = document.getElementById(id);
  if (!node) return;
  if (from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) { node.textContent = fmt(to); return; }
  const start = performance.now();
  const dur = 450;
  const step = (now) => {
    const p = Math.min(1, (now - start) / dur);
    const eased = 1 - (1 - p) ** 3;
    node.textContent = fmt(round(from + (to - from) * eased));
    if (p < 1 && node.isConnected) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setPressed(groupId, attr, value) {
  document.querySelectorAll(`#${groupId} [data-${attr}]`).forEach((b) => b.setAttribute('aria-pressed', b.dataset[attr] === value ? 'true' : 'false'));
}

function upsert(entry) {
  const i = ledger.findIndex((t) => t.encoded_id === entry.encoded_id);
  if (i >= 0) ledger[i] = entry; else ledger.unshift(entry);
}

const byId = (id) => ledger.find((t) => t.encoded_id === id);

// ------------------------------------------------------------
// Entry form (with live impact)
// ------------------------------------------------------------

function openForm(entry = null) {
  modal?.destroy();
  modal = new Modal({ id: entry ? 'cf-edit-modal' : 'cf-add-modal', title: entry ? 'Edit entry' : 'Record entry', size: 'md', showFooter: false, content: cashFlowForm(entry) });
  modal.open();

  const form = document.getElementById('cf-form');
  if (!form) return;
  const amountInput = form.querySelector('[name="amount"]');
  const dateInput = form.querySelector('[name="transaction_date"]');
  const titleInput = form.querySelector('[name="title"]');
  // After the modal's own autofocus (250ms, first input = the type radio),
  // so the cursor lands where you actually start: the amount.
  setTimeout(() => amountInput?.focus(), 320);

  const impact = () => updateImpact(form, entry);
  form.addEventListener('input', impact);
  form.addEventListener('change', impact);
  impact();

  form.addEventListener('click', (e) => {
    const chip = e.target.closest('.cf-date-chip');
    if (chip) { dateInput.value = localDate(Number(chip.dataset.offset)); impact(); }
    if (e.target.closest('.cf-cancel')) modal.close();
  });

  initTitleSuggest(titleInput, form, impact);

  const validator = new FormValidator(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const apiMsg = form.querySelector('.api-message');
  const label = submitBtn.innerHTML;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validator.validateForEmptyFields(e)) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = buttonSpinner;
    apiMsg.innerHTML = '';
    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const json = isGuest()
        ? guestStore.save(data, form.dataset.encodedId || '', ledger)
        : await (await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...data, encoded_id: form.dataset.encodedId || '' }) })).json();
      if (!json.success) {
        apiMsg.innerHTML = (json.messages || ['Please check the form.']).map((m) => `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');
        return;
      }
      upsert(json.transaction);
      if (isGuest()) guestStore.persist(ledger);
      modal.close();
      render();
      showToast(json.messages?.[0] || 'Saved.', 'success');
    } catch {
      apiMsg.innerHTML = '<p class="rounded-xl bg-red-50 text-red-700 px-3.5 py-2 text-sm font-medium">Something went wrong. Please try again.</p>';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = label;
    }
  });
}

/** "May 2026: net $441.19 → $391.19 · money out $1,872 → $1,922" as you type. */
function updateImpact(form, entry) {
  const panel = form.querySelector('#cf-impact');
  if (!panel) return;
  const type = form.querySelector('[name="type"]:checked')?.value || 'expense';
  const raw = form.querySelector('[name="amount"]').value.replace(/[,$\s]/g, '');
  const amount = /^\d*\.?\d{0,2}$/.test(raw) && raw !== '' && raw !== '.' ? Number(raw) : NaN;
  const date = form.querySelector('[name="transaction_date"]').value;

  if (!date) { panel.innerHTML = '<p class="text-xs text-gray-500">Pick a date to see the impact.</p>'; return; }

  const d = parse(date);
  const range = { start: monthStart(d.getFullYear(), d.getMonth()), end: monthEnd(d.getFullYear(), d.getMonth()) };
  const others = ledger.filter((t) => inRange(t, range) && t.encoded_id !== entry?.encoded_id);
  const before = totals(entry && inRange(entry, range) ? [...others, entry] : others);

  if (Number.isNaN(amount) || amount <= 0) {
    panel.innerHTML = `<p class="text-xs text-gray-500 dark:text-gray-400">${escapeHtml(monthLabel(d))} so far: net <span class="font-semibold text-gray-900 dark:text-white">${money(before.net)}</span>. Enter an amount to see the change.</p>`;
    return;
  }

  const after = totals([...others, { type, amount, date }]);
  const key = type === 'income' ? 'in' : 'out';
  const up = after.net >= before.net;
  panel.innerHTML = `
    <p class="text-[11px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5">${escapeHtml(monthLabel(d))} after this entry</p>
    <div class="flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
      <span class="text-gray-600 dark:text-gray-300">Net <span class="text-gray-400 line-through decoration-1 ml-1">${money(before.net)}</span>
        <span class="ml-1 font-bold text-gray-900 dark:text-white">${money(after.net)}</span>
        <span class="ml-1 text-xs text-gray-500">${up ? '▲' : '▼'} ${money(Math.abs(round(after.net - before.net)))}</span></span>
      <span class="inline-flex items-center gap-1.5 text-gray-600 dark:text-gray-300"><span class="h-2 w-2 rounded-sm" style="background: var(${key === 'in' ? '--cf-in' : '--cf-out'})"></span>${key === 'in' ? 'Money in' : 'Money out'}
        <span class="font-bold text-gray-900 dark:text-white">${money(after[key])}</span></span>
    </div>`;
}

/** Past titles from your own ledger; picking one also sets its usual type. */
function initTitleSuggest(input, form, onPick) {
  const list = document.createElement('ul');
  list.className = 'absolute z-[100] left-0 right-0 mt-1 max-h-56 overflow-y-auto custom-scrollbar rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl hidden';
  input.parentNode.appendChild(list);
  let items = [];
  let active = -1;

  const hide = () => { list.classList.add('hidden'); active = -1; };
  const choose = (i) => {
    const it = items[i];
    if (!it) return;
    input.value = it.title;
    const radio = form.querySelector(`[name="type"][value="${it.type}"]`);
    if (radio) radio.checked = true;
    hide();
    onPick();
  };
  const refresh = debounce(() => {
    const q = input.value.trim().toLowerCase();
    if (q.length < 2) return hide();
    const seen = new Set();
    items = [];
    for (const t of ledger) {
      const key = `${t.title.toLowerCase()}|${t.type}`;
      if (t.title.toLowerCase().includes(q) && t.title.toLowerCase() !== q && !seen.has(key)) { seen.add(key); items.push({ title: t.title, type: t.type }); }
      if (items.length >= 8) break;
    }
    if (!items.length) return hide();
    list.innerHTML = items.map((it, i) => `
      <li data-i="${i}" class="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30">
        <span class="truncate">${escapeHtml(it.title)}</span>
        <span class="inline-flex items-center gap-1 text-[11px] text-gray-500"><span class="h-2 w-2 rounded-sm" style="background: var(${it.type === 'income' ? '--cf-in' : '--cf-out'})"></span>${it.type === 'income' ? 'in' : 'out'}</span>
      </li>`).join('');
    list.classList.remove('hidden');
  }, 120);

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (list.classList.contains('hidden')) return;
    const lis = [...list.children];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      active = Math.max(0, Math.min(items.length - 1, active + (e.key === 'ArrowDown' ? 1 : -1)));
      lis.forEach((li, i) => li.classList.toggle('bg-primary-50', i === active));
    } else if (e.key === 'Enter' && active >= 0) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  });
  list.addEventListener('mousedown', (e) => { const li = e.target.closest('li[data-i]'); if (li) { e.preventDefault(); choose(Number(li.dataset.i)); } });
  input.addEventListener('blur', () => setTimeout(hide, 100));
}

// ------------------------------------------------------------
// View / receipts / delete
// ------------------------------------------------------------

function openView(entry) {
  modal?.destroy();
  const d = parse(entry.date);
  const isIn = entry.type === 'income';
  modal = new Modal({
    id: 'cf-view-modal', title: isIn ? 'Money in' : 'Money out', size: 'md', showFooter: false,
    content: `
      <div class="cf-root space-y-5">
        <div>
          <p class="text-3xl font-bold text-gray-900 dark:text-white">${isIn ? '+' : '−'}${money(entry.amount)}</p>
          <p class="mt-1 text-base font-semibold text-gray-900 dark:text-white break-words">${escapeHtml(entry.title)}</p>
        </div>
        <dl class="grid grid-cols-2 gap-4 text-sm">
          <div><dt class="text-xs font-semibold uppercase tracking-wider text-gray-400">Date</dt><dd class="mt-0.5 font-medium text-gray-900 dark:text-white">${escapeHtml(longDate(d))}</dd></div>
          <div><dt class="text-xs font-semibold uppercase tracking-wider text-gray-400">Reference</dt><dd class="mt-0.5 font-medium text-gray-900 dark:text-white">${escapeHtml(entry.ref)}</dd></div>
        </dl>
        <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Notes</p>
          ${entry.details ? `<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words">${escapeHtml(entry.details)}</p>` : '<p class="text-sm text-gray-400 italic">No notes.</p>'}
        </div>
        <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Receipt</p>
          ${isGuest()
            ? `<p class="text-sm text-gray-500 dark:text-gray-400">Receipt photos are saved to your account — <a href="${base()}login" data-login-button class="font-semibold text-primary-600 dark:text-primary-400 hover:underline">sign in</a> to attach them.</p>`
            : entry.receipt_url
            ? `<a href="${escapeHtml(entry.receipt_url)}" target="_blank" rel="noopener" class="block rounded-xl overflow-hidden ring-1 ring-gray-200 dark:ring-gray-700"><img src="${escapeHtml(entry.receipt_url)}" alt="Receipt" class="w-full max-h-80 object-contain bg-gray-50 dark:bg-gray-800"></a>
               <div class="mt-2 flex gap-2"><button type="button" data-act="receipt" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-primary-700 dark:text-primary-300 bg-primary-50 dark:bg-primary-950/40 hover:bg-primary-100">Replace</button><button type="button" data-act="receipt-remove" class="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Remove</button></div>`
            : `<button type="button" data-act="receipt" class="w-full rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 py-5 text-sm font-semibold text-gray-500 hover:border-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors">Attach a receipt photo</button>`}
        </div>
        <div class="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-act="delete" class="px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40">Delete</button>
          <button type="button" data-act="edit" class="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm">Edit entry</button>
        </div>
      </div>`,
  });
  modal.open();
  document.getElementById('cf-view-modal')?.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'edit') openForm(entry);
    if (act === 'delete') { modal.close(); confirmDelete(entry); }
    if (act === 'receipt') { modal.close(); attachReceipt(entry); }
    if (act === 'receipt-remove') { modal.close(); removeReceipt(entry); }
  });
}

function attachReceipt(entry) {
  if (isGuest()) { showToast('Sign in to attach receipt photos.', 'error'); return; }
  createUploadHandler(`${base()}api/cash-flow-receipt/${entry.encoded_id}`, 'receipt', (files) => {
    const updated = files?.[0]?.transaction;
    if (updated) { upsert(updated); render(); showToast('Receipt attached.', 'success'); }
  }, 1, true, { single: true, maxFiles: 1 });
}

function removeReceipt(entry) {
  if (isGuest()) { showToast('Sign in to attach receipt photos.', 'error'); return; }
  // Detached element: the factory fades out whatever it's given, and the row
  // itself should stay (only its receipt goes).
  receiptDeleter.showConfirmation(entry.encoded_id, document.createElement('div'), (ok) => {
    if (!ok) return;
    upsert({ ...entry, receipt_url: null });
    render();
    showToast('Receipt removed.', 'success');
  });
}

function confirmDelete(entry) {
  if (isGuest()) {
    confirmDialog(`Delete “${escapeHtml(entry.title)}”?`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700').then((ok) => {
      if (!ok) return;
      ledger = ledger.filter((t) => t.encoded_id !== entry.encoded_id);
      guestStore.persist(ledger);
      render();
      showToast('Entry deleted.', 'success');
    });
    return;
  }
  const row = document.querySelector(`.cf-row[data-id="${entry.encoded_id}"]`) || document.createElement('div');
  entryDeleter.showConfirmation(entry.encoded_id, row, (ok) => {
    if (!ok) return;
    ledger = ledger.filter((t) => t.encoded_id !== entry.encoded_id);
    render();
    showToast('Entry deleted.', 'success');
  });
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

/**
 * The compact header (breadcrumbs + Record entry) pinned under the site
 * header: shown once the page header has scrolled up behind the site header
 * (h-20 = 80px), hidden again when it comes back into view.
 */
function initMiniHeader() {
  headerObserver?.disconnect();
  const header = document.getElementById('cf-header');
  const mini = document.getElementById('cf-mini-header');
  if (!header || !mini || !('IntersectionObserver' in window)) return;

  const toggle = (show) => {
    mini.classList.toggle('opacity-0', !show);
    mini.classList.toggle('-translate-y-2', !show);
    mini.classList.toggle('pointer-events-none', !show);
    mini.inert = !show;
    mini.setAttribute('aria-hidden', String(!show));
  };
  headerObserver = new IntersectionObserver(([entry]) => {
    if (!document.body.contains(mini)) { headerObserver.disconnect(); return; }
    // Only when it's gone off the top — not when it's below the fold
    toggle(!entry.isIntersecting && entry.boundingClientRect.top < 80);
  }, { rootMargin: '-80px 0px 0px 0px' });
  headerObserver.observe(header);
}

export function init() {
  const page = document.getElementById('cash-flow-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  if (isGuest()) {
    ledger = guestStore.load();
  } else {
    try { ledger = JSON.parse(document.getElementById('cf-data')?.textContent || '[]'); } catch { ledger = []; }
  }
  state = { period: 'month', type: 'all', q: '' };
  shown = { net: 0, in: 0, out: 0 };
  entryDeleter = createDeleteHandler(api(), 'Entry');
  receiptDeleter = createDeleteHandler(`${base()}api/cash-flow-receipt`, 'Receipt');

  page.addEventListener('click', async (e) => {
    if (e.target.closest('#cf-guest-sample')) {
      if (await confirmDialog('Replace your guest entries with fresh sample data?', 'Reload sample', 'Cancel', 'bg-primary-600 hover:bg-primary-700')) {
        ledger = guestStore.resetToSample();
        render();
        showToast('Sample data loaded.', 'success');
      }
      return;
    }
    if (e.target.closest('#cf-guest-clear')) {
      if (await confirmDialog('Remove every guest entry and start with an empty ledger?', 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700')) {
        ledger = guestStore.clear();
        render();
        showToast('Started with an empty ledger.', 'success');
      }
      return;
    }
    const p = e.target.closest('[data-period]');
    if (p) { state.period = p.dataset.period; setPressed('cf-periods', 'period', state.period); render(); return; }
    const t = e.target.closest('[data-type]');
    if (t) { state.type = t.dataset.type; setPressed('cf-types', 'type', state.type); render(); return; }
    if (e.target.closest('#cf-add-btn, [data-cf-add]')) { openForm(); return; }

    const row = e.target.closest('.cf-row');
    const entry = row && byId(row.dataset.id);
    if (!entry) return;
    if (e.target.closest('.cf-edit')) openForm(entry);
    else if (e.target.closest('.cf-delete')) confirmDelete(entry);
    else if (e.target.closest('.cf-receipt')) attachReceipt(entry);
    else if (e.target.closest('.cf-receipt-view') || e.target.closest('.cf-view')) openView(entry);
  });

  const search = document.getElementById('cf-search');
  search?.addEventListener('input', debounce(() => { state.q = search.value.trim(); render(); }, 150));

  // Re-flow charts when the layout width changes (sidebar collapse, resize)
  resizeObserver?.disconnect();
  let lastWidth = 0;
  resizeObserver = new ResizeObserver(debounce(() => {
    const w = document.getElementById('cf-charts')?.clientWidth || 0;
    if (w && w !== lastWidth) { lastWidth = w; render(); }
  }, 120));
  const charts = document.getElementById('cf-charts');
  if (charts) resizeObserver.observe(charts);

  initMiniHeader();

  render();
  startSaver(page);
}

// ------------------------------------------------------------
// TV screensaver
// ------------------------------------------------------------

function startSaver(page) {
  if (!saverBound) {
    saverBound = true;
    const touched = () => { lastInteraction = Date.now(); };
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, touched, { passive: true }));
  }
  lastInteraction = Date.now();

  let slides = [];
  try { slides = JSON.parse(page.dataset.slides || '[]'); } catch { /* no photos */ }
  saver?.remove();
  saver = createScreensaver({
    id: 'cf-saver',
    slides,
    paint: saverLines,
    hint: 'Move the mouse or tap anywhere to return to Cash Flow',
    onWake: () => { lastInteraction = Date.now(); },
  });

  clearInterval(saverTimer);
  saverTimer = setInterval(() => {
    if (!document.getElementById('cash-flow-page')) { clearInterval(saverTimer); saver?.remove(); saver = null; return; }
    if (document.visibilityState !== 'visible' || saver.isOpen()) return;
    const busy = document.body.style.overflow === 'hidden'
      || !!document.getElementById('confirm-proceed')
      || !!document.activeElement?.matches?.('input, textarea, select');
    if (!busy && Date.now() - lastInteraction >= SAVER_IDLE_MS) saver.show();
  }, SAVER_TICK_MS);
}

/** Screensaver card: this month's money in / out / net, then the latest entries. */
function saverLines() {
  const now = new Date();
  const range = { start: iso(monthStart(now.getFullYear(), now.getMonth())), end: iso(monthEnd(now.getFullYear(), now.getMonth())) };
  const month = totals(ledger.filter((t) => t.date >= range.start && t.date <= range.end));
  const line = (dot, label, value) => `
    <div class="flex items-center gap-3">
      <span class="h-3 w-3 flex-shrink-0 rounded-full ${dot} opacity-80"></span>
      <p class="text-xl sm:text-2xl text-white/80"><span class="text-white/45 text-base sm:text-lg uppercase tracking-widest mr-2">${label}</span>${value}</p>
    </div>`;
  const latest = [...ledger].sort((a, b) => (b.date || '').localeCompare(a.date || '')).slice(0, 3);
  return `<p class="text-lg text-white/50 mb-1">${escapeHtml(monthLabel(now))}</p>`
    + line('bg-emerald-400', 'In', escapeHtml(money(month.in)))
    + line('bg-rose-400', 'Out', escapeHtml(money(month.out)))
    + line(month.net >= 0 ? 'bg-sky-400' : 'bg-amber-400', 'Net', `${month.net < 0 ? '−' : ''}${escapeHtml(money(Math.abs(month.net)))}`)
    + (latest.length ? `<div class="mt-5 space-y-2">${latest.map((t) => `
      <div class="flex items-center gap-3 text-lg text-white/65">
        <span class="flex-1 truncate">${escapeHtml(t.title)}</span>
        <span class="text-white/45">${t.type === 'income' ? '+' : '−'}${escapeHtml(money(t.amount))}</span>
      </div>`).join('')}</div>` : '');
}
