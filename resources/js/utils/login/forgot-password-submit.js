// /resources/js/utils/login/forgot-password-submit.js

import { FormValidator } from '../../utils/form-validator.js';
import { buttonSpinner } from '../../utils/spinner-utils.js';
import { showToast } from '../../ui/toast.js';

/**
 * Maps form data to an API payload for Forgot Password
 */
function getPayload(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    return {
        email: data.email?.trim(),
    };
}

/**
 * Handles the Forgot Password form submission logic
 * @param {HTMLFormElement} form - The recovery form element
 */
export function handleForgotPasswordSubmission(form) {
    // Prevent double binding if the form is re-rendered
    if (form._forgotPasswordListenerAttached) return;
    form._forgotPasswordListenerAttached = true;

    const validator = new FormValidator(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    let apiMsg = form.querySelector('#reset-api-message');

    // Create message container if it doesn't exist in the HTML
    if (!apiMsg) {
        apiMsg = document.createElement('div');
        apiMsg.id = 'reset-api-message';
        apiMsg.className = 'mt-4 transition-all duration-300';
        form.appendChild(apiMsg);
    }

    const originalLabel = submitBtn.innerHTML;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Validation check - MUST return here if invalid
        if (!validator.validateForEmptyFields(e)) {
            return;
        }

        // 2. UI State: Loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = buttonSpinner; 
        apiMsg.innerHTML = '';

        try {
            const payload = getPayload(form);
            const baseUrl = window.APP_CONFIG?.baseUrl || '/';
            
            // Fixed Route: Removed /auth/ to match your router requirements
            const response = await fetch(`${baseUrl}api/forgot-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.success) {
                showToast('Recovery email sent!', 'success');
                apiMsg.innerHTML = `
                    <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-xl font-bold text-xs text-center animate-in zoom-in duration-300">
                        ${result.message || 'Check your inbox for a reset link.'}
                    </div>
                `;

                submitBtn.style.display = 'none';
                form.reset();

            } else {
                // Logic Error UI (e.g., email not found)
                apiMsg.innerHTML = (result.messages || [result.message || 'Error sending reset link']).map(msg => `
                    <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-500 px-4 py-3 rounded-xl font-bold text-xs text-center animate-in shake duration-300">
                        ${msg}
                    </div>
                `).join('');
                
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalLabel;
            }

        } catch (err) {
            console.error('Submission Error:', err);
            showToast('Server connection error', 'error');
            apiMsg.innerHTML = `
                <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-500 px-4 py-3 rounded-xl font-bold text-xs text-center">
                    Unexpected error. Please try again.
                </div>`;
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalLabel;
        }
    });
}