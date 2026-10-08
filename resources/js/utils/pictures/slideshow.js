// /resources/js/utils/pictures/slideshow.js
//
// The Pictures slideshow: every picture full screen, cross-fading with a slow
// Ken Burns zoom (each photo whole, over a soft blurred copy of itself so
// nothing is cropped). Not a screensaver — no dimming; the photos are shown
// as they are.
//
// While it plays you can, on any slide: put emojis on it, comment on it
// (utils/pictures/picture-social.js), favourite it or delete it. The controls
// fade away after a few still seconds and come back with the mouse or a tap.
//
// Keys: ← → step · Space play / pause · F favourite · C comments ·
//       S shuffle · Esc close
//
//   openSlideshow({ list, startId, post, onUpdated, onDeleted })
//
// `list` is the pictures to play (in order), `post(body)` the page's API
// call, `onUpdated(picture)` / `onDeleted(id)` keep the page's copy in step.
// One element on <body>, created once and reused across SPA visits.

import { confirmDialog } from '../../ui/confirm.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml } from '../escape-html.js';
import { createPictureSocial } from './picture-social.js';

const SPEEDS = [5, 8, 12];          // seconds per slide
const FADE_MS = 1400;
const IDLE_HIDE_MS = 3200;

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const longDate = (p) => (p?.date ? parse(p.date).toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }) : '');

const ICONS = {
  play: '<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z"/></svg>',
  pause: '<svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/></svg>',
  shuffle: '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5" /></svg>',
  fullscreen: '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /></svg>',
  heart: '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>',
  heartOn: '<svg class="h-5 w-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.3h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z"/></svg>',
  trash: '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>',
  close: '<svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>',
  prev: '<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>',
  next: '<svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>',
};

const btn = 'h-11 w-11 rounded-xl hover:bg-white/15 flex items-center justify-center transition-colors aria-pressed:bg-white/20';

const ss = {
  el: null,
  social: null,
  list: [],
  order: [],          // indexes into list, in play order
  pos: 0,             // position in `order`
  playing: true,
  shuffle: false,
  speed: 1,           // index into SPEEDS
  progress: null,     // the progress bar's animation (its end moves to the next slide)
  idleTimer: null,
  wakeLock: null,
  opts: {},
  touchX: null,
  ownFullscreen: false, // we put the page in full screen (so we take it out again)
};

const current = () => ss.list[ss.order[ss.pos]];

