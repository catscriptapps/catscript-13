// /resources/js/forms/user-form.js

import { escapeHtml } from '../utils/escape-html.js';
import { formSection, TONE } from './form-kit.js';

/**
 * Shared Add / Edit form for Users — colourful and lively:
 *  - a gradient identity card whose avatar, name and email update as you type
 *  - colour-coded sections (details, password, location, roles, app access)
 *  - role and app tiles that light up in their own colour when ticked
 *  - a password strength meter + "passwords match" check, a live app count
 *    with All / None, and an Active / Archived status switch
 *
 * Field names / ids and the role <label> wrappers are what
 * utils/users/form-submit.js and components/regions-component.js rely on —
 * keep them as they are. enhanceUserForm() wires the live bits after the
 * modal opens (modals/users-modal.js).
 */

/**
 * Per-app tile look (full class strings so Tailwind keeps them). Add one when
 * you register a new permissioned app (AuthService::PERMISSIONED_APPS), e.g.
 *   'Reports': { icon: '📊', tile: 'peer-checked:border-sky-400 peer-checked:bg-sky-50 dark:peer-checked:bg-sky-950/40', badge: 'from-sky-400 to-blue-500' },
 * Apps without one use APP_DEFAULT.
 */
const APP_LOOK = {};
const APP_DEFAULT = { icon: '⭐', tile: 'peer-checked:border-primary-400 peer-checked:bg-primary-50 dark:peer-checked:bg-primary-950/40', badge: 'from-primary-400 to-amber-500' };

/** Role tiles: Admin gets a crown; the rest cycle through these. */
const ROLE_LOOK = [
    { icon: '🌟', tile: 'peer-checked:border-sky-400 peer-checked:bg-sky-50 peer-checked:text-sky-800 dark:peer-checked:bg-sky-950/40 dark:peer-checked:text-sky-200' },
    { icon: '🌿', tile: 'peer-checked:border-emerald-400 peer-checked:bg-emerald-50 peer-checked:text-emerald-800 dark:peer-checked:bg-emerald-950/40 dark:peer-checked:text-emerald-200' },
    { icon: '🎨', tile: 'peer-checked:border-violet-400 peer-checked:bg-violet-50 peer-checked:text-violet-800 dark:peer-checked:bg-violet-950/40 dark:peer-checked:text-violet-200' },
    { icon: '🔥', tile: 'peer-checked:border-amber-400 peer-checked:bg-amber-50 peer-checked:text-amber-800 dark:peer-checked:bg-amber-950/40 dark:peer-checked:text-amber-200' },
];
const ADMIN_LOOK = { icon: '👑', tile: 'peer-checked:border-rose-400 peer-checked:bg-rose-50 peer-checked:text-rose-800 dark:peer-checked:bg-rose-950/40 dark:peer-checked:text-rose-200' };

const initials = (first, last) => ((first || '').trim().charAt(0) + (last || '').trim().charAt(0)).toUpperCase() || '?';

