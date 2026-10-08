// /resources/js/pages/social-feed-page.js

/**
 * Social Feed page logic (Real Estate World):
 *  - Composer (create post, with optional single photo/video attachment)
 *  - Feed actions (like, delete post, options menu)
 *  - View-post modal (comments, add/delete comment)
 *  - Follow graph (stats, suggestions, search, follow/unfollow)
 *  - Live updates (new posts, likes, comments) every 30 s — live-feed.js
 *
 * Guests get a browser-only try-it feed instead (utils/social-feed/guest-feed.js,
 * mounted on #social-guest — see social-feed.php's (!$isLoggedIn) branch).
 *
 * Exported `init()` is called by app.js on full load and after partial-load
 * navigation (see spa-router.js).
 */

import { AnimationEngine } from '../utils/animations.js';
import { initComposer } from '../utils/social-feed/compose-modal.js';
import { initFeedActions } from '../utils/social-feed/feed-actions.js';
import { initViewPost } from '../utils/social-feed/view-post.js';
import { initFollowUi } from '../utils/social-feed/follow.js';
import { initGuestFeed } from '../utils/social-feed/guest-feed.js';
import { initLiveFeed } from '../utils/social-feed/live-feed.js';

export function init() {
  AnimationEngine.refresh();

  if (document.getElementById('social-guest')) { initGuestFeed(); return; }
  if (!document.getElementById('social-feed-container')) return;

  initComposer();
  initFeedActions();
  initViewPost();
  initFollowUi();
  initLiveFeed(); // checks for new posts, likes and comments every 30 seconds
}