function ensure() {
  if (ss.el && document.body.contains(ss.el)) return ss.el;

  const el = document.createElement('div');
  el.id = 'pic-slideshow';
  el.className = 'fixed inset-0 z-[10000] hidden bg-black text-white overflow-hidden select-none';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Slideshow');
  el.innerHTML = `
    <div class="absolute inset-0" data-ss-stage></div>

    <!-- Always on: the caption, date and the picture's emojis -->
    <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-gradient-to-t from-black/75 via-black/30 to-transparent"></div>
    <div class="pointer-events-none absolute left-0 right-0 bottom-0 px-5 sm:px-10 pb-24 sm:pb-24" data-ss-info>
      <p class="text-2xl sm:text-4xl font-bold drop-shadow-lg line-clamp-2 transition-opacity duration-700" data-ss-caption></p>
      <p class="mt-1.5 text-sm sm:text-base text-white/75 drop-shadow transition-opacity duration-700" data-ss-meta></p>
    </div>

    <!-- Controls (fade away when still) -->
    <div class="transition-opacity duration-500" data-ss-controls>
      <div aria-hidden="true" class="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-black/60 to-transparent"></div>
      <div class="absolute inset-x-0 top-0 flex items-center justify-between gap-3 px-3 sm:px-6 h-20">
        <div class="min-w-0 pl-2">
          <p class="text-sm font-semibold" data-ss-count></p>
          <p class="text-xs text-white/60" data-ss-state></p>
        </div>
        <div class="flex items-center gap-0.5 sm:gap-1">
          <button type="button" data-ss="play" class="${btn}" title="Play / pause (Space)" aria-label="Play or pause"></button>
          <button type="button" data-ss="shuffle" class="${btn} hidden sm:flex" title="Shuffle (S)" aria-label="Shuffle" aria-pressed="false">${ICONS.shuffle}</button>
          <button type="button" data-ss="speed" class="h-11 px-3 rounded-xl hover:bg-white/15 text-sm font-semibold tabular-nums transition-colors" title="Seconds per picture"></button>
          <button type="button" data-ss="fullscreen" class="${btn} hidden sm:flex" title="Full screen" aria-label="Full screen">${ICONS.fullscreen}</button>
          <span class="mx-1 h-6 w-px bg-white/20" aria-hidden="true"></span>
          <button type="button" data-ss="favourite" class="${btn}" title="Favourite (F)" aria-label="Favourite"></button>
          <button type="button" data-ss="delete" class="h-11 w-11 rounded-xl text-white/85 hover:text-red-300 hover:bg-red-500/20 flex items-center justify-center transition-colors" title="Delete" aria-label="Delete">${ICONS.trash}</button>
          <span class="mx-1 h-6 w-px bg-white/20" aria-hidden="true"></span>
          <button type="button" data-ss="close" class="${btn}" title="Close (Esc)" aria-label="Close slideshow">${ICONS.close}</button>
        </div>
      </div>

      <button type="button" data-ss="prev" aria-label="Previous" class="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-black/25 hover:bg-black/45 backdrop-blur flex items-center justify-center transition-colors">${ICONS.prev}</button>
      <button type="button" data-ss="next" aria-label="Next" class="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 h-14 w-14 rounded-full bg-black/25 hover:bg-black/45 backdrop-blur flex items-center justify-center transition-colors">${ICONS.next}</button>

      <div class="absolute left-0 right-0 bottom-0 px-3 sm:px-8 pb-5 flex justify-center sm:justify-start">
        <div class="flex flex-wrap items-center gap-1 rounded-full bg-black/35 backdrop-blur-md ring-1 ring-white/15 px-2 py-1" data-ss-bar></div>
      </div>
    </div>

    <!-- Progress to the next picture -->
    <div class="absolute inset-x-0 bottom-0 h-1 bg-white/10"><div class="h-full w-full origin-left bg-white/70" style="transform: scaleX(0)" data-ss-progress></div></div>`;
  document.body.appendChild(el);
  ss.el = el;

  ss.social = createPictureSocial({
    host: el,
    post: (body) => ss.opts.post(body),
    current,
    onUpdated: (p) => { replace(p); ss.opts.onUpdated?.(p); paintInfo(); },
    onOpenChange: (open) => { if (open) pause(true); else wake(); },
  });

  ss.social.renderBar(el.querySelector('[data-ss-bar]'));

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-ss]')?.dataset.ss;
    if (act === 'close') close();
    else if (act === 'prev') step(-1);
    else if (act === 'next') step(1);
    else if (act === 'play') togglePlay();
    else if (act === 'shuffle') toggleShuffle();
    else if (act === 'speed') cycleSpeed();
    else if (act === 'fullscreen') toggleFullscreen();
    else if (act === 'favourite') toggleFavourite();
    else if (act === 'delete') deleteCurrent();
  });

  ['pointermove', 'pointerdown'].forEach((ev) => el.addEventListener(ev, wake, { passive: true }));

  const stage = el.querySelector('[data-ss-stage]');
  stage.addEventListener('touchstart', (e) => { ss.touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (ss.touchX === null) return;
    const dx = e.changedTouches[0].clientX - ss.touchX;
    ss.touchX = null;
    if (Math.abs(dx) > 50) step(dx < 0 ? 1 : -1);
  });

  document.addEventListener('keydown', onKey);
  document.addEventListener('visibilitychange', () => {
    if (!isOpen()) return;
    if (document.hidden) ss.progress?.pause();
    else { if (ss.playing) ss.progress?.play(); keepAwake(); }
  });

  return el;
}

const isOpen = () => !!ss.el && !ss.el.classList.contains('hidden');

function onKey(e) {
  if (!isOpen()) return;
  if (e.target.matches?.('input, textarea')) return;
  if (document.getElementById('confirm-proceed')) return; // a confirm dialog (ui/confirm.js) is open
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') { if (ss.social.isOpen()) ss.social.closeComments(); else close(); }
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
  else if (e.key === ' ') { e.preventDefault(); togglePlay(); }
  else if (k === 'f') toggleFavourite();
  else if (k === 'c') ss.social.toggleComments();
  else if (k === 's') toggleShuffle();
  else return;
  wake();
}

// ------------------------------------------------------------
// Open / close
// ------------------------------------------------------------

export function openSlideshow({ list, startId, post, onUpdated, onDeleted }) {
  if (!list?.length) return;
  ensure();
  ss.opts = { post, onUpdated, onDeleted };
  ss.list = [...list];
  ss.playing = true;
  ss.order = buildOrder(Math.max(0, ss.list.findIndex((p) => p.encoded_id === startId)));
  ss.pos = 0;

  ss.el.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  ss.el.querySelector('[data-ss-stage]').innerHTML = '';
  ss.social.closeComments();
  paintControls();
  show(true);
  wake();
  keepAwake();
  // Straight to full screen on big screens (the click that opened it allows it)
  if (window.matchMedia('(min-width: 640px)').matches && !document.fullscreenElement) {
    enterFullscreen(true);
  }
}

