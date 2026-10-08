// /resources/js/pages/pictures-page.js
//
// Pictures: the owner's whole gallery lives in memory (seeded from
// #pictures-data) and render() rebuilds the featured carousel, stats and the
// month-grouped grid from it. Uploads, captions, favourites and deletes
// patch that copy from the API response, so everything updates on the spot.
//
// The full-screen viewer (arrows / swipe / keyboard, caption editing,
// favourite, download, delete, emojis and comments) is one element on <body>,
// created once and reused across SPA visits. The Slideshow button plays the
// pictures full screen (utils/pictures/slideshow.js), with the same emojis,
// comments, favourite and delete on every slide. Page listeners are delegated from
// #pictures-page, which the SPA router replaces on each visit.

import { createUploadHandler } from '../modals/upload-modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { showToast } from '../ui/toast.js';
import { debounce } from '../utils/debounce.js';
import { escapeHtml } from '../utils/escape-html.js';
import { guestPictures } from '../utils/pictures/guest-store.js';
import { createPictureSocial } from '../utils/pictures/picture-social.js';
import { openSlideshow } from '../utils/pictures/slideshow.js';
import { initEmojiPicker } from '../utils/social-feed/emoji-picker.js';

const base = () => window.APP_CONFIG?.baseUrl || '/';
const api = () => `${base()}api/pictures`;

/** Gallery-grade uploads (the upload modal's defaults target small avatars). */
const UPLOAD_QUALITY = { maxDim: 2400, q: 0.86, targetKB: 900 };
const FEATURED_MAX = 8;
const FEATURED_SECONDS = 6;

let pictures = [];
let state = { filter: 'all', sort: 'newest', q: '' };
let selecting = false;
let selected = new Set();
let featuredTimer = null;
let featuredIndex = 0;

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

const parse = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const monthKey = (p) => (p.date || '').slice(0, 7);
const monthLabel = (key) => (key ? parse(`${key}-01`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }) : 'Undated');
const longDate = (p) => (p.date ? parse(p.date).toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }) : '');
const byId = (id) => pictures.find((p) => p.encoded_id === id);

// Guest (try-it) mode: the gallery lives in this browser (utils/pictures/guest-store.js)
let mode = 'account';
let slides = [];
const isGuest = () => mode === 'guest';

