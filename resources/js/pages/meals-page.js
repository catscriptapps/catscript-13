// /resources/js/pages/meals-page.js
//
// Meals: every plan (they're shared) + the active plan's meals live in
// memory (seeded from #meals-data). render() draws the week grid (a
// day-by-day view on phones), the summary figures and the plan picker from
// that state; every save / remove / plan change patches it from the API
// response and re-renders, so the grid and calorie totals update on the spot.
//
// Permissions come from the server: data.can_plan (may create / duplicate
// plans) and plan.can_edit (owner + meal planner). Other people's plans —
// and every plan, for viewers without the Meal Planner capability — render
// read-only; the API enforces the same rules.
//
// Listeners are delegated from #meals-page, which the SPA router replaces on
// each visit, so they never stack up across navigations.

import { Modal } from '../factories/modal-factory.js';
import { FormValidator } from '../utils/form-validator.js';
import { buttonSpinner } from '../utils/spinner-utils.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { guestMeals } from '../utils/meals/guest-store.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/meals`;

/** Per-type accent (dot, label, cell tint). Full class strings for Tailwind. */
const TYPE_STYLE = {
  breakfast: { dot: 'bg-amber-400', text: 'text-amber-700 dark:text-amber-300', tint: 'bg-amber-50/70 dark:bg-amber-950/20', icon: 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z' },
  lunch:     { dot: 'bg-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', tint: 'bg-emerald-50/70 dark:bg-emerald-950/20', icon: 'M3 17h18M5 17v-1a7 7 0 0114 0v1m-7-11V3m0 0a1 1 0 100 2 1 1 0 000-2z' },
  dinner:    { dot: 'bg-indigo-400', text: 'text-indigo-700 dark:text-indigo-300', tint: 'bg-indigo-50/70 dark:bg-indigo-950/20', icon: 'M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z' },
  snacks:    { dot: 'bg-pink-400', text: 'text-pink-700 dark:text-pink-300', tint: 'bg-pink-50/70 dark:bg-pink-950/20', icon: 'M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.701 2.701 0 00-1.5-.454M9 6v2m3-2v2m3-2v2M9 3h.01M12 3h.01M15 3h.01M21 21v-7a2 2 0 00-2-2H5a2 2 0 00-2 2v7h18zm-3-9v-2a2 2 0 00-2-2H8a2 2 0 00-2 2v2h12z' },
};

let data = { plans: [], plan: null, meals: [], days: [], types: {}, can_plan: false };
let mobileDay = '';
let modal = null;
let loadSeq = 0;
let outsideClickBound = false;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const editable = () => !!data.plan?.can_edit;
const todayName = () => new Date().toLocaleDateString('en-US', { weekday: 'long' });
const kcal = (n) => `${Math.round(n).toLocaleString()} kcal`;
const slotMeal = (day, type) => data.meals.find((m) => m.day === day && m.type === type) || null;
const dayCalories = (day) => data.meals.filter((m) => m.day === day).reduce((s, m) => s + (m.calories || 0), 0);
const typeLabel = (type) => data.types[type] || type;
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;

// Guest (try-it) mode: everything lives in this browser (utils/meals/guest-store.js)
let mode = 'account';
const isGuest = () => mode === 'guest';

async function post(body) {
  if (isGuest()) {
    const json = guestMeals.handle(body);
    if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
    return json;
  }
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw Object.assign(new Error(json.messages?.[0] || 'Something went wrong.'), { messages: json.messages });
  return json;
}

function syncMealCount() {
  const p = data.plans.find((x) => x.encoded_id === data.plan?.encoded_id);
  if (p) p.meal_count = data.meals.length;
}

// ------------------------------------------------------------
// Init & loading
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('meals-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = JSON.parse(document.getElementById('meals-data')?.textContent || '{}'); } catch { /* keep defaults */ }
  data = { plans: [], plan: null, meals: [], days: [], types: {}, can_plan: false, ...data };
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  if (isGuest()) data = { ...data, ...guestMeals.state(new URLSearchParams(window.location.search).get('plan') || '') };
  mobileDay = data.days.includes(todayName()) ? todayName() : data.days[0];

  page.addEventListener('click', onPageClick);
  if (!outsideClickBound) {
    outsideClickBound = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('[data-menu-root]')) closeMenus();
    });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenus(); });
  }

  render();
}

/** Load a plan (or the first plan) from the server and re-render. */
async function loadPlan(encodedId = '') {
  const seq = ++loadSeq;
  const week = document.getElementById('meals-week');
  if (week) week.style.opacity = '0.5';
  try {
    const json = isGuest()
      ? { success: true, ...guestMeals.state(encodedId) }
      : await (await fetch(`${api()}?plan=${encodeURIComponent(encodedId)}`)).json();
    if (seq !== loadSeq) return;
    if (!json.success) throw new Error(json.messages?.[0] || 'Could not load the plan.');
    data = { ...data, plans: json.plans, plan: json.plan, meals: json.meals, can_plan: !!json.can_plan };
    const url = new URL(window.location.href);
    if (json.plan) url.searchParams.set('plan', json.plan.encoded_id); else url.searchParams.delete('plan');
    history.replaceState(history.state, '', url);
    render();
  } catch (err) {
    showToast(err.message, 'error');
  } finally {
    if (seq === loadSeq && week) week.style.opacity = '';
  }
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function render() {
  const hasPlan = !!data.plan;
  document.getElementById('meals-plan-bar')?.classList.toggle('hidden', !hasPlan);
  document.getElementById('meals-summary')?.classList.toggle('hidden', !hasPlan);
  renderPlanPicker();
  renderSummary();
  renderWeek();
}

function renderPlanPicker() {
  const bar = document.getElementById('meals-plan-bar');
  if (!bar) return;
  const title = bar.querySelector('[data-plan-title]');
  if (title) title.textContent = data.plan?.title || '';

  // Grouped: your plans first, then each other person's
  const groups = [];
  data.plans.forEach((p) => {
    const key = p.is_mine ? 'mine' : p.owner;
    let g = groups.find((x) => x.key === key);
    if (!g) groups.push((g = { key, label: p.is_mine ? 'Your plans' : `${p.owner_first}'s plans`, items: [] }));
    g.items.push(p);
  });

  const list = bar.querySelector('[data-plan-list]');
  if (list) {
    list.innerHTML = groups.map((g, gi) => `
      <p class="px-3 ${gi ? 'pt-3' : 'pt-1'} pb-1.5 text-[11px] font-bold uppercase tracking-wider text-gray-400">${escapeHtml(g.label)}</p>
      ${g.items.map((p) => {
        const active = p.encoded_id === data.plan?.encoded_id;
        return `
          <button type="button" data-plan="${escapeHtml(p.encoded_id)}"
            class="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm text-left transition-colors ${active ? 'bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 font-semibold' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium'}">
            <span class="truncate">${escapeHtml(p.title)}</span>
            <span class="flex-shrink-0 text-xs ${active ? '' : 'text-gray-400'}">${p.meal_count} ${p.meal_count === 1 ? 'meal' : 'meals'}</span>
          </button>`;
      }).join('')}`).join('');
  }
  // What the viewer may do with this plan
  const canEdit = editable();
  const show = (act, on) => bar.querySelectorAll(`[data-act="${act}"]`).forEach((b) => b.classList.toggle('hidden', !on));
  show('new-plan', data.can_plan);
  show('edit-plan', canEdit);
  show('clear-week', canEdit);
  show('delete-plan', canEdit);
  show('duplicate-plan', data.can_plan);
  show('pdf', !isGuest()); // the PDF is built on the server from saved plans
  bar.querySelector('[data-edit-divider]')?.classList.toggle('hidden', !canEdit);
  const dup = bar.querySelector('[data-act="duplicate-plan"] [data-label]');
  if (dup) dup.textContent = data.plan?.is_mine ? 'Duplicate plan' : 'Copy to my plans';
  bar.querySelector('[data-new-plan-wrap]')?.classList.toggle('hidden', !data.can_plan);

  // "Ella's plan · view only" note under the page title
  const note = document.getElementById('meals-owner-note');
  if (note) {
    const text = !data.plan || canEdit ? ''
      : data.plan.is_mine ? 'Your plan · view only'
      : `${data.plan.owner_first}'s plan · view only`;
    note.classList.toggle('hidden', !text);
    note.innerHTML = text ? `${svg('M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z', 'h-3.5 w-3.5')}${escapeHtml(text)}` : '';
  }
}

