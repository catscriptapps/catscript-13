// /resources/js/pages/slideshow-page.js
//
// Slideshow (admins + the "Slideshow" app): the photos behind every hero
// banner and the TV screensavers, in order. Everything lives in memory
// (seeded from #slideshow-data) and every write returns the fresh set.
//
//  - Grid: numbered tiles cropped like a banner. Reorder with each tile's
//    reorder button: click one to pick that photo up (thick orange border —
//    click it again to put it back), then click another photo's reorder
//    button to move the picked photo into that photo's place. The photos in
//    between shift over by one, forwards or backwards (utils/pic-reorder.js
//    moveToSlot). Esc also puts it back. The new order saves straight away.
//  - Select mode: tick tiles (or Select all), then Delete.
//  - Add photos: the shared uploader (modals/upload-modal.js — HEIC support,
//    resized in the browser), appended to the end.
//  - Preview: a full-screen viewer (one element on <body>, reused across SPA
//    visits) with Original / Banner / TV-screensaver views, caption editing,
//    move earlier / later / first / last, download and delete. ← / → / Esc,
//    swipe on phones.

import { createUploadHandler } from '../modals/upload-modal.js';
import { moveToSlot } from '../utils/pic-reorder.js';
import { showToast } from '../ui/toast.js';
import { confirmDialog } from '../ui/confirm.js';
import { escapeHtml } from '../utils/escape-html.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/slideshow`;
const HERO_SLIDE_MS = 6 * 1000;
const UPLOAD_QUALITY = { maxDim: 2400, q: 0.86, targetKB: 900 };
const LOW_RES = 1280; // narrower than this looks soft in a full-width banner

