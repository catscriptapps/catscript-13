// /resources/js/utils/theme.js
//
// The colour theme, in one place: 'light', 'dark' or 'system' (follow the
// device), saved per browser under localStorage 'user-theme'. The inline
// anti-flash <script> in each layout's <head> applies the same rule before
// first paint; app.js's Alpine theme store, the header toggle and the
// Settings → Appearance panel all go through setThemePref().

export const THEME_KEY = 'user-theme';
const media = window.matchMedia('(prefers-color-scheme: dark)');

/** The saved preference — light unless one was chosen. */
export function getThemePref() {
  try {
    const v = localStorage.getItem(THEME_KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

/** Puts the .dark class on <html> for a preference; returns whether it's dark. */
export function applyTheme(pref = getThemePref()) {
  const dark = pref === 'dark' || (pref === 'system' && media.matches);
  document.documentElement.classList.toggle('dark', dark);
  return dark;
}

/** Saves and applies a preference; returns whether the page is now dark. */
export function setThemePref(pref) {
  try {
    localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Private mode / blocked storage — still applies for this page
  }
  return applyTheme(pref);
}

/** Calls back (with isDark) when the device theme flips while on 'system'. */
export function onSystemThemeChange(callback) {
  media.addEventListener('change', () => {
    if (getThemePref() === 'system') callback(applyTheme('system'));
  });
}