function renderSummary() {
  if (!data.plan) return;
  const slots = data.days.length * Object.keys(data.types).length;
  const week = data.meals.reduce((s, m) => s + (m.calories || 0), 0);
  const daysWithCalories = data.days.filter((d) => dayCalories(d) > 0).length;
  const today = todayName();
  const todayMeals = data.meals.filter((m) => m.day === today);

  const set = (key, value, note) => {
    const v = document.querySelector(`#meals-summary [data-sum="${key}"]`);
    const n = document.querySelector(`#meals-summary [data-sum-note="${key}"]`);
    if (v) v.textContent = value;
    if (n) n.textContent = note || ' ';
  };

  set('planned', `${data.meals.length}/${slots}`, data.meals.length === slots ? 'The whole week is planned' : `${slots - data.meals.length} slots still open`);
  set('week', week ? kcal(week) : '—', week ? 'Across every planned meal' : 'Add calories to any meal');
  set('average', daysWithCalories ? kcal(week / daysWithCalories) : '—', daysWithCalories ? `Over ${daysWithCalories} ${daysWithCalories === 1 ? 'day' : 'days'} with calories` : '');
  const todayCal = dayCalories(today);
  set('today', `${todayMeals.length} ${todayMeals.length === 1 ? 'meal' : 'meals'}`, todayMeals.length ? `${today}${todayCal ? ` · ${kcal(todayCal)}` : ''}` : `Nothing planned for ${today}`);
}

