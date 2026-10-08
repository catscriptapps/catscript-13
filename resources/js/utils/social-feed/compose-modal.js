// /resources/js/utils/social-feed/compose-modal.js
//
// The "Share Post" / composer-shortcut modal: text + an optional single
// photo or video, reusing the shared upload-modal.js (photo, WorkerPool-
// compressed) and video-upload-modal.js (video, chunked) engines already
// used elsewhere in this app. Submits as JSON to api/social-feed — no page
// reload; the returned post-card HTML is prepended live to the feed.

import { Modal } from '../../factories/modal-factory.js';
import { uploadModal, createUploadHandler } from '../../modals/upload-modal.js';
import { videoUploadModal, createVideoUploadHandler } from '../../modals/video-upload-modal.js';
import { showToast } from '../../ui/toast.js';
import { initEmojiPicker } from './emoji-picker.js';

let modal = null;
let media = null; // { url, fileName, type: 'image'|'video' }

function buildModal() {
  if (modal) return modal;

  const content = `
    <form id="compose-post-form" class="space-y-4">
      <div class="relative">
        <textarea id="compose-post-content" rows="4" placeholder="What's on your mind?"
          class="block w-full rounded-xl border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-3 px-4 pr-12 text-sm placeholder-gray-400 focus:border-primary-500 focus:ring-primary-500 text-gray-900 dark:text-white transition-all resize-none"></textarea>
        <button type="button" id="compose-emoji-btn" class="absolute right-3 top-3 text-gray-400 hover:text-primary-500">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </button>
      </div>

      <div id="compose-media-preview" class="hidden relative rounded-xl overflow-hidden border border-gray-200 dark:border-gray-800 bg-black"></div>

      <div class="flex items-center gap-2 pt-2 border-t border-gray-100 dark:border-gray-800">
        <button type="button" id="compose-add-photo" class="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <svg class="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
          Photo
        </button>
        <button type="button" id="compose-add-video" class="flex-1 inline-flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <svg class="w-4 h-4 text-rose-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
          Video
        </button>
      </div>

      <div id="compose-post-message"></div>
    </form>
  `;

  modal = new Modal({
    id: 'compose-post-modal',
    title: 'Share Post',
    content,
    size: 'md',
    showFooter: true,
    footerButtons: [
      { id: 'compose-post-submit', text: 'Post', classes: 'px-5 py-2 text-sm font-bold rounded-lg bg-primary-600 hover:bg-primary-700 text-white transition-colors' },
    ],
  });

  const textarea = document.getElementById('compose-post-content');
  initEmojiPicker(document.getElementById('compose-emoji-btn'), textarea);

  document.getElementById('compose-add-photo').addEventListener('click', () => {
    const baseUrl = window.APP_CONFIG?.baseUrl || '/';
    uploadModal.open();
    setTimeout(() => {
      createUploadHandler(
        `${baseUrl}api/post-media-upload`,
        'social-post-photo',
        (files) => {
          const file = files[0];
          if (!file) return;
          media = { url: file.url, type: 'image' };
          renderMediaPreview();
        },
        1,
        true,
        { single: true, maxFiles: 1 }
      );
    }, 50);
  });

  document.getElementById('compose-add-video').addEventListener('click', () => {
    const baseUrl = window.APP_CONFIG?.baseUrl || '/';
    videoUploadModal.open();
    setTimeout(() => {
      createVideoUploadHandler(`${baseUrl}api/post-video-upload`, (files) => {
        const file = files[0];
        if (!file) return;
        media = { url: file.url, type: 'video' };
        renderMediaPreview();
      });
    }, 50);
  });

  document.getElementById('compose-post-form').addEventListener('submit', (e) => e.preventDefault());
  document.getElementById('compose-post-submit').addEventListener('click', submitPost);

  return modal;
}

function renderMediaPreview() {
  const box = document.getElementById('compose-media-preview');
  if (!media) {
    box.classList.add('hidden');
    box.innerHTML = '';
    return;
  }

  box.classList.remove('hidden');
  box.innerHTML = media.type === 'image'
    ? `<img src="${media.url}" class="max-h-64 w-full object-contain">`
    : `<video src="${media.url}" class="max-h-64 w-full" controls></video>`;

  const removeBtn = document.createElement('button');
  removeBtn.type = 'button';
  removeBtn.className = 'absolute top-2 right-2 bg-red-600 text-white rounded-full w-7 h-7 flex items-center justify-center text-sm shadow-lg';
  removeBtn.innerHTML = '&times;';
  removeBtn.addEventListener('click', () => {
    media = null;
    renderMediaPreview();
  });
  box.appendChild(removeBtn);
}

async function submitPost() {
  const textarea = document.getElementById('compose-post-content');
  const content = textarea.value.trim();
  const messageBox = document.getElementById('compose-post-message');
  const submitBtn = document.getElementById('compose-post-submit');

  if (content === '' && !media) {
    messageBox.innerHTML = `<p class="text-xs text-red-600 dark:text-red-400 mt-1">Write something or attach a photo/video.</p>`;
    return;
  }

  const baseUrl = window.APP_CONFIG?.baseUrl || '/';
  submitBtn.disabled = true;
  const originalLabel = submitBtn.textContent;
  submitBtn.textContent = 'Posting...';
  messageBox.innerHTML = '';

  try {
    const response = await fetch(`${baseUrl}api/social-feed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        content,
        media_url: media?.url || '',
        media_type: media?.type || 'none',
      }),
    });
    const result = await response.json();

    if (result.success) {
      const container = document.getElementById('social-feed-container');
      if (container) {
        const emptyState = container.querySelector('[data-empty-feed]');
        emptyState?.remove();
        container.insertAdjacentHTML('afterbegin', result.html);
      }

      showToast('Post shared!', 'success');
      textarea.value = '';
      media = null;
      renderMediaPreview();
      modal.close();
    } else {
      messageBox.innerHTML = `<p class="text-xs text-red-600 dark:text-red-400 mt-1">${(result.errors || ['Please try again.']).join(' ')}</p>`;
    }
  } catch (err) {
    console.error('Create post error:', err);
    messageBox.innerHTML = `<p class="text-xs text-red-600 dark:text-red-400 mt-1">Unexpected error. Please try again.</p>`;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
}

export function initComposer() {
  const triggers = [
    document.getElementById('create-post-btn'),
    document.getElementById('composer-shortcut-btn'),
  ].filter(Boolean);

  triggers.forEach((btn) => {
    if (btn.dataset.composerInitialized) return;
    btn.dataset.composerInitialized = 'true';
    btn.addEventListener('click', () => buildModal().open());
  });

  const photoShortcut = document.getElementById('composer-photo-btn');
  if (photoShortcut && !photoShortcut.dataset.composerInitialized) {
    photoShortcut.dataset.composerInitialized = 'true';
    photoShortcut.addEventListener('click', () => {
      buildModal().open();
      setTimeout(() => document.getElementById('compose-add-photo')?.click(), 200);
    });
  }

  const videoShortcut = document.getElementById('composer-video-btn');
  if (videoShortcut && !videoShortcut.dataset.composerInitialized) {
    videoShortcut.dataset.composerInitialized = 'true';
    videoShortcut.addEventListener('click', () => {
      buildModal().open();
      setTimeout(() => document.getElementById('compose-add-video')?.click(), 200);
    });
  }
}
