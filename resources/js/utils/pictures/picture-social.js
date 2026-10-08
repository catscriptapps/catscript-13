// /resources/js/utils/pictures/picture-social.js
//
// Emojis and comments on a picture — shared by the Pictures viewer and the
// full-screen slideshow (both dark overlays), so they look and behave the
// same in each.
//
//   const social = createPictureSocial({ host, post, current, onUpdated, onOpenChange });
//   social.renderBar(barEl)   the emoji row: the picture's emojis (tap one to
//                             take it off), quick picks, the full picker (+)
//                             and the comments button with its count
//   social.refresh()          after the current picture changes
//   social.toggleComments() / openComments() / closeComments() / isOpen()
//
// `post(body)` is the page's API call (server/api/pictures.php, or the guest
// store), `current()` the picture on screen, and `onUpdated(picture)` is told
// about every change so the page can patch its copy.

import { confirmDialog } from '../../ui/confirm.js';
import { showToast } from '../../ui/toast.js';
import { escapeHtml } from '../escape-html.js';
import { initEmojiPicker } from '../social-feed/emoji-picker.js';

export const QUICK_EMOJIS = ['❤️', '😍', '😂', '🥰', '🔥', '👏', '😮', '😢'];

const ICON_COMMENT = '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" /></svg>';
const ICON_SMILE_PLUS = '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.83 14.83a4 4 0 01-5.66 0M9 9.5h.01M15 9.5h.01M21 12a9 9 0 11-6.2-8.56M19 2v6m-3-3h6" /></svg>';
const ICON_TRASH = '<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>';
const ICON_CLOSE = '<svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>';

/** "just now", "5 min ago", "3 h ago", "Yesterday", "Mon, Oct 5"… */
export function whenText(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  if (mins < 24 * 60 && d.getDate() === new Date().getDate()) return `${Math.round(mins / 60)} h ago`;
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return `Yesterday, ${d.toLocaleTimeString('en-CA', { hour: 'numeric', minute: '2-digit' })}`;
  return d.toLocaleDateString('en-CA', { weekday: 'short', month: 'short', day: 'numeric', ...(d.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}) });
}

