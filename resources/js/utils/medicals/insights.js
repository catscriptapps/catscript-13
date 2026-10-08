// /resources/js/utils/medicals/insights.js
//
// What Medicals works out from the family's data — the same in both modes
// (signed in or guest), so the page, its live hero and its TV screensaver
// all agree:
//
//   reminders(data)   — what needs doing: appointments coming up (inside
//                       their reminder window), ones that passed without
//                       being marked, "to book" ones, vaccinations / check-
//                       ups due within 30 days or overdue (unless already
//                       booked), refills due within a week, courses ending,
//                       and doses overdue today
//   doseSlots(data)   — today's scheduled doses, each given / due / late / later
//   upcoming(data)    — booked appointments still ahead, soonest first
//   heroHtml / saverHtml — the live banner and the screensaver card
//
// Everything is plain data in, HTML out (escaped here).

import { escapeHtml } from '../escape-html.js';

export const NOW_WINDOW = 60;        // a dose is "due" from 30 min before to 60 min after its time
const DUE_SOON_DAYS = 30;
const REFILL_DAYS = 7;
const ENDING_DAYS = 3;

export const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const clock = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? 'AM' : 'PM'}`; };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const shortDate = (s) => { const d = parse(s); return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`; };

/** "Today", "Tomorrow", "Friday", "Oct 12" (+ time when there is one). */
export function when(date, time, todayIso) {
  const n = daysBetween(todayIso, date);
  const d = parse(date);
  const day = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : n === -1 ? 'Yesterday' : n > 1 && n <= 6 ? DAYS[d.getDay()] : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return time ? `${day} · ${clock(time)}` : day;
}

