// /resources/js/pages/tasks-page.js
//
// Tasks app: view tabs, search, add / edit (modal form), view (modal) and
// delete. Every change refreshes the server-rendered list + tab counts
// from server/api/tasks.php, so grouping and urgency colours always come
// from one place (TasksController).
//
// All listeners are delegated from #tasks-page, which the SPA router
// replaces on each visit, so they never stack up across navigations.

import { Modal } from '../factories/modal-factory.js';
import { createDeleteHandler } from '../factories/delete-factory.js';
import { FormValidator } from '../utils/form-validator.js';
import { buttonSpinner } from '../utils/spinner-utils.js';
import { showToast } from '../ui/toast.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { taskForm, localDate } from '../forms/task-form.js';
import { initTitleAutocomplete } from '../utils/tasks/title-autocomplete.js';
import { guestTasks, render as renderGuest } from '../utils/tasks/guest-store.js';
import { confirmDialog } from '../ui/confirm.js';
import { heroHtml, saverHtml } from '../utils/tasks/hero.js';
import { present as presentGuest } from '../utils/tasks/guest-store.js';
import { createScreensaver, SAVER_IDLE_MS } from '../utils/screensaver.js';

const api = () => `${window.APP_CONFIG?.baseUrl || '/'}api/tasks`;

let modal = null;
let deleteHandler = null;
let state = { view: 'current', q: '' };
let requestSeq = 0;
// 'guest' = try-it demo: tasks live in this browser (utils/tasks/guest-store.js)
// and the list is rendered locally; 'account' = the shared server list.
let mode = 'account';
let guestList = [];
const isGuest = () => mode === 'guest';

// Live hero (utils/tasks/hero.js): redrawn every TICK_MS; when nobody's
// touched the page for IDLE_MS it re-syncs every SYNC_MS, and after SAVER_MS
// the TV-safe screensaver takes over (as in Timetable and Chores).
const TICK_MS = 30 * 1000;
const IDLE_MS = 90 * 1000;
const SYNC_MS = 5 * 60 * 1000;
const SAVER_MS = SAVER_IDLE_MS; // utils/screensaver.js — 5 minutes, the same on every page that has one
const HERO_SLIDE_MS = 8 * 1000;
let heroTasks = [];
let tickTimer = null;
let slideTimer = null;
let lastInteraction = Date.now();
let lastSync = Date.now();
let heroDay = '';
let saver = null;
let docBound = false;

export function init() {
  const page = document.getElementById('tasks-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  state = { view: 'current', q: '' };
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  try { heroTasks = JSON.parse(document.getElementById('tasks-hero-data')?.textContent || '[]'); } catch { heroTasks = []; }
  if (isGuest()) {
    guestList = guestTasks.load();
    refresh();
  } else {
    deleteHandler = createDeleteHandler(api(), 'Task');
  }

  page.addEventListener('click', onPageClick);
  startLive();

  const search = document.getElementById('tasks-search');
  search?.addEventListener('input', debounce(() => {
    state.q = search.value.trim();
    refresh();
  }, 300));
  search?.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && search.value) {
      search.value = '';
      state.q = '';
      refresh();
    }
  });
}

// ------------------------------------------------------------
// List
// ------------------------------------------------------------

async function refresh() {
  const listEl = document.getElementById('tasks-list');
  if (!listEl) return;

  if (isGuest()) {
    const out = renderGuest(guestList, state.view, state.q);
    listEl.innerHTML = out.html;
    updateCounts(out.counts);
    updateTabs(out.total);
    heroTasks = guestList.map(presentGuest);
    renderHero();
    return;
  }

  const seq = ++requestSeq;
  listEl.style.opacity = '0.5';

  try {
    const params = new URLSearchParams({ view: state.view });
    if (state.q) params.set('q', state.q);
    const res = await fetch(`${api()}?${params}`);
    const json = await res.json();
    if (seq !== requestSeq) return; // a newer request superseded this one

    if (!json.success) throw new Error(json.messages?.[0] || 'Could not load tasks.');

    listEl.innerHTML = json.html;
    updateCounts(json.counts);
    updateTabs(json.total);
    if (Array.isArray(json.upcoming)) { heroTasks = json.upcoming; renderHero(); }
    lastSync = Date.now();
  } catch (err) {
    if (seq === requestSeq) showToast(err.message || 'Could not load tasks.', 'error');
  } finally {
    if (seq === requestSeq) listEl.style.opacity = '';
  }
}

