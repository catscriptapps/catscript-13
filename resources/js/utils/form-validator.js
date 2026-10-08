/**
 * /resources/js/utils/form-validator.js
 *
 * Enhanced form validation utility.
 *
 * Features:
 * - Highlights invalid fields with red border and shake/pulse animation
 * - Displays inline validation messages under each input
 * - Supports inputs, textareas, and selects
 * - Live validation: clears errors when user types or selects a value
 * - Works with flex/grid input layouts
 * - Automatically generates readable field names from labels or input names
 */

import { showToast } from '../ui/toast.js';

export class FormValidator {
    /**
     * @param {HTMLFormElement} formElement - Form element to validate
     * @param {string} inputSelector - Selector for inputs (default: 'input, textarea, select')
     */
    constructor(formElement, inputSelector = 'input, textarea, select') {
        if (!formElement) {
            console.error('FormValidator requires a valid form element.');
            return;
        }

        this.form = formElement;                     // Form to validate
        this.inputSelector = inputSelector;          // CSS selector for inputs
        this.inputs = this.form.querySelectorAll(this.inputSelector); // All target inputs

        // Classes for invalid state
        this.errorClasses = ['border-red-500', 'focus:ring-red-500', 'focus:border-red-500'];

        // Classes for normal state
        this.defaultClasses = ['border-gray-300', 'focus:ring-primary-500', 'focus:border-primary-500'];

        // Attach live validation listeners
        this.addLiveValidationListeners();
    }

    /**
     * Clears error styles and message for a specific input
     * @param {HTMLElement} input
     */
    clearError(input) {
        // Reset border & focus classes
        input.classList.remove(...this.errorClasses);
        input.classList.add(...this.defaultClasses);

        // Remove inline error message
        const wrapper = input.closest('.reset-input-wrapper') || input.parentElement;
        const msg = wrapper.querySelector('.validation-message');
        if (msg) msg.remove();
    }

    /**
     * Adds live listeners to clear errors as the user types or changes value
     */
    addLiveValidationListeners() {
        this.inputs.forEach(input => {
            const clearHandler = () => this.clearError(input);

            // For selects, listen to change events
            if (input.tagName === 'SELECT') input.addEventListener('change', clearHandler);
            // For input/textarea, listen to input events
            else input.addEventListener('input', clearHandler);
        });
    }

    /**
     * Reset all inputs to default styles
     */
    resetInputStyles() {
        this.inputs.forEach(input => this.clearError(input));
    }

    /**
     * Returns container where validation message should go.
     * Wraps input in a relative container if necessary.
     * @param {HTMLElement} input
     */
    getErrorMessageContainer(input) {
        if (!input.parentElement.classList.contains('fv-input-wrapper')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'fv-input-wrapper relative';
            input.parentElement.insertBefore(wrapper, input);
            wrapper.appendChild(input);
            return wrapper.querySelector('.validation-message');
        }
        return input.parentElement.querySelector('.validation-message');
    }

    /**
     * Displays error message for a specific input
     * @param {HTMLElement} input
     * @param {string} message
     */
    showError(input, message = 'This field is required.') {
        // Apply error border/focus classes
        input.classList.add(...this.errorClasses);
        input.classList.remove(...this.defaultClasses);

        const wrapper = input.closest('.reset-input-wrapper') || input.parentElement;

        // Only create message if it doesn't exist yet
        if (!wrapper.querySelector('.validation-message')) {
            const msg = document.createElement('p');
            msg.className = 'validation-message text-sm text-red-500 mt-1';
            msg.textContent = message;

            // Append to optional container or directly to wrapper
            const container = wrapper.querySelector('.validation-message-container');
            if (container) container.appendChild(msg);
            else wrapper.appendChild(msg);
        }

        // Shake animation for attention
        input.classList.add('animate-shake');
        setTimeout(() => input.classList.remove('animate-shake'), 500);
    }

    /**
     * Animate all invalid fields with shake and pulse
     */
    animateInvalidFields() {
        const invalidInputs = Array.from(this.inputs).filter(input => input.value.trim() === '');
        if (!invalidInputs.length) return;

        const isMobile = window.innerWidth <= 640;
        const shakeClass = isMobile ? 'animate-shake-sm' : 'animate-shake';

        invalidInputs.forEach(input => {
            input.classList.add(shakeClass, 'animate-pulse-border');
        });

        setTimeout(() => {
            invalidInputs.forEach(input => {
                input.classList.remove(shakeClass, 'animate-pulse-border');
            });
        }, 500);
    }

    /**
     * Validates form for empty fields
     * - Shows inline errors
     * - Prevents form submission if invalid
     * @param {Event} e - Form submit event
     * @returns {boolean} - True if valid, false otherwise
     */
    validateForEmptyFields(e) {
        let isValid = true;
        this.resetInputStyles();

        this.inputs.forEach(input => {
            // Only validate required inputs
            if (input.hasAttribute('required') && input.value.trim() === '') {
                isValid = false;
                this.showError(input, `* ${this.getReadableFieldName(input)} is required.`);
            }
        });

        if (!isValid) {
            e.preventDefault();
            this.animateInvalidFields();
            showToast('Some required fields are missing', 'error');
        }

        return isValid;
    }

    /**
     * Returns a human-readable field name from label or input name
     * @param {HTMLElement} input
     */
    getReadableFieldName(input) {
        const label = this.form.querySelector(`label[for="${input.id}"]`);
        if (label) return label.textContent.replace(/[*:]/g, '').trim();
        return input.name ? input.name.replace(/[-_]/g, ' ') : 'Field';
    }
}
