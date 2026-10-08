// /resources/js/ui/tab-switcher.js

/**
 * Generic Tab Switcher Utility for Folder-Style Tabs
 */
export function initTabSwitcher(selector) {
    const container = document.querySelector(selector);
    if (!container) {
        console.warn(`Tab container not found: ${selector}`);
        return;
    }

    const buttons = container.querySelectorAll('[data-tab-target]');
    const panes = document.querySelectorAll('.tab-pane');

    const activeClasses = ['bg-white', 'dark:bg-gray-900', 'text-primary-600', 'border-gray-200', 'dark:border-gray-800', 'z-10', '-mb-[1px]'];
    const inactiveClasses = ['bg-gray-100/80', 'dark:bg-gray-800/60', 'text-gray-400', 'border-transparent'];

    buttons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent jump if they were <a> tags
            const targetId = btn.getAttribute('data-tab-target');

            buttons.forEach(b => {
                b.classList.remove(...activeClasses);
                b.classList.add(...inactiveClasses);
                b.classList.remove('font-black');
                b.classList.add('font-bold');
            });

            btn.classList.add(...activeClasses);
            btn.classList.remove(...inactiveClasses);
            btn.classList.add('font-black');
            btn.classList.remove('font-bold');

            panes.forEach(pane => {
                if (pane.id === targetId) {
                    pane.classList.remove('hidden');
                    pane.classList.add('block');
                } else {
                    pane.classList.add('hidden');
                    pane.classList.remove('block');
                }
            });
        });
    });
}