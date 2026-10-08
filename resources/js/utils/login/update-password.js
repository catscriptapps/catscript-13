// /resources/js/utils/login/update-password.js

import { FormValidator } from '../../utils/form-validator.js';
import { buttonSpinner } from '../../utils/spinner-utils.js';
import { showToast } from '../../ui/toast.js';

/**
 * Maps form data to an API payload for Reset Password
 */
function getPayload(form) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    
    return {
        token: data.token,
        email: data.email,
        password: data.password,
        password_confirmation: data.password_confirmation
    };
}

/**
 * Initialize the Reset Password logic by finding the form
 */
export function initUpdatePassword() {
    const form = document.getElementById('new-password-form');
    if (form) {
        handleUpdatePasswordSubmission(form);
    }
}

/**
 * Handles the New Password form submission logic
 * @param {HTMLFormElement} form - The reset form element
 */
export function handleUpdatePasswordSubmission(form) {
    // Prevent double binding
    if (form._updatePasswordListenerAttached) return;
    form._updatePasswordListenerAttached = true;

    const validator = new FormValidator(form);
    const submitBtn = form.querySelector('#btn-update-password');
    let apiMsg = form.querySelector('#reset-api-message');

    // Support for the manual message container if not present
    if (!apiMsg) {
        apiMsg = document.createElement('div');
        apiMsg.id = 'reset-api-message';
        apiMsg.className = 'mt-4 transition-all duration-300';
        form.parentNode.insertBefore(apiMsg, form);
    }

    const originalLabel = submitBtn.innerHTML;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Validation check
        if (!validator.validateForEmptyFields(e)) {
            return;
        }

        // 2. Password Match Check (Local UX optimization)
        const pass = form.querySelector('#password').value;
        const confirm = form.querySelector('#password_confirmation').value;
        if (pass !== confirm) {
            showToast('Passwords do not match', 'error');
            return;
        }

        // 3. UI State: Loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = buttonSpinner; 
        apiMsg.innerHTML = '';
        apiMsg.classList.add('hidden');

        try {
            const payload = getPayload(form);
            const baseUrl = window.APP_CONFIG?.baseUrl || '/';
            
            const response = await fetch(`${baseUrl}api/reset-password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.success) {
                showToast('Password updated successfully!', 'success');
                apiMsg.classList.remove('hidden');
                apiMsg.innerHTML = `
                    <div class="bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400 px-4 py-3 rounded-md font-bold text-xs text-center animate-in zoom-in duration-300">
                        ${result.message || 'Your password has been changed. You can now sign in.'}
                    </div>
                `;

                submitBtn.style.display = 'none';
                form.reset();
                
                // Optional: Auto-redirect to login after 2 seconds
                setTimeout(() => {
                    // Redirect to home with a trigger parameter
                    window.location.href = `${baseUrl}?login=true`;
                }, 2500);

            } else {
                apiMsg.classList.remove('hidden');
                apiMsg.innerHTML = (result.messages || [result.message || 'Error updating password']).map(msg => `
                    <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-500 px-4 py-3 rounded-md font-bold text-xs text-center animate-in shake duration-300 mb-2">
                        ${msg}
                    </div>
                `).join('');
                
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalLabel;
            }

        } catch (err) {
            console.error('Submission Error:', err);
            showToast('Server connection error', 'error');
            apiMsg.classList.remove('hidden');
            apiMsg.innerHTML = `
                <div class="bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 text-rose-500 px-4 py-3 rounded-md font-bold text-xs text-center">
                    Unexpected error. Please try again.
                </div>`;
            
            submitBtn.disabled = false;
            submitBtn.innerHTML = originalLabel;
        }
    });
}