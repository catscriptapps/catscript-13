// /resources/js/utils/tasks/hero.js
//
// The live Tasks hero (pages/tasks.php #tasks-hero): what's due right now,
// what's next (with a countdown), a timeline of today with a moving "now"
// marker, and what's coming up over the next days. It works from
// present()ed tasks (TasksController::upcoming() — today + 30 days — or the
// guest store) and is simply redrawn on a timer, so it never goes stale.
//
// Rules: a timed task is "due now" for NOW_MIN minutes after its time, then
// it's past. 12:00 AM (the usual bill time) and "any time" tasks are due
// today as a whole — they're listed, never counted down.

import { escapeHtml } from '../escape-html.js';

const NOW_MIN = 30;
const COMING = 5;
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
const clock = (min) => { const h = Math.floor(min / 60) % 24; return `${((h + 11) % 12) + 1}:${pad(min % 60)} ${h < 12 ? 'AM' : 'PM'}`; };
const isTimed = (t) => !!t.time && t.time !== '00:00';
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const svg = (d, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${d}" /></svg>`;
const ICON = {
  clock: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  bell: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9',
  check: 'M5 13l4 4L19 7',
  cal: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
};
const pulse = '<span class="relative flex h-2 w-2"><span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary-400 opacity-75"></span><span class="relative inline-flex h-2 w-2 rounded-full bg-primary-400"></span></span>';

function until(mins) {
  if (mins < 1) return 'any moment now';
  if (mins < 60) return `in ${plural(mins, 'minute')}`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `in ${h} hr${m ? ` ${m} min` : ''}`;
}

/** "Today 4:00 PM", "Tomorrow", "Friday 9:30 AM", "Oct 12" … */
function when(t, todayIso) {
  const days = Math.round((parse(t.due_date) - parse(todayIso)) / 864e5);
  const d = parse(t.due_date);
  const day = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : days <= 6 ? DAYS[d.getDay()] : `${MONTHS[d.getMonth()]} ${d.getDate()}`;
  return isTimed(t) ? `${day} · ${t.time_label}` : day;
}

/** Everything the hero (and the screensaver) shows, for this minute. */
export function snapshot(tasks, now = new Date()) {
  const todayIso = iso(now);
  const m = now.getHours() * 60 + now.getMinutes();
  const list = tasks.filter((t) => t.due_date >= todayIso)
    .sort((a, b) => (a.due_date + (a.time || '')).localeCompare(b.due_date + (b.time || '')));
  const today = list.filter((t) => t.due_date === todayIso);
  const timed = today.filter(isTimed);
  const allDay = today.filter((t) => !isTimed(t));

  const dueNow = timed.filter((t) => toMin(t.time) <= m && m < toMin(t.time) + NOW_MIN);
  const current = dueNow[dueNow.length - 1] || null;
  const later = [...timed.filter((t) => toMin(t.time) > m), ...list.filter((t) => t.due_date > todayIso)];
  const next = later[0] || null;
  // When a task is due now, the next one is still "coming up"
  const coming = (current ? later : later.slice(1)).slice(0, COMING);

  const inDays = (n) => { const d = new Date(now); d.setDate(d.getDate() + n); return iso(d); };
  const counts = {
    today: today.length,
    left: timed.filter((t) => toMin(t.time) >= m - NOW_MIN).length + allDay.length,
    tomorrow: list.filter((t) => t.due_date === inDays(1)).length,
    week: list.filter((t) => t.due_date <= inDays(6)).length,
    month: list.length,
  };
  return { now, todayIso, m, today, timed, allDay, current, next, coming, counts };
}

function timeline(s) {
  if (!s.timed.length) return '';
  const times = s.timed.map((t) => toMin(t.time));
  const start = Math.min(6 * 60, Math.floor(Math.min(...times) / 60) * 60);
  const end = Math.max(22 * 60, Math.ceil((Math.max(...times) + 1) / 60) * 60);
  const pos = (min) => `${Math.max(0, Math.min(100, ((min - start) / (end - start)) * 100)).toFixed(2)}%`;
  const dots = s.timed.map((t) => {
    const tm = toMin(t.time);
    const state = t === s.current ? 'now' : tm < s.m ? 'past' : t === s.next ? 'next' : 'later';
    const cls = {
      now: 'h-4 w-4 bg-primary-400 ring-4 ring-primary-400/30',
      next: 'h-3.5 w-3.5 bg-white ring-4 ring-white/20',
      later: 'h-3 w-3 bg-white/70',
      past: 'h-2.5 w-2.5 bg-white/30',
    }[state];
    return `<button type="button" data-hero-open="${escapeHtml(t.encoded_id)}" title="${escapeHtml(`${t.time_label} · ${t.title}`)}" aria-label="${escapeHtml(`${t.time_label}: ${t.title}`)}"
      class="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ${cls} hover:scale-125 transition-transform" style="left:${pos(tm)}"></button>`;
  }).join('');
  const ticks = [start, (start + end) / 2, end].map((min) => Math.round(min / 60) * 60);
  const nowIn = s.m >= start && s.m <= end;
  return `
    <div class="mt-6">
      <div class="relative h-6">
        <div class="absolute inset-x-0 top-1/2 -translate-y-1/2 h-1.5 rounded-full bg-white/15"></div>
        ${nowIn ? `<div class="absolute top-1/2 -translate-y-1/2 left-0 h-1.5 rounded-full bg-gradient-to-r from-primary-500/60 to-primary-400" style="width:${pos(s.m)}"></div>
          <div class="absolute top-1/2 -translate-y-1/2 h-6 w-0.5 bg-primary-300 rounded-full" style="left:${pos(s.m)}" aria-hidden="true"></div>` : ''}
        ${dots}
      </div>
      <div class="flex justify-between mt-1.5 text-[11px] font-semibold text-white/50">${ticks.map((t) => `<span>${clock(t).replace(':00', '')}</span>`).join('')}</div>
    </div>`;
}

/** The hero's HTML. */
export function heroHtml(tasks, now = new Date()) {
  const s = snapshot(tasks, now);
  const dayLine = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()} · ${clock(s.m)}`;

  let pill, headline, sub;
  if (s.current) {
    const ago = s.m - toMin(s.current.time);
    pill = `${pulse} Due now`;
    headline = escapeHtml(s.current.title);
    sub = `${escapeHtml(s.current.time_label)} · <span class="font-semibold text-primary-300">${ago < 1 ? 'right now' : `${plural(ago, 'minute')} ago`}</span>`;
  } else if (s.next && s.next.due_date === s.todayIso) {
    pill = `${svg(ICON.clock, 'h-3.5 w-3.5')} Up next`;
    headline = escapeHtml(s.next.title);
    sub = `at ${escapeHtml(s.next.time_label)} · <span class="font-semibold text-primary-300">${until(toMin(s.next.time) - s.m)}</span>`;
  } else if (s.allDay.length) {
    pill = `${svg(ICON.bell, 'h-3.5 w-3.5')} Due today`;
    headline = s.allDay.length === 1 ? escapeHtml(s.allDay[0].title) : `${s.allDay.length} things due today`;
    sub = s.next ? `Then: ${escapeHtml(s.next.title)} — ${escapeHtml(when(s.next, s.todayIso))}` : 'Nothing else coming up in the next 30 days.';
  } else if (s.next) {
    pill = `${svg(ICON.check, 'h-3.5 w-3.5')} All clear today`;
    headline = `Next: ${escapeHtml(s.next.title)}`;
    sub = escapeHtml(when(s.next, s.todayIso));
  } else {
    pill = `${svg(ICON.check, 'h-3.5 w-3.5')} All clear`;
    headline = 'Nothing coming up';
    sub = 'No tasks in the next 30 days — enjoy the breathing room, or add one below.';
  }
  // The task the headline is about (opens on click)
  const nextToday = s.next?.due_date === s.todayIso ? s.next : null;
  const focus = s.current || nextToday || (s.allDay.length === 1 ? s.allDay[0] : null) || (s.allDay.length ? null : s.next);
  const detail = (s.current || nextToday)?.detail;

  // Today's all-day items (bills at 12 AM, "any time") as chips under the headline
  const chips = s.allDay.length && (s.current || s.next?.due_date === s.todayIso || s.allDay.length > 1)
    ? `<div class="mt-4 flex flex-wrap gap-2">${s.allDay.slice(0, 6).map((t) => `
        <button type="button" data-hero-open="${escapeHtml(t.encoded_id)}" class="inline-flex items-center gap-1.5 max-w-[16rem] rounded-full bg-white/10 hover:bg-white/20 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold transition-colors">
          ${svg(t.time === '00:00' ? ICON.bell : ICON.cal, 'h-3.5 w-3.5 flex-shrink-0 text-amber-300')}<span class="truncate">${escapeHtml(t.title)}</span></button>`).join('')}
        ${s.allDay.length > 6 ? `<span class="px-2 py-1 text-xs text-white/60">+${s.allDay.length - 6} more</span>` : ''}</div>`
    : '';

  const tile = (value, label) => `
    <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-3 py-2.5 min-w-0">
      <span class="block text-2xl font-bold leading-none">${value}</span>
      <span class="block text-[10px] font-semibold uppercase tracking-wider text-secondary-200 mt-1 truncate">${label}</span>
    </div>`;

  const coming = s.coming.length ? s.coming.map((t) => `
      <button type="button" data-hero-open="${escapeHtml(t.encoded_id)}" class="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 -mx-2 text-left hover:bg-white/10 transition-colors">
        <span class="h-9 w-9 flex-shrink-0 rounded-lg bg-white/10 ring-1 ring-white/15 flex flex-col items-center justify-center leading-none">
          <span class="text-[9px] font-bold uppercase text-primary-300">${escapeHtml(t.month)}</span><span class="text-sm font-bold">${escapeHtml(t.day)}</span></span>
        <span class="min-w-0 flex-1"><span class="block text-sm font-semibold truncate">${escapeHtml(t.title)}</span>
          <span class="block text-xs text-white/60 truncate">${escapeHtml(when(t, s.todayIso))}</span></span>
      </button>`).join('')
    : '<p class="text-sm text-white/60">Nothing else in the next 30 days.</p>';

  return `
    <div class="grid gap-6 lg:grid-cols-5">
      <div class="lg:col-span-3 min-w-0">
        <div class="flex flex-wrap items-center gap-2">
          <h1 class="inline-flex items-center rounded-full bg-primary-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wider">Tasks</h1>
          <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">${pill}</span>
          <span class="text-xs font-semibold text-white/60">${dayLine}</span>
        </div>
        <button type="button" ${focus ? `data-hero-open="${escapeHtml(focus.encoded_id)}"` : 'disabled'} class="block text-left mt-3 group">
          <span class="block text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] group-hover:underline decoration-white/30 underline-offset-8 break-words">${headline}</span>
        </button>
        <p class="mt-2 text-base text-secondary-50">${sub}</p>
        ${detail ? `<p class="mt-1 text-sm text-white/60 line-clamp-2 max-w-xl">${escapeHtml(detail)}</p>` : ''}
        ${chips}
        ${timeline(s)}
      </div>
      <div class="lg:col-span-2 space-y-4 min-w-0">
        <div class="grid grid-cols-4 gap-2">
          ${tile(s.counts.today, 'Today')}${tile(s.counts.tomorrow, 'Tomorrow')}${tile(s.counts.week, '7 days')}${tile(s.counts.month, '30 days')}
        </div>
        <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-4">
          <p class="text-xs font-bold uppercase tracking-wider text-secondary-200 mb-2">Coming up</p>
          <div class="space-y-1">${coming}</div>
        </div>
      </div>
    </div>`;
}

/** Lines for the screensaver card: now / next, then what's coming. */
export function saverHtml(tasks, now = new Date()) {
  const s = snapshot(tasks, now);
  const focus = s.current || s.next;
  const head = focus
    ? `<p class="text-xl sm:text-2xl text-white/80"><span class="text-white/45 text-base sm:text-lg uppercase tracking-widest mr-2">${s.current ? 'Now' : 'Next'}</span>${escapeHtml(focus.title)} <span class="text-white/45">· ${escapeHtml(when(focus, s.todayIso))}</span></p>`
    : '<p class="text-lg text-white/45">Nothing coming up.</p>';
  const rest = [...s.allDay.filter(() => !!focus), ...s.coming].slice(0, 4).map((t) => `
    <div class="flex items-center gap-3 text-lg text-white/70"><span class="flex-1 truncate">${escapeHtml(t.title)}</span><span class="text-white/45">${escapeHtml(when(t, s.todayIso))}</span></div>`).join('');
  return head + (rest ? `<div class="mt-4 space-y-2">${rest}</div>` : '');
}
