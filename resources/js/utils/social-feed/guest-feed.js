// /resources/js/utils/social-feed/guest-feed.js
//
// Guest (try-it) Social Feed: a complete little feed that lives only in this
// browser's localStorage — sample people, posts, likes, comments and follows.
// Nothing is sent to the server. Same rules as the real feed
// (SocialFeedController): you see your own posts plus posts from people you
// follow, never a global stream; you can delete only your own posts and
// comments. The look mirrors components/social-feed/post-card.php.

import { showToast } from '../../ui/toast.js';
import { confirmDialog } from '../../ui/confirm.js';
import { escapeHtml } from '../escape-html.js';

const KEY = 'catscript.social.guest.v1';
const ME = 'me';
const MAX_POST = 2000;
const MAX_COMMENT = 500;
let memory = null;
let feed = null;
let slides = [];
let root = null;
let photo = null;          // pending composer photo (data URL)
const openComments = new Set();

const svg = (d, cls = 'w-5 h-5', fill = 'none') => `<svg class="${cls}" fill="${fill}" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="${d}" /></svg>`;
const ICON = {
  heart: 'M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z',
  chat: 'M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z',
  photo: 'M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z',
  trash: 'M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16',
  x: 'M6 18L18 6M6 6l12 12',
};
const TONES = ['bg-primary-600', 'bg-secondary-600', 'bg-emerald-600', 'bg-sky-600', 'bg-violet-600', 'bg-rose-600', 'bg-amber-600'];
const uid = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
const hoursAgo = (h) => Date.now() - h * 3600 * 1000;

