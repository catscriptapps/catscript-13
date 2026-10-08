// /resources/js/pages/about-page.js

import { AnimationEngine } from '../utils/animations';
import { createUploadHandler } from '../modals/upload-modal.js';
import { confirmDialog } from '../ui/confirm.js';
import { showToast } from '../ui/toast.js';

/**
 * Initialize the About page. Admins get Change photo / Reset on the hero
 * (server/api/about-hero.php; the buttons only render for admins, and the
 * endpoint re-checks). (The old parallax scroll effect was dropped: it added
 * a new window scroll listener on every SPA visit.)
 */
export function init() {
    AnimationEngine.refresh();

    const hero = document.getElementById('about-hero');
    if (!hero || hero.dataset.ready) return;
    hero.dataset.ready = 'true';

    const endpoint = `${window.APP_CONFIG?.baseUrl || '/'}api/about-hero`;

    const showPhoto = (url, isCustom) => {
        const wrap = document.getElementById('about-hero-photo');
        const img = document.getElementById('about-hero-img');
        if (url && img) img.src = url;
        wrap?.classList.toggle('hidden', !url);
        document.getElementById('about-hero-reset')?.classList.toggle('hidden', !isCustom);
    };

    hero.addEventListener('click', async (e) => {
        if (e.target.closest('#about-hero-change')) {
            createUploadHandler(endpoint, 'about-hero', (files) => {
                const url = files?.[0]?.url;
                if (url) {
                    showPhoto(url, true);
                    showToast('About photo updated.', 'success');
                }
            }, 1, true, { single: true, maxFiles: 1 });
            return;
        }

        if (e.target.closest('#about-hero-reset')) {
            const ok = await confirmDialog('Go back to the default About photo?', 'Reset photo', 'Cancel', 'bg-primary-600 hover:bg-primary-700');
            if (!ok) return;
            try {
                const res = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ _method: 'DELETE' }) });
                const json = await res.json();
                if (!json.success) throw new Error(json.messages?.[0]);
                showPhoto(json.url, false);
                showToast('About photo reset.', 'success');
            } catch (err) {
                showToast(err.message || 'Could not reset the photo.', 'error');
            }
        }
    });
}
