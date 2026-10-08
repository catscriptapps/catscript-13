// /resources/js/utils/social-feed/view-post.js
//
// The "view post" modal: clicking a post's media or comment-count button
// clones the post's own header/content/media straight out of the DOM
// (instant, no fetch needed) then separately fetches the comment list +
// counts via AJAX. New comments append live; comment deletion is a
// two-click "confirm" guard, owner-only (server-enforced too).

import { showToast } from '../../ui/toast.js';
import { initEmojiPicker } from './emoji-picker.js';

const DELETE_CONFIRM_MS = 3000;

export function initViewPost() {
  const container = document.getElementById('social-feed-container');
  const modal = document.getElementById('view-post-modal');
  if (!container || !modal || modal.dataset.initialized) return;
  modal.dataset.initialized = 'true';

  container.addEventListener('click', (e) => {
    const trigger = e.target.closest('.post-media-trigger, .view-comments-btn');
    if (!trigger) return;
    openModal(trigger.closest('[data-post-id]'));
  });

  modal.querySelectorAll('.close-post-modal').forEach((btn) => btn.addEventListener('click', closeModal));
  document.getElementById('close-post-modal-overlay')?.addEventListener('click', closeModal);

  const commentInput = document.getElementById('post-comment-input');
  const submitBtn = document.getElementById('submit-comment-btn');
  initEmojiPicker(document.getElementById('comment-emoji-btn'), commentInput);

  submitBtn.addEventListener('click', submitComment);
  commentInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComment();
    }
  });

  document.getElementById('view-post-comments-list').addEventListener('click', (e) => {
    const delBtn = e.target.closest('[data-delete-comment]');
    if (delBtn) handleDeleteComment(delBtn);
  });
}

function closeModal() {
  document.getElementById('view-post-modal').classList.add('hidden');
}

function openModal(card) {
  if (!card) return;

  const modal = document.getElementById('view-post-modal');
  const postId = card.dataset.postId;
  modal.dataset.activePostId = postId;

  // Clone header/content/media straight from the card — instant, no fetch.
  const avatarSrc = card.querySelector('.user-avatar-img')?.getAttribute('src');
  const authorName = card.querySelector('.post-author-name')?.textContent?.trim() || 'User';
  const timeAgo = card.querySelector('.post-time-ago')?.textContent?.trim() || '';
  const content = card.querySelector('.px-4.pb-3 p')?.innerHTML || '';
  const mediaEl = card.querySelector('.post-main-media');

  const avatarBox = document.getElementById('view-post-avatar');
  avatarBox.innerHTML = avatarSrc
    ? `<img src="${avatarSrc}" class="h-10 w-10 rounded-full object-cover">`
    : authorName.charAt(0).toUpperCase();

  document.getElementById('view-post-author').textContent = authorName;
  document.getElementById('view-post-time').textContent = timeAgo;
  document.getElementById('view-post-content').innerHTML = content;

  const mediaContainer = document.getElementById('view-post-media-container');
  if (mediaEl) {
    mediaContainer.classList.remove('hidden');
    mediaContainer.innerHTML = mediaEl.outerHTML;
  } else {
    mediaContainer.classList.add('hidden');
    mediaContainer.innerHTML = '';
  }

  const likeCount = card.querySelector('.like-toggle-btn .like-count')?.textContent || '0';
  const commentCount = card.querySelector('.view-comments-btn span')?.textContent || '0';
  document.getElementById('modal-likes-count').textContent = likeCount;
  document.getElementById('modal-comments-count').textContent = commentCount;

  const list = document.getElementById('view-post-comments-list');
  list.innerHTML = `<div class="flex justify-center py-6"><div class="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent"></div></div>`;

  modal.classList.remove('hidden');
  loadComments(postId);
}

async function loadComments(postId) {
  const baseUrl = window.APP_CONFIG?.baseUrl || '/';
  const list = document.getElementById('view-post-comments-list');

  try {
    const response = await fetch(`${baseUrl}api/social-feed?action=get-details&post_id=${encodeURIComponent(postId)}`);
    const result = await response.json();

    if (!result.success) {
      list.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Couldn't load comments.</p>`;
      return;
    }

    list.innerHTML = result.html || `<p class="text-xs text-gray-400 text-center py-4">No comments yet — be the first.</p>`;
    document.getElementById('modal-likes-count').textContent = result.likes;
    document.getElementById('modal-comments-count').textContent = result.comments_count;
  } catch (err) {
    console.error('Load comments error:', err);
    list.innerHTML = `<p class="text-xs text-gray-400 text-center py-4">Couldn't load comments.</p>`;
  }
}

async function submitComment() {
  const modal = document.getElementById('view-post-modal');
  const postId = modal.dataset.activePostId;
  const input = document.getElementById('post-comment-input');
  const text = input.value.trim();
  if (!text || !postId) return;

  const baseUrl = window.APP_CONFIG?.baseUrl || '/';
  const submitBtn = document.getElementById('submit-comment-btn');
  submitBtn.disabled = true;

  try {
    const response = await fetch(`${baseUrl}api/social-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'add-comment', post_id: postId, content: text }),
    });
    const result = await response.json();

    if (result.success) {
      const list = document.getElementById('view-post-comments-list');
      list.querySelector('p.text-center')?.remove();
      list.insertAdjacentHTML('beforeend', result.commentHtml);
      list.scrollTop = list.scrollHeight;
      input.value = '';

      const countEl = document.getElementById('modal-comments-count');
      countEl.textContent = (parseInt(countEl.textContent, 10) || 0) + 1;
      updateCardCommentCount(postId, 1);
    } else {
      showToast(result.message || 'Could not post comment.', 'error');
    }
  } catch (err) {
    console.error('Add comment error:', err);
    showToast('Unexpected error.', 'error');
  } finally {
    submitBtn.disabled = false;
  }
}

function handleDeleteComment(btn) {
  if (btn.dataset.confirming === 'true') {
    doDeleteComment(btn);
    return;
  }

  btn.dataset.confirming = 'true';
  const original = btn.textContent;
  btn.textContent = 'Confirm?';

  btn._confirmTimeout = setTimeout(() => {
    btn.dataset.confirming = 'false';
    btn.textContent = original;
  }, DELETE_CONFIRM_MS);
}

async function doDeleteComment(btn) {
  clearTimeout(btn._confirmTimeout);
  const commentId = btn.dataset.deleteComment;
  const row = btn.closest('[data-comment-id]');
  const baseUrl = window.APP_CONFIG?.baseUrl || '/';
  const modal = document.getElementById('view-post-modal');
  const postId = modal.dataset.activePostId;

  try {
    const response = await fetch(`${baseUrl}api/social-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'delete-comment', comment_id: commentId }),
    });
    const result = await response.json();

    if (result.success) {
      row?.remove();
      const countEl = document.getElementById('modal-comments-count');
      countEl.textContent = Math.max(0, (parseInt(countEl.textContent, 10) || 1) - 1);
      updateCardCommentCount(postId, -1);
    } else {
      showToast(result.message || 'Could not delete comment.', 'error');
    }
  } catch (err) {
    console.error('Delete comment error:', err);
    showToast('Unexpected error.', 'error');
  }
}

function updateCardCommentCount(postId, delta) {
  const card = document.querySelector(`[data-post-id="${postId}"]`);
  const countEl = card?.querySelector('.view-comments-btn span');
  if (!countEl) return;
  countEl.textContent = Math.max(0, (parseInt(countEl.textContent, 10) || 0) + delta);
}