function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'Just now';
  const m = Math.round(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? '' : 's'} ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hour${h === 1 ? '' : 's'} ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d} day${d === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ------------------------------------------------------------
// Sample data & storage
// ------------------------------------------------------------

function sample() {
  const people = [
    ['p1', 'Amara Okafor', 'Weekend baker & garden fan'],
    ['p2', 'Liam Tremblay', 'Hockey dad · coffee first'],
    ['p3', 'Sofia Rossi', 'Photos from everyday life'],
    ['p4', 'Noah Singh', 'Trails, bikes and the lake'],
    ['p5', 'Grace Kim', 'Books, tea and good company'],
    ['p6', 'Mateo García', 'Cooking for a crowd'],
  ].map(([id, name, bio], i) => ({ id, name, bio, tone: TONES[(i + 1) % TONES.length] }));
  const img = (i) => (slides.length ? slides[i % slides.length] : null);
  const posts = [
    ['p1', 'First sourdough of the season — the house smells amazing. Who wants the recipe?', img(0), 3, ['p2', 'p5', ME], [['p5', 'Yes please! 🙌'], ['p2', 'Save me a slice.']]],
    ['p3', 'Caught this on the evening walk. Some days the light just does all the work.', img(1), 7, ['p1', 'p4', 'p6'], [['p1', 'Gorgeous!']]],
    ['p2', 'Game day! Proud of the whole team — they played with so much heart.', null, 20, ['p1'], []],
    ['p4', 'Trail was muddy but worth it. Next week: the long loop around the lake.', img(2), 30, ['p3'], [['p3', 'Count me in.']]],
    ['p5', 'Finished a lovely book this weekend — quiet, warm and a little bit sad. Recommendations welcome.', null, 44, ['p2', 'p6'], []],
    ['p6', 'Sunday dinner for twelve. Nothing better than a full table.', img(3), 60, ['p1', 'p3', 'p5'], [['p5', 'Looks delicious!']]],
    [ME, 'Hello! Trying out the Social Feed — posts, likes and comments all stay in this browser.', null, 2, ['p1'], [['p1', 'Welcome aboard! 👋']]],
  ].map(([author, content, image, age, likes, comments]) => ({
    id: uid(), author, content, image, at: hoursAgo(age), likes,
    comments: comments.map(([who, text], k) => ({ id: uid(), author: who, text, at: hoursAgo(age - 0.5 - k * 0.3) })),
  }));
  return { people, following: ['p1', 'p3', 'p4'], posts };
}

function read() { try { const r = localStorage.getItem(KEY); return r ? JSON.parse(r) : null; } catch { return memory; } }
function write() {
  memory = feed;
  try { localStorage.setItem(KEY, JSON.stringify(feed)); return true; } catch { return false; }
}
function load() {
  const s = read();
  feed = s && Array.isArray(s.people) && Array.isArray(s.posts) ? s : sample();
  if (!s) write();
}

const person = (id) => (id === ME ? { id: ME, name: 'You (guest)', tone: 'bg-secondary-600' } : feed.people.find((p) => p.id === id) || { id, name: 'Someone', tone: 'bg-gray-500' });
const visible = () => feed.posts.filter((p) => p.author === ME || feed.following.includes(p.author)).sort((a, b) => b.at - a.at);
const avatar = (p, size = 'h-10 w-10', text = 'text-lg') => `<div class="${size} rounded-full ${p.tone} flex items-center justify-center text-white font-bold ${text} shadow-sm flex-shrink-0">${escapeHtml(p.name.charAt(0).toUpperCase())}</div>`;

// ------------------------------------------------------------
// Render
// ------------------------------------------------------------

function postCard(p) {
  const a = person(p.author);
  const liked = p.likes.includes(ME);
  const open = openComments.has(p.id);
  return `
    <div class="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-2xl shadow-sm overflow-hidden transition-all hover:shadow-md" data-g-post="${p.id}">
      <div class="p-4 flex items-center justify-between">
        <div class="flex items-center space-x-3">${avatar(a)}
          <div><h3 class="text-sm font-bold text-gray-900 dark:text-white leading-none">${escapeHtml(a.name)}</h3>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">${timeAgo(p.at)}</p></div>
        </div>
        ${p.author === ME ? `<button type="button" data-g-delete="${p.id}" class="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors" aria-label="Delete post">${svg(ICON.trash, 'w-4 h-4')}</button>` : ''}
      </div>
      ${p.content ? `<div class="px-4 pb-3"><p class="text-gray-800 dark:text-gray-200 text-sm leading-relaxed">${escapeHtml(p.content).replace(/\n/g, '<br>')}</p></div>` : ''}
      ${p.image ? `<div class="mt-2 bg-gray-100 dark:bg-gray-800 flex justify-center items-center overflow-hidden border-y border-gray-100 dark:border-gray-800"><img src="${escapeHtml(p.image)}" alt="" class="max-h-96 w-full object-cover"></div>` : ''}
      <div class="px-4 py-3 flex items-center space-x-6 border-t border-gray-50 dark:border-gray-800/50">
        <button type="button" data-g-like="${p.id}" class="flex items-center space-x-2 transition-all active:scale-110 ${liked ? 'text-primary-600' : 'text-gray-500 dark:text-gray-400 hover:text-primary-500'}" aria-pressed="${liked}">
          ${svg(ICON.heart, `w-5 h-5 ${liked ? 'fill-current' : 'fill-none'}`)}<span class="text-xs font-bold">${p.likes.length}</span></button>
        <button type="button" data-g-comments="${p.id}" class="flex items-center space-x-2 text-gray-500 dark:text-gray-400 hover:text-blue-500 transition-colors" aria-expanded="${open}">
          ${svg(ICON.chat)}<span class="text-xs font-bold">${p.comments.length}</span></button>
      </div>
      ${open ? `
        <div class="px-4 pb-4 space-y-3 border-t border-gray-100 dark:border-gray-800 pt-3">
          ${p.comments.map((c) => {
            const who = person(c.author);
            return `<div class="flex items-start gap-2.5">${avatar(who, 'h-8 w-8', 'text-xs')}
              <div class="min-w-0 flex-1 rounded-2xl bg-gray-50 dark:bg-gray-800 px-3 py-2">
                <p class="text-xs font-bold text-gray-900 dark:text-white">${escapeHtml(who.name)} <span class="font-normal text-gray-400">· ${timeAgo(c.at)}</span></p>
                <p class="text-sm text-gray-700 dark:text-gray-200 break-words">${escapeHtml(c.text)}</p>
              </div>
              ${c.author === ME ? `<button type="button" data-g-del-comment="${p.id}|${c.id}" class="p-1 text-gray-400 hover:text-red-600" aria-label="Delete comment">${svg(ICON.x, 'w-3.5 h-3.5')}</button>` : ''}
            </div>`;
          }).join('') || '<p class="text-xs text-gray-400">No comments yet — be the first.</p>'}
          <form data-g-comment-form="${p.id}" class="flex items-center gap-2">
            <input name="text" maxlength="${MAX_COMMENT}" autocomplete="off" placeholder="Write a comment…" class="flex-1 rounded-full border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-2 text-sm text-gray-900 dark:text-white placeholder-gray-400 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none">
            <button type="submit" class="px-4 py-2 rounded-full bg-primary-600 hover:bg-primary-700 text-xs font-bold text-white">Post</button>
          </form>
        </div>` : ''}
    </div>`;
}

function renderFeed() {
  const el = root.querySelector('#guest-feed-posts');
  const list = visible();
  el.innerHTML = list.length ? list.map(postCard).join('') : `
    <div class="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800 rounded-2xl p-10 text-center">
      <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Your feed is quiet</h4>
      <p class="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto mt-1">Share your first update, or follow people on the right to see their posts here.</p>
    </div>`;
}

function renderPeople() {
  const el = root.querySelector('#guest-feed-people');
  const mine = feed.posts.filter((p) => p.author === ME).length;
  el.innerHTML = `
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div class="h-8 bg-gradient-to-r from-secondary-500 to-secondary-900"></div>
      <div class="px-4 pb-3">
        <div class="flex items-start gap-3">
          <div class="-mt-5 h-12 w-12 flex-shrink-0 rounded-xl border-4 border-white dark:border-gray-900 bg-secondary-600 flex items-center justify-center text-white text-lg font-bold shadow-sm">Y</div>
          <div class="min-w-0 pt-1.5"><h2 class="text-base font-bold text-gray-900 dark:text-white leading-tight">You (guest)</h2><p class="text-xs text-gray-500">@guest</p></div>
        </div>
        <div class="flex items-center gap-5 border-t border-gray-100 dark:border-gray-800 mt-3 pt-2.5 text-sm">
          <span><strong class="text-gray-900 dark:text-white">${feed.following.length}</strong> <span class="text-[11px] text-gray-500 uppercase tracking-wider">Following</span></span>
          <span><strong class="text-gray-900 dark:text-white">${mine}</strong> <span class="text-[11px] text-gray-500 uppercase tracking-wider">${mine === 1 ? 'Post' : 'Posts'}</span></span>
        </div>
      </div>
    </div>
    <div class="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-4">
      <p class="text-xs font-bold uppercase tracking-wider text-gray-400 mb-3">People</p>
      <div class="space-y-3">${feed.people.map((p) => {
        const on = feed.following.includes(p.id);
        return `<div class="flex items-center gap-3">${avatar(p, 'h-9 w-9', 'text-sm')}
          <div class="min-w-0 flex-1"><p class="text-sm font-semibold text-gray-900 dark:text-white truncate">${escapeHtml(p.name)}</p><p class="text-xs text-gray-500 truncate">${escapeHtml(p.bio)}</p></div>
          <button type="button" data-g-follow="${p.id}" class="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-colors ${on ? 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-red-50 hover:text-red-600' : 'bg-primary-600 text-white hover:bg-primary-700'}">${on ? 'Following' : 'Follow'}</button>
        </div>`;
      }).join('')}</div>
    </div>`;
}

function renderComposer() {
  const prev = root.querySelector('#guest-feed-photo');
  prev.innerHTML = photo ? `
    <div class="relative mt-3 inline-block">
      <img src="${photo}" alt="" class="max-h-40 rounded-xl ring-1 ring-black/5">
      <button type="button" data-g-photo-remove class="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-gray-900 text-white flex items-center justify-center shadow" aria-label="Remove photo">${svg(ICON.x, 'w-3.5 h-3.5')}</button>
    </div>` : '';
}

function render() { renderFeed(); renderPeople(); renderComposer(); }

// ------------------------------------------------------------
// Actions
// ------------------------------------------------------------

async function pickPhoto() {
  const pick = Object.assign(document.createElement('input'), { type: 'file', accept: 'image/*' });
  pick.addEventListener('change', async () => {
    const file = pick.files?.[0];
    if (!file) return;
    try {
      const bitmap = await createImageBitmap(file);
      const r = Math.min(1, 1000 / Math.max(bitmap.width, bitmap.height));
      const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bitmap.width * r), height: Math.round(bitmap.height * r) });
      canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      photo = canvas.toDataURL('image/jpeg', 0.75);
      renderComposer();
    } catch { showToast('That image could not be read.', 'error'); }
  });
  pick.click();
}

