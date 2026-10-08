// /resources/js/utils/pic-reorder.js
//
// Owner-only picture reordering for the listing view modals (Real Estate
// World listings + quotations, Swap listings). Click a picture's reorder
// icon to pick it up (its border turns primary/orange), then click another
// picture's reorder icon to drop it into that picture's slot — pictures
// between the two shift over by one, whichever direction it moved. Click the
// picked icon again to cancel.
//
// A tile is any element carrying data-pic-tile + data-pic-id in the given
// wrapper; its reorder button is rendered with reorderButtonHtml(). The
// caller supplies onReorder(orderedIds), which persists the order and
// re-renders the wrapper (re-rendering also clears the pick-up state).

const IDLE_BORDER = ['border-gray-200', 'dark:border-gray-800'];
const PICKED_BORDER = ['border-primary-500', 'ring-2', 'ring-primary-500'];

export function reorderButtonHtml() {
  return `<button type="button" data-reorder-pic title="Reorder" aria-label="Reorder picture" class="absolute top-1 left-1 z-10 bg-white/90 dark:bg-gray-900/90 text-gray-700 dark:text-gray-200 hover:text-primary-600 rounded-md w-5 h-5 flex items-center justify-center shadow transition-colors">
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>
  </button>`;
}

function pickUp(tile) {
  tile.dataset.reorderPicked = '1';
  tile.classList.remove(...IDLE_BORDER);
  tile.classList.add(...PICKED_BORDER);
}

function putDown(tile) {
  delete tile.dataset.reorderPicked;
  tile.classList.remove(...PICKED_BORDER);
  tile.classList.add(...IDLE_BORDER);
}

/**
 * Moves fromId to toId's slot: removing it and re-inserting at toId's
 * original index leaves everything in between shifted by one, whether the
 * picture moved forwards or backwards.
 */
export function moveToSlot(ids, fromId, toId) {
  const next = [...ids];
  const from = next.indexOf(fromId);
  const to = next.indexOf(toId);
  if (from === -1 || to === -1 || from === to) return next;

  next.splice(from, 1);
  next.splice(to, 0, fromId);
  return next;
}

export function wirePicReorder(wrapper, onReorder) {
  if (!wrapper || wrapper.dataset.reorderWired) return;
  wrapper.dataset.reorderWired = 'true';

  wrapper.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-reorder-pic]');
    if (!btn || !wrapper.contains(btn)) return;

    e.stopPropagation();

    const tile = btn.closest('[data-pic-tile]');
    if (!tile) return;

    const picked = wrapper.querySelector('[data-pic-tile][data-reorder-picked]');

    if (!picked) {
      pickUp(tile);
      return;
    }

    if (picked === tile) {
      putDown(tile);
      return;
    }

    const ids = [...wrapper.querySelectorAll('[data-pic-tile]')].map((t) => t.dataset.picId);
    const reordered = moveToSlot(ids, picked.dataset.picId, tile.dataset.picId);

    wrapper.classList.add('pointer-events-none', 'opacity-60');
    try {
      await onReorder(reordered);
    } finally {
      wrapper.classList.remove('pointer-events-none', 'opacity-60');
      // If the caller didn't re-render (e.g. the save failed), drop the pick.
      const stillPicked = wrapper.querySelector('[data-pic-tile][data-reorder-picked]');
      if (stillPicked) putDown(stillPicked);
    }
  });
}
