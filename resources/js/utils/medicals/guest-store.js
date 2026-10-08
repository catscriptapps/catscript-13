// /resources/js/utils/medicals/guest-store.js
//
// Guest (try-it) mode for Medicals: a sample family — people, providers,
// appointments, medications with doses, records — kept only in this
// browser's localStorage; nothing reaches the server. handle() answers the
// same actions, with the same validation and the same response shapes, as
// server/api/medicals.php (MedicalsController), so pages/medicals-page.js
// treats both modes alike. Keep them in step.

import { iso, toMin } from './insights.js';

const KEY = 'catscript.medicals.guest.v1';
const COLORS = ['sky', 'rose', 'emerald', 'violet', 'amber', 'teal', 'indigo', 'orange', 'lime', 'fuchsia'];
const BLOOD = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];
const REMIND = [0, 1, 2, 7];
let memory = null;
let db = null;
let lookups = {};

const ok = (messages, extra = {}) => ({ success: true, messages: [].concat(messages), ...extra, ...state() });
const fail = (messages) => ({ success: false, messages: [].concat(messages) });
const nextId = (rows) => rows.reduce((m, r) => Math.max(m, r.id), 0) + 1;
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const today = () => iso(new Date());
const text = (v, max = 5000) => String(v ?? '').trim().slice(0, max);
const validDate = (v) => {
  const s = text(v);
  if (!s) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return 'invalid';
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) || iso(d) !== s ? 'invalid' : s;
};
const validTime = (v) => {
  const s = text(v);
  if (!s) return null;
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s) ? s : 'invalid';
};
const lines = (s) => String(s || '').split(/\r\n|\r|\n|,/).map((x) => x.trim()).filter(Boolean);

// ------------------------------------------------------------
// Sample family
// ------------------------------------------------------------

