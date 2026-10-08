// /resources/js/pages/settings-page.js
import { AnimationEngine } from '../utils/animations';
import { initSettingsAvatar } from '../utils/settings/settings-avatar.js';
import { initChangePasswordTrigger } from '../modals/change-password-modal.js';

export function init() {
    AnimationEngine.refresh();
    initSettingsAvatar();
    initChangePasswordTrigger();

    // Toggle logic for Settings (decorative mockup toggles on this page).
    const toggles = document.querySelectorAll('button[class*="rounded-full relative"]');
    toggles.forEach(toggle => {
        toggle.addEventListener('click', () => {
            const dot = toggle.querySelector('div');
            toggle.classList.toggle('bg-primary-500');
            toggle.classList.toggle('bg-gray-300');
            dot.classList.toggle('right-1');
            dot.classList.toggle('left-1');
        });
    });

    // Sidebar navigation simulation
    const navBtns = document.querySelectorAll('#settings-page aside button');
    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.className = 'w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all text-gray-500 hover:bg-white dark:hover:bg-white/5');
            btn.className = 'w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all bg-secondary-900 text-white shadow-xl shadow-secondary-900/20';
        });
    });
}
