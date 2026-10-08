// /resources/js/utils/timetable/guest-store.js
//
// Guest (try-it) mode for the Timetable: the whole timetable — categories
// included — lives only in this browser's localStorage; nothing is sent to
// the server. guestTimetable.handle() answers the same actions, with the
// same validation and the same response shapes, as server/api/timetable.php
// (TimetableController), so pages/timetable-page.js treats both modes alike.
// Keep them in step.

const KEY = 'catscript.timetable.guest.v1';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const LEGACY = ['school', 'spiritual', 'reading', 'routine', 'leisure'];
const COLORS = ['navy', 'indigo', 'violet', 'purple', 'fuchsia', 'pink', 'rose', 'red', 'orange', 'amber',
  'yellow', 'lime', 'green', 'emerald', 'teal', 'cyan', 'sky', 'blue', 'stone', 'gray'];
const MAX_PER_DAY = 60;
const MAX_CATEGORIES = 60;
let memory = null;

/** The built-in categories (same as migration 2026_09_29_000001). [slug, name, colour] */
const PRESETS = [
  ['school', 'School', 'navy'], ['homework', 'Homework', 'indigo'], ['lessons', 'Lessons & tutoring', 'violet'],
  ['reading', 'Reading', 'orange'], ['spiritual', 'Prayer & spiritual', 'amber'], ['chores', 'Chores', 'teal'],
  ['routine', 'Routine', 'sky'], ['hygiene', 'Getting ready', 'cyan'], ['meals', 'Meals', 'lime'],
  ['sleep', 'Sleep & rest', 'purple'], ['travel', 'Travel & school run', 'stone'], ['appointments', 'Appointments', 'yellow'],
  ['exercise', 'Sports & exercise', 'green'], ['outdoor', 'Outdoor play', 'emerald'], ['music', 'Music & arts', 'pink'],
  ['family', 'Family time', 'fuchsia'], ['screen', 'Screen time', 'rose'], ['leisure', 'Leisure', 'gray'],
];