function sample() {
  const people = [
    { id: 1, first_name: 'Grace', last_name: 'Mensah', date_of_birth: '1988-04-12', blood_type: 'O+', color: 'rose', health_number: '1234-567-890-AB', allergies: 'Penicillin', conditions: '', notes: '', emergency_contact: 'David Mensah · (705) 555-0144' },
    { id: 2, first_name: 'David', last_name: 'Mensah', date_of_birth: '1985-09-30', blood_type: 'A+', color: 'sky', health_number: '2345-678-901-CD', allergies: '', conditions: 'High blood pressure', notes: '', emergency_contact: 'Grace Mensah · (705) 555-0143' },
    { id: 3, first_name: 'Mia', last_name: 'Mensah', date_of_birth: '2018-06-21', blood_type: 'O+', color: 'violet', health_number: '3456-789-012-EF', allergies: 'Peanuts\nSeasonal pollen', conditions: 'Mild asthma', notes: 'EpiPen in her school bag', emergency_contact: 'Grace Mensah · (705) 555-0143' },
    { id: 4, first_name: 'Leo', last_name: 'Mensah', date_of_birth: '2022-02-03', blood_type: 'A+', color: 'emerald', health_number: '4567-890-123-GH', allergies: '', conditions: '', notes: '', emergency_contact: 'Grace Mensah · (705) 555-0143' },
  ].map((p) => ({ ...p, user_id: null }));

  const providers = [
    { id: 1, name: 'Dr. Priya Patel', kind: 'doctor', specialty: 'Family medicine', phone: '(705) 555-0101', email: 'office@patelfamilymed.example', address: '12 Collier St, Barrie, ON', website: '', notes: 'Book online for routine visits.' },
    { id: 2, name: 'Bright Smiles Dental', kind: 'dentist', specialty: '', phone: '(705) 555-0122', email: '', address: '88 Dunlop St E, Barrie, ON', website: 'brightsmiles.example', notes: '' },
    { id: 3, name: 'Main Street Pharmacy', kind: 'pharmacy', specialty: '', phone: '(705) 555-0133', email: '', address: '5 Main St, Barrie, ON', website: '', notes: 'Refills ready in 24 hours.' },
    { id: 4, name: 'Clearview Eye Care', kind: 'optometrist', specialty: 'Optometry', phone: '(705) 555-0155', email: '', address: '40 Bayfield St, Barrie, ON', website: '', notes: '' },
    { id: 5, name: 'Dr. Alan Wong', kind: 'specialist', specialty: 'Paediatric allergist', phone: '(416) 555-0177', email: '', address: '200 Elizabeth St, Toronto, ON', website: '', notes: 'Referral from Dr. Patel.' },
  ];

  const appt = (id, person_id, provider_id, title, kind, status, date, time, extra = {}) => ({
    id, person_id, provider_id, title, kind, status, date, time, duration: 30, location: '', notes: '', outcome: '', remind_days: 1, follow_up_of: null, ...extra,
  });
  const appointments = [
    appt(1, 3, 2, 'Dental cleaning', 'dental', 'booked', day(1), '15:30', { notes: 'Ask about sealants' }),
    appt(2, 2, 1, 'Blood pressure check', 'checkup', 'booked', day(0), (() => { const d = new Date(Date.now() + 95 * 60000); return `${String(d.getHours()).padStart(2, '0')}:${d.getMinutes() < 30 ? '00' : '30'}`; })(), { notes: 'Bring the home BP log', remind_days: 2 }),
    appt(3, 3, 5, 'Allergy follow-up', 'specialist', 'booked', day(9), '10:00', { duration: 45, location: 'SickKids, 3rd floor', remind_days: 7 }),
    appt(4, 4, 1, '2-year check-up', 'checkup', 'done', day(-41), '09:15', { outcome: 'Growing well. Next vaccines at 4 years.' }),
    appt(5, 1, 4, 'Eye exam', 'vision', 'to_book', null, '', { notes: 'Glasses prescription is 2 years old' }),
    appt(6, 4, 2, 'First dental visit', 'dental', 'booked', day(-1), '11:00'),
  ];

  const medications = [
    { id: 1, person_id: 2, name: 'Amlodipine', dose: '5 mg', times: ['08:00'], instructions: 'With breakfast', prescriber_id: 1, pharmacy_id: 3, start_date: day(-200), end_date: null, refill_date: day(4), active: true },
    { id: 2, person_id: 4, name: 'Amoxicillin', dose: '5 ml', times: ['08:00', '14:00', '20:00'], instructions: 'Shake well; keep in the fridge', prescriber_id: 1, pharmacy_id: 3, start_date: day(-5), end_date: day(2), refill_date: null, active: true },
    { id: 3, person_id: 3, name: 'Salbutamol inhaler', dose: '2 puffs', times: [], instructions: 'When wheezy, or before sports', prescriber_id: 1, pharmacy_id: 3, start_date: null, end_date: null, refill_date: day(25), active: true },
    { id: 4, person_id: 1, name: 'Vitamin D', dose: '1000 IU', times: ['08:00'], instructions: '', prescriber_id: null, pharmacy_id: null, start_date: null, end_date: null, refill_date: null, active: true },
    { id: 5, person_id: 3, name: 'Cetirizine', dose: '5 mg', times: ['19:00'], instructions: 'Spring & summer', prescriber_id: 5, pharmacy_id: 3, start_date: null, end_date: null, refill_date: day(12), active: true },
  ];

  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  const doses = [];
  medications.forEach((m) => m.times.forEach((time) => {
    if (toMin(time) < nowMin - 90) doses.push({ medication_id: m.id, date: today(), time }); // earlier doses were given…
    doses.push({ medication_id: m.id, date: day(-1), time });
  }));
  // …except Leo's 2 PM antibiotic, so the "not ticked off" reminder shows
  const missed = doses.findIndex((d) => d.medication_id === 2 && d.date === today() && d.time === '14:00');
  if (missed >= 0) doses.splice(missed, 1);
  doses.push({ medication_id: 3, date: today(), time: '07:40' });

  const rec = (id, person_id, kind, title, date, extra = {}) => ({ id, person_id, kind, title, date, value: '', notes: '', provider_id: null, next_due: null, ...extra });
  const records = [
    rec(1, 1, 'vaccination', 'Flu shot', day(-350), { next_due: day(15), provider_id: 3 }),
    rec(2, 2, 'vaccination', 'Flu shot', day(-350), { next_due: day(15), provider_id: 3 }),
    rec(3, 3, 'vaccination', 'Flu shot', day(-380), { next_due: day(-15), provider_id: 1 }),
    rec(4, 4, 'vaccination', 'MMR (measles, mumps, rubella)', day(-41), { value: 'Dose 1 of 2', provider_id: 1, next_due: day(800) }),
    rec(5, 2, 'measurement', 'Blood pressure', day(-30), { value: '138/88', notes: 'A little high — recheck in a month', provider_id: 1 }),
    rec(6, 2, 'test', 'Cholesterol panel', day(-60), { value: 'Normal', provider_id: 1, next_due: day(305) }),
    rec(7, 3, 'test', 'Allergy skin test', day(-120), { value: 'Peanut: positive', provider_id: 5 }),
    rec(8, 1, 'dental', 'Dental cleaning', day(-170), { provider_id: 2, next_due: day(10) }),
    rec(9, 1, 'checkup', 'Annual physical', day(-400), { provider_id: 1, next_due: day(-35) }),
    rec(10, 4, 'measurement', 'Height & weight', day(-41), { value: '88 cm · 12.6 kg', provider_id: 1 }),
  ];

  return { people, providers, appointments, medications, doses, records };
}

