// /resources/js/utils/tasks/guest-store.js
//
// Guest (try-it) mode for Tasks: tasks live only in this browser's
// localStorage — nothing is sent to the server. This mirrors, in the
// browser, what TasksController does on the server for signed-in users:
// the same views (current / today / week / past + search), the same
// grouping and urgency tones, the same validation, and the same markup as
// resources/views/components/tasks/{list,item}.php. Keep them in step.

import { escapeHtml } from '../escape-html.js';

const KEY = 'catscript.tasks.guest.v1';
const RECENT_DAYS = 10;
const PAST_LIMIT = 150;
const SEARCH_LIMIT = 200;
let memory = null;

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
const daysFromToday = (dateStr) => Math.round((parse(dateStr) - today()) / 864e5);
const uid = () => `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

function read() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return memory; }
}
function write(tasks) {
  memory = tasks;
  try { localStorage.setItem(KEY, JSON.stringify(tasks)); } catch { /* memory only */ }
}

/** Sample tasks spread around today, so every view has something in it. */
export function sampleTasks() {
  const t = today();
  const rows = [
    [-9, '00:00', 'Pay hydro bill', 'Account #4471 — autopay failed last month'],
    [-6, '', 'Book dentist check-ups', 'Whole family, before the end of the month'],
    [-3, '00:00', 'Pay Internet $90.39', ''],
    [-1, '18:30', 'Return library books', ''],
    [0, '00:00', 'Pay car insurance $214.65', ''],
    [0, '16:00', 'Pick up the kids from soccer', 'Field 3, bring the snack bag'],
    [0, '', 'Water the garden', ''],
    [0, '08:15', 'Sign the field-trip form', 'In the blue folder'],
    [0, '12:30', 'Call Grandma', ''],
    [0, '20:00', 'Pack school bags', ''],
    [1, '00:00', 'Pay mortgage $1,650.00', ''],
    [1, '19:00', 'Parent–teacher meeting', 'Room 12'],
    [3, '09:30', 'Oil change', 'Quick Lube on Main St'],
    [5, '00:00', 'Pay Enbridge Gas', ''],
    [6, '', 'Plan next week’s meals', ''],
    [12, '00:00', 'Renew passports', 'Photos first — check the requirements'],
    [20, '', 'Book summer camp', ''],
    [-25, '00:00', 'Pay property tax instalment', ''],
    [-40, '', 'Clean out the garage', ''],
  ];
  return rows.map(([offset, time, title, detail]) => ({
    encoded_id: uid(),
    title,
    detail,
    due_date: iso(addDays(t, offset)),
    time,
  }));
}

// ------------------------------------------------------------
// Presentation (mirrors TasksController::present())
// ------------------------------------------------------------

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function timeLabel(time) {
  if (!time) return 'Any time';
  const [h, m] = time.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`;
}

export function present(task) {
  const d = parse(task.due_date);
  const days = daysFromToday(task.due_date);
  const status =
    days < 0 ? { label: Math.abs(days) === 1 ? 'Yesterday' : `${Math.abs(days)} days ago`, tone: 'past' }
    : days === 0 ? { label: 'Today', tone: 'today' }
    : days === 1 ? { label: 'Tomorrow', tone: 'soon' }
    : days <= 6 ? { label: `In ${days} days`, tone: 'soon' }
    : { label: '', tone: 'neutral' };

  return {
    encoded_id: task.encoded_id,
    title: task.title,
    detail: task.detail || '',
    due_date: task.due_date,
    due_long: d.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    month: MONTHS[d.getMonth()],
    day: String(d.getDate()),
    time: task.time || '',
    time_label: timeLabel(task.time),
    status,
    author: 'You',
    author_initial: 'Y',
    author_avatar: null,
  };
}

// ------------------------------------------------------------
// Views, counts, grouping (mirrors TasksController::listing/counts/groups)
// ------------------------------------------------------------

const byDateAsc = (a, b) => (a.due_date + (a.time || '')).localeCompare(b.due_date + (b.time || ''));
const byDateDesc = (a, b) => byDateAsc(b, a);

export function counts(tasks) {
  const t = iso(today());
  const recent = iso(addDays(today(), -RECENT_DAYS));
  const weekEnd = iso(addDays(today(), 6));
  return {
    current: tasks.filter((x) => x.due_date >= recent).length,
    today: tasks.filter((x) => x.due_date === t).length,
    week: tasks.filter((x) => x.due_date >= t && x.due_date <= weekEnd).length,
    past: tasks.filter((x) => x.due_date < t).length,
  };
}

