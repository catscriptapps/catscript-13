// /resources/js/modals/login-modal.js

import { Modal } from '../factories/modal-factory.js';
import { FormValidator } from '../utils/form-validator.js';
import { loginFormHTML } from '../forms/login-form.js';
import { buttonSpinner } from '../utils/spinner-utils.js';
import { initForgotPassword } from '../utils/login/forgot-password.js';

// app.js builds a new LoginModal after every SPA navigation (initGlobalModals),
// but the listeners below live on document — attach them once per page load
// and point them at the newest instance. Attaching them per instance stacked
// one more handler each navigation, so e.g. the password eye toggled twice
// (= no change) after the first page change.
let current = null;
let listenersBound = false;

export class LoginModal {
    constructor(signInButtonSelector) {
        this.selector = signInButtonSelector;

        // Initialize the reusable modal
        this.modal = new Modal({
            id: 'login-modal',
            title: 'Sign In',
            content: loginFormHTML,
            size: 'sm',
            showFooter: false,
        });

        current = this;
        if (!listenersBound) {
            listenersBound = true;
            this.initEventListeners();
        }
        initForgotPassword();
    }

    initEventListeners() {
        // 1. Listen for clicks to OPEN the modal (Delegated)
        document.body.addEventListener('click', (event) => {
            const button = event.target.closest(current.selector);
            if (!button) return;

            event.preventDefault();
            current.modal.open();

            // FOCUS: Focus the first field on initial open
            setTimeout(() => {
                document.getElementById('login-email')?.focus();
            }, 100);
        });

        // 💎 NEW: Password Visibility Toggle (Delegated)
        document.addEventListener('click', (e) => {
            const toggleBtn = e.target.closest('#toggle-password');
            if (!toggleBtn) return;

            const passInput = document.getElementById('login-password');
            const eyeShow = document.getElementById('eye-show');
            const eyeHide = document.getElementById('eye-hide');

            if (!passInput || !eyeShow || !eyeHide) return;

            const isPassword = passInput.type === 'password';
            passInput.type = isPassword ? 'text' : 'password';

            // Toggle visibility of the icons
            eyeShow.classList.toggle('hidden', isPassword);
            eyeHide.classList.toggle('hidden', !isPassword);
        });

        // 3. Listen for the form SUBMIT (Delegated to document)
        // This solves the "Multiple Logs" issue because this listener is only added ONCE.
        document.addEventListener('submit', async (e) => {
            // Only act if the submitting form is our login form
            if (e.target.id !== 'login-form') return;

            e.preventDefault();
            e.stopImmediatePropagation();

            const form = e.target;

            // Check if already processing to prevent "Machine-gun" clicks
            const submitBtn = form.querySelector('button[type="submit"]');
            if (submitBtn.disabled) return;

            const validator = new FormValidator(form);
            const apiMessageContainer = document.getElementById('login-api-message');

            if (!validator.validateForEmptyFields(e)) return;

            // UI Feedback
            const originalBtnText = submitBtn.textContent;
            submitBtn.disabled = true;
            submitBtn.innerHTML = buttonSpinner;
            if (apiMessageContainer) apiMessageContainer.innerHTML = '';

            try {
                const loginUrl = `${window.APP_CONFIG.baseUrl}api/login`;
                const formData = new FormData(form);
                const body = Object.fromEntries(formData.entries());

                const response = await fetch(loginUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const result = await response.json();

                if (result.success) {
                    // An unverified account is signed in but told so, in amber
                    // and for long enough to actually read before the reload.
                    const unverified = !!result.email_unverified;
                    const tone = unverified
                        ? 'bg-amber-50 border border-amber-300 text-amber-800'
                        : 'bg-green-100 border border-green-400 text-green-700';

                    if (apiMessageContainer) {
                        apiMessageContainer.innerHTML = result.messages
                            .map(msg => `<div class="${tone} px-4 py-2 rounded-md mt-2 flex items-center gap-2"><span>${msg}</span></div>`)
                            .join('');
                        submitBtn.style.display = 'none';
                    }

                    setTimeout(() => {
                        current.modal.close();

                        // Stay put — reload the page the modal was opened from rather
                        // than jumping to /dashboard, so e.g. signing in from the
                        // Report A Landlord guest gate lands back on that page with
                        // the real form instead of yanking the user elsewhere. A full
                        // reload (not a partial load) is required so the server
                        // re-renders with the now-authenticated session.
                        window.location.reload();
                    }, unverified ? 4500 : 1200);
                } else {
                    if (apiMessageContainer) {
                        apiMessageContainer.innerHTML = result.messages.map(msg => `<p class="text-red-500 text-sm mt-1">${msg}</p>`).join('');
                    }
                    submitBtn.disabled = false;
                    submitBtn.innerHTML = originalBtnText;
                }
            } catch (err) {
                console.error('Login request failed:', err);
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalBtnText;
            }
        });
    }
}