/** A big emoji that pops up over the photo and floats away. */
export function burst(host, emoji) {
  if (!host || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const el = document.createElement('span');
  el.textContent = emoji;
  el.setAttribute('aria-hidden', 'true');
  el.className = 'pointer-events-none absolute left-1/2 top-1/2 z-30 text-7xl sm:text-8xl drop-shadow-2xl select-none';
  host.appendChild(el);
  el.animate([
    { transform: 'translate(-50%, -30%) scale(0.4)', opacity: 0 },
    { transform: 'translate(-50%, -50%) scale(1.15)', opacity: 1, offset: 0.3 },
    { transform: 'translate(-50%, -60%) scale(1)', opacity: 1, offset: 0.6 },
    { transform: 'translate(-50%, -110%) scale(0.9)', opacity: 0 },
  ], { duration: 1100, easing: 'ease-out' }).onfinish = () => el.remove();
}

export function createPictureSocial({ host, post, current, onUpdated, onOpenChange = () => {} }) {
  const bars = new Set();
  let busy = false;

  // ---- Comments drawer (inside the overlay, slides in from the right) ----
  const drawer = document.createElement('aside');
  drawer.className = 'absolute inset-y-0 right-0 z-40 w-full sm:w-96 flex flex-col bg-gray-950/90 backdrop-blur-xl border-l border-white/10 text-white shadow-2xl translate-x-full transition-transform duration-300 ease-out';
  drawer.setAttribute('aria-label', 'Comments');
  drawer.setAttribute('aria-hidden', 'true');
  drawer.innerHTML = `
    <div class="flex items-center justify-between gap-3 px-5 h-16 flex-shrink-0 border-b border-white/10">
      <p class="text-base font-semibold">Comments <span class="ml-1 text-white/50 font-normal" data-ps-count></span></p>
      <button type="button" data-ps-close class="h-10 w-10 rounded-xl hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="Close comments">${ICON_CLOSE}</button>
    </div>
    <div class="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-5 py-4 space-y-3" data-ps-list></div>
    <form class="flex-shrink-0 border-t border-white/10 p-4" data-ps-form>
      <div class="rounded-2xl bg-white/10 focus-within:bg-white/15 ring-1 ring-white/10 focus-within:ring-primary-400 transition">
        <textarea data-ps-input rows="2" maxlength="1000" placeholder="Write a comment…"
          class="block w-full resize-none bg-transparent border-0 px-4 pt-3 text-sm text-white placeholder-white/40 focus:ring-0 outline-none"></textarea>
        <div class="flex items-center justify-between px-2 pb-2">
          <button type="button" data-ps-emoji class="h-9 w-9 rounded-xl text-white/70 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors" aria-label="Add an emoji">${ICON_SMILE_PLUS}</button>
          <button type="submit" data-ps-send class="rounded-xl bg-primary-600 hover:bg-primary-500 disabled:opacity-40 px-4 py-1.5 text-sm font-semibold text-white transition-colors">Post</button>
        </div>
      </div>
      <p class="mt-2 text-[11px] text-white/40">Enter to post · Shift+Enter for a new line</p>
    </form>`;
  host.appendChild(drawer);

  const input = drawer.querySelector('[data-ps-input]');
  initEmojiPicker(drawer.querySelector('[data-ps-emoji]'), input);

  drawer.addEventListener('click', async (e) => {
    if (e.target.closest('[data-ps-close]')) { closeComments(); return; }
    const del = e.target.closest('[data-ps-del]');
    if (del) {
      const p = current();
      if (!p || !(await confirmDialog('Delete this comment?', 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
      send({ _method: 'UNCOMMENT', id: p.encoded_id, comment_id: del.dataset.psDel });
    }
  });
  drawer.querySelector('[data-ps-form]').addEventListener('submit', (e) => { e.preventDefault(); postComment(); });
  input.addEventListener('keydown', (e) => {
    e.stopPropagation(); // the overlay's own keys (arrows, F, space…) stay out of the way
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); postComment(); }
    if (e.key === 'Escape') { e.preventDefault(); closeComments(); }
  });

  async function postComment() {
    const p = current();
    const body = input.value.trim();
    if (!p || !body || busy) return;
    if (await send({ _method: 'COMMENT', id: p.encoded_id, body })) {
      input.value = '';
      const list = drawer.querySelector('[data-ps-list]');
      list.scrollTop = list.scrollHeight;
    }
  }

  async function send(body) {
    busy = true;
    try {
      const json = await post(body);
      if (json.picture) onUpdated(json.picture);
      refresh();
      return true;
    } catch (err) {
      showToast(err.message, 'error');
      return false;
    } finally {
      busy = false;
    }
  }

  function renderComments() {
    const p = current();
    const comments = p?.comments || [];
    drawer.querySelector('[data-ps-count]').textContent = comments.length ? String(comments.length) : '';
    drawer.querySelector('[data-ps-list]').innerHTML = comments.length
      ? comments.map((c) => `
        <div class="group rounded-2xl bg-white/[0.07] ring-1 ring-white/10 px-4 py-3">
          <p class="text-sm leading-relaxed whitespace-pre-wrap break-words">${escapeHtml(c.body)}</p>
          <div class="mt-1.5 flex items-center justify-between gap-2">
            <span class="text-[11px] text-white/45">${escapeHtml(whenText(c.at))}</span>
            <button type="button" data-ps-del="${escapeHtml(c.id)}" class="h-7 w-7 -mr-1 rounded-lg text-white/40 hover:text-red-300 hover:bg-red-500/15 flex items-center justify-center transition sm:opacity-0 sm:group-hover:opacity-100 focus:opacity-100" aria-label="Delete comment">${ICON_TRASH}</button>
          </div>
        </div>`).join('')
      : `<div class="h-full flex flex-col items-center justify-center text-center text-white/50 py-10">
          <span class="text-4xl mb-3" aria-hidden="true">💬</span>
          <p class="text-sm font-semibold text-white/70">No comments yet</p>
          <p class="text-xs mt-1">Write down a memory, who's in it, or where it was.</p>
        </div>`;
  }

  // ---- Emoji bar ----
  function barHtml(p) {
    const mine = p?.reactions || [];
    const quick = QUICK_EMOJIS.filter((e) => !mine.includes(e));
    const count = (p?.comments || []).length;
    return `
      ${mine.map((e) => `<button type="button" data-ps-react="${escapeHtml(e)}" title="Take ${escapeHtml(e)} off" aria-label="Remove ${escapeHtml(e)}"
          class="h-10 min-w-10 px-2 rounded-full bg-white/20 ring-1 ring-white/30 text-xl leading-none hover:bg-white/30 transition">${escapeHtml(e)}</button>`).join('')}
      ${mine.length ? '<span class="mx-1 h-6 w-px bg-white/15" aria-hidden="true"></span>' : ''}
      <span class="hidden sm:contents">
        ${quick.slice(0, 6).map((e) => `<button type="button" data-ps-react="${escapeHtml(e)}" title="Add ${escapeHtml(e)}" aria-label="Add ${escapeHtml(e)}"
          class="h-10 w-10 rounded-full text-xl leading-none opacity-70 hover:opacity-100 hover:bg-white/10 hover:scale-125 transition">${escapeHtml(e)}</button>`).join('')}
      </span>
      <button type="button" data-ps-more title="More emojis" aria-label="More emojis"
        class="h-10 w-10 rounded-full text-white/80 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors">${ICON_SMILE_PLUS}</button>
      <button type="button" data-ps-comments aria-pressed="${isOpen()}" title="Comments (C)"
        class="ml-1 h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-sm font-semibold text-white/85 hover:text-white hover:bg-white/10 aria-pressed:bg-white/20 transition-colors">
        ${ICON_COMMENT}<span>${count ? count : '<span class="sr-only sm:not-sr-only">Comment</span>'}</span>
      </button>`;
  }

  function paintBar(el) {
    el.innerHTML = barHtml(current());
    initEmojiPicker(el.querySelector('[data-ps-more]'), (emoji) => react(emoji));
  }

  async function react(emoji) {
    const p = current();
    if (!p || busy) return;
    const adding = !(p.reactions || []).includes(emoji);
    if (await send({ _method: 'REACT', id: p.encoded_id, emoji }) && adding) burst(host, emoji);
  }

  function renderBar(el) {
    if (!bars.has(el)) {
      bars.add(el);
      el.addEventListener('click', (e) => {
        const r = e.target.closest('[data-ps-react]');
        if (r) { react(r.dataset.psReact); return; }
        if (e.target.closest('[data-ps-comments]')) toggleComments();
      });
    }
    paintBar(el);
  }

  function refresh() {
    bars.forEach((el) => { if (el.isConnected) paintBar(el); });
    renderComments();
  }

  // ---- Drawer open / close ----
  function isOpen() { return drawer.getAttribute('aria-hidden') === 'false'; }
  function setOpen(open) {
    drawer.classList.toggle('translate-x-full', !open);
    drawer.setAttribute('aria-hidden', String(!open));
    if (open) { renderComments(); setTimeout(() => input.focus({ preventScroll: true }), 250); } else input.blur();
    bars.forEach((el) => el.querySelector('[data-ps-comments]')?.setAttribute('aria-pressed', String(open)));
    onOpenChange(open);
  }
  const openComments = () => setOpen(true);
  const closeComments = () => { if (isOpen()) setOpen(false); };
  const toggleComments = () => setOpen(!isOpen());

  return { renderBar, refresh, react, isOpen, openComments, closeComments, toggleComments };
}