// ------------------------------------------------------------
// Live hero
// ------------------------------------------------------------

function renderHero() {
  const el = document.getElementById('tasks-hero');
  if (el) el.innerHTML = heroHtml(heroTasks);
  heroDay = new Date().toDateString();
}

function startLive() {
  if (!docBound) {
    docBound = true;
    const touched = () => { lastInteraction = Date.now(); };
    ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, touched, { passive: true }));
  }
  lastInteraction = Date.now();
  lastSync = Date.now();

  saver?.remove();
  let slides = [];
  try { slides = JSON.parse(document.getElementById('tasks-page')?.dataset.slides || '[]'); } catch { /* no photos */ }
  saver = createScreensaver({
    id: 'tasks-saver',
    slides,
    paint: () => saverHtml(heroTasks),
    hint: 'Move the mouse or tap anywhere to return to your tasks',
    onWake: () => { lastInteraction = Date.now(); },
  });

  renderHero();
  startHeroSlides();
  clearInterval(tickTimer);
  tickTimer = setInterval(tick, TICK_MS);
}

const busy = () => document.body.style.overflow === 'hidden'
  || !!document.getElementById('confirm-proceed')
  || !!document.activeElement?.matches?.('input, textarea, select');

function tick() {
  if (!document.getElementById('tasks-page')) { clearInterval(tickTimer); clearInterval(slideTimer); saver?.remove(); return; }
  if (document.visibilityState !== 'visible') return;

  // A new day: every "today / tomorrow" label and group moves — reload it all
  if (heroDay !== new Date().toDateString() && !busy()) { refresh(); return; }

  const idle = Date.now() - lastInteraction >= IDLE_MS;
  if (!isGuest() && idle && !busy() && Date.now() - lastSync >= SYNC_MS) { lastSync = Date.now(); refresh(); return; }

  renderHero();
  if (saver?.isOpen()) saver.repaint();
  else if (saver && Date.now() - lastInteraction >= SAVER_MS && !busy()) saver.show();
}

