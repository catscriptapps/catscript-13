// /resources/js/utils/social-feed/live-feed.js
//
// Keeps the signed-in Social Feed current without a reload:
//
//   - every POLL_MS (and when you come back to the tab) it fetches the feed
//     (api/social-feed — page 1, server-rendered) and, if anything changed —
//     new posts, likes, comments, deletions — swaps it in;
//   - it never pulls the page out from under you: when you're scrolled down
//     reading and new posts have arrived, a "↑ N new posts" button appears
//     instead (one tap shows them and scrolls up);
//   - it skips a round while you're busy — typing a post or comment, a
//     window or menu open, a video playing — and tries again next time.
//
// refreshFeedNow() is also used straight after a follow / unfollow
// (follow.js), so their posts appear or go at once. #social-feed-container
// stays in place, so its delegated listeners (feed-actions.js,
// view-post.js) keep working.

const POLL_MS = 30 * 1000;
const NEAR_TOP_PX = 240;   // within this of the top of the feed, new posts just appear

/** The empty feed (same as pages/social-feed.php's). */
const EMPTY_FEED = `
  <div data-empty-feed class="bg-white dark:bg-gray-900 border border-dashed border-gray-300 dark:border-gray-800 rounded-2xl p-10 text-center">
    <svg class="h-8 w-8 text-gray-300 dark:text-gray-700 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" /></svg>
    <h4 class="text-sm font-bold text-gray-700 dark:text-gray-300">Your feed is quiet</h4>
    <p class="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto mt-1">Share your first update, or follow people from the sidebar to see their posts here.</p>
  </div>`;

let timer = null;
let request = 0;
let lastHtml = null;   // what's on screen (as the server sent it)
let lastCheck = 0;
let pending = null;    // fetched HTML waiting for the "new posts" button
let bound = false;

const container = () => document.getElementById('social-feed-container');
const baseUrl = () => window.APP_CONFIG?.baseUrl || '/';

/** Top-level post ids in a feed fragment (each card carries data-post-id). */
function postIds(root) {
  return [...root.children].map((el) => el.dataset.postId).filter(Boolean);
}

/** Someone is mid-something — don't swap the feed under them. */
function busy() {
  const c = container();
  return document.body.style.overflow === 'hidden'                                     // a modal is open
    || !!document.getElementById('confirm-proceed')
    || !document.getElementById('view-post-modal')?.classList.contains('hidden')       // reading a post
    || !!document.activeElement?.matches?.('input, textarea, select, [contenteditable="true"]')
    || !!c?.querySelector('.post-options-menu:not(.hidden)')
    || [...(c?.querySelectorAll('video') || [])].some((v) => !v.paused && !v.ended);
}

function nearTop() {
  const c = container();
  return !c || c.getBoundingClientRect().top > -NEAR_TOP_PX;
}

function apply(html) {
  const c = container();
  if (!c) return;
  c.innerHTML = html || EMPTY_FEED;
  lastHtml = html;
  pending = null;
  hidePill();
}

// --- The "new posts" button -------------------------------------------------

function showPill(count) {
  let pill = document.getElementById('feed-new-posts');
  if (!pill) {
    pill = document.createElement('button');
    pill.type = 'button';
    pill.id = 'feed-new-posts';
    pill.className = 'fixed left-1/2 -translate-x-1/2 top-24 z-30 inline-flex items-center gap-2 rounded-full bg-primary-600 hover:bg-primary-700 px-4 py-2 text-sm font-bold text-white shadow-xl shadow-primary-600/30 transition-all';
    pill.addEventListener('click', () => {
      if (pending !== null) apply(pending);
      container()?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    document.body.appendChild(pill);
  }
  pill.innerHTML = `<svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg> ${count} new ${count === 1 ? 'post' : 'posts'}`;
}

function hidePill() {
  document.getElementById('feed-new-posts')?.remove();
}

// --- Fetch & decide ---------------------------------------------------------

async function fetchFeed() {
  const res = await fetch(`${baseUrl()}api/social-feed`, { cache: 'no-store' });
  const json = await res.json();
  return json.success ? (json.html || '') : null;
}

/** The regular check: swap in changes when it's safe, otherwise offer them. */
async function check() {
  const c = container();
  if (!c) { stop(); return; }
  if (document.visibilityState !== 'visible') return;
  lastCheck = Date.now();
  const seq = ++request;
  let html;
  try { html = await fetchFeed(); } catch { return; } // offline for a moment
  if (html === null || seq !== request || !document.body.contains(c)) return;
  if (html === lastHtml) return; // nothing new

  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const shown = new Set(postIds(c));
  const fresh = postIds(tmp).filter((id) => !shown.has(id)).length;

  if (busy()) {
    // Keep it for later; just tell them if there are new posts
    if (fresh) { pending = html; showPill(fresh); }
    return;
  }
  if (fresh && !nearTop()) { pending = html; showPill(fresh); return; }
  apply(html);
}

/** Right now (after a follow / unfollow), with a quick fade. */
export async function refreshFeedNow() {
  const c = container();
  if (!c) return;
  const seq = ++request;
  c.style.transition = 'opacity 150ms ease';
  c.style.opacity = '0.5';
  try {
    const html = await fetchFeed();
    if (html !== null && seq === request && document.body.contains(c)) apply(html);
  } catch (err) {
    console.error('Feed refresh error:', err);
  } finally {
    if (seq === request) c.style.opacity = '';
  }
}

function stop() {
  clearInterval(timer);
  timer = null;
  hidePill();
}

export function initLiveFeed() {
  const c = container();
  if (!c) return;
  stop();
  // Start from what the page rendered, so the first check only reacts to real changes
  lastHtml = null;
  pending = null;
  fetchFeed().then((html) => { if (html !== null && lastHtml === null) lastHtml = html; }).catch(() => {});
  timer = setInterval(check, POLL_MS);

  if (!bound) {
    bound = true;
    // Back on the tab after a while: catch up straight away
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && timer && Date.now() - lastCheck >= POLL_MS) check();
    });
  }
}