async function post(body) {
  if (isGuest()) {
    const json = await guestPictures.handle(body);
    if (!json.success) throw new Error(json.messages?.[0] || 'Something went wrong.');
    return json;
  }
  const res = await fetch(api(), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const json = await res.json().catch(() => ({ success: false, messages: ['Unexpected server response.'] }));
  if (!json.success) throw new Error(json.messages?.[0] || 'Something went wrong.');
  return json;
}

function patch(updated) {
  updated.forEach((u) => {
    const i = pictures.findIndex((p) => p.encoded_id === u.encoded_id);
    if (i >= 0) pictures[i] = u;
  });
}

/** Search looks in the caption and the comments. */
const matches = (p, q) => p.caption.toLowerCase().includes(q) || (p.comments || []).some((c) => c.body.toLowerCase().includes(q));

/** The pictures the grid currently shows, in order (the viewer walks this). */
function visible() {
  const q = state.q.toLowerCase();
  const list = pictures.filter((p) => (state.filter !== 'favourites' || p.favourite) && (!q || matches(p, q)));
  // `pictures` is kept newest first (server order, uploads prepended)
  return state.sort === 'oldest' ? [...list].reverse() : list;
}

// ------------------------------------------------------------
// Init
// ------------------------------------------------------------

export async function init() {
  const page = document.getElementById('pictures-page');
  if (!page || page.dataset.ready) return;
  page.dataset.ready = 'true';

  try { pictures = JSON.parse(document.getElementById('pictures-data')?.textContent || '[]'); } catch { pictures = []; }
  mode = page.dataset.mode === 'guest' ? 'guest' : 'account';
  try { slides = JSON.parse(page.dataset.slides || '[]'); } catch { slides = []; }
  if (isGuest()) pictures = await guestPictures.load(slides);
  state = { filter: 'all', sort: 'newest', q: '' };
  selecting = false;
  selected = new Set();
  featuredIndex = 0;

  page.addEventListener('click', onPageClick);
  document.getElementById('pic-selectbar')?.addEventListener('click', onSelectBarClick);

  const search = document.getElementById('pic-search');
  search?.addEventListener('input', debounce(() => { state.q = search.value.trim(); renderGrid(); }, 200));

  render();
}

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function render() {
  const has = pictures.length > 0;
  ['pic-stats', 'pic-toolbar', 'pic-select-btn', 'pic-slideshow-btn'].forEach((id) => document.getElementById(id)?.classList.toggle('hidden', !has));
  renderStats();
  renderFeatured();
  renderGrid();
}

function renderStats() {
  const now = new Date();
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const values = {
    total: pictures.length,
    month: pictures.filter((p) => monthKey(p) === thisMonth).length,
    favourites: pictures.filter((p) => p.favourite).length,
  };
  Object.entries(values).forEach(([k, v]) => {
    const el = document.querySelector(`#pic-stats [data-stat="${k}"]`);
    if (el) el.textContent = v.toLocaleString();
  });
}

function featuredList() {
  const favs = pictures.filter((p) => p.favourite);
  return (favs.length ? favs : pictures).slice(0, FEATURED_MAX);
}

function renderFeatured() {
  const el = document.getElementById('pic-featured');
  if (!el) return;
  clearInterval(featuredTimer);

  const list = featuredList();
  el.classList.toggle('hidden', list.length === 0);
  if (!list.length) { el.innerHTML = ''; return; }

  const usingFavourites = pictures.some((p) => p.favourite);
  featuredIndex = Math.min(featuredIndex, list.length - 1);

  el.innerHTML = `
    ${list.map((p, i) => `
      <button type="button" class="pic-featured-slide absolute inset-0 w-full h-full transition-opacity duration-1000 ${i === featuredIndex ? 'opacity-100' : 'opacity-0 pointer-events-none'}" data-open="${escapeHtml(p.encoded_id)}" aria-label="Open picture">
        <img src="${escapeHtml(p.url)}" alt="" class="absolute inset-0 w-full h-full object-cover" ${i === 0 ? '' : 'loading="lazy"'}>
      </button>`).join('')}
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"></div>
    <button type="button" data-slideshow class="absolute top-4 right-4 inline-flex items-center gap-2 rounded-full bg-black/35 hover:bg-black/55 backdrop-blur px-3.5 py-2 text-xs font-bold uppercase tracking-wider text-white ring-1 ring-white/25 transition-colors">
      <svg class="h-3.5 w-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z"/></svg>
      Slideshow
    </button>
    <div class="pointer-events-none absolute inset-x-0 bottom-0 p-5 sm:p-8 flex items-end justify-between gap-4">
      <div class="min-w-0">
        <span class="inline-flex items-center gap-1.5 rounded-full bg-white/15 backdrop-blur px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white ring-1 ring-white/20">
          ${usingFavourites
            ? '<svg class="h-3 w-3 text-pink-300" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.3h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z"/></svg> Favourites'
            : 'Latest uploads'}
        </span>
        <p class="mt-2 text-xl sm:text-3xl font-bold text-white truncate drop-shadow" data-featured-caption>${escapeHtml(list[featuredIndex].caption || longDate(list[featuredIndex]))}</p>
      </div>
      ${list.length > 1 ? `<div class="pointer-events-auto flex items-center gap-1.5 flex-shrink-0" data-featured-dots>
        ${list.map((_, i) => `<button type="button" data-featured-go="${i}" aria-label="Show picture ${i + 1}" class="h-1.5 rounded-full transition-all duration-300 ${i === featuredIndex ? 'w-6 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'}"></button>`).join('')}
      </div>` : ''}
    </div>
    ${list.length > 1 ? `
      <button type="button" data-featured-step="-1" aria-label="Previous" class="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur flex items-center justify-center transition-colors">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button type="button" data-featured-step="1" aria-label="Next" class="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-black/30 hover:bg-black/50 text-white backdrop-blur flex items-center justify-center transition-colors">
        <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
      </button>` : ''}`;

  if (list.length > 1 && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    featuredTimer = setInterval(() => {
      if (!document.body.contains(el)) { clearInterval(featuredTimer); return; }
      if (!el.matches(':hover')) showFeatured(featuredIndex + 1);
    }, FEATURED_SECONDS * 1000);
  }
}

function showFeatured(index) {
  const el = document.getElementById('pic-featured');
  const list = featuredList();
  if (!el || !list.length) return;
  featuredIndex = (index + list.length) % list.length;
  el.querySelectorAll('.pic-featured-slide').forEach((s, i) => {
    s.classList.toggle('opacity-100', i === featuredIndex);
    s.classList.toggle('opacity-0', i !== featuredIndex);
    s.classList.toggle('pointer-events-none', i !== featuredIndex);
  });
  el.querySelectorAll('[data-featured-go]').forEach((d, i) => {
    d.classList.toggle('w-6', i === featuredIndex);
    d.classList.toggle('bg-white', i === featuredIndex);
    d.classList.toggle('w-1.5', i !== featuredIndex);
    d.classList.toggle('bg-white/50', i !== featuredIndex);
  });
  const cap = el.querySelector('[data-featured-caption]');
  if (cap) cap.textContent = list[featuredIndex].caption || longDate(list[featuredIndex]);
}

function renderGrid() {
  const grid = document.getElementById('pic-grid');
  if (!grid) return;

  if (!pictures.length) {
    grid.innerHTML = `
      <button type="button" data-upload class="w-full py-16 flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 hover:border-primary-300 dark:hover:border-primary-800 hover:bg-primary-50/40 dark:hover:bg-primary-950/20 transition-colors">
        <span class="h-14 w-14 rounded-2xl bg-primary-50 dark:bg-primary-950/40 text-primary-500 flex items-center justify-center mb-4">
          <svg class="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
        </span>
        <span class="text-sm font-semibold text-gray-800 dark:text-gray-100">Your gallery is empty</span>
        <span class="text-xs text-gray-500 dark:text-gray-400 mt-1">Click to upload your first pictures — you can pick several at once.</span>
      </button>`;
    return;
  }

  const list = visible();
  if (!list.length) {
    grid.innerHTML = `
      <div class="py-16 text-center">
        <p class="text-sm font-semibold text-gray-700 dark:text-gray-200">${state.q ? 'Nothing matches' : 'No favourites yet'}</p>
        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${state.q ? 'Try a different word.' : 'Tap the heart on any picture to add it here — favourites also star in the carousel.'}</p>
      </div>`;
    return;
  }

  const groups = [];
  list.forEach((p) => {
    const key = monthKey(p);
    let g = groups[groups.length - 1];
    if (!g || g.key !== key) groups.push((g = { key, items: [] }));
    g.items.push(p);
  });

  grid.innerHTML = groups.map((g) => `
    <section class="mb-6 last:mb-0">
      <h3 class="px-1 mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
        ${escapeHtml(monthLabel(g.key))}
        <span class="font-semibold text-gray-400 dark:text-gray-500">${g.items.length}</span>
      </h3>
      <div class="columns-2 sm:columns-3 lg:columns-4 2xl:columns-5 gap-3 [column-fill:_balance]">
        ${g.items.map(tileHtml).join('')}
      </div>
    </section>`).join('');
}

const ICON_SMILE = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.83 14.83a4 4 0 01-5.66 0M9 9.5h.01M15 9.5h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>';
const ICON_COMMENT = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>';

/** A tile's emojis and comment count (hidden while hovered, when the actions show). */
function extrasBadge(p) {
  const emojis = p.reactions || [];
  const n = (p.comments || []).length;
  if (!emojis.length && !n) return '';
  const shown = emojis.slice(0, 4).join('');
  return `<span class="pointer-events-none absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-full bg-black/45 backdrop-blur px-2 py-0.5 text-white shadow group-hover:opacity-0 transition-opacity">
      ${shown ? `<span class="text-sm leading-6">${escapeHtml(shown)}${emojis.length > 4 ? `<span class="ml-0.5 text-[11px] font-semibold">+${emojis.length - 4}</span>` : ''}</span>` : ''}
      ${n ? `<span class="inline-flex items-center gap-1 text-xs font-semibold leading-6">${ICON_COMMENT.replace('h-4 w-4', 'h-3.5 w-3.5')}${n}</span>` : ''}
    </span>`;
}

function tileHtml(p) {
  const isSel = selected.has(p.encoded_id);
  return `
    <button type="button" data-tile="${escapeHtml(p.encoded_id)}"
      class="pic-tile group relative mb-3 block w-full break-inside-avoid overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 ${isSel ? 'ring-4 ring-primary-500' : ''}"
      aria-label="${escapeHtml(p.caption || 'Picture from ' + longDate(p))}">
      <img src="${escapeHtml(p.url)}" alt="" loading="lazy" class="block w-full h-auto transition-transform duration-500 group-hover:scale-[1.04] ${isSel ? 'opacity-80' : ''}">
      <span aria-hidden="true" class="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></span>
      ${extrasBadge(p)}
      <span class="absolute inset-x-0 bottom-0 p-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity ${selecting ? 'hidden' : ''}">
        <span class="pointer-events-none flex-1 min-w-0 pl-0.5 text-left text-xs font-semibold text-white truncate">${escapeHtml(p.caption)}</span>
        <span role="button" tabindex="-1" data-tile-react="${escapeHtml(p.encoded_id)}" title="Add an emoji" aria-label="Add an emoji"
          class="h-8 w-8 flex-shrink-0 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center transition-colors">${ICON_SMILE}</span>
        <span role="button" tabindex="-1" data-tile-comment="${escapeHtml(p.encoded_id)}" title="Comments" aria-label="Comments"
          class="h-8 w-8 flex-shrink-0 rounded-full bg-black/40 hover:bg-black/60 backdrop-blur text-white flex items-center justify-center transition-colors">${ICON_COMMENT}</span>
      </span>
      ${p.favourite ? `<span class="absolute top-2 right-2 h-7 w-7 rounded-full bg-white/90 dark:bg-gray-900/80 text-pink-500 flex items-center justify-center shadow">
        <svg class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.3h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z"/></svg>
      </span>` : ''}
      ${selecting ? `<span class="absolute top-2 left-2 h-6 w-6 rounded-full flex items-center justify-center ring-2 ring-white shadow ${isSel ? 'bg-primary-500 text-white' : 'bg-black/30'}">
        ${isSel ? '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>' : ''}
      </span>` : ''}
    </button>`;
}

// ------------------------------------------------------------
// Page clicks
// ------------------------------------------------------------

async function onPageClick(e) {
  if (e.target.closest('#pic-guest-sample, #pic-guest-clear')) {
    const sample = !!e.target.closest('#pic-guest-sample');
    if (!(await confirmDialog(sample ? 'Replace your guest gallery with the sample photos?' : 'Remove every guest picture and start with an empty gallery?', sample ? 'Reload sample' : 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700'))) return;
    pictures = sample ? await guestPictures.resetToSample(slides) : await guestPictures.clear();
    render();
    showToast(sample ? 'Sample gallery loaded.' : 'Started with an empty gallery.', 'success');
    return;
  }
  if (e.target.closest('#pic-upload-btn, [data-upload]')) { upload(); return; }
  if (e.target.closest('#pic-select-btn')) { setSelecting(!selecting); return; }
  if (e.target.closest('#pic-slideshow-btn, [data-slideshow]')) { startSlideshow(); return; }

  const filter = e.target.closest('[data-filter]');
  if (filter) {
    state.filter = filter.dataset.filter;
    document.querySelectorAll('#pic-toolbar [data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === filter)));
    renderGrid();
    return;
  }
  const sort = e.target.closest('[data-sort]');
  if (sort) {
    state.sort = sort.dataset.sort;
    document.querySelectorAll('#pic-toolbar [data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(b === sort)));
    renderGrid();
    return;
  }

  const step = e.target.closest('[data-featured-step]');
  if (step) { showFeatured(featuredIndex + Number(step.dataset.featuredStep)); return; }
  const go = e.target.closest('[data-featured-go]');
  if (go) { showFeatured(Number(go.dataset.featuredGo)); return; }
  const featured = e.target.closest('[data-open]');
  if (featured) { openViewer(featured.dataset.open, featuredList()); return; }

  // A tile's own emoji / comment buttons (shown on hover)
  const tileReact = e.target.closest('[data-tile-react]');
  if (tileReact && !selecting) {
    // Bound on first use (later clicks go straight to the picker)
    initEmojiPicker(tileReact, (emoji) => reactTo(tileReact.dataset.tileReact, emoji))?.();
    return;
  }
  const tileComment = e.target.closest('[data-tile-comment]');
  if (tileComment && !selecting) { openViewer(tileComment.dataset.tileComment, visible(), { comments: true }); return; }

  const tile = e.target.closest('[data-tile]');
  if (tile) {
    const id = tile.dataset.tile;
    if (selecting) { toggleSelected(id); return; }
    openViewer(id, visible());
  }
}

/** Put an emoji on (or take it off) a picture straight from its tile. */
async function reactTo(id, emoji) {
  try {
    const json = await post({ _method: 'REACT', id, emoji });
    replaceEverywhere(json.picture);
    renderGrid();
    showToast(json.messages?.[0] || 'Updated.', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ------------------------------------------------------------
// Slideshow (utils/pictures/slideshow.js)
// ------------------------------------------------------------

/** Play the pictures the grid shows (all of them, unless filtered), from the top. */
function startSlideshow(startId = null) {
  const list = visible().length ? visible() : pictures;
  if (!list.length) return;
  openSlideshow({
    list,
    startId: startId || list[0].encoded_id,
    post,
    onUpdated: (p) => { replaceEverywhere(p); render(); },
    onDeleted: (id) => { pictures = pictures.filter((x) => x.encoded_id !== id); render(); },
  });
}

// ------------------------------------------------------------
// Upload
// ------------------------------------------------------------

function upload() {
  if (isGuest()) {
    // Guests: pick files; they're resized and kept in this browser only
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.multiple = true;
    inp.addEventListener('change', async () => {
      const added = await guestPictures.add([...inp.files]);
      if (!added.length) { showToast('Those files couldn’t be read as pictures.', 'error'); return; }
      pictures = [...added.reverse(), ...pictures];
      render();
      showToast(added.length === 1 ? 'Picture added.' : `${added.length} pictures added.`, 'success');
    });
    inp.click();
    return;
  }
  createUploadHandler(api(), 'gallery', (files) => {
    const added = (files || []).filter((f) => f && f.encoded_id);
    if (!added.length) return;
    pictures = [...added.reverse(), ...pictures];
    render();
    showToast(added.length === 1 ? 'Picture added.' : `${added.length} pictures added.`, 'success');
  }, 4, true, { quality: UPLOAD_QUALITY });
}

// ------------------------------------------------------------
// Select mode
// ------------------------------------------------------------

function setSelecting(on) {
  selecting = on;
  selected = new Set();
  const btn = document.getElementById('pic-select-btn');
  btn?.classList.toggle('ring-2', on);
  btn?.classList.toggle('ring-primary-500', on);
  document.getElementById('pic-selectbar')?.classList.toggle('hidden', !on);
  updateSelectBar();
  renderGrid();
}

function toggleSelected(id) {
  if (selected.has(id)) selected.delete(id); else selected.add(id);
  updateSelectBar();
  renderGrid();
}

function updateSelectBar() {
  const bar = document.getElementById('pic-selectbar');
  if (!bar) return;
  bar.querySelector('[data-sel-count]').textContent = `${selected.size} selected`;
  bar.querySelectorAll('[data-sel="favourite"], [data-sel="delete"]').forEach((b) => { b.disabled = selected.size === 0; });
  const allFav = selected.size > 0 && [...selected].every((id) => byId(id)?.favourite);
  bar.querySelector('[data-sel="favourite"]').textContent = allFav ? 'Unfavourite' : 'Favourite';
}

async function onSelectBarClick(e) {
  const act = e.target.closest('[data-sel]')?.dataset.sel;
  if (!act) return;
  if (act === 'cancel') { setSelecting(false); return; }
  if (act === 'all') { visible().forEach((p) => selected.add(p.encoded_id)); updateSelectBar(); renderGrid(); return; }

  const ids = [...selected];
  if (!ids.length) return;

  try {
    if (act === 'favourite') {
      const favourite = !ids.every((id) => byId(id)?.favourite);
      const json = await post({ _method: 'PATCH', ids, favourite });
      patch(json.pictures || []);
      showToast(json.messages?.[0] || 'Updated.', 'success');
      setSelecting(false);
      render();
    }
    if (act === 'delete') {
      const n = ids.length;
      if (!(await confirmDialog(`Delete ${n === 1 ? 'this picture' : `these ${n} pictures`}? This can't be undone.`, 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      const json = await post({ _method: 'DELETE', ids });
      const gone = new Set(json.deleted || ids);
      pictures = pictures.filter((p) => !gone.has(p.encoded_id));
      showToast(json.messages?.[0] || 'Deleted.', 'success');
      setSelecting(false);
      render();
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ------------------------------------------------------------
// Viewer
// ------------------------------------------------------------

const viewer = { el: null, social: null, list: [], index: 0, touchX: null };

function ensureViewer() {
  if (viewer.el && document.body.contains(viewer.el)) return viewer.el;

  const el = document.createElement('div');
  el.id = 'pic-viewer';
  el.className = 'fixed inset-0 z-[10000] hidden flex-col overflow-hidden bg-gray-950/95 backdrop-blur-sm text-white';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-label', 'Picture viewer');
  el.innerHTML = `
    <div class="flex items-center justify-between gap-3 px-4 sm:px-6 h-16 flex-shrink-0">
      <div class="min-w-0">
        <p class="text-sm font-semibold" data-v-count></p>
        <p class="text-xs text-white/60 truncate" data-v-date></p>
      </div>
      <div class="flex items-center gap-1">
        <button type="button" data-v="slideshow" class="h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors" title="Slideshow from here" aria-label="Slideshow from here">
          <svg class="h-5 w-5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5.14v13.72a1 1 0 001.5.86l11-6.86a1 1 0 000-1.72l-11-6.86A1 1 0 008 5.14z"/></svg>
        </button>
        <button type="button" data-v="favourite" class="h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors" title="Favourite (F)" aria-label="Favourite"></button>
        <a data-v="download" download class="h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors" title="Download" aria-label="Download">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
        </a>
        <button type="button" data-v="delete" class="h-10 w-10 rounded-xl hover:bg-red-500/20 text-white/80 hover:text-red-300 flex items-center justify-center transition-colors" title="Delete" aria-label="Delete">
          <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        </button>
        <span class="mx-1 h-6 w-px bg-white/15"></span>
        <button type="button" data-v="close" class="h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors" title="Close (Esc)" aria-label="Close">
          <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>
    </div>
    <div class="relative flex-1 min-h-0 flex items-center justify-center px-2 sm:px-16" data-v-stage>
      <img data-v-img alt="" class="max-h-full max-w-full object-contain rounded-lg shadow-2xl select-none" draggable="false">
      <button type="button" data-v="prev" aria-label="Previous" class="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" /></svg>
      </button>
      <button type="button" data-v="next" aria-label="Next" class="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 h-12 w-12 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors">
        <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" /></svg>
      </button>
    </div>
    <div class="flex-shrink-0 px-4 sm:px-6 py-4">
      <div class="mx-auto max-w-2xl relative">
        <input type="text" data-v-caption maxlength="500" placeholder="Add a caption…"
          class="block w-full rounded-xl bg-white/10 focus:bg-white/15 border border-white/10 focus:border-primary-400 px-4 py-3 text-sm text-white placeholder-white/40 outline-none transition">
        <span data-v-saved class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-emerald-300 opacity-0 transition-opacity">Saved</span>
      </div>
      <div class="mx-auto max-w-2xl mt-2 flex flex-wrap items-center justify-center gap-1" data-v-bar></div>
    </div>`;
  document.body.appendChild(el);
  viewer.el = el;

  // Emojis and comments (utils/pictures/picture-social.js)
  viewer.social = createPictureSocial({
    host: el,
    post,
    current,
    onUpdated: (p) => { replaceEverywhere(p); render(); },
  });
  viewer.social.renderBar(el.querySelector('[data-v-bar]'));

  el.addEventListener('click', (e) => {
    const act = e.target.closest('[data-v]')?.dataset.v;
    if (act === 'close') closeViewer();
    else if (act === 'prev') stepViewer(-1);
    else if (act === 'next') stepViewer(1);
    else if (act === 'favourite') toggleFavourite();
    else if (act === 'delete') deleteCurrent();
    else if (act === 'slideshow') { const id = current()?.encoded_id; closeViewer(); startSlideshow(id); }
    else if (e.target.matches('[data-v-stage]')) closeViewer(); // backdrop click
  });

  const caption = el.querySelector('[data-v-caption]');
  caption.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); caption.blur(); }
    if (e.key === 'Escape') { e.stopPropagation(); caption.value = current()?.caption || ''; caption.blur(); }
  });
  caption.addEventListener('blur', saveCaption);

  const stage = el.querySelector('[data-v-stage]');
  stage.addEventListener('touchstart', (e) => { viewer.touchX = e.touches[0].clientX; }, { passive: true });
  stage.addEventListener('touchend', (e) => {
    if (viewer.touchX === null) return;
    const dx = e.changedTouches[0].clientX - viewer.touchX;
    viewer.touchX = null;
    if (Math.abs(dx) > 50) stepViewer(dx < 0 ? 1 : -1);
  });

  document.addEventListener('keydown', (e) => {
    if (!viewer.el || viewer.el.classList.contains('hidden')) return;
    if (e.target.matches?.('input, textarea')) return;
    if (document.getElementById('confirm-proceed')) return; // a confirm dialog (ui/confirm.js) is open
    if (e.key === 'Escape') { if (viewer.social.isOpen()) viewer.social.closeComments(); else closeViewer(); }
    else if (e.key === 'ArrowLeft') stepViewer(-1);
    else if (e.key === 'ArrowRight') stepViewer(1);
    else if (e.key.toLowerCase() === 'f') toggleFavourite();
    else if (e.key.toLowerCase() === 'c') viewer.social.toggleComments();
  });

  return el;
}

const current = () => viewer.list[viewer.index];

function openViewer(id, list, { comments = false } = {}) {
  ensureViewer();
  viewer.list = list.length ? list : pictures;
  viewer.index = Math.max(0, viewer.list.findIndex((p) => p.encoded_id === id));
  viewer.el.classList.remove('hidden');
  viewer.el.classList.add('flex');
  document.body.style.overflow = 'hidden';
  showCurrent();
  if (comments) viewer.social.openComments(); else viewer.social.closeComments();
}

function closeViewer() {
  if (!viewer.el) return;
  viewer.el.querySelector('[data-v-caption]').blur();
  viewer.social.closeComments();
  viewer.el.classList.add('hidden');
  viewer.el.classList.remove('flex');
  document.body.style.overflow = '';
}

function stepViewer(delta) {
  if (!viewer.list.length) return;
  viewer.el.querySelector('[data-v-caption]').blur();
  viewer.index = (viewer.index + delta + viewer.list.length) % viewer.list.length;
  showCurrent();
}

function showCurrent() {
  const p = current();
  if (!p) { closeViewer(); return; }
  const el = viewer.el;
  el.querySelector('[data-v-img]').src = p.url;
  el.querySelector('[data-v-count]').textContent = `${viewer.index + 1} of ${viewer.list.length}`;
  el.querySelector('[data-v-date]').textContent = longDate(p);
  el.querySelector('[data-v-caption]').value = p.caption;
  const dl = el.querySelector('[data-v="download"]');
  dl.href = p.url;
  dl.setAttribute('download', `${(p.caption || 'picture').replace(/[^\w\- ]+/g, '').trim().slice(0, 60) || 'picture'}.jpg`);
  el.querySelector('[data-v="favourite"]').innerHTML = p.favourite
    ? '<svg class="h-5 w-5 text-pink-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3.3 5 6.8 5c2 0 3.4 1.1 4.2 2.3h2C13.8 6.1 15.2 5 17.2 5c3.5 0 5.6 3.6 4.3 6.8C19.5 16.4 12 21 12 21z"/></svg>'
    : '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" /></svg>';
  el.querySelector('[data-v="favourite"]').setAttribute('aria-pressed', String(p.favourite));
  ['prev', 'next'].forEach((k) => el.querySelector(`[data-v="${k}"]`).classList.toggle('hidden', viewer.list.length < 2));
  viewer.social.refresh();

  // Warm the neighbours so arrowing through feels instant
  [1, -1].forEach((d) => {
    const n = viewer.list[(viewer.index + d + viewer.list.length) % viewer.list.length];
    if (n) new Image().src = n.url;
  });
}

async function saveCaption() {
  const p = current();
  const input = viewer.el?.querySelector('[data-v-caption]');
  if (!p || !input) return;
  const caption = input.value.trim();
  if (caption === p.caption) return;
  try {
    const json = await post({ _method: 'PATCH', id: p.encoded_id, caption });
    replaceEverywhere(json.picture);
    const saved = viewer.el.querySelector('[data-v-saved]');
    saved.classList.remove('opacity-0');
    setTimeout(() => saved.classList.add('opacity-0'), 1400);
    render();
  } catch (err) {
    showToast(err.message, 'error');
    input.value = p.caption;
  }
}

async function toggleFavourite() {
  const p = current();
  if (!p) return;
  try {
    const json = await post({ _method: 'PATCH', id: p.encoded_id, favourite: !p.favourite });
    replaceEverywhere(json.picture);
    showCurrent();
    render();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteCurrent() {
  const p = current();
  if (!p) return;
  if (!(await confirmDialog("Delete this picture? This can't be undone.", 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
  try {
    await post({ _method: 'DELETE', ids: [p.encoded_id] });
    pictures = pictures.filter((x) => x.encoded_id !== p.encoded_id);
    viewer.list = viewer.list.filter((x) => x.encoded_id !== p.encoded_id);
    viewer.index = Math.min(viewer.index, viewer.list.length - 1);
    showToast('Picture deleted.', 'success');
    render();
    if (viewer.list.length) showCurrent(); else closeViewer();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function replaceEverywhere(updated) {
  if (!updated) return;
  patch([updated]);
  const i = viewer.list.findIndex((x) => x.encoded_id === updated.encoded_id);
  if (i >= 0) viewer.list[i] = updated;
}
