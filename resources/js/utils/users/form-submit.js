// /resources/js/utils/users/form-submit.js

import { FormValidator } from '../../utils/form-validator.js';
import { buttonSpinner } from '../../utils/spinner-utils.js';
import { updateCount } from '../../components/table-pagination-count.js';
import { initProfileModal } from '../../modals/profile-modal.js';

/**
 * Helper to toggle validation styling on role checkboxes
 */
function validateRoles(form, apiMsg) {
    const checkboxes = form.querySelectorAll('input[name="userTypeIds[]"]');
    const checked = Array.from(checkboxes).filter(c => c.checked);
    
    if (checked.length === 0) {
        checkboxes.forEach(cb => {
            const label = cb.closest('label');
            label.classList.add('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
            label.classList.remove('border-gray-200', 'dark:border-gray-700');
        });

        apiMsg.innerHTML = `
            <div class="role-error bg-red-600 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg animate-bounce mt-2 text-center">
                Please select at least one Account Type
            </div>
        `;
        return false;
    }
    return true;
}

/**
 * Maps form data to an API payload for Users
 */
function getPayload(form, mode) {
    const formData = new FormData(form);
    const data = Object.fromEntries(formData.entries());
    const userTypeIds = formData.getAll('userTypeIds[]');

    const payload = {
        encoded_id: form.dataset.encodedId || null,
        first_name: data.firstName?.trim(),
        last_name: data.lastName?.trim(),
        email: data.email?.trim(),
        password: data.password || null,
        password_confirmation: data.confirmPassword || null, // Capture confirmation
        address: data.address?.trim(),
        city: data.city?.trim(),
        avatar_url: data.avatarUrl?.trim(),
        country_id: parseInt(data.countryId),
        region_id: parseInt(data.regionId),
        user_type_ids: userTypeIds.map(id => parseInt(id)),
        status_id: form.querySelector('input[name="isActive"]')?.checked ? 1 : 0,
    };

    // App access (admin-only section — only sent when it was on the form)
    if (formData.get('permittedAppsPresent')) {
        payload.permitted_apps_present = true;
        payload.permitted_apps = formData.getAll('permittedApps[]');
    }

    return payload;
}

export function handleUserFormSubmission(form, mode, modalInstance, tableSelector = '#users-tbody') {
    if (form._userFormListenerAttached) return;
    form._userFormListenerAttached = true;

    const validator = new FormValidator(form);
    const submitBtn = form.querySelector('button[type="submit"]');
    let apiMsg = form.querySelector('.api-message') || (() => {
        const div = document.createElement('div');
        div.className = 'api-message mt-4 transition-all duration-300';
        form.appendChild(div);
        return div;
    })();

    // Live listener for roles
    form.addEventListener('change', (e) => {
        if (e.target.name === 'userTypeIds[]') {
            const checkboxes = form.querySelectorAll('input[name="userTypeIds[]"]');
            if (Array.from(checkboxes).some(c => c.checked)) {
                checkboxes.forEach(cb => {
                    const label = cb.closest('label');
                    label.classList.remove('border-red-500', 'bg-red-50', 'dark:bg-red-900/20');
                    label.classList.add('border-gray-200', 'dark:border-gray-700');
                });
                form.querySelector('.role-error')?.remove();
            }
        }
    });

    const originalLabel = submitBtn.innerHTML;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // 1. Standard Field Validation
        if (!validator.validateForEmptyFields(e)) return;

        // 2. Custom Role Validation
        if (!validateRoles(form, apiMsg)) return;

        // 3. Password Match Validation (Only for Add Mode)
        if (mode === 'add') {
            const pass = form.querySelector('input[name="password"]');
            const confirm = form.querySelector('input[name="confirmPassword"]');
            
            if (pass.value !== confirm.value) {
                [pass, confirm].forEach(el => el.classList.add('border-red-500', 'animate-shake'));
                apiMsg.innerHTML = `
                    <div class="bg-red-600 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-lg mt-2 text-center">
                        Passwords do not match
                    </div>
                `;
                setTimeout(() => [pass, confirm].forEach(el => el.classList.remove('animate-shake')), 500);
                return;
            }
        }

        submitBtn.disabled = true;
        submitBtn.innerHTML = buttonSpinner; 
        apiMsg.innerHTML = '';

        try {
            const payload = getPayload(form, mode);
            if (mode === 'edit') payload._method = 'PUT';

            const baseUrl = window.APP_CONFIG?.baseUrl || '/';
            const response = await fetch(`${baseUrl}api/users`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });

            const result = await response.json();

            if (result.success) {
                // Pages that keep their own copy of the users (pages/users-page.js) refresh on this
                document.dispatchEvent(new CustomEvent('users:saved', { detail: { mode, result } }));

                // 1. UPDATE TABLE (any page still rendering server rows into a tbody)
                const tbody = document.querySelector(tableSelector);
                if (tbody) {
                    if (mode === 'edit' && result.rowHtml) {
                        const existingRow = document.getElementById(`user-row-${result.data?.id}`) ||
                                           document.querySelector(`tr[data-encoded-id="${payload.encoded_id}"]`);
                        if (existingRow) existingRow.outerHTML = result.rowHtml;
                    } else if (result.rowHtml) {
                        tbody.insertAdjacentHTML('afterbegin', result.rowHtml);
                    }
                    updateCount('user', tableSelector, '#users-count');
                }

                // 2. REFRESH PROFILE PAGE (If editing self)
                const profileWrapper = document.getElementById('partial-profile');
                if (profileWrapper && window.loadPartial) {
                    const currentUrl = window.location.pathname;
                    window.loadPartial(currentUrl, false).then(() => {
                        setTimeout(() => initProfileModal(), 100);
                    });
                }

                apiMsg.innerHTML = `
                    <div class="bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-xl font-bold text-sm mt-2">
                        ${result.messages?.[0] || 'Saved successfully.'}
                    </div>
                `;

                submitBtn.style.visibility = 'hidden';
                setTimeout(() => modalInstance?.close(), (mode === 'add') ? 5000 : 800);

            } else {
                apiMsg.innerHTML = (result.messages || ['Error']).map(msg => `
                    <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-xl font-bold text-sm mt-2">${msg}</div>
                `).join('');
            }

        } catch (err) {
            console.error('Submission Error:', err);
            apiMsg.innerHTML = `<div class="bg-red-100 text-red-700 px-4 py-2 rounded-xl font-bold text-sm mt-2">Unexpected error.</div>`;
        } finally {
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerHTML = originalLabel;
            }
        }
    });
}