// /resources/js/utils/screensaver.js
//
// The TV-safe screensaver, used by the pages that are left open on a big
// screen for hours: Tasks, Cash Flow, Timetable, Chores, Medicals and the
// home page (each page creates its own, with its own "what's on" card — no
// other page has one; the home page's shows the photos clearly, with the
// logo). Built to protect the screen from burn-in:
//
//   - Nothing stays put. The clock + card glides continuously across the
//     whole screen on a slow path (two CSS animations with unrelated periods
//     — saver-drift-x / saver-drift-y in app.css). They animate `transform`
//     only, so the GPU moves the card smoothly with no layout work per
//     frame; the card has a fixed size, so its path never jumps when its
//     content changes. Photos cross-fade every 30 s with a slow zoom (also
//     GPU-composited); without photos, soft colour blobs wander instead.
//   - It gets darker the longer it runs: dimmed photos for the first hour,
//     darker for the next two, then "night" — photos off, a near-black
//     screen with only the dim drifting clock (kindest to OLED panels).
//   - The cursor is hidden, toasts are held back while it shows, and only
//     real input wakes it (tiny mouse jitter from a TV remote or a bumped
//     mouse is ignored — movement only counts inside a short window).
//
//   const saver = createScreensaver({ id, slides, paint, hint, onWake });
//   saver.show(); saver.hide(); saver.remove(); saver.isOpen(); saver.repaint();
//
// The page decides WHEN to show it (its own idle logic, after SAVER_IDLE_MS);
// this module only draws it and wakes on input. paint() returns the HTML for
// the card's lines under the clock (already escaped by the caller); it's
// re-run every 15 seconds.

/** How long a page sits untouched before its screensaver starts — the same on every page that has one. */
export const SAVER_IDLE_MS = 5 * 60 * 1000;

const SLIDE_MS = 30 * 1000;
const PAINT_MS = 15 * 1000;
const DIM_AFTER_MS = 60 * 60 * 1000;        // darker after an hour
const NIGHT_AFTER_MS = 3 * 60 * 60 * 1000;  // photos off after three hours
const JITTER_PX = 24;                       // movement needed (within JITTER_WINDOW_MS) to wake
const JITTER_WINDOW_MS = 1200;

/**
 * Options beyond the basics, for a saver where the photos are the point
 * (the home page):
 *   captions      each slide's caption, shown on the card as it plays
 *   brand         HTML shown at the top of the card (e.g. the logo)
 *   photoOpacity  how bright the photos are (default 0.55 — a backdrop)
 *   veils         veil over the photos for the bright / dim / night stages
 *   nightPhotos   keep the photos on in the "night" stage (default: off)
 */
