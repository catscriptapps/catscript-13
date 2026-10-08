// /resources/js/utils/meals/guest-store.js
//
// Guest (try-it) mode for Meals: plans and meals live only in this browser's
// localStorage — nothing reaches the server. state() / handle() / suggest()
// answer exactly like server/api/meals.php (MealsController), with the same
// validation and response shapes, so pages/meals-page.js treats both alike.
// Keep them in step.

const KEY = 'catscript.meals.guest.v1';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const TYPES = ['breakfast', 'lunch', 'dinner', 'snacks'];
const TYPE_LABEL = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snacks: 'snacks' };
let memory = null;
let store = null;

const uid = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const ok = (messages, extra = {}) => ({ success: true, messages: [].concat(messages), ...extra });
const fail = (messages) => ({ success: false, messages: [].concat(messages) });

function sample() {
  const planA = uid();
  const planB = uid();
  const week = {
    breakfast: [['Oatmeal with berries', 320], ['Scrambled eggs on toast', 410], ['Pancakes & fruit', 450], ['Yogurt parfait', 280], ['Akara and pap', 380], ['French toast', 430], ['Full breakfast', 620]],
    lunch: [['Chicken wraps', 540], ['Tomato soup & grilled cheese', 520], ['Jollof rice & chicken', 650], ['Tuna salad sandwiches', 480], ['Leftover pasta', 500], ['Homemade pizza', 700], ['Sunday roast', 900]],
    dinner: [['Spaghetti bolognese', 720], ['Egusi soup & pounded yam', 890], ['Tacos', 680], ['Fish, rice & veggies', 610], ['Pizza night', 800], ['BBQ burgers', 760], ['Stir-fry noodles', 640]],
    snacks: [['Apple slices', 95], ['Popcorn', 150], ['Carrot sticks & hummus', 120], ['Banana bread', 210], ['Cheese & crackers', 180], ['Fruit salad', 110], ['Chin chin', 200]],
  };
  const meals = [];
  TYPES.forEach((t) => DAYS.forEach((d, i) => {
    if (t === 'snacks' && i % 2) return; // leave a few slots open
    meals.push({ encoded_id: uid(), plan: planA, day: d, type: t, description: week[t][i][0], calories: week[t][i][1] });
  }));
  [['Monday', 'dinner', 'Grilled chicken salad', 520], ['Tuesday', 'dinner', 'Veggie curry', 610], ['Saturday', 'breakfast', 'Waffles', 480]]
    .forEach(([d, t, desc, cal]) => meals.push({ encoded_id: uid(), plan: planB, day: d, type: t, description: desc, calories: cal }));
  return {
    plans: [
      { encoded_id: planA, title: 'Our week', description: 'A normal school week' },
      { encoded_id: planB, title: 'Holiday week', description: 'Lighter meals while we travel' },
    ],
    meals,
  };
}

function read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return memory; } }
function write() { memory = store; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* memory only */ } }
function ensure() {
  if (store) return store;
  const s = read();
  store = s && Array.isArray(s.plans) && Array.isArray(s.meals) ? s : sample();
  if (!s) write();
  return store;
}

const presentPlan = (p) => ({
  encoded_id: p.encoded_id, title: p.title, description: p.description || '',
  meal_count: store.meals.filter((m) => m.plan === p.encoded_id).length,
  owner: 'You', owner_first: 'You', is_mine: true, can_edit: true,
});
const presentMeal = (m) => ({ encoded_id: m.encoded_id, day: m.day, type: m.type, description: m.description, calories: m.calories });

/** Same shape as MealsController::state(). */
function state(requested = '') {
  const s = ensure();
  const plans = s.plans.map(presentPlan);
  const active = plans.find((p) => p.encoded_id === requested) || plans[0] || null;
  return { plans, plan: active, meals: active ? s.meals.filter((m) => m.plan === active.encoded_id).map(presentMeal) : [], can_plan: true };
}

function savePlan(b) {
  const s = ensure();
  const title = String(b.title ?? '').trim();
  const description = String(b.description ?? '').trim();
  const errors = [];
  if (!title) errors.push('Give the plan a name.');
  else if (title.length > 255) errors.push('The name must be 255 characters or fewer.');
  if (description.length > 1000) errors.push('The description must be 1,000 characters or fewer.');
  if (errors.length) return fail(errors);
  if (!b.encoded_id) {
    if (s.plans.length >= 100) return fail('You have reached the limit of 100 meal plans.');
    const p = { encoded_id: uid(), title, description };
    s.plans.push(p);
    write();
    return ok('Meal plan created.', { plan: presentPlan(p) });
  }
  const p = s.plans.find((x) => x.encoded_id === b.encoded_id);
  if (!p) return fail('Meal plan not found.');
  Object.assign(p, { title, description });
  write();
  return ok('Meal plan saved.', { plan: presentPlan(p) });
}