function close() {
  if (!isOpen()) return;
  ss.social.closeComments();
  ss.progress?.cancel();
  ss.progress = null;
  clearTimeout(ss.idleTimer);
  ss.el.classList.add('hidden');
  ss.el.querySelector('[data-ss-stage]').innerHTML = '';
  document.body.style.overflow = '';
  if (ss.ownFullscreen && document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  ss.ownFullscreen = false;
  ss.wakeLock?.release?.().catch(() => {});
  ss.wakeLock = null;
}

/** Keep a TV / laptop screen from sleeping while the slideshow is up. */
async function keepAwake() {
  try {
    if (navigator.wakeLock && !ss.wakeLock && isOpen()) {
      ss.wakeLock = await navigator.wakeLock.request('screen');
      ss.wakeLock.addEventListener?.('release', () => { ss.wakeLock = null; });
    }
  } catch { /* not supported or not allowed */ }
}

// ------------------------------------------------------------
// Order
// ------------------------------------------------------------

/** Play order starting at `first`: in sequence, or shuffled after it. */
function buildOrder(first) {
  const n = ss.list.length;
  if (!ss.shuffle) return Array.from({ length: n }, (_, i) => (first + i) % n);
  const rest = Array.from({ length: n }, (_, i) => i).filter((i) => i !== first);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return [first, ...rest];
}

function toggleShuffle() {
  ss.shuffle = !ss.shuffle;
  ss.order = buildOrder(ss.order[ss.pos] ?? 0);
  ss.pos = 0;
  paintControls();
  paintInfo();
}

// ------------------------------------------------------------
// Slides
// ------------------------------------------------------------

function step(delta) {
  if (ss.list.length < 2) return;
  ss.pos = (ss.pos + delta + ss.order.length) % ss.order.length;
  // A full shuffled lap — shuffle again for the next one
  if (ss.shuffle && delta > 0 && ss.pos === 0) ss.order = buildOrder(ss.order[0]);
  show();
}

function show(first = false) {
  const p = current();
  if (!p) { close(); return; }
  const stage = ss.el.querySelector('[data-ss-stage]');

  const slide = document.createElement('div');
  slide.className = 'absolute inset-0 overflow-hidden';
  slide.style.opacity = '0';
  slide.innerHTML = `
    <img src="${escapeHtml(p.url)}" alt="" aria-hidden="true" class="absolute inset-0 w-full h-full object-cover blur-2xl scale-110 opacity-45" draggable="false">
    <img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.caption || 'Picture')}" class="absolute inset-0 w-full h-full object-contain will-change-transform" draggable="false" data-kb>`;
  stage.appendChild(slide);

  const old = [...stage.children].filter((c) => c !== slide);
  const fade = first || reducedMotion() ? 0 : FADE_MS;
  const img = slide.querySelector('[data-kb]');

  const reveal = () => {
    if (!slide.isConnected) return;
    slide.animate([{ opacity: 0 }, { opacity: 1 }], { duration: fade, easing: 'ease-in-out', fill: 'forwards' });
    old.forEach((o) => o.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fade, easing: 'ease-in-out', fill: 'forwards' }).onfinish = () => o.remove());
    kenBurns(img);
    paintInfo();
    restartProgress();
  };
  // Wait for the photo (briefly) so it doesn't fade in half-loaded
  if (img.complete) reveal();
  else {
    let done = false;
    const go = () => { if (!done) { done = true; reveal(); } };
    img.addEventListener('load', go, { once: true });
    img.addEventListener('error', go, { once: true });
    setTimeout(go, 2500);
  }

  // Warm the next photo
  const next = ss.list[ss.order[(ss.pos + 1) % ss.order.length]];
  if (next) new Image().src = next.url;
}

/** A slow zoom with a gentle drift, a different way each time. */
function kenBurns(img) {
  if (reducedMotion()) return;
  const zoomIn = Math.random() < 0.6;
  const dx = (Math.random() * 2 - 1) * 2.5;
  const dy = (Math.random() * 2 - 1) * 2;
  const near = 'scale(1.0) translate(0, 0)';
  const far = `scale(1.1) translate(${dx.toFixed(2)}%, ${dy.toFixed(2)}%)`;
  img.animate([{ transform: zoomIn ? near : far }, { transform: zoomIn ? far : near }], {
    duration: SPEEDS[ss.speed] * 1000 + FADE_MS * 2,
    easing: 'ease-out',
    fill: 'forwards',
  });
}

/** The progress bar doubles as the timer: when it fills, the next picture comes. */
function restartProgress() {
  ss.progress?.cancel();
  const bar = ss.el.querySelector('[data-ss-progress]');
  bar.parentElement.classList.toggle('hidden', ss.list.length < 2);
  if (ss.list.length < 2) { ss.progress = null; return; }
  ss.progress = bar.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: SPEEDS[ss.speed] * 1000, easing: 'linear', fill: 'forwards' });
  ss.progress.onfinish = () => { if (isOpen() && ss.playing) step(1); };
  if (!ss.playing || document.hidden) ss.progress.pause();
}

