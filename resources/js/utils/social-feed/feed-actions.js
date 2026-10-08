// /resources/js/utils/social-feed/feed-actions.js
//
// Delegated handlers for actions on a post card: like toggle (optimistic),
// the "⋮" options menu, and delete-post (two-click "confirm" guard, same
// pattern as the legacy platform). Delegated on #social-feed-container so
// it keeps working for cards prepended after a new post is created.

import { showToast } from '../../ui/toast.js';

const DELETE_CONFIRM_MS = 4000;

export function initFeedActions() {
  const container = document.getElementById('social-feed-container');
  if (!container || container.dataset.actionsInitialized) return;
  container.dataset.actionsInitialized = 'true';

  container.addEventListener('click', (e) => {
    const likeBtn = e.target.closest('.like-toggle-btn');
    if (likeBtn) return handleLike(likeBtn);

    const optionsBtn = e.target.closest('.post-options-btn');
    if (optionsBtn) return toggleOptionsMenu(optionsBtn);

    const deleteBtn = e.target.closest('.delete-post-btn');
    if (deleteBtn) return handleDeletePost(deleteBtn);

    // Clicking anywhere else closes any open options menu.
    document.querySelectorAll('.post-options-menu:not(.hidden)').forEach((menu) => menu.classList.add('hidden'));
  });
}

function toggleOptionsMenu(btn) {
  const menu = btn.closest('.post-options-container')?.querySelector('.post-options-menu');
  if (!menu) return;

  document.querySelectorAll('.post-options-menu').forEach((m) => {
    if (m !== menu) m.classList.add('hidden');
  });
  menu.classList.toggle('hidden');
}

async function handleLike(btn) {
  const postId = btn.dataset.id;
  const countEl = btn.querySelector('.like-count');
  const wasLiked = btn.classList.contains('text-primary-600');
  const icon = btn.querySelector('svg');

  // Optimistic UI update.
  const currentCount = parseInt(countEl.textContent, 10) || 0;
  countEl.textContent = wasLiked ? Math.max(0, currentCount - 1) : currentCount + 1;
  btn.classList.toggle('text-primary-600', !wasLiked);
  icon.classList.toggle('fill-current', !wasLiked);
  icon.classList.toggle('fill-none', wasLiked);

  const baseUrl = window.APP_CONFIG?.baseUrl || '/';

  try {
    const response = await fetch(`${baseUrl}api/social-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'toggle-like', post_id: postId }),
    });
    const result = await response.json();

    if (result.success) {
      countEl.textContent = result.like_count;
    } else {
      // Revert on failure.
      countEl.textContent = currentCount;
      btn.classList.toggle('text-primary-600', wasLiked);
      icon.classList.toggle('fill-current', wasLiked);
      icon.classList.toggle('fill-none', !wasLiked);
      showToast(result.message || 'Could not update like.', 'error');
    }
  } catch (err) {
    console.error('Like toggle error:', err);
    countEl.textContent = currentCount;
    btn.classList.toggle('text-primary-600', wasLiked);
  }
}

function handleDeletePost(btn) {
  if (btn.dataset.confirming === 'true') {
    doDeletePost(btn);
    return;
  }

  btn.dataset.confirming = 'true';
  const originalText = btn.querySelector('span').textContent;
  btn.querySelector('span').textContent = 'Click to Confirm';

  btn._confirmTimeout = setTimeout(() => {
    btn.dataset.confirming = 'false';
    btn.querySelector('span').textContent = originalText;
  }, DELETE_CONFIRM_MS);
}

async function doDeletePost(btn) {
  clearTimeout(btn._confirmTimeout);
  const postId = btn.dataset.postId;
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const baseUrl = window.APP_CONFIG?.baseUrl || '/';

  try {
    const response = await fetch(`${baseUrl}api/social-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-post', post_id: postId }),
    });
    const result = await response.json();

    if (result.success) {
      if (card) {
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        card.style.opacity = '0';
        card.style.transform = 'translateX(-10px)';
        setTimeout(() => card.remove(), 300);
      }
      showToast('Post deleted.', 'success');
    } else {
      showToast(result.message || 'Could not delete post.', 'error');
    }
  } catch (err) {
    console.error('Delete post error:', err);
    showToast('Unexpected error.', 'error');
  }
}
