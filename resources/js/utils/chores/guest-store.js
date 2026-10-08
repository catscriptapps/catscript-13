// /resources/js/utils/chores/guest-store.js
//
// Guest (try-it) mode for Chores: children, the library, the plan and the
// ticks live only in this browser's localStorage. Chore SLOTS come from the
// guest Timetable in the same browser (utils/timetable/guest-store.js), with
// the same rule as the server: activities in the Chores category, or with
// "chore" in the name. handle() mirrors server/api/chores.php
// (ChoresController) — same validation, same share-out, same shapes.

import { guestTimetable } from '../timetable/guest-store.js';

const KEY = 'catscript.chores.guest.v1';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const COLORS = ['orange', 'sky', 'emerald', 'violet', 'rose', 'amber', 'teal', 'indigo', 'lime', 'fuchsia'];
const TIMES = ['morning', 'afternoon', 'evening', 'any'];
let memory = null;
let store = null;
let presets = [];
let areas = {};

const ok = (messages, extra = {}) => ({ success: true, messages: [].concat(messages), ...extra });
const fail = (messages) => ({ success: false, messages: [].concat(messages) });
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const period = (hhmm) => (toMin(hhmm) < 720 ? 'morning' : toMin(hhmm) < 1020 ? 'afternoon' : 'evening');
const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;

function week() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const monday = new Date(d);
  monday.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return [iso(monday), iso(sunday), iso(d)];
}

function sample() {
  return {
    children: [['Alex', 'Rivera'], ['Sam', 'Okafor'], ['Jordan', 'Lee'], ['Taylor', 'Singh'], ['Riley', 'Moreau']]
      .map(([first, last], i) => ({ id: i + 1, first_name: first, last_name: last, color: COLORS[i], user_id: null })),
    library: presets.map((c, i) => ({ ...c, id: i + 1 })),
    plan: [],
    done: [],
  };
}

function read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return memory; } }
function write() { memory = store; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* memory only */ } }
function ensure() {
  if (store) return store;
  const s = read();
  store = s && Array.isArray(s.children) && Array.isArray(s.library) ? s : sample();
  if (!s) { autoShare(); write(); }
  return store;
}

/** Chore slots from the guest Timetable, keyed "Day|HH:MM" (like ChoresController::slots). */
function slots() {
  const tt = guestTimetable.load();
  const choreCats = tt.categories.filter((c) => c.slug === 'chores').map((c) => c.id);
  const out = new Map();
  tt.activities.forEach((a) => {
    if (!choreCats.includes(a.category_id) && !/chore/i.test(a.name)) return;
    const key = `${a.day}|${a.start}`;
    if (!out.has(key)) out.set(key, { key, day: a.day, start: a.start, end: a.end, name: a.name, minutes: toMin(a.end) - toMin(a.start), period: period(a.start) });
  });
  return [...out.values()].sort((x, y) => DAYS.indexOf(x.day) - DAYS.indexOf(y.day) || x.start.localeCompare(y.start));
}

function state() {
  const s = ensure();
  const [weekStart, , today] = week();
  return {
    children: s.children.map((c) => ({ ...c })),
    library: [...s.library].sort((a, b) => a.title.localeCompare(b.title)),
    slots: slots(),
    plan: s.plan.map((p) => ({ ...p })),
    done: s.done.filter((d) => d.date >= weekStart),
    today,
    week_start: weekStart,
    areas,
    can_manage: true,
    accounts: [],
  };
}

// ------------------------------------------------------------
// Share out (same algorithm as ChoresController::shareOut)
// ------------------------------------------------------------

