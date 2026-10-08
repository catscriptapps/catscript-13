// /resources/js/pages/reset-password-page.js

import { initUpdatePassword } from '../utils/login/update-password.js';

/**
 * Initialize the Reset Password page JS.
 */
export function init() {
    // 1. Initialize the main form logic for updating the password
    // This will live in your login utils since it's auth-related.
    initUpdatePassword();
}