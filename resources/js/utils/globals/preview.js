// /resources/js/utils/globals/preview.js

let currentIndex = 0;

/**
 * A robust global previewer that works with dynamic content (SPA).
 * It listens for clicks on any element with data-img-src globally.
 */
export function registerImagePreview() {
    const previewModal = document.querySelector('[data-preview-modal]');
    const previewImage = document.querySelector('#preview-modal-image');
    
    if (!previewModal || !previewImage) return;

    // Helper: Gets all currently visible previewable items in the DOM
    const getItems = () => Array.from(document.querySelectorAll('[data-img-src]'));

    const showImage = (index) => {
        const items = getItems();
        if (items.length === 0) return;

        if (index < 0) index = items.length - 1;
        if (index >= items.length) index = 0;
        currentIndex = index;

        const src = items[currentIndex].getAttribute('data-img-src');
        previewImage.src = src;
        previewModal.classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    // --- 1. THE GLOBAL CLICK LISTENER (Delegated) ---
    if (!window._previewGlobalClickAttached) {
        document.addEventListener('click', (e) => {
            // Find if we clicked a previewable item or a child of one
            const target = e.target.closest('[data-img-src]');
            if (!target) return;

            // Guard: Don't trigger if it's inside the modal itself (prev/next)
            if (e.target.closest('[data-preview-modal]') && !e.target.hasAttribute('data-close-preview')) {
                return; 
            }

            e.preventDefault();
            const items = getItems();
            const idx = items.indexOf(target);
            showImage(idx !== -1 ? idx : 0);
        });
        window._previewGlobalClickAttached = true;
    }

    // --- 2. THE NAV/CLOSE CONTROLS (Static) ---
    if (!window._previewControlsAttached) {
        const closeBtn = document.querySelector('[data-close-preview]');
        const prevBtn  = document.querySelector('#preview-prev-btn');
        const nextBtn  = document.querySelector('#preview-next-btn');

        const closePreview = () => {
            previewModal.classList.add('hidden');
            previewImage.src = '';
            document.body.style.overflow = '';
        };

        if (closeBtn) closeBtn.addEventListener('click', closePreview);
        if (prevBtn)  prevBtn.addEventListener('click', () => showImage(currentIndex - 1));
        if (nextBtn)  nextBtn.addEventListener('click', () => showImage(currentIndex + 1));

        previewModal.addEventListener('click', (e) => {
            if (e.target.hasAttribute('data-preview-modal')) closePreview();
        });

        document.addEventListener('keydown', (e) => {
            if (previewModal.classList.contains('hidden')) return;
            if (e.key === 'Escape') {
                e.stopImmediatePropagation(); // Prevents other listeners from firing
                closePreview();
            }
            if (e.key === 'ArrowLeft') showImage(currentIndex - 1);
            if (e.key === 'ArrowRight') showImage(currentIndex + 1);
        });

        window._previewControlsAttached = true;
    }
}