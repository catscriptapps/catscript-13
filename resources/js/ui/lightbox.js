// /resources/js/ui/lightbox.js

/**
 * CatScript Lightbox - Image Preview 📸
 */
let lightboxEl = null;

function createLightbox() {
    const html = `
        <div id="catscript-lightbox" class="fixed inset-0 z-[100] hidden flex items-center justify-center bg-slate-950/90 backdrop-blur-md cursor-zoom-out animate-in fade-in duration-300">
            <button class="absolute top-6 right-6 text-white/50 hover:text-white transition-colors" aria-label="Close">
                <svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <img id="lightbox-img" src="" class="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl object-contain scale-95 transition-transform duration-300 select-none" alt="Preview">
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', html);
    lightboxEl = document.getElementById('catscript-lightbox');

    // Close on click anywhere or ESC key
    lightboxEl.addEventListener('click', closeLightbox);
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeLightbox(); });
}

export function openLightbox(src) {
    if (!lightboxEl) createLightbox();

    const img = lightboxEl.querySelector('#lightbox-img');
    img.src = src;

    lightboxEl.classList.remove('hidden');
    lightboxEl.classList.add('flex');

    // Smooth zoom-in pop
    setTimeout(() => {
        img.classList.replace('scale-95', 'scale-100');
    }, 10);
}

export function closeLightbox() {
    if (!lightboxEl || lightboxEl.classList.contains('hidden')) return;

    const img = lightboxEl.querySelector('#lightbox-img');
    img.classList.replace('scale-100', 'scale-95');
    lightboxEl.classList.add('opacity-0');

    setTimeout(() => {
        lightboxEl.classList.add('hidden');
        lightboxEl.classList.remove('flex', 'opacity-0');
    }, 300);
}