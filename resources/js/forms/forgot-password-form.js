// /resources/js/forms/forgot-password-form.js

/**
 * Forgot Password form HTML for modal
 */
export const forgotPasswordFormFormHTML = `
<div class="animate-in fade-in slide-in-from-bottom-2 duration-300">
    <h3 class="text-xl font-black text-gray-900 dark:text-white mb-2 font-sans">Reset Password</h3>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6 font-sans">
        Enter your email address and we'll send you a link to reset your password.
    </p>

    <form id="forgot-password-form" class="space-y-4" novalidate>
        <div class="flex flex-col">
            <label for="reset-email" class="mb-1 text-gray-700 dark:text-gray-300 font-sans text-sm font-semibold">Email</label>
            <input type="email" id="reset-email" name="email" placeholder="you@example.com"
                class="px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" required>
        </div>

        <div id="reset-api-message" class="text-sm"></div>

        <div class="flex flex-col gap-3 pt-2">
            <button type="submit" id="btn-send-reset"
                class="w-full px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-bold rounded-md transition-all active:scale-95">
                Send Reset Link
            </button>
            <button type="button" id="back-to-login" class="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors py-2 font-semibold font-sans">
                Back to Sign In
            </button>
        </div>
    </form>
</div>
`;