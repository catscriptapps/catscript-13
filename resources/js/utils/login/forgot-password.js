// /resources/js/utils/login/forgot-password.js

import { forgotPasswordFormFormHTML } from '../../forms/forgot-password-form.js';
import { loginFormHTML } from '../../forms/login-form.js'; 
import { handleForgotPasswordSubmission } from './forgot-password-submit.js';

let isInitialized = false;

/**
 * Initializes the "Forgot Password" flow with a singleton listener.
 */
export function initForgotPassword() {
    if (isInitialized) return;

    document.addEventListener('click', (e) => {
        const link = e.target.closest('#forgot-password-link');
        if (!link) return;

        e.preventDefault();
        renderForgotPasswordForm();
    });

    isInitialized = true;
}

/**
 * Swaps the modal content with the Password Recovery form.
 */
function renderForgotPasswordForm() {
    const container = document.getElementById('login-form-container') || document.querySelector('#login-form')?.parentElement;
    if (!container) return;

    container.innerHTML = forgotPasswordFormFormHTML;
    
    // FOCUS: Grab the reset email input
    setTimeout(() => {
        container.querySelector('#reset-email')?.focus();
    }, 50);

    attachResetListeners(container);
}

/**
 * Attaches events to the Reset form, including the "Back" navigation.
 */
function attachResetListeners(container) {
    const form = container.querySelector('#forgot-password-form');
    const backBtn = container.querySelector('#back-to-login');

    // Handle Return to Login (The "Back" Button)
    backBtn.addEventListener('click', (e) => {
        e.preventDefault();
        
        container.innerHTML = `
            <div class="animate-in fade-in slide-in-from-bottom-2 duration-300">
                <h3 class="text-xl font-black text-gray-900 dark:text-white mb-6 font-sans tracking-tight">Sign In</h3>
                ${loginFormHTML}
            </div>
        `;

        // FOCUS: Grab the login email input
        setTimeout(() => {
            container.querySelector('#login-email')?.focus();
        }, 50);
    });

    // Handle Reset API Submission via dedicated utility
    // We removed the local submit listener to prevent double-firing.
    handleForgotPasswordSubmission(form);
}