function listing(tasks, view, q) {
  const t = iso(today());
  if (q) {
    const needle = q.toLowerCase();
    const hits = tasks.filter((x) => `${x.title} ${x.detail}`.toLowerCase().includes(needle)).sort(byDateDesc);
    return { items: hits.slice(0, SEARCH_LIMIT), grouping: 'month', capped: hits.length > SEARCH_LIMIT, total: Math.min(hits.length, SEARCH_LIMIT) };
  }
  let items;
  if (view === 'today') items = tasks.filter((x) => x.due_date === t);
  else if (view === 'week') items = tasks.filter((x) => x.due_date >= t && x.due_date <= iso(addDays(today(), 6)));
  else if (view === 'past') {
    const past = tasks.filter((x) => x.due_date < t).sort(byDateDesc);
    return { items: past.slice(0, PAST_LIMIT), grouping: 'month', capped: past.length > PAST_LIMIT, total: Math.min(past.length, PAST_LIMIT) };
  } else items = tasks.filter((x) => x.due_date >= iso(addDays(today(), -RECENT_DAYS)));
  items.sort(byDateAsc);
  return { items, grouping: 'timeline', capped: false, total: items.length };
}

function groups(items, grouping) {
  const out = [];
  const find = (key, label, tone) => {
    let g = out.find((x) => x.key === key);
    if (!g) out.push((g = { key, label, tone, tasks: [] }));
    return g;
  };
  items.forEach((task) => {
    if (grouping === 'month') {
      const d = parse(task.due_date);
      find(task.due_date.slice(0, 7), d.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }), 'neutral').tasks.push(task);
    } else {
      const days = daysFromToday(task.due_date);
      const [key, label, tone] =
        days < 0 ? ['past', `Past ${RECENT_DAYS} days`, 'past']
        : days === 0 ? ['today', 'Today', 'today']
        : days === 1 ? ['tomorrow', 'Tomorrow', 'soon']
        : days <= 6 ? ['week', 'This week', 'soon']
        : ['later', 'Later', 'neutral'];
      find(key, label, tone).tasks.push(task);
    }
  });
  return out;
}

// ------------------------------------------------------------
// Markup (mirrors components/tasks/list.php + item.php)
// ------------------------------------------------------------

const TONE_BADGE = {
  past: 'bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300',
  today: 'bg-primary-50 text-primary-700 dark:bg-primary-950/40 dark:text-primary-300',
  soon: 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  neutral: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};
const TONE_HEADING = {
  past: 'text-red-600 dark:text-red-400',
  today: 'text-primary-600 dark:text-primary-400',
  soon: 'text-amber-600 dark:text-amber-400',
  neutral: 'text-gray-500 dark:text-gray-400',
};

function itemHtml(t) {
  const badge = TONE_BADGE[t.status.tone] || TONE_BADGE.neutral;
  return `
<li class="task-item group relative flex items-start gap-4 px-4 py-3.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
    data-encoded-id="${escapeHtml(t.encoded_id)}" data-task="${escapeHtml(JSON.stringify(t))}">
  <div class="h-12 w-12 flex-shrink-0 rounded-xl flex flex-col items-center justify-center ${badge}">
    <span class="text-[11px] font-semibold uppercase leading-none">${escapeHtml(t.month)}</span>
    <span class="text-lg font-bold leading-tight">${escapeHtml(t.day)}</span>
  </div>
  <button type="button" class="task-view-btn min-w-0 flex-1 text-left focus:outline-none">
    <span class="block text-sm font-semibold text-gray-900 dark:text-white break-words group-hover:text-primary-700 dark:group-hover:text-primary-300 transition-colors">${escapeHtml(t.title)}</span>
    ${t.detail ? `<span class="block text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2 break-words">${escapeHtml(t.detail)}</span>` : ''}
    <span class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-500 dark:text-gray-400">
      <span class="inline-flex items-center gap-1">
        <svg class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        ${escapeHtml(t.time_label)}
      </span>
      ${t.status.label ? `<span class="px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${badge}">${escapeHtml(t.status.label)}</span>` : ''}
      <span class="inline-flex items-center gap-1.5" title="Added by ${escapeHtml(t.author)}">
        <span class="h-4 w-4 rounded-full bg-secondary-500 text-white text-[10px] font-bold flex items-center justify-center">${escapeHtml(t.author_initial)}</span>
        ${escapeHtml(t.author)}
      </span>
    </span>
  </button>
  <div class="flex items-center gap-1 flex-shrink-0 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity">
    <button type="button" class="task-edit-btn p-2 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-950/40 transition-colors" title="Edit task" aria-label="Edit task">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
    </button>
    <button type="button" class="task-delete-btn p-2 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors" title="Delete task" aria-label="Delete task">
      <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
    </button>
  </div>
</li>`;
}