function renderWeek() {
  const el = document.getElementById('meals-week');
  if (!el) return;

  if (!data.plan) {
    el.innerHTML = `
      <div class="py-16 px-6 text-center">
        <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 dark:bg-orange-950/40 text-orange-500 mb-4">${svg(TYPE_STYLE.lunch.icon, 'h-7 w-7')}</span>
        <p class="text-base font-semibold text-gray-800 dark:text-gray-100">No meal plans yet</p>
        ${data.can_plan ? `
          <p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">A plan is one week of breakfasts, lunches, dinners and snacks — and everyone at home can see it. Make one for a normal week, and more for holidays or special diets.</p>
          <button type="button" data-act="new-plan" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors">
            ${svg('M12 4v16m8-8H4')} Create your first plan
          </button>`
        : '<p class="text-sm text-gray-500 dark:text-gray-400 mt-1 max-w-sm mx-auto">When a meal plan is shared, the week\'s meals will show up here.</p>'}
      </div>`;
    return;
  }

  el.innerHTML = desktopGrid() + mobileDays();
}

function cellHtml(day, type, compact = false) {
  const m = slotMeal(day, type);
  const style = TYPE_STYLE[type] || TYPE_STYLE.lunch;
  const height = compact ? 'min-h-[4.5rem]' : 'min-h-[7.5rem]';

  if (!editable()) {
    // Read-only: plain cells, full text, nothing to click
    return m
      ? `<div class="w-full h-full ${height} flex flex-col rounded-xl ${style.tint} ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.04] p-3">
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100 break-words leading-snug">${escapeHtml(m.description)}</span>
          ${m.calories !== null ? `<span class="mt-auto pt-2 text-[11px] font-bold ${style.text}">${m.calories.toLocaleString()} kcal</span>` : ''}
        </div>`
      : `<div class="w-full h-full ${height} flex items-center justify-center rounded-xl border border-dashed border-gray-100 dark:border-gray-800/70 text-gray-300 dark:text-gray-700 text-sm" aria-label="Nothing planned">—</div>`;
  }

  if (!m) {
    return `
      <button type="button" data-slot="${day}|${type}" aria-label="Add ${escapeHtml(typeLabel(type))} for ${day}"
        class="meal-cell group w-full h-full ${compact ? 'min-h-[4.5rem]' : 'min-h-[7.5rem]'} flex items-center justify-center rounded-xl border border-dashed border-gray-200 dark:border-gray-800 text-gray-300 dark:text-gray-600 hover:border-primary-300 dark:hover:border-primary-800 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
        <span class="inline-flex items-center gap-1 text-xs font-semibold">${svg('M12 4v16m8-8H4', 'h-3.5 w-3.5')} Add</span>
      </button>`;
  }
  return `
    <button type="button" data-slot="${day}|${type}" aria-label="Edit ${escapeHtml(typeLabel(type))} for ${day}"
      class="meal-cell group relative w-full h-full ${compact ? 'min-h-[4.5rem]' : 'min-h-[7.5rem]'} flex flex-col text-left rounded-xl ${style.tint} ring-1 ring-inset ring-black/[0.04] dark:ring-white/[0.04] hover:ring-primary-300 dark:hover:ring-primary-800 p-3 transition-shadow">
      <span class="text-sm font-medium text-gray-800 dark:text-gray-100 break-words ${compact ? '' : 'line-clamp-4'} leading-snug">${escapeHtml(m.description)}</span>
      ${m.calories !== null ? `<span class="mt-auto pt-2 text-[11px] font-bold ${style.text}">${m.calories.toLocaleString()} kcal</span>` : ''}
      <span class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 text-gray-400 transition-opacity">${svg('M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z', 'h-3.5 w-3.5')}</span>
    </button>`;
}