function shareOut(slotKeys, choreIds, replace) {
  const s = ensure();
  const all = new Map(slots().map((x) => [x.key, x]));
  const chosen = [...new Set(slotKeys)].map((k) => all.get(k)).filter(Boolean);
  const chores = s.library.filter((c) => c.active && choreIds.includes(c.id)).sort((a, b) => b.minutes - a.minutes || a.id - b.id);
  const kids = s.children;
  if (!chosen.length || !chores.length || !kids.length) return { placed: 0, unfit: [], error: 'Pick at least one chore slot and one chore (and make sure there are children to share with).' };

  let placed = 0;
  const unfit = [];
  chosen.forEach((slot, si) => {
    if (replace) {
      const gone = new Set(s.plan.filter((p) => p.slot === slot.key).map((p) => p.id));
      s.plan = s.plan.filter((p) => !gone.has(p.id));
      s.done = s.done.filter((d) => !gone.has(d.plan_id));
    }
    const here = s.plan.filter((p) => p.slot === slot.key);
    const loads = Object.fromEntries(kids.map((k) => [k.id, 0]));
    const has = {};
    here.forEach((p) => {
      if (p.child_id in loads) loads[p.child_id] += (s.library.find((c) => c.id === p.chore_id)?.minutes || 0);
      (has[p.child_id] ??= []).push(p.chore_id);
    });
    const taken = here.map((p) => p.chore_id);
    const order = kids.map((_, i) => kids[(i + si) % kids.length]);
    const add = (kid, chore) => {
      s.plan.push({ id: nextId(s.plan), slot: slot.key, child_id: kid.id, chore_id: chore.id });
      loads[kid.id] += chore.minutes;
      (has[kid.id] ??= []).push(chore.id);
      placed++;
    };

    chores.filter((c) => c.per_child).forEach((chore) => order.forEach((kid) => {
      if ((has[kid.id] || []).includes(chore.id)) return;
      if (loads[kid.id] + chore.minutes > slot.minutes) { unfit.push(`${chore.title} for ${kid.first_name} (${slot.day})`); return; }
      add(kid, chore);
    }));
    chores.filter((c) => !c.per_child).forEach((chore) => {
      if (taken.includes(chore.id)) return;
      let best = null;
      order.forEach((kid) => {
        if (loads[kid.id] + chore.minutes > slot.minutes) return;
        if (!best || loads[kid.id] < loads[best.id]) best = kid;
      });
      if (!best) { unfit.push(`${chore.title} (${slot.day})`); return; }
      add(best, chore);
      taken.push(chore.id);
    });
  });
  return { placed, unfit, count: chosen.length };
}

/** First visit: share suitable chores into every slot, so the demo has something to show. */
function autoShare() {
  slots().forEach((slot) => {
    const ids = store.library.filter((c) => c.active && (c.best_time === slot.period)).map((c) => c.id);
    shareOut([slot.key], ids, false);
  });
}

// ------------------------------------------------------------
// Actions
// ------------------------------------------------------------

