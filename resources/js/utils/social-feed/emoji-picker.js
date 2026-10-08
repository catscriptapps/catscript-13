// /resources/js/utils/social-feed/emoji-picker.js
//
// A lightweight, curated emoji grid — not a full emoji library. Attaches
// to a trigger button and inserts the picked emoji into a target
// textarea at the current cursor position. Reused by both the create-post
// composer and the view-post modal's comment box — and by Pictures, which
// passes a function as the target to receive the picked emoji instead.

const EMOJIS = [
  // Smileys
  '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
  '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
  '😘', '😋', '😛', '😜', '🤪', '🤗', '🤔', '🤨',
  '😐', '😑', '🙄', '😏', '😴', '🤤', '🥱', '😷',
  '🥵', '🥶', '🤯', '🥳', '😎', '🤓', '🧐', '😕',
  '😢', '😭', '😡', '🤬', '😱', '😳', '🥺', '😬',
  // Gestures & hearts
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '👏', '🙌',
  '🙏', '💪', '🤝', '👀', '🖤', '🤍', '💔', '❤️',
  '🧡', '💛', '💚', '💙', '💜', '💕', '💖', '💯',
  // Celebration & symbols
  '🔥', '✨', '🎉', '🎊', '⭐', '🌟', '⚡', '💡',
  // Real estate & everyday (kept from the original set, plus a few more)
  '🏠', '🏡', '🏢', '🔑', '📸', '📍', '🗺️', '📦',
  // Nature, food, misc favorites
  '☀️', '🌧️', '🌈', '☕', '🍕', '🎂', '🐶', '🐱',
];

const emojiOpeners = new WeakMap();

/** Bind the picker to its trigger; returns a function that opens / closes it. */
export function initEmojiPicker(triggerBtn, targetTextarea) {
  if (!triggerBtn || !targetTextarea) return undefined;
  if (triggerBtn.dataset.emojiInitialized) return emojiOpeners.get(triggerBtn);
  triggerBtn.dataset.emojiInitialized = 'true';

  let popover = null;

  function closePopover() {
    popover?.remove();
    popover = null;
    document.removeEventListener('click', onDocumentClick, true);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place, true);
  }

  /**
   * The popover floats on <body> (position: fixed), not inside the modal —
   * the post / composer modals clip their content (overflow-hidden), which
   * used to cut the grid off. Placed under the trigger, or above it when
   * there isn't room below, and kept inside the viewport.
   */
  function place() {
    if (!popover) return;
    // Its modal closed (or the page changed) — don't leave it floating
    if (!document.body.contains(triggerBtn) || !triggerBtn.offsetParent) { closePopover(); return; }
    const gap = 8;
    const margin = 12;
    const r = triggerBtn.getBoundingClientRect();
    const w = popover.offsetWidth;
    const h = popover.offsetHeight;
    const below = window.innerHeight - r.bottom - margin;
    const above = r.top - margin;
    const top = below >= h + gap || below >= above ? Math.min(r.bottom + gap, window.innerHeight - h - margin) : Math.max(margin, r.top - gap - h);
    const left = Math.min(Math.max(margin, r.right - w), window.innerWidth - w - margin);
    popover.style.top = `${Math.round(Math.max(margin, top))}px`;
    popover.style.left = `${Math.round(left)}px`;
  }

  function onDocumentClick(e) {
    if (popover && !popover.contains(e.target) && e.target !== triggerBtn) {
      closePopover();
    }
  }

  function openPopover() {
    if (popover) {
      closePopover();
      return;
    }

    popover = document.createElement('div');
    popover.className = 'emoji-picker-popover fixed grid grid-cols-8 gap-1 p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-2xl w-72 max-w-[calc(100vw-1.5rem)] max-h-[min(18rem,calc(100vh-1.5rem))] overflow-y-auto custom-scrollbar';
    // Above the modals it opens from (modal-factory stacks at 2147483647)
    popover.style.zIndex = '2147483647';
    popover.setAttribute('role', 'listbox');
    popover.setAttribute('aria-label', 'Emoji');
    popover.innerHTML = EMOJIS.map((e) => `<button type="button" role="option" class="emoji-option text-xl leading-none hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg p-1.5" data-emoji="${e}" aria-label="${e}">${e}</button>`).join('');

    document.body.appendChild(popover);
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true); // the modal's own scrolling too

    popover.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-emoji]');
      if (!btn) return;

      // A callback instead of a textarea: hand it the emoji (e.g. Pictures reactions)
      if (typeof targetTextarea === 'function') {
        closePopover();
        targetTextarea(btn.dataset.emoji);
        return;
      }

      const start = targetTextarea.selectionStart ?? targetTextarea.value.length;
      const end = targetTextarea.selectionEnd ?? targetTextarea.value.length;
      const emoji = btn.dataset.emoji;

      targetTextarea.value = targetTextarea.value.slice(0, start) + emoji + targetTextarea.value.slice(end);
      targetTextarea.focus();
      targetTextarea.selectionStart = targetTextarea.selectionEnd = start + emoji.length;
      targetTextarea.dispatchEvent(new Event('input', { bubbles: true }));

      closePopover();
    });

    setTimeout(() => document.addEventListener('click', onDocumentClick, true), 0);
  }

  triggerBtn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    openPopover();
  });

  // Returned (and kept) so a caller can open it right away, e.g. on a
  // trigger that's only bound on its first click
  emojiOpeners.set(triggerBtn, openPopover);
  return openPopover;
}
