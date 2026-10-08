// /resources/js/forms/form-kit.js
//
// Shared building blocks for the colourful forms (Users, and any you
// build): colour-coded section cards with an emoji badge, the gradient
// identity card at the top (a live preview of what's being made), and the
// matching inputs and buttons. Class strings are written out in full so
// Tailwind keeps them.

/** Section colour themes. */
export const TONE = {
    orange: { border: 'border-orange-100 dark:border-orange-900/40', bg: 'bg-gradient-to-br from-orange-50/80 to-white dark:from-orange-950/20 dark:to-gray-900', glow: 'bg-orange-300/30', badge: 'from-orange-400 to-rose-500' },
    violet: { border: 'border-violet-100 dark:border-violet-900/40', bg: 'bg-gradient-to-br from-violet-50/80 to-white dark:from-violet-950/20 dark:to-gray-900', glow: 'bg-violet-300/30', badge: 'from-violet-400 to-fuchsia-500' },
    sky:    { border: 'border-sky-100 dark:border-sky-900/40', bg: 'bg-gradient-to-br from-sky-50/80 to-white dark:from-sky-950/20 dark:to-gray-900', glow: 'bg-sky-300/30', badge: 'from-sky-400 to-indigo-500' },
    green:  { border: 'border-emerald-100 dark:border-emerald-900/40', bg: 'bg-gradient-to-br from-emerald-50/80 to-white dark:from-emerald-950/20 dark:to-gray-900', glow: 'bg-emerald-300/30', badge: 'from-emerald-400 to-teal-500' },
    amber:  { border: 'border-amber-100 dark:border-amber-900/40', bg: 'bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/20 dark:to-gray-900', glow: 'bg-amber-300/30', badge: 'from-amber-400 to-orange-500' },
    pink:   { border: 'border-pink-100 dark:border-pink-900/40', bg: 'bg-gradient-to-br from-pink-50/80 to-white dark:from-pink-950/20 dark:to-gray-900', glow: 'bg-pink-300/30', badge: 'from-pink-400 to-rose-500' },
};

export const kitInput = 'block w-full rounded-xl border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20 sm:text-sm transition-all duration-200 py-2.5 px-4 outline-none';
export const kitLabel = 'block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 ml-1';
export const kitSubmit = 'inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 via-orange-500 to-rose-500 px-8 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-primary-400/40 transition-all active:scale-95 disabled:opacity-60 disabled:hover:translate-y-0';
export const kitGhost = 'px-4 py-2.5 rounded-xl text-sm font-semibold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors';

/** A colour-coded section card with an emoji badge, title, hint and optional header extras. */
export function formSection(tone, icon, title, hint, body, extra = '') {
    return `
        <section class="relative overflow-hidden rounded-2xl border ${tone.border} ${tone.bg} p-4 sm:p-5">
            <div aria-hidden="true" class="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full ${tone.glow} blur-2xl"></div>
            <div class="relative flex items-start gap-3 mb-4">
                <span class="h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br ${tone.badge} text-white flex items-center justify-center text-base shadow-md">${icon}</span>
                <div class="min-w-0 flex-1">
                    <h3 class="text-sm font-bold text-gray-900 dark:text-white">${title}</h3>
                    ${hint ? `<p class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">${hint}</p>` : ''}
                </div>
                ${extra}
            </div>
            <div class="relative">${body}</div>
        </section>`;
}

/**
 * The gradient identity card: avatar (initials or an image), a status tag,
 * a title line and a sub line, plus anything on the right (`aside`).
 * Pages update the [data-preview-*] parts as the form changes.
 */
export function identityCard({ avatar, tag, tagDot = 'bg-emerald-300 animate-pulse', title, sub, aside = '' }) {
    return `
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-800 via-secondary-900 to-secondary-950 p-5 sm:p-6 text-white shadow-xl shadow-secondary-900/20">
            <div aria-hidden="true" class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-primary-500/40 blur-3xl"></div>
            <div aria-hidden="true" class="pointer-events-none absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-fuchsia-500/25 blur-3xl"></div>
            <div aria-hidden="true" class="pointer-events-none absolute top-6 right-1/3 h-24 w-24 rounded-full bg-sky-400/20 blur-2xl"></div>
            <div class="relative flex items-center gap-4">
                <div data-preview-avatar class="h-16 w-16 flex-shrink-0 overflow-hidden rounded-2xl bg-gradient-to-br from-primary-400 via-orange-500 to-rose-500 flex items-center justify-center text-2xl font-black shadow-lg shadow-primary-500/30 ring-4 ring-white/15 transition-transform duration-300">${avatar}</div>
                <div class="min-w-0 flex-1">
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                        <span class="h-1.5 w-1.5 rounded-full ${tagDot}"></span>${tag}
                    </span>
                    <p data-preview-title class="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight truncate">${title}</p>
                    <p data-preview-sub class="text-sm text-secondary-100/80 truncate">${sub}</p>
                </div>
                ${aside}
            </div>
        </div>`;
}

/** A quick "pop" on the identity avatar when the name changes. */
export function bumpAvatar(root) {
    const a = root.querySelector('[data-preview-avatar]');
    if (!a) return;
    a.classList.add('scale-110');
    setTimeout(() => a.classList.remove('scale-110'), 180);
}