function read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return memory; } }
function write() { memory = db; try { localStorage.setItem(KEY, JSON.stringify(db)); } catch { /* memory only */ } }
function ensure() {
  if (db) return db;
  const s = read();
  db = s && Array.isArray(s.people) && Array.isArray(s.appointments) ? s : sample();
  if (!s) write();
  return db;
}

/** Same shapes as MedicalsController::state(). */
function state() {
  const d = ensure();
  const sinceIso = day(-14);
  return {
    people: d.people.map((p) => ({ ...p, allergies: lines(p.allergies), conditions: lines(p.conditions) })),
    providers: [...d.providers].sort((a, b) => a.name.localeCompare(b.name)).map((p) => ({ ...p })),
    appointments: [...d.appointments].sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999') || (a.time || '').localeCompare(b.time || '') || a.id - b.id).map((a) => ({ ...a })),
    medications: [...d.medications].sort((a, b) => a.name.localeCompare(b.name)).map((m) => ({ ...m, times: [...m.times] })),
    doses: d.doses.filter((x) => x.date >= sinceIso).map((x) => ({ ...x })),
    records: [...d.records].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.id - a.id).map((r) => ({ ...r })),
    today: today(),
  };
}

const personOk = (id) => ensure().people.find((p) => p.id === Number(id));
const providerOk = (id) => !id || ensure().providers.some((p) => p.id === Number(id));

// ------------------------------------------------------------
// Actions (mirror MedicalsController)
// ------------------------------------------------------------

function savePerson(b) {
  const d = ensure();
  const id = Number(b.id || 0);
  const first = text(b.first_name, 100);
  const dob = validDate(b.date_of_birth);
  const errors = [];
  if (!first) errors.push('Enter a first name.');
  if (dob === 'invalid') errors.push('Choose a valid date of birth (or leave it blank).');
  else if (dob && dob > today()) errors.push('The date of birth can’t be in the future.');
  if (!COLORS.includes(b.color)) errors.push('Pick a colour.');
  if (b.blood_type && !BLOOD.includes(b.blood_type)) errors.push('Choose a blood type from the list.');
  if (errors.length) return fail(errors);
  const fields = {
    first_name: first, last_name: text(b.last_name, 100), date_of_birth: dob, blood_type: b.blood_type || '', color: b.color,
    health_number: text(b.health_number, 60), allergies: text(b.allergies), conditions: text(b.conditions), notes: text(b.notes),
    emergency_contact: text(b.emergency_contact, 255), user_id: null,
  };
  let p = d.people.find((x) => x.id === id);
  if (id && !p) return fail('Not found.');
  if (p) Object.assign(p, fields);
  else { p = { id: nextId(d.people), ...fields }; d.people.push(p); }
  write();
  return ok(id ? 'Saved.' : `${first} added.`, { saved: p.id });
}

function removePerson(b) {
  const d = ensure();
  const p = d.people.find((x) => x.id === Number(b.id));
  if (!p) return fail('Not found.');
  d.people = d.people.filter((x) => x !== p);
  write();
  return ok(`${p.first_name} has been removed from Medicals.`);
}

function saveProvider(b) {
  const d = ensure();
  const id = Number(b.id || 0);
  const name = text(b.name, 150);
  const email = text(b.email, 150);
  const errors = [];
  if (!name) errors.push('Enter the name of the doctor, clinic or pharmacy.');
  if (!(b.kind in (lookups.provider_kinds || {}))) errors.push('Choose what kind of provider this is.');
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('That email address doesn’t look right.');
  if (errors.length) return fail(errors);
  const fields = { name, kind: b.kind, specialty: text(b.specialty, 120), phone: text(b.phone, 50), email, address: text(b.address, 255), website: text(b.website, 255), notes: text(b.notes) };
  let p = d.providers.find((x) => x.id === id);
  if (id && !p) return fail('Not found.');
  if (p) Object.assign(p, fields);
  else { p = { id: nextId(d.providers), ...fields }; d.providers.push(p); }
  write();
  return ok(id ? 'Saved.' : `${name} added.`, { saved: p.id });
}