export function userForm({
    mode = 'add',
    firstName = '',
    lastName = '',
    email = '',
    city = '',
    countryId = '',
    regionId = '',
    availableRoles = [],
    userTypes = [],
    isActive = true,
    buttonLabel = 'Save',
    formId = 'users-form',
    countries = [],
    regions = [],
    encodedId = null,
    isProtected = false,
    appOptions = [],      // admin only: permission-controlled apps (APP_CONFIG.grantableApps)
    permittedApps = []    // the user's current legacy permitted_apps
}) {
    const idPrefix = mode === 'edit' ? 'users-edit' : 'users';
    const dataEncodedIdAttr = encodedId ? `data-encoded-id="${escapeHtml(encodedId)}"` : '';
    const e = (v) => escapeHtml(String(v ?? ''));

    // Capabilities (AuthService::CAPABILITIES) are listed under the app they belong to
    const capabilityOf = window.APP_CONFIG?.appCapabilities || {};
    // Optional one-line hint per capability, e.g. { 'Report Editor': 'can edit any report' }
    const capabilityHint = {};

    const inputClasses = `
        block w-full rounded-xl
        border border-gray-300 dark:border-gray-700
        bg-white/90 dark:bg-gray-900
        text-gray-900 dark:text-white
        placeholder:text-gray-400
        focus:border-primary-400 focus:ring-4 focus:ring-primary-400/20
        sm:text-sm transition-all duration-200 py-2.5 px-4 outline-none
    `.replace(/\s+/g, ' ').trim();
    const labelClasses = 'block text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-1.5 ml-1';

    const section = formSection;

    const eyeIcon = `
        <button type="button" data-toggle-password aria-label="Show or hide the password"
            class="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-violet-500 mt-6">
            <svg class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
        </button>`;

    const topApps = appOptions.filter((app) => !capabilityOf[app]);

    return `
    <form
        id="${formId}"
        class="w-full max-w-5xl mx-auto space-y-5 p-1 font-sans"
        novalidate
        ${dataEncodedIdAttr}
        data-country-id="${e(countryId)}"
        data-user-form>

        <!-- Identity card (live preview) -->
        <div class="relative overflow-hidden rounded-3xl bg-gradient-to-br from-secondary-800 via-secondary-900 to-secondary-950 p-5 sm:p-6 text-white shadow-xl shadow-secondary-900/20">
            <div aria-hidden="true" class="pointer-events-none absolute -top-16 -right-10 h-48 w-48 rounded-full bg-primary-500/40 blur-3xl"></div>
            <div aria-hidden="true" class="pointer-events-none absolute -bottom-20 left-1/4 h-40 w-40 rounded-full bg-fuchsia-500/25 blur-3xl"></div>
            <div aria-hidden="true" class="pointer-events-none absolute top-6 right-1/3 h-24 w-24 rounded-full bg-sky-400/20 blur-2xl"></div>
            <div class="relative flex items-center gap-4">
                <div data-preview-avatar class="h-16 w-16 flex-shrink-0 rounded-2xl bg-gradient-to-br from-primary-400 via-orange-500 to-rose-500 flex items-center justify-center text-2xl font-black shadow-lg shadow-primary-500/30 ring-4 ring-white/15 transition-transform duration-300">${e(initials(firstName, lastName))}</div>
                <div class="min-w-0 flex-1">
                    <span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 ring-1 ring-white/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest">
                        <span class="h-1.5 w-1.5 rounded-full ${mode === 'add' ? 'bg-emerald-300 animate-pulse' : 'bg-primary-300'}"></span>${mode === 'add' ? 'New member' : 'Editing profile'}
                    </span>
                    <p data-preview-name class="mt-1.5 text-xl sm:text-2xl font-bold tracking-tight truncate">${e(`${firstName} ${lastName}`.trim() || 'Their name here')}</p>
                    <p data-preview-email class="text-sm text-secondary-100/80 truncate">${e(email || 'email@example.com')}</p>
                </div>
                <div class="hidden sm:flex flex-col items-end gap-1.5 text-right">
                    <span data-preview-roles class="text-xs font-semibold text-white/80"></span>
                    ${topApps.length ? `<span data-preview-apps class="text-xs text-white/60"></span>` : ''}
                </div>
            </div>
        </div>

        ${section(TONE.orange, '👋', 'Who they are', 'Their name and the email they sign in with.', `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label for="${idPrefix}-first-name" class="${labelClasses}">First Name</label>
                    <input type="text" required id="${idPrefix}-first-name" name="firstName" autocomplete="off"
                        placeholder="John" value="${e(firstName)}" class="${inputClasses}" />
                </div>
                <div>
                    <label for="${idPrefix}-last-name" class="${labelClasses}">Last Name</label>
                    <input type="text" required id="${idPrefix}-last-name" name="lastName" autocomplete="off"
                        placeholder="Doe" value="${e(lastName)}" class="${inputClasses}" />
                </div>
                <div>
                    <label for="${idPrefix}-email" class="${labelClasses}">Email Address</label>
                    <input type="email" required id="${idPrefix}-email" name="email" autocomplete="off"
                        placeholder="john@example.com" value="${e(email)}" class="${inputClasses}" />
                </div>
            </div>`)}

        ${mode === 'add' ? section(TONE.violet, '🔐', 'Password', 'At least 8 characters — a mix of letters, numbers and symbols is strongest.', `
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="relative">
                    <label for="${idPrefix}-password" class="${labelClasses}">Password</label>
                    <input type="password" required id="${idPrefix}-password" name="password" autocomplete="new-password"
                        placeholder="••••••••" class="${inputClasses}" />
                    ${eyeIcon}
                </div>
                <div class="relative">
                    <label for="${idPrefix}-confirm-password" class="${labelClasses}">Confirm Password</label>
                    <input type="password" required id="${idPrefix}-confirm-password" name="confirmPassword" autocomplete="new-password"
                        placeholder="••••••••" class="${inputClasses}" />
                    ${eyeIcon}
                </div>
            </div>
            <div class="mt-3 flex flex-wrap items-center gap-3">
                <div class="flex flex-1 min-w-[10rem] gap-1" aria-hidden="true">
                    ${[0, 1, 2, 3].map(() => '<span data-strength-bar class="h-1.5 flex-1 rounded-full bg-gray-200 dark:bg-gray-700 transition-colors duration-300"></span>').join('')}
                </div>
                <span data-strength-label class="text-xs font-semibold text-gray-400">Type a password</span>
                <span data-match-label class="text-xs font-semibold"></span>
            </div>`) : ''}

        ${section(TONE.sky, '📍', 'Where they are', '', `
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                    <label for="${idPrefix}-country" class="${labelClasses}">Country</label>
                    <select id="${idPrefix}-country" name="countryId" required class="${inputClasses}">
                        <option value="">Select Country</option>
                        ${countries.map((c) => `<option value="${e(c.id)}" ${c.id == countryId ? 'selected' : ''}>${e(c.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="${idPrefix}-region" class="${labelClasses}">Region / State</label>
                    <select id="${idPrefix}-region" name="regionId" required class="${inputClasses}">
                        <option value="">Select Region</option>
                        ${regions.map((r) => `<option value="${e(r.id)}" ${r.id == regionId ? 'selected' : ''}>${e(r.name)}</option>`).join('')}
                    </select>
                </div>
                <div>
                    <label for="${idPrefix}-city" class="${labelClasses}">City</label>
                    <input type="text" id="${idPrefix}-city" name="city" required
                        placeholder="Barrie" value="${e(city)}" class="${inputClasses}" />
                </div>
            </div>`)}

        ${section(TONE.green, '🎭', 'Account types', 'What kind of member they are.', `
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
                ${availableRoles.map((role, i) => {
                    const checked = mode === 'add' ? role.id === 2 : userTypes.includes(role.id);
                    // User #1 (Cat) must always stay Admin — the server
                    // re-enforces this regardless, but the checkbox is locked
                    // here too so the UI doesn't pretend it's optional.
                    const locked = isProtected && role.id === 1;
                    const look = role.id === 1 ? ADMIN_LOOK : ROLE_LOOK[i % ROLE_LOOK.length];
                    return `
                    <label class="relative block rounded-xl border border-gray-200 dark:border-gray-700 transition-colors ${locked ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer'}">
                        <input type="checkbox" name="userTypeIds[]" value="${e(role.id)}" data-role-name="${e(role.name)}" ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''} class="peer sr-only" />
                        ${locked ? '<input type="hidden" name="userTypeIds[]" value="1" />' : ''}
                        <span class="flex items-center gap-2.5 rounded-xl border-2 border-transparent px-3 py-2.5 text-sm font-semibold text-gray-600 dark:text-gray-300 bg-white/70 dark:bg-gray-900/60 transition-all ${look.tile} peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-400/30 ${locked ? '' : 'hover:-translate-y-0.5 hover:shadow-md'}">
                            <span class="text-lg leading-none">${look.icon}</span>
                            <span class="truncate">${e(role.name)}</span>
                            ${locked ? '<span class="ml-auto text-[10px] font-bold uppercase tracking-wide opacity-60">Locked</span>' : ''}
                        </span>
                        <span aria-hidden="true" class="absolute -top-1.5 -right-1.5 hidden peer-checked:flex h-5 w-5 rounded-full bg-emerald-500 text-white items-center justify-center shadow ring-2 ring-white dark:ring-gray-900">
                            <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                        </span>
                    </label>`;
                }).join('')}
            </div>`)}

        ${appOptions.length ? section(TONE.amber, '🧩', 'App access', 'They get exactly the apps ticked here, plus their Dashboard and Profile. Admins can always open everything.', `
            <input type="hidden" name="permittedAppsPresent" value="1" />
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                ${topApps.map((app) => {
                    const on = permittedApps.includes(app);
                    const extras = appOptions.filter((c) => capabilityOf[c] === app);
                    const look = APP_LOOK[app] || APP_DEFAULT;
                    return `
                    <div class="group/app">
                        <label class="relative block cursor-pointer">
                            <input type="checkbox" name="permittedApps[]" value="${e(app)}" data-app ${on ? 'checked' : ''} class="peer sr-only" />
                            <span class="flex items-center gap-3 rounded-xl border-2 border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/60 px-3 py-2.5 transition-all hover:-translate-y-0.5 hover:shadow-md ${look.tile} peer-focus-visible:ring-4 peer-focus-visible:ring-amber-400/30 [&_.app-badge]:grayscale [&_.app-badge]:opacity-60 peer-checked:[&_.app-badge]:grayscale-0 peer-checked:[&_.app-badge]:opacity-100">
                                <span class="app-badge h-9 w-9 flex-shrink-0 rounded-xl bg-gradient-to-br ${look.badge} flex items-center justify-center text-lg shadow-sm transition-all">${look.icon}</span>
                                <span class="min-w-0 flex-1 text-sm font-bold text-gray-800 dark:text-gray-100 truncate">${e(app)}</span>
                                <span class="h-5 w-5 flex-shrink-0 rounded-full border-2 border-gray-300 dark:border-gray-600 flex items-center justify-center text-transparent transition-colors">
                                    <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                                </span>
                            </span>
                            <span aria-hidden="true" class="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden peer-checked:flex h-5 w-5 rounded-full bg-emerald-500 text-white items-center justify-center shadow">
                                <svg class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" /></svg>
                            </span>
                        </label>
                        ${extras.map((c) => `
                        <label class="mt-1.5 ml-4 flex items-start gap-2 rounded-lg px-3 py-2 cursor-pointer bg-white/60 dark:bg-gray-900/40 border border-dashed border-gray-200 dark:border-gray-700 hover:border-amber-300 transition-colors">
                            <input type="checkbox" name="permittedApps[]" value="${e(c)}" ${permittedApps.includes(c) ? 'checked' : ''}
                                class="mt-0.5 rounded border-gray-300 dark:border-gray-600 text-amber-500 focus:ring-amber-400" />
                            <span class="text-xs text-gray-600 dark:text-gray-400"><span class="font-bold text-gray-800 dark:text-gray-200">✏️ ${e(c)}</span> — ${capabilityHint[c] || 'can make changes'}</span>
                        </label>`).join('')}
                    </div>`;
                }).join('')}
            </div>`, `
            <div class="flex items-center gap-1.5 flex-shrink-0">
                <span data-app-count class="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-xs font-bold text-amber-800 dark:text-amber-200"></span>
                <button type="button" data-apps="all" class="rounded-lg px-2 py-1 text-xs font-semibold text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/40">All</button>
                <button type="button" data-apps="none" class="rounded-lg px-2 py-1 text-xs font-semibold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800">None</button>
            </div>`) : ''}

        ${mode === 'edit' ? `
        <label class="flex items-center justify-between gap-4 p-4 sm:p-5 rounded-2xl border border-gray-200 dark:border-gray-800 bg-gradient-to-r from-emerald-50/70 to-white dark:from-emerald-950/20 dark:to-gray-900 cursor-pointer">
            <span class="flex items-center gap-3">
                <span class="h-9 w-9 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 text-white flex items-center justify-center text-base shadow-md">🔑</span>
                <span>
                    <span class="block text-sm font-bold text-gray-900 dark:text-white">Account status · <span data-status-label class="${isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'}">${isActive ? 'Active' : 'Archived'}</span></span>
                    <span class="block text-xs text-gray-500 dark:text-gray-400">Archived users cannot sign in.</span>
                </span>
            </span>
            <span class="relative inline-flex items-center">
                <input type="checkbox" name="isActive" class="sr-only peer" ${isActive ? 'checked' : ''} />
                <span class="w-12 h-7 bg-gray-300 dark:bg-gray-700 rounded-full peer peer-checked:bg-gradient-to-r peer-checked:from-emerald-400 peer-checked:to-teal-500 peer-focus-visible:ring-4 peer-focus-visible:ring-emerald-400/30 after:content-[''] after:absolute after:top-1 after:left-1 after:bg-white after:rounded-full after:h-5 after:w-5 after:shadow after:transition-all peer-checked:after:translate-x-5 transition-colors"></span>
            </span>
        </label>
        ` : ''}

        <div class="flex items-center justify-end pt-4 border-t border-gray-100 dark:border-gray-800">
            <button type="submit" id="${idPrefix}-submit"
                class="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-primary-500 via-orange-500 to-rose-500 px-10 py-3 text-sm font-bold text-white shadow-lg shadow-primary-500/30 hover:shadow-xl hover:shadow-primary-500/40 hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-primary-400/40 transition-all active:scale-95">
                ${buttonLabel}
            </button>
        </div>
    </form>
    `;
}

/** Live bits of the form: preview card, password meter, app count, status label. */
export function enhanceUserForm(form) {
    if (!form || form.dataset.enhanced) return;
    form.dataset.enhanced = 'true';
    const $ = (sel) => form.querySelector(sel);

    const first = $('[name="firstName"]');
    const last = $('[name="lastName"]');
    const email = $('[name="email"]');
    const avatar = $('[data-preview-avatar]');
    const nameEl = $('[data-preview-name]');
    const emailEl = $('[data-preview-email]');

    const preview = () => {
        const full = `${first?.value || ''} ${last?.value || ''}`.trim();
        if (nameEl) nameEl.textContent = full || 'Their name here';
        if (emailEl) emailEl.textContent = email?.value.trim() || 'email@example.com';
        if (avatar) avatar.textContent = initials(first?.value, last?.value);
    };
    const bump = () => {
        if (!avatar) return;
        avatar.classList.add('scale-110');
        setTimeout(() => avatar.classList.remove('scale-110'), 180);
    };

    const roles = () => {
        const el = $('[data-preview-roles]');
        if (!el) return;
        const names = [...form.querySelectorAll('input[name="userTypeIds[]"][data-role-name]:checked')].map((c) => c.dataset.roleName);
        el.textContent = names.length ? names.join(' · ') : 'No account type yet';
    };

    const apps = () => {
        const boxes = [...form.querySelectorAll('input[data-app]')];
        if (!boxes.length) return;
        const n = boxes.filter((b) => b.checked).length;
        const count = $('[data-app-count]');
        if (count) count.textContent = `${n} of ${boxes.length}`;
        const pa = $('[data-preview-apps]');
        if (pa) pa.textContent = n ? `${n} ${n === 1 ? 'app' : 'apps'}` : 'No apps yet';
    };

    // Password strength (0–4) and match
    const pass = $('[name="password"]');
    const confirm = $('[name="confirmPassword"]');
    const LEVELS = [
        ['Too short', 'bg-red-400', 'text-red-500'],
        ['Weak', 'bg-orange-400', 'text-orange-500'],
        ['Fair', 'bg-amber-400', 'text-amber-500'],
        ['Good', 'bg-lime-500', 'text-lime-600'],
        ['Strong 💪', 'bg-emerald-500', 'text-emerald-600'],
    ];
    const strength = () => {
        if (!pass) return;
        const v = pass.value;
        let score = v.length >= 8 ? 1 : 0;
        if (score) {
            if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
            if (/\d/.test(v)) score++;
            if (/[^A-Za-z0-9]/.test(v) || v.length >= 14) score++;
        }
        const [label, bar, text] = LEVELS[score];
        form.querySelectorAll('[data-strength-bar]').forEach((b, i) => {
            b.className = `h-1.5 flex-1 rounded-full transition-colors duration-300 ${v && i < Math.max(1, score) ? bar : 'bg-gray-200 dark:bg-gray-700'}`;
        });
        const lbl = $('[data-strength-label]');
        if (lbl) { lbl.textContent = v ? label : 'Type a password'; lbl.className = `text-xs font-semibold ${v ? text : 'text-gray-400'}`; }
        const match = $('[data-match-label]');
        if (match && confirm) {
            match.textContent = confirm.value ? (confirm.value === v ? '✓ Passwords match' : '✗ Passwords don’t match') : '';
            match.className = `text-xs font-semibold ${confirm.value === v ? 'text-emerald-600' : 'text-red-500'}`;
        }
    };

    form.addEventListener('input', (ev) => {
        if (ev.target === first || ev.target === last) { preview(); bump(); }
        else if (ev.target === email) preview();
        else if (ev.target === pass || ev.target === confirm) strength();
    });
    form.addEventListener('change', (ev) => {
        if (ev.target.name === 'userTypeIds[]') roles();
        if (ev.target.matches('input[data-app]')) apps();
        if (ev.target.name === 'isActive') {
            const s = $('[data-status-label]');
            if (s) { s.textContent = ev.target.checked ? 'Active' : 'Archived'; s.className = ev.target.checked ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500'; }
        }
    });
    form.addEventListener('click', (ev) => {
        const eye = ev.target.closest('[data-toggle-password]');
        if (eye) {
            const input = eye.parentElement.querySelector('input');
            input.type = input.type === 'password' ? 'text' : 'password';
            return;
        }
        const bulk = ev.target.closest('[data-apps]');
        if (bulk) {
            const on = bulk.dataset.apps === 'all';
            form.querySelectorAll('input[data-app]').forEach((b) => { b.checked = on; });
            if (!on) form.querySelectorAll('input[name="permittedApps[]"]:not([data-app])').forEach((b) => { b.checked = false; });
            apps();
        }
    });

    preview();
    roles();
    apps();
}