const uid = () => `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
const time = (v) => {
  const m = String(v ?? '').trim().match(/^([01]?\d|2[0-3]):([0-5]\d)(:[0-5]\d)?$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
};
const ok = (messages, extra = {}) => ({ success: true, messages: [].concat(messages), ...extra });
const fail = (messages) => ({ success: false, messages: [].concat(messages) });

function presetCategories() {
  return PRESETS.map(([slug, name, color], i) => ({ id: i + 1, slug, name, color, locked: LEGACY.includes(slug) }));
}

/** A believable family week, so every feature has something to show. */
function sampleActivities(categories) {
  const c = Object.fromEntries(categories.map((x) => [x.slug, x.id]));
  const rows = [];
  const add = (days, start, end, name, slug) => days.forEach((day) => rows.push({ encoded_id: uid(), day, start, end, name, category_id: c[slug] }));
  const weekdays = DAYS.slice(0, 5);

  add(weekdays, '06:40', '07:00', 'Morning chores', 'chores');
  add(weekdays, '07:00', '07:30', 'Wake up & get ready', 'hygiene');
  add(weekdays, '07:30', '07:50', 'Breakfast', 'meals');
  add(weekdays, '07:50', '08:20', 'School run', 'travel');
  add(weekdays, '08:30', '15:15', 'School', 'school');
  add(weekdays, '16:00', '17:00', 'Homework', 'homework');
  add(['Monday', 'Wednesday', 'Friday'], '17:15', '17:45', 'Tidy room', 'chores');
  add(['Tuesday', 'Thursday'], '17:00', '17:45', 'Piano practice', 'music');
  add(['Wednesday'], '17:30', '18:30', 'Football training', 'exercise');
  add(weekdays, '18:30', '19:15', 'Dinner', 'meals');
  add(['Monday', 'Tuesday', 'Thursday'], '19:15', '19:45', 'Screen time', 'screen');
  add(weekdays, '19:45', '20:15', 'Reading', 'reading');
  add(DAYS, '20:15', '20:30', 'Family prayer', 'spiritual');
  add(weekdays, '20:30', '21:00', 'Bedtime', 'sleep');

  add(['Saturday'], '09:00', '10:00', 'Pancake breakfast', 'meals');
  add(['Saturday'], '10:30', '11:30', 'Swimming lesson', 'lessons');
  add(['Saturday'], '13:00', '14:00', 'Laundry & chores', 'chores');
  add(['Saturday'], '14:30', '17:00', 'Park & bikes', 'outdoor');
  add(['Saturday'], '19:00', '21:00', 'Family movie night', 'family');
  add(['Sunday'], '09:30', '11:30', 'Church', 'spiritual');
  add(['Sunday'], '13:00', '14:00', 'Family lunch', 'meals');
  add(['Sunday'], '15:00', '16:00', 'Free play', 'leisure');
  add(['Sunday'], '19:00', '19:30', 'Get ready for the week', 'routine');
  return rows;
}

function sample() {
  const categories = presetCategories();
  return { categories, activities: sampleActivities(categories), nextCategoryId: categories.length + 1 };
}

function read() {
  try { const raw = localStorage.getItem(KEY); return raw ? JSON.parse(raw) : null; } catch { return memory; }
}
function write(store) {
  memory = store;
  try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* memory only */ }
}

let store = null;
const ensure = () => {
  if (store) return store;
  const existing = read();
  store = existing && Array.isArray(existing.categories) && Array.isArray(existing.activities) ? existing : sample();
  if (!existing) write(store);
  return store;
};

/** Same shape as TimetableController::state() (categories carry usage counts). */
function state() {
  const s = ensure();
  const counts = {};
  s.activities.forEach((a) => { counts[a.category_id] = (counts[a.category_id] || 0) + 1; });
  return {
    categories: s.categories.map((c) => ({ ...c, count: counts[c.id] || 0 })),
    activities: s.activities.map((a) => ({ ...a })),
    can_edit: true,
  };
}

function dayList(days) {
  return DAYS.filter((d) => days.includes(d)).join(', ');
}

// ------------------------------------------------------------
// Actions (mirror TimetableController)
// ------------------------------------------------------------

function saveActivity(body) {
  const s = ensure();
  const isNew = !body.encoded_id;
  const name = String(body.name ?? '').trim();
  const start = time(body.start);
  const end = time(body.end);
  const category = s.categories.find((c) => c.id === Number(body.category_id));
  const days = isNew
    ? [...new Set((body.days || []).filter((d) => DAYS.includes(d)))]
    : (DAYS.includes(body.day) ? [body.day] : []);

  const errors = [];
  if (!name) errors.push('Give the activity a name.');
  else if (name.length > 150) errors.push('The name must be 150 characters or fewer.');
  if (!days.length) errors.push(isNew ? 'Pick at least one day.' : 'Choose a day.');
  if (!start || !end) errors.push('Choose a start and end time.');
  else if (end <= start) errors.push('The end time must be after the start time.');
  if (!category) errors.push('Choose a category.');
  if (errors.length) return fail(errors);

  if (!isNew) {
    const a = s.activities.find((x) => x.encoded_id === body.encoded_id);
    if (!a) return fail('Activity not found.');
    Object.assign(a, { day: days[0], start, end, name, category_id: category.id });
    write(s);
    return ok('Activity updated.', { activities: [{ ...a }] });
  }

  const full = days.find((d) => s.activities.filter((a) => a.day === d).length >= MAX_PER_DAY);
  if (full) return fail(`${full} already has ${MAX_PER_DAY} activities — that's the limit.`);

  const created = days.map((day) => ({ encoded_id: uid(), day, start, end, name, category_id: category.id }));
  s.activities.push(...created);
  write(s);
  return ok(created.length === 1 ? 'Activity added.' : `Added to ${created.length} days.`, { activities: created.map((a) => ({ ...a })) });
}