function deleteProvider(b) {
  const d = ensure();
  const id = Number(b.id);
  const p = d.providers.find((x) => x.id === id);
  if (!p) return fail('Not found.');
  d.appointments.forEach((a) => { if (a.provider_id === id) a.provider_id = null; });
  d.records.forEach((r) => { if (r.provider_id === id) r.provider_id = null; });
  d.medications.forEach((m) => { if (m.prescriber_id === id) m.prescriber_id = null; if (m.pharmacy_id === id) m.pharmacy_id = null; });
  d.providers = d.providers.filter((x) => x !== p);
  write();
  return ok(`“${p.name}” deleted.`);
}

function saveAppointment(b) {
  const d = ensure();
  const id = Number(b.id || 0);
  const p = personOk(b.person_id);
  const title = text(b.title, 150);
  const status = String(b.status || 'booked');
  const date = validDate(b.date);
  const time = validTime(b.time);
  const duration = Number(b.duration || 30);
  const remind = Number(b.remind_days ?? 1);
  const providerId = Number(b.provider_id || 0) || null;
  const errors = [];
  if (!p) errors.push('Choose who the appointment is for.');
  if (!title) errors.push('Say what the appointment is for (e.g. “Dental cleaning”).');
  if (!(b.kind in (lookups.appt_kinds || {}))) errors.push('Choose the type of appointment.');
  if (!(status in (lookups.statuses || {}))) errors.push('Choose a status.');
  if (date === 'invalid') errors.push('Choose a valid date.');
  else if (!date && status !== 'to_book') errors.push('Choose the date — or set the status to “To book” if it isn’t booked yet.');
  if (time === 'invalid') errors.push('Choose a valid time (or leave it blank).');
  if (!(duration >= 5 && duration <= 600)) errors.push('The length must be between 5 minutes and 10 hours.');
  if (!REMIND.includes(remind)) errors.push('Choose when to be reminded.');
  if (!providerOk(providerId)) errors.push('That provider no longer exists.');
  if (errors.length) return fail(errors);
  const fields = {
    person_id: p.id, provider_id: providerId, title, kind: b.kind, status, date, time: time || '', duration,
    location: text(b.location, 255), notes: text(b.notes), outcome: text(b.outcome), remind_days: remind, follow_up_of: Number(b.follow_up_of || 0) || null,
  };
  let a = d.appointments.find((x) => x.id === id);
  if (id && !a) return fail('Appointment not found.');
  if (a) Object.assign(a, fields);
  else { a = { id: nextId(d.appointments), ...fields }; d.appointments.push(a); }
  write();
  return ok(id ? 'Appointment saved.' : (status === 'to_book' ? 'Added to “To book”.' : 'Appointment booked.'), { saved: a.id });
}

function setStatus(b) {
  const d = ensure();
  const a = d.appointments.find((x) => x.id === Number(b.id));
  if (!a || !(b.status in (lookups.statuses || {}))) return fail('Appointment or status not found.');
  if (b.status !== 'to_book' && !a.date) return fail('Give the appointment a date first (Edit).');
  if (['done', 'missed'].includes(b.status) && a.date > today()) return fail('That appointment hasn’t happened yet — you can mark it once the day comes (or Cancel it).');
  a.status = b.status;
  if (b.outcome !== undefined) a.outcome = text(b.outcome);
  write();
  return ok(`Marked ${String(lookups.statuses[b.status]).toLowerCase()}.`);
}

function deleteAppointment(b) {
  const d = ensure();
  const id = Number(b.id);
  if (!d.appointments.some((x) => x.id === id)) return fail('Appointment not found.');
  d.appointments.forEach((a) => { if (a.follow_up_of === id) a.follow_up_of = null; });
  d.appointments = d.appointments.filter((x) => x.id !== id);
  write();
  return ok('Appointment deleted.');
}

function saveMedication(b) {
  const d = ensure();
  const id = Number(b.id || 0);
  const p = personOk(b.person_id);
  const name = text(b.name, 150);
  const times = [...new Set((b.times || []).map((x) => String(x).trim()).filter(Boolean))];
  const start = validDate(b.start_date), end = validDate(b.end_date), refill = validDate(b.refill_date);
  const errors = [];
  if (!p) errors.push('Choose who takes it.');
  if (!name) errors.push('Enter the medication’s name.');
  times.forEach((x) => { if (validTime(x) === 'invalid') errors.push(`“${x}” isn’t a valid dose time.`); });
  if (times.length > 8) errors.push('Up to 8 dose times a day.');
  [['start', start], ['end', end], ['refill', refill]].forEach(([label, v]) => { if (v === 'invalid') errors.push(`Choose a valid ${label} date (or leave it blank).`); });
  if (start && end && start !== 'invalid' && end !== 'invalid' && end < start) errors.push('The end date must be after the start date.');
  if (!providerOk(b.prescriber_id) || !providerOk(b.pharmacy_id)) errors.push('That provider no longer exists.');
  if (errors.length) return fail(errors);
  const fields = {
    person_id: p.id, name, dose: text(b.dose, 100), times: times.sort(), instructions: text(b.instructions, 255),
    prescriber_id: Number(b.prescriber_id || 0) || null, pharmacy_id: Number(b.pharmacy_id || 0) || null,
    start_date: start, end_date: end, refill_date: refill, active: b.active !== false && b.active !== 'false',
  };
  let m = d.medications.find((x) => x.id === id);
  if (id && !m) return fail('Medication not found.');
  if (m) Object.assign(m, fields);
  else { m = { id: nextId(d.medications), ...fields }; d.medications.push(m); }
  write();
  return ok(id ? 'Medication saved.' : 'Medication added.', { saved: m.id });
}