const EMPTY = {
  search: ['No matching tasks', 'Try a different word — search covers every task, past and future.'],
  today: ['Nothing due today', 'Enjoy the breathing room, or add something new.'],
  week: ['Nothing in the next 7 days', 'Your week is clear.'],
  past: ['No past tasks', 'Tasks show up here once their date has passed.'],
  current: ['No tasks yet', 'Add your first task to get started.'],
};

/** @returns {{html: string, total: number, counts: object}} same shape as GET api/tasks */
export function render(tasks, view, q) {
  const result = listing(tasks, view, q);
  const gs = groups(result.items, result.grouping);
  let html;
  if (!gs.length) {
    const [title, text] = EMPTY[q ? 'search' : view] || EMPTY.current;
    html = `
    <div class="py-16 text-center">
      <div class="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-gray-100 dark:bg-gray-800 text-gray-400 mb-4">
        <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" /></svg>
      </div>
      <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${title}</p>
      <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${text}</p>
    </div>`;
  } else {
    html = `<div class="space-y-6">${gs.map((g) => `
      <section>
        <h3 class="px-4 mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${TONE_HEADING[g.tone] || TONE_HEADING.neutral}">
          ${escapeHtml(g.label)}
          <span class="font-semibold text-gray-400 dark:text-gray-500">${g.tasks.length}</span>
        </h3>
        <ul class="divide-y divide-gray-100 dark:divide-gray-800/70">${g.tasks.map((t) => itemHtml(present(t))).join('')}</ul>
      </section>`).join('')}
      ${result.capped ? '<p class="px-4 text-xs text-gray-500 dark:text-gray-400">Showing the most recent results. Search to find something older.</p>' : ''}
    </div>`;
  }
  return { html, total: result.total, counts: counts(tasks) };
}

// ------------------------------------------------------------
// Store
// ------------------------------------------------------------

export const guestTasks = {
  load() {
    const existing = read();
    if (Array.isArray(existing)) return existing;
    const seeded = sampleTasks();
    write(seeded);
    return seeded;
  },
  persist(tasks) { write(tasks); },
  resetToSample() { const s = sampleTasks(); write(s); return s; },
  clear() { write([]); return []; },

  /** Distinct past titles for the form's autocomplete (newest first). */
  suggest(tasks, q) {
    if (q.length < 2) return [];
    const needle = q.toLowerCase();
    const seen = new Set();
    return [...tasks].sort(byDateDesc).map((t) => t.title)
      .filter((title) => title.toLowerCase().includes(needle) && !seen.has(title) && seen.add(title))
      .slice(0, 8);
  },

  /** Create / update, mirroring TasksController::save() validation. */
  save(data, encodedId, tasks) {
    const title = String(data.task_title ?? '').trim();
    const detail = String(data.task_detail ?? '').trim();
    const dueDate = String(data.due_date ?? '').trim();
    const time = String(data.task_time ?? '').trim();

    const errors = [];
    if (!title) errors.push('Give the task a title.');
    else if (title.length > 255) errors.push('The title must be 255 characters or fewer.');
    const d = /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? parse(dueDate) : null;
    if (!d || iso(d) !== dueDate) errors.push('Choose a valid due date.');
    if (time && !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(time)) errors.push('Choose a valid time, or leave it blank.');
    if (detail.length > 5000) errors.push('Details must be 5,000 characters or fewer.');
    if (errors.length) return { success: false, messages: errors };

    const existing = encodedId ? tasks.find((t) => t.encoded_id === encodedId) : null;
    if (encodedId && !existing) return { success: false, messages: ['Task not found.'] };

    const task = { encoded_id: existing?.encoded_id || uid(), title, detail, due_date: dueDate, time: time.slice(0, 5) };
    return { success: true, messages: [existing ? 'Task updated.' : 'Task added.'], task };
  },
};
