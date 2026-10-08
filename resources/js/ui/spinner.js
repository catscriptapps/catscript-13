// /resources/js/ui/spinner.js

/**
 * Manages the global loading spinner UI element.
 */

const spinner = document.createElement('div');

export function setupSpinner() {
    // Create and append the spinner element only once
    // Fixed to the viewport (not the page's first screenful), above the
    // sticky header, sidebar and chat bubble (z-[9998]); below the
    // screensaver (z-[10000]) and confirm dialogs (z-[10010]).
    spinner.className = 'fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm hidden';
    spinner.setAttribute('role', 'status');
    spinner.setAttribute('aria-label', 'Loading');
    spinner.innerHTML = `<div class="w-12 h-12 border-4 border-orange-500 border-dashed rounded-full animate-spin"></div>`;
    document.body.appendChild(spinner);
}

export function showSpinner() {
    spinner.classList.remove('hidden');
}

export function hideSpinner() {
    spinner.classList.add('hidden');
}