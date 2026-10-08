// /resources/js/utils/dark-mode.js

/**
 * Dark/Light Mode toggle
 * Optimized for Sunlight Mode by default and Tailwind CSS utility classes.
 */

const DARK_CLASS = 'dark';
const STORAGE_KEY = 'user-theme';

export function initDarkMode() {
  const htmlEl = document.documentElement;
  const toggleBtn = document.getElementById('dark-toggle');

  // --- Step 1: Strict Default Logic (Enforce Sunlight Mode) ---
  let savedTheme = localStorage.getItem(STORAGE_KEY);

  // If no preference is saved, we force 'light' to avoid system-dark defaults
  if (!savedTheme) {
    savedTheme = 'light';
    localStorage.setItem(STORAGE_KEY, 'light');
  }

  // Apply the classes based on the strictly determined theme
  if (savedTheme === 'dark') {
    htmlEl.classList.add(DARK_CLASS);
  } else {
    // Explicitly remove to kill any "flash" if the server/browser guessed dark
    htmlEl.classList.remove(DARK_CLASS);
  }

  // --- Step 2: Toggle Event ---
  toggleBtn?.addEventListener('click', () => {
    // toggle() returns true if class was added, false if removed
    const isDark = htmlEl.classList.toggle(DARK_CLASS);
    localStorage.setItem(STORAGE_KEY, isDark ? 'dark' : 'light');
    
    // NOTE: UI updates (logos, icons) happen automatically via CSS
    // because we used 'dark:block' and 'dark:hidden' in the layout.
  });
}