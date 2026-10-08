// /resources/js/utils/dark-mode.js

/**
 * Re-applies the saved theme once the page is up (light / dark / system —
 * see utils/theme.js) and wires the #dark-toggle button that the DB reset
 * layout uses (the main layout's header goes through Alpine's
 * $store.theme.toggle() instead).
 */

import { applyTheme, setThemePref } from './theme.js';

export function initDarkMode() {
  applyTheme();

  document.getElementById('dark-toggle')?.addEventListener('click', () => {
    const isDark = document.documentElement.classList.contains('dark');
    setThemePref(isDark ? 'light' : 'dark');
  });
}