export function createScreensaver({
  id = 'screensaver', slides = [], paint = () => '', hint = 'Move the mouse or tap anywhere to return', onWake = () => {},
  captions = [], brand = '', photoOpacity = 0.55, veils = ['bg-black/60', 'bg-black/80', 'bg-black'], nightPhotos = false,
} = {}) {
  const s = { el: null, open: false, since: 0, timers: [], slide: -1, moved: 0, movedAt: 0, stage: '' };
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' }[c]));
  // Each moving layer gets its own GPU layer, so motion is smooth on a TV
  const gpu = 'will-change: transform, opacity; backface-visibility: hidden;';

  function build() {
    if (s.el && document.body.contains(s.el)) return s.el;
    const el = document.createElement('div');
    el.id = id;
    // Above everything on the page (chat bubble z-[9998], scroll-to-top,
    // spinner z-[9999]); toasts are held back while open (ui/toast.js)
    el.className = 'fixed inset-0 z-[10000] hidden overflow-hidden bg-black cursor-none select-none';
    el.style.opacity = '0';
    el.style.transition = 'opacity 2s ease';
    el.setAttribute('aria-hidden', 'true');
    el.innerHTML = `
      <div data-saver-photos class="absolute inset-0" style="transition: opacity 6s ease">
        ${slides.length ? slides.map((src) => `
          <div data-saver-slide class="absolute inset-0 bg-cover bg-center opacity-0"
            style="background-image: url('${esc(src)}'); ${gpu} transition: opacity 4s ease-in-out, transform ${SLIDE_MS * 1.6}ms linear; transform: scale(1);"></div>`).join('') : `
          <div class="absolute -top-1/4 -left-1/4 h-[70vmax] w-[70vmax] rounded-full bg-secondary-700/40 blur-3xl" data-saver-blob style="${gpu} transition: transform 40s ease-in-out"></div>
          <div class="absolute -bottom-1/4 -right-1/4 h-[60vmax] w-[60vmax] rounded-full bg-primary-700/25 blur-3xl" data-saver-blob style="${gpu} transition: transform 40s ease-in-out"></div>`}
      </div>
      <div data-saver-veil class="absolute inset-0 bg-black/60" style="transition: background-color 6s ease"></div>
      <!-- Drift: the X mover glides left↔right across the area, the Y mover
           inside it glides up↔down; --saver-dx / --saver-dy (set by measure())
           are how far each can travel. -->
      <div data-saver-area class="absolute inset-[4vh_4vw] pointer-events-none">
        <div class="saver-drift-x absolute left-0 top-0" style="${gpu}">
          <div class="saver-drift-y relative" style="${gpu}">
            ${brand ? '<div aria-hidden="true" class="absolute -inset-x-20 -inset-y-14 rounded-[4rem] bg-black/45 blur-3xl"></div>' /* a soft dark halo behind the card, so its text reads over bright photos */ : ''}
            <div data-saver-card class="relative w-[min(36rem,86vw)] h-[min(30rem,84vh)] overflow-hidden text-white ${brand ? 'drop-shadow-[0_2px_12px_rgba(0,0,0,0.65)]' : ''}" style="transition: opacity 6s ease">
              ${brand ? `<div class="mb-6">${brand}</div>` : ''}
              <p data-saver-time class="text-7xl sm:text-8xl font-light tracking-tight leading-none text-white/75"></p>
              <p data-saver-date class="mt-3 text-lg sm:text-xl text-white/50"></p>
              ${captions.some(Boolean) ? '<p data-saver-caption class="mt-4 text-base sm:text-lg italic text-white/60 truncate" style="transition: opacity 2s ease"></p>' : ''}
              <div data-saver-now class="mt-8 space-y-3"></div>
            </div>
          </div>
        </div>
      </div>
      <p data-saver-hint class="absolute bottom-6 inset-x-0 text-center text-xs text-white/35" style="transition: opacity 3s ease">${esc(hint)}</p>`;
    document.body.appendChild(el);
    s.el = el;
    return el;
  }

  /** How far the card can travel inside the drift area (px), for the CSS animations. */
  function measure() {
    if (!s.el) return;
    const area = s.el.querySelector('[data-saver-area]');
    const card = s.el.querySelector('[data-saver-card]');
    area.style.setProperty('--saver-dx', `${Math.max(0, area.clientWidth - card.offsetWidth)}px`);
    area.style.setProperty('--saver-dy', `${Math.max(0, area.clientHeight - card.offsetHeight)}px`);
  }

  /** bright → dim → night, by how long it's been showing. */
  function applyStage() {
    if (!s.el) return;
    const age = Date.now() - s.since;
    const stage = age >= NIGHT_AFTER_MS ? 'night' : age >= DIM_AFTER_MS ? 'dim' : 'bright';
    if (stage === s.stage) return;
    s.stage = stage;
    s.el.querySelector('[data-saver-veil]').className = `absolute inset-0 ${veils[stage === 'bright' ? 0 : stage === 'dim' ? 1 : 2]}`;
    s.el.querySelector('[data-saver-photos]').style.opacity = stage === 'night' && !nightPhotos ? '0' : '1';
    s.el.querySelector('[data-saver-card]').style.opacity = stage === 'night' ? '0.55' : stage === 'dim' ? '0.8' : '1';
  }

  function paintCard() {
    if (!s.el) return;
    const d = new Date();
    s.el.querySelector('[data-saver-time]').textContent = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    s.el.querySelector('[data-saver-date]').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    s.el.querySelector('[data-saver-now]').innerHTML = paint() || '';
    applyStage();
  }

  function nextSlide() {
    if (s.stage === 'night' && !nightPhotos) return; // photos are off — nothing to change
    const list = [...(s.el?.querySelectorAll('[data-saver-slide]') || [])];
    if (!list.length) {
      s.el?.querySelectorAll('[data-saver-blob]').forEach((b) => {
        b.style.transform = `translate3d(${Math.round(Math.random() * 30 - 15)}vw, ${Math.round(Math.random() * 30 - 15)}vh, 0)`;
      });
      return;
    }
    const prev = s.slide >= 0 ? list[s.slide % list.length] : null;
    s.slide = (s.slide + 1) % list.length;
    const cur = list[s.slide];
    cur.style.transition = 'none';
    cur.style.transform = 'scale(1)';
    void cur.offsetWidth; // restart the slow zoom from scale(1)
    cur.style.transition = `opacity 4s ease-in-out, transform ${SLIDE_MS * 1.6}ms linear`;
    cur.style.opacity = String(photoOpacity);
    // This photo's caption (fades out, swaps, fades back in)
    const cap = s.el.querySelector('[data-saver-caption]');
    if (cap) {
      cap.style.opacity = '0';
      setTimeout(() => { if (s.open) { cap.textContent = captions[s.slide] || ''; cap.style.opacity = '1'; } }, 1500);
    }
    // Always some movement (it's what protects the screen) — just gentler
    // for people who've asked for reduced motion
    cur.style.transform = reducedMotion() ? 'scale(1.04)' : 'scale(1.12)';
    if (prev && prev !== cur) prev.style.opacity = '0';
  }

  // Wake on real input only
  const wake = () => { if (s.open) { hide(); onWake(); } };
  const onMove = (e) => {
    const now = Date.now();
    if (now - s.movedAt > JITTER_WINDOW_MS) s.moved = 0; // old jitter doesn't add up
    s.movedAt = now;
    s.moved += Math.abs(e.movementX || 0) + Math.abs(e.movementY || 0);
    if (s.moved > JITTER_PX) wake();
  };
  const WAKE_EVENTS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

  function show() {
    const el = build();
    if (s.open) return;
    s.open = true;
    s.since = Date.now();
    s.moved = 0;
    s.slide = -1;
    s.stage = '';
    document.body.dataset.screensaver = 'on';
    el.querySelectorAll('[data-saver-slide]').forEach((x) => { x.style.opacity = '0'; x.style.transform = 'scale(1)'; });
    el.classList.remove('hidden');
    measure();
    requestAnimationFrame(() => { el.style.opacity = '1'; });
    paintCard();
    nextSlide();
    const h = el.querySelector('[data-saver-hint]');
    h.style.opacity = '1';
    setTimeout(() => { h.style.opacity = '0'; }, 15000);

    WAKE_EVENTS.forEach((ev) => window.addEventListener(ev, wake, { passive: true, capture: true }));
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('resize', measure, { passive: true });
    s.timers.forEach(clearInterval);
    s.timers = [setInterval(paintCard, PAINT_MS), setInterval(nextSlide, SLIDE_MS)];
  }

  function hide() {
    if (!s.open || !s.el) return;
    s.open = false;
    delete document.body.dataset.screensaver;
    s.timers.forEach(clearInterval);
    s.timers = [];
    WAKE_EVENTS.forEach((ev) => window.removeEventListener(ev, wake, { capture: true }));
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('resize', measure);
    const el = s.el;
    el.style.opacity = '0';
    setTimeout(() => { if (!s.open) el.classList.add('hidden'); }, 700);
  }

  function remove() {
    hide();
    s.el?.remove();
    s.el = null;
  }

  return { show, hide, remove, isOpen: () => s.open, repaint: paintCard };
}