/** "in 3 days", "in 2 hr 10 min", "any moment now". */
export function countdown(date, time, now = new Date()) {
  const target = parse(date);
  if (time) { const [h, m] = time.split(':').map(Number); target.setHours(h, m, 0, 0); }
  const mins = Math.round((target - now) / 60000);
  if (!time || mins >= 24 * 60) {
    const days = daysBetween(iso(now), date);
    return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`;
  }
  if (mins < 1) return 'any moment now';
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return `in ${h} hr${m ? ` ${m} min` : ''}`;
}

/** Age label from a date of birth: "8 yrs", "14 mo", "3 wks". */
export function age(dob, todayIso) {
  if (!dob) return '';
  const b = parse(dob), t = parse(todayIso);
  let years = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) years--;
  if (years >= 2) return `${years} yrs`;
  const months = (t.getFullYear() - b.getFullYear()) * 12 + t.getMonth() - b.getMonth() - (t.getDate() < b.getDate() ? 1 : 0);
  if (months >= 1) return `${months} mo`;
  return `${Math.max(0, Math.floor(daysBetween(dob, todayIso) / 7))} wks`;
}

export const person = (data, id) => data.people.find((p) => p.id === id);
export const provider = (data, id) => (id ? data.providers.find((p) => p.id === id) : null);
export const fullName = (p) => (p ? `${p.first_name}${p.last_name ? ` ${p.last_name}` : ''}` : 'Someone');

/** A medication being taken today (active and within its start / end dates). */
export const isCurrent = (m, todayIso) => m.active && (!m.start_date || m.start_date <= todayIso) && (!m.end_date || m.end_date >= todayIso);

/** Booked appointments still ahead (today's ones until they're over), soonest first. */
export function upcoming(data, now = new Date()) {
  const t = iso(now);
  const m = now.getHours() * 60 + now.getMinutes();
  return data.appointments
    .filter((a) => a.status === 'booked' && a.date && (a.date > t || (a.date === t && (!a.time || toMin(a.time) + a.duration > m))))
    .sort((x, y) => (x.date + (x.time || '99')).localeCompare(y.date + (y.time || '99')));
}

/** Booked appointments whose time has passed but nobody marked them done / missed. */
export function unconfirmed(data, now = new Date()) {
  const t = iso(now);
  const m = now.getHours() * 60 + now.getMinutes();
  return data.appointments.filter((a) => a.status === 'booked' && a.date
    && (a.date < t || (a.date === t && a.time && toMin(a.time) + a.duration + 60 <= m)));
}

/** Today's scheduled doses: given / due / late / later. */
export function doseSlots(data, now = new Date()) {
  const t = iso(now);
  const m = now.getHours() * 60 + now.getMinutes();
  const given = new Set(data.doses.filter((d) => d.date === t).map((d) => `${d.medication_id}|${d.time}`));
  const out = [];
  data.medications.filter((med) => isCurrent(med, t) && med.times.length && person(data, med.person_id)).forEach((med) => {
    med.times.forEach((time) => {
      const at = toMin(time);
      const done = given.has(`${med.id}|${time}`);
      const state = done ? 'given' : m > at + NOW_WINDOW ? 'late' : m >= at - 30 ? 'due' : 'later';
      out.push({ med, person: person(data, med.person_id), time, state });
    });
  });
  return out.sort((a, b) => a.time.localeCompare(b.time) || a.person.first_name.localeCompare(b.person.first_name));
}

/** As-needed doses given today, per medication id. */
export function prnGivenToday(data, todayIso) {
  const out = {};
  data.doses.filter((d) => d.date === todayIso).forEach((d) => {
    const med = data.medications.find((x) => x.id === d.medication_id);
    if (med && !med.times.length) (out[med.id] ??= []).push(d.time);
  });
  Object.values(out).forEach((list) => list.sort());
  return out;
}

/** Record kind -> the appointment kind you'd book for it. */
export const APPT_KIND_FOR = { vaccination: 'vaccination', checkup: 'checkup', dental: 'dental', vision: 'vision', test: 'lab', measurement: 'checkup', condition: 'specialist', procedure: 'specialist', other: 'other' };

/** Latest record per person + title that has a "next due" date. */
export function dueRecords(data) {
  const latest = new Map();
  data.records.filter((r) => r.next_due && person(data, r.person_id)).forEach((r) => {
    const key = `${r.person_id}|${r.title.trim().toLowerCase()}`;
    const prev = latest.get(key);
    if (!prev || (r.date || '') > (prev.date || '') || ((r.date || '') === (prev.date || '') && r.id > prev.id)) latest.set(key, r);
  });
  return [...latest.values()];
}

const TONE_ORDER = { red: 0, amber: 1, violet: 2, sky: 3 };

/**
 * Everything that needs doing, most urgent first. Each:
 * { key, tone: red|amber|violet|sky, icon, title, sub, date?, action: {type, id?, ...} }
 */
export function reminders(data, now = new Date()) {
  const t = iso(now);
  const out = [];

  // Appointments that passed without being marked
  unconfirmed(data, now).forEach((a) => {
    const p = person(data, a.person_id);
    if (!p) return;
    out.push({ key: `confirm-${a.id}`, tone: 'amber', icon: '❓', date: a.date,
      title: `Did ${p.first_name}’s ${a.title.toLowerCase()} happen?`,
      sub: `${when(a.date, a.time, t)} — mark it done (with what happened) or missed.`,
      action: { type: 'confirm', id: a.id } });
  });

  // Appointments inside their reminder window
  upcoming(data, now).forEach((a) => {
    const p = person(data, a.person_id);
    const days = daysBetween(t, a.date);
    if (!p || days > Math.max(a.remind_days, 0)) return;
    const prov = provider(data, a.provider_id);
    out.push({ key: `soon-${a.id}`, tone: days === 0 ? 'red' : 'sky', icon: '📅', date: a.date,
      title: `${p.first_name}: ${a.title}`,
      sub: `${when(a.date, a.time, t)}${prov ? ` · ${prov.name}` : ''}${a.notes ? ` — ${a.notes.split('\n')[0]}` : ''}`,
      action: { type: 'appointment', id: a.id } });
  });

  // To book
  data.appointments.filter((a) => a.status === 'to_book').forEach((a) => {
    const p = person(data, a.person_id);
    if (!p) return;
    out.push({ key: `book-${a.id}`, tone: 'violet', icon: '☎️', date: a.date || '9999',
      title: `Book ${p.first_name}’s ${a.title.toLowerCase()}`,
      sub: provider(data, a.provider_id)?.name ? `Call ${provider(data, a.provider_id).name}${provider(data, a.provider_id).phone ? ` · ${provider(data, a.provider_id).phone}` : ''}` : 'Not booked yet',
      action: { type: 'book-existing', id: a.id } });
  });

  // Vaccinations / check-ups coming due (unless one's already booked or noted)
  dueRecords(data).forEach((r) => {
    const days = daysBetween(t, r.next_due);
    if (days > DUE_SOON_DAYS) return;
    const kind = APPT_KIND_FOR[r.kind] || 'other';
    const covered = data.appointments.some((a) => a.person_id === r.person_id && a.kind === kind
      && (a.status === 'to_book' || (a.status === 'booked' && a.date && a.date >= t)));
    if (covered) return;
    const p = person(data, r.person_id);
    out.push({ key: `due-${r.id}`, tone: days < 0 ? 'red' : 'amber', icon: data.record_kinds?.[r.kind]?.icon || '🩺', date: r.next_due,
      title: `${p.first_name}’s ${r.title.toLowerCase()} ${days < 0 ? 'is overdue' : 'is due'}`,
      sub: days < 0 ? `Was due ${shortDate(r.next_due)} — time to book.` : `Due ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days} days`} (${shortDate(r.next_due)}).`,
      action: { type: 'book-new', person_id: r.person_id, title: r.title, kind, provider_id: r.provider_id } });
  });

  // Refills and courses ending
  data.medications.filter((m) => isCurrent(m, t) && person(data, m.person_id)).forEach((m) => {
    const p = person(data, m.person_id);
    if (m.refill_date) {
      const days = daysBetween(t, m.refill_date);
      if (days <= REFILL_DAYS) {
        const pharmacy = provider(data, m.pharmacy_id);
        out.push({ key: `refill-${m.id}`, tone: days < 0 ? 'red' : 'amber', icon: '💊', date: m.refill_date,
          title: `Refill ${p.first_name}’s ${m.name}`,
          sub: `${days < 0 ? `Was due ${shortDate(m.refill_date)}` : days === 0 ? 'Due today' : `By ${shortDate(m.refill_date)}`}${pharmacy ? ` · ${pharmacy.name}${pharmacy.phone ? ` (${pharmacy.phone})` : ''}` : ''}`,
          action: { type: 'medication', id: m.id } });
      }
    }
    if (m.end_date) {
      const days = daysBetween(t, m.end_date);
      if (days >= 0 && days <= ENDING_DAYS) {
        out.push({ key: `ending-${m.id}`, tone: 'sky', icon: '🏁', date: m.end_date,
          title: `${p.first_name}’s ${m.name} ${days === 0 ? 'ends today' : `ends ${days === 1 ? 'tomorrow' : `in ${days} days`}`}`,
          sub: 'Finish the whole course unless the doctor says otherwise.',
          action: { type: 'medication', id: m.id } });
      }
    }
  });

  // Doses overdue today (one line per person)
  const late = {};
  doseSlots(data, now).filter((s) => s.state === 'late').forEach((s) => { (late[s.person.id] ??= []).push(s); });
  Object.values(late).forEach((list) => {
    const p = list[0].person;
    out.push({ key: `late-${p.id}`, tone: 'red', icon: '⏰', date: t,
      title: `${p.first_name} has ${list.length === 1 ? 'a dose' : `${list.length} doses`} not ticked off`,
      sub: list.map((s) => `${s.med.name} at ${clock(s.time)}`).join(' · '),
      action: { type: 'doses' } });
  });

  return out.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone] || (a.date || '').localeCompare(b.date || ''));
}

