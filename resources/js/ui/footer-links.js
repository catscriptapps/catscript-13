// /resources/js/ui/footer-links.js

import { loadPartial, updateActiveLink } from '../utils/spa-router.js';

/**
 * Updates the specific "Pill" style for footer links
 */
function updateFooterPills() {
    const currentPath = window.location.pathname.replace(/\/$/, "") || "/";
    const links = document.querySelectorAll('.footer-nav-link');
    
    links.forEach(link => {
        const linkPath = new URL(link.href, window.location.origin).pathname.replace(/\/$/, "") || "/";
        
        if (linkPath === currentPath) {
            link.classList.add('bg-primary-500', 'text-white', 'shadow-lg', 'shadow-primary-500/30');
            link.classList.remove('text-gray-500', 'dark:text-gray-400');
        } else {
            link.classList.remove('bg-primary-500', 'text-white', 'shadow-lg', 'shadow-primary-500/30');
            link.classList.add('text-gray-500', 'dark:text-gray-400');
        }
    });
}

export function initFooterLinks() {
    // Sync footer pills on load
    updateFooterPills();

    // Listen for footer clicks
    document.querySelectorAll('.footer-nav-link').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const url = btn.getAttribute('href');

            if (url) {
                if (url === window.location.pathname) return;
                
                loadPartial(url);
                
                // After the router handles the content, we sync our footer pills
                setTimeout(() => {
                    updateFooterPills();
                }, 50);
            }
        });
    });

    // Also update footer pills whenever a partial load happens (e.g. via sidebar)
    document.body.addEventListener('partial-load', () => {
        updateFooterPills();
    });
}