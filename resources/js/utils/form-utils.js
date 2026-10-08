// /resources/js/utils/form-utils.js

// Pre-trigger validation for Add form, reset validator flags
export function resetFormValidation(resource) {
    const form = document.getElementById(`${resource}-add-form`);
    if (form) {
        form.querySelectorAll('input, select, textarea').forEach((field) => {
            field.dispatchEvent(new Event('input', { bubbles: true }));
        });
    }

    document.querySelectorAll('[data-validator-initialized]').forEach(el => {
        delete el.dataset.validatorInitialized;
    });
}