function startHeroSlides() {
  clearInterval(slideTimer);
  const slides = [...document.querySelectorAll('#tasks-page [data-hero-slides] .hero-slide')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = 0;
  slideTimer = setInterval(() => {
    if (!document.body.contains(slides[0])) { clearInterval(slideTimer); return; }
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, HERO_SLIDE_MS);
}

function openFromHero(id) {
  const task = heroTasks.find((t) => t.encoded_id === id);
  if (!task) return;
  // The delete handler fades the list row out — use it if it's showing
  const row = [...document.querySelectorAll('#tasks-list .task-item')].find((r) => {
    try { return JSON.parse(r.dataset.task || '{}').encoded_id === id; } catch { return false; }
  });
  openView(task, row || document.createElement('div'));
}

function updateCounts(counts = {}) {
  Object.entries(counts).forEach(([key, n]) => {
    const el = document.querySelector(`#tasks-tabs [data-count="${key}"]`);
    if (el) el.textContent = n;
  });

  // Sidebar "due today" badge (partials/sidebar.php) lives outside the page
  const navBadge = document.getElementById('tasks-nav-badge');
  if (navBadge && typeof counts.today === 'number') {
    navBadge.textContent = counts.today > 99 ? '99+' : counts.today;
    navBadge.classList.toggle('hidden', counts.today === 0);
  }
}

function updateTabs(total) {
  const searching = state.q !== '';
  document.querySelectorAll('#tasks-tabs .tasks-tab').forEach((tab) => {
    const active = !searching && tab.dataset.view === state.view;
    tab.setAttribute('aria-pressed', active ? 'true' : 'false');
    tab.classList.toggle('border-primary-600', active);
    tab.classList.toggle('text-primary-700', active);
    tab.classList.toggle('dark:text-primary-300', active);
    tab.classList.toggle('border-transparent', !active);
    tab.classList.toggle('text-gray-500', !active);
  });

  const status = document.getElementById('tasks-search-status');
  if (status) {
    status.classList.toggle('hidden', !searching);
    status.textContent = searching ? `${total} result${total === 1 ? '' : 's'} for “${state.q}”` : '';
  }
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

async function onPageClick(e) {
  if (e.target.closest('#tasks-guest-sample')) {
    if (await confirmDialog('Replace your guest tasks with fresh sample tasks?', 'Reload sample', 'Cancel', 'bg-primary-600 hover:bg-primary-700')) {
      guestList = guestTasks.resetToSample();
      refresh();
      showToast('Sample tasks loaded.', 'success');
    }
    return;
  }
  if (e.target.closest('#tasks-guest-clear')) {
    if (await confirmDialog('Remove every guest task and start with an empty list?', 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700')) {
      guestList = guestTasks.clear();
      refresh();
      showToast('Started with an empty list.', 'success');
    }
    return;
  }

  const heroOpen = e.target.closest('[data-hero-open]');
  if (heroOpen) { openFromHero(heroOpen.dataset.heroOpen); return; }

  const tab = e.target.closest('.tasks-tab');
  if (tab) {
    state.view = tab.dataset.view;
    state.q = '';
    const search = document.getElementById('tasks-search');
    if (search) search.value = '';
    refresh();
    return;
  }

  if (e.target.closest('#add-task-btn')) {
    openForm(null);
    return;
  }

  const item = e.target.closest('.task-item');
  if (!item) return;
  const task = JSON.parse(item.dataset.task || '{}');

  if (e.target.closest('.task-edit-btn')) openForm(task);
  else if (e.target.closest('.task-delete-btn')) confirmDelete(task, item);
  else if (e.target.closest('.task-view-btn')) openView(task, item);
}

// ------------------------------------------------------------
// View modal
// ------------------------------------------------------------

function openView(task, item) {
  modal?.destroy();

  const detail = task.detail
    ? `<p class="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap break-words leading-relaxed">${escapeHtml(task.detail)}</p>`
    : '<p class="text-sm text-gray-400 italic">No details.</p>';

  modal = new Modal({
    id: 'view-task-modal',
    title: 'Task',
    size: 'md',
    showFooter: false,
    content: `
      <div class="space-y-5">
        <h3 class="text-lg font-bold text-gray-900 dark:text-white break-words">${escapeHtml(task.title)}</h3>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
          <div><dt class="text-xs font-semibold uppercase tracking-wider text-gray-400">Due</dt><dd class="mt-0.5 font-medium text-gray-900 dark:text-white">${escapeHtml(task.due_long)}${task.status?.label ? ` <span class="text-gray-500">· ${escapeHtml(task.status.label)}</span>` : ''}</dd></div>
          <div><dt class="text-xs font-semibold uppercase tracking-wider text-gray-400">Time</dt><dd class="mt-0.5 font-medium text-gray-900 dark:text-white">${escapeHtml(task.time_label)}</dd></div>
          <div class="sm:col-span-2"><dt class="text-xs font-semibold uppercase tracking-wider text-gray-400">Added by</dt><dd class="mt-0.5 font-medium text-gray-900 dark:text-white">${escapeHtml(task.author)}</dd></div>
        </dl>
        <div class="pt-4 border-t border-gray-100 dark:border-gray-800">
          <p class="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1.5">Details</p>
          ${detail}
        </div>
        <div class="flex items-center justify-between gap-3 pt-4 border-t border-gray-100 dark:border-gray-800">
          <button type="button" data-act="delete" class="px-3 py-2 rounded-xl text-sm font-semibold text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors">Delete</button>
          <button type="button" data-act="edit" class="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-sm font-semibold text-white shadow-sm transition-colors">Edit task</button>
        </div>
      </div>`,
  });
  modal.open();

  const panel = document.getElementById('view-task-modal');
  panel?.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'edit') openForm(task);
    if (act === 'delete') { modal.close(); confirmDelete(task, item); }
  });
}

// ------------------------------------------------------------
// Add / edit modal
// ------------------------------------------------------------

function openForm(task) {
  modal?.destroy();

  modal = new Modal({
    id: task ? 'edit-task-modal' : 'add-task-modal',
    title: task ? 'Edit task' : 'New task',
    size: 'md',
    showFooter: false,
    content: taskForm({ task, formId: 'task-form' }),
  });
  modal.open();

  const form = document.getElementById('task-form');
  if (!form) return;

  const titleInput = form.querySelector('[name="task_title"]');
  const dateInput = form.querySelector('[name="due_date"]');
  const timeInput = form.querySelector('[name="task_time"]');
  const clearTime = form.querySelector('.task-clear-time');

  initTitleAutocomplete(titleInput, isGuest() ? (q) => guestTasks.suggest(guestList, q) : null);
  setTimeout(() => titleInput?.focus(), 50);

  form.addEventListener('click', (e) => {
    const chip = e.target.closest('.task-date-chip');
    if (chip) dateInput.value = localDate(Number(chip.dataset.offset));
    if (e.target.closest('.task-clear-time')) { timeInput.value = ''; clearTime.classList.add('hidden'); }
    if (e.target.closest('.task-cancel-btn')) modal.close();
  });
  timeInput?.addEventListener('input', () => clearTime.classList.toggle('hidden', !timeInput.value));

  const validator = new FormValidator(form);
  const submitBtn = form.querySelector('button[type="submit"]');
  const apiMsg = form.querySelector('.api-message');
  const originalLabel = submitBtn.innerHTML;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!validator.validateForEmptyFields(e)) return;

    submitBtn.disabled = true;
    submitBtn.innerHTML = buttonSpinner;
    apiMsg.innerHTML = '';

    try {
      const data = Object.fromEntries(new FormData(form).entries());
      const json = isGuest()
        ? guestTasks.save(data, form.dataset.encodedId || '', guestList)
        : await (await fetch(api(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...data, encoded_id: form.dataset.encodedId || '' }),
        })).json();

      if (!json.success) {
        apiMsg.innerHTML = (json.messages || ['Please check the form.']).map((m) =>
          `<p class="rounded-xl bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 px-3.5 py-2 text-sm font-medium">${escapeHtml(m)}</p>`
        ).join('');
        return;
      }

      if (isGuest()) {
        const i = guestList.findIndex((t) => t.encoded_id === json.task.encoded_id);
        if (i >= 0) guestList[i] = json.task; else guestList.push(json.task);
        guestTasks.persist(guestList);
      }
      modal.close();
      showToast(json.messages?.[0] || 'Task saved.', 'success');
      refresh();
    } catch {
      apiMsg.innerHTML = '<p class="rounded-xl bg-red-50 text-red-700 px-3.5 py-2 text-sm font-medium">Something went wrong. Please try again.</p>';
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalLabel;
    }
  });
}

// ------------------------------------------------------------
// Delete
// ------------------------------------------------------------

function confirmDelete(task, item) {
  if (isGuest()) {
    confirmDialog(`Delete “${escapeHtml(task.title)}”?`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700').then((ok) => {
      if (!ok) return;
      guestList = guestList.filter((t) => t.encoded_id !== task.encoded_id);
      guestTasks.persist(guestList);
      showToast('Task deleted.', 'success');
      refresh();
    });
    return;
  }
  deleteHandler.showConfirmation(task.encoded_id, item, (success) => {
    if (!success) return;
    showToast('Task deleted.', 'success');
    refresh();
  });
}
