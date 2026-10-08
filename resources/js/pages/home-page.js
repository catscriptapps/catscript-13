// /resources/js/pages/home-page.js

import { initHomeEvents } from "../utils/home/home-events";
import { createScreensaver, SAVER_IDLE_MS } from "../utils/screensaver.js";

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));

/**
 * Initialize the Home page: scroll animations, the hero slideshow, counters,
 * and the "Explore the apps" smooth scroll.
 */
export function init() {
    initHomeEvents();

    const page = document.getElementById('home-page');
    if (!page || page.dataset.ready) return;
    page.dataset.ready = 'true';

    initSlideshow(page);
    initCounters(page);
    initScreensaver(page);

    page.addEventListener('click', (e) => {
        const link = e.target.closest('[data-scroll-to]');
        if (!link) return;
        const target = document.getElementById(link.dataset.scrollTo);
        if (!target) return;
        e.preventDefault();
        target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    });
}

/**
 * Crossfade the hero photos (styles in app.css: .hero-slide / .is-active).
 * The timer stops itself once the page has been navigated away from.
 */
function initSlideshow(page) {
    const slides = [...page.querySelectorAll('[data-hero-slides] .hero-slide')];
    const dots = [...page.querySelectorAll('[data-hero-dots] span')];
    if (slides.length < 2) return;

    let index = 0;
    const show = (next) => {
        slides[index].classList.remove('is-active');
        dots[index]?.classList.replace('w-6', 'w-1.5');
        dots[index]?.classList.replace('bg-white', 'bg-white/40');

        index = next;
        const slide = slides[index];
        // Restart the slow zoom on the incoming slide
        slide.style.animation = 'none';
        void slide.offsetWidth;
        slide.style.animation = '';
        slide.classList.add('is-active');
        dots[index]?.classList.replace('w-1.5', 'w-6');
        dots[index]?.classList.replace('bg-white/40', 'bg-white');
    };

    const timer = setInterval(() => {
        if (!page.isConnected) return clearInterval(timer);
        if (document.hidden) return; // don't churn in a background tab
        show((index + 1) % slides.length);
    }, 6500);
}

/** Count the hero numbers up from zero the first time they're shown. */
function initCounters(page) {
    const counters = [...page.querySelectorAll('[data-count-to]')];
    if (!counters.length || reducedMotion()) return;

    counters.forEach((el) => {
        const to = Number(el.dataset.countTo) || 0;
        const start = performance.now();
        const dur = 900 + to * 40;
        el.textContent = '0';
        const step = (now) => {
            const p = Math.min(1, (now - start) / dur);
            el.textContent = String(Math.round(to * (1 - (1 - p) ** 3)));
            if (p < 1 && el.isConnected) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}

// ------------------------------------------------------------
// TV screensaver (utils/screensaver.js)
// ------------------------------------------------------------
//
// The home page is often left up on a big screen. After SAVER_IDLE_MS
// untouched, a screensaver made for it takes over: the slideshow photos shown
// clearly (bright, cross-fading with a slow zoom, gently dimmer over long
// hours but never switched off), the full logo breathing softly at the top of
// a card that glides slowly around the screen, a big clock and date, the
// photo's caption, and the live apps featured one at a time.

let saver = null;
let saverTimer = null;
let lastInteraction = Date.now();
let saverBound = false;

function initScreensaver(page) {
    let cfg = {};
    try { cfg = JSON.parse(page.dataset.saver || '{}'); } catch { return; }

    if (!saverBound) {
        saverBound = true;
        const touched = () => { lastInteraction = Date.now(); };
        ['pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll'].forEach((ev) => window.addEventListener(ev, touched, { passive: true }));
    }
    lastInteraction = Date.now();

    const apps = cfg.apps || [];
    let featured = Math.floor(Math.random() * Math.max(1, apps.length));
    const paint = () => {
        const app = apps.length ? apps[featured++ % apps.length] : null;
        return `
            <p class="text-lg sm:text-xl text-white/70">${esc(cfg.live || apps.length)} apps for everyday family life</p>
            ${app ? `<div class="mt-3 border-l-2 border-primary-400/70 pl-4">
                <p class="text-2xl sm:text-3xl font-semibold text-white/90">${esc(app.name)}</p>
                <p class="mt-1 text-base sm:text-lg text-white/70 line-clamp-2">${esc(app.text)}</p>
            </div>` : ''}`;
    };

    saver?.remove();
    saver = createScreensaver({
        id: 'home-saver',
        slides: cfg.slides || [],
        captions: cfg.captions || [],
        // The photos are the point here: bright and clear, never switched off
        photoOpacity: 0.92,
        veils: ['bg-black/25', 'bg-black/40', 'bg-black/55'],
        nightPhotos: true,
        brand: cfg.logo ? `<img src="${esc(cfg.logo)}" alt="${esc(window.APP_CONFIG?.appName || '')}" class="saver-breathe h-14 sm:h-20 w-auto">` : '',
        paint,
        hint: 'Move the mouse or tap anywhere to return',
        onWake: () => { lastInteraction = Date.now(); },
    });

    clearInterval(saverTimer);
    saverTimer = setInterval(() => {
        if (!page.isConnected) { clearInterval(saverTimer); saver?.remove(); saver = null; return; }
        if (document.visibilityState !== 'visible' || saver.isOpen()) return;
        const busy = document.body.style.overflow === 'hidden'
            || !!document.getElementById('confirm-proceed')
            || !!document.activeElement?.matches?.('input, textarea, select');
        if (!busy && Date.now() - lastInteraction >= SAVER_IDLE_MS) saver.show();
    }, 30 * 1000);
}