function deleteActivity(body) {
  const s = ensure();
  const before = s.activities.length;
  s.activities = s.activities.filter((a) => a.encoded_id !== body.id);
  if (s.activities.length === before) return fail('Activity not found.');
  write(s);
  return ok('Activity removed.');
}

function copyDay(body) {
  const s = ensure();
  const source = body.source;
  const targets = [...new Set((body.targets || []).filter((d) => DAYS.includes(d) && d !== source))];
  if (!DAYS.includes(source) || !targets.length) return fail('Pick the day to copy from and at least one day to copy to.');
  const from = s.activities.filter((a) => a.day === source);
  if (!from.length) return fail(`${source} has nothing to copy yet.`);

  targets.forEach((day) => {
    if (body.replace) s.activities = s.activities.filter((a) => a.day !== day);
    from.forEach((a) => s.activities.push({ ...a, encoded_id: uid(), day }));
  });
  write(s);
  return ok(`Copied ${source} to ${dayList(targets)}.`, state());
}

function clear(body) {
  const s = ensure();
  const all = body.day === 'all';
  if (!all && !DAYS.includes(body.day)) return fail('Choose a day.');
  const before = s.activities.length;
  s.activities = all ? [] : s.activities.filter((a) => a.day !== body.day);
  write(s);
  const n = before - s.activities.length;
  return ok(n ? (all ? 'Timetable cleared.' : `${body.day} cleared.`) : 'Nothing to clear.');
}

function saveCategory(body) {
  const s = ensure();
  const id = Number(body.id || 0);
  const name = String(body.name ?? '').trim();
  const color = String(body.color ?? '');

  const errors = [];
  if (!name) errors.push('Give the category a name.');
  else if (name.length > 60) errors.push('Category names must be 60 characters or fewer.');
  else if (s.categories.some((c) => c.name.toLowerCase() === name.toLowerCase() && c.id !== id)) errors.push(`There's already a category called “${name}”.`);
  if (!COLORS.includes(color)) errors.push('Pick a colour.');
  if (errors.length) return fail(errors);

  if (id) {
    const c = s.categories.find((x) => x.id === id);
    if (!c) return fail('Category not found.');
    Object.assign(c, { name, color });
  } else {
    if (s.categories.length >= MAX_CATEGORIES) return fail(`That's the limit of ${MAX_CATEGORIES} categories.`);
    s.categories.push({ id: s.nextCategoryId++, slug: null, name, color, locked: false });
  }
  write(s);
  return ok(id ? 'Category saved.' : 'Category added.', state());
}

function deleteCategory(body) {
  const s = ensure();
  const id = Number(body.id || 0);
  const c = s.categories.find((x) => x.id === id);
  if (!c) return fail('Category not found.');
  if (c.locked) return fail(`“${c.name}” is one of the original categories and can't be deleted — you can rename it or change its colour.`);

  const used = s.activities.filter((a) => a.category_id === id);
  const target = s.categories.find((x) => x.id === Number(body.move_to || 0) && x.id !== id);
  if (used.length && !target) {
    return fail(`${used.length} ${used.length === 1 ? 'activity uses' : 'activities use'} this category — choose where to move ${used.length === 1 ? 'it' : 'them'}.`);
  }
  used.forEach((a) => { a.category_id = target.id; });
  s.categories = s.categories.filter((x) => x.id !== id);
  write(s);
  return ok(`“${c.name}” deleted.`, state());
}

export const guestTimetable = {
  load: state,
  resetToSample() { store = sample(); write(store); return state(); },
  clear() { store = { categories: presetCategories(), activities: [], nextCategoryId: PRESETS.length + 1 }; write(store); return state(); },

  /** Answer a POST body the way server/api/timetable.php would. */
  handle(body) {
    switch (body.action) {
      case 'save-activity': return saveActivity(body);
      case 'delete-activity': return deleteActivity(body);
      case 'copy-day': return copyDay(body);
      case 'clear': return clear(body);
      case 'save-category': return saveCategory(body);
      case 'delete-category': return deleteCategory(body);
      default: return fail('Unknown action.');
    }
  },
};