// ------------------------------------------------------------
// Controls
// ------------------------------------------------------------

function togglePlay() { if (ss.playing) pause(); else play(); }

function play() {
  ss.playing = true;
  if (ss.progress && ss.progress.playState === 'finished') step(1);
  else ss.progress?.play();
  paintControls();
}

function pause(quiet = false) {
  ss.playing = false;
  ss.progress?.pause();
  paintControls();
  if (!quiet) wake();
}

function cycleSpeed() {
  ss.speed = (ss.speed + 1) % SPEEDS.length;
  paintControls();
  restartProgress();
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  else enterFullscreen(false);
}

// The whole page goes full screen (not just the overlay), so the confirm
// dialog, toasts and emoji picker — all on <body> — still show over it.
function enterFullscreen(quiet) {
  const req = document.documentElement.requestFullscreen?.();
  if (!req) { if (!quiet) showToast('Full screen isn’t available here.', 'error'); return; }
  req.then(() => { ss.ownFullscreen = true; }).catch(() => { if (!quiet) showToast('Full screen isn’t available here.', 'error'); });
}

/** Show the controls (and the cursor); hide them again after a few still seconds. */
function wake() {
  if (!ss.el) return;
  const controls = ss.el.querySelector('[data-ss-controls]');
  controls.classList.remove('opacity-0', 'pointer-events-none');
  ss.el.classList.remove('cursor-none');
  clearTimeout(ss.idleTimer);
  ss.idleTimer = setTimeout(() => {
    // Stay up while paused, commenting, or picking an emoji
    if (!isOpen() || !ss.playing || ss.social.isOpen() || document.querySelector('.emoji-picker-popover')) return;
    controls.classList.add('opacity-0', 'pointer-events-none');
    ss.el.classList.add('cursor-none');
  }, IDLE_HIDE_MS);
}

function paintControls() {
  const el = ss.el;
  el.querySelector('[data-ss="play"]').innerHTML = ss.playing ? ICONS.pause : ICONS.play;
  el.querySelector('[data-ss="shuffle"]').setAttribute('aria-pressed', String(ss.shuffle));
  el.querySelector('[data-ss="speed"]').textContent = `${SPEEDS[ss.speed]}s`;
  el.querySelector('[data-ss-state]').textContent = [ss.playing ? 'Playing' : 'Paused', ss.shuffle ? 'shuffled' : ''].filter(Boolean).join(' · ');
  ['prev', 'next'].forEach((k) => el.querySelector(`[data-ss="${k}"]`).classList.toggle('hidden', ss.list.length < 2));
}

function paintInfo() {
  const p = current();
  if (!p || !ss.el) return;
  const el = ss.el;
  el.querySelector('[data-ss-count]').textContent = `${ss.pos + 1} of ${ss.list.length}`;
  el.querySelector('[data-ss-caption]').textContent = p.caption || '';
  const extras = [(p.reactions || []).join(' '), p.comments?.length ? `💬 ${p.comments.length}` : ''].filter(Boolean).join('   ');
  el.querySelector('[data-ss-meta]').textContent = [longDate(p), extras].filter(Boolean).join('   ·   ');
  el.querySelector('[data-ss="favourite"]').innerHTML = p.favourite ? ICONS.heartOn : ICONS.heart;
  el.querySelector('[data-ss="favourite"]').setAttribute('aria-pressed', String(!!p.favourite));
  ss.social.refresh();
}

function replace(p) {
  const i = ss.list.findIndex((x) => x.encoded_id === p.encoded_id);
  if (i >= 0) ss.list[i] = p;
}

async function toggleFavourite() {
  const p = current();
  if (!p) return;
  try {
    const json = await ss.opts.post({ _method: 'PATCH', id: p.encoded_id, favourite: !p.favourite });
    if (json.picture) { replace(json.picture); ss.opts.onUpdated?.(json.picture); }
    paintInfo();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCurrent() {
  const p = current();
  if (!p) return;
  const wasPlaying = ss.playing;
  pause(true);
  if (!(await confirmDialog("Delete this picture? This can't be undone.", 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) {
    if (wasPlaying) play();
    return;
  }
  try {
    await ss.opts.post({ _method: 'DELETE', ids: [p.encoded_id] });
    ss.opts.onDeleted?.(p.encoded_id);
    showToast('Picture deleted.', 'success');

    const gone = ss.order[ss.pos];
    ss.list.splice(gone, 1);
    if (!ss.list.length) { close(); return; }
    ss.order = ss.order.filter((i) => i !== gone).map((i) => (i > gone ? i - 1 : i));
    ss.pos = ss.pos % ss.order.length;
    paintControls();
    show();
    if (wasPlaying) play();
  } catch (err) {
    showToast(err.message, 'error');
    if (wasPlaying) play();
  }
}
