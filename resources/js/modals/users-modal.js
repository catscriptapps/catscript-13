// /resources/js/modals/users-modal.js

import { Modal } from '../factories/modal-factory.js';
import { userForm, enhanceUserForm } from '../forms/user-form.js';
import { fetchRegions } from '../api/regions-api.js';
import { fetchCountries } from '../api/countries-api.js';
import { fetchUserTypes } from '../api/user-types-api.js';
import { enableDynamicRegionLoading } from '../components/regions-component.js';
import { handleUserFormSubmission } from '../utils/users/form-submit.js';

let userModal = null;

// The Admin role (user_type_id 1) is never shown to a non-admin caller —
// e.g. when a regular user edits their own profile. Only an
// already-admin viewer, editing a user from /users, sees it (and can then
// grant it to someone else). UsersController::save() enforces this
// server-side too — this is just keeping the UI honest about what's
// actually possible.
function visibleRoles(availableRoles) {
    if (window.APP_CONFIG?.isAdmin) return availableRoles;
    return availableRoles.filter((role) => role.id !== 1);
}

/**
 * Initialize form features after the modal opens
 */
function initFormFeatures(formId, mode, modalInstance) {
    const form = document.getElementById(formId);
    if (!form) return;

    // 1. Handle Submission (API calls, spinners, etc.)
    handleUserFormSubmission(form, mode, modalInstance);

    // 2. Live preview card, password meter, app count (forms/user-form.js)
    enhanceUserForm(form);

    // 3. Setup Dynamic Region/State dropdowns
    enableDynamicRegionLoading(formId);
}

// --- Add User ---
export async function openAddUserModal() {
    const countryId = ''; // No country selected by default for Add form

    // fetchRegions requires a country_id (server 400s without one, by
    // design — see server/api/regions.php) — skip the call entirely rather
    // than firing a call we know will fail; the region select starts empty
    // and populates once enableDynamicRegionLoading() sees a country chosen.
    const [countries, availableRoles] = await Promise.all([
        fetchCountries(),
        fetchUserTypes()
    ]);
    const regions = [];

    if (userModal) userModal.destroy();

    userModal = new Modal({
        id: 'add-user-modal',
        title: 'New User Account',
        content: userForm({
            mode: 'add',
            formId: 'users-add-form',
            buttonLabel: 'Create User',
            countries,
            regions,
            availableRoles: visibleRoles(availableRoles),
            appOptions: window.APP_CONFIG?.grantableApps || [],
            countryId
        }),
        size: 'lg',
        showFooter: false,
    });

    userModal.open();
    initFormFeatures('users-add-form', 'add', userModal);
}

// --- Edit User ---
export async function openEditUserModal(trigger) {
    // Ensure we are hitting the button even if an icon inside was clicked
    const btn = trigger.closest('.edit-user-btn') || trigger;
    if (!btn?.dataset) return;

    const data = btn.dataset;
    const countryId = parseInt(data.countryId || '');

    // 1. Parse the JSON string from data-user-type-ids
    // 2. Force them into Numbers to match the database IDs exactly
    let userTypeIds = [];
    try {
        userTypeIds = JSON.parse(data.userTypeIds || '[]').map(id => Number(id));
    } catch (e) {
        console.error("Error parsing user roles:", e);
    }

    let permittedApps = [];
    try {
        permittedApps = JSON.parse(data.permittedApps || "[]");
    } catch (e) {
        permittedApps = [];
    }

    const [countries, regions, availableRoles] = await Promise.all([
        fetchCountries(),
        fetchRegions(countryId),
        fetchUserTypes()
    ]);

    if (userModal) userModal.destroy();

    const firstName = data.firstName || '';
    const lastName = data.lastName || '';

    userModal = new Modal({
        id: 'edit-user-modal',
        title: 'Edit User Profile',
        content: userForm({
            mode: 'edit',
            formId: 'users-edit-form',
            firstName: firstName,
            lastName: lastName,
            email: data.email,
            countryId: countryId,
            regionId: parseInt(data.regionId || 0),
            city: data.city,
            isActive: data.isActive === "1",
            // Pass the cleaned array of numbers
            userTypes: userTypeIds,
            countries,
            regions,
            availableRoles: visibleRoles(availableRoles),
            buttonLabel: 'Save Changes',
            encodedId: data.encodedId,
            isProtected: data.isProtected === '1',
            appOptions: window.APP_CONFIG?.grantableApps || [],
            permittedApps
        }),
        size: 'lg',
        showFooter: false,
    });

    userModal.open();
    initFormFeatures('users-edit-form', 'edit', userModal);
}

let listenersAttached = false;
export function initUsersModal() {
    if (listenersAttached) return;

    document.addEventListener('click', (e) => {
        // Handle Add Button
        const addBtn = e.target.closest('#add-user-btn');
        if (addBtn) {
            e.preventDefault();
            openAddUserModal();
            return;
        }

        // Handle Edit Button (Delegated for dynamic table rows)
        const editBtn = e.target.closest('.edit-user-btn');

        // Prevention for profile-specific edits
        if (editBtn && editBtn.dataset.action === 'edit-user-profile') return;

        if (editBtn) {
            e.preventDefault();
            e.stopPropagation();
            openEditUserModal(editBtn);
        }
    });

    listenersAttached = true;
}