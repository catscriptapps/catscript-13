// resources/js/ui/toast.js

/**
 * Simple toast utility (auto-removes after 3s)
 */
export function showToast(message, type = 'success') {
  // Never flash a bright toast over a TV screensaver (utils/screensaver.js)
  if (document.body.dataset.screensaver === 'on') return;

  const toast = document.createElement('div');
  toast.className = `
    fixed bottom-4 left-1/2 transform -translate-x-1/2
    px-4 py-2 rounded shadow-lg
    text-white text-sm font-medium
    ${type === 'success' ? 'bg-green-600' : 'bg-red-600'}
  `;
  // Modals stack at z-index 2147483647/48 (see modal-factory.js) — inline
  // style (not a Tailwind class, since arbitrary values this large get
  // clamped/misparsed) keeps the toast above even an open modal's overlay.
  toast.style.zIndex = '2147483648';
  toast.textContent = message;

  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0');
    setTimeout(() => toast.remove(), 500);
  }, 3000);
}