let data = { photos: [], ready: true };
let selecting = false;
let selected = new Set();
let picked = null;      // id of the photo picked up to move (its reorder button was clicked)
let heroTimer = null;
let viewer = null;     // the <body>-level preview element
let current = -1;      // index in data.photos shown in the viewer
let view = 'original'; // original | banner | tv

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
const shortDate = (s) => (s ? new Date(`${s}T00:00:00`).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' }) : '');
const mb = (b) => (b ? (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`) : '');
const svg = (path, cls = 'h-4 w-4') => `<svg class="${cls}" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${path}" /></svg>`;
const ICON = {
  eye: 'M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  left: 'M15 19l-7-7 7-7', right: 'M9 5l7 7-7 7', x: 'M6 18L18 6M6 6l12 12',
  first: 'M11 19l-7-7 7-7m8 14l-7-7 7-7', last: 'M13 5l7 7-7 7M5 5l7 7-7 7',
  download: 'M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4',
  reorder: 'M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4',
  check: 'M5 13l4 4L19 7', film: 'M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z',
};
/** Quality hints for a photo in a wide banner / on a TV. */
function hints(p) {
  const out = [];
  if (p.missing) out.push(['missing', 'File missing on the server']);
  if (p.width && p.width < LOW_RES) out.push(['low', `Low resolution (${p.width}px wide) — may look soft`]);
  if (p.width && p.height && p.height > p.width) out.push(['portrait', 'Portrait — banners crop most of it away']);
  return out;
}

async function post(body) {
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw new Error(json.messages?.[0] || 'Something went wrong.');
  return json;
}
function adopt(json) {
  if (json.photos) data.photos = json.photos;
  selected = new Set([...selected].filter((id) => data.photos.some((p) => p.id === id)));
}
async function reload() {
  try {
    const json = await (await fetch(api(), { cache: 'no-store' })).json();
    if (json.success) { adopt(json); render(); refreshHeroSlides(); }
  } catch { /* keep what we have */ }
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export function init() {
  const page = document.getElementById('slideshow-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { data = { ...data, ...JSON.parse(document.getElementById('slideshow-data')?.textContent || '{}') }; } catch { /* defaults */ }
  selecting = false;
  selected = new Set();

  picked = null;
  page.addEventListener('click', onClick);
  document.getElementById('ss-selectbar')?.addEventListener('click', onSelectBar);
  document.addEventListener('keydown', onPageKey);

  render();
  startHeroSlides();

  // #photo-12 opens that photo's preview (#photo-12/banner, #photo-12/tv for the crop views)
  const m = window.location.hash.match(/^#photo-(\d+)(?:\/(banner|tv))?$/);
  if (m) {
    openViewer(data.photos.findIndex((p) => p.id === Number(m[1])));
    if (m[2] && viewer) { view = m[2]; paintViewer(); }
  }
}

function startHeroSlides() {
  clearInterval(heroTimer);
  const slides = [...document.querySelectorAll('#slideshow-page [data-hero-slides] .hero-slide')];
  if (slides.length < 2 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let i = slides.findIndex((s) => s.classList.contains('is-active'));
  if (i < 0) i = 0;
  heroTimer = setInterval(() => {
    if (!document.body.contains(slides[0])) { clearInterval(heroTimer); return; }
    slides[i].classList.remove('is-active');
    i = (i + 1) % slides.length;
    slides[i].classList.add('is-active');
  }, HERO_SLIDE_MS);
}

/** Rebuild the live hero after a change, so it shows the new set in the new order. */
function refreshHeroSlides() {
  const hero = document.querySelector('#slideshow-page section');
  if (!hero) return;
  let box = hero.querySelector('[data-hero-slides]');
  const usable = data.photos.filter((p) => !p.missing);
  if (!usable.length) { box?.remove(); clearInterval(heroTimer); return; }
  if (!box) {
    box = document.createElement('div');
    box.className = 'absolute inset-0';
    box.setAttribute('aria-hidden', 'true');
    box.dataset.heroSlides = '';
    hero.prepend(box);
  }
  box.innerHTML = usable.map((p, i) => `<div class="hero-slide absolute inset-0 bg-cover bg-center ${i === 0 ? 'is-active' : ''}" style="background-image:url('${escapeHtml(p.url)}')"></div>`).join('');
  startHeroSlides();
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function render() { renderHero(); renderGrid(); renderSelectBar(); }

function renderHero() {
  const el = document.getElementById('ss-hero');
  if (!el) return;
  const photos = data.photos;
  const flagged = photos.filter((p) => hints(p).length);
  const newest = [...photos].sort((a, b) => (b.added || '').localeCompare(a.added || ''))[0];
  const tile = (value, label, note, accent = 'text-white') => `
    <div class="rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 px-4 py-3.5 min-w-0">
      <span class="block text-2xl sm:text-3xl font-bold leading-none ${accent} truncate">${value}</span>
      <span class="block text-[11px] font-semibold uppercase tracking-wider text-secondary-200 mt-1.5">${label}</span>
      ${note ? `<span class="block text-[11px] text-white/60 mt-0.5 truncate">${note}</span>` : ''}
    </div>`;
  el.innerHTML = `
    <div class="grid gap-6 lg:grid-cols-5 lg:items-end">
      <div class="lg:col-span-3 min-w-0">
        <span class="inline-flex items-center gap-2 rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">${svg(ICON.film, 'h-3.5 w-3.5')} Admin · Slideshow</span>
        <h1 class="mt-3 text-3xl sm:text-4xl font-bold tracking-tight drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]">${photos.length ? `${plural(photos.length, 'photo')} in the slideshow` : 'The slideshow is empty'}</h1>
        <p class="mt-2 text-base text-secondary-50 max-w-xl">${photos.length ? 'You’re watching it now. These photos play, in this order, behind every page banner and on the TV screensavers.' : 'Add photos and they’ll play behind every page banner and on the TV screensavers. Until then, banners show a plain gradient.'}</p>
        <div class="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-3">
          ${tile(photos.length, 'Photos', photos.length ? `${plural(Math.ceil(photos.length * HERO_SLIDE_MS / 1000 / 60) || 1, 'minute')} to loop` : 'add some')}
          ${tile(newest ? shortDate(newest.added) : '—', 'Last added', newest?.added_by ? `by ${escapeHtml(newest.added_by)}` : '')}
          ${tile(flagged.length, 'Worth a look', flagged.length ? 'soft or portrait photos' : 'all look good', flagged.length ? 'text-amber-300' : 'text-emerald-300')}
        </div>
      </div>
      <div class="lg:col-span-2 rounded-2xl bg-white/10 backdrop-blur-md ring-1 ring-white/15 p-4">
        <p class="text-xs font-bold uppercase tracking-wider text-secondary-200 mb-2">Where they appear</p>
        <ul class="space-y-1.5 text-sm text-white/85">
          <li class="flex gap-2"><span>🏠</span><span>The home page and every app’s banner</span></li>
          <li class="flex gap-2"><span>📺</span><span>The TV screensavers on Tasks, Cash Flow, Timetable, Chores and Medicals</span></li>
          <li class="flex gap-2"><span>💡</span><span>Wide landscape photos (1920px+) look best</span></li>
        </ul>
      </div>
    </div>`;
}

function tileHtml(p) {
  const on = selected.has(p.id);
  const isPicked = picked === p.id;
  const flags = hints(p);
  // The reorder button: "pick up" normally, "put it here" on the others while one is picked
  const reorderBtn = isPicked
    ? `<button type="button" data-reorder="${p.id}" title="Put it back (don’t move)" aria-pressed="true" class="h-9 w-9 rounded-xl bg-primary-500 text-white ring-2 ring-white flex items-center justify-center shadow-lg">${svg(ICON.reorder)}</button>`
    : `<button type="button" data-reorder="${p.id}" title="${picked ? `Move the picked photo to position ${p.position}` : 'Move this photo'}" aria-pressed="false"
        class="h-9 w-9 rounded-xl ${picked ? 'bg-primary-500/90 text-white ring-2 ring-white/80 animate-pulse' : 'bg-white/90 text-gray-700 hover:text-primary-600'} flex items-center justify-center shadow">${svg(ICON.reorder)}</button>`;
  return `
    <div data-tile data-id="${p.id}" class="group relative overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800 shadow-sm cursor-pointer select-none transition-shadow ${isPicked
      ? 'ring-[6px] ring-primary-500 ring-offset-2 ring-offset-white dark:ring-offset-gray-900 shadow-lg shadow-primary-500/30'
      : `ring-2 ${on ? 'ring-primary-500' : 'ring-transparent'}`}">
      <div class="aspect-[16/9]">
        ${p.missing ? `<div class="h-full w-full flex flex-col items-center justify-center text-gray-400 text-xs gap-1">${svg(ICON.x, 'h-6 w-6')}File missing</div>`
          : `<img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.caption || `Slideshow photo ${p.position}`)}" loading="lazy" draggable="false" class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105">`}
      </div>
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/30"></div>
      <span class="absolute top-2 left-2 h-7 min-w-[1.75rem] px-1.5 rounded-lg bg-black/55 backdrop-blur text-white text-xs font-black flex items-center justify-center">${p.position}</span>
      ${flags.length ? `<span title="${escapeHtml(flags.map((f) => f[1]).join(' · '))}" class="absolute top-2 left-11 rounded-lg bg-amber-400/90 px-1.5 py-1 text-[10px] font-bold text-amber-950">${flags[0][0] === 'portrait' ? 'Portrait' : flags[0][0] === 'low' ? 'Low-res' : 'Missing'}</span>` : ''}
      ${selecting
        ? `<span class="absolute top-2 right-2 h-7 w-7 rounded-full ${on ? 'bg-primary-500 text-white' : 'bg-white/80 text-transparent ring-2 ring-white'} flex items-center justify-center shadow">${svg(ICON.check)}</span>`
        : `${picked ? '' : `<span class="absolute top-2 right-2 flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button type="button" data-preview="${p.id}" title="Preview" class="h-8 w-8 rounded-lg bg-white/90 text-gray-700 hover:text-primary-600 flex items-center justify-center shadow">${svg(ICON.eye)}</button>
            <button type="button" data-delete="${p.id}" title="Delete" class="h-8 w-8 rounded-lg bg-white/90 text-gray-700 hover:text-red-600 flex items-center justify-center shadow">${svg(ICON.trash)}</button>
          </span>`}
          <span class="absolute bottom-2 right-2">${reorderBtn}</span>
          ${isPicked ? '<span class="absolute top-2 right-2 rounded-lg bg-primary-500 px-2 py-1 text-[10px] font-bold text-white shadow">Moving…</span>' : ''}`}
      ${p.caption ? `<p class="absolute bottom-3 left-3 right-14 text-xs font-semibold text-white truncate drop-shadow">${escapeHtml(p.caption)}</p>` : ''}
    </div>`;
}

function renderGrid() {
  const el = document.getElementById('ss-grid');
  if (!el) return;
  document.getElementById('ss-select-btn')?.classList.toggle('hidden', !data.photos.length || selecting);
  if (picked && !data.photos.some((p) => p.id === picked)) picked = null;
  if (!data.photos.length) {
    el.innerHTML = `
      <div class="py-16 px-6 text-center">
        <span class="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-500 mb-4">${svg(ICON.film, 'h-7 w-7')}</span>
        <p class="text-base font-semibold text-gray-800 dark:text-gray-100">No photos yet</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-1">Add a few wide, bright photos — they’ll start playing everywhere straight away.</p>
        ${data.ready ? '<button type="button" data-act="upload" class="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary-600 hover:bg-primary-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm">Add photos</button>' : ''}
      </div>`;
    return;
  }
  const p = data.photos.find((x) => x.id === picked);
  el.innerHTML = `
    ${p ? `
      <div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-primary-50 dark:bg-primary-950/40 border border-primary-200 dark:border-primary-900/60 px-4 py-2.5 text-sm text-primary-800 dark:text-primary-200">
        <span>Moving photo <strong>${p.position}</strong> — click the ${svg(ICON.reorder, 'inline h-4 w-4 align-text-bottom')} on the photo whose place it should take.</span>
        <button type="button" data-unpick class="ml-auto rounded-lg px-3 py-1 text-xs font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/50">Cancel</button>
      </div>` : ''}
    <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">${data.photos.map(tileHtml).join('')}</div>`;
}

/** Esc puts a picked-up photo back (the viewer handles its own keys). */
function onPageKey(e) {
  if (!document.getElementById('slideshow-page')) { document.removeEventListener('keydown', onPageKey); return; }
  if (e.key === 'Escape' && picked !== null && (!viewer || viewer.classList.contains('hidden'))) { picked = null; renderGrid(); }
}

/** Reorder button: pick a photo up, put it back, or drop the picked one into this photo's place. */
async function onReorder(id) {
  if (!data.ready) { showToast('Run the DB update from the header first — then the order can be changed here.', 'error'); return; }
  if (picked === null) { picked = id; renderGrid(); return; }   // pick up
  if (picked === id) { picked = null; renderGrid(); return; }   // put it back
  const ids = moveToSlot(data.photos.map((x) => x.id), picked, id); // forwards or backwards
  picked = null;
  await saveOrder(ids);
}

async function saveOrder(ids) {
  // Optimistic: show the new order (and numbers) straight away
  const byId = new Map(data.photos.map((p) => [p.id, p]));
  data.photos = ids.map((id, i) => ({ ...byId.get(id), position: i + 1 }));
  renderGrid();
  try {
    adopt(await post({ action: 'reorder', ids }));
    renderGrid();
    refreshHeroSlides();
    showToast('New order saved.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
    await reload();
  }
}

function renderSelectBar() {
  const bar = document.getElementById('ss-selectbar');
  if (!bar) return;
  bar.classList.toggle('hidden', !selecting);
  bar.querySelector('[data-sel-count]').textContent = `${selected.size} selected`;
  bar.querySelector('[data-sel="delete"]').disabled = !selected.size;
  bar.querySelector('[data-sel="all"]').textContent = selected.size === data.photos.length ? 'Select none' : 'Select all';
}

// ------------------------------------------------------------
// Clicks
// ------------------------------------------------------------

function onClick(e) {
  if (e.target.closest('#ss-upload-btn, [data-act="upload"]')) { openUpload(); return; }
  if (e.target.closest('#ss-select-btn')) { selecting = true; selected = new Set(); picked = null; renderGrid(); renderSelectBar(); return; }
  const ro = e.target.closest('[data-reorder]');
  if (ro) { onReorder(Number(ro.dataset.reorder)); return; }
  if (e.target.closest('[data-unpick]')) { picked = null; renderGrid(); return; }
  const pv = e.target.closest('[data-preview]');
  if (pv) { openViewer(data.photos.findIndex((p) => p.id === Number(pv.dataset.preview))); return; }
  const del = e.target.closest('[data-delete]');
  if (del) { removePhotos([Number(del.dataset.delete)]); return; }
  const tile = e.target.closest('[data-tile]');
  if (!tile) return;
  const id = Number(tile.dataset.id);
  // While a photo is picked up, only the reorder buttons act (no accidental previews)
  if (picked !== null && !selecting) return;
  if (selecting) {
    if (selected.has(id)) selected.delete(id); else selected.add(id);
    renderGrid(); renderSelectBar();
    return;
  }
  openViewer(data.photos.findIndex((p) => p.id === id));
}

function onSelectBar(e) {
  const act = e.target.closest('[data-sel]')?.dataset.sel;
  if (act === 'all') {
    selected = selected.size === data.photos.length ? new Set() : new Set(data.photos.map((p) => p.id));
  } else if (act === 'cancel') {
    selecting = false; selected = new Set();
  } else if (act === 'delete') {
    removePhotos([...selected]);
    return;
  }
  renderGrid(); renderSelectBar();
}

function openUpload() {
  if (!data.ready) return;
  createUploadHandler(api(), 'slideshow', async () => {
    await reload();
    showToast('Added to the slideshow.', 'success');
  }, 4, true, { quality: UPLOAD_QUALITY });
}

async function removePhotos(ids) {
  if (!ids.length) return;
  const n = ids.length;
  const left = data.photos.length - n;
  const msg = `Delete ${n === 1 ? 'this photo' : `these <strong>${n}</strong> photos`} from the slideshow? ${n === 1 ? 'It' : 'They'} can’t be recovered.${left === 0 ? '<br><br>That leaves the slideshow empty — banners will show a plain gradient.' : ''}`;
  if (!(await confirmDialog(msg, n === 1 ? 'Delete' : `Delete ${n}`, 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    const json = await post({ action: 'delete', ids });
    adopt(json);
    if (selecting && !data.photos.length) selecting = false;
    selected = new Set();
    render();
    refreshHeroSlides();
    if (viewer && !viewer.classList.contains('hidden')) {
      if (!data.photos.length) closeViewer();
      else { current = Math.min(current, data.photos.length - 1); paintViewer(); }
    }
    showToast(json.messages?.[0] || 'Deleted.', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

// ------------------------------------------------------------
// Viewer — custom full-screen preview
// ------------------------------------------------------------

function ensureViewer() {
  if (viewer && document.body.contains(viewer)) return viewer;
  viewer = document.createElement('div');
  viewer.id = 'ss-viewer';
  viewer.className = 'hidden fixed inset-0 flex flex-col bg-gray-950/95 backdrop-blur-sm text-white';
  viewer.style.zIndex = '2147483646';
  viewer.setAttribute('role', 'dialog');
  viewer.setAttribute('aria-modal', 'true');
  viewer.setAttribute('aria-label', 'Slideshow photo preview');
  document.body.appendChild(viewer);

  viewer.addEventListener('click', onViewerClick);
  viewer.addEventListener('change', onCaption);
  document.addEventListener('keydown', onViewerKey);
  // Swipe left / right on touch screens
  let x0 = null;
  viewer.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; }, { passive: true });
  viewer.addEventListener('touchend', (e) => {
    if (x0 === null) return;
    const dx = e.changedTouches[0].clientX - x0;
    x0 = null;
    if (Math.abs(dx) > 50 && !e.target.closest('input')) step(dx < 0 ? 1 : -1);
  });
  return viewer;
}

function openViewer(index) {
  if (index < 0) return;
  current = index;
  view = 'original';
  ensureViewer().classList.remove('hidden');
  document.documentElement.classList.add('overflow-hidden');
  paintViewer();
}

function closeViewer() {
  viewer?.classList.add('hidden');
  document.documentElement.classList.remove('overflow-hidden');
}

const step = (d) => {
  if (!data.photos.length) return;
  current = (current + d + data.photos.length) % data.photos.length;
  paintViewer();
};

function paintViewer() {
  const p = data.photos[current];
  if (!viewer || !p) return;
  const n = data.photos.length;
  const btn = 'inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors';
  const ghost = `${btn} bg-white/10 hover:bg-white/20`;
  const viewBtn = (key, label) => `<button type="button" data-view="${key}" aria-pressed="${view === key}" class="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${view === key ? 'bg-white text-gray-900' : 'text-white/70 hover:text-white'}">${label}</button>`;

  let stage;
  if (p.missing) {
    stage = '<div class="text-white/60 text-sm">This photo’s file is missing on the server — delete it and add it again.</div>';
  } else if (view === 'banner') {
    // As an app banner: wide, cropped to fill, under the dark gradient
    stage = `
      <div class="w-full max-w-6xl">
        <div class="relative overflow-hidden rounded-3xl shadow-2xl aspect-[16/5] bg-secondary-900">
          <img src="${escapeHtml(p.url)}" alt="" class="absolute inset-0 h-full w-full object-cover">
          <div class="absolute inset-0 bg-gradient-to-r from-secondary-950/90 via-secondary-900/75 to-secondary-900/40"></div>
          <div class="relative p-6 sm:p-10">
            <span class="inline-flex rounded-full bg-white/10 ring-1 ring-white/15 px-3 py-1 text-xs font-semibold">Business · Invoices</span>
            <p class="mt-3 text-2xl sm:text-4xl font-bold tracking-tight">$4,250 to collect</p>
            <p class="mt-2 text-sm text-secondary-50">How this photo sits behind a page banner — the edges are cropped to fill it.</p>
          </div>
        </div>
      </div>`;
  } else if (view === 'tv') {
    // As the TV screensaver: dimmed full screen with the clock card
    const now = new Date();
    stage = `
      <div class="w-full max-w-5xl">
        <div class="relative overflow-hidden rounded-2xl shadow-2xl aspect-[16/9] bg-black ring-8 ring-gray-800">
          <img src="${escapeHtml(p.url)}" alt="" class="absolute inset-0 h-full w-full object-cover opacity-60 scale-105">
          <div class="absolute left-[8%] bottom-[12%] rounded-3xl bg-black/35 backdrop-blur-md px-6 py-5">
            <p class="text-4xl sm:text-6xl font-bold tracking-tight">${now.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}</p>
            <p class="mt-1 text-sm sm:text-base text-white/80">${now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <p class="mt-3 text-sm text-white/70">Now · Homework time</p>
          </div>
        </div>
        <p class="mt-3 text-center text-xs text-white/50">On the TV the photo is dimmed and drifts slowly, and the clock card moves around.</p>
      </div>`;
  } else {
    stage = `<img src="${escapeHtml(p.url)}" alt="${escapeHtml(p.caption || '')}" class="max-h-full max-w-full object-contain rounded-lg shadow-2xl select-none" draggable="false">`;
  }

  const flags = hints(p);
  viewer.innerHTML = `
    <div class="flex items-center gap-3 px-4 sm:px-6 py-3 border-b border-white/10">
      <span class="rounded-lg bg-white/10 px-2.5 py-1 text-sm font-bold">${current + 1} <span class="text-white/50 font-semibold">of ${n}</span></span>
      <div class="hidden sm:inline-flex rounded-xl bg-white/10 p-1" role="group" aria-label="Preview as">
        ${viewBtn('original', 'Original')}${viewBtn('banner', 'Banner')}${viewBtn('tv', 'TV screensaver')}
      </div>
      <button type="button" data-v="close" class="ml-auto h-10 w-10 rounded-xl bg-white/10 hover:bg-white/20 flex items-center justify-center" aria-label="Close (Esc)">${svg(ICON.x, 'h-5 w-5')}</button>
    </div>

    <div class="relative flex-1 min-h-0 flex items-center justify-center p-4 sm:p-8">
      ${stage}
      ${n > 1 ? `
        <button type="button" data-v="prev" class="absolute left-2 sm:left-5 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center" aria-label="Previous (←)">${svg(ICON.left, 'h-6 w-6')}</button>
        <button type="button" data-v="next" class="absolute right-2 sm:right-5 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/25 flex items-center justify-center" aria-label="Next (→)">${svg(ICON.right, 'h-6 w-6')}</button>` : ''}
    </div>

    <div class="border-t border-white/10 px-4 sm:px-6 py-3 space-y-3">
      <div class="flex sm:hidden rounded-xl bg-white/10 p-1 w-max" role="group" aria-label="Preview as">${viewBtn('original', 'Original')}${viewBtn('banner', 'Banner')}${viewBtn('tv', 'TV')}</div>
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <input type="text" data-caption maxlength="255" value="${escapeHtml(p.caption)}" placeholder="Add a caption (only shown here, to help you keep track)…"
          class="lg:w-96 rounded-xl border-0 bg-white/10 px-3.5 py-2 text-sm text-white placeholder-white/40 focus:ring-2 focus:ring-primary-400 outline-none">
        <div class="flex flex-wrap items-center gap-1.5 lg:ml-auto">
          <button type="button" data-v="first" ${current === 0 ? 'disabled' : ''} class="${ghost} disabled:opacity-30" title="Make it the first photo">${svg(ICON.first)} First</button>
          <button type="button" data-v="earlier" ${current === 0 ? 'disabled' : ''} class="${ghost} disabled:opacity-30" title="Move one place earlier">${svg(ICON.left)} Earlier</button>
          <button type="button" data-v="later" ${current === n - 1 ? 'disabled' : ''} class="${ghost} disabled:opacity-30" title="Move one place later">Later ${svg(ICON.right)}</button>
          <button type="button" data-v="last" ${current === n - 1 ? 'disabled' : ''} class="${ghost} disabled:opacity-30" title="Make it the last photo">Last ${svg(ICON.last)}</button>
          ${p.missing ? '' : `<a href="${escapeHtml(p.url)}" download="${escapeHtml(p.file)}" class="${ghost}" title="Download">${svg(ICON.download)}</a>`}
          <button type="button" data-v="delete" class="${btn} bg-red-500/20 text-red-200 hover:bg-red-500/30">${svg(ICON.trash)} Delete</button>
        </div>
      </div>
      <p class="text-xs text-white/50">
        ${[p.width && p.height ? `${p.width} × ${p.height}px` : '', mb(p.bytes), p.added ? `added ${shortDate(p.added)}${p.added_by ? ` by ${escapeHtml(p.added_by)}` : ''}` : '', escapeHtml(p.file)].filter(Boolean).join(' · ')}
        ${flags.length ? `<span class="ml-2 text-amber-300 font-semibold">${flags.map((f) => escapeHtml(f[1])).join(' · ')}</span>` : ''}
      </p>
    </div>`;
}

async function move(to) {
  const ids = data.photos.map((p) => p.id);
  const id = ids[current];
  ids.splice(current, 1);
  const target = { first: 0, last: ids.length, earlier: current - 1, later: current + 1 }[to];
  ids.splice(target, 0, id);
  current = target;
  await saveOrder(ids);
  paintViewer();
}

function onViewerClick(e) {
  const v = e.target.closest('[data-view]');
  if (v) { view = v.dataset.view; paintViewer(); return; }
  const a = e.target.closest('[data-v]')?.dataset.v;
  if (!a) {
    // Click on the dark backdrop around the photo closes it
    if (e.target === viewer.querySelector('.flex-1')) closeViewer();
    return;
  }
  if (a === 'close') closeViewer();
  else if (a === 'prev') step(-1);
  else if (a === 'next') step(1);
  else if (a === 'delete') removePhotos([data.photos[current].id]);
  else move(a);
}

async function onCaption(e) {
  if (!e.target.matches('[data-caption]')) return;
  const p = data.photos[current];
  try {
    const json = await post({ action: 'caption', id: p.id, caption: e.target.value });
    adopt(json);
    renderGrid();
    showToast('Caption saved.', 'success');
  } catch (err) { showToast(err.message, 'error'); }
}

function onViewerKey(e) {
  if (!viewer || viewer.classList.contains('hidden')) return;
  if (e.target.matches?.('input, textarea')) { if (e.key === 'Escape') e.target.blur(); return; }
  if (e.key === 'Escape') closeViewer();
  else if (e.key === 'ArrowLeft') step(-1);
  else if (e.key === 'ArrowRight') step(1);
}