function share(form) {
  const text = form.querySelector('[name="content"]').value.trim();
  if (!text && !photo) { showToast('Write something or add a photo first.', 'error'); return; }
  if (text.length > MAX_POST) { showToast(`Posts must be ${MAX_POST.toLocaleString()} characters or fewer.`, 'error'); return; }
  const post = { id: uid(), author: ME, content: text, image: photo, at: Date.now(), likes: [], comments: [] };
  feed.posts.push(post);
  if (!write()) {
    feed.posts.pop();
    showToast('This browser is out of room for demo photos — try a smaller one, or remove some posts.', 'error');
    return;
  }
  form.reset();
  photo = null;
  render();
  showToast('Posted.', 'success');
}

async function onClick(e) {
  const t = (sel) => e.target.closest(sel);
  if (t('#social-guest-sample') || t('#social-guest-clear')) {
    const sample = !!t('#social-guest-sample');
    if (!(await confirmDialog(sample ? 'Replace the demo feed with the sample posts and people?' : 'Remove every demo post and follow and start empty?', sample ? 'Reload sample' : 'Start empty', 'Cancel', 'bg-primary-600 hover:bg-primary-700'))) return;
    feed = sample ? sampleFeed() : { people: sampleFeed().people, following: [], posts: [] };
    write(); openComments.clear(); photo = null; render();
    showToast(sample ? 'Sample data reloaded.' : 'Starting empty — follow someone or share a post.', 'success');
    return;
  }
  if (t('[data-g-add-photo]')) { pickPhoto(); return; }
  if (t('[data-g-photo-remove]')) { photo = null; renderComposer(); return; }

  const like = t('[data-g-like]');
  if (like) {
    const p = feed.posts.find((x) => x.id === like.dataset.gLike);
    if (!p) return;
    p.likes = p.likes.includes(ME) ? p.likes.filter((x) => x !== ME) : [...p.likes, ME];
    write(); renderFeed(); return;
  }
  const com = t('[data-g-comments]');
  if (com) {
    const id = com.dataset.gComments;
    if (openComments.has(id)) openComments.delete(id); else openComments.add(id);
    renderFeed();
    if (openComments.has(id)) root.querySelector(`[data-g-comment-form="${id}"] input`)?.focus();
    return;
  }
  const del = t('[data-g-delete]');
  if (del) {
    if (!(await confirmDialog('Delete this post? This can’t be undone.', 'Delete', 'Cancel', 'bg-red-600 hover:bg-red-700'))) return;
    feed.posts = feed.posts.filter((p) => !(p.id === del.dataset.gDelete && p.author === ME));
    write(); renderFeed(); renderPeople(); showToast('Post deleted.', 'success'); return;
  }
  const dc = t('[data-g-del-comment]');
  if (dc) {
    const [pid, cid] = dc.dataset.gDelComment.split('|');
    const p = feed.posts.find((x) => x.id === pid);
    if (p) p.comments = p.comments.filter((c) => !(c.id === cid && c.author === ME));
    write(); renderFeed(); return;
  }
  const f = t('[data-g-follow]');
  if (f) {
    const id = f.dataset.gFollow;
    const on = feed.following.includes(id);
    feed.following = on ? feed.following.filter((x) => x !== id) : [...feed.following, id];
    write(); render();
    showToast(on ? `Unfollowed ${person(id).name}.` : `Following ${person(id).name} — their posts are in your feed now.`, 'success');
  }
}

function onSubmit(e) {
  const composer = e.target.closest('#guest-feed-composer');
  if (composer) { e.preventDefault(); share(composer); return; }
  const cf = e.target.closest('[data-g-comment-form]');
  if (!cf) return;
  e.preventDefault();
  const text = cf.querySelector('[name="text"]').value.trim();
  if (!text) return;
  if (text.length > MAX_COMMENT) { showToast(`Comments must be ${MAX_COMMENT} characters or fewer.`, 'error'); return; }
  const p = feed.posts.find((x) => x.id === cf.dataset.gCommentForm);
  if (!p) return;
  p.comments.push({ id: uid(), author: ME, text, at: Date.now() });
  write(); renderFeed();
  root.querySelector(`[data-g-comment-form="${p.id}"] input`)?.focus();
}

function sampleFeed() { return sample(); }

/** Mount the guest feed inside #social-guest (see pages/social-feed.php). */
export function initGuestFeed() {
  root = document.getElementById('social-guest');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = 'true';
  try { slides = JSON.parse(root.dataset.slides || '[]'); } catch { slides = []; }
  photo = null;
  openComments.clear();
  load();
  root.addEventListener('click', onClick);
  root.addEventListener('submit', onSubmit);
  render();
}