// ------------------------------------------------------------
// Hero + screensaver
// ------------------------------------------------------------

const DOT = {
  sky: 'bg-sky-400', rose: 'bg-rose-400', emerald: 'bg-emerald-400', violet: 'bg-violet-400', amber: 'bg-amber-400',
  teal: 'bg-teal-400', indigo: 'bg-indigo-400', orange: 'bg-orange-400', lime: 'bg-lime-400', fuchsia: 'bg-fuchsia-400',
};
export const dotClass = (p) => DOT[p?.color] || DOT.sky;

const svg = (d, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}" /></svg>`;
const ICON = {
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  heart: 'M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z',
  check: 'M5 13l4 4L19 7',
};

export function heroHtml(data, now = new Date()) {
  const t = iso(now);
  const up = upcoming(data, now);
  const next = up[0] || null;
  const doses = doseSlots(data, now);
  const given = doses.filter((d) => d.state === 'given').length;
  const dueNow = doses.filter((d) => d.state === 'due' || d.state === 'late');
  const nextDose = doses.find((d) => d.state === 'later');
  const rem = reminders(data, now);
  const toBook = data.appointments.filter((a) => a.status === 'to_book').length;
  const in30 = up.filter((a) => daysBetween(t, a.date) <= 30).length;
  const dayLine = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()} · ${clock(`${pad(now.getHours())}:${pad(now.getMinutes())}`)}`;

  let pill, headline, sub;
  if (!data.people.length) {
    pill = `${svg(ICON.heart, 'h-3.5 w-3.5')} Get started`;
    headline = 'Add your family';
    sub = 'Start with the people you look after — then their doctors, appointments and medications.';
  } else if (next) {
    const p = person(data, next.person_id);
    const prov = provider(data, next.provider_id);
    const soon = daysBetween(t, next.date) === 0;
    pill = soon
      ? '<span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-primary-400"></span></span> Today'
      : `${svg(ICON.clock, 'h-3.5 w-3.5')} Next appointment`;
    headline = `<span class="inline-flex items-center gap-3"><span class="h-4 w-4 flex-shrink-0 rounded-full ${dotClass(p)} ring-2 ring-white/30"></span>${escapeHtml(p.first_name)}: ${escapeHtml(next.title)}</span>`;
    sub = `${escapeHtml(when(next.date, next.time, t))}${prov ? ` · ${escapeHtml(prov.name)}` : ''} · <span class="font-semibold text-primary-300">${escapeHtml(countdown(next.date, next.time, now))}</span>`;
  } else {
    pill = `${svg(ICON.check, 'h-3.5 w-3.5')} All clear`;
    headline = 'No appointments booked';
    sub = toBook ? `${toBook} to book — see the reminders below.` : 'Book one with “Book appointment”, or note one to book later.';
  }

  const tile = (value, label, accent = '') => `
    <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-3 py-2.5 min-w-0">
      <span class="block text-2xl font-bold leading-none ${accent}">${value}</span>
      <span class="block text-[10px] font-semibold uppercase tracking-wider text-secondary-200 mt-1 truncate">${label}</span>
    </div>`;

  const doseLine = (s) => `
    <button type="button" data-dose="${s.med.id}|${s.time}" class="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 text-left hover:bg-white/10 transition-colors">
      <span class="h-2.5 w-2.5 flex-shrink-0 rounded-full ${dotClass(s.person)}"></span>
      <span class="min-w-0 flex-1 text-sm font-semibold truncate">${escapeHtml(s.person.first_name)} · ${escapeHtml(s.med.name)}${s.med.dose ? ` <span class="font-normal text-white/60">${escapeHtml(s.med.dose)}</span>` : ''}</span>
      <span class="flex-shrink-0 text-xs ${s.state === 'late' ? 'font-bold text-red-300' : 'text-white/60'}">${s.state === 'late' ? 'Late · ' : ''}${clock(s.time)}</span>
    </button>`;
  const doseList = dueNow.length ? dueNow.slice(0, 4).map(doseLine).join('')
    : nextDose ? doseLine(nextDose)
      : `<p class="text-sm text-white/60">${doses.length ? 'All of today’s doses are done ✓' : 'No scheduled doses today.'}</p>`;

  return `
    <div class="grid gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="inline-flex items-center rounded-full bg-primary-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wider">Medicals</h1>
          <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">${pill}</span>
          <span class="text-xs font-semibold text-white/60">${dayLine}</span>
        </div>
        ${next ? `<button type="button" data-open-appt="${next.id}" class="block text-left mt-3 group">` : '<div class="mt-3">'}
          <span class="block text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] break-words group-hover:underline decoration-white/30 underline-offset-8">${headline}</span>
        ${next ? '</button>' : '</div>'}
        <p class="mt-2 text-base text-secondary-50">${sub}</p>
        ${next?.notes ? `<p class="mt-1 text-sm text-white/60 line-clamp-2 max-w-xl">📝 ${escapeHtml(next.notes)}</p>` : ''}
        ${rem.length ? `<div class="mt-5 flex flex-wrap gap-2">${rem.slice(0, 4).map((r) => `
          <button type="button" data-reminder="${escapeHtml(r.key)}" class="inline-flex items-center gap-1.5 max-w-[18rem] rounded-full ${r.tone === 'red' ? 'bg-red-500/30 ring-red-300/40' : r.tone === 'amber' ? 'bg-amber-400/20 ring-amber-200/30' : 'bg-white/10 ring-white/15'} hover:bg-white/20 ring-1 px-3 py-1 text-xs font-semibold transition-colors">
            <span>${r.icon}</span><span class="truncate">${escapeHtml(r.title)}</span></button>`).join('')}
          ${rem.length > 4 ? `<span class="px-2 py-1 text-xs text-white/60">+${rem.length - 4} more</span>` : ''}</div>` : ''}
      </div>
      <div class="lg:col-span-2 space-y-4 min-w-0">
        <div class="grid grid-cols-4 gap-2">
          ${tile(doses.length ? `${given}/${doses.length}` : '—', 'Doses today', dueNow.some((d) => d.state === 'late') ? 'text-red-300' : '')}
          ${tile(rem.length, 'Reminders', rem.some((r) => r.tone === 'red') ? 'text-red-300' : rem.length ? 'text-amber-300' : '')}
          ${tile(toBook, 'To book', toBook ? 'text-violet-300' : '')}
          ${tile(in30, 'Next 30 days')}
        </div>
        <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-4">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary-200 mb-2">${dueNow.length ? 'Doses due now' : 'Next dose'}</p>
          <div class="space-y-1">${doseList}</div>
        </div>
      </div>
    </div>`;
}

/** The screensaver card: the next appointment, doses due and the top reminders — big enough for a TV. */
export function saverHtml(data, now = new Date()) {
  const t = iso(now);
  const next = upcoming(data, now)[0];
  const doses = doseSlots(data, now);
  const dueNow = doses.filter((d) => d.state === 'due' || d.state === 'late');
  const later = doses.filter((d) => d.state === 'later').slice(0, 2);
  const rem = reminders(data, now).filter((r) => !r.key.startsWith('soon-') && !r.key.startsWith('late-')).slice(0, 3);
  const line = (dot, text, right = '') => `
    <div class="flex items-center gap-3">
      <span class="h-3 w-3 flex-shrink-0 rounded-full ${dot} opacity-80"></span>
      <p class="min-w-0 text-xl sm:text-2xl text-white/80 truncate">${text}</p>
      ${right ? `<span class="ml-auto flex-shrink-0 text-base sm:text-lg text-white/45">${right}</span>` : ''}
    </div>`;
  const tag = (label) => `<span class="text-white/45 text-base sm:text-lg uppercase tracking-widest mr-2">${label}</span>`;

  let html = '';
  if (next) {
    const p = person(data, next.person_id);
    html += line(dotClass(p), `${tag('Next')}${escapeHtml(p.first_name)}: ${escapeHtml(next.title)}`, escapeHtml(`${when(next.date, next.time, t)} · ${countdown(next.date, next.time, now)}`));
  }
  dueNow.slice(0, 3).forEach((s) => {
    html += line(dotClass(s.person), `${tag(s.state === 'late' ? 'Late' : 'Dose')}${escapeHtml(s.person.first_name)} · ${escapeHtml(s.med.name)}${s.med.dose ? ` ${escapeHtml(s.med.dose)}` : ''}`, clock(s.time));
  });
  if (!dueNow.length) later.forEach((s) => {
    html += line(dotClass(s.person), `${tag('Dose')}${escapeHtml(s.person.first_name)} · ${escapeHtml(s.med.name)}`, clock(s.time));
  });
  rem.forEach((r) => { html += line(r.tone === 'red' ? 'bg-red-400' : r.tone === 'amber' ? 'bg-amber-400' : 'bg-violet-400', `${r.icon} ${escapeHtml(r.title)}`); });
  return html || '<p class="text-lg text-white/45">Nothing medical needs doing right now.</p>';
}