function typeLabelHtml(type) {
  const style = TYPE_STYLE[type] || TYPE_STYLE.lunch;
  return `<span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${style.text}"><span class="h-2 w-2 rounded-full ${style.dot}"></span>${escapeHtml(typeLabel(type))}</span>`;
}

function desktopGrid() {
  const today = todayName();
  const types = Object.keys(data.types);
  const totals = data.days.map(dayCalories);
  const max = Math.max(...totals, 1);

  const head = data.days.map((d) => `
    <div class="border-b border-gray-100 dark:border-gray-800 px-2 py-3 text-center ${d === today ? 'bg-primary-50/70 dark:bg-primary-950/30' : ''}">
      <span class="block text-sm font-bold ${d === today ? 'text-primary-700 dark:text-primary-300' : 'text-gray-900 dark:text-white'}">${d.slice(0, 3)}<span class="hidden xl:inline">${d.slice(3)}</span></span>
      ${d === today ? '<span class="mt-0.5 inline-block rounded-full bg-primary-500 px-1.5 text-[10px] font-bold uppercase tracking-wider text-white">Today</span>' : '<span class="mt-0.5 block text-[10px]">&nbsp;</span>'}
    </div>`).join('');

  const rows = types.map((type) => `
    <div class="px-3 py-3 flex items-start">${typeLabelHtml(type)}</div>
    ${data.days.map((d) => `<div class="p-1.5 ${d === today ? 'bg-primary-50/40 dark:bg-primary-950/15' : ''}">${cellHtml(d, type)}</div>`).join('')}
  `).join('');

  const foot = data.days.map((d, i) => `
    <div class="border-t border-gray-100 dark:border-gray-800 px-2 py-3 ${d === today ? 'bg-primary-50/70 dark:bg-primary-950/30' : ''}" title="${d}: ${totals[i] ? kcal(totals[i]) : 'no calories yet'}">
      <div class="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden"><div class="h-full rounded-full bg-gradient-to-r from-orange-300 to-orange-500 transition-all duration-500" style="width: ${Math.round((totals[i] / max) * 100)}%"></div></div>
      <span class="mt-1.5 block text-center text-xs font-semibold ${totals[i] ? 'text-gray-700 dark:text-gray-200' : 'text-gray-300 dark:text-gray-600'}">${totals[i] ? totals[i].toLocaleString() : '—'}</span>
    </div>`).join('');

  return `
    <div class="hidden lg:grid grid-cols-[7.5rem_repeat(7,minmax(0,1fr))]">
      <div class="border-b border-gray-100 dark:border-gray-800"></div>
      ${head}
      ${rows}
      <div class="px-3 py-3 border-t border-gray-100 dark:border-gray-800 flex items-center text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">Calories</div>
      ${foot}
    </div>`;
}