function duplicatePlan(b) {
  const s = ensure();
  const src = s.plans.find((x) => x.encoded_id === b.plan_id);
  if (!src) return fail('Meal plan not found.');
  const p = { encoded_id: uid(), title: `${src.title} (copy)`.slice(0, 255), description: src.description };
  s.plans.push(p);
  s.meals.filter((m) => m.plan === src.encoded_id).forEach((m) => s.meals.push({ ...m, encoded_id: uid(), plan: p.encoded_id }));
  write();
  return ok('Plan duplicated.', { plan: presentPlan(p) });
}

function deletePlan(b) {
  const s = ensure();
  const p = s.plans.find((x) => x.encoded_id === b.plan_id);
  if (!p) return fail('Meal plan not found.');
  s.plans = s.plans.filter((x) => x !== p);
  s.meals = s.meals.filter((m) => m.plan !== p.encoded_id);
  write();
  return ok(`“${p.title}” deleted.`);
}

function clearWeek(b) {
  const s = ensure();
  if (!s.plans.some((x) => x.encoded_id === b.plan_id)) return fail('Meal plan not found.');
  const before = s.meals.length;
  s.meals = s.meals.filter((m) => m.plan !== b.plan_id);
  write();
  return ok(before !== s.meals.length ? 'Week cleared.' : 'The week was already empty.');
}

function saveMeal(b) {
  const s = ensure();
  if (!s.plans.some((x) => x.encoded_id === b.plan_id)) return fail('Meal plan not found.');
  const day = String(b.day ?? '');
  const type = String(b.type ?? '');
  const description = String(b.description ?? '').trim();
  const cal = String(b.calories ?? '').replace(/[,\s]/g, '');
  const errors = [];
  if (!DAYS.includes(day)) errors.push('Choose a day.');
  if (!TYPES.includes(type)) errors.push('Choose breakfast, lunch, dinner or snacks.');
  if (!description) errors.push('Describe the meal.');
  else if (description.length > 2000) errors.push('The description must be 2,000 characters or fewer.');
  if (cal !== '' && (!/^\d+$/.test(cal) || Number(cal) > 20000)) errors.push('Calories must be a whole number up to 20,000, or left blank.');
  if (errors.length) return fail(errors);

  const occupant = s.meals.find((m) => m.plan === b.plan_id && m.day === day && m.type === type);
  let meal;
  if (b.encoded_id) {
    meal = s.meals.find((m) => m.encoded_id === b.encoded_id && m.plan === b.plan_id);
    if (!meal) return fail('Meal not found.');
    if (occupant && occupant !== meal) return fail(`${day} ${TYPE_LABEL[type]} already has a meal. Remove it first, or edit that one.`);
  } else {
    meal = occupant;
  }
  const isNew = !meal;
  if (isNew) { meal = { encoded_id: uid(), plan: b.plan_id }; s.meals.push(meal); }
  Object.assign(meal, { day, type, description, calories: cal !== '' ? Number(cal) : null });
  write();
  return ok(isNew ? 'Meal added.' : 'Meal updated.', { meal: presentMeal(meal) });
}

function deleteMeal(b) {
  const s = ensure();
  const before = s.meals.length;
  s.meals = s.meals.filter((m) => m.encoded_id !== b.id);
  if (s.meals.length === before) return fail('Meal not found.');
  write();
  return ok('Meal removed.');
}

export const guestMeals = {
  state,
  resetToSample() { store = sample(); write(); },
  clear() { store = { plans: [{ encoded_id: uid(), title: 'Our week', description: '' }], meals: [] }; write(); },
  /** Dishes planned before (like MealsController::suggestDishes). */
  suggest(q, type) {
    const s = ensure();
    if (q.length < 2) return [];
    const needle = q.toLowerCase();
    const seen = new Set();
    return [...s.meals].sort((a, b) => (a.type === type ? 0 : 1) - (b.type === type ? 0 : 1))
      .filter((m) => m.description.toLowerCase().includes(needle) && !seen.has(m.description.toLowerCase()) && seen.add(m.description.toLowerCase()))
      .slice(0, 8).map((m) => ({ description: m.description, calories: m.calories }));
  },
  handle(b) {
    switch (b.action) {
      case 'save-plan': return savePlan(b);
      case 'duplicate-plan': return duplicatePlan(b);
      case 'delete-plan': return deletePlan(b);
      case 'clear-week': return clearWeek(b);
      case 'save-meal': return saveMeal(b);
      case 'delete-meal': return deleteMeal(b);
      default: return fail('Unknown action.');
    }
  },
};