function deleteMedication(b) {
  const d = ensure();
  const id = Number(b.id);
  if (!d.medications.some((x) => x.id === id)) return fail('Medication not found.');
  d.doses = d.doses.filter((x) => x.medication_id !== id);
  d.medications = d.medications.filter((x) => x.id !== id);
  write();
  return ok('Medication removed.');
}

function toggleDose(b) {
  const d = ensure();
  const m = d.medications.find((x) => x.id === Number(b.medication_id));
  if (!m || !personOk(m.person_id)) return fail('Medication not found.');
  const date = String(b.date || '');
  if (validDate(date) === 'invalid' || !date || date > today() || date < day(-2)) return fail('Doses can be ticked off for today and the two days before.');
  const time = String(b.time || '');
  if (m.times.length ? !m.times.includes(time) : !validTime(time) || validTime(time) === 'invalid') {
    return fail(m.times.length ? 'That isn’t one of its dose times.' : 'Give the time the dose was taken.');
  }
  const i = d.doses.findIndex((x) => x.medication_id === m.id && x.date === date && x.time === time);
  if (i >= 0) { d.doses.splice(i, 1); write(); return { success: true, given: false }; }
  d.doses.push({ medication_id: m.id, date, time });
  write();
  return { success: true, given: true };
}

function saveRecord(b) {
  const d = ensure();
  const id = Number(b.id || 0);
  const p = personOk(b.person_id);
  const title = text(b.title, 150);
  const date = validDate(b.date), due = validDate(b.next_due);
  const errors = [];
  if (!p) errors.push('Choose who it’s for.');
  if (!(b.kind in (lookups.record_kinds || {}))) errors.push('Choose the type of record.');
  if (!title) errors.push('Give it a title (e.g. “Flu shot” or “Blood test”).');
  if (date === 'invalid') errors.push('Choose a valid date (or leave it blank).');
  if (due === 'invalid') errors.push('Choose a valid “next due” date (or leave it blank).');
  if (!providerOk(b.provider_id)) errors.push('That provider no longer exists.');
  if (errors.length) return fail(errors);
  const fields = { person_id: p.id, kind: b.kind, title, date, value: text(b.value, 150), notes: text(b.notes), provider_id: Number(b.provider_id || 0) || null, next_due: due };
  let r = d.records.find((x) => x.id === id);
  if (id && !r) return fail('Record not found.');
  if (r) Object.assign(r, fields);
  else { r = { id: nextId(d.records), ...fields }; d.records.push(r); }
  write();
  return ok(id ? 'Record saved.' : 'Record added.', { saved: r.id });
}

function deleteRecord(b) {
  const d = ensure();
  const id = Number(b.id);
  if (!d.records.some((x) => x.id === id)) return fail('Record not found.');
  d.records = d.records.filter((x) => x.id !== id);
  write();
  return ok('Record deleted.');
}

export const guestMedicals = {
  /** The page's lookups (kinds, statuses…), for validation. */
  setup(l) { lookups = l || {}; },
  state,
  resetToSample() { db = sample(); write(); return state(); },
  clear() { db = { people: [], providers: [], appointments: [], medications: [], doses: [], records: [] }; write(); return state(); },
  handle(b) {
    switch (b.action) {
      case 'save-person': return savePerson(b);
      case 'remove-person': return removePerson(b);
      case 'save-provider': return saveProvider(b);
      case 'delete-provider': return deleteProvider(b);
      case 'save-appointment': return saveAppointment(b);
      case 'appointment-status': return setStatus(b);
      case 'delete-appointment': return deleteAppointment(b);
      case 'save-medication': return saveMedication(b);
      case 'delete-medication': return deleteMedication(b);
      case 'toggle-dose': return toggleDose(b);
      case 'save-record': return saveRecord(b);
      case 'delete-record': return deleteRecord(b);
      default: return fail('Unknown action.');
    }
  },
};