function mobileDays() {
  const today = todayName();
  const tabs = data.days.map((d) => {
    const active = d === mobileDay;
    const count = data.meals.filter((m) => m.day === d).length;
    return `
      <button type="button" data-day-tab="${d}" aria-pressed="${active}"
        class="flex-shrink-0 w-14 py-2 rounded-xl text-center transition-colors ${active ? 'bg-primary-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}">
        <span class="block text-xs font-bold">${d.slice(0, 3)}</span>
        <span class="mt-1 mx-auto flex justify-center gap-0.5">${Object.keys(data.types).map((t) => `<span class="h-1 w-1 rounded-full ${slotMeal(d, t) ? (active ? 'bg-white' : TYPE_STYLE[t]?.dot || 'bg-gray-400') : (active ? 'bg-white/30' : 'bg-gray-300 dark:bg-gray-600')}"></span>`).join('')}</span>
        ${d === today ? `<span class="block mt-0.5 text-[9px] font-bold uppercase ${active ? 'text-white/80' : 'text-primary-600 dark:text-primary-400'}">Today</span>` : ''}
        <span class="sr-only">${count} meals</span>
      </button>`;
  }).join('');

  const cal = dayCalories(mobileDay);
  return `
    <div class="lg:hidden">
      <div class="flex gap-1.5 overflow-x-auto px-3 pt-3 pb-2 custom-scrollbar">${tabs}</div>
      <div class="px-3 pb-3 space-y-2">
        <div class="flex items-baseline justify-between px-1 pt-1">
          <h3 class="text-base font-bold text-gray-900 dark:text-white">${mobileDay}</h3>
          <span class="text-xs font-semibold text-gray-500 dark:text-gray-400">${cal ? kcal(cal) : 'No calories yet'}</span>
        </div>
        ${Object.keys(data.types).map((type) => `
          <div>
            <div class="px-1 mb-1">${typeLabelHtml(type)}</div>
            ${cellHtml(mobileDay, type, true)}
          </div>`).join('')}
      </div>
    </div>`;
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

function closeMenus(except = null) {
  document.querySelectorAll('#meals-page [data-menu]').forEach((m) => {
    if (m.dataset.menu === except) return;
    m.classList.add('hidden');
    document.querySelector(`#meals-page [data-menu-toggle="${m.dataset.menu}"]`)?.setAttribute('aria-expanded', 'false');
  });
}

async function onPageClick(e) {
  if (e.target.closest('#meals-guest-sample, #meals-guest-clear')) {
    const sample = !!e.target.closest('#meals-guest-sample');
    const ok = await confirmDialog(sample ? 'Replace your guest meal plans with the sample ones?' : 'Remove every guest plan and meal and start with an empty week?', sample ? 'Reload sample' : 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700');
    if (!ok) return;
    if (sample) guestMeals.resetToSample(); else guestMeals.clear();
    data = { ...data, ...guestMeals.state() };
    render();
    showToast(sample ? 'Sample plans loaded.' : 'Started with an empty week.', 'success');
    return;
  }

  const toggle = e.target.closest('[data-menu-toggle]');
  if (toggle) {
    const name = toggle.dataset.menuToggle;
    const menu = document.querySelector(`#meals-page [data-menu="${name}"]`);
    const open = menu.classList.contains('hidden');
    closeMenus(name);
    menu.classList.toggle('hidden', !open);
    toggle.setAttribute('aria-expanded', String(open));
    return;
  }

  const planBtn = e.target.closest('[data-plan]');
  if (planBtn) {
    closeMenus();
    if (planBtn.dataset.plan !== data.plan?.encoded_id) loadPlan(planBtn.dataset.plan);
    return;
  }

  const act = e.target.closest('[data-act]')?.dataset.act;
  if (act) {
    closeMenus();
    if (act === 'new-plan') openPlanForm(null);
    if (act === 'edit-plan') openPlanForm(data.plan);
    if (act === 'duplicate-plan') duplicatePlan();
    if (act === 'pdf') window.open(`${base()}api/meals-pdf?plan=${encodeURIComponent(data.plan.encoded_id)}`, '_blank', 'noopener');
    if (act === 'clear-week') clearWeek();
    if (act === 'delete-plan') deletePlan();
    return;
  }

  const tab = e.target.closest('[data-day-tab]');
  if (tab) { mobileDay = tab.dataset.dayTab; renderWeek(); return; }

  const slot = e.target.closest('[data-slot]');
  if (slot && editable()) {
    const [day, type] = slot.dataset.slot.split('|');
    openMealForm(day, type);
  }
}

// ------------------------------------------------------------
// Meal form
// ------------------------------------------------------------

const input = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3.5 py-2.5 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition';
const label = 'block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5';

function mealFormHtml(day, type, meal) {
  const typeButtons = Object.entries(data.types).map(([key, text]) => `
    <button type="button" data-type-pick="${key}" aria-pressed="${key === type}"
      class="meal-type-pick inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold border transition-colors aria-pressed:border-primary-500 aria-pressed:bg-primary-50 aria-pressed:text-primary-700 dark:aria-pressed:bg-primary-950/40 dark:aria-pressed:text-primary-300 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-300">
      <span class="h-2 w-2 rounded-full ${TYPE_STYLE[key]?.dot || 'bg-gray-400'}"></span>${escapeHtml(text)}
    </button>`).join('');

  return `
  <form id="meal-form" class="space-y-5" novalidate ${meal ? `data-encoded-id="${escapeHtml(meal.encoded_id)}"` : ''}>
    <div class="space-y-4">
      <div class="sm:w-48">
        <label for="meal-form-day" class="${label}">Day</label>
        <select id="meal-form-day" name="day" class="${input}">
          ${data.days.map((d) => `<option value="${d}" ${d === day ? 'selected' : ''}>${d}</option>`).join('')}
        </select>
      </div>
      <div>
        <span class="${label}">Meal</span>
        <input type="hidden" name="type" value="${type}">
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">${typeButtons}</div>
      </div>
    </div>

    <div>
      <label for="meal-form-description" class="${label}">What's on the menu?</label>
      <div class="relative">
        <textarea id="meal-form-description" name="description" required rows="3" maxlength="2000" autocomplete="off"
          placeholder="e.g. Jollof rice with grilled chicken" class="${input} resize-y">${escapeHtml(meal?.description || '')}</textarea>
        <ul data-suggest class="hidden absolute z-[100] left-0 right-0 mt-1 max-h-60 overflow-y-auto custom-scrollbar rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl" role="listbox"></ul>
      </div>
      <p class="mt-1.5 text-xs text-gray-400">Start typing to reuse a dish you've planned before.</p>
    </div>

    <div class="sm:w-48">
      <label for="meal-form-calories" class="${label}">Calories <span class="font-normal text-gray-400">(optional)</span></label>
      <div class="relative">
        <input type="number" id="meal-form-calories" name="calories" min="0" max="20000" step="1" inputmode="numeric"
          value="${meal?.calories ?? ''}" placeholder="0" class="${input} pr-12">
        <span class="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400">kcal</span>
      </div>
    </div>

    <div class="api-message"></div>

    <div class="flex items-center gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
      ${meal ? '<button type="button" data-meal-remove class="px-3 py-2.5 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">Remove</button>' : ''}
      <button type="button" data-meal-cancel class="ml-auto px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
      <button type="submit" class="inline-flex items-center justify-center min-w-[8rem] px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60">
        ${meal ? 'Save changes' : 'Add meal'}
      </button>
    </div>
  </form>`;
}

function openMealForm(day, type) {
  modal?.destroy();
  const meal = slotMeal(day, type);

  modal = new Modal({
    id: 'meal-modal',
    title: meal ? `${day} · ${typeLabel(type)}` : `Plan ${typeLabel(type).toLowerCase()} for ${day}`,
    size: 'md',
    showFooter: false,
    content: mealFormHtml(day, type, meal),
  });
  modal.open();

  const form = document.getElementById('meal-form');
  if (!form) return;
  const desc = form.querySelector('[name="description"]');
  const calories = form.querySelector('[name="calories"]');
  const typeInput = form.querySelector('[name="type"]');
  const apiMsg = form.querySelector('.api-message');
  setTimeout(() => desc?.focus(), 50);

  form.addEventListener('click', (e) => {
    const pick = e.target.closest('[data-type-pick]');
    if (pick) {
      typeInput.value = pick.dataset.typePick;
      form.querySelectorAll('[data-type-pick]').forEach((b) => b.setAttribute('aria-pressed', String(b === pick)));
    }
    if (e.target.closest('[data-meal-cancel]')) modal.close();
    if (e.target.closest('[data-meal-remove]')) { modal.close(); removeMeal(meal); }
  });
  desc.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); form.requestSubmit(); }
  });

  initDishSuggestions(desc, calories, () => typeInput.value);

  const validator = new FormValidator(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.innerHTML;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validator.validateForEmptyFields(e)) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = buttonSpinner;
    apiMsg.innerHTML = '';
    try {
      const fields = Object.fromEntries(new FormData(form).entries());
      const json = await post({ action: 'save-meal', plan_id: data.plan.encoded_id, encoded_id: form.dataset.encodedId || '', ...fields });
      // A move leaves the old slot empty; a save into an occupied slot updated that meal
      data.meals = data.meals.filter((m) => m.encoded_id !== json.meal.encoded_id && !(m.day === json.meal.day && m.type === json.meal.type));
      data.meals.push(json.meal);
      syncMealCount();
      modal.close();
      showToast(json.messages?.[0] || 'Meal saved.', 'success');
      if (window.matchMedia('(max-width: 1023px)').matches) mobileDay = json.meal.day;
      render();
    } catch (err) {
      apiMsg.innerHTML = (err.messages || [err.message]).map((m) =>
        `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalLabel;
    }
  });
}

/** Dish autocomplete: reuse earlier meals (fills calories too when blank). */
function initDishSuggestions(textarea, caloriesInput, getType) {
  const list = textarea.parentNode.querySelector('[data-suggest]');
  let items = [];
  let active = -1;

  const hide = () => { list.classList.add('hidden'); active = -1; };
  const highlight = (i) => {
    active = i;
    [...list.children].forEach((li, n) => li.classList.toggle('bg-primary-50', n === i));
  };
  const choose = (i) => {
    const item = items[i];
    if (!item) return;
    textarea.value = item.description;
    if (item.calories !== null && caloriesInput.value === '') caloriesInput.value = item.calories;
    hide();
  };

  const fetchSuggestions = debounce(async () => {
    const q = textarea.value.trim();
    if (q.length < 2) return hide();
    try {
      const json = isGuest()
        ? { success: true, data: guestMeals.suggest(q, getType()) }
        : await (await fetch(`${api()}?suggest=1&q=${encodeURIComponent(q)}&type=${encodeURIComponent(getType())}`)).json();
      items = (json.success ? json.data : []).filter((d) => d.description.toLowerCase() !== q.toLowerCase());
      if (!items.length) return hide();
      list.innerHTML = items.map((d, i) => `
        <li role="option" data-index="${i}" class="flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm text-gray-700 dark:text-gray-200 cursor-pointer hover:bg-primary-50 dark:hover:bg-primary-900/30">
          <span class="truncate">${escapeHtml(d.description)}</span>
          ${d.calories !== null ? `<span class="flex-shrink-0 text-xs font-semibold text-orange-600 dark:text-orange-400">${d.calories.toLocaleString()} kcal</span>` : ''}
        </li>`).join('');
      list.classList.remove('hidden');
      active = -1;
    } catch { hide(); }
  }, 200);

  textarea.addEventListener('input', fetchSuggestions);
  textarea.addEventListener('keydown', (e) => {
    if (list.classList.contains('hidden')) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); highlight(Math.min(active + 1, items.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); highlight(Math.max(active - 1, 0)); }
    else if (e.key === 'Enter' && active >= 0 && !e.ctrlKey && !e.metaKey) { e.preventDefault(); choose(active); }
    else if (e.key === 'Escape') { e.stopPropagation(); hide(); }
  });
  list.addEventListener('mousedown', (e) => {
    const li = e.target.closest('li[data-index]');
    if (!li) return;
    e.preventDefault();
    choose(Number(li.dataset.index));
  });
  textarea.addEventListener('blur', () => setTimeout(hide, 100));
}

async function removeMeal(meal) {
  if (!meal) return;
  if (!(await confirmDialog(`Remove ${escapeHtml(meal.day)} ${escapeHtml(typeLabel(meal.type).toLowerCase())}?`, 'Remove', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    await post({ action: 'delete-meal', id: meal.encoded_id });
    data.meals = data.meals.filter((m) => m.encoded_id !== meal.encoded_id);
    syncMealCount();
    showToast('Meal removed.', 'success');
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ------------------------------------------------------------
// Plans
// ------------------------------------------------------------

function openPlanForm(plan) {
  modal?.destroy();
  modal = new Modal({
    id: 'meal-plan-modal',
    title: plan ? 'Rename plan' : 'New meal plan',
    size: 'md',
    showFooter: false,
    content: `
      <form id="meal-plan-form" class="space-y-5" novalidate>
        <div>
          <label for="meal-plan-title" class="${label}">Name</label>
          <input type="text" id="meal-plan-title" name="title" required maxlength="255" autocomplete="off"
            placeholder="e.g. School-term week" value="${escapeHtml(plan?.title || '')}" class="${input}">
        </div>
        <div>
          <label for="meal-plan-description" class="${label}">Description <span class="font-normal text-gray-400">(optional)</span></label>
          <textarea id="meal-plan-description" name="description" rows="2" maxlength="1000"
            placeholder="Who or what it's for — shown on the PDF too" class="${input} resize-y">${escapeHtml(plan?.description || '')}</textarea>
        </div>
        <div class="api-message"></div>
        <div class="flex items-center justify-end gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-plan-cancel class="px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">Cancel</button>
          <button type="submit" class="inline-flex items-center justify-center min-w-[8rem] px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm transition-colors disabled:opacity-60">
            ${plan ? 'Save' : 'Create plan'}
          </button>
        </div>
      </form>`,
  });
  modal.open();

  const form = document.getElementById('meal-plan-form');
  if (!form) return;
  setTimeout(() => form.querySelector('[name="title"]')?.focus(), 50);
  form.querySelector('[data-plan-cancel]').addEventListener('click', () => modal.close());

  const validator = new FormValidator(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.innerHTML;
  const apiMsg = form.querySelector('.api-message');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validator.validateForEmptyFields(e)) return;
    submitBtn.disabled = true;
    submitBtn.innerHTML = buttonSpinner;
    apiMsg.innerHTML = '';
    try {
      const fields = Object.fromEntries(new FormData(form).entries());
      const json = await post({ action: 'save-plan', encoded_id: plan?.encoded_id || '', ...fields });
      modal.close();
      showToast(json.messages?.[0] || 'Saved.', 'success');
      if (plan) {
        data.plans = data.plans.map((p) => (p.encoded_id === json.plan.encoded_id ? { ...p, ...json.plan } : p));
        data.plan = { ...data.plan, ...json.plan };
        render();
      } else {
        loadPlan(json.plan.encoded_id);
      }
    } catch (err) {
      apiMsg.innerHTML = (err.messages || [err.message]).map((m) =>
        `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`).join('');
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalLabel;
    }
  });
}

async function duplicatePlan() {
  if (!data.plan) return;
  try {
    const json = await post({ action: 'duplicate-plan', plan_id: data.plan.encoded_id });
    showToast(`Copied to your plans as “${json.plan.title}”.`, 'success');
    loadPlan(json.plan.encoded_id);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function clearWeek() {
  if (!data.plan) return;
  if (!data.meals.length) { showToast('The week is already empty.', 'success'); return; }
  if (!(await confirmDialog(`Remove all ${data.meals.length} meals from “${escapeHtml(data.plan.title)}”? The plan itself stays.`, 'Clear the week', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    const json = await post({ action: 'clear-week', plan_id: data.plan.encoded_id });
    data.meals = [];
    syncMealCount();
    showToast(json.messages?.[0] || 'Week cleared.', 'success');
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deletePlan() {
  if (!data.plan) return;
  const n = data.meals.length;
  const msg = `Delete “${escapeHtml(data.plan.title)}”${n ? ` and its ${n} ${n === 1 ? 'meal' : 'meals'}` : ''}? This can't be undone.`;
  if (!(await confirmDialog(msg, 'Delete plan', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    const json = await post({ action: 'delete-plan', plan_id: data.plan.encoded_id });
    showToast(json.messages?.[0] || 'Plan deleted.', 'success');
    loadPlan('');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