function toggleDone(b) {
  const s = ensure();
  const p = s.plan.find((x) => x.id === Number(b.plan_id));
  if (!p) return fail('That chore is no longer planned.');
  const [weekStart, , today] = week();
  const date = String(b.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date < weekStart || date > today) return fail('Chores can be ticked off for this week, up to today.');
  const day = new Date(`${date}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long' });
  if (day !== p.slot.split('|')[0]) return fail(`That chore is planned for ${p.slot.split('|')[0]}s.`);
  const i = s.done.findIndex((d) => d.plan_id === p.id && d.date === date);
  if (i >= 0) { s.done.splice(i, 1); write(); return ok([], { done: false }); }
  s.done.push({ plan_id: p.id, date });
  write();
  return ok([], { done: true });
}

function assign(b) {
  const s = ensure();
  const slot = slots().find((x) => x.key === b.slot);
  const kid = s.children.find((c) => c.id === Number(b.child_id));
  const chore = s.library.find((c) => c.id === Number(b.chore_id) && c.active);
  if (!slot || !kid || !chore) return fail('Pick a chore slot, a child and a chore.');
  if (s.plan.some((p) => p.slot === slot.key && p.child_id === kid.id && p.chore_id === chore.id)) return fail(`${kid.first_name} already has that chore in this slot.`);
  const p = { id: nextId(s.plan), slot: slot.key, child_id: kid.id, chore_id: chore.id };
  s.plan.push(p);
  write();
  return ok('Chore added.', { plan: { ...p } });
}

function unassign(b) {
  const s = ensure();
  const id = Number(b.id);
  if (!s.plan.some((p) => p.id === id)) return fail('That chore is no longer planned.');
  s.plan = s.plan.filter((p) => p.id !== id);
  s.done = s.done.filter((d) => d.plan_id !== id);
  write();
  return ok('Chore removed.');
}

function clearSlot(b) {
  const s = ensure();
  const gone = new Set(s.plan.filter((p) => p.slot === b.slot).map((p) => p.id));
  s.plan = s.plan.filter((p) => !gone.has(p.id));
  s.done = s.done.filter((d) => !gone.has(d.plan_id));
  write();
  return ok(gone.size ? 'Slot cleared.' : 'That slot was already empty.', state());
}

function saveChore(b) {
  const s = ensure();
  const id = Number(b.id || 0);
  const title = String(b.title ?? '').trim();
  const minutes = Number(b.minutes || 0);
  const errors = [];
  if (!title) errors.push('Give the chore a name.');
  else if (title.length > 150) errors.push('The name must be 150 characters or fewer.');
  else if (s.library.some((c) => c.title.toLowerCase() === title.toLowerCase() && c.id !== id)) errors.push(`“${title}” is already in the library.`);
  if (!(b.area in areas)) errors.push('Choose where the chore is done.');
  if (!(minutes >= 1 && minutes <= 240)) errors.push('Minutes must be between 1 and 240.');
  if (!TIMES.includes(b.best_time)) errors.push('Choose the best time of day.');
  if (String(b.detail || '').length > 1000) errors.push('Notes must be 1,000 characters or fewer.');
  if (errors.length) return fail(errors);
  const fields = { title, area: b.area, minutes, best_time: b.best_time, per_child: !!b.per_child, detail: String(b.detail || '').trim(), active: true };
  let chore = s.library.find((c) => c.id === id);
  if (id && !chore) return fail('Chore not found.');
  if (chore) Object.assign(chore, fields);
  else { chore = { id: nextId(s.library), ...fields }; s.library.push(chore); }
  write();
  return ok(id ? 'Chore saved.' : 'Chore added to the library.', { chore: { ...chore } });
}

function deleteChore(b) {
  const s = ensure();
  const c = s.library.find((x) => x.id === Number(b.id));
  if (!c) return fail('Chore not found.');
  const gone = new Set(s.plan.filter((p) => p.chore_id === c.id).map((p) => p.id));
  s.plan = s.plan.filter((p) => !gone.has(p.id));
  s.done = s.done.filter((d) => !gone.has(d.plan_id));
  s.library = s.library.filter((x) => x !== c);
  write();
  return ok(`“${c.title}” deleted.`, state());
}

function saveChild(b) {
  const s = ensure();
  const id = Number(b.id || 0);
  const first = String(b.first_name ?? '').trim();
  const last = String(b.last_name ?? '').trim();
  const errors = [];
  if (!first) errors.push('Enter a first name.');
  if (first.length > 100 || last.length > 100) errors.push('Names must be 100 characters or fewer.');
  if (!COLORS.includes(b.color)) errors.push('Pick a colour.');
  if (errors.length) return fail(errors);
  let kid = s.children.find((c) => c.id === id);
  if (id && !kid) return fail('Not found.');
  if (kid) Object.assign(kid, { first_name: first, last_name: last, color: b.color });
  else s.children.push({ id: nextId(s.children), first_name: first, last_name: last, color: b.color, user_id: null });
  write();
  return ok(id ? 'Saved.' : `${first} added.`, state());
}

function removeChild(b) {
  const s = ensure();
  const kid = s.children.find((c) => c.id === Number(b.id));
  if (!kid) return fail('Not found.');
  const gone = new Set(s.plan.filter((p) => p.child_id === kid.id).map((p) => p.id));
  s.plan = s.plan.filter((p) => !gone.has(p.id));
  s.done = s.done.filter((d) => !gone.has(d.plan_id));
  s.children = s.children.filter((c) => c !== kid);
  write();
  return ok(`${kid.first_name} is off the chores.`, state());
}

export const guestChores = {
  /** @param {object} setup {presets, areas} from the page (the built-in chore library) */
  setup(setupData) {
    presets = (setupData.presets || []).map(({ id, ...c }) => c); // eslint-disable-line no-unused-vars
    areas = setupData.areas || {};
  },
  state,
  resetToSample() { store = sample(); autoShare(); write(); return state(); },
  clear() { store = { ...sample(), plan: [], done: [] }; write(); return state(); },
  handle(b) {
    switch (b.action) {
      case 'toggle-done': return toggleDone(b);
      case 'assign': return assign(b);
      case 'unassign': return unassign(b);
      case 'share-out': {
        const r = shareOut((b.slots || []).map(String), (b.chore_ids || []).map(Number), !!b.replace);
        if (r.error) return fail(r.error);
        write();
        const slotWord = r.count === 1 ? '1 slot' : `${r.count} slots`;
        return ok(r.placed ? `Shared out ${r.placed} ${r.placed === 1 ? 'chore' : 'chores'} across ${slotWord}.` : 'Nothing new to share out.', { unfit: r.unfit, ...state() });
      }
      case 'clear-slot': return clearSlot(b);
      case 'save-chore': return saveChore(b);
      case 'delete-chore': return deleteChore(b);
      case 'save-child': return saveChild(b);
      case 'remove-child': return removeChild(b);
      default: return fail('Unknown action.');
    }
  },
};
